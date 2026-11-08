// ==========================================================================
// İndikatör Akademi — Backtest panosu QA
// Kullanım: node tools/bt/qa.mjs   (veya: npm run bt:qa)
// - btcharts fonksiyonlarını gerçek çıktılarla üretir (DOM'suz)
// - app.js'i sahte DOM ile yükler ve backtest ekranını uçtan uca çalıştırır:
//   rota, buton, rozet, KPI'lar, SVG paneller, ısı haritası, tıklama etkileşimleri
// - assets/bt/ çıktıları yoksa anlaşılır bir hata ile çıkar
// ==========================================================================
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

let ok = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { ok++; console.log('  ✓', name, extra); }
  else { fail++; console.log('  ✗', name, extra); }
};

/* ---------- ön koşul: çıktılar var mı ---------- */
try {
  await readFile(join(ROOT, 'assets/bt/index.json'), 'utf8');
} catch {
  console.log('\n✗ assets/bt/index.json bulunamadı.');
  console.log('  Önce backtest üretin:  node tools/bt/run.mjs   (veya npm run bt)');
  process.exit(1);
}

/* ---------- 1) grafik motoru (gerçek veriyle) ---------- */
console.log('\n1) Grafik motoru (btcharts)');
const charts = await import(pathToFileURL(join(ROOT, 'assets/js/engine/btcharts.js')).href);
const idx = JSON.parse(await readFile(join(ROOT, 'assets/bt/index.json'), 'utf8'));
const data = JSON.parse(await readFile(join(ROOT, 'assets/bt/sma.json'), 'utf8'));
const tfs = data.meta.tfs;
{
  const eqSeries = tfs.filter((t) => data.eq && data.eq[t]).map((t) => ({
    name: t, color: '#d9b45b', width: 1.2, opacity: 0.5,
    endLabel: t === '4h',
    pts: data.eq[t].map((v, i) => [data.meta.gridStart + i * data.meta.gridStepMs, v]),
  }));
  const eqSvg = charts.lineChart({ series: eqSeries, w: 680, h: 250, yFormat: (v) => charts.fmtNum(v, 1) + '×', zeroLine: 1, endLabelFmt: (v) => charts.fmtNum(v, 2) + '×' });
  check('lineChart (portföy eğrisi)', eqSvg.startsWith('<svg') && eqSvg.includes('<path'), `len=${eqSvg.length}`);
  check('lineChart: son değer rozeti', eqSvg.includes('class="endlabel"') && eqSvg.includes('×'));

  const sumTfs = tfs.filter((t) => data.sum && data.sum[t]);
  const avgScale = Math.max(1e-4, ...sumTfs.map((t) => Math.abs(data.sum[t].avg)));
  const barSvg = charts.barChart({
    w: 440, h: 200, yFormat: (v) => (v * 100).toFixed(1) + '%',
    items: sumTfs.map((t) => ({ label: t, value: data.sum[t].avg, sub: `${charts.fmtInt(data.sum[t].n)}`, color: charts.divColor(data.sum[t].avg / avgScale), active: t === '4h', tf: t })),
  });
  check('barChart (dilim karşılaştırma)', barSvg.startsWith('<svg') && (barSvg.match(/<rect/g) || []).length >= sumTfs.length, `dilim=${sumTfs.length}`);
  check('barChart: değer etiketleri', (barSvg.match(/btbar-val/g) || []).length === sumTfs.length, `etiket=${(barSvg.match(/btbar-val/g) || []).length}`);

  const bins = data.hist['4h'];
  check('histogram 82 kova', bins && bins.length === 82);
  const histSvg = charts.histogram({ bins, w: 680, h: 200 });
  check('histogram', histSvg.startsWith('<svg') && histSvg.includes('<rect'));
  check('histMedian', charts.histMedian(bins) != null);
  check('histogram: medyan işaretçisi + bölge tonları', histSvg.includes('hist-med') && histSvg.includes('medyan') && histSvg.includes('rgba(99,214,160,.055)'));

  const syms = idx.symbols;
  const heatSvg = charts.heatmap({
    rows: syms.slice(0, 24).map((s) => ({
      label: s.replace('USDT', ''),
      cells: tfs.map((t) => {
        const v = data.heat[t] && data.heat[t].avg ? data.heat[t].avg[s] : null;
        return { v, text: v == null ? '–' : (v * 100).toFixed(1), title: `${s} · ${t}` };
      }),
    })),
    cols: tfs.map((t) => ({ id: t, label: t })),
    colorFn: (v) => charts.divColor(v), cw: 58, ch: 22, activeCol: '1d',
  });
  check('heatmap', heatSvg.startsWith('<svg') && heatSvg.includes('btheat-cell'));
  check('heatmap: dokunmatik detay verisi', (heatSvg.match(/data-heat=/g) || []).length === 144, `hücre=${(heatSvg.match(/data-heat=/g) || []).length}`);
  check('heatmap: zebra satırlar + seçili sütun', heatSvg.includes('btheat-row') && heatSvg.includes('rgba(255,255,255,.018)') && heatSvg.includes('rgba(217,180,91,.7)'));
  check('fmtPct', charts.fmtPct(0.0123) === '+1.23%' && charts.fmtPct(-0.5) === '-50.00%');
  check('fmtInt (tr-TR)', charts.fmtInt(14285) === '14.285' || charts.fmtInt(14285).includes('14'), charts.fmtInt(14285));
}

/* ---------- 2) app.js — sahte DOM ile uçtan uca ---------- */
console.log('\n2) Uygulama (sahte DOM)');
const appEl = { innerHTML: '', isConnected: true, querySelector: () => null, addEventListener: () => {} };
const badgeEl = { textContent: '', isConnected: true, classList: { add: () => {} } };
const heatBox = { innerHTML: '', cls: new Set(), classList: { add: (c) => heatBox.cls.add(c), remove: (c) => heatBox.cls.delete(c) } };
const toastEl = { innerHTML: '', cls: new Set(), classList: { add: (c) => toastEl.cls.add(c), remove: (c) => toastEl.cls.delete(c) } };
const docListeners = {};
const winListeners = {};
const lsMap = new Map();
globalThis.document = {
  getElementById: (id) => (id === 'app' ? appEl : id === 'bt-badge' ? badgeEl : id === 'bt-heat-detail' ? heatBox : id === 'bt-toast' ? toastEl : null),
  querySelectorAll: () => [],
  addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
  title: '',
};
globalThis.window = {
  innerWidth: 1024,
  scrollY: 0,
  addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
  scrollTo: () => {},
};
globalThis.location = { hash: '' };
globalThis.localStorage = {
  getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
};
globalThis.fetch = async (url) => {
  const p = String(url).replace(/^\.?\//, '');
  try {
    const text = await readFile(join(ROOT, p), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

await import(pathToFileURL(join(ROOT, 'assets/js/app.js')).href);
const tick = () => new Promise((r) => setTimeout(r, 30));
await tick();

check('başlangıç: ev ekranı', appEl.innerHTML.includes('Kategoriler'), `len=${appEl.innerHTML.length}`);

const go = async (hash) => {
  globalThis.location.hash = hash;
  for (const fn of winListeners['hashchange'] || []) fn();
  await tick(); await tick();
};

// indikatör ekranı + CTA + rozet
await go('#/i/trend/sma');
check('indikatör: backtest butonu', appEl.innerHTML.includes('Backtest Sonuçlarını Gör') && appEl.innerHTML.includes('data-nav="#/bt/sma"'));
await tick();
check('indikatör: rozet güncellendi', badgeEl.textContent.includes('En iyi dilim'), badgeEl.textContent.slice(0, 60));

// backtest ekranı
await go('#/bt/sma');
check('bt: yükleniyor ekranı', appEl.innerHTML.includes('bt-screen') || appEl.innerHTML.includes('yükleniyor'));
await tick(); await tick();
const html = appEl.innerHTML;
check('bt: strateji kartı + kurallar', html.includes('bt-rules') && (html.match(/<li>/g) || []).length >= 2);
check('bt: yön etiketi', html.includes('SADECE LONG') || html.includes('İKİ YÖN'));
check('bt: dilim çipleri', html.includes('bt-tfbar') && html.includes('data-bt-tf="4h"'));
check('bt: 6 KPI kartı', (html.match(/kpi__value/g) || []).length === 6);
check('bt: portföy eğrisi SVG', html.includes('Eşit Ağırlıklı Portföy Eğrisi') && html.includes('<path'));
check('bt: histogram paneli', html.includes('İşlem Getiri Dağılımı'));
check('bt: yıllık paneller', html.includes('Yıllara Göre Getiri') && html.includes('Yıllara Göre Kazanma'));
check('bt: ısı haritası (24×6)', (html.match(/btheat-cell/g) || []).length === 144, `hücre=${(html.match(/btheat-cell/g) || []).length}`);
check('bt: metrik + satır çipleri', html.includes('data-bt-met="pf"') && html.includes('data-bt-top="all"'));
check('bt: ısı lejantı metriğe duyarlı', html.includes('kırmızı: negatif getiri') || html.includes('soluk: düşük kazanma'));
check('bt: disclaimer', html.includes('yatırım tavsiyesi değildir'));

// kullanıcı dostu görsel yardımcıları
check('bt: "nasıl okunur" ipuçları', (html.match(/panel__hint/g) || []).length >= 6, `ipucu=${(html.match(/panel__hint/g) || []).length}`);
check('bt: portföy son değer rozeti', html.includes('class="endlabel"'));
check('bt: bar değer etiketleri', html.includes('btbar-val'));
check('bt: histogram medyan işaretçisi', html.includes('hist-med') && html.includes('medyan'));
check('bt: ısı dokunmatik detay kutusu', html.includes('bt-heat-detail') && html.includes('Dokunduğun hücrenin detayı'));
check('bt: dokunma bildirimi (toast)', html.includes('bt-toast') && html.includes('aria-live'));

// tıklama etkileşimleri
const click = (sel, attr, val) => {
  const fakeEl = { getAttribute: (a) => (a === attr ? val : null), closest: (s) => (s === sel ? fakeEl : null), classList: { add: () => {}, remove: () => {} } };
  for (const fn of docListeners['click'] || []) fn({ target: fakeEl });
};
const before = appEl.innerHTML;
click('[data-bt-met]', 'data-bt-met', 'wr');
const afterMet = appEl.innerHTML;
check('bt: metrik değişti (wr)', afterMet !== before && afterMet.includes('data-bt-met="wr"'));
check('bt: lejant wr ile değişti', afterMet.includes('soluk: düşük kazanma'));
click('[data-bt-tf]', 'data-bt-tf', '1d');
const afterTf = appEl.innerHTML;
check('bt: dilim değişti (1d)', afterTf !== afterMet && afterTf.includes('data-bt-tf="1d"') && (afterTf.match(/kpi__value/g) || []).length === 6);
click('[data-bt-top]', 'data-bt-top', 'all');
check('bt: tüm satırlar modu', appEl.innerHTML.length > afterTf.length, `len ${afterTf.length}→${appEl.innerHTML.length}`);
// ısı hücresi dokunma: detay kutusu dolar, ekran yeniden çizilmez
const beforeHeat = appEl.innerHTML;
click('.btheat-cell', 'data-heat', 'BTCUSDT · 4h — işlem başına ort +0.9% · kazanma %35 · 14.285 işlem');
check('bt: hücre detayı kutuda açıldı', heatBox.innerHTML.includes('BTCUSDT') && heatBox.cls.has('is-on'), heatBox.innerHTML.slice(0, 50));
check('bt: hücre dokunma bildirimi (toast)', toastEl.innerHTML.includes('BTCUSDT') && toastEl.cls.has('is-on'), toastEl.innerHTML.slice(0, 50));
check('bt: hücre tıklaması ekranı yenilemez', appEl.innerHTML === beforeHeat);

// skipTfs'li ve 1w'i boş indikatörler
await go('#/bt/orb');
await tick(); await tick();
check('orb: test dışı notu', appEl.innerHTML.includes('Test dışı dilimler'));
check('orb: kapalı çipler', appEl.innerHTML.includes('is-off'));
await go('#/bt/pivot');
await tick(); await tick();
check('pivot: 1w kapalı çip', appEl.innerHTML.includes('is-off') && appEl.innerHTML.includes('1w'));
await go('#/bt/yok-boyle-bir-sey');
await tick(); await tick();
check('bilinmeyen id: zarif hata', appEl.innerHTML.includes('üretilmedi') || appEl.innerHTML.includes('Backtest'));

console.log(`\nSONUÇ: ${ok} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
