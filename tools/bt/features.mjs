// ==========================================================================
// İndikatör Akademi — Dashboard filtre özellikleri
// İşlem GİRİŞİNDE hesaplanan özellikler (filtreler bunların üzerinde çalışır):
//   ADX, RSI, ATR%, ATR oranı, hacim oranı, BB genişlik oranı, EMA50/200 yönü,
//   MACD işareti, BTC trendi, Korku/Açgözlülük, funding, BTC korelasyonu,
//   BTC oynaklığı, BTC/ETH göreli güç, gün, saat.
// ==========================================================================
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeries, smaOf, emaOf, fundingCost } from './io.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FNG_PATH = join(ROOT, 'tools', 'dash', 'data', 'fng.csv');

/* --------------------------- Korku / Açgözlülük --------------------------- */
const fng = new Map(); // gün (unix day) → değer
try {
  const txt = readFileSync(FNG_PATH, 'utf8');
  for (const ln of txt.split('\n')) {
    if (!ln || ln.charCodeAt(0) < 48) continue; // başlık
    const p = ln.split(',');
    if (p.length < 2) continue;
    fng.set(+p[0], +p[1]);
  }
} catch { /* dosya yoksa filtreler "bilinmiyor" olur */ }

/* ------------------------------ BTC / ETH ------------------------------- */
const btc = {}; // tf → { t, c, ema200, ret, vol30, rel30 }
const eth = {};

const upperBound = (arr, x) => {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m + 1; else hi = m; }
  return lo;
};

function rollingStd(a, w) {
  const n = a.length, out = new Float64Array(n).fill(NaN);
  let sum = 0, sum2 = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const valid = Number.isFinite(x);
    if (valid) { sum += x; sum2 += x * x; cnt++; }
    const j = i - w;
    if (j >= 0 && Number.isFinite(a[j])) { sum -= a[j]; sum2 -= a[j] * a[j]; cnt--; }
    if (cnt >= w * 0.8) {
      const m = sum / cnt;
      out[i] = Math.sqrt(Math.max(0, sum2 / cnt - m * m));
    }
  }
  return out;
}

export async function initFeatures(tfs) {
  for (const tf of tfs) {
    const b = await loadSeries(tf, 'BTCUSDT');
    const e = await loadSeries(tf, 'ETHUSDT').catch(() => null);
    const n = b.t.length, c = b.c;
    const ema200 = emaOf(c, 200);
    const ret = new Float64Array(n);
    for (let i = 1; i < n; i++) ret[i] = c[i] / c[i - 1] - 1;
    const vol30 = rollingStd(ret, 30);
    // ETH kapanışını BTC zamanlarına hizala
    const ec = new Float64Array(n).fill(NaN);
    if (e) {
      let k = 0;
      for (let i = 0; i < n; i++) {
        while (k + 1 < e.t.length && e.t[k + 1] <= b.t[i]) k++;
        if (e.t[k] <= b.t[i]) ec[i] = e.c[k];
      }
    }
    const rel30 = new Float64Array(n).fill(NaN);
    for (let i = 30; i < n; i++) {
      const b0 = c[i - 30], e0 = ec[i - 30];
      if (!(b0 > 0) || !(e0 > 0) || !Number.isFinite(e0)) continue;
      rel30[i] = ((c[i] / b0 - 1) - (ec[i] / e0 - 1)) * 100; // yüzde puan
    }
    btc[tf] = { t: b.t, c, ema200, ret, vol30, rel30, n };
    eth[tf] = e;
  }
}

/* --------------------------- sembol özellikleri --------------------------- */
export function makeFeat(ctx) {
  const S = ctx.S, c = S.c, n = c.length;
  const tfMs = ctx.tf === '1w' ? 604800000 : { '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 }[ctx.tf];
  let A = null;

  function build() {
    const adx = ctx.L('adx', { p: 14 }, 'ADX');
    const rsi = ctx.L('rsi', { p: 14 }, 'RSI');
    const atr = ctx.L('atr', { p: 14 }, 'ATR');
    const bbw = ctx.L('bbwidth', { p: 20 }, 'Band Genişliği %');
    const macd = ctx.L('macd', { f: 12, s: 26, g: 9 }, 'MACD');
    const sig = ctx.L('macd', { f: 12, s: 26, g: 9 }, 'Sinyal');
    const ema50 = emaOf(c, 50), ema200 = emaOf(c, 200);
    const volSma20 = smaOf(S.v, 20);
    const bbwSma50 = smaOf(bbw, 50);
    const atrp = new Float64Array(n);
    for (let i = 0; i < n; i++) atrp[i] = Number.isFinite(atr[i]) && c[i] > 0 ? (atr[i] / c[i]) * 100 : NaN;
    const atrpSma50 = smaOf(atrp, 50);

    // BTC ile 60 barlık korelasyon
    const B = btc[ctx.tf];
    const corr = new Float64Array(n);
    if (B) {
      const x = new Float64Array(n), y = new Float64Array(n);
      for (let i = 1; i < n; i++) {
        const ri = c[i] / c[i - 1] - 1;
        const j = upperBound(B.t, S.t[i]) - 1;
        const rj = j > 0 && B.t[j] === S.t[i] ? B.ret[j] : NaN;
        if (Number.isFinite(ri) && Number.isFinite(rj)) { x[i] = ri; y[i] = rj; }
      }
      const R = 60;
      const px = new Float64Array(n + 1), py = new Float64Array(n + 1), pxx = new Float64Array(n + 1), pyy = new Float64Array(n + 1), pxy = new Float64Array(n + 1), pc = new Uint32Array(n + 1);
      for (let i = 0; i < n; i++) {
        const vx = x[i], vy = y[i];
        px[i + 1] = px[i] + vx; py[i + 1] = py[i] + vy;
        pxx[i + 1] = pxx[i] + vx * vx; pyy[i + 1] = pyy[i] + vy * vy; pxy[i + 1] = pxy[i] + vx * vy;
        pc[i + 1] = pc[i] + (vx !== 0 || vy !== 0 ? 1 : 0);
      }
      for (let i = R; i < n; i++) {
        const a = i - R + 1, b = i + 1;
        const cnt = pc[b] - pc[a];
        if (cnt < R * 0.7) continue;
        const sx = px[b] - px[a], sy = py[b] - py[a];
        const sxx = pxx[b] - pxx[a], syy = pyy[b] - pyy[a], sxy = pxy[b] - pxy[a];
        const vx = sxx - (sx * sx) / cnt, vy = syy - (sy * sy) / cnt;
        if (vx <= 1e-18 || vy <= 1e-18) continue;
        corr[i] = (sxy - (sx * sy) / cnt) / Math.sqrt(vx * vy);
      }
    }
    return { adx, rsi, atrp, atrpSma50, volSma20, bbw, bbwSma50, ema50, ema200, macd, sig, corr, B };
  }

  return (i, out) => {
    if (!A) A = build();
    const j = A.B ? Math.max(0, upperBound(A.B.t, S.t[i]) - 1) : -1;
    out[0] = Number.isFinite(A.adx[i]) ? Math.min(100, A.adx[i]) : -1;
    out[1] = Number.isFinite(A.rsi[i]) ? A.rsi[i] : -1;
    out[2] = Number.isFinite(A.atrp[i]) ? A.atrp[i] : 0;
    out[3] = A.atrpSma50[i] > 0 ? (A.atrp[i] / A.atrpSma50[i]) * 100 : 0;
    out[4] = A.volSma20[i] > 0 ? (S.v[i] / A.volSma20[i]) * 100 : 0;
    out[5] = A.bbwSma50[i] > 0 ? (A.bbw[i] / A.bbwSma50[i]) * 100 : 0;
    out[6] = Number.isFinite(A.ema50[i]) ? (c[i] > A.ema50[i] ? 1 : -1) : 0;
    out[7] = Number.isFinite(A.ema200[i]) ? (c[i] > A.ema200[i] ? 1 : -1) : 0;
    out[8] = Number.isFinite(A.macd[i]) && Number.isFinite(A.sig[i]) ? (A.macd[i] > A.sig[i] ? 1 : -1) : 0;
    out[9] = j >= 0 && Number.isFinite(A.B.ema200[j]) ? (A.B.c[j] > A.B.ema200[j] ? 1 : -1) : 0;
    const day = Math.floor(S.t[i] / 86400000);
    out[10] = fng.has(day) ? fng.get(day) : -1;
    out[11] = -fundingCost(ctx.fund, S.t[i] - 8 * 3600 * 1000, S.t[i]); // ödenen funding (pozitif = maliyet)
    out[12] = A.corr[i] || 0;
    out[13] = j >= 0 && Number.isFinite(A.B.vol30[j]) ? A.B.vol30[j] * 100 : 0;
    out[14] = j >= 0 && Number.isFinite(A.B.rel30[j]) ? A.B.rel30[j] : 0;
    const d = new Date(S.t[i]);
    out[15] = d.getUTCDay();
    out[16] = d.getUTCHours();
    return out;
  };
}
