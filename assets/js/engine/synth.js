// ==========================================================================
// synth.js — Tohumlu (deterministik) sentetik OHLCV üreteci
// Her indikatör grafiği için "gerçekçi ama dummy" fiyat serisi üretir.
// Aynı senaryo + tohum → her zaman aynı grafik (tutarlı eğitim materyali).
// ==========================================================================

/** Deterministik PRNG (mulberry32) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Senaryolar: her biri 120 bar. {n: bar sayısı, d: bar başına sürüklenme,
// v: oynaklık, vm: hacim çarpanı, mr: ortalamaya dönüş katsayısı (ops.),
// spike: ekstra hacim patlaması (ops.)}
// ---------------------------------------------------------------------------
export const SCENARIOS = {
  // Güçlü yükseliş trendi, arada nefes almalar
  up: [
    { n: 22, d: 0.0012, v: 0.008, vm: 0.9 },
    { n: 48, d: 0.0045, v: 0.009, vm: 1.15 },
    { n: 18, d: -0.0018, v: 0.008, vm: 0.85 },
    { n: 32, d: 0.0042, v: 0.009, vm: 1.2 },
  ],
  // Güçlü düşüş trendi
  down: [
    { n: 22, d: -0.0012, v: 0.008, vm: 0.9 },
    { n: 48, d: -0.0045, v: 0.010, vm: 1.15 },
    { n: 18, d: 0.0018, v: 0.008, vm: 0.85 },
    { n: 32, d: -0.0042, v: 0.010, vm: 1.2 },
  ],
  // Yatay / sıkışık piyasa
  range: [
    { n: 30, d: 0.0004, v: 0.010, vm: 0.9, mr: 0.02 },
    { n: 50, d: 0.0, v: 0.012, vm: 0.85, mr: 0.035 },
    { n: 40, d: 0.0003, v: 0.011, vm: 0.9, mr: 0.025 },
  ],
  // Yükselişin sonu: güçlü ralli, düzeltme, zayıflayan ikinci zirve (uyumsuzluk!)
  top: [
    { n: 46, d: 0.0052, v: 0.0095, vm: 1.25 },
    { n: 12, d: -0.0055, v: 0.011, vm: 1.1 },
    { n: 34, d: 0.0038, v: 0.0085, vm: 0.75 },
    { n: 16, d: 0.0012, v: 0.007, vm: 0.6 },
    { n: 12, d: -0.0022, v: 0.009, vm: 0.9 },
  ],
  // Düşüşün sonu: sert satış, dip, zayıflayan ikinci dip (pozitif uyumsuzluk!)
  bottom: [
    { n: 46, d: -0.0052, v: 0.0095, vm: 1.25 },
    { n: 12, d: 0.0055, v: 0.011, vm: 1.1 },
    { n: 34, d: -0.0038, v: 0.0085, vm: 0.75 },
    { n: 16, d: -0.0012, v: 0.007, vm: 0.6 },
    { n: 12, d: 0.0046, v: 0.009, vm: 1.3 },
  ],
  // Sıkışma → kırılım patlaması (volatilite)
  squeeze: [
    { n: 20, d: 0.001, v: 0.013, vm: 1.0, mr: 0.02 },
    { n: 52, d: 0.0, v: 0.004, vm: 0.55, mr: 0.03 },
    { n: 24, d: 0.0048, v: 0.013, vm: 1.6 },
    { n: 24, d: 0.0026, v: 0.010, vm: 1.2 },
  ],
  // Sakin → ani oynaklık patlaması (ATR / korku)
  spike: [
    { n: 42, d: 0.001, v: 0.0065, vm: 0.85 },
    { n: 22, d: -0.0032, v: 0.017, vm: 1.9 },
    { n: 34, d: 0.0028, v: 0.008, vm: 1.0 },
    { n: 22, d: 0.001, v: 0.006, vm: 0.8 },
  ],
  // Hacimli kırılım: hacim patlamasıyla kopuş (RVOL / hacim barları)
  volbreak: [
    { n: 44, d: 0.0008, v: 0.009, vm: 0.8, mr: 0.02 },
    { n: 26, d: 0.0, v: 0.007, vm: 0.6, mr: 0.03 },
    { n: 24, d: 0.005, v: 0.010, vm: 2.2, spike: true },
    { n: 26, d: 0.0028, v: 0.009, vm: 1.15 },
  ],
  // Sessiz toplama: hacim kurur, fiyat yatay, sonra işaret fişeği
  accum: [
    { n: 38, d: -0.0022, v: 0.010, vm: 1.1 },
    { n: 46, d: 0.0, v: 0.0065, vm: 0.5, mr: 0.03 },
    { n: 22, d: 0.0034, v: 0.009, vm: 1.5, spike: true },
    { n: 14, d: 0.003, v: 0.009, vm: 1.2 },
  ],
  // Sakin ama hafif eğimli: MA'ların ayrışması için
  mild: [
    { n: 40, d: 0.001, v: 0.007, vm: 0.9 },
    { n: 40, d: 0.0028, v: 0.0065, vm: 1.0 },
    { n: 40, d: 0.0018, v: 0.0075, vm: 1.05 },
  ],
};

const TOTAL_BARS = 120;

/**
 * Sentetik seri üretir.
 * @param {string} scenarioId - SCENARIOS anahtarı
 * @param {number} seed - tohum
 * @returns {{o:number[],h:number[],l:number[],c:number[],v:number[]}}
 */
export function genSeries(scenarioId, seed = 7) {
  const segs = SCENARIOS[scenarioId] || SCENARIOS.range;
  const rand = mulberry32((seed * 2654435761) >>> 0 || 1);

  const o = [], h = [], l = [], c = [], v = [];
  let price = 100;
  let prevClose = 100;

  for (const seg of segs) {
    for (let i = 0; i < seg.n; i++) {
      let drift = seg.d;
      if (seg.mr) drift -= seg.mr * (price / 100 - 1); // ortalamaya dönüş
      const ret = drift + seg.v * gauss(rand);
      price *= 1 + ret;

      const open = prevClose * (1 + 0.0016 * gauss(rand));
      const wickUp = (Math.abs(0.4 * gauss(rand)) + 0.22) * seg.v * price;
      const wickDn = (Math.abs(0.4 * gauss(rand)) + 0.22) * seg.v * price;
      const close = price;
      const high = Math.max(open, close) + wickUp;
      const low = Math.min(open, close) - wickDn;

      let vol = 1000 * seg.vm * (0.7 + 0.6 * rand()) * (1 + 2.6 * Math.abs(ret) / Math.max(seg.v, 1e-6));
      if (seg.spike && i >= seg.n - 4) vol *= 1.9 + 0.5 * (i - (seg.n - 4));
      if (seg.spike && i === 0) vol *= 2.4;

      o.push(open);
      h.push(high);
      l.push(Math.max(low, 0.01));
      c.push(close);
      v.push(Math.round(vol));
      prevClose = close;
    }
  }

  // Tam 120 bara kırp
  const cut = (arr) => arr.slice(-TOTAL_BARS);
  return { o: cut(o), h: cut(h), l: cut(l), c: cut(c), v: cut(v) };
}

/** İnsan gözüyle okunur fiyat etiketi (grafik eksenleri için) */
export function fmtPrice(x) {
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  return x.toFixed(2);
}

/** Hacim etiketi (1.2K, 18.5K, 2.1M) */
export function fmtVol(x) {
  if (x >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(1) + 'K';
  return String(Math.round(x));
}
