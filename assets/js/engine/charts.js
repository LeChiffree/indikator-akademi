// ==========================================================================
// charts.js — SVG grafik motoru
// Sentetik veriyi gerçek formüllerle hesaplar, iki panelli (fiyat + gösterge)
// grafik çizer; numaralı anotasyon noktaları ve not listesi üretir.
// ==========================================================================
import { genSeries, fmtPrice, fmtVol } from './synth.js';
import { getCalc } from './formulas.js';
import { SCENES } from './scenes.js';

const COLORS = {
  gold: '#d9b45b',
  hi: '#f4e3a6',
  copper: '#c77b4a',
  platinum: '#c3c9d6',
  blue: '#8fb6e8',
  violet: '#b48ce8',
  teal: '#63d6c4',
  up: '#63d6a0',
  down: '#e8707e',
};
const resolveColor = (c, i = 0) => COLORS[c] || c || [COLORS.gold, COLORS.platinum, COLORS.copper, COLORS.blue][i % 4];

/** Genel amaçlı sayı etiketi */
function fmtNum(x) {
  if (x == null || !isFinite(x)) return '–';
  const a = Math.abs(x);
  if (a >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return Math.round(x / 1e3) + 'K';
  if (a >= 100) return Math.round(x).toString();
  if (a >= 10) return x.toFixed(1);
  if (a >= 1) return x.toFixed(2);
  if (a >= 0.01) return x.toFixed(3);
  return x.toFixed(4);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ----------------------------- çizim yardımcıları ----------------------------- */
function scaleY(min, max, y0, y1) {
  const span = max - min || 1;
  return (v) => y1 - ((v - min) / span) * (y1 - y0);
}

function pathFrom(values, x, y) {
  let d = '';
  let pen = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !isFinite(v)) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  }
  return d.trim();
}

function argExtreme(values, mode) {
  let best = null, bi = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !isFinite(v)) continue;
    if (best == null || (mode === 'max' ? v > best : v < best)) { best = v; bi = i; }
  }
  return { i: bi, v: best };
}

/* ----------------------------- anotasyon çapaları ----------------------------- */
function resolveMarks(spec, S, priceLines, panelLines, n) {
  const marks = [];
  (spec.marks || []).forEach((m) => {
    const pts = anchorPoints(m, S, priceLines, panelLines, n);
    if (pts.length) marks.push({ ...m, pts });
  });
  return marks;
}

function anchorPoints(m, S, priceLines, panelLines, n) {
  const on = m.on || 'price';
  const group = on === 'panel' ? panelLines : priceLines;
  const line = (ref, defGroup) => {
    const g = defGroup === 'panel' ? panelLines : priceLines;
    if (typeof ref === 'number') return g[ref] || null;
    return g.find((l) => l.name === ref) || null;
  };
  const pt = (i, v) => [{ i, v, target: on }];

  switch (m.anchor) {
    case 'lastClose':
      return pt(n - 1, S.c[n - 1]);
    case 'maxHigh': {
      const e = argExtreme(S.h, 'max');
      return e.i >= 0 ? pt(e.i, e.v) : [];
    }
    case 'minLow': {
      const e = argExtreme(S.l, 'min');
      return e.i >= 0 ? pt(e.i, e.v) : [];
    }
    case 'maxOf': {
      const l = line(m.of ?? 0, on);
      if (!l) return [];
      const e = argExtreme(l.v, 'max');
      return e.i >= 0 ? pt(e.i, e.v) : [];
    }
    case 'minOf': {
      const l = line(m.of ?? 0, on);
      if (!l) return [];
      const e = argExtreme(l.v, 'min');
      return e.i >= 0 ? pt(e.i, e.v) : [];
    }
    case 'crossUp':
    case 'crossDown': {
      const grp = on === 'panel' ? panelLines : priceLines;
      const a = line(m.a ?? 0, on) || grp[0], b = line(m.b ?? 1, on) || grp[1];
      if (!a || !b) return [];
      let found = -1;
      for (let i = Math.max(1, n - 90); i < n; i++) {
        const a0 = a.v[i - 1], a1 = a.v[i], b0 = b.v[i - 1], b1 = b.v[i];
        if ([a0, a1, b0, b1].some((x) => x == null)) continue;
        if (m.anchor === 'crossUp' && a0 <= b0 && a1 > b1) found = i;
        if (m.anchor === 'crossDown' && a0 >= b0 && a1 < b1) found = i;
      }
      if (found < 0) {
        const e = argExtreme(a.v, m.anchor === 'crossUp' ? 'min' : 'max');
        return e.i >= 0 ? pt(e.i, e.v) : [];
      }
      return pt(found, a.v[found]);
    }
    case 'zoneEnter': {
      const l = line(m.of ?? 0, 'panel') || line(m.of ?? 0, on);
      if (!l) return [];
      const dir = m.dir || 'up';
      for (let i = Math.floor(n / 2); i < n; i++) {
        const a = l.v[i - 1], b = l.v[i];
        if (a == null || b == null) continue;
        if (dir === 'up' && a < m.v && b >= m.v) return pt(i, b);
        if (dir === 'down' && a > m.v && b <= m.v) return pt(i, b);
      }
      return [];
    }
    case 'maxVol': {
      const i = argExtreme(S.v, 'max').i;
      if (i < 0) return [];
      if (m.ratio) {
        let s = 0, cnt = 0;
        for (let j = Math.max(0, i - 19); j <= i; j++) { s += S.v[j]; cnt++; }
        const avg = s / cnt;
        if (!avg) return [];
        return [{ i, v: S.v[i] / avg, target: 'panel' }];
      }
      return [{ i, v: S.v[i], target: 'panel' }];
    }
    case 'divergence':
    case 'divergenceLow': {
      const osc = line(m.osc ?? 0, 'panel');
      if (!osc) return [];
      const peaks = [];
      const isTop = m.anchor === 'divergence';
      const src = isTop ? S.c : S.c;
      for (let i = 3; i < n - 3; i++) {
        let isP = true;
        for (let k = 1; k <= 3; k++) {
          if (isTop ? !(src[i] >= src[i - k] && src[i] >= src[i + k]) : !(src[i] <= src[i - k] && src[i] <= src[i + k])) { isP = false; break; }
        }
        if (isP && osc.v[i] != null) peaks.push(i);
      }
      const i2cand = peaks.filter((i) => i > n - 45);
      for (let b = i2cand.length - 1; b >= 0; b--) {
        for (let a = b - 1; a >= 0; a--) {
          const i2 = i2cand[b], i1 = peaks[peaks.indexOf(i2cand[a])];
          if (i1 == null || i2 == null || i2 - i1 < 6) continue;
          const pOk = isTop ? src[i2] > src[i1] : src[i2] < src[i1];
          const oOk = isTop ? osc.v[i2] < osc.v[i1] - 1 : osc.v[i2] > osc.v[i1] + 1;
          if (pOk && oOk) {
            const y1 = isTop ? S.h[i1] : S.l[i1];
            const y2 = isTop ? S.h[i2] : S.l[i2];
            return [
              { i: i1, v: y1, target: 'price' },
              { i: i2, v: y2, target: 'price' },
              { i: i1, v: osc.v[i1], target: 'panel' },
              { i: i2, v: osc.v[i2], target: 'panel' },
            ];
          }
        }
      }
      // bulunamazsa: son iki tepe/dip üzerine işaret koy (metin yine doğru okunur)
      const e = argExtreme(src, isTop ? 'max' : 'min');
      if (e.i < 0) return [];
      return [{ i: e.i, v: isTop ? S.h[e.i] : S.l[e.i], target: 'price' }, { i: e.i, v: osc.v[e.i], target: 'panel' }];
    }
    default:
      return [];
  }
}

/* ----------------------------- ana çizim ----------------------------- */
/**
 * @param {object} spec — indikatör veri dosyasındaki chart tanımı
 * @returns {{svg:string, legend:Array, notes:Array, title?:string}}
 */
export function renderChart(spec) {
  if (spec.diagram) {
    // Diyagram modu (kavramsal indikatörler)
    const scene = SCENES[spec.diagram];
    const notes = (spec.notes || []).map((t, i) => ({ num: null, text: t }));
    if (typeof scene === 'function') {
      return { svg: scene(), legend: [], notes };
    }
    return { svg: fallbackScene(), legend: [], notes };
  }

  const S = genSeries(spec.scene || 'range', spec.seed || 7);
  const n = S.c.length;
  const W = 720;

  /* --- hesaplar --- */
  const priceLines = [];  // {name, v, color, dash, width}
  const panelLines = [];
  const priceBands = [];
  const panelBands = [];
  const priceDots = [];
  const panelDots = [];
  let panelBars = null; // {name, v, colorBySign, color}
  const legend = [];

  const runCalc = (entry, bucketLines, bucketBands, bucketDots, idx) => {
    const calc = getCalc(entry.calc);
    if (!calc) return null;
    const res = calc.fn(S, entry) || {};
    const lines = res.lines || {};
    Object.entries(lines).forEach(([name, def], li) => {
      const color = resolveColor(entry.colors?.[li] || def.c, li);
      bucketLines.push({ name, v: def.v, color, dash: !!def.dash, width: entry.width || (li === 0 ? 1.9 : 1.4), entry });
      legend.push({ label: name === 'Index' || name === 'TR' || name === 'Hacim' ? def.legendLabel || name : name, color, dash: !!def.dash, kind: 'line', owner: entry.label || calc.label(entry) });
    });
    (res.band ? [res.band] : []).forEach(([a, b]) => {
      const la = lines[a], lb = lines[b];
      if (la && lb) bucketBands.push({ a: la.v, b: lb.v, color: '#d9b45b' });
    });
    (res.dots || []).forEach((d) => bucketDots.push(d));
    return res;
  };

  (spec.overlay || []).forEach((o) => runCalc(o, priceLines, priceBands, priceDots, 0));
  if (spec.panel) {
    const res = runCalc(spec.panel, panelLines, panelBands, panelDots, 1);
    if (res && res.bars) {
      const [bname, bdef] = Object.entries(res.bars)[0];
      panelBars = { name: bname, ...bdef, color: bdef.c ? resolveColor(bdef.c) : COLORS.gold };
      legend.push({ label: bname, color: panelBars.color, kind: 'bar', colorBySign: bdef.colorBySign });
    }
  }

  (spec.legendExtra || []).forEach((e) =>
    legend.push({ label: e.label, color: e.color || COLORS.down, kind: e.kind || 'dot', dash: !!e.dash })
  );

  /* --- ölçekler --- */
  const pad = { t: 16, r: 58, b: 26, l: 12 };
  const plotW = W - pad.l - pad.r;
  const x = (i) => pad.l + (i + 0.5) * (plotW / n);

  const hasPanel = !!(spec.panel && (panelLines.length || panelBars));
  const priceTop = pad.t;
  const priceBottom = hasPanel ? 330 : 372;
  const panelTop = hasPanel ? 368 : 0;
  const panelBottom = hasPanel ? 470 : 0;

  let pMin = Math.min(...S.l), pMax = Math.max(...S.h);
  const extend = (v) => { if (v == null || !isFinite(v)) return; if (v < pMin) pMin = v; if (v > pMax) pMax = v; };
  priceLines.forEach((l) => l.v.forEach(extend));
  priceBands.forEach((b) => { b.a.forEach(extend); b.b.forEach(extend); });
  if (spec.priceRange) { pMin = Math.min(pMin, spec.priceRange[0]); pMax = Math.max(pMax, spec.priceRange[1]); }
  const padP = (pMax - pMin) * 0.05;
  const priceScale = scaleY(pMin - padP, pMax + padP, priceTop, priceBottom);
  const priceX = (i) => x(i);

  let panMin = Infinity, panMax = -Infinity;
  const extendPan = (v) => { if (v == null || !isFinite(v)) return; if (v < panMin) panMin = v; if (v > panMax) panMax = v; };
  panelLines.forEach((l) => l.v.forEach(extendPan));
  if (panelBars) panelBars.v.forEach(extendPan);
  (spec.panel?.guides || []).forEach((g) => extendPan(g.v));
  (spec.panel?.zones || []).forEach((z) => { extendPan(z.from); extendPan(z.to); });
  panelDots.forEach((d) => { if (d.v != null) extendPan(d.v); });
  if (!isFinite(panMin)) { panMin = 0; panMax = 1; }
  const padPan = (panMax - panMin) * 0.08 || 1;
  const panelScale = scaleY(panMin - padPan, panMax + padPan, panelTop, panelBottom);

  /* --- SVG parçaları --- */
  let out = '';

  // ızgara (fiyat + panel)
  const gridY = hasPanel ? [priceTop + 40, priceTop + 120, priceTop + 200, priceTop + 280] : [priceTop + 60, priceTop + 160, priceTop + 260, priceTop + 340];
  gridY.forEach((gy) => { out += `<line class="grid-line" x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}"/>`; });
  if (hasPanel) {
    [panelTop + 34, panelTop + 68].forEach((gy) => { out += `<line class="grid-line" x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}"/>`; });
  }

  // fiyat eksen etiketleri (sağ)
  const priceTicks = [pMin - padP, (pMin + pMax) / 2, pMax + padP];
  priceTicks.forEach((v, k) => {
    out += `<text class="axis-text" x="${W - pad.r + 6}" y="${(priceScale(v) + 3.5).toFixed(1)}">${fmtPrice(v)}</text>`;
    if (k === 1) out += `<text class="axis-text" x="${W - pad.r + 6}" y="${(priceScale(v) + 15).toFixed(1)}" style="font-size:8.5px">fiyat</text>`;
  });

  // bantlar (bulut / bollinger)
  priceBands.forEach((b) => { out += bandPolygon(b.a, b.b, priceX, priceScale); });
  panelBands.forEach((b) => { out += bandPolygon(b.a, b.b, x, panelScale); });

  // mumlar
  const step = plotW / n;
  const bw = Math.max(2.2, step * 0.62);
  for (let i = 0; i < n; i++) {
    const up = S.c[i] >= S.o[i];
    const cls = up ? 'up' : 'down';
    const cx = x(i);
    out += `<line class="wick-${cls}" x1="${cx.toFixed(1)}" y1="${priceScale(S.h[i]).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${priceScale(S.l[i]).toFixed(1)}" stroke-width="1.1"/>`;
    const y1 = priceScale(Math.max(S.o[i], S.c[i]));
    const y2 = priceScale(Math.min(S.o[i], S.c[i]));
    out += `<rect class="candle-${cls}" x="${(cx - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.4, y2 - y1).toFixed(1)}" rx="0.8"/>`;
  }

  // fiyat çizgileri
  priceLines.forEach((l) => {
    out += `<path d="${pathFrom(l.v, priceX, priceScale)}" fill="none" stroke="${l.color}" stroke-width="${l.width}" ${l.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linecap="round"/>`;
  });

  // fiyat noktaları (hesaplanan: PSAR, fractal, supertrend dönüşü)
  priceDots.forEach((d) => {
    if (d.v == null) return;
    const c = d.c || priceDotsColor(d.dir);
    out += `<circle cx="${x(d.i).toFixed(1)}" cy="${priceScale(d.v).toFixed(1)}" r="2.4" fill="${c}"/>`;
  });

  // panel (gösterge) bölümü
  if (hasPanel) {
    out += `<line class="grid-line" x1="${pad.l}" y1="${panelBottom + 14}" x2="${W - pad.r}" y2="${panelBottom + 14}" style="stroke:rgba(255,255,255,.12)"/>`;

    (spec.panel.zones || []).forEach((z) => {
      const yTop = panelScale(z.to), yBot = panelScale(z.from);
      out += `<rect class="${z.tone === 'up' ? 'zone-up' : 'zone-down'}" x="${pad.l}" y="${yTop.toFixed(1)}" width="${plotW}" height="${Math.max(1, yBot - yTop).toFixed(1)}"/>`;
    });

    if (panelBars) {
      const bars = panelBars;
      const zeroIn = bars.colorBySign ? panelScale(0) : null;
      for (let i = 0; i < n; i++) {
        const v = bars.v[i];
        if (v == null || !isFinite(v)) continue;
        const cx = x(i);
        const yv = panelScale(v);
        const y0 = zeroIn != null ? zeroIn : panelBottom;
        const top = Math.min(yv, y0), hgt = Math.max(1, Math.abs(y0 - yv));
        const col = bars.colorBySign ? (v >= 0 ? COLORS.up : COLORS.down) : bars.color;
        out += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${col}" rx="0.6" opacity="${bars.colorBySign ? 0.85 : 0.6}"/>`;
      }
    }

    (spec.panel.guides || []).forEach((g) => {
      const gy = panelScale(g.v);
      out += `<line class="guide-line" x1="${pad.l}" y1="${gy.toFixed(1)}" x2="${W - pad.r}" y2="${gy.toFixed(1)}"/>`;
      out += `<text class="guide-text" x="${pad.l + 4}" y="${(gy - 4).toFixed(1)}">${esc(g.label || fmtNum(g.v))}</text>`;
    });

    panelLines.forEach((l) => {
      out += `<path d="${pathFrom(l.v, x, panelScale)}" fill="none" stroke="${l.color}" stroke-width="${l.width}" ${l.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linecap="round"/>`;
    });

    // panel noktaları (sıkışma vb.)
    panelDots.forEach((d) => {
      if (d.v == null) { // sıkışma göstergesi: panel alt şeridinde kırmızı nokta
        out += `<circle cx="${x(d.i).toFixed(1)}" cy="${(panelBottom - 6).toFixed(1)}" r="2.6" fill="${COLORS.down}" opacity="0.9"/>`;
        return;
      }
      out += `<circle cx="${x(d.i).toFixed(1)}" cy="${panelScale(d.v).toFixed(1)}" r="2.4" fill="${d.c || priceDotsColor(d.dir)}"/>`;
    });

    // panel eksen etiketleri (sağ)
    out += `<text class="axis-text" x="${W - pad.r + 6}" y="${(panelScale(panMax) + 10).toFixed(1)}">${fmtNum(panMax)}</text>`;
    out += `<text class="axis-text" x="${W - pad.r + 6}" y="${(panelScale(panMin)).toFixed(1)}">${fmtNum(panMin)}</text>`;
  }

  /* --- anotasyonlar --- */
  const marks = resolveMarks(spec, S, priceLines, panelLines, n);
  const notes = [];
  marks.forEach((m, k) => {
    const num = k + 1;
    notes.push({ num, text: m.text });
    m.pts.forEach((p) => {
      const yy = p.target === 'panel' ? panelScale(p.v) : priceScale(p.v);
      if (p.v == null || !isFinite(yy)) return;
      out += `<circle class="mark-dot" cx="${x(p.i).toFixed(1)}" cy="${yy.toFixed(1)}" r="8"/>`;
      out += `<text class="mark-num" x="${x(p.i).toFixed(1)}" y="${(yy + 3.1).toFixed(1)}" text-anchor="middle">${num}</text>`;
    });
  });

  const svg = svgShell(W, hasPanel ? 500 : 400, out, spec);
  return { svg, legend, notes };
}

function priceDotsColor(dir) {
  if (dir === 'up') return COLORS.up;
  if (dir === 'down') return COLORS.down;
  if (dir === 'on') return COLORS.down;
  return COLORS.gold;
}

function bandPolygon(a, b, x, y) {
  const segs = [];
  let cur = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] == null || b[i] == null) { if (cur.length) segs.push(cur); cur = []; continue; }
    cur.push(i);
  }
  if (cur.length) segs.push(cur);
  let d = '';
  segs.forEach((seg) => {
    if (seg.length < 2) return;
    d += 'M' + seg.map((i) => `${x(i).toFixed(1)} ${y(a[i]).toFixed(1)}`).join(' L');
    d += ' L' + seg.slice().reverse().map((i) => `${x(i).toFixed(1)} ${y(b[i]).toFixed(1)}`).join(' L') + ' Z ';
  });
  if (!d) return '';
  return `<path d="${d.trim()}" fill="rgba(217,180,91,0.09)" stroke="rgba(217,180,91,0.28)" stroke-width="0.8"/>`;
}

function fallbackScene() {
  return svgShell(720, 300, '<text x="360" y="150" text-anchor="middle" fill="#8f89a3" font-size="13">Diyagram yükleniyor…</text>');
}

function svgShell(w, h, inner, spec) {
  const label = spec && spec.svgLabel ? `<text class="scene-sub" x="12" y="12">${esc(spec.svgLabel)}</text>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Örnek grafik">${label}${inner}</svg>`;
}

/* ----------------------------- dışa aktarımlar ----------------------------- */
export { fmtNum, COLORS, resolveColor };
