// İndikatör Akademi — Singular-Backtest koşucusu
//
// Kural: seçilen kapsamda (varsayılan: indikatör) aynı coinde aynı anda en
// fazla bir açık işlem. Önceki işlem kapanmadan gelen yeni giriş sinyali
// bloke edilir. 6 zaman dilimi ayrı akışlardır; tekil tarama giriş zamanına
// göre birleştirilir (eşitlikte kısa TF önce: 5m > 15m > 1h > 4h > 1d > 1w).
//
// Normal metrikler `tools/dash/data/agg/*.bin` dosyalarından birebir okunur
// (dashboard ile aynı formüller). Singular metrikler bu koşuda üretilir.
//
// Kullanım:
//   node Singular-Backtest/run_singular.mjs
//   node Singular-Backtest/run_singular.mjs --symbols=10 --workers=4
//   node Singular-Backtest/run_singular.mjs --scope=state   (tekil = normal)
import { Worker } from 'node:worker_threads';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BT_STRATEGIES, BT_CATEGORY_OF } from '../tools/bt/strategies.mjs';
import { FILTERS, F, ND, DAY0 } from '../tools/bt/dashagg.mjs';
import { TFS } from '../tools/bt/io.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const HERE = join(ROOT, 'Singular-Backtest');
const AGG = join(ROOT, 'tools', 'dash', 'data', 'agg');
const OUT = join(HERE, 'results');
const STAKE = 10;

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}

const scope = String(args.scope || 'indicator');
if (!['indicator', 'state'].includes(scope)) throw new Error('geçersiz kapsam: ' + scope);
const runSim = scope !== 'state';
const tfs = TFS;
const meta = JSON.parse(await readFile(join(ROOT, 'tools', 'dash', 'data', 'scenarios.json'), 'utf8'));
const allSymbols = meta.symbols;
const symbols = args.symbols ? allSymbols.slice(0, Number(args.symbols)) : allSymbols;
const nWorkers = Math.min(Number(args.workers || 8), symbols.length);
const NSC = BT_STRATEGIES.length * tfs.length;
const NIND = BT_STRATEGIES.length;
const S = NSC * F;
const I = NIND * F;
const Y26 = Date.UTC(2026, 0, 1);
const A26 = Math.floor((Y26 - DAY0) / 86400000);

const SCOPE_LABEL = {
  indicator: 'İndikatör (id), 6 zaman dilimi ve tüm coinlerde tek pozisyon',
  state: 'Senaryo (id + TF) — motor zaten tek pozisyon tutar, normal ile aynı',
};

const t0 = Date.now();
const log = (...a) => console.log('[singular]', ...a);

/* ------------------------------ yardımcılar ------------------------------ */
const alloc = (Ctor, n, fill) => { const a = new Ctor(n); if (fill !== undefined) a.fill(fill); return a; };
const addInto = (dst, src) => { for (let i = 0; i < dst.length; i++) dst[i] += src[i]; };

function metricsOf(o) {
  const { n, wins, sumR, sum26, n26, durWin, durSum, daily } = o;
  const losses = n - wins;
  let pd = 0, ld = 0, cash = 0, peak = 0, dd = 0;
  for (let d = 0; d < ND; d++) {
    const x = daily[d];
    if (x > 0) pd++;
    else if (x < 0) ld++;
    cash += x * STAKE;
    if (cash > peak) peak = cash;
    const q = cash - peak;
    if (q < dd) dd = q;
  }
  return {
    trades: n,
    wins,
    losses,
    winRate: n ? wins / n : 0,
    retAll: n ? (sumR / n) * 100 : 0,
    ret2026: n26 ? (sum26 / n26) * 100 : 0,
    winRatio: losses ? wins / losses : null,
    winHoldH: wins ? durWin / wins / 60 : 0,
    holdH: n ? durSum / n / 60 : 0,
    profitDays: pd,
    lossDays: ld,
    maxDD: dd,
    kasaAll: sumR * STAKE,
    sumR,
    pf: o.grossL > 1e-9 ? o.grossW / o.grossL : (o.grossW > 0 ? 99 : 0),
  };
}

function putMetrics(row, m, p) {
  row[p + 'trades'] = m.trades;
  row[p + 'wins'] = m.wins;
  row[p + 'losses'] = m.losses;
  row[p + 'winRate'] = m.winRate;
  row[p + 'retAll'] = m.retAll;
  row[p + 'ret2026'] = m.ret2026;
  row[p + 'winRatio'] = m.winRatio;
  row[p + 'winHoldH'] = m.winHoldH;
  row[p + 'holdH'] = m.holdH;
  row[p + 'profitDays'] = m.profitDays;
  row[p + 'lossDays'] = m.lossDays;
  row[p + 'maxDD'] = m.maxDD;
  row[p + 'kasaAll'] = m.kasaAll;
  row[p + 'sumR'] = m.sumR;
  row[p + 'pf'] = m.pf;
}

/* --------------------------------- işçiler -------------------------------- */
log(`${symbols.length} sembol × ${NIND} indikatör × ${tfs.length} TF — ${nWorkers} işçi, kapsam=${scope}`);
const chunks = Array.from({ length: nWorkers }, () => []);
symbols.forEach((s, i) => chunks[i % nWorkers].push(s));

const sN = alloc(Float64Array, S), sWins = alloc(Float64Array, S), sSum = alloc(Float64Array, S);
const sSum26 = alloc(Float64Array, S), sN26 = alloc(Float64Array, S);
const sDurSum = alloc(Float64Array, S), sDurWin = alloc(Float64Array, S);
const sGrossW = alloc(Float64Array, S), sGrossL = alloc(Float64Array, S);
const sBest = alloc(Float64Array, S, -9), sWorst = alloc(Float64Array, S, 9);
const iN = alloc(Float64Array, I), iWins = alloc(Float64Array, I), iSum = alloc(Float64Array, I);
const iSum26 = alloc(Float64Array, I), iN26 = alloc(Float64Array, I);
const iDurSum = alloc(Float64Array, I), iDurWin = alloc(Float64Array, I);
const iGrossW = alloc(Float64Array, I), iGrossL = alloc(Float64Array, I);
const iBest = alloc(Float64Array, I, -9), iWorst = alloc(Float64Array, I, 9);
const sDaily = alloc(Float32Array, S * ND);
const iDaily = alloc(Float32Array, I * ND);
const normalN = alloc(Int32Array, NSC);
const coinMap = new Map();
const errors = [];

let doneSymbols = 0;
if (runSim) {
  await new Promise((res, rej) => {
    let living = chunks.filter((c) => c.length).length;
    if (!living) return res();
  for (const chunk of chunks) {
    if (!chunk.length) continue;
    const w = new Worker(new URL('./worker_singular.mjs', import.meta.url), {
      workerData: { symbols: chunk, tfs, scope },
    });
    w.on('message', (m) => {
      if (m.type === 'progress') {
        doneSymbols++;
        if (doneSymbols % 25 === 0 || doneSymbols === symbols.length) {
          const secs = (Date.now() - t0) / 1000;
          const eta = (secs / doneSymbols) * (symbols.length - doneSymbols);
          log(`${doneSymbols}/${symbols.length} sembol — ${secs.toFixed(0)}s geçti, ~${eta.toFixed(0)}s kaldı`);
        }
        return;
      }
      if (m.type !== 'done') return;
      errors.push(...m.errors);
      addInto(sN, m.sN); addInto(sWins, m.sWins); addInto(sSum, m.sSum);
      addInto(sSum26, m.sSum26); addInto(sN26, m.sN26);
      addInto(sDurSum, m.sDurSum); addInto(sDurWin, m.sDurWin);
      addInto(sGrossW, m.sGrossW); addInto(sGrossL, m.sGrossL);
      for (let i = 0; i < S; i++) { if (m.sBest[i] > sBest[i]) sBest[i] = m.sBest[i]; if (m.sWorst[i] < sWorst[i]) sWorst[i] = m.sWorst[i]; }
      addInto(iN, m.iN); addInto(iWins, m.iWins); addInto(iSum, m.iSum);
      addInto(iSum26, m.iSum26); addInto(iN26, m.iN26);
      addInto(iDurSum, m.iDurSum); addInto(iDurWin, m.iDurWin);
      addInto(iGrossW, m.iGrossW); addInto(iGrossL, m.iGrossL);
      for (let i = 0; i < I; i++) { if (m.iBest[i] > iBest[i]) iBest[i] = m.iBest[i]; if (m.iWorst[i] < iWorst[i]) iWorst[i] = m.iWorst[i]; }
      addInto(sDaily, m.sDaily); addInto(iDaily, m.iDaily);
      addInto(normalN, m.normalN);
      for (let i = 0; i < m.coinKeys.length; i++) {
        const key = m.coinKeys[i];
        let a = coinMap.get(key);
        if (!a) { a = new Float64Array(6); coinMap.set(key, a); }
        for (let k = 0; k < 6; k++) a[k] += m.coinVals[i * 6 + k];
      }
    });
      w.on('error', rej);
      w.on('exit', () => { if (--living === 0) res(); });
    }
  });
  log(`simülasyon bitti: ${((Date.now() - t0) / 1000).toFixed(0)}s, ${errors.length} hata kaydı`);
} else {
  log('state kapsamı: simülasyon atlandı (tekil = normal)');
}

/* --------------------------- normal metrikler (bin) --------------------------- */
const nNml = alloc(Float64Array, S), wNml = alloc(Float64Array, S), sumNml = alloc(Float64Array, S);
const sum26Nml = alloc(Float64Array, S), n26Nml = alloc(Float64Array, S);
const durWinNml = alloc(Float64Array, S), durSumNml = alloc(Float64Array, S);
const grossWNml = alloc(Float64Array, S), grossLNml = alloc(Float64Array, S);
const fNmlN = alloc(Float64Array, F), fWinsN = alloc(Float64Array, F), fSumN = alloc(Float64Array, F);
const fSum26N = alloc(Float64Array, F), fN26N = alloc(Float64Array, F);
const fDurWinN = alloc(Float64Array, F), fDurSumN = alloc(Float64Array, F);
const fGrossWN = alloc(Float64Array, F), fGrossLN = alloc(Float64Array, F);
const iNmlN = alloc(Float64Array, I), iWinsN = alloc(Float64Array, I), iSumN = alloc(Float64Array, I);
const iSum26N = alloc(Float64Array, I), iN26N = alloc(Float64Array, I);
const iDurWinN = alloc(Float64Array, I), iDurSumN = alloc(Float64Array, I);
const iGrossWN = alloc(Float64Array, I), iGrossLN = alloc(Float64Array, I);
const fDailyN = alloc(Float32Array, F * ND);
const iDailyN = alloc(Float32Array, I * ND);
const rowDailyN = alloc(Float32Array, S * ND);

let binErrors = 0;
let countMismatch = 0;

for (let si = 0; si < NSC; si++) {
  let buf;
  try { buf = await readFile(join(AGG, `${si}.bin`)); } catch { binErrors++; continue; }
  const idIdx = Math.floor(si / tfs.length);
  for (let f = 0; f < F; f++) {
    const fb = ((14 * 8 + ND * 12 + 168 * 12 + 9 * 12 + meta.symbols.length * 16 + 7) >> 3) << 3;
    const off = f * fb;
    const n = buf.readDoubleLE(off + 0);
    const wins = buf.readDoubleLE(off + 8);
    const sumR = buf.readDoubleLE(off + 16);
    const grossW = buf.readDoubleLE(off + 32);
    const grossL = buf.readDoubleLE(off + 40);
    const barsSum = buf.readDoubleLE(off + 48);
    const best = buf.readDoubleLE(off + 56);
    const worst = buf.readDoubleLE(off + 64);
    const winBars = buf.readDoubleLE(off + 72);
    const oPos = off + 14 * 8;
    const dPos = new Float32Array(buf.buffer, buf.byteOffset + oPos, ND);
    const dNeg = new Float32Array(buf.buffer, buf.byteOffset + oPos + ND * 4, ND);
    const dCnt = new Uint32Array(buf.buffer, buf.byteOffset + oPos + ND * 8, ND);
    const rs = si * F + f;
    let s26 = 0, c26 = 0, pd = 0, ld = 0, cash = 0, peak = 0, dd = 0;
    for (let d = 0; d < ND; d++) {
      const net = dPos[d] - dNeg[d];
      if (dCnt[d] > 0) {
        if (net > 0) pd++;
        else if (net < 0) ld++;
      }
      if (d >= A26) { s26 += net; c26 += dCnt[d]; }
      cash += net * STAKE;
      if (cash > peak) peak = cash;
      const q = cash - peak;
      if (q < dd) dd = q;
      if (rowDailyN) rowDailyN[rs * ND + d] = net;
      iDailyN[(idIdx * F + f) * ND + d] += net;
      fDailyN[f * ND + d] += net;
    }
    nNml[rs] = n; wNml[rs] = wins; sumNml[rs] = sumR;
    sum26Nml[rs] = s26; n26Nml[rs] = c26;
    durWinNml[rs] = winBars; durSumNml[rs] = barsSum;
    grossWNml[rs] = grossW; grossLNml[rs] = grossL;

    fNmlN[f] += n; fWinsN[f] += wins; fSumN[f] += sumR;
    fSum26N[f] += s26; fN26N[f] += c26;
    fDurWinN[f] += winBars; fDurSumN[f] += barsSum;
    fGrossWN[f] += grossW; fGrossLN[f] += grossL;

    const ri = idIdx * F + f;
    iNmlN[ri] += n; iWinsN[ri] += wins; iSumN[ri] += sumR;
    iSum26N[ri] += s26; iN26N[ri] += c26;
    iDurWinN[ri] += winBars; iDurSumN[ri] += barsSum;
    iGrossWN[ri] += grossW; iGrossLN[ri] += grossL;

    if (f === 0 && Math.round(n) !== normalN[si]) countMismatch++;
  }
}
log(`bin okundu: ${NSC - binErrors}/${NSC}, normal sayım uyuşmazlığı: ${countMismatch}`);

/* ------------------------------- payload ------------------------------- */
const specMeta = meta.scenarios;
const rows = [];
let rowsWithTrades = 0;

for (let si = 0; si < NSC; si++) {
  const sc = specMeta[si];
  for (let f = 0; f < F; f++) {
    const rs = si * F + f;
    if (!nNml[rs]) continue;
    rowsWithTrades++;
    const nm = metricsOf({
      n: nNml[rs], wins: wNml[rs], sumR: sumNml[rs], sum26: sum26Nml[rs], n26: n26Nml[rs],
      durWin: durWinNml[rs], durSum: durSumNml[rs], daily: rowDailyN.subarray(rs * ND, (rs + 1) * ND),
      grossW: grossWNml[rs], grossL: grossLNml[rs],
    });
    let sm;
    if (scope === 'state') {
      sm = nm;
    } else {
      sm = metricsOf({
        n: sN[rs], wins: sWins[rs], sumR: sSum[rs], sum26: sSum26[rs], n26: sN26[rs],
        durWin: sDurWin[rs], durSum: sDurSum[rs], daily: sDaily.subarray(rs * ND, (rs + 1) * ND),
        grossW: sGrossW[rs], grossL: sGrossL[rs],
      });
    }
    // normal günlük dizi bin'den yeniden okunmadan: PD/LD/maxDD için gerekli
    // (rowDailyN yalnızca state kapsamında tutulur; indicator için aşağıda
    //  normaller senaryo bininden ayrıca hesaplanır)
    const row = {
      idx: si, sid: sc.id, strategy: sc.title || sc.name, cat: sc.cat,
      timeframe: sc.tf, filter_id: f, filter_key: FILTERS[f].id, filter_label: FILTERS[f].label,
      n_trades: Math.round(nNml[rs]),
      s_trades: scope === 'state' ? Math.round(nNml[rs]) : sN[rs],
      blocked: scope === 'state' ? 0 : Math.max(0, Math.round(nNml[rs]) - sN[rs]),
      blocked_pct: nNml[rs] ? (Math.max(0, nNml[rs] - sN[rs]) / nNml[rs]) * 100 : 0,
    };
    putMetrics(row, nm, 'n_');
    putMetrics(row, sm, 's_');
    row.delta_retAll = row.s_retAll - row.n_retAll;
    row.delta_kasa = row.s_kasaAll - row.n_kasaAll;
    rows.push(row);
  }
}
log(`satır: ${rows.length} (${rowsWithTrades} işlemli)`);

// indicator özeti
const indicators = [];
for (let idIdx = 0; idIdx < NIND; idIdx++) {
  const spec = BT_STRATEGIES[idIdx];
  const entry = { id: spec.id, title: spec.title, cat: BT_CATEGORY_OF[spec.id] || null, filters: [] };
  for (let f = 0; f < F; f++) {
    const ri = idIdx * F + f;
    if (!iNmlN[ri] && !iN[ri]) continue;
    const nm = metricsOf({
      n: iNmlN[ri], wins: iWinsN[ri], sumR: iSumN[ri], sum26: iSum26N[ri], n26: iN26N[ri],
      durWin: iDurWinN[ri], durSum: iDurSumN[ri], daily: iDailyN.subarray(ri * ND, (ri + 1) * ND),
      grossW: iGrossWN[ri], grossL: iGrossLN[ri],
    });
    const sm = scope === 'state' ? nm : metricsOf({
      n: iN[ri], wins: iWins[ri], sumR: iSum[ri], sum26: iSum26[ri], n26: iN26[ri],
      durWin: iDurWin[ri], durSum: iDurSum[ri], daily: iDaily.subarray(ri * ND, (ri + 1) * ND),
      grossW: iGrossW[ri], grossL: iGrossL[ri],
    });
    const row = {
      filter_id: f, filter_key: FILTERS[f].id, filter_label: FILTERS[f].label,
      blocked: scope === 'state' ? 0 : Math.max(0, iNmlN[ri] - iN[ri]),
      blocked_pct: iNmlN[ri] ? (Math.max(0, iNmlN[ri] - iN[ri]) / iNmlN[ri]) * 100 : 0,
    };
    putMetrics(row, nm, 'n_'); putMetrics(row, sm, 's_');
    row.delta_retAll = row.s_retAll - row.n_retAll;
    row.delta_kasa = row.s_kasaAll - row.n_kasaAll;
    entry.filters.push(row);
  }
  indicators.push(entry);
}

// filtre özeti
const filters = [];
for (let f = 0; f < F; f++) {
  let sn = 0, sw = 0, ss = 0, s26 = 0, n26 = 0, dw = 0, ds = 0, gw = 0, gl = 0;
  for (let idIdx = 0; idIdx < NIND; idIdx++) {
    const ri = idIdx * F + f;
    sn += iN[ri]; sw += iWins[ri]; ss += iSum[ri]; s26 += iSum26[ri]; n26 += iN26[ri];
    dw += iDurWin[ri]; ds += iDurSum[ri]; gw += iGrossW[ri]; gl += iGrossL[ri];
  }
  const sd = alloc(Float32Array, ND);
  for (let idIdx = 0; idIdx < NIND; idIdx++) {
    const base = (idIdx * F + f) * ND;
    for (let d = 0; d < ND; d++) sd[d] += iDaily[base + d];
  }
  const nm = metricsOf({
    n: fNmlN[f], wins: fWinsN[f], sumR: fSumN[f], sum26: fSum26N[f], n26: fN26N[f],
    durWin: fDurWinN[f], durSum: fDurSumN[f], daily: fDailyN.subarray(f * ND, (f + 1) * ND),
    grossW: fGrossWN[f], grossL: fGrossLN[f],
  });
  const sm = scope === 'state' ? nm : metricsOf({
    n: scope === 'state' ? fNmlN[f] : sn, wins: sw, sumR: ss, sum26: s26, n26,
    durWin: dw, durSum: ds, daily: sd, grossW: gw, grossL: gl,
  });
  const row = {
    filter_id: f, filter_key: FILTERS[f].id, filter_label: FILTERS[f].label,
    blocked: scope === 'state' ? 0 : Math.max(0, fNmlN[f] - sn),
    blocked_pct: fNmlN[f] ? (Math.max(0, fNmlN[f] - sn) / fNmlN[f]) * 100 : 0,
  };
  putMetrics(row, nm, 'n_'); putMetrics(row, sm, 's_');
  row.delta_retAll = row.s_retAll - row.n_retAll;
  row.delta_kasa = row.s_kasaAll - row.n_kasaAll;
  filters.push(row);
}

// toplamlar (filtre 0)
const totN = filters[0].n_trades ? {
  trades: filters[0].n_trades, wins: filters[0].n_wins, losses: filters[0].n_losses,
  winRate: filters[0].n_winRate, retAll: filters[0].n_retAll, ret2026: filters[0].n_ret2026,
  winRatio: filters[0].n_winRatio, winHoldH: filters[0].n_winHoldH, holdH: filters[0].n_holdH,
  profitDays: filters[0].n_profitDays, lossDays: filters[0].n_lossDays, maxDD: filters[0].n_maxDD,
  kasaAll: filters[0].n_kasaAll, sumR: filters[0].n_sumR, pf: filters[0].n_pf,
} : metricsOf({ n: 0, wins: 0, sumR: 0, sum26: 0, n26: 0, durWin: 0, durSum: 0, daily: alloc(Float32Array, ND), grossW: 0, grossL: 0 });
const totS = scope === 'state' ? totN : {
  trades: filters[0].s_trades, wins: filters[0].s_wins, losses: filters[0].s_losses,
  winRate: filters[0].s_winRate, retAll: filters[0].s_retAll, ret2026: filters[0].s_ret2026,
  winRatio: filters[0].s_winRatio, winHoldH: filters[0].s_winHoldH, holdH: filters[0].s_holdH,
  profitDays: filters[0].s_profitDays, lossDays: filters[0].s_lossDays, maxDD: filters[0].s_maxDD,
  kasaAll: filters[0].s_kasaAll, sumR: filters[0].s_sumR, pf: filters[0].s_pf,
};
const blocked = Math.max(0, totN.trades - totS.trades);

// coin kırılımı (filtre 0)
const coins = [];
for (const [key, a] of coinMap) {
  const [idIdx, symbol] = key.split('|');
  const idx = Number(idIdx);
  const spec = BT_STRATEGIES[idx];
  coins.push({
    id: spec.id, title: spec.title, cat: BT_CATEGORY_OF[spec.id] || null, symbol,
    n_trades: a[0], s_trades: scope === 'state' ? a[0] : a[3],
    blocked: scope === 'state' ? 0 : Math.max(0, a[0] - a[3]),
    blocked_pct: a[0] ? (scope === 'state' ? 0 : (Math.max(0, a[0] - a[3]) / a[0]) * 100) : 0,
    n_retAll: a[0] ? (a[1] / a[0]) * 100 : 0,
    s_retAll: a[3] ? (a[4] / a[3]) * 100 : 0,
    n_winRate: a[0] ? a[2] / a[0] : 0,
    s_winRate: a[3] ? a[5] / a[3] : 0,
  });
}

const payload = {
  repo: 'indikator-akademi',
  generated_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  rule: 'Seçilen kapsamda aynı coinde aynı anda en fazla bir açık işlem. Önceki işlem kapanmadan gelen yeni giriş sinyali bloke edilir.',
  scope,
  scope_label: SCOPE_LABEL[scope],
  data: {
    source: 'tools/dash/data/agg/*.bin (normal) + tools/bt simülasyonu (singular)',
    symbols: symbols.length,
    indicators: NIND,
    scenarios: NSC,
    filters: F,
    tfs,
    trades_all: totN.trades,
    stake_usd: STAKE,
    cash_model: 'İşlem başına 1x; günlük net × 10 USD kasa eğrisi; retAll = işlem başına ortalama getiri × 100',
    priority: 'Aynı giriş anında kısa TF önce: 5m > 15m > 1h > 4h > 1d > 1w',
    note: 'Motor senaryo (id+TF) başına zaten tek pozisyon tutar; tekil kuralın anlamlı boyutu indikatörün TF\'leri arasıdır.',
  },
  totals: {
    normal: totN,
    singular: totS,
    blocked,
    blocked_pct: totN.trades ? (blocked / totN.trades) * 100 : 0,
  },
  filters,
  indicators,
  rows,
  coins,
  errors: errors.slice(0, 200),
  error_count: errors.length,
  normal_count_mismatches: countMismatch,
  elapsed_sec: Math.round((Date.now() - t0) / 10) / 100,
};

/* -------------------------------- yazım -------------------------------- */
const rnd = (o) => {
  if (typeof o === 'number') return Number.isFinite(o) ? Math.round(o * 1e6) / 1e6 : 0;
  if (Array.isArray(o)) return o.map(rnd);
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = rnd(o[k]); return r; }
  return o;
};
const out = rnd(payload);
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'singular_results.json'), JSON.stringify(out));
await writeFile(join(OUT, 'run_manifest.json'), JSON.stringify({
  repo: out.repo, generated_at: out.generated_at, scope, scope_label: out.scope_label,
  symbols: symbols.length, indicators: NIND, scenarios: NSC, filters: F,
  normal_trades: totN.trades, singular_trades: totS.trades, blocked,
  blocked_pct: out.totals.blocked_pct, normal_count_mismatches: countMismatch,
  elapsed_sec: out.elapsed_sec,
}, null, 2));

/* --------------------------------- CSV --------------------------------- */
function csv(path, list, cols) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  let text = cols.join(',') + '\n';
  for (const r of list) text += cols.map((c) => esc(r[c])).join(',') + '\n';
  return writeFile(path, text);
}
const rowCols = ['sid', 'strategy', 'cat', 'timeframe', 'filter_id', 'filter_key', 'filter_label',
  'blocked', 'blocked_pct', 'n_trades', 's_trades', 'n_retAll', 's_retAll', 'delta_retAll',
  'n_ret2026', 's_ret2026', 'n_winRatio', 's_winRatio', 'n_winHoldH', 's_winHoldH',
  'n_profitDays', 's_profitDays', 'n_lossDays', 's_lossDays', 'n_maxDD', 's_maxDD',
  'n_kasaAll', 's_kasaAll', 'delta_kasa'];
await csv(join(OUT, 'singular_rows.csv'), rows, rowCols);
await csv(join(OUT, 'singular_coins.csv'), coins,
  ['id', 'title', 'symbol', 'n_trades', 's_trades', 'blocked', 'blocked_pct', 'n_retAll', 's_retAll', 'n_winRate', 's_winRate']);

function sliceRow(arr, rs) { return arr ? arr.subarray(rs * ND, (rs + 1) * ND) : alloc(Float32Array, ND); }

log(`kapsam: ${scope} — ${SCOPE_LABEL[scope]}`);
log(`normal: ${totN.trades.toLocaleString()} işlem | ort ${totN.retAll.toFixed(4)}% | kasa $${totN.kasaAll.toFixed(0)}`);
log(`singular: ${totS.trades.toLocaleString()} işlem | ort ${totS.retAll.toFixed(4)}% | kasa $${totS.kasaAll.toFixed(0)}`);
log(`bloke: ${blocked.toLocaleString()} (${out.totals.blocked_pct.toFixed(2)}%)`);
log(`yazıldı: ${join(OUT, 'singular_results.json')}`);
