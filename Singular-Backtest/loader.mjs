// Veri katmanı — indikator-akademi io.mjs ile BİREBİR aynı sözleşme.
// Amaç: 525 sembol × 6 TF × 100 indikatörlük tekil koşuda CSV ayrıştırma
// maliyetini bir kez ödemek. BigPlan binary önbelleği varsa onu okur,
// yoksa CSV'den üretip önbelleğe yazar (davranış io.mjs ile aynı).
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DATA_ROOT, SRC_ROOT, TF_MS, loadFunding,
  dayInfo, pivots, anchoredVwap, higherDir,
  smaOf, emaOf, rollMax, rollMin, rankPct, trueRangeOf, sessionVwap, vwapRoll, vwapBands,
  listSymbols,
} from '../tools/bt/io.mjs';
import { CALCS } from '../assets/js/engine/formulas.js';

export const CACHE = process.env.IA_SINGULAR_CACHE || 'D:/BigPlan/cache/series';
const EXTRA_ROOT = join(DATA_ROOT, 'yeni_coinler');
const MAGIC = 0x42f10001;

const toF64 = (arr) => {
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) { const x = arr[i]; out[i] = x == null ? NaN : x; }
  return out;
};

const pack = (T, O, H, L, C, V) => ({
  t: Float64Array.from(T), o: Float64Array.from(O), h: Float64Array.from(H),
  l: Float64Array.from(L), c: Float64Array.from(C), v: Float64Array.from(V),
});

/* ---- io.mjs readCsvSeries BİREBİR kopya ---- */
async function readCsvSeries(tf, symbol) {
  let dir = join(DATA_ROOT, tf, symbol);
  let files;
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.csv')).sort(); }
  catch {
    dir = join(EXTRA_ROOT, tf, symbol);
    files = (await readdir(dir)).filter((f) => f.endsWith('.csv')).sort();
  }
  const T = [], O = [], H = [], L = [], C = [], V = [];
  let lastT = -1;
  for (const f of files) {
    const text = await readFile(join(dir, f), 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln || ln.charCodeAt(0) < 48) continue;
      const p = ln.split(',');
      if (p.length < 6) continue;
      const t = +p[0];
      if (!(t > lastT)) continue;
      lastT = t;
      T.push(t); O.push(+p[1]); H.push(+p[2]); L.push(+p[3]); C.push(+p[4]); V.push(+p[5]);
    }
  }
  return pack(T, O, H, L, C, V);
}

/* ---- io.mjs toWeekly BİREBİR kopya ---- */
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

const memCache = new Map();
export function clearMemCache() { memCache.clear(); }

async function readBin(tf, symbol) {
  const buf = await readFile(join(CACHE, tf, symbol + '.bin'));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('bad magic');
  const n = dv.getUint32(4, true);
  const out = {};
  let off = 8;
  for (const nm of ['t', 'o', 'h', 'l', 'c', 'v']) {
    out[nm] = new Float64Array(buf.buffer, buf.byteOffset + off, n);
    off += n * 8;
  }
  return out;
}

async function writeBin(tf, symbol, S) {
  const n = S.t.length;
  const size = 8 + n * 8 * 6;
  const buf = Buffer.allocUnsafe(size);
  buf.writeUInt32LE(MAGIC, 0);
  buf.writeUInt32LE(n, 4);
  let off = 8;
  for (const nm of ['t', 'o', 'h', 'l', 'c', 'v']) {
    const a = S[nm];
    for (let i = 0; i < n; i++) { buf.writeDoubleLE(a[i], off); off += 8; }
  }
  await mkdir(join(CACHE, tf), { recursive: true });
  await writeFile(join(CACHE, tf, symbol + '.bin'), buf);
}

export async function loadSeriesC(tf, symbol, { noBin = false, noMem = false } = {}) {
  const key = tf + '|' + symbol;
  if (!noMem && memCache.has(key)) return memCache.get(key);
  let S = null;
  if (!noBin) {
    try { S = await readBin(tf, symbol); } catch { S = null; }
  }
  if (!S) {
    S = tf === '1w' ? toWeekly(await loadSeriesC('1d', symbol, { noMem: true })) : await readCsvSeries(tf, symbol);
    if (S.t.length < 60) throw new Error(`yetersiz bar: ${symbol} ${tf} (${S.t.length})`);
    if (!noBin) await writeBin(tf, symbol, S).catch(() => {});
  }
  if (!noMem) memCache.set(key, S);
  return S;
}

const fundCacheAll = new Map();
export async function loadFundingAll(symbol) {
  if (fundCacheAll.has(symbol)) return fundCacheAll.get(symbol);
  let obj = await loadFunding(symbol);
  if (!obj) {
    try {
      const text = await readFile(join(EXTRA_ROOT, 'funding', symbol + '.csv'), 'utf8');
      const lines = text.split('\n');
      const T = [], R = [];
      for (const ln of lines) {
        if (!ln || ln.charCodeAt(0) === 115) continue;
        const p = ln.split(',');
        if (p.length < 3) continue;
        T.push(+p[1]); R.push(+p[2]);
      }
      const t = Float64Array.from(T), r = Float64Array.from(R);
      const cum = new Float64Array(r.length + 1);
      for (let i = 0; i < r.length; i++) cum[i + 1] = cum[i] + r[i];
      obj = { t, cum };
    } catch { obj = null; }
  }
  fundCacheAll.set(symbol, obj);
  return obj;
}

/* ---- io.mjs makeCtx ile aynı sözleşme (loadSeriesC kullanır) ---- */
export async function makeCtx(tf, symbol) {
  const S = await loadSeriesC(tf, symbol);
  const fund = await loadFundingAll(symbol);
  const cacheCalc = new Map();
  let dInfo = null, piv = null;

  const ctx = {
    tf, symbol, S, fund,
    calc(name, params = {}) {
      const ck = name + ':' + Object.keys(params).sort().map((k) => k + '=' + JSON.stringify(params[k])).join(',');
      let r = cacheCalc.get(ck);
      if (!r) {
        const calc = CALCS[name];
        if (!calc) throw new Error('bilinmeyen hesap: ' + name);
        const res = calc.fn(S, params) || {};
        r = { lines: {}, bars: {}, dots: res.dots || [], band: res.band || null };
        for (const [kk, v] of Object.entries(res.lines || {})) r.lines[kk] = toF64(v && v.v ? v.v : v);
        for (const [kk, v] of Object.entries(res.bars || {})) r.bars[kk] = toF64(v && v.v ? v.v : v);
        cacheCalc.set(ck, r);
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

/* yeni_coinler dahil sembol listesi (io.listSymbols ile aynı) */
export async function listSymbolsAll() { return listSymbols(); }
