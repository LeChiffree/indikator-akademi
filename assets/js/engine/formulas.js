// ==========================================================================
// formulas.js — İndikatör hesaplama kütüphanesi
// TÜM hesaplar gerçek formüllerle yapılır; grafiklerdeki çizgiler gerçektir.
// Seri: {o,h,l,c,v: number[]} (120 bar). Çıktı: null dolgulu diziler.
//
// Hesap çıktı sözleşmesi:
//   { lines: { isim: {v:number[], c?:renk, dash?:bool} },
//     bars:  { isim: {v:number[], colorBySign?:bool, c?:renk} },
//     dots:  [{i, v, dir:'up'|'down'|'on'}],
//     band:  ['üstÇizgiAdı','altÇizgiAdı'] }
// ==========================================================================

/* ----------------------------- yardımcılar ----------------------------- */
const nul = (n) => new Array(n).fill(null);
const last = (a) => a[a.length - 1];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function sma(a, p) {
  const out = nul(a.length);
  let sum = 0, cnt = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x == null) continue;
    sum += x; cnt++;
    if (cnt > p) { sum -= a[i - p]; cnt = p; }
    if (cnt === p) out[i] = sum / p;
  }
  return out;
}

function ema(a, p) {
  const out = nul(a.length);
  const k = 2 / (p + 1);
  let prev = null, sum = 0, cnt = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x == null) continue;
    if (prev == null) {
      sum += x; cnt++;
      if (cnt === p) { prev = sum / p; out[i] = prev; }
    } else {
      prev = x * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rma(a, p) {
  const out = nul(a.length);
  let prev = null, sum = 0, cnt = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x == null) continue;
    if (prev == null) {
      sum += x; cnt++;
      if (cnt === p) { prev = sum / p; out[i] = prev; }
    } else {
      prev = (prev * (p - 1) + x) / p;
      out[i] = prev;
    }
  }
  return out;
}

function wma(a, p) {
  const out = nul(a.length);
  const denom = (p * (p + 1)) / 2;
  for (let i = p - 1; i < a.length; i++) {
    let s = 0, ok = true;
    for (let j = 0; j < p; j++) {
      const x = a[i - p + 1 + j];
      if (x == null) { ok = false; break; }
      s += x * (j + 1);
    }
    if (ok) out[i] = s / denom;
  }
  return out;
}

function stdev(a, p) {
  const out = nul(a.length);
  for (let i = p - 1; i < a.length; i++) {
    let s = 0, s2 = 0, ok = true;
    for (let j = i - p + 1; j <= i; j++) {
      const x = a[j];
      if (x == null) { ok = false; break; }
      s += x; s2 += x * x;
    }
    if (ok) out[i] = Math.sqrt(Math.max(0, s2 / p - (s / p) ** 2));
  }
  return out;
}

function roll(a, p, fn) {
  const out = nul(a.length);
  for (let i = p - 1; i < a.length; i++) {
    let m = null, ok = true;
    for (let j = i - p + 1; j <= i; j++) {
      const x = a[j];
      if (x == null) { ok = false; break; }
      m = m == null ? x : fn(m, x);
    }
    if (ok) out[i] = m;
  }
  return out;
}
const hh = (a, p) => roll(a, p, Math.max);
const ll = (a, p) => roll(a, p, Math.min);

function shiftFwd(a, n) { // ileri kaydır (son n değer null olur)
  const out = nul(a.length);
  for (let i = 0; i < a.length - n; i++) out[i] = a[i + n];
  return out;
}
function diff(a) {
  const out = nul(a.length);
  for (let i = 1; i < a.length; i++) if (a[i] != null && a[i - 1] != null) out[i] = a[i] - a[i - 1];
  return out;
}
function roc(a, p) {
  const out = nul(a.length);
  for (let i = p; i < a.length; i++) {
    if (a[i - p]) out[i] = ((a[i] - a[i - p]) / Math.abs(a[i - p])) * 100;
  }
  return out;
}
const hl2 = (S) => S.c.map((_, i) => (S.h[i] + S.l[i]) / 2);
const hlc3 = (S) => S.c.map((_, i) => (S.h[i] + S.l[i] + S.c[i]) / 3);

function trueRange(S) {
  const out = nul(S.c.length);
  for (let i = 0; i < S.c.length; i++) {
    if (i === 0) { out[i] = S.h[i] - S.l[i]; continue; }
    out[i] = Math.max(S.h[i] - S.l[i], Math.abs(S.h[i] - S.c[i - 1]), Math.abs(S.l[i] - S.c[i - 1]));
  }
  return out;
}

function linregSeries(a, p) {
  const mid = nul(a.length), sigma = nul(a.length), slope = nul(a.length);
  for (let i = p - 1; i < a.length; i++) {
    let sx = 0, sy = 0, sxy = 0, sxx = 0, ok = true;
    for (let j = 0; j < p; j++) {
      const y = a[i - p + 1 + j];
      if (y == null) { ok = false; break; }
      sx += j; sy += y; sxy += j * y; sxx += j * j;
    }
    if (!ok) continue;
    const den = p * sxx - sx * sx || 1e-9;
    const b = (p * sxy - sx * sy) / den;
    const a0 = (sy - b * sx) / p;
    const yEnd = a0 + b * (p - 1);
    let ss = 0;
    for (let j = 0; j < p; j++) {
      const e = a[i - p + 1 + j] - (a0 + b * j);
      ss += e * e;
    }
    mid[i] = yEnd;
    slope[i] = b;
    sigma[i] = Math.sqrt(ss / p);
  }
  return { mid, sigma, slope };
}

/* ----------------------------- TREND / MA AİLESİ ----------------------------- */
const CALCS = {};

CALCS.sma = { label: (p) => `SMA ${p.p}`, fn: (S, p) => ({ lines: { [`SMA${p.p}`]: { v: sma(S.c, p.p || 20), c: 'gold' } } }) };
CALCS.ema = { label: (p) => `EMA ${p.p}`, fn: (S, p) => ({ lines: { [`EMA${p.p}`]: { v: ema(S.c, p.p || 20), c: 'gold' } } }) };
CALCS.wma = { label: (p) => `WMA ${p.p}`, fn: (S, p) => ({ lines: { [`WMA${p.p}`]: { v: wma(S.c, p.p || 20), c: 'gold' } } }) };

CALCS.hma = {
  label: (p) => `HMA ${p.p || 20}`,
  fn: (S, p) => {
    const per = p.p || 20;
    const half = Math.max(1, Math.round(per / 2));
    const sq = Math.max(1, Math.round(Math.sqrt(per)));
    const w1 = wma(S.c, half), w2 = wma(S.c, per);
    const raw = S.c.map((_, i) => (w1[i] != null && w2[i] != null ? 2 * w1[i] - w2[i] : null));
    return { lines: { [`HMA${per}`]: { v: wma(raw.map((x) => (x == null ? 0 : x)), sq).map((x, i) => (raw[i] == null ? null : x)), c: 'gold' } } };
  },
};

CALCS.alma = {
  label: (p) => `ALMA ${p.p || 21}`,
  fn: (S, p) => {
    const per = p.p || 21, offset = 0.85, sigma = 6;
    const m = offset * (per - 1), s = per / sigma;
    const w = [];
    let wsum = 0;
    for (let i = 0; i < per; i++) {
      const wi = Math.exp(-((i - m) ** 2) / (2 * s * s));
      w.push(wi); wsum += wi;
    }
    const out = nul(S.c.length);
    for (let i = per - 1; i < S.c.length; i++) {
      let acc = 0;
      for (let j = 0; j < per; j++) acc += S.c[i - per + 1 + j] * w[j];
      out[i] = acc / wsum;
    }
    return { lines: { [`ALMA${per}`]: { v: out, c: 'gold' } } };
  },
};

CALCS.mcginley = {
  label: (p) => `McGinley ${p.p || 14}`,
  fn: (S, p) => {
    const per = p.p || 14, k = 0.6;
    const out = nul(S.c.length);
    let m = S.c[0];
    out[0] = m;
    for (let i = 1; i < S.c.length; i++) {
      const ratio = Math.pow(S.c[i] / m, 4);
      m = m + (S.c[i] - m) / (k * per * ratio || 1);
      out[i] = m;
    }
    return { lines: { [`McGinley ${per}`]: { v: out, c: 'gold' } } };
  },
};

CALCS.envelope = {
  label: (p) => `Zarf (${p.p || 20}, %${p.pct || 2.5})`,
  fn: (S, p) => {
    const mid = sma(S.c, p.p || 20), pct = (p.pct || 2.5) / 100;
    return {
      lines: {
        Üst: { v: mid.map((x) => (x == null ? null : x * (1 + pct))), c: 'platinum', dash: true },
        Orta: { v: mid, c: 'gold' },
        Alt: { v: mid.map((x) => (x == null ? null : x * (1 - pct))), c: 'platinum', dash: true },
      },
    };
  },
};

CALCS.bb = {
  label: (p) => `Bollinger (${p.p || 20}, ${p.m || 2})`,
  fn: (S, p) => {
    const per = p.p || 20, mult = p.m || 2;
    const mid = sma(S.c, per), sd = stdev(S.c, per);
    const up = mid.map((x, i) => (x == null ? null : x + mult * sd[i]));
    const lo = mid.map((x, i) => (x == null ? null : x - mult * sd[i]));
    return {
      lines: {
        Üst: { v: up, c: 'platinum' },
        Orta: { v: mid, c: 'gold' },
        Alt: { v: lo, c: 'platinum' },
      },
      band: ['Üst', 'Alt'],
    };
  },
};

CALCS.percentb = {
  label: (p) => `%B (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const mid = sma(S.c, per), sd = stdev(S.c, per);
    const out = S.c.map((_, i) => {
      if (mid[i] == null) return null;
      const up = mid[i] + 2 * sd[i], lo = mid[i] - 2 * sd[i];
      return up === lo ? 0.5 : (S.c[i] - lo) / (up - lo);
    });
    return { lines: { '%B': { v: out, c: 'gold' } } };
  },
};

CALCS.bbwidth = {
  label: (p) => `Band Gen. (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const mid = sma(S.c, per), sd = stdev(S.c, per);
    const out = mid.map((x, i) => (x == null ? null : (4 * sd[i] * 100) / x));
    return { lines: { 'Band Genişliği %': { v: out, c: 'gold' } } };
  },
};

CALCS.keltner = {
  label: (p) => `Keltner (${p.p || 20}, ${p.m || 2})`,
  fn: (S, p) => {
    const per = p.p || 20, mult = p.m || 2;
    const mid = ema(S.c, per), atr = rma(trueRange(S), per);
    const up = mid.map((x, i) => (x == null || atr[i] == null ? null : x + mult * atr[i]));
    const lo = mid.map((x, i) => (x == null || atr[i] == null ? null : x - mult * atr[i]));
    return { lines: { Üst: { v: up, c: 'platinum' }, Orta: { v: mid, c: 'gold' }, Alt: { v: lo, c: 'platinum' } }, band: ['Üst', 'Alt'] };
  },
};

CALCS.donchian = {
  label: (p) => `Donchian (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const up = hh(S.h, per), lo = ll(S.l, per);
    const mid = up.map((x, i) => (x == null ? null : (x + lo[i]) / 2));
    return { lines: { Üst: { v: up, c: 'platinum' }, Orta: { v: mid, c: 'gold', dash: true }, Alt: { v: lo, c: 'platinum' } }, band: ['Üst', 'Alt'] };
  },
};

CALCS.linreg = {
  label: (p) => `LinReg Kanal (${p.p || 50})`,
  fn: (S, p) => {
    const per = p.p || 50, mult = p.m || 2;
    const { mid, sigma } = linregSeries(S.c, per);
    const up = mid.map((x, i) => (x == null ? null : x + mult * sigma[i]));
    const lo = mid.map((x, i) => (x == null ? null : x - mult * sigma[i]));
    return { lines: { Üst: { v: up, c: 'platinum', dash: true }, Orta: { v: mid, c: 'gold' }, Alt: { v: lo, c: 'platinum', dash: true } }, band: ['Üst', 'Alt'] };
  },
};

CALCS.vwap = {
  label: () => 'VWAP',
  fn: (S) => {
    const tp = hlc3(S);
    const out = nul(S.c.length);
    let pv = 0, vv = 0;
    for (let i = 0; i < S.c.length; i++) { pv += tp[i] * S.v[i]; vv += S.v[i]; out[i] = pv / vv; }
    return { lines: { VWAP: { v: out, c: 'gold' } } };
  },
};

CALCS.avwap = {
  label: (p) => 'Anchored VWAP',
  fn: (S, p) => {
    const anchor = p.anchor || 0;
    const tp = hlc3(S);
    const out = nul(S.c.length);
    let pv = 0, vv = 0;
    for (let i = anchor; i < S.c.length; i++) { pv += tp[i] * S.v[i]; vv += S.v[i]; out[i] = pv / vv; }
    return { lines: { AVWAP: { v: out, c: 'gold' } } };
  },
};

CALCS.vwma = {
  label: (p) => `VWMA ${p.p || 20}`,
  fn: (S, p) => {
    const per = p.p || 20;
    const out = nul(S.c.length);
    for (let i = per - 1; i < S.c.length; i++) {
      let pv = 0, vv = 0;
      for (let j = i - per + 1; j <= i; j++) { pv += S.c[j] * S.v[j]; vv += S.v[j]; }
      out[i] = vv ? pv / vv : null;
    }
    return { lines: { [`VWMA${per}`]: { v: out, c: 'gold' } } };
  },
};

CALCS.psar = {
  label: () => 'Parabolic SAR',
  fn: (S) => {
    const n = S.c.length;
    const line = nul(n);
    const dots = [];
    let up = S.c[1] >= S.c[0];
    let af = 0.02;
    let ep = up ? S.h[0] : S.l[0];
    let sar = up ? S.l[0] : S.h[0];
    for (let i = 1; i < n; i++) {
      sar = sar + af * (ep - sar);
      if (up) {
        if (S.l[i] < sar) { up = false; sar = ep; ep = S.l[i]; af = 0.02; }
        else if (S.h[i] > ep) { ep = S.h[i]; af = Math.min(0.2, af + 0.02); }
      } else {
        if (S.h[i] > sar) { up = true; sar = ep; ep = S.h[i]; af = 0.02; }
        else if (S.l[i] < ep) { ep = S.l[i]; af = Math.min(0.2, af + 0.02); }
      }
      line[i] = sar;
      dots.push({ i, v: sar, dir: up ? 'up' : 'down' });
    }
    return { lines: { PSAR: { v: line, c: 'gold', dash: true } }, dots };
  },
};

CALCS.supertrend = {
  label: (p) => `Supertrend (${p.p || 10}, ${p.m || 3})`,
  fn: (S, p) => {
    const per = p.p || 10, mult = p.m || 3, n = S.c.length;
    const atr = rma(trueRange(S), per);
    const st = nul(n);
    const dots = [];
    let up = true;
    let prevFU = null, prevFL = null;
    for (let i = 0; i < n; i++) {
      if (atr[i] == null) continue;
      const mid = (S.h[i] + S.l[i]) / 2;
      const bUp = mid + mult * atr[i];
      const bLo = mid - mult * atr[i];
      const prevC = S.c[i - 1];
      let FU, FL;
      if (prevFU == null) { FU = bUp; FL = bLo; }
      else {
        // standart: üst bant yalnızca aşağı iner (kapanış üstüne çıkarsa sıfırlanır),
        // alt bant yalnızca yukarı çıkar (kapanış altına inerse sıfırlanır)
        FU = (bUp < prevFU || prevC > prevFU) ? bUp : prevFU;
        FL = (bLo > prevFL || prevC < prevFL) ? bLo : prevFL;
      }
      if (up) {
        if (S.c[i] < FL) { up = false; dots.push({ i, v: S.h[i], dir: 'down' }); }
      } else {
        if (S.c[i] > FU) { up = true; dots.push({ i, v: S.l[i], dir: 'up' }); }
      }
      st[i] = up ? FL : FU;
      prevFU = FU; prevFL = FL;
    }
    return { lines: { Supertrend: { v: st, c: 'gold' } }, dots };
  },
};

CALCS.aroon = {
  label: (p) => `Aroon (${p.p || 25})`,
  fn: (S, p) => {
    const per = p.p || 25, n = S.c.length;
    const up = nul(n), dn = nul(n);
    for (let i = per; i < n; i++) {
      let hi = -Infinity, lo = Infinity, iHi = i, iLo = i;
      for (let j = i - per; j <= i; j++) {
        if (S.h[j] >= hi) { hi = S.h[j]; iHi = j; }
        if (S.l[j] <= lo) { lo = S.l[j]; iLo = j; }
      }
      up[i] = (100 * (per - (i - iHi))) / per;
      dn[i] = (100 * (per - (i - iLo))) / per;
    }
    return {
      lines: { 'Aroon Up': { v: up, c: 'up' }, 'Aroon Down': { v: dn, c: 'down' } },
    };
  },
};

CALCS.adx = {
  label: (p) => `ADX / DMI (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14, n = S.c.length;
    const plusDM = nul(n), minusDM = nul(n);
    for (let i = 1; i < n; i++) {
      const upM = S.h[i] - S.h[i - 1];
      const dnM = S.l[i - 1] - S.l[i];
      plusDM[i] = upM > dnM && upM > 0 ? upM : 0;
      minusDM[i] = dnM > upM && dnM > 0 ? dnM : 0;
    }
    const tr = trueRange(S);
    const atr = rma(tr, per);
    const pDI = rma(plusDM, per).map((x, i) => (x == null || atr[i] == null ? null : (100 * x) / atr[i]));
    const mDI = rma(minusDM, per).map((x, i) => (x == null || atr[i] == null ? null : (100 * x) / atr[i]));
    const dx = pDI.map((x, i) => {
      if (x == null || mDI[i] == null) return null;
      const s = x + mDI[i];
      return s ? (100 * Math.abs(x - mDI[i])) / s : 0;
    });
    const adx = rma(dx, per);
    return {
      lines: {
        ADX: { v: adx, c: 'gold' },
        '+DI': { v: pDI, c: 'up', dash: true },
        '-DI': { v: mDI, c: 'down', dash: true },
      },
    };
  },
};

CALCS.ichimoku = {
  label: () => 'Ichimoku',
  fn: (S) => {
    const t = asc(S, 9), k = asc(S, 26), sb = asc(S, 52);
    const tenkan = t.mid, kijun = k.mid;
    const senA = tenkan.map((x, i) => (x == null || kijun[i] == null ? null : (x + kijun[i]) / 2));
    const senB = sb.mid;
    const chikou = nul(S.c.length);
    for (let i = 26; i < S.c.length; i++) chikou[i - 26] = S.c[i];
    return {
      lines: {
        Tenkan: { v: shiftFwd(tenkan, 0), c: 'gold' },
        Kijun: { v: kijun, c: 'blue' },
        'Senkou A': { v: shiftFwd(senA, 26), c: 'up', dash: true },
        'Senkou B': { v: shiftFwd(senB, 26), c: 'down', dash: true },
        Chikou: { v: chikou, c: 'platinum', dash: true },
      },
      band: ['Senkou A', 'Senkou B'],
    };
    function asc(Sx, per) {
      const hi = hh(Sx.h, per), lo = ll(Sx.l, per);
      return { mid: hi.map((x, i) => (x == null ? null : (x + lo[i]) / 2)) };
    }
  },
};

CALCS.alligator = {
  label: () => 'Alligator',
  fn: (S) => {
    const med = (S.h.map((h, i) => (h + S.l[i]) / 2));
    return {
      lines: {
        Çene: { v: shiftFwd(sma(med, 13), 8), c: 'blue' },
        Diş: { v: shiftFwd(sma(med, 8), 5), c: 'down' },
        Dudak: { v: shiftFwd(sma(med, 5), 3), c: 'up' },
      },
    };
  },
};

CALCS.chandelier = {
  label: (p) => `Chandelier (${p.p || 22}, ${p.m || 3})`,
  fn: (S, p) => {
    const per = p.p || 22, mult = p.m || 3;
    const atr = rma(trueRange(S), per), hhP = hh(S.h, per);
    const out = hhP.map((x, i) => (x == null || atr[i] == null ? null : x - mult * atr[i]));
    return { lines: { Chandelier: { v: out, c: 'gold' } } };
  },
};

CALCS.trix = {
  label: (p) => `TRIX (${p.p || 15})`,
  fn: (S, p) => {
    const per = p.p || 15;
    const e3 = ema(ema(ema(S.c, per), per), per);
    const line = roc(e3, 1);
    return { lines: { TRIX: { v: line, c: 'gold' }, Sinyal: { v: sma(line.map((x) => (x == null ? 0 : x)), 9).map((x, i) => (line[i] == null ? null : x)), c: 'copper', dash: true } } };
  },
};

CALCS.vortex = {
  label: (p) => `Vortex (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14, n = S.c.length;
    const vmP = nul(n), vmM = nul(n);
    for (let i = 1; i < n; i++) {
      vmP[i] = Math.abs(S.h[i] - S.l[i - 1]);
      vmM[i] = Math.abs(S.l[i] - S.h[i - 1]);
    }
    const tr = trueRange(S);
    const viP = nul(n), viM = nul(n);
    for (let i = per; i < n; i++) {
      let sp = 0, sm = 0, st = 0;
      for (let j = i - per + 1; j <= i; j++) { sp += vmP[j]; sm += vmM[j]; st += tr[j]; }
      viP[i] = st ? sp / st : null;
      viM[i] = st ? sm / st : null;
    }
    return { lines: { 'VI+': { v: viP, c: 'up' }, 'VI-': { v: viM, c: 'down' } } };
  },
};

CALCS.fractals = {
  label: () => 'Fractals',
  fn: (S) => {
    const dots = [];
    for (let i = 2; i < S.c.length - 2; i++) {
      const window = [S.h[i - 2], S.h[i - 1], S.h[i + 1], S.h[i + 2]];
      if (window.every((x) => S.h[i] > x)) dots.push({ i, v: S.h[i], dir: 'up', c: '#e8a0a8' });
      const windowL = [S.l[i - 2], S.l[i - 1], S.l[i + 1], S.l[i + 2]];
      if (windowL.every((x) => S.l[i] < x)) dots.push({ i, v: S.l[i], dir: 'down', c: '#9fe3c2' });
    }
    return { dots };
  },
};

/* ----------------------------- MOMENTUM / HIZ ----------------------------- */
CALCS.rsi = {
  label: (p) => `RSI (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const d = diff(S.c);
    const up = rma(d.map((x) => (x == null ? null : Math.max(x, 0))), per);
    const dn = rma(d.map((x) => (x == null ? null : Math.max(-x, 0))), per);
    const out = up.map((u, i) => {
      if (u == null || dn[i] == null) return null;
      if (dn[i] === 0) return 100;
      return 100 - 100 / (1 + u / dn[i]);
    });
    return { lines: { RSI: { v: out, c: 'gold' } } };
  },
};

CALCS.macd = {
  label: (p) => `MACD (${p.f || 12},${p.s || 26},${p.g || 9})`,
  fn: (S, p) => {
    const f = p.f || 12, s = p.s || 26, g = p.g || 9;
    const e1 = ema(S.c, f), e2 = ema(S.c, s);
    const line = e1.map((x, i) => (x == null || e2[i] == null ? null : x - e2[i]));
    const sig = ema(line.map((x) => (x == null ? 0 : x)), g).map((x, i) => (line[i] == null ? null : x));
    const hist = line.map((x, i) => (x == null || sig[i] == null ? null : x - sig[i]));
    return {
      lines: { MACD: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } },
      bars: { Histogram: { v: hist, colorBySign: true } },
    };
  },
};

CALCS.stoch = {
  label: (p) => `Stochastic (${p.p || 14},${p.k || 3},${p.d || 3})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const h = hh(S.h, per), l = ll(S.l, per);
    const rawK = S.c.map((_, i) => (h[i] == null || h[i] === l[i] ? null : (100 * (S.c[i] - l[i])) / (h[i] - l[i])));
    const k = sma(fixNulls(rawK), p.k || 3).map((x, i) => (rawK[i] == null ? null : x));
    const d = sma(fixNulls(k), p.d || 3).map((x, i) => (k[i] == null ? null : x));
    return { lines: { '%K': { v: k, c: 'gold' }, '%D': { v: d, c: 'copper', dash: true } } };
  },
};

CALCS.stochrsi = {
  label: (p) => `StochRSI (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const rsi = CALCS.rsi.fn(S, { p: per }).lines.RSI.v;
    const r = fixNulls(rsi);
    const h = hh(r, per), l = ll(r, per);
    const rawK = rsi.map((_, i) => (h[i] == null || h[i] === l[i] ? null : (100 * (rsi[i] - l[i])) / (h[i] - l[i])));
    const k = sma(fixNulls(rawK), 3).map((x, i) => (rawK[i] == null ? null : x));
    const d = sma(fixNulls(k), 3).map((x, i) => (k[i] == null ? null : x));
    return { lines: { '%K': { v: k, c: 'gold' }, '%D': { v: d, c: 'copper', dash: true } } };
  },
};

CALCS.cci = {
  label: (p) => `CCI (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const tp = hlc3(S);
    const m = sma(tp, per);
    const md = nul(tp.length);
    for (let i = per - 1; i < tp.length; i++) {
      let s = 0;
      for (let j = i - per + 1; j <= i; j++) s += Math.abs(tp[j] - m[i]);
      md[i] = s / per;
    }
    const out = tp.map((x, i) => (m[i] == null || !md[i] ? null : (x - m[i]) / (0.015 * md[i])));
    return { lines: { CCI: { v: out, c: 'gold' } } };
  },
};

CALCS.roc = {
  label: (p) => `ROC (${p.p || 9})`,
  fn: (S, p) => ({ lines: { ROC: { v: roc(S.c, p.p || 9), c: 'gold' } } }),
};

CALCS.mom = {
  label: (p) => `Momentum (${p.p || 10})`,
  fn: (S, p) => {
    const per = p.p || 10;
    const out = nul(S.c.length);
    for (let i = per; i < S.c.length; i++) out[i] = S.c[i] - S.c[i - per];
    return { lines: { Momentum: { v: out, c: 'gold' } } };
  },
};

CALCS.willr = {
  label: (p) => `Williams %R (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const h = hh(S.h, per), l = ll(S.l, per);
    const out = S.c.map((_, i) => (h[i] == null || h[i] === l[i] ? null : (-100 * (h[i] - S.c[i])) / (h[i] - l[i])));
    return { lines: { '%R': { v: out, c: 'gold' } } };
  },
};

CALCS.tsi = {
  label: (p) => `TSI (${p.l || 25},${p.s || 13})`,
  fn: (S, p) => {
    const l = p.l || 25, s = p.s || 13;
    const m = diff(S.c).map((x) => (x == null ? null : x));
    const ms = ema(fixNulls(ema(fixNulls(m), l)), s);
    const as = ema(fixNulls(ema(fixNulls(fixNulls(m).map(Math.abs)), l)), s);
    const line = ms.map((x, i) => (x == null || !as[i] ? null : (100 * x) / as[i]));
    const sig = sma(fixNulls(line), 7).map((x, i) => (line[i] == null ? null : x));
    return { lines: { TSI: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } } };
  },
};

CALCS.uo = {
  label: () => 'Ultimate Osc.',
  fn: (S) => {
    const n = S.c.length;
    const bp = nul(n), tr = trueRange(S);
    for (let i = 1; i < n; i++) bp[i] = S.c[i] - Math.min(S.l[i], S.c[i - 1]);
    const mix = (per) => {
      const out = nul(n);
      for (let i = per; i < n; i++) {
        let sb = 0, st = 0;
        for (let j = i - per + 1; j <= i; j++) { sb += bp[j] || 0; st += tr[j] || 0; }
        out[i] = st ? sb / st : null;
      }
      return out;
    };
    const a7 = mix(7), a14 = mix(14), a28 = mix(28);
    const out = a7.map((x, i) => (x == null || a14[i] == null || a28[i] == null ? null : (100 * (4 * x + 2 * a14[i] + a28[i])) / 7));
    return { lines: { UO: { v: out, c: 'gold' } } };
  },
};

CALCS.ao = {
  label: () => 'Awesome Osc.',
  fn: (S) => {
    const mid = hl2(S);
    const a5 = sma(mid, 5), a34 = sma(mid, 34);
    const line = a5.map((x, i) => (x == null || a34[i] == null ? null : x - a34[i]));
    return { lines: { AO: { v: line, c: 'gold' } }, bars: { AO: { v: line, colorBySign: true } } };
  },
};

CALCS.ppo = {
  label: (p) => `PPO (${p.f || 12},${p.s || 26},${p.g || 9})`,
  fn: (S, p) => {
    const f = p.f || 12, s = p.s || 26, g = p.g || 9;
    const ef = ema(S.c, f), es = ema(S.c, s);
    const line = ef.map((x, i) => (x == null || !es[i] ? null : (100 * (x - es[i])) / es[i]));
    const sig = ema(fixNulls(line), g).map((x, i) => (line[i] == null ? null : x));
    const hist = line.map((x, i) => (x == null ? null : x - sig[i]));
    return {
      lines: { PPO: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } },
      bars: { Histogram: { v: hist, colorBySign: true } },
    };
  },
};

CALCS.dpo = {
  label: (p) => `DPO (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const sh = Math.floor(per / 2) + 1;
    const m = sma(S.c, per);
    const out = m.map((x, i) => (x == null || i - sh < 0 ? null : S.c[i - sh] - x));
    return { lines: { DPO: { v: out, c: 'gold' } } };
  },
};

CALCS.kst = {
  label: () => 'KST',
  fn: (S) => {
    const r1 = sma(fixNulls(roc(S.c, 10)), 10);
    const r2 = sma(fixNulls(roc(S.c, 15)), 10);
    const r3 = sma(fixNulls(roc(S.c, 20)), 10);
    const r4 = sma(fixNulls(roc(S.c, 30)), 15);
    const n = S.c.length;
    const line = nul(n);
    for (let i = 0; i < n; i++) {
      if (r1[i] == null || r2[i] == null || r3[i] == null || r4[i] == null) continue;
      line[i] = r1[i] + 2 * r2[i] + 3 * r3[i] + 4 * r4[i];
    }
    const sig = sma(fixNulls(line), 9).map((x, i) => (line[i] == null ? null : x));
    return { lines: { KST: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } } };
  },
};

CALCS.cmo = {
  label: (p) => `CMO (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14, n = S.c.length;
    const out = nul(n);
    for (let i = per; i < n; i++) {
      let su = 0, sd = 0;
      for (let j = i - per + 1; j <= i; j++) {
        const d = S.c[j] - S.c[j - 1];
        if (d > 0) su += d; else sd -= d;
      }
      out[i] = su + sd ? (100 * (su - sd)) / (su + sd) : 0;
    }
    return { lines: { CMO: { v: out, c: 'gold' } } };
  },
};

CALCS.fisher = {
  label: (p) => `Fisher (${p.p || 10})`,
  fn: (S, p) => {
    const per = p.p || 10;
    const mid = hl2(S);
    const h = hh(mid, per), l = ll(mid, per);
    const n = S.c.length;
    const fish = nul(n), sig = nul(n);
    let val = 0, prevFish = 0;
    for (let i = per - 1; i < n; i++) {
      const raw = h[i] === l[i] ? 0 : ((mid[i] - l[i]) / (h[i] - l[i])) * 2 - 1;
      val = clamp(0.33 * raw + 0.67 * val, -0.999, 0.999);
      const f = 0.5 * Math.log((1 + val) / (1 - val)) + 0.5 * prevFish;
      fish[i] = f; sig[i] = prevFish;
      prevFish = f;
    }
    return { lines: { Fisher: { v: fish, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } } };
  },
};

CALCS.smi = {
  label: (p) => `SMI (${p.p || 14},${p.q || 3})`,
  fn: (S, p) => {
    const per = p.p || 14, q = p.q || 3;
    const h = hh(S.h, per), l = ll(S.l, per);
    const diffr = S.c.map((_, i) => (h[i] == null ? null : S.c[i] - (h[i] + l[i]) / 2));
    const range = S.c.map((_, i) => (h[i] == null ? null : h[i] - l[i]));
    const ds = ema(fixNulls(ema(fixNulls(diffr), q)), q);
    const rs = ema(fixNulls(ema(fixNulls(range), q)), q);
    const n = S.c.length;
    const line = nul(n);
    for (let i = 0; i < n; i++) {
      if (diffr[i] == null || ds[i] == null || !rs[i]) continue;
      line[i] = (100 * ds[i]) / (rs[i] / 2);
    }
    const sig = ema(fixNulls(line), q).map((x, i) => (line[i] == null ? null : x));
    return { lines: { SMI: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } } };
  },
};

CALCS.rvi = {
  label: (p) => `RVI (${p.p || 10})`,
  fn: (S, p) => {
    const per = p.p || 10;
    const num = sma(fixNulls(diff(S.c)), per);
    const den = sma(fixNulls(S.h.map((x, i) => x - S.l[i])), per);
    const n = S.c.length;
    const line = nul(n);
    for (let i = 0; i < n; i++) if (num[i] != null && den[i]) line[i] = num[i] / den[i];
    const sig = sma(fixNulls(line), 4).map((x, i) => (line[i] == null ? null : x));
    return { lines: { RVI: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } } };
  },
};

CALCS.pmo = {
  label: () => 'PMO',
  fn: (S) => {
    const r = roc(S.c, 1);
    const line = ema(fixNulls(ema(fixNulls(r), 35)), 20).map((x, i) => (r[i] == null ? null : (x == null ? null : 10 * x)));
    const sig = ema(fixNulls(line), 10).map((x, i) => (line[i] == null ? null : x));
    return { lines: { PMO: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } } };
  },
};

CALCS.coppock = {
  label: () => 'Coppock',
  fn: (S) => {
    const r14 = roc(S.c, 14), r11 = roc(S.c, 11);
    const sum = r14.map((x, i) => (x == null || r11[i] == null ? null : x + r11[i]));
    return { lines: { Coppock: { v: wma(fixNulls(sum), 10).map((x, i) => (sum[i] == null ? null : x)), c: 'gold' } } };
  },
};

/* ----------------------------- HACİM ----------------------------- */
CALCS.obv = {
  label: () => 'OBV',
  fn: (S) => {
    const n = S.c.length;
    const out = [0];
    for (let i = 1; i < n; i++) {
      const d = Math.sign(S.c[i] - S.c[i - 1]);
      out.push(out[i - 1] + d * S.v[i]);
    }
    return { lines: { OBV: { v: out, c: 'gold' } } };
  },
};

CALCS.mfi = {
  label: (p) => `MFI (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const tp = hlc3(S);
    const n = S.c.length;
    const out = nul(n);
    for (let i = per; i < n; i++) {
      let pos = 0, neg = 0;
      for (let j = i - per + 1; j <= i; j++) {
        const rmf = tp[j] * S.v[j];
        if (tp[j] > tp[j - 1]) pos += rmf; else neg += rmf;
      }
      out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
    }
    return { lines: { MFI: { v: out, c: 'gold' } } };
  },
};

CALCS.cmf = {
  label: (p) => `CMF (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const mfv = S.c.map((c, i) => {
      const range = S.h[i] - S.l[i];
      return range ? (((c - S.l[i]) - (S.h[i] - c)) / range) * S.v[i] : 0;
    });
    const n = S.c.length;
    const out = nul(n);
    for (let i = per - 1; i < n; i++) {
      let sm = 0, sv = 0;
      for (let j = i - per + 1; j <= i; j++) { sm += mfv[j]; sv += S.v[j]; }
      out[i] = sv ? sm / sv : null;
    }
    return { lines: { CMF: { v: out, c: 'gold' } } };
  },
};

CALCS.ad = {
  label: () => 'A/D Çizgisi',
  fn: (S) => {
    const n = S.c.length;
    const out = [0];
    for (let i = 1; i < n; i++) {
      const range = S.h[i] - S.l[i];
      const mfv = range ? (((S.c[i] - S.l[i]) - (S.h[i] - S.c[i])) / range) * S.v[i] : 0;
      out.push(out[i - 1] + mfv);
    }
    return { lines: { 'A/D': { v: out, c: 'gold' } } };
  },
};

CALCS.chaikinosc = {
  label: () => 'Chaikin Osc.',
  fn: (S) => {
    const ad = CALCS.ad.fn(S).lines['A/D'].v;
    const e3 = ema(ad, 3), e10 = ema(ad, 10);
    return { lines: { 'Chaikin Osc': { v: e3.map((x, i) => (x == null || e10[i] == null ? null : x - e10[i])), c: 'gold' } } };
  },
};

CALCS.force = {
  label: (p) => `Force Index (${p.p || 13})`,
  fn: (S, p) => {
    const per = p.p || 13;
    const f = S.c.map((c, i) => (i === 0 ? null : (c - S.c[i - 1]) * S.v[i]));
    return {
      bars: { Force: { v: f, colorBySign: true } },
      lines: { [`EMA ${per}`]: { v: ema(fixNulls(f), per), c: 'gold' } },
    };
  },
};

CALCS.eom = {
  label: (p) => `EOM (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const mid = hl2(S);
    const raw = S.c.map((_, i) => (i === 0 || !S.v[i] ? null : ((mid[i] - mid[i - 1]) * (S.h[i] - S.l[i])) / S.v[i]));
    return { lines: { EOM: { v: ema(fixNulls(raw), per).map((x, i) => (raw[i] == null ? null : x)), c: 'gold' } } };
  },
};

CALCS.voi = {
  label: (p) => `Volume Osc. (${p.f || 5},${p.s || 20})`,
  fn: (S, p) => {
    const f = sma(S.v, p.f || 5), s = sma(S.v, p.s || 20);
    return { lines: { VO: { v: f.map((x, i) => (x == null || !s[i] ? null : (100 * (x - s[i])) / s[i])), c: 'gold' } } };
  },
};

CALCS.kvo = {
  label: () => 'KVO',
  fn: (S) => {
    const n = S.c.length;
    const vf = nul(n);
    for (let i = 1; i < n; i++) {
      const t = S.h[i] + S.l[i] + S.c[i] > S.h[i - 1] + S.l[i - 1] + S.c[i - 1] ? 1 : -1;
      vf[i] = S.v[i] * (S.h[i] - S.l[i]) * t;
    }
    const e34 = ema(fixNulls(vf), 34), e55 = ema(fixNulls(vf), 55);
    const line = e34.map((x, i) => (x == null || e55[i] == null ? null : x - e55[i]));
    const sig = sma(fixNulls(line), 13).map((x, i) => (line[i] == null ? null : x));
    return { lines: { KVO: { v: line, c: 'gold' }, Sinyal: { v: sig, c: 'copper', dash: true } } };
  },
};

CALCS.nvi = {
  label: () => 'NVI',
  fn: (S) => cumIndex(S, (i, Sx) => Sx.v[i] < Sx.v[i - 1]),
};

CALCS.pvi = {
  label: () => 'PVI',
  fn: (S) => cumIndex(S, (i, Sx) => Sx.v[i] > Sx.v[i - 1]),
};

function cumIndex(S, cond) {
  const n = S.c.length;
  const out = nul(n);
  let v = 1000;
  out[0] = v;
  for (let i = 1; i < n; i++) {
    if (cond(i, S)) v *= 1 + (S.c[i] - S.c[i - 1]) / S.c[i - 1];
    out[i] = v;
  }
  return { lines: { Index: { v: out, c: 'gold' } } };
}

CALCS.pvt = {
  label: () => 'PVT',
  fn: (S) => {
    const n = S.c.length;
    const out = [0];
    for (let i = 1; i < n; i++) out.push(out[i - 1] + ((S.c[i] - S.c[i - 1]) / S.c[i - 1]) * S.v[i]);
    return { lines: { PVT: { v: out, c: 'gold' } } };
  },
};

CALCS.rvol = {
  label: (p) => `RVOL (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const avg = sma(S.v, per);
    const out = S.v.map((x, i) => (avg[i] == null ? null : x / avg[i]));
    return { bars: { RVOL: { v: out } }, lines: { 'Ort. Üstü': { v: out.map((x) => (x == null ? null : 1)), c: 'copper', dash: true } } };
  },
};

CALCS.twiggs = {
  label: (p) => `Twiggs MF (${p.p || 21})`,
  fn: (S, p) => {
    const per = p.p || 21;
    const fv = S.c.map((c, i) => {
      const range = S.h[i] - S.l[i];
      return range ? S.v[i] * (((c - S.l[i]) - (S.h[i] - c)) / range) : 0;
    });
    const num = rma(fv, per), den = rma(S.v, per);
    const out = num.map((x, i) => (x == null || !den[i] ? null : (100 * x) / den[i]));
    return { lines: { 'Twiggs MF': { v: out, c: 'gold' } } };
  },
};

CALCS.vroc = {
  label: (p) => `Hacim ROC (${p.p || 25})`,
  fn: (S, p) => ({ lines: { 'Hacim ROC': { v: roc(S.v, p.p || 25), c: 'gold' } } }),
};

CALCS.volbars = {
  label: (p) => `Hacim + Ort. (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    return { bars: { Hacim: { v: S.v.slice() } }, lines: { [`Ort ${per}`]: { v: sma(S.v, per), c: 'gold' } } };
  },
};

/* ----------------------------- VOLATİLİTE ----------------------------- */
CALCS.atr = {
  label: (p) => `ATR (${p.p || 14})`,
  fn: (S, p) => ({ lines: { ATR: { v: rma(trueRange(S), p.p || 14), c: 'gold' } } }),
};

CALCS.natr = {
  label: (p) => `NATR (${p.p || 14})`,
  fn: (S, p) => {
    const atr = rma(trueRange(S), p.p || 14);
    return { lines: { NATR: { v: atr.map((x, i) => (x == null ? null : (100 * x) / S.c[i])), c: 'gold' } } };
  },
};

CALCS.stddev = {
  label: (p) => `Std Sapma (${p.p || 20})`,
  fn: (S, p) => ({ lines: { 'Std Sapma': { v: stdev(S.c, p.p || 20), c: 'gold' } } }),
};

CALCS.histvol = {
  label: (p) => `Tarihsel Vol. (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20, n = S.c.length;
    const lr = nul(n);
    for (let i = 1; i < n; i++) lr[i] = Math.log(S.c[i] / S.c[i - 1]);
    const sd = stdev(fixNulls(lr), per);
    const out = sd.map((x, i) => (x == null || lr[i] == null ? null : x * Math.sqrt(252) * 100));
    return { lines: { 'Yıllık Vol. %': { v: out, c: 'gold' } } };
  },
};

CALCS.chaikinvol = {
  label: () => 'Chaikin Vol.',
  fn: (S) => {
    const hl = S.h.map((h, i) => h - S.l[i]);
    const e = ema(hl, 10);
    const out = e.map((x, i) => (x == null || !e[i - 1] ? null : (100 * (x - e[i - 1])) / e[i - 1]));
    return { lines: { 'Chaikin Vol.': { v: out, c: 'gold' } } };
  },
};

CALCS.ulcer = {
  label: (p) => `Ulcer (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const hhC = hh(S.c, per);
    const dd = S.c.map((c, i) => (hhC[i] == null ? null : (100 * (c - hhC[i])) / hhC[i]));
    const sq = sma(fixNulls(dd.map((x) => (x == null ? null : x * x))), per);
    return { lines: { 'Ulcer Index': { v: sq.map((x) => (x == null ? null : Math.sqrt(x))), c: 'gold' } } };
  },
};

CALCS.mass = {
  label: () => 'Mass Index',
  fn: (S) => {
    const hl = S.h.map((h, i) => h - S.l[i]);
    const e9 = ema(hl, 9);
    const e9e = ema(fixNulls(e9), 9);
    const ratio = e9.map((x, i) => (x == null || !e9e[i] ? null : x / e9e[i]));
    const out = nul(S.c.length);
    for (let i = 24; i < S.c.length; i++) {
      let s = 0, ok = true;
      for (let j = i - 24; j <= i; j++) { if (ratio[j] == null) { ok = false; break; } s += ratio[j]; }
      if (ok) out[i] = s;
    }
    return { lines: { 'Mass Index': { v: out, c: 'gold' } } };
  },
};

CALCS.chop = {
  label: (p) => `Choppiness (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14, n = S.c.length;
    const out = nul(n);
    const tr = trueRange(S);
    for (let i = per; i < n; i++) {
      let st = 0, mx = -Infinity, mn = Infinity;
      for (let j = i - per + 1; j <= i; j++) { st += tr[j]; mx = Math.max(mx, S.c[j]); mn = Math.min(mn, S.c[j]); }
      const range = mx - mn;
      out[i] = range ? (100 * Math.log10(st / range)) / Math.log10(per) : null;
    }
    return { lines: { Choppiness: { v: out, c: 'gold' } } };
  },
};

CALCS.squeeze = {
  label: (p) => `TTM Squeeze (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20;
    const bb = CALCS.bb.fn(S, { p: per, m: 2 }).lines;
    const kc = CALCS.keltner.fn(S, { p: per, m: 1.5 }).lines;
    const n = S.c.length;
    const dots = [];
    for (let i = 0; i < n; i++) {
      if (bb.Üst.v[i] == null || kc.Üst.v[i] == null) continue;
      const on = bb.Üst.v[i] - bb.Alt.v[i] < kc.Üst.v[i] - kc.Alt.v[i];
      if (on) dots.push({ i, v: null, dir: 'on' });
    }
    const mid = sma(S.c, per);
    const dcMid = CALCS.donchian.fn(S, { p: per }).lines.Orta.v;
    const delta = S.c.map((c, i) => (mid[i] == null || dcMid[i] == null ? null : c - (mid[i] + dcMid[i]) / 2));
    const { mid: hist } = linregSeries(fixNulls(delta), per);
    return { dots, bars: { Momentum: { v: hist, colorBySign: true } } };
  },
};

CALCS.truerange = {
  label: () => 'True Range',
  fn: (S) => ({ bars: { TR: { v: trueRange(S) } } }),
};

CALCS.relvol = {
  label: (p) => `RVI (${p.p || 10})`,
  fn: (S, p) => {
    const per = p.p || 10, n = S.c.length;
    const sd = stdev(S.c, per);
    const up = nul(n), dn = nul(n);
    for (let i = 1; i < n; i++) {
      if (sd[i] == null) continue; // ısınma dönemi
      if (S.c[i] >= S.c[i - 1]) { up[i] = sd[i]; dn[i] = 0; }
      else { up[i] = 0; dn[i] = sd[i]; }
    }
    const u = rma(up, per), d = rma(dn, per);
    const out = u.map((x, i) => {
      if (x == null || d[i] == null) return null;
      const sum = x + d[i];
      return sum === 0 ? 50 : (100 * x) / sum;
    });
    return { lines: { RVI: { v: out, c: 'gold' } } };
  },
};

CALCS.volratio = {
  label: (p) => `Volatilite Oranı (${p.p || 14})`,
  fn: (S, p) => {
    const per = p.p || 14;
    const tr = trueRange(S);
    const avg = sma(tr, per);
    return { lines: { 'TR / Ort TR': { v: tr.map((x, i) => (avg[i] == null || !avg[i] ? null : x / avg[i])), c: 'gold' } } };
  },
};

CALCS.parkinson = {
  label: (p) => `Parkinson (${p.p || 20})`,
  fn: (S, p) => {
    const per = p.p || 20, n = S.c.length;
    const sq = S.h.map((h, i) => Math.log(h / S.l[i]) ** 2);
    const out = nul(n);
    for (let i = per - 1; i < n; i++) {
      let s = 0;
      for (let j = i - per + 1; j <= i; j++) s += sq[j];
      out[i] = Math.sqrt(s / per / (4 * Math.LN2)) * Math.sqrt(252) * 100;
    }
    return { lines: { 'Parkinson Vol.': { v: out, c: 'gold' } } };
  },
};

/* ----------------------------- iç yardımcı ----------------------------- */
function fixNulls(a) {
  return a.map((x) => (x == null ? 0 : x));
}

export { CALCS };
export const getCalc = (id) => CALCS[id] || null;
