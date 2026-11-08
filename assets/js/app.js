// ==========================================================================
// app.js — İndikatör Akademi · Uygulama çekirdeği
// Hash router + ekranlar + localStorage ilerleme + navigasyon
// ==========================================================================
import { CATEGORIES, getCategory } from './data/categories.js';
import { DATA, ALL, TOTAL_COUNT, byId, listByCat } from './data/index.js';
import { renderChart } from './engine/charts.js';
import {
  lineChart, barChart, histogram, heatmap, histMedian,
  divColor, seqGold, seqBlue, fmtPct, fmtNum, fmtInt, yearTicks,
} from './engine/btcharts.js';

const $app = document.getElementById('app');

/* ------------------------------ ikonlar ------------------------------ */
const I = (inner, sw = 1.8) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  trend: I('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'),
  bolt: I('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>'),
  bars: I('<path d="M4 20V10M10 20V4M16 20v-8"/><path d="M2 20h20"/>'),
  waves: I('<path d="M2 10c2.5-4 4.5-4 7 0s4.5 4 7 0 4.5-4 6 0"/><path d="M2 17c2.5-4 4.5-4 7 0s4.5 4 7 0 4.5-4 6 0" opacity=".45"/>'),
  grid: I('<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>'),
  home: I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>'),
  chevL: I('<path d="M15 5l-7 7 7 7"/>'),
  chevR: I('<path d="M9 5l7 7-7 7"/>'),
  check: I('<path d="M4 12.5 9.5 18 20 6.5"/>'),
  eye: I('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  calc: I('<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M8 7h8"/><path d="M8 12h2M14 12h2M8 16.5h2M14 16.5h2"/>'),
  spark: I('<path d="M12 2.5l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>'),
};

const PLAY_ICONS = { up: '▲', down: '▼', sig: '✦', info: 'ℹ' };
const PLAY_LABELS = { up: 'Yüksek Taraf', down: 'Düşük Taraf', sig: 'Al / Sat Okuması', info: 'İpucu' };

/* ------------------------------ hafıza ------------------------------ */
const store = {
  read: safeParse('ia.read', {}),
  last: safeParse('ia.last', null),
  markRead(id) {
    if (!this.read[id]) {
      this.read[id] = 1;
      localStorage.setItem('ia.read', JSON.stringify(this.read));
    }
  },
  setLast(catId, indId) {
    this.last = { cat: catId, id: indId };
    localStorage.setItem('ia.last', JSON.stringify(this.last));
  },
  readCount(catId) {
    const list = catId ? listByCat(catId) : ALL;
    return list.filter((x) => this.read[x.id]).length;
  },
};

function safeParse(key, def) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : def;
  } catch {
    return def;
  }
}

/* ------------------------------ yardımcılar ------------------------------ */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const go = (hash) => { location.hash = hash; };

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (!h) return { name: 'home' };
  const parts = h.split('/');
  if (parts[0] === 'k' && parts[1]) return { name: 'category', cat: parts[1] };
  if (parts[0] === 'i' && parts[1] && parts[2]) return { name: 'indicator', cat: parts[1], id: parts[2] };
  if (parts[0] === 'bt' && parts[1]) return { name: 'backtest', id: parts[1] };
  return { name: 'home' };
}

/* ------------------------------ topbar / altbar ------------------------------ */
function topbar(parts, opts = {}) {
  return `
  <header class="topbar">
    <button class="topbar__back" data-nav="${opts.backHash || '#/'}" aria-label="Geri">${opts.backChevron || ICONS.chevL}</button>
    <div class="topbar__titles">
      ${parts.kicker ? `<div class="topbar__kicker">${esc(parts.kicker)}</div>` : ''}
      <div class="topbar__title">${esc(parts.title)}</div>
    </div>
    ${parts.meta ? `<div class="topbar__meta">${esc(parts.meta)}</div>` : ''}
  </header>`;
}

function bottomnav(catId, index) {
  const list = listByCat(catId);
  const prev = index > 0 ? list[index - 1] : null;
  const next = index < list.length - 1 ? list[index + 1] : null;
  return `
  <nav class="bottomnav">
    <button class="navbtn" data-nav="${prev ? `#/i/${catId}/${prev.id}` : ''}" ${prev ? '' : 'disabled'} aria-label="Önceki indikatör">
      ${ICONS.chevL}<span>Geri</span>
    </button>
    <button class="navbtn navbtn--home" data-nav="#/k/${catId}" aria-label="Listeye dön">${ICONS.home}</button>
    <button class="navbtn navbtn--primary" data-nav="${next ? `#/i/${catId}/${next.id}` : ''}" ${next ? '' : 'disabled'} aria-label="Sonraki indikatör">
      <span>İleri</span>${ICONS.chevR}
    </button>
  </nav>`;
}

/* ------------------------------ EV ------------------------------ */
function screenHome() {
  const readAll = store.readCount();
  const pct = Math.round((readAll / TOTAL_COUNT) * 100);
  const R = 27, C = (2 * Math.PI * R).toFixed(1);

  const cards = CATEGORIES.map((c, i) => {
    const total = listByCat(c.id).length;
    const read = store.readCount(c.id);
    return `
    <button class="cat-card anim" style="--tint:${hexA(c.accent, 0.1)}; --accent:${c.accent}; --d:${i * 70}ms" data-nav="#/k/${c.id}">
      <span class="cat-card__icon">${ICONS[c.icon]}</span>
      <span>
        <span class="cat-card__name">${esc(c.name)}</span>
        <span class="cat-card__desc" style="display:block">${esc(c.desc)}</span>
      </span>
      <span class="cat-card__side">
        <span class="cat-card__count">${read}/${total} okundu</span>
        <span class="cat-card__go">${ICONS.chevR}</span>
      </span>
    </button>`;
  }).join('');

  const resume = store.last && byId(store.last.id) ? `
    <button class="cat-card anim" style="--tint:rgba(217,180,91,.12); --accent:#d9b45b; --d:320ms" data-nav="#/i/${store.last.cat}/${store.last.id}">
      <span class="cat-card__icon">${ICONS.spark}</span>
      <span>
        <span class="cat-card__name">Kaldığın Yerden Devam</span>
        <span class="cat-card__desc" style="display:block">${esc(byId(store.last.id).name)} — bıraktığın sayfaya dön</span>
      </span>
      <span class="cat-card__side"><span class="cat-card__go">${ICONS.chevR}</span></span>
    </button>` : '';

  return `
  <div class="screen" data-enter>
    <div class="hero anim">
      <div class="hero__kicker">Teknik Analiz Eğitimi</div>
      <h1 class="hero__title">İndikatör<br>Akademi</h1>
      <svg class="hero__orn" viewBox="0 0 150 14" aria-hidden="true">
        <line x1="0" y1="7" x2="56" y2="7" stroke="#8a6f2f" stroke-width="1"/>
        <path d="M75 1.5 81.5 7 75 12.5 68.5 7z" fill="none" stroke="#d9b45b" stroke-width="1.2"/>
        <circle cx="75" cy="7" r="1.7" fill="#d9b45b"/>
        <line x1="94" y1="7" x2="150" y2="7" stroke="#8a6f2f" stroke-width="1"/>
      </svg>
      <p class="hero__sub">5 kategori · ${TOTAL_COUNT} indikatör. Her biri: bir cümlede ne olduğu, anotasyonlu örnek grafik ve nasıl yorumlanacağı.</p>
    </div>

    <div class="card progress-card anim" style="--d:80ms">
      <div class="progress-ring">
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="5"/>
          <circle cx="32" cy="32" r="${R}" fill="none" stroke="#d9b45b" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="${((pct / 100) * C).toFixed(1)} ${C}" transform="rotate(-90 32 32)"/>
        </svg>
        <span class="progress-ring__num">${pct}%</span>
      </div>
      <div class="progress-card__body">
        <div class="progress-card__title">${readAll} / ${TOTAL_COUNT} indikatör tamamlandı</div>
        <div class="progress-card__hint">${pct === 0 ? 'Bir kategori seç ve başla — her sayfa 1-2 dakika sürer.' : pct < 100 ? 'Güzel gidiyorsun, kaldığın yerden devam et.' : 'Hepsini bitirdin! Artık tekrar ederek pekiştir.'}</div>
      </div>
    </div>

    <div class="section-title anim" style="--d:140ms">Kategoriler<small>${CATEGORIES.length} alan</small></div>
    <div class="cat-grid">${cards}${resume}</div>

    <p class="footnote anim" style="--d:400ms">
      <strong>Eğitim amaçlıdır, yatırım tavsiyesi değildir.</strong><br>
      Grafikler gerçek formüllerle hesaplanmış örnek (sentetik) veriler üzerinde gösterilir.
    </p>
  </div>`;
}

/* ------------------------------ KATEGORİ ------------------------------ */
function screenCategory(catId) {
  const cat = getCategory(catId);
  const list = listByCat(catId);
  if (!cat || !list.length) return screenHome();

  const read = store.readCount(catId);
  const pct = Math.round((read / list.length) * 100);

  const rows = list.map((ind, i) => `
    <button class="ind-row anim ${store.read[ind.id] ? 'is-read' : ''}" style="--d:${Math.min(i * 35, 400)}ms" data-nav="#/i/${catId}/${ind.id}">
      <span class="ind-row__num">${i + 1}</span>
      <span class="ind-row__body">
        <span class="ind-row__name">${esc(ind.name)} ${ind.full ? `<span style="color:var(--faint);font-weight:600;font-size:11.5px">· ${esc(ind.full)}</span>` : ''}</span>
        <span class="ind-row__hint">${esc(ind.one)}</span>
      </span>
      <span class="ind-row__check">${ICONS.check}</span>
    </button>`).join('');

  return `
  ${topbar({ kicker: 'Kategori', title: cat.name, meta: `${read}/${list.length}` }, { backHash: '#/', backChevron: ICONS.home })}
  <div class="screen" data-enter style="--accent:${cat.accent}">
    <div class="cat-head anim">
      <span class="cat-head__icon" style="--accent:${cat.accent}">${ICONS[cat.icon]}</span>
      <div>
        <h2 class="cat-head__name">${esc(cat.name)}</h2>
        <p class="cat-head__desc">${esc(cat.desc)}</p>
      </div>
    </div>
    <div class="card cat-progress anim" style="--d:60ms">
      <div class="cat-progress__bar"><div class="cat-progress__fill" style="width:${pct}%; background:${cat.accent}"></div></div>
      <div class="cat-progress__text" style="color:${cat.accent}">${read}/${list.length} okundu</div>
    </div>
    <div class="ind-list">${rows}</div>
  </div>`;
}

/* ------------------------------ İNDİKATÖR ------------------------------ */
function screenIndicator(catId, indId) {
  const cat = getCategory(catId);
  const list = listByCat(catId);
  const index = list.findIndex((x) => x.id === indId);
  const ind = list[index];
  if (!cat || !ind) return screenHome();

  store.markRead(ind.id);
  store.setLast(catId, ind.id);

  const chart = renderChart(ind.chart || {});
  const legend = dedupeLegend(chart.legend);
  const notes = chart.notes || [];

  const legendHtml = legend.length ? `
    <div class="legend">${legend.map((l) => {
      const clean = (s) => String(s).replace(/\s+/g, '').toLowerCase();
      const showOwner = l.owner && clean(l.owner) !== clean(l.label) && clean(l.owner) !== clean(l.label).replace(/[()]/g, '');
      return `
      <span class="legend__item">
        <span class="legend__swatch" style="${l.kind === 'bar' ? 'width:10px;height:10px;border-radius:3px;' : l.kind === 'dot' ? 'width:9px;height:9px;border-radius:50%;' : ''}background:${l.color};${l.dash ? 'background:repeating-linear-gradient(90deg,' + l.color + ' 0 4px,transparent 4px 7px);' : ''}"></span>
        ${esc(l.label)}${showOwner ? ` <span style="color:var(--faint)">· ${esc(l.owner)}</span>` : ''}
      </span>`;
    }).join('')}
    </div>` : '';

  const notesHtml = notes.length ? `
    <div class="notes">${notes.map((n) => `
      <div class="note-item anim">
        <span class="note-item__num">${n.num != null ? n.num : '◆'}</span>
        <span class="note-item__text">${esc(n.text)}</span>
      </div>`).join('')}
    </div>` : '';

  const playHtml = (ind.play || []).map((p) => `
    <div class="play-item play-item--${p.t}">
      <span class="play-item__icon">${PLAY_ICONS[p.t] || 'ℹ'}</span>
      <span>
        <div class="play-item__label">${esc(p.l || PLAY_LABELS[p.t] || '')}</div>
        <div class="play-item__text">${esc(p.x)}</div>
      </span>
    </div>`).join('');

  const pairs = (ind.pairs || []).map((pid) => byId(pid)).filter(Boolean);
  const pairsHtml = pairs.length ? `
    <div class="pairs">${pairs.map((p) => `
      <button class="chip" data-nav="#/i/${p.cat}/${p.id}">${ICONS.spark}${esc(p.name)}</button>`).join('')}
    </div>` : '';

  return `
  ${topbar({ kicker: cat.name, title: ind.name, meta: `${index + 1}/${list.length}` }, { backHash: `#/k/${catId}` })}
  <div class="screen screen--wide" data-enter style="--accent:${cat.accent}">
    <div class="ind-hero anim">
      <span class="ind-hero__cat" style="--accent:${cat.accent}">${esc(cat.name)} · ${index + 1}/${list.length}</span>
      <h1 class="ind-hero__name">${esc(ind.name)}</h1>
      <div class="ind-hero__sub">${esc(ind.full || '')}</div>
    </div>

    <div class="tldr anim" style="--d:60ms">
      <div class="tldr__label">Bir Cümlede</div>
      <div class="tldr__text">${esc(ind.one)}</div>
    </div>

    <div class="info-grid">
      <div class="card info-card anim" style="--d:120ms">
        <div class="info-card__title">${ICONS.eye} Ne Gösterir?</div>
        <ul>${(ind.shows || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div class="card info-card anim" style="--d:170ms">
        <div class="info-card__title">${ICONS.calc} Nasıl Hesaplanır?</div>
        <div class="formula">
          ${(ind.calc || []).map((c) => `<code>${esc(c)}</code>`).join('')}
          ${ind.calcNote ? `<p>${esc(ind.calcNote)}</p>` : ''}
        </div>
      </div>
    </div>

    <div class="section-title anim" style="--d:220ms">Örnek Grafik<small>${ind.chart?.diagram ? 'şema' : 'gerçek formülle'}</small></div>
    <div class="chart-notes-grid">
      <div class="card chart-card anim" style="--d:240ms">
        <div class="chart-wrap">${chart.svg}</div>
        ${legendHtml}
      </div>
      ${notesHtml}
    </div>

    <div class="section-title anim" style="--d:280ms">Nasıl Yorumlarsın?<small>karar & tuzak</small></div>
    <div class="card play-card anim" style="--d:300ms">${playHtml}</div>

    ${pairs.length ? `
      <div class="section-title anim" style="--d:340ms">İyi Çalıştığı İndikatörler<small>çapraz teyit</small></div>
      <div class="pairs anim" style="--d:360ms; margin-top:0">${pairs.map((p) => `
        <button class="chip" data-nav="#/i/${p.cat}/${p.id}">${ICONS.spark}${esc(p.name)}</button>`).join('')}</div>` : ''}

    <div class="section-title anim" style="--d:380ms">Gerçek Veriyle Test<small>525 kripto · 2022-2026</small></div>
    <button class="bt-cta anim" style="--d:400ms" data-nav="#/bt/${ind.id}">
      <span class="bt-cta__icon">${ICONS.bars}</span>
      <span class="bt-cta__body">
        <span class="bt-cta__title">Backtest Sonuçlarını Gör</span>
        <span class="bt-cta__badge" id="bt-badge">sonuçlar yükleniyor…</span>
      </span>
      <span class="bt-cta__go">${ICONS.chevR}</span>
    </button>

    <div class="swipe-hint">${ICONS.chevL} kaydır veya alttaki butonları kullan ${ICONS.chevR}</div>

    <p class="footnote">Örnek grafikler sentetik veriyle üretilmiş eğitim materyalidir; gerçek piyasa görüntüsü değildir.<br>Yatırım tavsiyesi içermez.</p>
  </div>
  ${bottomnav(catId, index)}`;
}

function dedupeLegend(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.label + '|' + it.color + '|' + it.kind + '|' + (it.owner || '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.slice(0, 8);
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------ BACKTEST ------------------------------ */

const BT = { id: null, data: null, index: null, tf: null, metric: 'avg', topN: 24 };
let heatToastTimer = 0;
const BT_ORDER = ['5m', '15m', '1h', '4h', '1d', '1w'];
const BT_COLORS = { '5m': '#d9b45b', '15m': '#7fd1b9', '1h': '#6fa8ff', '4h': '#e08ff0', '1d': '#ff9f6f', '1w': '#9fb3c8' };
const BT_DIR = { long: 'SADECE LONG', ls: 'İKİ YÖN (L/S)' };
const clamp01 = (v) => Math.max(-1, Math.min(1, v || 0));

let btIndexPromise = null;
function loadBTIndex() {
  if (!btIndexPromise) {
    btIndexPromise = fetch('assets/bt/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return btIndexPromise;
}

function hydrateBTBadge(id) {
  const el = document.getElementById('bt-badge');
  if (!el) return;
  loadBTIndex().then((idx) => {
    if (!el.isConnected) return;
    const row = idx && idx.ids ? idx.ids[id] : null;
    if (row) {
      el.textContent = `En iyi dilim: ${row.best} · toplam ${fmtPct(row.tot)} · kazanma %${Math.round(row.wr * 100)} · ${fmtInt(row.n)} işlem`;
      el.classList.add('is-ready');
    } else {
      el.textContent = 'şu an bu cihazda üretilmemiş — yine de tıkla, kuralı gör';
    }
  });
}

function backtestLoading(id) {
  const ind = byId(id);
  const cat = ind ? getCategory(ind.cat) : null;
  return `${topbar({ kicker: 'Backtest', title: ind ? ind.name : id, meta: cat ? cat.name : '' }, { backHash: ind ? `#/i/${ind.cat}/${id}` : '#/' })}
  <div class="screen screen--wide">
    <div class="bt-loading"><div class="bt-spinner"></div><span>Gerçek piyasa verisiyle backtest sonuçları yükleniyor…</span></div>
  </div>`;
}

function backtestMissing(id) {
  const ind = byId(id);
  const cat = ind ? getCategory(ind.cat) : null;
  return `${topbar({ kicker: 'Backtest', title: ind ? ind.name : id, meta: cat ? cat.name : '' }, { backHash: ind ? `#/i/${ind.cat}/${id}` : '#/' })}
  <div class="screen screen--wide">
    <div class="card bt-empty">
      <div class="bt-empty__title">Backtest henüz üretilmedi</div>
      <p>Bu indikatörün gerçek veri testi bulunamadı. Yerel sunucuda şu komutla üretilir:</p>
      <code>node tools/bt/run.mjs</code>
      <p class="bt-empty__hint">Sonuçlar <code>assets/bt/*.json</code> olarak yazılır ve bu ekran otomatik dolar.</p>
    </div>
  </div>`;
}

async function loadBacktest(id) {
  try {
    const [idx, res] = await Promise.all([loadBTIndex(), fetch(`assets/bt/${id}.json`)]);
    if (!res.ok) throw new Error('yok');
    const data = await res.json();
    if (BT.id !== id) return;
    BT.index = idx; BT.data = data; BT.tf = null;
    paintBacktest();
  } catch {
    if (BT.id !== id) return;
    $app.innerHTML = backtestMissing(id);
  }
}

function paintBacktest() {
  const id = BT.id;
  const data = BT.data;
  if (!data) return;
  const ind = byId(id);
  const cat = ind ? getCategory(ind.cat) : null;
  const meta = data.meta || {};
  const strategy = {
    title: data.title, dir: data.dir, rules: data.rules,
    stopText: data.stopText, skipTfs: data.skipTfs, caveat: data.caveat,
  };
  const tfs = meta.tfs || BT_ORDER;
  const skip = strategy.skipTfs || [];
  if (!BT.tf || !(data.sum && data.sum[BT.tf])) {
    BT.tf = tfs.find((t) => data.sum && data.sum[t]) || tfs[0];
  }
  const tf = BT.tf;
  const sum = data.sum ? data.sum[tf] : null;
  const gridStart = meta.gridStart || (BT.index && BT.index.grid && BT.index.grid.start) || 0;
  const gridN = (BT.index && BT.index.grid && BT.index.grid.n) || ((data.eq && data.eq[tf] && data.eq[tf].length) || 215);
  const step = meta.gridStepMs || 604800000;

  /* ---- KPI ---- */
  const med = data.hist && data.hist[tf] ? histMedian(data.hist[tf]) : null;
  const kpi = (label, value, sub, tone = '') => `
    <div class="kpi ${tone}">
      <div class="kpi__label">${label}</div>
      <div class="kpi__value">${value}</div>
      ${sub ? `<div class="kpi__sub">${sub}</div>` : ''}
    </div>`;
  const kpis = sum ? `
    ${kpi('İşlem Sayısı', fmtInt(sum.n), `${sum.nsym} sembolde test edildi`)}
    ${kpi('Kazanma Oranı', `%${(sum.wr * 100).toFixed(1)}`, `sembollerin %${Math.round(sum.pos * 100)}'i kârlı`, sum.wr >= 0.5 ? 'ok' : '')}
    ${kpi('İşlem Başına Ort.', fmtPct(sum.avg), med != null ? `medyan işlem ~${med.toFixed(2)}%` : '', sum.avg > 0 ? 'ok' : 'bad')}
    ${kpi('Profit Factor', fmtNum(sum.pf), 'toplam kazanç ÷ kayıp', sum.pf >= 1 ? 'ok' : 'bad')}
    ${kpi('Maks. Düşüş', fmtPct(sum.dd), `en iyi tek işlem ${fmtPct(sum.best)}`, '')}
    ${kpi('Portföy Getirisi', fmtPct(sum.tot), 'sembol başına ort., bileşik', sum.tot > 0 ? 'ok' : 'bad')}
  ` : '<div class="bt-empty-line">Bu dilimde yeterli işlem yok.</div>';

  /* ---- Zaman dilimi çipleri ---- */
  const tfChips = tfs.map((t) => {
    const s = data.sum ? data.sum[t] : null;
    const isSkip = skip.includes(t);
    const active = t === tf && s;
    if (s) return `<button class="bt-chip ${active ? 'is-active' : ''}" data-bt-tf="${t}">${t}<small>${fmtInt(s.n)} işlem</small></button>`;
    return `<button class="bt-chip is-off" disabled title="${isSkip ? 'Bu dilimde kullanımı anlamsız — test dışı' : 'Yeterli işlem üretilemedi'}">${t}<small>${isSkip ? 'anlamsız' : '—'}</small></button>`;
  }).join('');

  /* ---- Pano ölçüsü: telefonda daha büyük yazı, geniş ekranda ince detay ---- */
  const screenW = (typeof window !== 'undefined' && window.innerWidth) || 1024;
  const CW = screenW < 640 ? 400 : 680;

  /* ---- Portföy eğrisi ---- */
  const lastT = gridStart + (gridN - 1) * step;
  const eqSeries = tfs.filter((t) => data.eq && data.eq[t]).map((t) => ({
    name: t,
    color: BT_COLORS[t] || '#d9b45b',
    width: t === tf ? 2.2 : 1.1,
    opacity: t === tf ? 1 : 0.45,
    endLabel: t === tf,
    pts: data.eq[t].map((v, i) => [gridStart + i * step, v]),
  })).sort((a, b) => (a.name === tf ? 1 : 0) - (b.name === tf ? 1 : 0));
  const eqSvg = lineChart({
    series: eqSeries, w: CW, h: screenW < 640 ? 220 : 250,
    xTicks: yearTicks(gridStart, lastT),
    yFormat: (v) => fmtNum(v, 1) + '×',
    zeroLine: 1,
    endLabelFmt: (v) => fmtNum(v, 2) + '×',
  });
  const eqLegend = tfs.map((t) => `
    <button class="legend-btn ${t === tf ? 'is-active' : ''}" ${data.eq && data.eq[t] ? `data-bt-tf="${t}"` : 'disabled'} style="--c:${BT_COLORS[t] || '#d9b45b'}">
      <span class="legend-btn__dot"></span>${t}
    </button>`).join('');

  /* ---- TF karşılaştırma ---- */
  const sumTfs = tfs.filter((t) => data.sum && data.sum[t]);
  const avgScale = Math.max(1e-4, ...sumTfs.map((t) => Math.abs(data.sum[t].avg)));
  const barSvg = barChart({
    w: CW, h: 200,
    yFormat: (v) => (v * 100).toFixed(1) + '%',
    items: sumTfs.map((t) => ({
      label: t, value: data.sum[t].avg, sub: `${fmtInt(data.sum[t].n)}`,
      color: divColor(clamp01(data.sum[t].avg / avgScale) * 0.9),
      active: t === tf, tf: t,
    })),
  });

  /* ---- Histogram ---- */
  const bins = (data.hist && data.hist[tf]) || [];
  const histSvg = bins.length ? histogram({ bins, w: CW, h: 200 }) : '';
  let winners = bins[81] || 0, losers = bins[80] || 0;
  for (let k = 0; k < 80; k++) { const mid = -10 + (k + 0.5) * 0.25; if (mid >= 0) winners += bins[k]; else losers += bins[k]; }

  /* ---- Yıllar ---- */
  const years = Object.keys((data.years && data.years[tf]) || {}).sort();
  const yRet = years.map((y, i) => ({ label: y, value: data.years[tf][y][0], sub: `${fmtInt(data.years[tf][y][2])}`, tf: '' }));
  const yrScale = Math.max(0.02, ...yRet.map((i) => Math.abs(i.value)));
  yRet.forEach((i) => { i.color = divColor(clamp01(i.value / yrScale) * 0.9); });
  const yearBarSvg = years.length ? barChart({ items: yRet, w: CW, h: 185, yFormat: (v) => (v * 100).toFixed(0) + '%' }) : '';
  const wrSvg = years.length ? lineChart({
    series: [{ name: 'Kazanma', color: '#7fd1b9', width: 2, pts: years.map((y, i) => [i, data.years[tf][y][1]]) }],
    xTicks: years.map((y, i) => ({ x: i, label: y })),
    yFormat: (v) => Math.round(v * 100) + '%',
    yMin: 0, yMax: 1, w: CW, h: 185,
  }) : '';

  /* ---- Isı haritası ---- */
  const syms = (BT.index && BT.index.symbols) || [];
  const heat = data.heat || {};
  let nMax = 1, ddMax = 1, bhMax = 1;
  for (const t of tfs) {
    const h = heat[t];
    if (!h) continue;
    for (const s of syms) {
      if (h.n && h.n[s] > nMax) nMax = h.n[s];
      if (h.dd && h.dd[s] != null && Math.abs(h.dd[s]) > ddMax) ddMax = Math.abs(h.dd[s]);
      if (h.bh && h.bh[s] != null && Math.abs(h.bh[s]) > bhMax) bhMax = Math.abs(h.bh[s]);
    }
  }
  const METRICS = {
    avg: { label: 'Ort. Getiri %', cell: (v) => (v == null ? '–' : (v * 100).toFixed(1)), color: (v) => divColor(clamp01(v / avgScale) * 0.95) },
    wr: { label: 'Kazanma %', cell: (v) => (v == null ? '–' : Math.round(v * 100)), color: (v) => seqGold(v == null ? null : (v - 0.4) / 0.4) },
    n: { label: 'İşlem', cell: (v) => (v == null ? '–' : fmtInt(v)), color: (v) => seqBlue(v == null ? null : Math.pow(v / nMax, 0.6)) },
    dd: { label: 'Maks. Düşüş', cell: (v) => (v == null ? '–' : (v * 100).toFixed(0)), color: (v) => divColor(v == null ? null : clamp01(v / ddMax)) },
    pf: { label: 'Profit Factor', cell: (v) => (v == null ? '–' : fmtNum(v, 2)), color: (v) => divColor(v == null ? null : clamp01((v - 1) / 1.5)) },
    bh: { label: 'Al-Tut %', cell: (v) => (v == null ? '–' : (v * 100).toFixed(0)), color: (v) => divColor(v == null ? null : clamp01(v / bhMax) * 0.8) },
  };
  const mdef = METRICS[BT.metric] || METRICS.avg;
  const cellTitle = (sym, t) => {
    const c = (k) => (heat[t] && heat[t][k] ? heat[t][k][sym] : null);
    if (c('n') == null) return `${sym} · ${t}: veri yok`;
    return `${sym} · ${t} — işlem başına ort ${fmtPct(c('avg'))} · kazanma ${c('wr') == null ? '—' : '%' + Math.round(c('wr') * 100)} · ${fmtInt(c('n'))} işlem · maksDD ${fmtPct(c('dd'))} · PF ${fmtNum(c('pf'))} · al-tut ${fmtPct(c('bh'))}`;
  };
  const rowVals = syms.map((s) => ({ sym: s, v: heat[tf] && heat[tf][BT.metric] ? heat[tf][BT.metric][s] : null }));
  rowVals.sort((a, b) => (b.v == null ? -Infinity : b.v) - (a.v == null ? -Infinity : a.v));
  const rowsShown = BT.topN === 'all' ? rowVals : rowVals.slice(0, BT.topN);
  const heatSvg = syms.length ? heatmap({
    rows: rowsShown.map(({ sym }) => ({
      label: sym.replace('USDT', ''),
      cells: tfs.map((t) => {
        const v = heat[t] && heat[t][BT.metric] ? heat[t][BT.metric][sym] : null;
        return { v, text: mdef.cell(v), title: cellTitle(sym, t) };
      }),
    })),
    cols: tfs.map((t) => ({ id: t, label: t })),
    colorFn: (v) => mdef.color(v),
    cw: 58, ch: 22, activeCol: tf,
  }) : '';
  const metChips = Object.entries(METRICS).map(([k, m]) => `
    <button class="bt-chip bt-chip--sm ${BT.metric === k ? 'is-active' : ''}" data-bt-met="${k}">${m.label}</button>`).join('');
  const LEGENDS = {
    avg: { txt: 'kırmızı: negatif getiri · yeşil: pozitif getiri', cls: '' },
    wr: { txt: 'soluk: düşük kazanma · altın: yüksek kazanma', cls: ' bt-heat-legend__grad--gold' },
    n: { txt: 'soluk: az işlem · mavi: çok işlem', cls: ' bt-heat-legend__grad--blue' },
    dd: { txt: 'kırmızı: derin düşüş · yeşil: sığ düşüş', cls: '' },
    pf: { txt: 'kırmızı: PF 1 altı · yeşil: PF yüksek', cls: '' },
    bh: { txt: 'kırmızı: kayıp · yeşil: kazanç', cls: '' },
  };
  const legend = LEGENDS[BT.metric] || LEGENDS.avg;
  const rowChips = `
    <button class="bt-chip bt-chip--sm ${BT.topN !== 'all' ? 'is-active' : ''}" data-bt-top="24">İlk 24</button>
    <button class="bt-chip bt-chip--sm ${BT.topN === 'all' ? 'is-active' : ''}" data-bt-top="all">Tüm ${syms.length}</button>`;

  const skipNote = skip.length ? `<p class="bt-skipnote">Test dışı dilimler: <strong>${skip.join(', ')}</strong> — bu indikatörün kullanımı o dilimde kavramsal olarak anlamsız.</p>` : '';

  /* ---- Grafik başlıklarının altındaki "nasıl okunur" ipuçları ---- */
  const HINT_IC = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor"/></svg>';
  const hint = (t) => `<div class="panel__hint">${HINT_IC}<span>${t}</span></div>`;

  const t0 = gridStart ? new Date(gridStart) : null;
  const t1 = gridStart ? new Date(lastT) : null;
  const ymd = (d) => (d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : '');

  $app.innerHTML = `
  ${topbar({ kicker: 'Backtest · Gerçek Veri', title: ind ? ind.name : id, meta: cat ? cat.name : '' }, { backHash: ind ? `#/i/${ind.cat}/${id}` : '#/' })}
  <div class="screen screen--wide bt-screen" data-enter>
    <div class="bt-head anim">
      <h1 class="bt-head__title">${esc(strategy.title || (ind ? ind.name : id))}</h1>
      <div class="bt-head__sub">
        <span class="bt-pill bt-pill--dir">${BT_DIR[strategy.dir] || ''}</span>
        <span class="bt-pill">${meta.symbols || '?'} sembol</span>
        <span class="bt-pill">${ymd(t0)} → ${ymd(t1)}</span>
        <span class="bt-pill">komisyon + kayma + funding</span>
      </div>
    </div>

    <div class="card bt-strategy anim">
      <div class="bt-strategy__head">
        <span class="bt-strategy__title">Bu test nasıl yapıldı?</span>
        <span class="bt-strategy__stop">Stop: ${esc(strategy.stopText || 'Yok')}</span>
      </div>
      <ol class="bt-rules">${(strategy.rules || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
      ${strategy.caveat ? `<p class="bt-caveat">⚠︎ ${esc(strategy.caveat)}</p>` : ''}
      <p class="bt-method">Sinyal mum kapanışında üretilir, emir sonraki mumun açılışında uygulanır. Taker %0,04 + 1bp kayma her bacakta; 8 saatlik gerçek funding dahil; kaldıraç yok (1×). Her işlem sermayenin tamamıyla (eşit ağırlık) yapılır. Yeni listelenen paritelerin ilk saatleri aşırı oynak olabilir (tek işlemde +1000% görülebilir); bu yüzden işlem başına <strong>medyan</strong>, ortalamadan daha temsildir.</p>
    </div>

    <div class="section-title anim" style="--d:60ms">Zaman Dilimi<small>tıkla, tüm paneller o dilime göre yenilenir</small></div>
    <div class="bt-tfbar anim" style="--d:80ms">${tfChips}</div>
    ${skipNote}

    <div class="bt-kpis anim" style="--d:120ms">${kpis}</div>

    <div class="bt-grid">
      <div class="card panel panel--wide anim" style="--d:160ms">
        <div class="panel__title">Eşit Ağırlıklı Portföy Eğrisi<small>1× = başlangıç sermayesi · ${tf} kalın çizgi</small></div>
        ${hint('Çizgi yükseliyorsa strateji o dönem kazandırmış. <strong>1× altı zarar</strong>, üstü kâr demek. Uçtaki rozet seçili dilimin son değerini gösterir.')}
        ${eqSvg}
        <div class="bt-legend">${eqLegend}</div>
      </div>

      <div class="card panel anim" style="--d:200ms">
        <div class="panel__title">Dilim Karşılaştırması<small>işlem başına ort. getiri</small></div>
        ${hint('Bar sıfırın üstündeyse o dilim ortalama kazandırmış; altındaysa kaybettirmiş. Üstteki değer ortalamayı, alttaki sayı işlem adedini gösterir.')}
        ${barSvg}
      </div>

      <div class="card panel anim" style="--d:220ms">
        <div class="panel__title">İşlem Getiri Dağılımı<small>${tf} · tüm işlemler</small></div>
        ${hint('Sağdaki yeşil bölge kazançlı, soldaki kırmızı bölge zararlı işlemler. <strong>Kesikli çizgi medyanı</strong> — yani tipik işlemi — gösterir.')}
        ${histSvg || '<div class="bt-empty-line">Veri yok.</div>'}
        <div class="panel__foot">kazanan <strong class="ok">${fmtInt(winners)}</strong> · kaybeden <strong class="bad">${fmtInt(losers)}</strong>${med != null ? ` · medyan işlem ~${med.toFixed(2)}%` : ''}</div>
      </div>

      <div class="card panel anim" style="--d:240ms">
        <div class="panel__title">Yıllara Göre Getiri<small>${tf} · bileşik</small></div>
        ${hint('Her yılın toplam getirisi. Yükselen yıllar stratejinin o dönemde işe yaradığını gösterir.')}
        ${yearBarSvg || '<div class="bt-empty-line">Veri yok.</div>'}
      </div>

      <div class="card panel anim" style="--d:260ms">
        <div class="panel__title">Yıllara Göre Kazanma<small>${tf}</small></div>
        ${hint('O yıl işlemlerin yüzde kaçı kazançla kapandı. %50 üstü çoğunlukla kazanan işlem demek.')}
        ${wrSvg || '<div class="bt-empty-line">Veri yok.</div>'}
      </div>
    </div>

    <div class="card panel bt-summary anim" style="--d:280ms">
      <div class="panel__title">${tf} Dilimi Özeti<small>uç değerler</small></div>
      <div class="bt-summary__row">
        <span>En başarılı sembol</span><strong>${sum && sum.top ? `${esc(sum.top[0].replace('USDT', ''))} · ${fmtPct(sum.top[1])}` : '—'}</strong>
        <span>En zayıf sembol</span><strong>${sum && sum.bot ? `${esc(sum.bot[0].replace('USDT', ''))} · ${fmtPct(sum.bot[1])}` : '—'}</strong>
        <span>Ortalama tutma</span><strong>${sum ? fmtNum(sum.bars, 1) + ' mum' : '—'}</strong>
        <span>En iyi / kötü işlem</span><strong>${sum ? `${fmtPct(sum.best)} / ${fmtPct(sum.worst)}` : '—'}</strong>
        <span>Dalgalanma (std)</span><strong>${sum ? fmtPct(sum.sd) : '—'}</strong>
      </div>
    </div>

    <div class="section-title anim" style="--d:300ms">Sembol × Zaman Dilimi<small>ısı haritası — dilim başlığına tıkla: sütun seçilir · hücreye dokun: detay</small></div>
    <div class="bt-metbar anim" style="--d:310ms">${metChips}<span class="bt-metbar__sep"></span>${rowChips}</div>
    ${hint('Her hücre bir sembolün o dilimdeki sonucunu gösterir. Üzerine gel, ya da telefonda <strong>hücreye dokun</strong> — istatistikler aşağıdaki kutuda açılır.')}
    <div class="card bt-heat-wrap anim" style="--d:330ms">${heatSvg || '<div class="bt-empty-line">Veri yok.</div>'}
      <div class="bt-heat-legend"><span class="bt-heat-legend__grad${legend.cls}"></span> ${legend.txt} · renkler seçili metriğe göre</div>
    </div>
    <div class="bt-heat-detail anim" id="bt-heat-detail" style="--d:340ms"><span class="bt-heat-detail__idle">Dokunduğun hücrenin detayı burada görünür.</span></div>
    <div class="bt-toast" id="bt-toast" role="status" aria-live="polite"></div>

    <p class="footnote anim" style="--d:360ms">
      Bu backtest eğitim amaçlı istatistiksel bir simülasyondur; emir defteri derinliği, likidite ve gerçek kayma koşullarını tam yansıtmaz.<br>
      Sonuçlar ${data.gen || ''} tarihinde ${meta.symbols || '?'} sembolün Binance USDT-M verisiyle üretilmiştir. <strong>Geçmiş performans gelecek getiriyi garanti etmez — yatırım tavsiyesi değildir.</strong>
    </p>
  </div>`;
}

/* ------------------------------ render & olaylar ------------------------------ */
let currentCat = null;

function render() {
  const route = parseRoute();
  currentCat = route.cat || null;

  if (route.name === 'home') {
    document.title = 'İndikatör Akademi';
    $app.innerHTML = screenHome();
  } else if (route.name === 'category') {
    const cat = getCategory(route.cat);
    document.title = `İndikatör Akademi — ${cat ? cat.name : ''}`;
    $app.innerHTML = screenCategory(route.cat);
  } else if (route.name === 'backtest') {
    const ind = byId(route.id);
    document.title = ind ? `İndikatör Akademi — ${ind.name} · Backtest` : 'İndikatör Akademi';
    BT.id = route.id; BT.data = null; BT.index = null; BT.tf = null;
    $app.innerHTML = backtestLoading(route.id);
    loadBacktest(route.id);
  } else {
    const ind = byId(route.id);
    document.title = ind ? `İndikatör Akademi — ${ind.name}` : 'İndikatör Akademi';
    $app.innerHTML = screenIndicator(route.cat, route.id);
    hydrateBTBadge(route.id);
    attachSwipe();
  }

  window.scrollTo({ top: 0 });
}

// Gezinme butonları (delegasyon)
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  const hash = nav.getAttribute('data-nav');
  if (hash) go(hash);
});

// Backtest panel etkileşimleri (dilim / metrik / satır sayısı)
document.addEventListener('click', (e) => {
  // Isı hücresi: dokununca detay kutusunu doldur (dilim değiştirmez; sütun başlığı değiştirir)
  const heatCell = e.target.closest ? e.target.closest('.btheat-cell') : null;
  if (heatCell) {
    const box = document.getElementById('bt-heat-detail');
    const txt = heatCell.getAttribute('data-heat');
    if (box && txt) {
      const cut = txt.indexOf(' — ');
      const head = cut > 0 ? txt.slice(0, cut) : txt;
      const rest = cut > 0 ? txt.slice(cut) : '';
      box.innerHTML = `<strong>${esc(head)}</strong>${esc(rest)}`;
      box.classList.add('is-on');
      document.querySelectorAll('.btheat-cell.is-sel').forEach((el) => el.classList.remove('is-sel'));
      heatCell.classList.add('is-sel');
      // anlık geri bildirim: ekranın altında kısa süreli bilgi kutusu
      const toast = document.getElementById('bt-toast');
      if (toast) {
        toast.innerHTML = `<strong>${esc(head)}</strong>${esc(rest)}`;
        toast.classList.add('is-on');
        clearTimeout(heatToastTimer);
        heatToastTimer = setTimeout(() => toast.classList.remove('is-on'), 5200);
      }
    }
    return;
  }
  const tfEl = e.target.closest('[data-bt-tf]');
  const metEl = e.target.closest('[data-bt-met]');
  const topEl = e.target.closest('[data-bt-top]');
  if (!tfEl && !metEl && !topEl) return;
  if (!BT.data) return;
  let changed = false;
  if (tfEl) {
    const t = tfEl.getAttribute('data-bt-tf');
    if (t && BT.data.sum && BT.data.sum[t]) { BT.tf = t; changed = true; }
  }
  if (metEl) { BT.metric = metEl.getAttribute('data-bt-met'); changed = true; }
  if (topEl) { BT.topN = topEl.getAttribute('data-bt-top') === 'all' ? 'all' : 24; changed = true; }
  if (changed) {
    const y = window.scrollY;
    paintBacktest();
    window.scrollTo({ top: y });
  }
});

// Klavye (masaüstü)
document.addEventListener('keydown', (e) => {
  const route = parseRoute();
  if (route.name !== 'indicator') return;
  const list = listByCat(route.cat);
  const idx = list.findIndex((x) => x.id === route.id);
  if (e.key === 'ArrowLeft' && idx > 0) go(`#/i/${route.cat}/${list[idx - 1].id}`);
  if (e.key === 'ArrowRight' && idx < list.length - 1) go(`#/i/${route.cat}/${list[idx + 1].id}`);
  if (e.key === 'Home' || e.key === 'Escape') go('#/');
});

// Kaydırma (swipe) ile gezinme
function attachSwipe() {
  const screen = $app.querySelector('.screen');
  if (!screen) return;
  let sx = 0, sy = 0, active = false;
  screen.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    sx = t.clientX; sy = t.clientY; active = true;
  }, { passive: true });
  screen.addEventListener('touchend', (e) => {
    if (!active) return;
    active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 60) return;
    const route = parseRoute();
    const list = listByCat(route.cat);
    const idx = list.findIndex((x) => x.id === route.id);
    if (dx < 0 && idx < list.length - 1) go(`#/i/${route.cat}/${list[idx + 1].id}`);
    if (dx > 0 && idx > 0) go(`#/i/${route.cat}/${list[idx - 1].id}`);
  }, { passive: true });
}

window.addEventListener('hashchange', render);
render();
