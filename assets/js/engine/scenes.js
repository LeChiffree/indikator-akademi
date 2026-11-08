// ==========================================================================
// scenes.js — Kavramsal indikatör diyagramları
// Formasyonlar ve yapı konuları için el çizimi SVG şemalar (720×380).
// Yardımcılar birim koordinatlarla çalışır: u: 0-100 (sol→sağ), v: 0-100 (alt→üst)
// ==========================================================================

const W = 720, H = 380;
const X = (u) => 30 + (u / 100) * 660;
const Y = (v) => 344 - (v / 100) * 318;
const stroke = (u1, v1, u2, v2, color, o = {}) =>
  `<line x1="${X(u1).toFixed(1)}" y1="${Y(v1).toFixed(1)}" x2="${X(u2).toFixed(1)}" y2="${Y(v2).toFixed(1)}" stroke="${color}" stroke-width="${o.w || 1.4}" ${o.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linecap="round"/>`;
const poly = (pts, color, o = {}) => {
  const d = pts.map(([u, v], i) => `${i ? 'L' : 'M'}${X(u).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${o.w || 2}" ${o.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
};
const areaV = (u1, v1, u2, v2, fill, rx = 6) =>
  `<rect x="${X(u1).toFixed(1)}" y="${Y(v2).toFixed(1)}" width="${(X(u2) - X(u1)).toFixed(1)}" height="${(Y(v1) - Y(v2)).toFixed(1)}" rx="${rx}" fill="${fill}"/>`;
const rectU = (u1, v1, u2, v2, cls, rx = 6) =>
  `<rect class="${cls}" x="${X(u1).toFixed(1)}" y="${Y(v2).toFixed(1)}" width="${(X(u2) - X(u1)).toFixed(1)}" height="${(Y(v1) - Y(v2)).toFixed(1)}" rx="${rx}"/>`;
const label = (t, u, v, color = '#d9c68f', anchor = 'middle', size = 10.5) =>
  `<text class="scene-label" x="${X(u).toFixed(1)}" y="${Y(v).toFixed(1)}" text-anchor="${anchor}" fill="${color}" font-size="${size}" font-weight="700" font-family="Manrope, sans-serif">${t}</text>`;
const sub = (t, u, v, anchor = 'middle') =>
  `<text class="scene-sub" x="${X(u).toFixed(1)}" y="${Y(v).toFixed(1)}" text-anchor="${anchor}" fill="#8f89a3" font-size="9.3" font-family="Manrope, sans-serif">${t}</text>`;
const dot = (u, v, color, r = 3.6) =>
  `<circle cx="${X(u).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${r}" fill="${color}"/>`;
const candle = (u, o, h, l, c, w = 6.4) => {
  const up = c >= o;
  const col = up ? '#63d6a0' : '#e8707e';
  const yO = Y(o), yC = Y(c);
  return (
    `<line x1="${X(u).toFixed(1)}" y1="${Y(h).toFixed(1)}" x2="${X(u).toFixed(1)}" y2="${Y(l).toFixed(1)}" stroke="${col}" stroke-width="1.2"/>` +
    `<rect x="${(X(u) - w / 2).toFixed(1)}" y="${Math.min(yO, yC).toFixed(1)}" width="${w}" height="${Math.max(1.6, Math.abs(yC - yO)).toFixed(1)}" rx="0.9" fill="${col}"/>`
  );
};
const lcg = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** Noktalardan mum serisi üretir (şema fiyat yolu) */
function candlesPath(pts, seed = 3, spacing = 6.6, amp = 1.6) {
  const rnd = lcg(seed);
  let out = '';
  let open = pts[0][1];
  for (let s = 0; s < pts.length - 1; s++) {
    const [u1, v1] = pts[s], [u2, v2] = pts[s + 1];
    const dx = Math.abs(X(u2) - X(u1));
    const steps = Math.max(3, Math.round(dx / spacing));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const u = u1 + (u2 - u1) * t;
      const base = v1 + (v2 - v1) * t;
      const close = base + (rnd() - 0.5) * amp * 1.7;
      const o = open;
      const h = Math.max(o, close) + rnd() * amp;
      const l = Math.min(o, close) - rnd() * amp;
      out += candle(u, o, h, l, close);
      open = close;
    }
  }
  return out;
}

const GOLD = '#d9b45b', TEAL = '#63d6c4', GREEN = '#63d6a0', RED = '#e8707e', BLUE = '#8fb6e8';
const shell = (inner, bg = '') => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Şema">${bg}${inner}</svg>`;

export const SCENES = {};

/* ------------------------- Destek & Direnç ------------------------- */
SCENES.sr = () => shell(
  rectU(2, 61, 98, 65, 'scene-fill-down', 0) +
  rectU(2, 38, 98, 42, 'scene-fill-up', 0) +
  candlesPath([[6, 44], [15, 60], [22, 43], [31, 62], [40, 41], [49, 61], [58, 43], [68, 61], [78, 44], [90, 58]], 5) +
  stroke(2, 63, 98, 63, '#e8707e', { dash: true, w: 1.2 }) +
  stroke(2, 40, 98, 40, '#63d6a0', { dash: true, w: 1.2 }) +
  label('Direnç bölgesi — satıcılar burada güçlü', 50, 68, '#e8a0a8') +
  label('Destek bölgesi — alıcılar burada savunuyor', 50, 33, '#9fe3c2') +
  sub('Fiyat bölgelere her dokunuşunda tepki verir; en az 2-3 dokunuş bölgeyi güçlendirir', 50, 24)
);

/* ------------------------- Kanallar ------------------------- */
SCENES.channel = () => shell(
  stroke(4, 26, 92, 80, '#e8707e', { dash: true, w: 1.3 }) +
  stroke(4, 8, 92, 62, '#63d6a0', { dash: true, w: 1.3 }) +
  candlesPath([[8, 20], [18, 38], [26, 24], [36, 46], [44, 30], [54, 54], [62, 38], [72, 64], [80, 48], [88, 68]], 8) +
  label('Kanal direnci', 14, 84, '#e8a0a8') +
  label('Kanal desteği', 14, 3, '#9fe3c2') +
  sub('Fiyat iki paralel çizgi arasında salınır; kanal kırılırsa yön değişir', 50, 96)
);

/* ------------------------- Fibonacci Geri Çekilme ------------------------- */
SCENES.fib = () => shell(
  candlesPath([[6, 14], [30, 76], [44, 44], [60, 70]], 11) +
  stroke(4, 76, 74, 76, GOLD, { dash: true, w: 1 }) +
  stroke(4, 54, 74, 54, GOLD, { dash: true, w: 1 }) +
  stroke(4, 44, 74, 44, GOLD, { dash: true, w: 1 }) +
  stroke(4, 35, 74, 35, GOLD, { dash: true, w: 1 }) +
  stroke(4, 14, 74, 14, GOLD, { dash: true, w: 1 }) +
  label('0% (zirve) 76', 84, 76, '#d9c68f', 'start') +
  label('38.2% → 54', 84, 54, '#d9c68f', 'start') +
  label('50% → 44', 84, 44, '#d9c68f', 'start') +
  label('61.8% → 35', 84, 35, '#d9c68f', 'start') +
  label('100% (dip) 14', 84, 14, '#d9c68f', 'start') +
  areaV(4, 35, 58, 54, 'rgba(217,180,91,0.08)', 4) +
  sub('Geri çekilme en çok %38.2 – %61.8 arasında tutunur; %61.8 kırılırsa çekilme derinleşir', 50, 97)
);

/* ------------------------- Fibonacci Uzantı ------------------------- */
SCENES.fibext = () => shell(
  candlesPath([[6, 18], [24, 58], [34, 42], [52, 74], [70, 90]], 14) +
  stroke(4, 74, 64, 74, GOLD, { dash: true, w: 1 }) +
  stroke(46, 88, 96, 88, GOLD, { dash: true, w: 1 }) +
  stroke(46, 97, 96, 97, '#e8a0a8', { dash: true, w: 1 }) +
  label('1.0 → 74', 30, 77, '#d9c68f') +
  label('1.272 hedefi → 88', 74, 91, '#d9c68f') +
  label('1.618 hedefi → 97', 74, 99, '#e8a0a8') +
  sub('Uzantı seviyeleri kâr alma bölgesidir: fiyat sırayla 1.272 ve 1.618\'i test eder', 50, 6)
);

/* ------------------------- Pivot Noktaları ------------------------- */
SCENES.pivot = () => shell(
  candlesPath([[6, 48], [16, 60], [24, 40], [34, 58], [44, 38], [54, 56], [64, 42], [74, 58], [84, 44], [94, 52]], 21) +
  stroke(2, 80, 98, 80, '#c3c9d6', { dash: true, w: 1 }) +
  stroke(2, 66, 98, 66, '#c3c9d6', { dash: true, w: 1 }) +
  stroke(2, 52, 98, 52, GOLD, { w: 1.4 }) +
  stroke(2, 36, 98, 36, '#c3c9d6', { dash: true, w: 1 }) +
  stroke(2, 22, 98, 22, '#c3c9d6', { dash: true, w: 1 }) +
  label('R2 — 80', 6, 82, '#c3c9d6', 'start') +
  label('R1 — 66', 6, 68, '#c3c9d6', 'start') +
  label('Pivot (PP) — 52', 6, 49, '#f4e3a6', 'start') +
  label('S1 — 36', 6, 33, '#c3c9d6', 'start') +
  label('S2 — 22', 6, 19, '#c3c9d6', 'start') +
  sub('Seviyeler önceki günün (H+L+C)/3 hesabından gelir; PP üstü boğa, altı ayı sayılır', 50, 97)
);

/* ------------------------- Order Block ------------------------- */
SCENES.orderblock = () => shell(
  candlesPath([[8, 78], [26, 60], [31, 54]], 17) +
  rectU(28.6, 50, 33.4, 58, 'scene-fill-gold', 4) +
  candlesPath([[31, 54], [46, 64], [54, 58], [72, 84]], 23) +
  label('Son düşen mum → kurumların emir bloğu', 34, 44, '#d9c68f') +
  stroke(28.6, 50, 33.4, 50, GOLD, { dash: true, w: 1 }) +
  sub('Fiyat geri gelip bloğa dokunduğunda yükseliş hızlanır (talep bölgesi)', 50, 94) +
  sub('Düşüşten sonraki sert yükseliş, o bölgede büyük alıcı olduğunu gösterir', 50, 88)
);

/* ------------------------- FVG (Boşluk) ------------------------- */
SCENES.fvg = () => shell(
  candlesPath([[8, 38], [26, 56], [31, 72]], 29) +
  rectU(27, 58, 36, 68, 'scene-fill-gold', 4) +
  candlesPath([[31, 72], [46, 80], [56, 66], [62, 60]], 33) +
  label('FVG: mumların bıraktığı dengesiz boşluk', 46, 86, '#d9c68f') +
  stroke(27, 58, 36, 58, GOLD, { dash: true, w: 1 }) +
  stroke(27, 68, 36, 68, GOLD, { dash: true, w: 1 }) +
  sub('Boşluk genelde geri doldurulur; bölge destek gibi çalışır', 60, 52) +
  sub('Hedef: fiyat boşluğa döner, tepki verir, sonra trende devam eder', 50, 94)
);

/* ------------------------- Likidite & Stop Avı ------------------------- */
SCENES.liquidity = () => shell(
  candlesPath([[6, 42], [15, 58], [24, 44], [33, 59], [42, 45], [50, 58]], 37) +
  stroke(6, 59, 92, 59, GOLD, { dash: true, w: 1.2 }) +
  candlesPath([[50, 58], [56, 44], [60, 72]], 41) +
  candlesPath([[60, 72], [70, 52], [78, 34], [88, 40]], 43) +
  label('Eşit tepeler = likidite havuzu', 30, 64, '#d9c68f') +
  sub('1) Fiyat eşit tepelerin üstünü fitille süpürür (stop avı)', 30, 78) +
  sub('2) Alan kurumlar yukarıdaki stopları toplar, sonra sert aşağı çevirir', 52, 22) +
  sub('Yeni zirve gelmiyorsa "tuzak" ihtimali artar', 78, 14)
);

/* ------------------------- Tek Mum Formasyonları ------------------------- */
SCENES.candle1 = () => {
  let s = '';
  [33.3, 66.6].forEach((u) => (s += stroke(u, 4, u, 96, 'rgba(255,255,255,0.08)', { w: 1 })));
  // Çekiç
  s += candle(16, 62, 66, 30, 60, 16) + label('Çekiç (Pin Bar)', 16, 88, '#d9c68f') + sub('Uzun alt fitil: dip savunuldu', 16, 82) + sub('Yükseliş sinyali', 16, 24, '#9fe3c2');
  // Yutan boğa
  s += candle(46, 58, 62, 52, 54, 12) + candle(54, 52, 72, 50, 70, 14) + label('Yutan Boğa', 50, 88, '#d9c68f') + sub('Yeşil mum, öncekini tamamen yuttu', 50, 82) + sub('Alıcı kontrolü ele aldı', 50, 44, '#9fe3c2');
  // Doji
  s += candle(83, 54, 72, 36, 54, 12) + label('Doji', 83, 88, '#d9c68f') + sub('Kararsızlık: alıcı = satıcı', 83, 82) + sub('Trend sonlanabilir', 83, 28, '#e8a0a8');
  return shell(s);
};

/* ------------------------- Üç Mum Formasyonları ------------------------- */
SCENES.candle3 = () => {
  let s = '';
  s += stroke(50, 4, 50, 96, 'rgba(255,255,255,0.08)', { w: 1 });
  // Sabah yıldızı
  s += candle(10, 74, 78, 56, 58, 13) + candle(20, 54, 58, 46, 52, 11) + candle(30, 58, 82, 56, 80, 13);
  s += label('Sabah Yıldızı', 20, 90, '#d9c68f') + sub('Düşüş → kararsız mum → güçlü yeşil', 20, 84) + sub('Dip dönüşü sinyali', 20, 40, '#9fe3c2');
  // Akşam yıldızı
  s += candle(60, 34, 40, 30, 36, 13) + candle(70, 38, 46, 34, 40, 11) + candle(80, 40, 42, 16, 18, 13);
  s += label('Akşam Yıldızı', 70, 90, '#d9c68f') + sub('Yükseliş → kararsız mum → güçlü kırmızı', 70, 84) + sub('Tepe dönüşü sinyali', 70, 58, '#e8a0a8');
  return shell(s);
};

/* ------------------------- Sıkışma Formasyonları ------------------------- */
SCENES.patterns = () => {
  let s = '';
  s += stroke(50, 4, 50, 96, 'rgba(255,255,255,0.08)', { w: 1 });
  // Üçgen
  s += stroke(6, 74, 38, 56, '#e8707e', { dash: true, w: 1.2 }) + stroke(6, 26, 38, 48, '#63d6a0', { dash: true, w: 1.2 });
  s += candlesPath([[8, 40], [14, 62], [20, 36], [26, 58], [32, 44], [38, 52]], 53);
  s += candlesPath([[38, 52], [48, 70]], 57);
  s += label('Üçgen', 22, 86, '#d9c68f') + sub('Sıkışma → kırılım yönünde patlama', 22, 80);
  // Bayrak
  s += stroke(56, 30, 64, 66, '#d9c68f', { w: 1.2 }) + stroke(74, 30, 82, 66, '#d9c68f', { w: 1.2 });
  s += candlesPath([[64, 66], [68, 44], [72, 56], [76, 46], [80, 52]], 61);
  s += candlesPath([[80, 52], [92, 84]], 67);
  s += label('Bayrak / Flama', 72, 86, '#d9c68f') + sub('Direk + kısa dinlenme → devam', 72, 80);
  return shell(s);
};

/* ------------------------- Omuz-Baş-Omuz ------------------------- */
SCENES.hns = () => shell(
  candlesPath([[6, 30], [18, 54], [27, 40], [40, 76], [50, 38], [61, 54], [70, 32], [80, 36], [90, 16]], 71) +
  stroke(20, 38, 90, 38, GOLD, { dash: true, w: 1.2 }) +
  label('Sol omuz', 18, 62, '#d9c68f') +
  label('Baş', 40, 84, '#d9c68f') +
  label('Sağ omuz', 62, 62, '#d9c68f') +
  label('Boyun çizgisi', 34, 33, '#f4e3a6') +
  sub('Boyun çizgisi kırılırsa düşüş hedefi ≈ baş-boyun mesafesi kadar', 50, 8) +
  sub('Sağ omuzda hacim zayıflar → alıcıların tükendiğinin işareti', 50, 96)
);

/* ------------------------- İkili Dip / Tepe ------------------------- */
SCENES.double = () => {
  let s = '';
  s += stroke(50, 4, 50, 96, 'rgba(255,255,255,0.08)', { w: 1 });
  s += candlesPath([[8, 76], [20, 40], [32, 72], [44, 40], [56, 60]], 73);
  s += stroke(8, 40, 56, 40, '#63d6a0', { dash: true, w: 1.1 });
  s += candlesPath([[56, 60], [66, 82]], 79);
  s += label('İkili Dip', 34, 92, '#d9c68f') + sub('Dip çizgisi kırılınca alım teyidi', 34, 86) + sub('W formu — pozitif', 34, 24, '#9fe3c2');
  s += candlesPath([[62, 24], [72, 60], [82, 28], [92, 60]], 83);
  s += stroke(62, 60, 92, 60, '#e8707e', { dash: true, w: 1.1 });
  s += candlesPath([[92, 60], [97, 42]], 89);
  s += label('İkili Tepe', 82, 92, '#d9c68f') + sub('Tepe çizgisi kırılınca satış teyidi', 82, 86) + sub('M formu — negatif', 82, 18, '#e8a0a8');
  return shell(s);
};

/* ------------------------- Kırılım & Sahte Kırılım ------------------------- */
SCENES.breakout = () => shell(
  stroke(4, 64, 96, 64, GOLD, { dash: true, w: 1.2 }) +
  label('Direnç', 8, 68, '#d9c68f', 'start') +
  candlesPath([[8, 40], [20, 58], [30, 46], [40, 62]], 97) +
  candlesPath([[40, 62], [46, 72], [50, 56]], 101) +
  candlesPath([[50, 56], [58, 58], [64, 52]], 103) +
  candlesPath([[64, 52], [74, 76], [82, 70], [92, 88]], 107) +
  sub('1) İlk deneme fitille direnci aşar ama kapanış altında kalır = SAHTE kırılım (tuzak)', 50, 20) +
  sub('2) İkinci deneme güçlü mum + hacimle gelir = GERÇEK kırılım', 50, 12) +
  sub('Kırılımda hacim artmıyorsa şüphelen', 50, 4)
);

/* ------------------------- Elliott ------------------------- */
SCENES.elliott = () => {
  const pts = [[6, 18], [16, 46], [26, 32], [44, 76], [54, 60], [70, 88], [82, 62], [88, 70], [96, 44]];
  const names = ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C'];
  const off = [[0, -6], [0, 6], [0, -4], [0, 6], [0, -4], [0, 7], [0, -6], [0, 6], [0, -6]];
  let s = poly(pts, GOLD, { w: 2 });
  for (let i = 1; i < pts.length; i++) {
    s += dot(pts[i][0], pts[i][1], '#f4e3a6', 3.4);
    s += label(names[i], pts[i][0] + off[i][0], pts[i][1] + off[i][1], '#f4e3a6', 'middle', 11);
  }
  s += sub('İtki dalgası 1-2-3-4-5 · Düzeltme A-B-C', 50, 96);
  s += sub('3. dalga genelde en uzun ve en hacimli olandır; 2, 1\'in dibini geçmez', 50, 89);
  return shell(s);
};

/* ------------------------- Harmonik (XABCD) ------------------------- */
SCENES.harmonic = () => {
  const pts = [[6, 22], [26, 74], [40, 48], [56, 84], [72, 56]];
  const names = ['X', 'A', 'B', 'C', 'D'];
  let s = poly(pts, GOLD, { w: 2 });
  pts.forEach(([u, v], i) => { s += dot(u, v, '#f4e3a6', 3.6) + label(names[i], u, v + (i % 2 ? 7 : -6), '#f4e3a6', 'middle', 11); });
  s += sub('AB ≈ CD · B noktası A\'nın %61.8-78.6 geri çekilmesi', 50, 92);
  s += sub('D noktası = dönüş beklentisi · Stop: X\'in ötesi', 50, 85);
  s += stroke(72, 56, 96, 76, '#63d6a0', { dash: true, w: 1.3 });
  s += sub('D sonrası hedef: A-B-C bölgesi', 84, 62, '#9fe3c2');
  return shell(s);
};

/* ------------------------- Wyckoff ------------------------- */
SCENES.wyckoff = () => {
  let s = '';
  s += candlesPath([[6, 74], [16, 40]], 113);
  s += rectU(18, 38, 64, 58, 'scene-fill-gold', 5);
  s += candlesPath([[16, 40], [24, 56], [32, 40], [40, 52], [46, 34], [52, 50], [58, 40], [64, 56]], 127);
  s += candlesPath([[64, 56], [78, 86]], 131);
  const marks = [['PS', 14, 34, '#e8a0a8'], ['SC', 16, 30, '#e8a0a8'], ['AR', 24, 62, '#8fb6e8'], ['ST', 32, 34, '#8fb6e8'], ['Spring', 46, 26, '#63d6a0'], ['SOS', 66, 62, '#63d6a0']];
  marks.forEach(([t, u, v, c]) => (s += label(t, u, v, c, 'middle', 9.5)));
  s += sub('Toplama bölgesi: büyük oyuncular sessizce mal toplar, hacim kurur', 40, 96);
  s += sub('Spring: son bir dip avıyla stoplar toplanır → asıl yükseliş (SOS) başlar', 40, 89);
  return shell(s);
};

/* ------------------------- Market Profile / Hacim Profili ------------------------- */
SCENES.profile = () => {
  let s = '';
  s += candlesPath([[6, 40], [14, 62], [22, 44], [30, 66], [38, 48], [46, 60], [54, 50]], 137, 8, 1.2);
  const bars = [
    [20, 26], [24, 44], [28, 62], [32, 84], [36, 100], [40, 92], [44, 116], [48, 132], [52, 124],
    [56, 96], [60, 74], [64, 50], [68, 30], [72, 18],
  ];
  bars.forEach(([v, len]) => {
    const color = v === 56 ? GOLD : 'rgba(217,180,91,0.35)';
    s += `<rect x="${X(62).toFixed(1)}" y="${(Y(v + 1.6)).toFixed(1)}" width="${(len * 1.35).toFixed(1)}" height="${(Y(v - 1.6) - Y(v + 1.6)).toFixed(1)}" rx="2" fill="${color}"/>`;
  });
  s += stroke(62, 72, 98, 72, '#c3c9d6', { dash: true, w: 1 });
  s += stroke(62, 56, 98, 56, GOLD, { w: 1.3 });
  s += stroke(62, 34, 98, 34, '#c3c9d6', { dash: true, w: 1 });
  s += label('VAH — değer üst sınırı', 80, 76, '#c3c9d6') +
    label('POC — en çok işlem gören fiyat', 80, 52, '#f4e3a6') +
    label('VAL — değer alt sınırı', 80, 30, '#c3c9d6');
  s += sub('Fiyat POC üstündeyse alıcılar, altındaysa satıcılar güçlü sayılır', 50, 10);
  return shell(s);
};

/* ------------------------- ORB ------------------------- */
SCENES.orb = () => shell(
  rectU(6, 46, 30, 56, 'scene-fill-gold', 5) +
  candlesPath([[8, 50], [14, 54], [20, 47], [26, 52]], 139, 8, 1) +
  candlesPath([[30, 52], [42, 72], [50, 66], [62, 82]], 149) +
  stroke(6, 46, 92, 46, '#e8707e', { dash: true, w: 1.1 }) +
  label('Açılış aralığı (ilk 15-30 dk)', 18, 62, '#d9c68f') +
  label('Yukarı kırılım → ALIM', 48, 78, '#9fe3c2') +
  label('Stop: aralığın altı (46)', 60, 40, '#e8a0a8') +
  sub('Sadece ilk saatte değil, sonraki 1-2 saatte de taze kırılımlar izlenebilir', 50, 12)
);

/* ------------------------- Çoklu Zaman Dilimi ------------------------- */
SCENES.mtf = () => {
  let s = '';
  [33.3, 66.6].forEach((u) => (s += stroke(u, 6, u, 94, 'rgba(255,255,255,0.08)', { w: 1 })));
  s += candlesPath([[4, 40], [12, 60], [20, 50], [28, 70]], 151, 5, 1.3);
  s += candlesPath([[36, 30], [44, 48], [52, 42], [62, 62]], 157, 5, 1.3);
  s += candlesPath([[70, 26], [78, 44], [86, 38], [94, 58]], 163, 5, 1.3);
  s += label('1 Gün — ana yön YUKARI', 16, 82, '#9fe3c2', 'middle', 9.5);
  s += label('1 Saat — aynı yön', 49, 82, '#9fe3c2', 'middle', 9.5);
  s += label('15 Dk — giriş zamanı', 82, 82, '#d9c68f', 'middle', 9.5);
  s += sub('Üst zaman dilimi yönü, alt zaman diliminde alım noktası ararsın', 50, 92);
  s += sub('Zaman dilimleri çelişiyorsa (biri al, biri sat) işlem alma', 50, 8);
  return shell(s);
};

/* ------------------------- VIX / Korku Endeksi ------------------------- */
SCENES.vix = () => shell(
  poly([[6, 60], [30, 56], [44, 58], [58, 44], [72, 38], [86, 40]], GOLD, { w: 2 }) +
  poly([[16, 24], [30, 26], [44, 30], [52, 48], [58, 78], [64, 66], [72, 52], [86, 40]], BLUE, { w: 2 }) +
  label('Fiyat (sakin → düşüş)', 24, 66, '#f4e3a6', 'middle', 9.5) +
  label('VIX (korku) spike', 62, 86, '#8fb6e8', 'middle', 9.5) +
  dot(58, 78, BLUE, 4) +
  stroke(52, 24, 86, 24, 'rgba(255,255,255,0.12)', { dash: true, w: 1 }) +
  sub('Panik zirvesi (korkunun en yükseği) genelde fiyatın DİBİNE denk gelir', 50, 12) +
  sub('Korku sönerken (VIX düşerken) fiyat toparlanır — kontra gösterge', 50, 4)
);

export default SCENES;
