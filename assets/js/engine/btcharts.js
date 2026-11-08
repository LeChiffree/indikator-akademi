// ==========================================================================
// btcharts.js — Backtest dashboard grafikleri (bağımlılıksız SVG)
// Çizgi (çoklu seri), bar, histogram, ısı haritası.
// Tüm fonksiyonlar SVG metni döner; etkileşim veri öznitelikleriyle yapılır.
// ==========================================================================

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------ biçimleme ------------------------------ */

export function fmtPct(v, d = 2) {
  if (v == null || !isFinite(v)) return '—';
  const s = (v * 100).toFixed(d);
  return (v > 0 ? '+' : '') + s + '%';
}

export function fmtNum(v, d = 2) {
  if (v == null || !isFinite(v)) return '—';
  return v.toFixed(d);
}

export function fmtInt(v) {
  if (v == null || !isFinite(v)) return '—';
  return Math.round(v).toLocaleString('tr-TR');
}

export function niceTicks(min, max, n = 4) {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const span = max - min;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

/* ------------------------------ renkler ------------------------------ */

const lerp = (a, b, t) => a + (b - a) * t;
function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(c1, c2, t) {
  const a = hex2rgb(c1), b = hex2rgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

// Yakınsak ölçek: negatif kırmızı → nötr → pozitif yeşil. t ∈ [-1, 1]
export function divColor(t) {
  if (t == null || !isFinite(t)) return 'rgba(255,255,255,.04)';
  const x = Math.max(-1, Math.min(1, t));
  if (x >= 0) return mix('#191923', '#2e7d5b', Math.pow(x, 0.6));
  return mix('#191923', '#a03a4a', Math.pow(-x, 0.6));
}

// Sıralı ölçek: koyu → altın. t ∈ [0, 1]
export function seqGold(t) {
  if (t == null || !isFinite(t)) return 'rgba(255,255,255,.04)';
  const x = Math.max(0, Math.min(1, t));
  return mix('#191923', '#d9b45b', Math.pow(x, 0.7));
}

// Sıralı ölçek: koyu → mavi. t ∈ [0, 1]
export function seqBlue(t) {
  if (t == null || !isFinite(t)) return 'rgba(255,255,255,.04)';
  const x = Math.max(0, Math.min(1, t));
  return mix('#191923', '#6fa8ff', Math.pow(x, 0.7));
}

/* ------------------------------ çizgi grafik ------------------------------ */

// series: [{ name, color, width, dash, opacity, endLabel, pts: [[x,y],...] }]  (y null → kopukluk)
export function lineChart({
  w = 660, h = 250, series = [], pad = { l: 52, r: 14, t: 12, b: 26 },
  yFormat = (v) => fmtNum(v, 2), xTicks = [], yMin = null, yMax = null,
  zeroLine = null, xDomain = null, endLabelFmt = (v) => fmtNum(v, 2),
}) {
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  let mn = Infinity, mx = -Infinity;
  for (const s of series) for (const [, y] of s.pts) if (y != null && isFinite(y)) { if (y < mn) mn = y; if (y > mx) mx = y; }
  if (mn === Infinity) { mn = 0; mx = 1; }
  if (yMin != null) mn = Math.min(mn, yMin);
  if (yMax != null) mx = Math.max(mx, yMax);
  if (mn === mx) { mn -= 1; mx += 1; }
  const padY = (mx - mn) * 0.06;
  mn -= padY; mx += padY;

  let x0 = Infinity, x1 = -Infinity;
  for (const s of series) for (const [x] of s.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (xDomain) { x0 = xDomain[0]; x1 = xDomain[1]; }
  if (!isFinite(x0) || x0 === x1) { x0 = 0; x1 = 1; }

  const sx = (x) => pad.l + ((x - x0) / (x1 - x0)) * iw;
  const sy = (y) => pad.t + (1 - (y - mn) / (mx - mn)) * ih;

  const parts = [];
  // ızgara + y ekseni
  for (const tv of niceTicks(mn, mx, 4)) {
    const y = sy(tv);
    parts.push(`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.06)"/>`);
    parts.push(`<text x="${pad.l - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(255,255,255,.45)">${esc(yFormat(tv))}</text>`);
  }
  // x ekseni çentikleri
  for (const t of xTicks) {
    if (t.x < x0 || t.x > x1) continue;
    const x = sx(t.x);
    parts.push(`<line x1="${x.toFixed(1)}" y1="${pad.t}" x2="${x.toFixed(1)}" y2="${h - pad.b}" stroke="rgba(255,255,255,.04)"/>`);
    parts.push(`<text x="${x.toFixed(1)}" y="${h - pad.b + 15}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.45)">${esc(t.label)}</text>`);
  }
  if (zeroLine != null && zeroLine >= mn && zeroLine <= mx) {
    const y = sy(zeroLine);
    parts.push(`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}" stroke="rgba(217,180,91,.35)" stroke-dasharray="3 4"/>`);
  }
  // seriler
  for (const s of series) {
    let d = '', pen = false;
    for (const [x, y] of s.pts) {
      if (y == null || !isFinite(y)) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(y).toFixed(1);
      pen = true;
    }
    if (!d) continue;
    parts.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.6}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} opacity="${s.opacity ?? 1}" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  // seri bitiş rozetleri (son değer) — kullanıcı sayıyı hover'sız görsün
  for (const s of series) {
    if (!s.endLabel) continue;
    for (let k = s.pts.length - 1; k >= 0; k--) {
      const [x, y] = s.pts[k];
      if (y == null || !isFinite(y)) continue;
      const px = sx(x), py = sy(y);
      parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.1" fill="#0d0c13" stroke="${s.color}" stroke-width="2"/>`);
      parts.push(`<text x="${(px - 7).toFixed(1)}" y="${(py - 8).toFixed(1)}" text-anchor="end" class="endlabel">${esc(endLabelFmt(y))}</text>`);
      break;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="btsvg" role="img">${parts.join('')}</svg>`;
}

/* ------------------------------ bar grafik ------------------------------ */

// items: [{ label, value, color, sub, active, tf }]
export function barChart({
  w = 420, h = 200, items = [], pad = { l: 46, r: 10, t: 16, b: 34 },
  yFormat = (v) => fmtNum(v, 2), forceMax = null, valLabels = true,
}) {
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  let mn = Math.min(0, ...items.map((i) => (isFinite(i.value) ? i.value : 0)));
  let mx = Math.max(0, ...items.map((i) => (isFinite(i.value) ? i.value : 0)));
  if (forceMax != null) { mn = Math.min(mn, -forceMax); mx = Math.max(mx, forceMax); }
  if (mn === mx) { mn = -1; mx = 1; }
  const sy = (y) => pad.t + (1 - (y - mn) / (mx - mn)) * ih;
  const n = items.length || 1;
  const bw = Math.min(56, (iw / n) * 0.62);
  const step = iw / n;
  const parts = [];
  for (const tv of niceTicks(mn, mx, 4)) {
    const y = sy(tv);
    parts.push(`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.06)"/>`);
    parts.push(`<text x="${pad.l - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(255,255,255,.45)">${esc(yFormat(tv))}</text>`);
  }
  const y0 = sy(0);
  parts.push(`<line x1="${pad.l}" y1="${y0.toFixed(1)}" x2="${w - pad.r}" y2="${y0.toFixed(1)}" stroke="rgba(255,255,255,.18)"/>`);
  items.forEach((it, i) => {
    const cx = pad.l + step * (i + 0.5);
    const v = isFinite(it.value) ? it.value : 0;
    const y = sy(v);
    const top = Math.min(y, y0), hh = Math.max(2, Math.abs(y - y0));
    const active = it.active ? ' stroke="#f4e3a6" stroke-width="1.2"' : '';
    parts.push(`<g data-bt-tf="${esc(it.tf || '')}" class="btbar${it.active ? ' is-active' : ''}">
      <rect x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="${it.color || divColor(v >= 0 ? 0.8 : -0.8)}" opacity="${it.active ? 1 : 0.82}"${active}>
        <title>${esc(it.label)}: ${esc(yFormat(v))}${it.sub ? ' · ' + esc(it.sub) : ''}</title>
      </rect>`);
    // değer etiketi: barın üstünde (negatifse altında) — hover gerekmez
    if (valLabels) {
      const ly = v >= 0 ? Math.max(pad.t + 7.5, y - 5.5) : Math.min(h - pad.b - 4, y + 12);
      parts.push(`<text x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" class="btbar-val${it.active ? ' is-active' : ''}">${esc(yFormat(v))}</text>`);
    }
    parts.push(`<text x="${cx.toFixed(1)}" y="${h - pad.b + 15}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,${it.active ? '.9' : '.55'})">${esc(it.label)}</text>`);
    if (it.sub) parts.push(`<text x="${cx.toFixed(1)}" y="${h - pad.b + 27}" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,.35)">${esc(it.sub)}</text>`);
    parts.push('</g>');
  });
  return `<svg viewBox="0 0 ${w} ${h}" class="btsvg" role="img">${parts.join('')}</svg>`;
}

/* ------------------------------ histogram ------------------------------ */

// bins: 82 elemanlı dizi (0..79 → -10..+10 arası 0,25'lik kovalar; 80=alt taşma; 81=üst taşma)
export function histogram({
  bins = [], w = 660, h = 220, pad = { l: 44, r: 14, t: 18, b: 26 },
}) {
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const NB = 80;
  const core = bins.slice(0, NB);
  const below = bins[80] || 0, above = bins[81] || 0;
  const mx = Math.max(1, ...core);
  const bw = iw / NB;
  const x0 = pad.l + iw / 2; // %0 çizgisi
  const parts = [];
  // bölge tonları: sol kırmızı (zarar), sağ yeşil (kâr) — bir bakışta okunur
  parts.push(`<rect x="${pad.l}" y="${pad.t}" width="${(iw / 2).toFixed(1)}" height="${ih}" fill="rgba(232,112,126,.05)"/>`);
  parts.push(`<rect x="${x0.toFixed(1)}" y="${pad.t}" width="${(iw / 2).toFixed(1)}" height="${ih}" fill="rgba(99,214,160,.055)"/>`);
  for (let k = 0; k <= 4; k++) {
    const v = Math.round((mx * k) / 4);
    const y = pad.t + (1 - (mx ? v / mx : 0)) * ih;
    parts.push(`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.07)"/>`);
    parts.push(`<text x="${pad.l - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(255,255,255,.45)">${v}</text>`);
  }
  // x çentikleri: dar ekranda seyrek (okunurluk), geniş ekranda %2,5
  const xtStep = w < 520 ? 5 : 2.5;
  for (let p = -10; p <= 10; p += xtStep) {
    const x = pad.l + ((p + 10) / 20) * iw;
    parts.push(`<text x="${x.toFixed(1)}" y="${h - pad.b + 15}" text-anchor="middle" font-size="9.5" fill="rgba(255,255,255,.45)">${p > 0 ? '+' : ''}${p}%</text>`);
  }
  parts.push(`<line x1="${x0.toFixed(1)}" y1="${pad.t}" x2="${x0.toFixed(1)}" y2="${h - pad.b}" stroke="rgba(217,180,91,.45)" stroke-dasharray="3 4"/>`);
  for (let k = 0; k < NB; k++) {
    const c = core[k];
    if (!c) continue;
    const y = pad.t + (1 - (mx ? c / mx : 0)) * ih;
    const mid = -10 + (k + 0.5) * 0.25;
    const col = mid >= 0 ? '#2e7d5b' : '#a03a4a';
    parts.push(`<rect x="${(pad.l + k * bw + 0.4).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0.8, bw - 0.8).toFixed(1)}" height="${(h - pad.b - y).toFixed(1)}" fill="${col}" opacity=".85"><title>${esc((mid - 0.125).toFixed(2))}% … ${esc((mid + 0.125).toFixed(2))}%: ${fmtInt(c)} işlem</title></rect>`);
  }
  // medyan işaretçisi — "tipik işlem" çizgisi
  const med = histMedian(bins);
  if (med != null) {
    const xm = pad.l + ((med + 10) / 20) * iw;
    parts.push(`<line x1="${xm.toFixed(1)}" y1="${pad.t}" x2="${xm.toFixed(1)}" y2="${h - pad.b}" stroke="rgba(127,209,185,.85)" stroke-width="1.2" stroke-dasharray="4 3"/>`);
    parts.push(`<text x="${Math.max(pad.l + 26, Math.min(w - pad.r - 26, xm)).toFixed(1)}" y="${pad.t - 6}" text-anchor="middle" class="hist-med">medyan ${med.toFixed(2)}%</text>`);
  }
  if (below) parts.push(`<text x="${pad.l}" y="${pad.t + 10}" font-size="9.5" fill="rgba(255,110,110,.75)">◄ −10%'dan kötü: ${fmtInt(below)}</text>`);
  if (above) parts.push(`<text x="${w - pad.r}" y="${pad.t + 10}" text-anchor="end" font-size="9.5" fill="rgba(110,220,160,.75)">+10%'dan iyi: ${fmtInt(above)} ►</text>`);
  return `<svg viewBox="0 0 ${w} ${h}" class="btsvg" role="img">${parts.join('')}</svg>`;
}

// Histogramdan yaklaşık medyan (%). bins kullanır.
export function histMedian(bins) {
  const total = bins.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let acc = 0;
  for (let k = 0; k < 80; k++) {
    acc += bins[k];
    if (acc >= total / 2) return -10 + (k + 0.5) * 0.25;
  }
  return null;
}

/* ------------------------------ ısı haritası ------------------------------ */

// rows: [{ label, cells: [{ v, text, title, cls }] }]
// colorFn(v, rowIdx, colIdx) → CSS renk
export function heatmap({
  rows = [], cols = [], colorFn = () => divColor(0), cw = 58, ch = 22, padL = 92, padT = 28, padB = 8, w = null, tfAttr = 'data-bt-tf', activeCol = null,
}) {
  const nCols = cols.length;
  const nRows = rows.length;
  const W = w || padL + nCols * cw + 12;
  const H = padT + nRows * ch + padB;
  const parts = [];
  cols.forEach((c, j) => {
    const x = padL + j * cw + cw / 2;
    const isActive = activeCol && c.id === activeCol;
    parts.push(`<text x="${x}" y="${padT - 10}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${isActive ? '#f4e3a6' : 'rgba(244,227,166,.85)'}" style="cursor:pointer" ${tfAttr}="${esc(c.id)}" class="btheat-col">${esc(c.label)}</text>`);
    if (isActive) parts.push(`<line x1="${(x - 15).toFixed(1)}" y1="${padT - 4}" x2="${(x + 15).toFixed(1)}" y2="${padT - 4}" stroke="rgba(217,180,91,.7)" stroke-width="1.6" stroke-linecap="round"/>`);
  });
  rows.forEach((r, i) => {
    const y = padT + i * ch;
    // zebra: satır takibi kolaylaşsın
    if (i % 2 === 1) parts.push(`<rect x="0" y="${y.toFixed(1)}" width="${W}" height="${ch}" fill="rgba(255,255,255,.018)"/>`);
    parts.push(`<g class="btheat-row">`);
    parts.push(`<text x="${padL - 8}" y="${(y + ch * 0.7).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(255,255,255,.68)">${esc(r.label)}</text>`);
    r.cells.forEach((cell, j) => {
      const x = padL + j * cw;
      const bg = cell.v == null ? 'rgba(255,255,255,.03)' : colorFn(cell.v, i, j);
      parts.push(`<g class="btheat-cell" ${tfAttr}="${esc(cols[j] ? cols[j].id : '')}" data-heat="${esc(cell.title || '')}">
        <rect x="${(x + 1).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${(ch - 2).toFixed(1)}" rx="3" fill="${bg}">
          <title>${esc(cell.title || '')}</title>
        </rect>
        <text x="${(x + cw / 2).toFixed(1)}" y="${(y + ch * 0.7).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="rgba(255,255,255,.8)" pointer-events="none">${esc(cell.text ?? (cell.v == null ? '–' : cell.v))}</text>
      </g>`);
    });
    parts.push(`</g>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="btsvg btsvg--heat" preserveAspectRatio="xMidYMin meet" style="min-width:${W}px" role="img">${parts.join('')}</svg>`;
}

/* ------------------------------ yardımcı: yıl çentikleri ------------------------------ */

export function yearTicks(t0, t1) {
  const out = [];
  const y0 = new Date(t0).getUTCFullYear();
  const y1 = new Date(t1).getUTCFullYear();
  for (let y = y0; y <= y1; y++) out.push({ x: Date.UTC(y, 0, 1), label: String(y) });
  return out;
}
