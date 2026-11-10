// ==========================================================================
// İndikatör Akademi — Dashboard toplayıcısı
// 31 filtre durumu (0 = filtresiz, 1..20 tek filtre, 21..30 kombinasyon) için
// günlük kâr/zarar, gün×saat, kalma süresi ve sembol toplamaları üretir.
// Yıl/çeyrek/mevsim/ay serileri günlük dizilerden türetilir (dash_merge.py).
// ==========================================================================
export const DAY0 = Date.UTC(2022, 7, 1);
export const ND = 1500;           // 2022-08-01 → 2026-09-07 (~1498 gün)
export const NH = 168;            // 7 gün × 24 saat
export const NB = 9;              // kalma süresi kovaları
export const F = 31;              // filtre durumu sayısı

export const FILTERS = [
  { id: 'none', label: 'Filtresiz', group: 'baz' },
  { id: 'btc_dir', label: 'BTC yönü işlemle aynı', group: 'rejim' },
  { id: 'btc_up', label: 'BTC yükseliş trendi', group: 'rejim' },
  { id: 'fng_fear', label: 'Korku endeksi < 45', group: 'duygu' },
  { id: 'fng_greed', label: 'Açgözlülük > 55', group: 'duygu' },
  { id: 'vol_120', label: 'Hacim > 1,2× ortalama', group: 'hacim' },
  { id: 'vol_150', label: 'Hacim > 1,5× ortalama', group: 'hacim' },
  { id: 'adx_25', label: 'ADX > 25 (trend)', group: 'trend' },
  { id: 'adx_lt20', label: 'ADX < 20 (yatay)', group: 'trend' },
  { id: 'rsi_lt30', label: 'RSI < 30 (dip)', group: 'momentum' },
  { id: 'rsi_gt70', label: 'RSI > 70 (zirve)', group: 'momentum' },
  { id: 'ema50', label: 'EMA50 yönü işlemle aynı', group: 'trend' },
  { id: 'ema200', label: 'EMA200 yönü işlemle aynı', group: 'trend' },
  { id: 'atr_mid', label: 'ATR% 0,5–5 arası', group: 'volatilite' },
  { id: 'bb_squeeze', label: 'BB sıkışması', group: 'volatilite' },
  { id: 'weekday', label: 'Hafta içi', group: 'zaman' },
  { id: 'hour_6', label: 'Saat 06–23 UTC', group: 'zaman' },
  { id: 'fund_ok', label: 'Funding lehte', group: 'maliyet' },
  { id: 'btc_corr', label: 'BTC korelasyonu > 0,2', group: 'rejim' },
  { id: 'btc_rel', label: 'BTC/ETH göreli güç', group: 'rejim' },
  { id: 'calm', label: 'Sakin volatilite (ATR < ort.)', group: 'volatilite' },
  { id: 'c_btc_vol', label: 'BTC yönü + hacim patlaması', group: 'kombinasyon' },
  { id: 'c_adx_ema', label: 'ADX > 25 + EMA50 yönü', group: 'kombinasyon' },
  { id: 'c_rsi_fund', label: 'RSI aşırı + funding lehte', group: 'kombinasyon' },
  { id: 'c_fear_vol', label: 'Korku + hacim patlaması', group: 'kombinasyon' },
  { id: 'c_trend200', label: 'EMA200 + ADX > 25', group: 'kombinasyon' },
  { id: 'c_ema_hour', label: 'EMA50 yönü + saat filtresi', group: 'kombinasyon' },
  { id: 'c_vol_atr', label: 'Hacim + ATR bandı', group: 'kombinasyon' },
  { id: 'c_btc_corr', label: 'BTC korelasyonu + BTC yönü', group: 'kombinasyon' },
  { id: 'c_adx_neutral', label: 'ADX > 25 + RSI 40–60', group: 'kombinasyon' },
  { id: 'c_quality', label: 'EMA200 + hacim + ADX > 20', group: 'kombinasyon' },
];

// Kalma süresi kovaları (dakika)
export const DUR_EDGES = [60, 360, 1440, 4320, 10080, 20160, 50400, 93600];
export const DUR_LABELS = ['<1sa', '1-6sa', '6-24sa', '1-3g', '3-7g', '7-14g', '14-35g', '35-65g', '>65g'];

export function durBucket(min) {
  for (let k = 0; k < DUR_EDGES.length; k++) if (min < DUR_EDGES[k]) return k;
  return NB - 1;
}

/* -------------------------- filtre maskesi -------------------------- */
export function buildMask(o, side) {
  const adx = o[0], rsi = o[1], atrp = o[2], atrRatio = o[3], volRatio = o[4], bbwRatio = o[5];
  const ema50 = o[6], ema200 = o[7], macd = o[8], btc = o[9], fng = o[10], fund = o[11], corr = o[12], rel = o[14];
  let m = 1; // filtresiz
  const on = (i) => { m |= (1 << i); };
  if (btc === side && btc !== 0) on(1);
  if (btc === 1) on(2);
  if (fng >= 0 && fng < 45) on(3);
  if (fng > 55) on(4);
  if (volRatio > 120) on(5);
  if (volRatio > 150) on(6);
  if (adx > 25) on(7);
  if (adx >= 0 && adx < 20) on(8);
  if (rsi >= 0 && rsi < 30) on(9);
  if (rsi > 70) on(10);
  if (ema50 === side) on(11);
  if (ema200 === side) on(12);
  if (atrp >= 0.5 && atrp <= 5) on(13);
  if (bbwRatio > 0 && bbwRatio < 80) on(14);
  if (o[15] >= 1 && o[15] <= 5) on(15);
  if (o[16] >= 6) on(16);
  if (fund * side <= 0) on(17);
  if (corr > 0.2) on(18);
  if (rel > 0) on(19);
  if (atrRatio > 0 && atrRatio < 100) on(20);
  const bit = (i) => (m >> i) & 1;
  if (bit(1) && bit(6)) on(21);
  if (bit(7) && bit(11)) on(22);
  if ((bit(9) || bit(10)) && bit(17)) on(23);
  if (bit(3) && bit(6)) on(24);
  if (bit(12) && bit(7)) on(25);
  if (bit(11) && bit(16)) on(26);
  if (bit(5) && bit(13)) on(27);
  if (bit(18) && bit(1)) on(28);
  if (bit(7) && rsi >= 40 && rsi <= 60) on(29);
  if (bit(12) && bit(5) && adx > 20) on(30);
  return m >>> 0;
}

/* --------------------------- toplayıcı --------------------------- */
const RAW_FILTER_BYTES = (nSyms) => 14 * 8 + ND * 12 + NH * 12 + NB * 12 + nSyms * 16;
export const filterBytes = (nSyms) => Math.ceil(RAW_FILTER_BYTES(nSyms) / 8) * 8;
export const scenBytes = (nSyms) => F * filterBytes(nSyms);

export function newAgg(nSyms) {
  return {
    nSyms,
    n: new Float64Array(F),
    wins: new Float64Array(F),
    sumR: new Float64Array(F),
    sumR2: new Float64Array(F),
    grossW: new Float64Array(F),
    grossL: new Float64Array(F),
    barsSum: new Float64Array(F),
    best: new Float64Array(F).fill(-9),
    worst: new Float64Array(F).fill(9),
    winBars: new Float64Array(F),
    longN: new Float64Array(F),
    longSumR: new Float64Array(F),
    shortN: new Float64Array(F),
    shortSumR: new Float64Array(F),
    dPos: new Float32Array(F * ND),
    dNeg: new Float32Array(F * ND),
    dCnt: new Uint32Array(F * ND),
    hPos: new Float32Array(F * NH),
    hNeg: new Float32Array(F * NH),
    hCnt: new Uint32Array(F * NH),
    uPos: new Float32Array(F * NB),
    uNeg: new Float32Array(F * NB),
    uCnt: new Uint32Array(F * NB),
    ySum: new Float32Array(F * nSyms),
    yEq: new Float32Array(F * nSyms),
    yN: new Uint32Array(F * nSyms),
    yW: new Uint32Array(F * nSyms),
  };
}

export function addTrade(a, mask, symIdx, exitMs, r, durMin, side) {
  const day = Math.floor((exitMs - DAY0) / 86400000);
  if (day < 0 || day >= ND) return;
  const dt = new Date(exitMs);
  const dow = dt.getUTCDay();
  const hi = dow * 24 + dt.getUTCHours();
  const bk = durBucket(durMin);
  const pos = r > 0 ? r : 0;
  const neg = r < 0 ? -r : 0;
  const win = r > 0 ? 1 : 0;
  let m = mask;
  while (m) {
    const lb = m & -m;
    const f = 31 - Math.clz32(lb);
    m ^= lb;
    a.n[f]++;
    a.wins[f] += win;
    a.sumR[f] += r;
    a.sumR2[f] += r * r;
    if (r > 0) a.grossW[f] += r; else a.grossL[f] -= r;
    a.barsSum[f] += durMin;
    if (win) a.winBars[f] += durMin;
    if (side === 1) { a.longN[f]++; a.longSumR[f] += r; }
    else if (side === -1) { a.shortN[f]++; a.shortSumR[f] += r; }
    if (r > a.best[f]) a.best[f] = r;
    if (r < a.worst[f]) a.worst[f] = r;
    const di = f * ND + day;
    if (r > 0) a.dPos[di] += r; else a.dNeg[di] -= r;
    a.dCnt[di]++;
    const hh = f * NH + hi;
    if (r > 0) a.hPos[hh] += r; else a.hNeg[hh] -= r;
    a.hCnt[hh]++;
    const ui = f * NB + bk;
    if (r > 0) a.uPos[ui] += r; else a.uNeg[ui] -= r;
    a.uCnt[ui]++;
    const si = f * a.nSyms + symIdx;
    a.ySum[si] += r;
    a.yN[si]++;
    if (win) a.yW[si]++;
    a.yEq[si] = a.yEq[si] === 0 ? 1 + r : a.yEq[si] * (1 + r);
  }
}

/* ------------------------------ yazım ------------------------------ */
export function finalizeInto(a, buf) {
  const base = buf.byteOffset;
  let off = 0;
  const f64 = (v) => { new Float64Array(buf.buffer, base + off, 1)[0] = v; off += 8; };
  const f32arr = (arr, start, n) => { new Float32Array(buf.buffer, base + off, n).set(arr.subarray(start, start + n)); off += n * 4; };
  const u32arr = (arr, start, n) => { new Uint32Array(buf.buffer, base + off, n).set(arr.subarray(start, start + n)); off += n * 4; };
  for (let f = 0; f < F; f++) {
    f64(a.n[f]); f64(a.wins[f]); f64(a.sumR[f]); f64(a.sumR2[f]);
    f64(a.grossW[f]); f64(a.grossL[f]); f64(a.barsSum[f]); f64(a.best[f]); f64(a.worst[f]);
    f64(a.winBars[f]); f64(a.longN[f]); f64(a.longSumR[f]); f64(a.shortN[f]); f64(a.shortSumR[f]);
    f32arr(a.dPos, f * ND, ND); f32arr(a.dNeg, f * ND, ND); u32arr(a.dCnt, f * ND, ND);
    f32arr(a.hPos, f * NH, NH); f32arr(a.hNeg, f * NH, NH); u32arr(a.hCnt, f * NH, NH);
    f32arr(a.uPos, f * NB, NB); f32arr(a.uNeg, f * NB, NB); u32arr(a.uCnt, f * NB, NB);
    f32arr(a.ySum, f * a.nSyms, a.nSyms); f32arr(a.yEq, f * a.nSyms, a.nSyms);
    u32arr(a.yN, f * a.nSyms, a.nSyms); u32arr(a.yW, f * a.nSyms, a.nSyms);
    // 8 bayt hizasına tamamla
    const rem = off % 8;
    if (rem) off += 8 - rem;
  }
}
