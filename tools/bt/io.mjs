// İndikatör Akademi — Backtest motoru · Veri katmanı
// Gerçek Binance USDT-M vadeli kline arşivini (D:\1mDataBinance) okur,
// sembol başına serileri bellek içi Float64Array'lere çevirir, funding yükler,
// strateji hesapları için yardımcı seriler üretir.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CALCS } from '../../assets/js/engine/formulas.js';

export const DATA_ROOT = process.env.IA_BT_DATA || 'D:\\1mDataBinance';
// Kaynak kök: hazır CSV setleri (58 sembollük 5m–1d + yeni_coinler) buradan okunur.
export const SRC_ROOT = process.env.IA_BT_SRC || DATA_ROOT;
export const TF_MS = { '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000 };
export const TFS = ['5m', '15m', '1h', '4h', '1d', '1w'];

/* ------------------------------- yardımcılar ------------------------------- */

function toF64(arr) {
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) { const x = arr[i]; out[i] = x == null ? NaN : x; }
  return out;
}

function pack(T, O, H, L, C, V) {
  return {
    t: Float64Array.from(T),
    o: Float64Array.from(O), h: Float64Array.from(H),
    l: Float64Array.from(L), c: Float64Array.from(C),
    v: Float64Array.from(V),
  };
}

/* ------------------------------ kline okuma ------------------------------- */

const seriesCache = new Map();

async function readCsvSeries(tf, symbol) {
  const bases = [
    join(DATA_ROOT, tf, symbol),                 // üretilen set (bt525)
    join(SRC_ROOT, tf, symbol),                  // mevcut 58 sembollük set
    join(SRC_ROOT, 'yeni_coinler', tf, symbol),  // yeni coinler seti
  ];
  let dir = null;
  for (const d of bases) {
    try { await readdir(d); dir = d; break; } catch { /* sonraki kök */ }
  }
  if (!dir) throw new Error(`veri yok: ${symbol} ${tf}`);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.csv')).sort();
  const T = [], O = [], H = [], L = [], C = [], V = [];
  let lastT = -1;
  for (const f of files) {
    const text = await readFile(join(dir, f), 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln || ln.charCodeAt(0) < 48) continue; // başlık/boş satır
      const p = ln.split(',');
      if (p.length < 6) continue;
      const t = +p[0];
      if (!(t > lastT)) continue; // tekrar/sırasız satır koruması
      lastT = t;
      T.push(t); O.push(+p[1]); H.push(+p[2]); L.push(+p[3]); C.push(+p[4]); V.push(+p[5]);
    }
  }
  return pack(T, O, H, L, C, V);
}

function toWeekly(d) {
  const n = d.t.length;
  const T = [], O = [], H = [], L = [], C = [], V = [];
  const wkStart = (ms) => { const day = Math.floor(ms / 86400000); return (day - ((day + 3) % 7)) * 86400000; };
  let cur = null, wO = 0, wH = 0, wL = 0, wC = 0, wV = 0;
  for (let i = 0; i < n; i++) {
    const w = wkStart(d.t[i]);
    if (cur === null || w !== cur) {
      if (cur !== null) { T.push(cur); O.push(wO); H.push(wH); L.push(wL); C.push(wC); V.push(wV); }
      cur = w; wO = d.o[i]; wH = d.h[i]; wL = d.l[i]; wC = d.c[i]; wV = d.v[i];
    } else {
      wH = Math.max(wH, d.h[i]);
      wL = Math.min(wL, d.l[i]);
      wC = d.c[i];
      wV += d.v[i];
    }
  }
  if (cur !== null) { T.push(cur); O.push(wO); H.push(wH); L.push(wL); C.push(wC); V.push(wV); }
  return pack(T, O, H, L, C, V);
}

export async function loadSeries(tf, symbol) {
  const key = tf + '|' + symbol;
  if (seriesCache.has(key)) return seriesCache.get(key);
  const S = tf === '1w' ? toWeekly(await loadSeries('1d', symbol)) : await readCsvSeries(tf, symbol);
  if (S.t.length < 60) throw new Error(`yetersiz bar: ${symbol} ${tf} (${S.t.length})`);
  seriesCache.set(key, S);
  return S;
}

export async function listSymbols() {
  for (const p of [join(SRC_ROOT, '1m'), join(DATA_ROOT, '1d'), join(SRC_ROOT, '1d')]) {
    try {
      const dirs = await readdir(p, { withFileTypes: true });
      const syms = dirs.filter((d) => d.isDirectory()).map((d) => d.name).sort();
      if (syms.length) return syms;
    } catch { /* sonraki kök */ }
  }
  return [];
}

/* -------------------------------- funding --------------------------------- */

const fundCache = new Map();

export async function loadFunding(symbol) {
  if (fundCache.has(symbol)) return fundCache.get(symbol);
  const paths = [
    join(DATA_ROOT, 'funding', symbol + '.csv'), // bt525 düzeni
    join(DATA_ROOT, '151_M', 'binance_futures', 'funding', symbol + '.csv'), // eski düzen
  ];
  let obj = null;
  for (const p of paths) {
    try {
      const text = await readFile(p, 'utf8');
      const lines = text.split('\n');
      const T = [], R = [];
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (!ln || ln.charCodeAt(0) === 115) continue; // 'symbol,...' başlık
        const q = ln.split(',');
        if (q.length < 3) continue;
        T.push(+q[1]); R.push(+q[2]);
      }
      const t = Float64Array.from(T), r = Float64Array.from(R);
      const cum = new Float64Array(r.length + 1);
      for (let i = 0; i < r.length; i++) cum[i + 1] = cum[i] + r[i];
      obj = { t, cum };
      break;
    } catch { /* sonraki yol */ }
  }
  fundCache.set(symbol, obj);
  return obj;
}

// İşçi belleği: sembol bittiğinde seri/funding önbelleklerini boşalt.
// (525 sembollük koşuda önbellek sınırsız büyümesin.)
export function clearCache() {
  seriesCache.clear();
  fundCache.clear();
}

// t0 < olay <= t1 aralığındaki funding oranları toplamı
export function fundingCost(fund, t0, t1) {
  if (!fund || !fund.t.length) return 0;
  const { t, cum } = fund;
  let lo = 0, hi = t.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] <= t0) lo = m + 1; else hi = m; }
  const i0 = lo;
  hi = t.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] <= t1) lo = m + 1; else hi = m; }
  return cum[lo] - cum[i0];
}

/* ------------------------- genel seri yardımcıları ------------------------- */

export function smaOf(a, n) {
  const L = a.length, out = new Float64Array(L).fill(NaN);
  let sum = 0, nanCount = 0;
  for (let i = 0; i < L; i++) {
    const x = a[i];
    if (Number.isNaN(x)) nanCount++; else sum += x;
    if (i >= n) { const old = a[i - n]; if (Number.isNaN(old)) nanCount--; else sum -= old; }
    if (i >= n - 1 && nanCount === 0) out[i] = sum / n;
  }
  return out;
}

export function emaOf(a, n) {
  const L = a.length, out = new Float64Array(L).fill(NaN), k = 2 / (n + 1);
  let e = NaN;
  for (let i = 0; i < L; i++) {
    const x = a[i];
    if (Number.isNaN(x)) continue;
    e = Number.isNaN(e) ? x : e + k * (x - e);
    out[i] = e;
  }
  return out;
}

export function rollMax(a, n) {
  const L = a.length, out = new Float64Array(L).fill(NaN);
  const dq = new Int32Array(L); let head = 0, tail = 0;
  for (let i = 0; i < L; i++) {
    while (head < tail && a[dq[tail - 1]] <= a[i]) tail--;
    dq[tail++] = i;
    while (dq[head] <= i - n) head++;
    if (i >= n - 1) out[i] = a[dq[head]];
  }
  return out;
}

export function rollMin(a, n) {
  const L = a.length, out = new Float64Array(L).fill(NaN);
  const dq = new Int32Array(L); let head = 0, tail = 0;
  for (let i = 0; i < L; i++) {
    while (head < tail && a[dq[tail - 1]] >= a[i]) tail--;
    dq[tail++] = i;
    while (dq[head] <= i - n) head++;
    if (i >= n - 1) out[i] = a[dq[head]];
  }
  return out;
}

// son w bar içinde arr[i]'nin yüzdelik sırası (0..1)
export function rankPct(a, w) {
  const L = a.length, out = new Float64Array(L).fill(NaN);
  for (let i = w - 1; i < L; i++) {
    const x = a[i];
    if (Number.isNaN(x)) continue;
    let cnt = 0, valid = 0;
    for (let j = i - w + 1; j <= i; j++) {
      const y = a[j];
      if (!Number.isNaN(y)) { valid++; if (y <= x) cnt++; }
    }
    if (valid > w / 2) out[i] = cnt / valid;
  }
  return out;
}

export function trueRangeOf(S) {
  const n = S.c.length, out = new Float64Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (i === 0) { out[i] = S.h[i] - S.l[i]; continue; }
    out[i] = Math.max(S.h[i] - S.l[i], Math.abs(S.h[i] - S.c[i - 1]), Math.abs(S.l[i] - S.c[i - 1]));
  }
  return out;
}

/* ------------------------------ gün bilgisi ------------------------------- */

export function dayInfo(S) {
  const n = S.c.length;
  const day = new Int32Array(n), first = new Uint8Array(n);
  const prevH = new Float64Array(n).fill(NaN), prevL = new Float64Array(n).fill(NaN), prevC = new Float64Array(n).fill(NaN);
  let curDay = -1, cH = NaN, cL = NaN, cC = NaN, pH = NaN, pL = NaN, pC = NaN;
  for (let i = 0; i < n; i++) {
    const d = Math.floor(S.t[i] / 86400000);
    if (d !== curDay) {
      pH = cH; pL = cL; pC = cC;
      curDay = d; first[i] = 1; cH = S.h[i]; cL = S.l[i]; cC = S.c[i];
    } else {
      cH = Math.max(cH, S.h[i]); cL = Math.min(cL, S.l[i]); cC = S.c[i];
    }
    day[i] = d; prevH[i] = pH; prevL[i] = pL; prevC[i] = pC;
  }
  return { day, first, prevH, prevL, prevC };
}

export function sessionVwap(S, dInfo) {
  const n = S.c.length, out = new Float64Array(n).fill(NaN);
  let sv = 0, stv = 0, curDay = -1;
  for (let i = 0; i < n; i++) {
    if (dInfo.day[i] !== curDay) { curDay = dInfo.day[i]; sv = 0; stv = 0; }
    const tp = (S.h[i] + S.l[i] + S.c[i]) / 3;
    sv += S.v[i]; stv += tp * S.v[i];
    out[i] = sv > 0 ? stv / sv : NaN;
  }
  return out;
}

export function vwapRoll(S, n) {
  const L = S.c.length, out = new Float64Array(L).fill(NaN);
  let sv = 0, stv = 0;
  for (let i = 0; i < L; i++) {
    const tp = (S.h[i] + S.l[i] + S.c[i]) / 3;
    sv += S.v[i]; stv += tp * S.v[i];
    if (i >= n) { const tpo = (S.h[i - n] + S.l[i - n] + S.c[i - n]) / 3; sv -= S.v[i - n]; stv -= tpo * S.v[i - n]; }
    if (i >= n - 1) out[i] = sv > 0 ? stv / sv : NaN;
  }
  return out;
}

export function vwapBands(S, n, k) {
  const L = S.c.length;
  const mid = vwapRoll(S, n);
  const up = new Float64Array(L).fill(NaN), dn = new Float64Array(L).fill(NaN);
  let sv = 0, stv = 0, stv2 = 0;
  for (let i = 0; i < L; i++) {
    const tp = (S.h[i] + S.l[i] + S.c[i]) / 3;
    sv += S.v[i]; stv += tp * S.v[i]; stv2 += tp * tp * S.v[i];
    if (i >= n) {
      const j = i - n, tpo = (S.h[j] + S.l[j] + S.c[j]) / 3;
      sv -= S.v[j]; stv -= tpo * S.v[j]; stv2 -= tpo * tpo * S.v[j];
    }
    if (i >= n - 1 && sv > 0) {
      const m = stv / sv;
      const varr = Math.max(0, stv2 / sv - m * m);
      const sd = Math.sqrt(varr);
      up[i] = m + k * sd; dn[i] = m - k * sd;
    }
  }
  return { mid, up, dn };
}

/* ------------------------------ pivotlar ---------------------------------- */

export function pivots(S, lag) {
  const n = S.c.length;
  const hi = [], lo = [];
  for (let i = lag; i < n - lag; i++) {
    let isH = true, isL = true;
    for (let j = 1; j <= lag; j++) {
      if (isH && !(S.h[i] > S.h[i - j] && S.h[i] > S.h[i + j])) isH = false;
      if (isL && !(S.l[i] < S.l[i - j] && S.l[i] < S.l[i + j])) isL = false;
      if (!isH && !isL) break;
    }
    if (isH) hi.push(i);
    if (isL) lo.push(i);
  }
  const upLvl = new Float64Array(n).fill(NaN), dnLvl = new Float64Array(n).fill(NaN);
  let k = 0, cur = NaN;
  for (let i = 0; i < n; i++) {
    while (k < hi.length && hi[k] + lag <= i) { cur = S.h[hi[k]]; k++; }
    upLvl[i] = cur;
  }
  k = 0; cur = NaN;
  for (let i = 0; i < n; i++) {
    while (k < lo.length && lo[k] + lag <= i) { cur = S.l[lo[k]]; k++; }
    dnLvl[i] = cur;
  }
  return { hi, lo, upLvl, dnLvl };
}

// Pivot diplere demirlenen AVWAP (yükselen trendde dip sabit kalır)
export function anchoredVwap(S, lag) {
  const n = S.c.length;
  const out = new Float64Array(n).fill(NaN);
  const { lo } = pivots(S, lag);
  let anchor = NaN, ai = 0, sv = 0, stv = 0;
  for (let i = 0; i < n; i++) {
    // bu barda onaylanan pivot dip, mevcut demirden daha düşükse demiri taşı
    while (ai < lo.length && lo[ai] + lag === i) {
      const p = lo[ai];
      if (Number.isNaN(anchor) || S.l[p] < anchor) { anchor = S.l[p]; sv = 0; stv = 0; }
      ai++;
    }
    const tp = (S.h[i] + S.l[i] + S.c[i]) / 3;
    sv += S.v[i]; stv += tp * S.v[i];
    if (!Number.isNaN(anchor)) out[i] = sv > 0 ? stv / sv : NaN;
  }
  return out;
}

/* --------------------------- yüksek zaman dilimi --------------------------- */

// k × mevcut zaman diliminde EMA(fast/slow) trend yönü; kapanmış üst bar kullanılır (lookahead yok)
export function higherDir(S, tf, k, fast = 20, slow = 50) {
  const n = S.c.length, tfMs = TF_MS[tf], bucketMs = tfMs * k;
  const bStart = (ms) => ms - (ms % bucketMs);
  const map = new Map();
  const bO = [], bH = [], bL = [], bC = [], bT = [];
  for (let i = 0; i < n; i++) {
    const b = bStart(S.t[i]);
    let bi = map.get(b);
    if (bi === undefined) {
      bi = bO.length; map.set(b, bi);
      bO.push(S.o[i]); bH.push(S.h[i]); bL.push(S.l[i]); bC.push(S.c[i]); bT.push(b);
    } else {
      bH[bi] = Math.max(bH[bi], S.h[i]);
      bL[bi] = Math.min(bL[bi], S.l[i]);
      bC[bi] = S.c[i];
    }
  }
  const emaF = emaOf(Float64Array.from(bC), fast);
  const emaS = emaOf(Float64Array.from(bC), slow);
  const dirOf = (bi) => {
    if (bi < 0) return 0;
    const f = emaF[bi], s = emaS[bi];
    if (Number.isNaN(f) || Number.isNaN(s)) return 0;
    return f > s ? 1 : -1;
  };
  const out = new Float64Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = dirOf(map.get(bStart(S.t[i])) - 1);
  return out;
}

/* ------------------------------- bağlam (ctx) ------------------------------ */

export async function makeCtx(tf, symbol) {
  const S = await loadSeries(tf, symbol);
  const fund = await loadFunding(symbol);
  const cacheCalc = new Map();
  let dInfo = null, piv = null;

  const ctx = {
    tf, symbol, S, fund,
    calc(name, params = {}) {
      const key = name + ':' + Object.keys(params).sort().map((k) => k + '=' + JSON.stringify(params[k])).join(',');
      let r = cacheCalc.get(key);
      if (!r) {
        const calc = CALCS[name];
        if (!calc) throw new Error('bilinmeyen hesap: ' + name);
        const res = calc.fn(S, params) || {};
        r = { lines: {}, bars: {}, dots: res.dots || [], band: res.band || null };
        for (const [kk, v] of Object.entries(res.lines || {})) r.lines[kk] = toF64(v && v.v ? v.v : v);
        for (const [kk, v] of Object.entries(res.bars || {})) r.bars[kk] = toF64(v && v.v ? v.v : v);
        cacheCalc.set(key, r);
      }
      return r;
    },
    L(name, params, line) { const r = this.calc(name, params); const v = r.lines[line]; if (!v) throw new Error(name + '→' + line + ' yok'); return v; },
    B(name, params, bar) { const r = this.calc(name, params); const v = r.bars[bar]; if (!v) throw new Error(name + '→' + bar + ' yok (bar)'); return v; },
    days() { if (!dInfo) dInfo = dayInfo(S); return dInfo; },
    piv(lag = 5) { if (!piv) piv = pivots(S, lag); return piv; },
    smaOf, emaOf, rollMax, rollMin, rankPct, trueRangeOf, sessionVwap, vwapRoll, vwapBands, anchoredVwap,
    higherDir: (k, fast, slow) => higherDir(S, tf, k, fast, slow),
  };
  return ctx;
}
