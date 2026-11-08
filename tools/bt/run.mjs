// İndikatör Akademi — Backtest motoru · Koşucu
// Kullanım:
//   node tools/bt/run.mjs                          → tüm semboller, tüm TF'ler
//   node tools/bt/run.mjs --symbols=6 --tfs=4h,1d  → hızlı deneme
//   node tools/bt/run.mjs --workers=10 --out=assets/bt
import { Worker } from 'node:worker_threads';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listSymbols, TFS } from './io.mjs';
import { BT_STRATEGIES, BT_CATEGORY_OF } from './strategies.mjs';
import { GRID, newAcc, mergeAcc, finalizeIndicator } from './agg.mjs';
import { FILTERS } from './dashagg.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}

const tfs = args.tfs ? String(args.tfs).split(',') : TFS;
for (const tf of tfs) if (!TFS.includes(tf)) throw new Error('geçersiz tf: ' + tf);

const symbolsAll = await listSymbols();
const symbols = args.symbols ? symbolsAll.slice(0, Number(args.symbols)) : symbolsAll;
const nWorkers = Math.min(Number(args.workers || 10), symbols.length);
const OUT = resolve(ROOT, String(args.out || 'assets/bt'));
const only = args.only ? String(args.only).split(',') : null;
const REC = Boolean(args.records);

const specs = only ? BT_STRATEGIES.filter((s) => only.includes(s.id)) : BT_STRATEGIES;
if (!specs.length) throw new Error('seçili strateji yok');

/* ------------------- dashboard kayıt modu (--records) ------------------- */
let recDir = null, scenarioIds = null, symIds = null, nScen = 0;
if (REC) {
  recDir = resolve(ROOT, 'tools/dash/data/raw');
  await mkdir(recDir, { recursive: true });
  const { ALL } = await import(pathToFileURL(join(ROOT, 'assets/js/data/index.js')).href);
  const nameOf = new Map(ALL.map((a) => [a.id, { name: a.name, cat: a.cat }]));
  scenarioIds = {};
  const scenarios = [];
  let n = 0;
  for (const spec of specs) {
    for (const tf of tfs) {
      scenarioIds[spec.id + '|' + tf] = n;
      const meta = nameOf.get(spec.id) || { name: spec.id, cat: BT_CATEGORY_OF[spec.id] || null };
      scenarios.push({ i: n, id: spec.id, name: meta.name, cat: meta.cat, title: spec.title, tf });
      n++;
    }
  }
  nScen = n;
  symIds = {};
  symbols.forEach((s, i) => { symIds[s] = i; });
  await writeFile(join(ROOT, 'tools/dash/data/scenarios.json'), JSON.stringify({
    gen: new Date().toISOString().slice(0, 10),
    tfs,
    filters: FILTERS,
    symbols,
    scenarios,
    grid: { start: GRID[0], stepMs: 7 * 86400000, n: GRID.length },
  }));
  console.log(`[bt] dashboard kaydı: ${nScen} senaryo → ${recDir}`);
}

console.log(`[bt] ${specs.length} indikatör × ${symbols.length} sembol × ${tfs.join(',')} — ${nWorkers} işçi`);
console.log(`[bt] çıktı: ${OUT}`);

const chunks = Array.from({ length: nWorkers }, () => []);
symbols.forEach((s, i) => chunks[i % nWorkers].push(s));

const acc = {};
for (const s of specs) {
  acc[s.id] = {};
  for (const tf of tfs) acc[s.id][tf] = newAcc();
}
const errorsAll = [];
let doneCount = 0;
const t0 = Date.now();

await new Promise((res, rej) => {
  let living = chunks.filter((c) => c.length).length;
  let wi = 0;
  for (const chunk of chunks) {
    if (!chunk.length) continue;
    const w = new Worker(new URL('./worker.mjs', import.meta.url), {
      workerData: {
        symbols: chunk,
        tfs,
        only: specs.map((s) => s.id),
        recOut: REC ? join(recDir, `w${wi}.bin`) : null,
        scenarioIds,
        symIds,
        nSym: symbols.length,
        nScen,
      },
    });
    wi++;
    w.on('message', (m) => {
      if (m.type === 'progress') {
        doneCount++;
        const secs = (Date.now() - t0) / 1000;
        const eta = secs / doneCount * (symbols.length - doneCount);
        console.log(`[bt] ${doneCount}/${symbols.length} sembol — ${secs.toFixed(0)}s geçti, ~${eta.toFixed(0)}s kaldı (${m.symbol})`);
      } else if (m.type === 'done') {
        for (const id of Object.keys(m.payload)) {
          if (!acc[id]) continue;
          for (const tf of tfs) mergeAcc(acc[id][tf], m.payload[id][tf]);
        }
        errorsAll.push(...m.errors);
      }
    });
    w.on('error', rej);
    w.on('exit', () => { if (--living === 0) res(); });
  }
  if (living === 0) res();
});

console.log(`[bt] hesap bitti (${((Date.now() - t0) / 1000).toFixed(0)}s), JSON yazılıyor…`);
if (errorsAll.length) {
  console.log(`[bt] ${errorsAll.length} hata kaydı (ilk 10):`);
  for (const e of errorsAll.slice(0, 10)) console.log('   ', JSON.stringify(e));
}

await mkdir(OUT, { recursive: true });

const index = {
  gen: new Date().toISOString().slice(0, 10),
  engine: 'ia-bt-v1',
  grid: { start: GRID[0], stepMs: 7 * 86400000, n: GRID.length },
  symbols,
  tfs,
  costs: '%0,04 taker + 1bp kayma / bacak; funding dahil; 1x (kaldıraçsız)',
  ids: {},
};

for (const spec of specs) {
  const metaOf = {
    cat: BT_CATEGORY_OF[spec.id] || null,
    title: spec.title,
    dir: spec.dir,
    rules: spec.rules,
    stopText: spec.stopText || (typeof spec.stop === 'string' ? spec.stop : spec.stop ? 'Teknik stop (kurallarda)' : 'Yok'),
    skipTfs: spec.skipTfs || null,
    caveat: spec.caveat || null,
  };
  const json = finalizeIndicator(spec.id, metaOf, acc[spec.id], symbols, tfs);
  await writeFile(join(OUT, spec.id + '.json'), JSON.stringify(json));

  // index özeti: en iyi TF — önce n ≥ 100 içinde en yüksek toplam (bileşik) getiri,
  // yoksa n ≥ 30, o da yoksa en çok işlemli dilim
  let best = null;
  for (const tf of tfs) {
    const s = json.sum[tf];
    if (!s) continue;
    if (!best) best = [tf, s];
    else {
      const tier = (x) => (x[1].n >= 100 ? 2 : x[1].n >= 30 ? 1 : 0);
      const tb = tier(best), tt = tier([tf, s]);
      if (tt > tb || (tt === tb && s.tot > best[1].tot)) best = [tf, s];
    }
  }
  index.ids[spec.id] = best
    ? { best: best[0], avg: best[1].avg, wr: best[1].wr, n: best[1].n, tot: best[1].tot, pf: best[1].pf }
    : null;
}

await writeFile(join(OUT, 'index.json'), JSON.stringify(index));
console.log(`[bt] hazır: ${specs.length} JSON + index.json → ${OUT}`);
