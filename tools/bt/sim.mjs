// İndikatör Akademi — Backtest motoru · Simülasyon çekirdeği
// Kural: sinyal bar i kapanışında üretilir, emir bar i+1 açılışında uygulanır.
// Maliyet: taker %0,04 + 1bp kayma (her bacak), funding gerçek olaylarla işlenir.
import { fundingCost } from './io.mjs';
import { GRID } from './agg.mjs';

export const FEE = 0.0004;  // %0,04 taker
export const SLIP = 0.0001; // 1 bp kayma
export const SIDE = FEE + SLIP;

export function simulate(spec, ctx, rec) {
  const S = ctx.S;
  const n = S.t.length;
  const B = spec.load(ctx) || {};
  // NOT: ham seriler B'ye enjekte EDİLMEZ — 'c','h','l','v' gibi anahtarlar
  // stratejilerin indikatör çizgileriyle çakışır (ör. HMA'nın 'h' anahtarı).
  // Stratejiler ham veriye S üzerinden erişir; stop 'level' arr'ları B'den adıyla alır.

  // otomatik ısınma: en geç geçerli olan seri + pay
  let start = spec.warmup || 0;
  for (const v of Object.values(B)) {
    if (v instanceof Float64Array) {
      let fi = 0;
      while (fi < v.length && Number.isNaN(v[fi])) fi++;
      if (fi > start) start = fi;
    }
  }
  start = Math.max(start, 40);
  start = Math.min(start + 2, Math.max(0, n - 40));

  // İşlem penceresi: portföy eğrisi ızgarasıyla aynı aralık
  // (2022-08-01 → son ızgara noktası). Daha eski barlar yalnızca ısınma
  // içindir; böylece 2020'den başlayan 1m arşivi istatistikleri bozmaz.
  const tStart = GRID[0], tEnd = GRID[GRID.length - 1];
  let i0 = start;
  while (i0 < n && S.t[i0] < tStart) i0++;
  let i1 = n - 1;
  while (i1 > i0 && S.t[i1] > tEnd) i1--;
  if (i1 <= i0) return { trades: [], start, i0, i1, errCount: 0, firstErr: null };

  const allowShort = spec.dir !== 'long';

  // stop hazırlığı
  const stopCfg = spec.stop || null;
  let atrArr = null, natrArr = null, lvlLong = null, lvlShort = null;
  if (stopCfg) {
    if (stopCfg.kind === 'atr') atrArr = ctx.L('atr', { p: stopCfg.p || 14 }, 'ATR');
    else if (stopCfg.kind === 'natr') natrArr = ctx.L('natr', { p: stopCfg.p || 14 }, 'NATR');
    else if (stopCfg.kind === 'level') { lvlLong = B[stopCfg.arr]; lvlShort = B[stopCfg.arrShort] || B[stopCfg.arr]; }
  }

  const trades = [];
  let pos = 0, entryI = 0, entryP = 0, entryT = 0;
  let stopP = NaN, hh = -Infinity, ll = Infinity, barsHeld = 0;
  let pendingExit = false, pendingEntry = 0;
  let errCount = 0, firstErr = null;

  // hataları sessizce yutma — say ve ilkini raporla
  const readEntry = (i) => {
    try { return spec.entry(S, B, i) | 0; }
    catch (e) { if (!errCount) firstErr = e.message; errCount++; return 0; }
  };
  const readExit = (i) => {
    try { return spec.exit ? !!spec.exit(S, B, i, pos) : false; }
    catch (e) { if (!errCount) firstErr = e.message; errCount++; return false; }
  };

  const closeTrade = (exitI, exitP) => {
    const t1 = S.t[exitI];
    let r;
    if (pos === 1) r = (exitP * (1 - SIDE)) / (entryP * (1 + SIDE)) - 1;
    else r = (entryP * (1 - SIDE)) / (exitP * (1 + SIDE)) - 1;
    const fc = fundingCost(ctx.fund, entryT, t1);
    r -= pos === 1 ? fc : -fc;
    if (r < -0.999) r = -0.999;
    trades.push({ e: entryI, x: exitI, d: pos, r, bars: exitI - entryI, et: entryT, xt: t1 });
    if (rec) rec.trade(pos, t1, r, (t1 - entryT) / 60000);
    pos = 0; stopP = NaN; barsHeld = 0;
  };

  const openPos = (d, i) => {
    const p = S.o[i];
    if (!(p > 0)) return;
    pos = d; entryI = i; entryP = p; entryT = S.t[i];
    hh = S.h[i]; ll = S.l[i]; barsHeld = 0; stopP = NaN;
    if (rec) rec.open(i, d);
    if (stopCfg) {
      if (atrArr) { const a = atrArr[i]; stopP = d === 1 ? p - stopCfg.mult * a : p + stopCfg.mult * a; }
      else if (natrArr) { const a = natrArr[i]; stopP = d === 1 ? p * (1 - stopCfg.mult * a / 100) : p * (1 + stopCfg.mult * a / 100); }
      else if (lvlLong) { stopP = d === 1 ? lvlLong[i] : lvlShort[i]; }
      else if (stopCfg.kind === 'pct') stopP = d === 1 ? p * (1 - stopCfg.pct / 100) : p * (1 + stopCfg.pct / 100);
      if (Number.isNaN(stopP)) stopP = NaN;
    }
  };

  for (let i = i0; i <= i1; i++) {
    // 1) bekleyen emirler bu barın açılışında
    if (pos !== 0 && pendingExit) { closeTrade(i, S.o[i]); pendingExit = false; }
    if (pos === 0 && pendingEntry !== 0 && i < i1) { openPos(pendingEntry, i); pendingEntry = 0; }

    // 2) bar içi stop (giriş barından sonra)
    if (pos !== 0 && barsHeld >= 1 && !Number.isNaN(stopP)) {
      if (pos === 1 && S.l[i] <= stopP) closeTrade(i, Math.min(S.o[i], stopP));
      else if (pos === -1 && S.h[i] >= stopP) closeTrade(i, Math.max(S.o[i], stopP));
    }
    if (pos !== 0) {
      barsHeld++;
      if (atrArr) {
        hh = Math.max(hh, S.h[i]); ll = Math.min(ll, S.l[i]);
        const a = atrArr[i];
        if (pos === 1) stopP = Math.max(stopP, hh - stopCfg.mult * a);
        else stopP = Math.min(stopP, ll + stopCfg.mult * a);
      }
    }

    // 3) kapanışta sinyal
    if (i >= i1) break;
    if (pos === 0) {
      let d = readEntry(i);
      if (d === -1 && !allowShort) d = 0;
      if (d !== 0) pendingEntry = d;
    } else {
      let wantExit = readExit(i);
      let flip = 0;
      if (!wantExit && allowShort) {
        const d = readEntry(i);
        if (d === -pos) flip = d;
      }
      if (spec.maxBars && barsHeld >= spec.maxBars) wantExit = true;
      if (wantExit) pendingExit = true;
      if (flip !== 0) { pendingExit = true; pendingEntry = flip; }
    }
  }
  if (pos !== 0) closeTrade(i1, S.c[i1]);

  return { trades, start, i0, i1, errCount, firstErr };
}

/* --------------------------- sembol istatistikleri -------------------------- */

export function symbolStats(trades, S, i0 = 0, i1 = S.c.length - 1) {
  const n = trades.length;
  if (!n) return null;
  let sum = 0, wins = 0, grossW = 0, grossL = 0, sumBars = 0;
  let eq = 1, peak = 1, dd = 0;
  for (const t of trades) {
    sum += t.r;
    if (t.r > 0) { wins++; grossW += t.r; } else { grossL -= t.r; }
    sumBars += t.bars;
    eq *= 1 + t.r;
    if (eq > peak) peak = eq;
    const d = eq / peak - 1;
    if (d < dd) dd = d;
  }
  const bh = S.c[i1] / S.c[i0] - 1;
  return {
    n,
    wr: wins / n,
    avg: sum / n,
    pf: grossL > 1e-9 ? grossW / grossL : (grossW > 0 ? 99 : 0),
    tot: eq - 1,
    dd,
    bars: sumBars / n,
    bh,
  };
}

/* ------------------- haftalık portföy eğrisi örneklemesi ------------------- */

export function sampleEquity(trades, S, grid) {
  const G = grid.length;
  const out = new Float32Array(G).fill(NaN);
  let eq = 1, k = 0;
  const firstT = S.t[0], lastT = S.t[S.t.length - 1];
  for (let g = 0; g < G; g++) {
    const gt = grid[g];
    if (gt < firstT) continue;
    if (gt > lastT) { out[g] = eq; }
    while (k < trades.length && trades[k].xt <= gt) { eq *= 1 + trades[k].r; k++; }
    out[g] = eq;
  }
  return out;
}
