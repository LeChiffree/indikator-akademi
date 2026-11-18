// İndikatör Akademi — Singular-Backtest doğrulaması
// 1) Satır sayısı ve normal metrikler all-in-dashboard `allinone.json` ile aynı mı?
// 2) Normal işlem sayıları bin'lerle birebir mi? (payload: normal_count_mismatches)
// 3) Her satırda singular <= normal; bloke muhasebesi ve toplamlar tutarlı mı?
// 4) Filtre/indikatör toplamları satır toplamlarıyla uyuşuyor mu?
// 5) (--deep) Tek sembol için filtre-0 tekil sayımı yeniden üretilip coin
//    kırılımıyla karşılaştırılır.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const RESULT = join(ROOT, 'Singular-Backtest', 'results', 'singular_results.json');
const ALLINONE = process.env.ALLINONE || 'C:/Users/GIGABAYT/Projects/all-in-dashboard/allinone.json';

const errors = [];
const check = (ok, msg) => { console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${msg}`); if (!ok) errors.push(msg); };
const close = (a, b, tol) => { a = a == null ? 0 : Number(a); b = b == null ? 0 : Number(b); return Math.abs(a - b) <= tol; };

const pay = JSON.parse(await readFile(RESULT, 'utf8'));
const rows = pay.rows;
console.log('== Kapsam ==');
console.log(`  scope=${pay.scope} | ${pay.scope_label}`);

console.log('== 1) Satırlar ve normaller ==');
let allRows = [];
try {
  const all = JSON.parse(await readFile(ALLINONE, 'utf8')).rows;
  allRows = all.filter((r) => r.source === 'Indikator Akademi');
} catch { console.log('  [SKIP] allinone.json yok'); }

check(rows.length === 17870, `17.870 satır (${rows.length})`);
if (allRows.length) {
  check(rows.length === allRows.length, `allinone satır sayısı ile aynı (${allRows.length})`);
  const idx = new Map();
  for (const r of allRows) {
    const m = /agg\/(\d+)\.bin · filter (\d+)/.exec(r.detail || '');
    if (m) idx.set(`${m[1]}|${m[2]}`, r);
  }
  const mism = [];
  for (const r of rows) {
    const ref = idx.get(`${r.idx}|${r.filter_id}`);
    if (!ref) { mism.push([r.idx, r.filter_id, 'eksik']); continue; }
    const fields = [
      ['n_trades', 'trades', 0], ['n_retAll', 'retAll', 1e-5], ['n_ret2026', 'ret2026', 1e-4],
      ['n_winRatio', 'winRatio', 1e-4], ['n_winHoldH', 'winHoldH', 1e-2],
      ['n_profitDays', 'profitDays', 0], ['n_lossDays', 'lossDays', 0],
    ];
    for (const [a, b, tol] of fields) {
      if (!close(r[a], ref[b], tol)) mism.push([r.idx, r.filter_id, a, r[a], ref[b]]);
    }
  }
  check(!mism.length, `normal metrikler allinone ile aynı (${mism.length} uyuşmazlık)`);
  if (mism.length) for (const m of mism.slice(0, 5)) console.log('    ', m);
}

console.log('== 2) Bin sayımı ve muhasebe ==');
check(pay.normal_count_mismatches === 0, `normal işlem sayımı bin ile aynı (${pay.normal_count_mismatches} uyuşmazlık)`);
let bad = 0, negBlocked = 0;
for (const r of rows) {
  if (r.s_trades > r.n_trades + 1e-9) bad++;
  if (r.blocked < 0) negBlocked++;
  if (Math.abs(r.s_trades + r.blocked - r.n_trades) > 1e-6) bad++;
}
check(bad === 0 && negBlocked === 0, `her satırda singular + bloke == normal (${bad} ihlal)`);

console.log('== 3) Toplamlar ==');
const t = pay.totals;
check(close(t.singular.trades + t.blocked, t.normal.trades, 1e-6),
  `singular ${t.singular.trades.toLocaleString()} + bloke ${t.blocked.toLocaleString()} == normal ${t.normal.trades.toLocaleString()}`);
for (const who of ['normal', 'singular']) {
  const m = t[who];
  check(close(m.kasaAll, m.sumR * 10, 1e-3), `${who}: kasaAll == sumR * 10`);
  check(m.trades === 0 || close(m.retAll, m.sumR / m.trades * 100, 1e-6), `${who}: retAll == ortalama getiri × 100`);
}

console.log('== 4) Filtre / indikatör toplamları ==');
let sumSTrades = 0, sumNTrades = 0;
const perFilterS = new Float64Array(31), perFilterN = new Float64Array(31);
for (const ind of pay.indicators) {
  for (const f of ind.filters) {
    perFilterS[f.filter_id] += f.s_trades;
    perFilterN[f.filter_id] += f.n_trades;
  }
}
for (let f = 0; f < 31; f++) {
  if (!close(pay.filters[f].s_trades, perFilterS[f], 1e-6)) sumSTrades++;
  if (!close(pay.filters[f].n_trades, perFilterN[f], 1e-6)) sumNTrades++;
}
check(sumSTrades === 0 && sumNTrades === 0, `filtre toplamları indikatör satırlarının toplamı (${sumSTrades + sumNTrades} uyuşmazlık)`);
let coinN = 0, coinS = 0;
for (const c of pay.coins) { coinN += c.n_trades; coinS += c.s_trades; }
check(close(coinN, pay.filters[0].n_trades, 1e-6), `coin normal toplamı filtre-0 normaline eşit`);
check(close(coinS, pay.filters[0].s_trades, 1e-6), `coin singular toplamı filtre-0 singularine eşit`);

if (process.argv.includes('--deep')) {
  console.log('== 5) Derin kontrol (tek sembol, filtre 0) ==');
  const symbol = process.argv[process.argv.indexOf('--symbol') + 1] || 'BTCUSDT';
  const { BT_STRATEGIES } = await import('../tools/bt/strategies.mjs');
  const { simulate } = await import('../tools/bt/sim.mjs');
  const { TFS } = await import('../tools/bt/io.mjs');
  const { makeCtx, clearMemCache } = await import('./loader.mjs');
  const { makeFeat } = await import('../tools/bt/features.mjs');
  const ctxs = {}, feats = {};
  for (const tf of TFS) {
    try { ctxs[tf] = await makeCtx(tf, symbol); feats[tf] = makeFeat(ctxs[tf]); } catch { /* tf yok */ }
  }
  const coinIdx = new Map(pay.coins.filter((c) => c.symbol === symbol).map((c) => [c.id, c]));
  let mism = 0, checked = 0;
  for (const spec of BT_STRATEGIES) {
    const streams = [];
    for (const tf of TFS) {
      if (!ctxs[tf] || (spec.skipTfs && spec.skipTfs.includes(tf))) continue;
      const et = [], xt = [], rr = [];
      let curI = -1;
      const rec = {
        open(i) { curI = i; },
        trade(side, exitMs, r) { et.push(ctxs[tf].S.t[curI]); xt.push(exitMs); rr.push(r); },
      };
      try { simulate(spec, ctxs[tf], rec); } catch { /* atla */ }
      if (rr.length) streams.push({ et, xt, r: rr });
    }
    // giriş zamanına göre birleştir (kısa TF önce)
    const ptr = new Int32Array(streams.length);
    let n = 0, last = -1;
    for (;;) {
      let best = -1, bestEt = Infinity;
      for (let s = 0; s < streams.length; s++) {
        const p = ptr[s];
        if (p < streams[s].et.length && streams[s].et[p] < bestEt) { bestEt = streams[s].et[p]; best = s; }
      }
      if (best < 0) break;
      const st = streams[best], j = ptr[best]++;
      if (st.et[j] >= last) { last = st.xt[j]; n++; }
    }
    const ref = coinIdx.get(spec.id);
    if (!ref) continue;
    checked++;
    if (Math.round(ref.s_trades) !== n) { mism++; console.log('    uyuşmazlık', spec.id, Math.round(ref.s_trades), n); }
  }
  clearMemCache();
  check(mism === 0, `${symbol}: ${checked} indikatörde filtre-0 tekil sayımı coin kırılımıyla aynı`);
}

console.log('');
if (errors.length) { console.log(`SONUÇ: ${errors.length} HATA`); process.exit(1); }
console.log('SONUÇ: TÜM KONTROLLER GEÇTİ');
