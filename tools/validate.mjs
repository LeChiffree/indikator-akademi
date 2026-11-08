// ==========================================================================
// validate.mjs — İçerik ve motor doğrulama
// Kullanım: node tools/validate.mjs
// - id tekilliği, zorunlu alanlar, çapraz referanslar
// - her indikatör için grafik üretimini dener (hata varsa raporlar)
// - anotasyon noktalarının çözülüp çözülmediğini raporlar
// ==========================================================================
import { ALL, TOTAL_COUNT, byId } from '../assets/js/data/index.js';
import { CATEGORIES } from '../assets/js/data/categories.js';
import { CALCS } from '../assets/js/engine/formulas.js';
import { renderChart } from '../assets/js/engine/charts.js';
import { SCENES } from '../assets/js/engine/scenes.js';
import { BT_STRATEGIES } from './bt/strategies.mjs';
import { readFile } from 'node:fs/promises';

let errors = 0;
let warnings = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warnings++; console.log('  ⚠ ' + m); };

console.log(`\nİndikatör Akademi — doğrulama (${TOTAL_COUNT} indikatör, ${CATEGORIES.length} kategori)\n`);

/* 1) id tekilliği + zorunlu alanlar */
console.log('1) Kimlik ve alan kontrolü');
const seen = new Set();
for (const ind of ALL) {
  if (seen.has(ind.id)) err(`Çift id: ${ind.id}`);
  seen.add(ind.id);
  for (const f of ['id', 'name', 'cat', 'one']) if (!ind[f]) err(`${ind.id}: '${f}' eksik`);
  if (!ind.shows || ind.shows.length < 1) err(`${ind.id}: 'shows' yok`);
  if (!ind.calc || ind.calc.length < 1) err(`${ind.id}: 'calc' yok`);
  if (!ind.play || ind.play.length < 1) err(`${ind.id}: 'play' yok`);
  if (ind.one && ind.one.length > 165) warn(`${ind.id}: tek cümle çok uzun (${ind.one.length} kr)`);
}

/* 2) Kategori tutarlılığı */
console.log('2) Kategori tutarlılığı');
for (const c of CATEGORIES) {
  const n = ALL.filter((x) => x.cat === c.id).length;
  if (n !== 20) err(`Kategori ${c.id}: 20 yerine ${n} indikatör`);
}

/* 3) Çapraz referanslar */
console.log('3) Çapraz referanslar (pairs)');
for (const ind of ALL) {
  for (const p of ind.pairs || []) {
    if (!byId(p)) err(`${ind.id}: '${p}' referansı bulunamadı`);
  }
}

/* 4) Grafik tanımları */
console.log('4) Grafik tanımları ve üretim');
const noMarkResults = [];
let diagramCount = 0, computedCount = 0;
for (const ind of ALL) {
  const spec = ind.chart;
  if (!spec) { err(`${ind.id}: chart tanımı yok`); continue; }
  if (spec.diagram) {
    diagramCount++;
    if (!SCENES[spec.diagram]) err(`${ind.id}: '${spec.diagram}' diyagram sahnesi yok`);
    continue;
  }
  computedCount++;
  // hesap id'leri mevcut mu?
  for (const o of spec.overlay || []) if (!CALCS[o.calc]) err(`${ind.id}: bilançoda 'overlay.${o.calc}' hesabı yok`);
  if (spec.panel && !CALCS[spec.panel.calc]) err(`${ind.id}: 'panel.${spec.panel.calc}' hesabı yok`);
  // üretim
  try {
    const r = renderChart(spec);
    if (!r.svg || r.svg.length < 100) err(`${ind.id}: SVG çıktısı şüpheli (${r.svg.length} kr)`);
    if (r.legend.length === 0 && !(spec.panel && spec.panel.calc === 'squeeze')) warn(`${ind.id}: lejant boş`);
    const markRows = (spec.marks || []).length;
    const resolved = (r.notes || []).length;
    if (markRows > 0 && resolved < markRows) noMarkResults.push(`${ind.id} (${resolved}/${markRows})`);
  } catch (e) {
    err(`${ind.id}: grafik üretilemedi → ${e.message}`);
  }
}
console.log(`   · ${computedCount} hesaplamalı grafik, ${diagramCount} diyagram`);

/* 5) Diziler aynı uzunlukta mı (motor sağlığı) */
console.log('5) Formül motoru sağlık kontrolü');
try {
  const sample = { seed: 5, scene: 'up' };
  const probe = renderChart({ ...sample, overlay: [{ calc: 'bb', p: 20 }, { calc: 'ichimoku' }], panel: { calc: 'rsi', p: 14 } });
  if (!probe.svg.includes('<svg')) err('örnek grafik SVG üretmedi');
} catch (e) {
  err(`örnek grafik hatası: ${e.message}`);
}

/* 6) Backtest strateji kataloğu ve çıktıları */
console.log('6) Backtest kataloğu ve çıktıları');
{
  const dataIds = new Set(ALL.map((x) => x.id));
  const stratIds = new Set(BT_STRATEGIES.map((s) => s.id));
  if (stratIds.size !== 100) err(`Backtest stratejisi 100 yerine ${stratIds.size}`);
  for (const id of dataIds) if (!stratIds.has(id)) err(`Backtest stratejisi eksik: ${id}`);
  for (const id of stratIds) if (!dataIds.has(id)) err(`Fazla backtest stratejisi: ${id}`);
  for (const s of BT_STRATEGIES) {
    if (!s.title) err(`${s.id}: strateji başlığı yok`);
    if (!['long', 'ls'].includes(s.dir)) err(`${s.id}: geçersiz yön '${s.dir}'`);
    if (!s.rules || s.rules.length < 1) err(`${s.id}: kural listesi yok`);
    if (typeof s.load !== 'function') err(`${s.id}: load fonksiyonu yok`);
    if (typeof s.entry !== 'function') err(`${s.id}: entry fonksiyonu yok`);
    for (const tf of s.skipTfs || []) if (!['5m', '15m', '1h', '4h', '1d', '1w'].includes(tf)) err(`${s.id}: geçersiz skipTfs '${tf}'`);
  }

  // üretilmiş çıktılar (varsa)
  try {
    const idx = JSON.parse(await readFile(new URL('../assets/bt/index.json', import.meta.url), 'utf8'));
    if (idx.engine !== 'ia-bt-v1') err(`bt/index.json: motor etiketi '${idx.engine}'`);
    if (!Array.isArray(idx.symbols) || !idx.symbols.length) err('bt/index.json: sembol listesi boş');
    if (!idx.grid || !idx.grid.n) err('bt/index.json: grid bilgisi yok');
    let files = 0, nullBest = [], schemaErr = 0;
    for (const [id, best] of Object.entries(idx.ids)) {
      if (!best) nullBest.push(id);
      let d;
      try {
        d = JSON.parse(await readFile(new URL(`../assets/bt/${id}.json`, import.meta.url), 'utf8'));
      } catch { err(`bt/${id}.json okunamadı`); continue; }
      files++;
      if (d.engine !== 'ia-bt-v1') { err(`bt/${id}.json: motor etiketi`); }
      if (!d.meta || !d.sum) { err(`bt/${id}.json: meta/sum eksik`); schemaErr++; continue; }
      for (const tf of d.meta.tfs || []) {
        if (d.sum[tf]) {
          if (!Array.isArray(d.hist[tf]) || d.hist[tf].length !== 82) { err(`bt/${id}.json: ${tf} histogram 82 değil`); schemaErr++; }
          else if (d.hist[tf].reduce((a, b) => a + b, 0) !== d.sum[tf].n) { err(`bt/${id}.json: ${tf} histogram toplamı işlem sayısına eşit değil`); schemaErr++; }
          if (!Array.isArray(d.eq[tf]) || d.eq[tf].length !== idx.grid.n) { err(`bt/${id}.json: ${tf} eğri ${idx.grid.n} değil`); schemaErr++; }
          const hk = d.heat && d.heat[tf] ? Object.keys(d.heat[tf]).sort().join(',') : '';
          if (hk !== 'avg,bh,dd,n,pf,wr') { err(`bt/${id}.json: ${tf} ısı anahtarları '${hk}'`); schemaErr++; }
          const s = d.sum[tf];
          for (const k of ['n', 'wr', 'avg', 'pf', 'tot', 'dd']) {
            if (!Number.isFinite(s[k])) { err(`bt/${id}.json: ${tf} ${k} sonlu değil (${s[k]})`); schemaErr++; }
          }
        }
      }
    }
    console.log(`   · ${files}/100 dosya, ${nullBest.length} boş özet`);
    if (schemaErr) console.log(`   · ${schemaErr} şema hatası`);
    if (nullBest.length) warn(`özeti boş indikatörler: ${nullBest.join(', ')}`);
  } catch {
    warn('backtest çıktısı yok (assets/bt/index.json) — `node tools/bt/run.mjs` ile üretilir');
  }
}

/* Rapor */
console.log('\n— Özet —');
if (noMarkResults.length) {
  console.log('⚠ Bazı anotasyonlar nokta bulamadı (metin yine notlarda görünür):');
  noMarkResults.forEach((r) => console.log('   · ' + r));
  warnings += noMarkResults.length;
}
if (errors === 0) console.log(`\n✅ Doğrulama geçti (${warnings} uyarı).\n`);
else console.log(`\n❌ ${errors} hata, ${warnings} uyarı.\n`);

process.exitCode = errors ? 1 : 0;
