// İndikatör Akademi — Backtest motoru · Strateji kataloğu (100 indikatör)
// Her indikatör, literatürdeki/piyasada yaygın kullanım şekliyle tek bir
// mekanik kurala çevrilir. Kurallar dashboardda aynen gösterilir.
// dir: 'long' (sadece long) | 'ls' (iki yön, ters sinyalde döner)
import { TF_MS } from './io.mjs';

/* ------------------------------ yardımcılar ------------------------------ */

const up = (a, b, i) => a[i - 1] <= b[i - 1] && a[i] > b[i];
const dn = (a, b, i) => a[i - 1] >= b[i - 1] && a[i] < b[i];
const upc = (a, v, i) => a[i] > v && a[i - 1] <= v;
const dnc = (a, v, i) => a[i] < v && a[i - 1] >= v;

// son onaylı pivot tepe/dip seviyeleri + endeksleri (fib-benzeri stratejiler)
function pivotLevels(ctx, lag) {
  const S = ctx.S, n = S.c.length;
  const piv = ctx.piv(lag);
  const phIdx = new Float64Array(n).fill(NaN), plIdx = new Float64Array(n).fill(NaN);
  let k = 0, cur = NaN;
  for (let i = 0; i < n; i++) {
    while (k < piv.hi.length && piv.hi[k] + lag <= i) { cur = piv.hi[k]; k++; }
    phIdx[i] = cur;
  }
  k = 0; cur = NaN;
  for (let i = 0; i < n; i++) {
    while (k < piv.lo.length && piv.lo[k] + lag <= i) { cur = piv.lo[k]; k++; }
    plIdx[i] = cur;
  }
  return { phVal: piv.upLvl, plVal: piv.dnLvl, phIdx, plIdx, piv };
}

/* ----------------------- TREND (20) ----------------------- */

const TREND = [
  {
    id: 'sma', title: 'SMA Kesişimi (10/30)', dir: 'ls',
    load: (C) => ({ f: C.L('sma', { p: 10 }, 'SMA10'), s: C.L('sma', { p: 30 }, 'SMA30') }),
    entry: (S, B, i) => (up(B.f, B.s, i) ? 1 : dn(B.f, B.s, i) ? -1 : 0),
    rules: ['SMA(10) SMA(30)\u2019u yukarı keserse AL (long)', 'Aşağı keserse SAT (short) — ters sinyalde pozisyon döner'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'ema', title: 'EMA Kesişimi (12/26)', dir: 'ls',
    load: (C) => ({ f: C.L('ema', { p: 12 }, 'EMA12'), s: C.L('ema', { p: 26 }, 'EMA26') }),
    entry: (S, B, i) => (up(B.f, B.s, i) ? 1 : dn(B.f, B.s, i) ? -1 : 0),
    rules: ['EMA(12) EMA(26)\u2019yı yukarı keserse AL', 'Aşağı keserse SAT (short) — ters sinyalde döner'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'wma', title: 'WMA Kesişimi (10/30)', dir: 'ls',
    load: (C) => ({ f: C.L('wma', { p: 10 }, 'WMA10'), s: C.L('wma', { p: 30 }, 'WMA30') }),
    entry: (S, B, i) => (up(B.f, B.s, i) ? 1 : dn(B.f, B.s, i) ? -1 : 0),
    rules: ['WMA(10) WMA(30)\u2019u yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'hma', title: 'HMA(20) Fiyat Kesişimi', dir: 'ls',
    load: (C) => ({ h: C.L('hma', {}, 'HMA20') }),
    entry: (S, B, i) => {
      if (up(S.c, B.h, i) && B.h[i] > B.h[i - 1]) return 1;
      if (dn(S.c, B.h, i) && B.h[i] < B.h[i - 1]) return -1;
      return 0;
    },
    rules: ['Fiyat HMA(20)\u2019yı yukarı keser ve HMA yükseliyorsa AL', 'Aşağı keser ve HMA düşüyorsa SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'ribbon', title: 'EMA Şeridi Hizalanması (13-89)', dir: 'ls',
    load: (C) => {
      const e13 = C.L('ema', { p: 13 }, 'EMA13'), e21 = C.L('ema', { p: 21 }, 'EMA21'), e34 = C.L('ema', { p: 34 }, 'EMA34'), e55 = C.L('ema', { p: 55 }, 'EMA55'), e89 = C.L('ema', { p: 89 }, 'EMA89');
      const n = C.S.c.length, st = new Int8Array(n);
      for (let i = 0; i < n; i++) {
        if (e13[i] > e21[i] && e21[i] > e34[i] && e34[i] > e55[i] && e55[i] > e89[i]) st[i] = 1;
        else if (e13[i] < e21[i] && e21[i] < e34[i] && e34[i] < e55[i] && e55[i] < e89[i]) st[i] = -1;
      }
      return { st };
    },
    entry: (S, B, i) => (B.st[i] === 1 && B.st[i - 1] !== 1 ? 1 : B.st[i] === -1 && B.st[i - 1] !== -1 ? -1 : 0),
    rules: ['EMA\u2019lar yukarıdan aşağı hizalanınca (13>21>34>55>89) AL', 'Aşağı hizalanınca SAT (short)'],
    stop: 'Yok (hizalama bozulana kadar)',
  },
  {
    id: 'guppy', title: 'GMMA Kısa/Uzun Grup Kesişimi', dir: 'ls',
    load: (C) => {
      const shortP = [3, 5, 8, 10, 12, 15], longP = [30, 35, 40, 45, 50, 60];
      const sg = shortP.map((p) => C.L('ema', { p }, `EMA${p}`));
      const lg = longP.map((p) => C.L('ema', { p }, `EMA${p}`));
      const n = C.S.c.length, st = new Int8Array(n);
      for (let i = 0; i < n; i++) {
        let sMin = Infinity, lMax = -Infinity, sMax = -Infinity, lMin = Infinity, ok = true;
        for (const a of sg) { if (Number.isNaN(a[i])) { ok = false; break; } sMin = Math.min(sMin, a[i]); sMax = Math.max(sMax, a[i]); }
        if (!ok) continue;
        for (const a of lg) { if (Number.isNaN(a[i])) { ok = false; break; } lMax = Math.max(lMax, a[i]); lMin = Math.min(lMin, a[i]); }
        if (!ok) continue;
        if (sMin > lMax) st[i] = 1; else if (sMax < lMin) st[i] = -1;
      }
      return { st };
    },
    entry: (S, B, i) => (B.st[i] === 1 && B.st[i - 1] !== 1 ? 1 : B.st[i] === -1 && B.st[i - 1] !== -1 ? -1 : 0),
    rules: ['Kısa EMA grubu uzun grubun tamamen üstüne çıkınca AL', 'Tamamen altına inince SAT (short)'],
    stop: 'Yok (grup kesişimi ters dönene kadar)',
  },
  {
    id: 'ichimoku', title: 'Ichimoku Bulut Kırılımı', dir: 'ls',
    load: (C) => {
      const r = C.calc('ichimoku');
      const t = r.lines.Tenkan, k = r.lines.Kijun, a = r.lines['Senkou A'], b = r.lines['Senkou B'];
      const n = C.S.c.length, top = new Float64Array(n).fill(NaN), bot = new Float64Array(n).fill(NaN);
      for (let i = 0; i < n; i++) { if (!Number.isNaN(a[i]) && !Number.isNaN(b[i])) { top[i] = Math.max(a[i], b[i]); bot[i] = Math.min(a[i], b[i]); } }
      return { t, k, top, bot };
    },
    entry: (S, B, i) => {
      if (up(S.c, B.top, i) && B.t[i] > B.k[i]) return 1;
      if (dn(S.c, B.bot, i) && B.t[i] < B.k[i]) return -1;
      return 0;
    },
    rules: ['Fiyat bulutu yukarı keser ve Tenkan>Kijun ise AL', 'Bulut aşağı kesilir ve Tenkan<Kijun ise SAT (short)'],
    stop: 'Yok (ters sinyal / bulut)',
    caveat: 'Bulut değerleri kaydırılmadan (anlık) kullanılır — basitleştirilmiştir.',
  },
  {
    id: 'psar', title: 'Parabolic SAR Dönüşü', dir: 'ls',
    load: (C) => ({ sar: C.L('psar', {}, 'PSAR') }),
    entry: (S, B, i) => (up(S.c, B.sar, i) ? 1 : dn(S.c, B.sar, i) ? -1 : 0),
    rules: ['Fiyat SAR\u2019ı yukarı kesince AL (dönüş)', 'Aşağı kesince SAT (short)'],
    stop: 'Yok (SAR ters tarafta iz sürer)',
  },
  {
    id: 'adx', title: 'ADX + DI Kesişimi (14)', dir: 'ls',
    load: (C) => { const r = C.calc('adx', { p: 14 }); return { adx: r.lines.ADX, dip: r.lines['+DI'], dim: r.lines['-DI'] }; },
    entry: (S, B, i) => {
      if (up(B.dip, B.dim, i) && B.adx[i] > 20) return 1;
      if (dn(B.dip, B.dim, i) && B.adx[i] > 20) return -1;
      return 0;
    },
    rules: ['+DI, -DI\u2019yi yukarı keser VE ADX>20 ise AL', '-DI üste geçer VE ADX>20 ise SAT (short)', 'ADX eşiği trend gücü filtresidir'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'supertrend', title: 'Supertrend Dönüşü (10, 3)', dir: 'ls',
    load: (C) => ({ st: C.L('supertrend', { p: 10, m: 3 }, 'Supertrend') }),
    entry: (S, B, i) => (up(S.c, B.st, i) ? 1 : dn(S.c, B.st, i) ? -1 : 0),
    rules: ['Fiyat Supertrend çizgisini yukarı kesince AL', 'Aşağı kesince SAT (short)'],
    stop: 'Yok (Supertrend iz süren stop gibi davranır)',
  },
  {
    id: 'aroon', title: 'Aroon Eşik Kesişimi (25)', dir: 'ls',
    load: (C) => { const r = C.calc('aroon', { p: 25 }); return { au: r.lines['Aroon Up'], ad: r.lines['Aroon Down'] }; },
    entry: (S, B, i) => (upc(B.au, 70, i) ? 1 : upc(B.ad, 70, i) ? -1 : 0),
    rules: ['Aroon Up 70\u2019i yukarı kesince AL (taze zirve)', 'Aroon Down 70\u2019i yukarı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'linreg', title: 'LinReg Kanal Orta Çizgisi (50)', dir: 'ls',
    load: (C) => ({ mid: C.L('linreg', { p: 50 }, 'Orta') }),
    entry: (S, B, i) => (up(S.c, B.mid, i) ? 1 : dn(S.c, B.mid, i) ? -1 : 0),
    rules: ['Fiyat regresyon kanalının orta çizgisini yukarı kesince AL', 'Aşağı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'envelope', title: 'Zarf Geri Dönüşü (20, %2,5)', dir: 'long',
    load: (C) => { const r = C.calc('envelope', { p: 20, m: 2.5 }); return { ust: r.lines['Üst'], orta: r.lines.Orta, alt: r.lines.Alt }; },
    entry: (S, B, i) => (up(S.c, B.alt, i) ? 1 : 0),
    exit: (S, B, i) => up(S.c, B.orta, i),
    rules: ['Fiyat alt zarfı yukarı kesince (ortalamadan sapma) AL', 'Orta çizgiye dönünce SAT (kâr al)'],
    stop: 'Yok',
  },
  {
    id: 'trix', title: 'TRIX Sinyal Kesişimi (15)', dir: 'ls',
    load: (C) => { const r = C.calc('trix', { p: 15 }); return { t: r.lines.TRIX, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.t, B.s, i) ? 1 : dn(B.t, B.s, i) ? -1 : 0),
    rules: ['TRIX sinyal çizgisini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'mcginley', title: 'McGinley Dinamik Eğrisi (14)', dir: 'ls',
    load: (C) => ({ md: C.L('mcginley', {}, 'McGinley 14') }),
    entry: (S, B, i) => {
      if (up(S.c, B.md, i) && B.md[i] > B.md[i - 1]) return 1;
      if (dn(S.c, B.md, i) && B.md[i] < B.md[i - 1]) return -1;
      return 0;
    },
    rules: ['Fiyat McGinley\u2019i yukarı keser ve eğri yükseliyorsa AL', 'Aşağı keser ve eğri düşüyorsa SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'alligator', title: 'Alligator Hizalanması', dir: 'ls',
    load: (C) => {
      const r = C.calc('alligator');
      const jaw = r.lines['Çene'], teeth = r.lines['Diş'], lips = r.lines['Dudak'];
      const n = C.S.c.length, st = new Int8Array(n);
      for (let i = 0; i < n; i++) {
        if (lips[i] > teeth[i] && teeth[i] > jaw[i]) st[i] = 1;
        else if (lips[i] < teeth[i] && teeth[i] < jaw[i]) st[i] = -1;
      }
      return { st };
    },
    entry: (S, B, i) => (B.st[i] === 1 && B.st[i - 1] !== 1 ? 1 : B.st[i] === -1 && B.st[i - 1] !== -1 ? -1 : 0),
    rules: ['Dudak>Diş>Çene sıralaması oluşunca (ağız açılınca) AL', 'Ters sıralama oluşunca SAT (short)', 'Uyuyan timsah = sıralama karışık, işlem yok'],
    stop: 'Yok (hizalama ters dönene kadar)',
  },
  {
    id: 'fractals', title: 'Fractal Kırılımı (Bill Williams)', dir: 'ls',
    load: (C) => { const p = C.piv(2); return { upLvl: p.upLvl, dnLvl: p.dnLvl }; },
    entry: (S, B, i) => {
      if (S.c[i] > B.upLvl[i] && S.c[i - 1] <= B.upLvl[i - 1]) return 1;
      if (S.c[i] < B.dnLvl[i] && S.c[i - 1] >= B.dnLvl[i - 1]) return -1;
      return 0;
    },
    stop: { kind: 'level', arr: 'dnLvl', arrShort: 'upLvl' },
    rules: ['Son yukarı fractal zirvesi kırılınca AL', 'Son aşağı fractal dibi kırılınca SAT (short)', 'Stop: karşı fractal seviyesi'],
  },
  {
    id: 'cross', title: 'Altın / Ölüm Kesişimi (50/200)', dir: 'long',
    load: (C) => ({ f: C.L('sma', { p: 50 }, 'SMA50'), s: C.L('sma', { p: 200 }, 'SMA200') }),
    entry: (S, B, i) => (up(B.f, B.s, i) ? 1 : 0),
    exit: (S, B, i) => dn(B.f, B.s, i),
    rules: ['SMA50 SMA200\u2019ü yukarı keserse (altın kesişim) AL', 'Aşağı keserse (ölüm kesişimi) pozisyonu KAPAT'],
    stop: 'Yok (kesişim)',
    caveat: 'SMA200 ısınması uzundur; kısa geçmişli sembollerin payı düşüktür.',
  },
  {
    id: 'trendlines', title: 'Trend Çizgisi Kırılımı (yaklaşım)', dir: 'ls',
    load: (C) => {
      const S = C.S, n = S.c.length, piv = C.piv(3);
      const resH = new Float64Array(n).fill(NaN), resL = new Float64Array(n).fill(NaN);
      const resHdn = new Uint8Array(n), resLup = new Uint8Array(n);
      let h1 = -1, h2 = -1, k = 0;
      for (let i = 0; i < n; i++) {
        while (k < piv.hi.length && piv.hi[k] + 3 <= i) { h1 = h2; h2 = piv.hi[k]; k++; }
        if (h1 >= 0 && h2 >= 0 && i > h2) {
          const slope = (S.h[h2] - S.h[h1]) / (h2 - h1);
          resH[i] = S.h[h2] + slope * (i - h2);
          if (slope < 0) resHdn[i] = 1;
        }
      }
      let l1 = -1, l2 = -1; k = 0;
      for (let i = 0; i < n; i++) {
        while (k < piv.lo.length && piv.lo[k] + 3 <= i) { l1 = l2; l2 = piv.lo[k]; k++; }
        if (l1 >= 0 && l2 >= 0 && i > l2) {
          const slope = (S.l[l2] - S.l[l1]) / (l2 - l1);
          resL[i] = S.l[l2] + slope * (i - l2);
          if (slope > 0) resLup[i] = 1;
        }
      }
      return { resH, resL, resHdn, resLup };
    },
    entry: (S, B, i) => {
      if (B.resHdn[i] && S.c[i] > B.resH[i] && S.c[i - 1] <= B.resH[i - 1]) return 1;
      if (B.resLup[i] && S.c[i] < B.resL[i] && S.c[i - 1] >= B.resL[i - 1]) return -1;
      return 0;
    },
    stop: { kind: 'atr', p: 14, mult: 2.5 },
    rules: ['Düşen direnç çizgisi (son iki alçalan tepe) yukarı kırılırsa AL', 'Yükselen destek çizgisi aşağı kırılırsa SAT (short)', 'Stop: 2,5×ATR'],
    caveat: 'Çizgiler otomatik olarak son iki pivot tepe/dipten çizilir — elle çizime yaklaşımdır.',
  },
  {
    id: 'vortex', title: 'Vortex Kesişimi (14)', dir: 'ls',
    load: (C) => { const r = C.calc('vortex', { p: 14 }); return { vp: r.lines['VI+'], vm: r.lines['VI-'] }; },
    entry: (S, B, i) => (up(B.vp, B.vm, i) ? 1 : dn(B.vp, B.vm, i) ? -1 : 0),
    rules: ['VI+ VI-\u2019yi yukarı keserse AL (yükseliş hareketi başlar)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
];

/* ----------------------- HIZ / MOMENTUM (20) ----------------------- */

const MOMENTUM = [
  {
    id: 'rsi', title: 'RSI Aşırılık Dönüşü (14)', dir: 'long',
    load: (C) => ({ r: C.L('rsi', { p: 14 }, 'RSI') }),
    entry: (S, B, i) => (upc(B.r, 30, i) ? 1 : 0),
    exit: (S, B, i) => dnc(B.r, 70, i),
    rules: ['RSI 30\u2019un altına inip geri yukarı kesince AL', 'RSI 70\u2019i aşağı kesince SAT (kâr al)'],
    stop: 'Yok',
  },
  {
    id: 'macd', title: 'MACD Sinyal Kesişimi', dir: 'ls',
    load: (C) => { const r = C.calc('macd'); return { m: r.lines.MACD, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.m, B.s, i) ? 1 : dn(B.m, B.s, i) ? -1 : 0),
    rules: ['MACD sinyal çizgisini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'stoch', title: 'Stokastik Kesişimi (14,3,3)', dir: 'ls',
    load: (C) => { const r = C.calc('stoch'); return { k: r.lines['%K'], d: r.lines['%D'] }; },
    entry: (S, B, i) => {
      if (up(B.k, B.d, i) && B.k[i] < 25) return 1;
      if (dn(B.k, B.d, i) && B.k[i] > 75) return -1;
      return 0;
    },
    rules: ['%K, %D\u2019yi aşırı satım bölgesinde (K<25) yukarı keserse AL', '%K, %D\u2019yi aşırı alımda (K>75) aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'stochrsi', title: 'StochRSI Kesişimi (0,2/0,8)', dir: 'ls',
    load: (C) => { const r = C.calc('stochrsi'); return { k: r.lines['%K'], d: r.lines['%D'] }; },
    entry: (S, B, i) => {
      if (up(B.k, B.d, i) && B.k[i] < 0.25) return 1;
      if (dn(B.k, B.d, i) && B.k[i] > 0.75) return -1;
      return 0;
    },
    rules: ['%K, %D\u2019yi 0,25 altında yukarı keserse AL', '0,75 üstünde aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'cci', title: 'CCI Aşırılık Dönüşü (20)', dir: 'ls',
    load: (C) => ({ c: C.L('cci', { p: 20 }, 'CCI') }),
    entry: (S, B, i) => (upc(B.c, -100, i) ? 1 : dnc(B.c, 100, i) ? -1 : 0),
    rules: ['CCI -100\u2019ü yukarı kesince AL', 'CCI +100\u2019ü aşağı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'roc', title: 'ROC Sıfır Kesişimi (9)', dir: 'ls',
    load: (C) => ({ r: C.L('roc', { p: 9 }, 'ROC') }),
    entry: (S, B, i) => (upc(B.r, 0, i) ? 1 : dnc(B.r, 0, i) ? -1 : 0),
    rules: ['ROC sıfırı yukarı keserse AL (pozitif ivme)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'mom', title: 'Momentum Sıfır Kesişimi (10)', dir: 'ls',
    load: (C) => ({ m: C.L('mom', { p: 10 }, 'Momentum') }),
    entry: (S, B, i) => (upc(B.m, 0, i) ? 1 : dnc(B.m, 0, i) ? -1 : 0),
    rules: ['Momentum sıfırı yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'willr', title: 'Williams %R Dönüşü (14)', dir: 'ls',
    load: (C) => ({ w: C.L('willr', { p: 14 }, '%R') }),
    entry: (S, B, i) => (upc(B.w, -80, i) ? 1 : dnc(B.w, -20, i) ? -1 : 0),
    rules: ['%R -80\u2019i yukarı kesince AL (aşırı satım çıkışı)', '%R -20\u2019yi aşağı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'tsi', title: 'TSI Sinyal Kesişimi (25,13)', dir: 'ls',
    load: (C) => { const r = C.calc('tsi'); return { t: r.lines.TSI, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.t, B.s, i) ? 1 : dn(B.t, B.s, i) ? -1 : 0),
    rules: ['TSI sinyalini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'uo', title: 'Ultimate Oscillator Dönüşü', dir: 'ls',
    load: (C) => ({ u: C.L('uo', {}, 'UO') }),
    entry: (S, B, i) => (upc(B.u, 30, i) ? 1 : dnc(B.u, 70, i) ? -1 : 0),
    rules: ['UO 30\u2019u yukarı kesince AL', 'UO 70\u2019i aşağı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'ao', title: 'Awesome Oscillator Sıfır Kesişimi', dir: 'ls',
    load: (C) => ({ a: C.L('ao', {}, 'AO') }),
    entry: (S, B, i) => (upc(B.a, 0, i) ? 1 : dnc(B.a, 0, i) ? -1 : 0),
    rules: ['AO sıfırı yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'ppo', title: 'PPO Sinyal Kesişimi', dir: 'ls',
    load: (C) => { const r = C.calc('ppo'); return { p: r.lines.PPO, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.p, B.s, i) ? 1 : dn(B.p, B.s, i) ? -1 : 0),
    rules: ['PPO sinyalini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'dpo', title: 'DPO Sıfır Kesişimi (20)', dir: 'ls',
    load: (C) => ({ d: C.L('dpo', { p: 20 }, 'DPO') }),
    entry: (S, B, i) => (upc(B.d, 0, i) ? 1 : dnc(B.d, 0, i) ? -1 : 0),
    rules: ['DPO sıfırı yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'kst', title: 'KST Sinyal Kesişimi', dir: 'ls',
    load: (C) => { const r = C.calc('kst'); return { k: r.lines.KST, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.k, B.s, i) ? 1 : dn(B.k, B.s, i) ? -1 : 0),
    rules: ['KST sinyalini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'cmo', title: 'CMO Sıfır Kesişimi (14)', dir: 'ls',
    load: (C) => ({ c: C.L('cmo', { p: 14 }, 'CMO') }),
    entry: (S, B, i) => (upc(B.c, 0, i) ? 1 : dnc(B.c, 0, i) ? -1 : 0),
    rules: ['CMO sıfırı yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'fisher', title: 'Fisher Dönüşü (10)', dir: 'ls',
    load: (C) => { const r = C.calc('fisher', { p: 10 }); return { f: r.lines.Fisher }; },
    entry: (S, B, i) => (upc(B.f, -2, i) ? 1 : dnc(B.f, 2, i) ? -1 : 0),
    rules: ['Fisher -2\u2019yi yukarı kesince AL (aşırı satımdan dönüş)', 'Fisher +2\u2019yi aşağı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'smi', title: 'SMI Aşırılık Dönüşü (14,3)', dir: 'ls',
    load: (C) => { const r = C.calc('smi'); return { s: r.lines.SMI }; },
    entry: (S, B, i) => (upc(B.s, -40, i) ? 1 : dnc(B.s, 40, i) ? -1 : 0),
    rules: ['SMI -40\u2019ı yukarı kesince AL', 'SMI +40\u2019ı aşağı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'rvi', title: 'RVI Sinyal Kesişimi (10)', dir: 'ls',
    load: (C) => { const r = C.calc('rvi', { p: 10 }); return { r: r.lines.RVI, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.r, B.s, i) ? 1 : dn(B.r, B.s, i) ? -1 : 0),
    rules: ['RVI sinyal çizgisini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'pmo', title: 'PMO Sinyal Kesişimi', dir: 'ls',
    load: (C) => { const r = C.calc('pmo'); return { p: r.lines.PMO, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.p, B.s, i) ? 1 : dn(B.p, B.s, i) ? -1 : 0),
    rules: ['PMO sinyalini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'coppock', title: 'Coppock Eğrisi Sıfır Kesişimi', dir: 'long',
    load: (C) => ({ c: C.L('coppock', {}, 'Coppock') }),
    entry: (S, B, i) => (upc(B.c, 0, i) ? 1 : 0),
    exit: (S, B, i) => dnc(B.c, 0, i),
    rules: ['Coppock sıfırı yukarı keserse AL', 'Sıfırı aşağı keserse SAT'],
    stop: 'Yok (kesişim)',
  },
];

/* ----------------------- HACİM (20) ----------------------- */

const HACIM = [
  {
    id: 'obv', title: 'OBV + EMA(21) Kesişimi', dir: 'ls',
    load: (C) => { const o = C.L('obv', {}, 'OBV'); return { o, e: C.emaOf(o, 21) }; },
    entry: (S, B, i) => (up(B.o, B.e, i) ? 1 : dn(B.o, B.e, i) ? -1 : 0),
    rules: ['OBV, kendi EMA(21)\u2019ini yukarı keserse AL (birikim)', 'Aşağı keserse SAT (short, dağıtım)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'vwap', title: 'VWAP Üstü/Altı + Hacim Filtresi', dir: 'ls',
    load: (C) => {
      const tf = C.tf;
      const sv = (tf === '5m' || tf === '15m' || tf === '1h') ? C.sessionVwap(C.S, C.days()) : C.vwapRoll(C.S, tf === '4h' ? 6 : tf === '1d' ? 20 : 12);
      return { v: sv, av: C.smaOf(C.S.v, 20) };
    },
    entry: (S, B, i) => {
      const volOk = S.v[i] > B.av[i];
      if (up(S.c, B.v, i) && volOk) return 1;
      if (dn(S.c, B.v, i)) return -1;
      return 0;
    },
    rules: ['Fiyat VWAP\u2019ı yukarı keser VE hacim 20-bar ortalamasının üstündeyse AL', 'VWAP altına inerse SAT (short)', 'Gün içi TF\u2019lerde günlük, üstlerinde 24 saatlik/kayan VWAP kullanılır'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'avwap', title: 'Anchored VWAP Kesişimi', dir: 'ls',
    load: (C) => ({ a: C.anchoredVwap(C.S, 5) }),
    entry: (S, B, i) => (up(S.c, B.a, i) ? 1 : dn(S.c, B.a, i) ? -1 : 0),
    rules: ['Fiyat AVWAP\u2019ı yukarı keserse AL', 'Aşağı keserse SAT (short)', 'Demir noktası: son onaylı pivot dipten başlatılır, daha düşük dip gelirse taşınır'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'volbars', title: 'Hacim Patlaması (2× ortalama)', dir: 'ls',
    load: (C) => { const r = C.calc('volbars', { p: 20 }); return { av: r.lines['Ort 20'] }; },
    entry: (S, B, i) => {
      if (!(S.v[i] > 2 * B.av[i])) return 0;
      if (S.c[i] > S.o[i]) return 1;
      if (S.c[i] < S.o[i]) return -1;
      return 0;
    },
    maxBars: 5,
    rules: ['Hacim 20-bar ortalamasının 2 katını aşarsa', 'Yeşil mum → AL; kırmızı mum → SAT (short)', 'En fazla 5 bar tutulur (patlama işlemi)'],
    stop: 'Yok (5 bar zaman stopu)',
  },
  {
    id: 'vprofile', title: 'Hacim Profili / Değer Alanı Kırılımı (yaklaşım)', dir: 'ls',
    load: (C) => C.vwapBands(C.S, 100, 1.5),
    entry: (S, B, i) => (up(S.c, B.up, i) ? 1 : dn(S.c, B.dn, i) ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? dn(S.c, B.mid, i) : up(S.c, B.mid, i)),
    rules: ['Fiyat değer alanı üst sınırını (VWAP+1,5σ) yukarı keserse AL', 'Alt sınırı aşağı keserse SAT (short)', 'Çıkış: POC (orta çizgi)'],
    stop: 'Yok',
    caveat: 'Gerçek hacim profili yerine VWAP±σ değer alanı vekili kullanılır.',
  },
  {
    id: 'mfi', title: 'MFI Aşırılık Dönüşü (14)', dir: 'ls',
    load: (C) => ({ m: C.L('mfi', { p: 14 }, 'MFI') }),
    entry: (S, B, i) => (upc(B.m, 20, i) ? 1 : dnc(B.m, 80, i) ? -1 : 0),
    rules: ['MFI 20\u2019yi yukarı kesince AL', 'MFI 80\u2019i aşağı kesince SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'cmf', title: 'Chaikin Para Akışı Sıfır Kesişimi (20)', dir: 'ls',
    load: (C) => ({ c: C.L('cmf', { p: 20 }, 'CMF') }),
    entry: (S, B, i) => (upc(B.c, 0, i) ? 1 : dnc(B.c, 0, i) ? -1 : 0),
    rules: ['CMF sıfırı yukarı keserse AL (alım baskısı)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'ad', title: 'A/D Çizgisi + EMA(21)', dir: 'ls',
    load: (C) => { const a = C.L('ad', {}, 'A/D'); return { a, e: C.emaOf(a, 21) }; },
    entry: (S, B, i) => (up(B.a, B.e, i) ? 1 : dn(B.a, B.e, i) ? -1 : 0),
    rules: ['A/D çizgisi kendi EMA(21)\u2019ini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'chaikinosc', title: 'Chaikin Oscillator Sıfır Kesişimi', dir: 'ls',
    load: (C) => ({ c: C.L('chaikinosc', {}, 'Chaikin Osc') }),
    entry: (S, B, i) => (upc(B.c, 0, i) ? 1 : dnc(B.c, 0, i) ? -1 : 0),
    rules: ['Chaikin Osc sıfırı yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'force', title: 'Force Index EMA(13) Sıfır Kesişimi', dir: 'ls',
    load: (C) => ({ f: C.L('force', { p: 13 }, 'EMA 13') }),
    entry: (S, B, i) => (upc(B.f, 0, i) ? 1 : dnc(B.f, 0, i) ? -1 : 0),
    rules: ['Force Index (EMA 13) sıfırı yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'eom', title: 'Ease of Movement Sıfır Kesişimi (14)', dir: 'ls',
    load: (C) => ({ e: C.L('eom', { p: 14 }, 'EOM') }),
    entry: (S, B, i) => (upc(B.e, 0, i) ? 1 : dnc(B.e, 0, i) ? -1 : 0),
    rules: ['EOM sıfırı yukarı keserse AL (kolay yükseliş)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'voi', title: 'Hacim Osilatörü Sıfır Kesişimi (5,20)', dir: 'ls',
    load: (C) => ({ v: C.L('voi', { p: 5, q: 20 }, 'VO') }),
    entry: (S, B, i) => (upc(B.v, 0, i) ? 1 : dnc(B.v, 0, i) ? -1 : 0),
    rules: ['Kısa hacim ortalaması uzunu yukarı keserse AL (hacim artıyor)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'kvo', title: 'KVO Sinyal Kesişimi', dir: 'ls',
    load: (C) => { const r = C.calc('kvo'); return { k: r.lines.KVO, s: r.lines.Sinyal }; },
    entry: (S, B, i) => (up(B.k, B.s, i) ? 1 : dn(B.k, B.s, i) ? -1 : 0),
    rules: ['KVO sinyalini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'nvi', title: 'NVI + EMA(200) Trendi', dir: 'ls',
    load: (C) => { const i = C.L('nvi', {}, 'Index'); return { i, e: C.emaOf(i, 200) }; },
    entry: (S, B, i) => (up(B.i, B.e, i) ? 1 : dn(B.i, B.e, i) ? -1 : 0),
    rules: ['NVI kendi EMA(200)\u2019ünü yukarı keserse AL (sessiz birikim)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'pvi', title: 'PVI + EMA(200) Trendi', dir: 'ls',
    load: (C) => { const i = C.L('pvi', {}, 'Index'); return { i, e: C.emaOf(i, 200) }; },
    entry: (S, B, i) => (up(B.i, B.e, i) ? 1 : dn(B.i, B.e, i) ? -1 : 0),
    rules: ['PVI kendi EMA(200)\u2019ünü yukarı keserse AL (kalabalık katılımı)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'pvt', title: 'PVT + EMA(21) Kesişimi', dir: 'ls',
    load: (C) => { const p = C.L('pvt', {}, 'PVT'); return { p, e: C.emaOf(p, 21) }; },
    entry: (S, B, i) => (up(B.p, B.e, i) ? 1 : dn(B.p, B.e, i) ? -1 : 0),
    rules: ['PVT kendi EMA(21)\u2019ini yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'rvol', title: 'RVOL Patlaması (1,5×)', dir: 'ls',
    load: (C) => ({ r: C.B('rvol', { p: 20 }, 'RVOL') }),
    entry: (S, B, i) => {
      if (!(upc(B.r, 1.5, i))) return 0;
      return S.c[i] > S.c[i - 1] ? 1 : S.c[i] < S.c[i - 1] ? -1 : 0;
    },
    maxBars: 10,
    rules: ['RVOL 1,5×\u2019i yukarı kesince (hacim ortalamanın 1,5 katı)', 'Mum yönü yukarıysa AL, aşağıysa SAT (short)', 'En fazla 10 bar'],
    stop: 'Yok (10 bar zaman stopu)',
  },
  {
    id: 'vwma', title: 'VWMA(20) Fiyat Kesişimi', dir: 'ls',
    load: (C) => ({ v: C.L('vwma', {}, 'VWMA20') }),
    entry: (S, B, i) => (up(S.c, B.v, i) ? 1 : dn(S.c, B.v, i) ? -1 : 0),
    rules: ['Fiyat VWMA(20)\u2019yi yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'twiggs', title: 'Twiggs Money Flow Sıfır Kesişimi (21)', dir: 'ls',
    load: (C) => ({ t: C.L('twiggs', { p: 21 }, 'Twiggs MF') }),
    entry: (S, B, i) => (upc(B.t, 0, i) ? 1 : dnc(B.t, 0, i) ? -1 : 0),
    rules: ['Twiggs MF sıfırı yukarı keserse AL', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'vroc', title: 'Hacim ROC Sıfır Kesişimi (25)', dir: 'ls',
    load: (C) => ({ v: C.L('vroc', { p: 25 }, 'Hacim ROC') }),
    entry: (S, B, i) => (upc(B.v, 0, i) ? 1 : dnc(B.v, 0, i) ? -1 : 0),
    rules: ['Hacim ROC sıfırı yukarı keserse AL (hacim ivmeleniyor)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
];

/* ----------------------- VOLATİLİTE (20) ----------------------- */

const VOLATILITE = [
  {
    id: 'atr', title: 'EMA(50) Trendi + ATR Takip Stopu', dir: 'ls',
    load: (C) => ({ e: C.L('ema', { p: 50 }, 'EMA50') }),
    entry: (S, B, i) => (up(S.c, B.e, i) ? 1 : dn(S.c, B.e, i) ? -1 : 0),
    stop: { kind: 'atr', p: 14, mult: 3 },
    rules: ['Fiyat EMA(50)\u2019yi yukarı kesince AL, aşağı kesince SAT (short)', 'Stop: en yüksek zirveden 3×ATR(14) iz süren (chandelier tipi)'],
    stopText: 'İz süren 3×ATR(14)',
  },
  {
    id: 'bb', title: 'Bollinger Ortalamaya Dönüş (20, 2)', dir: 'ls',
    load: (C) => { const r = C.calc('bb', { p: 20, m: 2 }); return { ust: r.lines['Üst'], orta: r.lines.Orta, alt: r.lines.Alt }; },
    entry: (S, B, i) => (up(S.c, B.alt, i) ? 1 : dn(S.c, B.ust, i) ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? up(S.c, B.orta, i) : dn(S.c, B.orta, i)),
    rules: ['Fiyat alt bandı yukarı keserse AL (ortalamaya dönüş)', 'Üst bandı aşağı keserse SAT (short)', 'Çıkış: orta band'],
    stop: 'Yok',
  },
  {
    id: 'percentb', title: '%B Aşırılık Dönüşü', dir: 'ls',
    load: (C) => ({ b: C.L('percentb', { p: 20 }, '%B') }),
    entry: (S, B, i) => (upc(B.b, 0, i) ? 1 : dnc(B.b, 1, i) ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? upc(B.b, 0.5, i) : dnc(B.b, 0.5, i)),
    rules: ['%B 0\u2019ı yukarı kesince AL (bandın altından dönüş)', '%B 1\u2019i aşağı kesince SAT (short)', 'Çıkış: 0,5 (orta)'],
    stop: 'Yok',
  },
  {
    id: 'bbwidth', title: 'Bant Sıkışması Kırılımı', dir: 'ls',
    load: (C) => {
      const w = C.L('bbwidth', { p: 20 }, 'Band Genişliği %');
      const r = C.rankPct(w, 100);
      const n = C.S.c.length;
      const sq = new Uint8Array(n); // son 10 barda %15 altı sıkışma var mıydı
      for (let i = 10; i < n; i++) {
        let mn = Infinity;
        for (let j = i - 10; j <= i; j++) if (!Number.isNaN(r[j]) && r[j] < mn) mn = r[j];
        if (mn < 0.15) sq[i] = 1;
      }
      return { sq, hi: C.rollMax(C.S.h, 20), lo: C.rollMin(C.S.l, 20) };
    },
    entry: (S, B, i) => {
      if (!B.sq[i - 1]) return 0;
      if (S.c[i] > B.hi[i - 1]) return 1;
      if (S.c[i] < B.lo[i - 1]) return -1;
      return 0;
    },
    stop: { kind: 'atr', p: 14, mult: 2.5 },
    rules: ['Bant genişliği son 10 barda 100-bar yüzdelik %15\u2019inin altına inmişse (sıkışma)', '20-bar zirvesi kırılırsa AL, dibi kırılırsa SAT (short)', 'Stop: 2,5×ATR'],
  },
  {
    id: 'keltner', title: 'Keltner Kanal Kırılımı (20, 1,5)', dir: 'ls',
    load: (C) => { const r = C.calc('keltner', { p: 20, m: 1.5 }); return { ust: r.lines['Üst'], orta: r.lines.Orta, alt: r.lines.Alt }; },
    entry: (S, B, i) => (up(S.c, B.ust, i) ? 1 : dn(S.c, B.alt, i) ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? dn(S.c, B.orta, i) : up(S.c, B.orta, i)),
    rules: ['Fiyat üst kanalı yukarı keserse AL (kırılım)', 'Alt kanalı aşağı keserse SAT (short)', 'Çıkış: orta çizgi'],
    stop: 'Yok',
  },
  {
    id: 'donchian', title: 'Donchian Kırılımı (20/10 — Turtle)', dir: 'ls',
    load: (C) => ({
      hi20: C.rollMax(C.S.h, 20), lo20: C.rollMin(C.S.l, 20),
      hi10: C.rollMax(C.S.h, 10), lo10: C.rollMin(C.S.l, 10),
    }),
    entry: (S, B, i) => (S.c[i] > B.hi20[i - 1] ? 1 : S.c[i] < B.lo20[i - 1] ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? S.c[i] < B.lo10[i - 1] : S.c[i] > B.hi10[i - 1]),
    rules: ['20-bar zirvesi üstüne kapanış → AL (Turtle kuralı)', '20-bar dibi altına kapanış → SAT (short)', 'Çıkış: ters yönde 10-bar kanal kırılımı'],
    stop: 'Yok (10-bar kanal çıkışı)',
  },
  {
    id: 'stddev', title: 'Standart Sapma Genişleme Filtresi', dir: 'ls',
    load: (C) => { const s = C.L('stddev', { p: 20 }, 'Std Sapma'); return { s, e: C.L('ema', { p: 50 }, 'EMA50') }; },
    entry: (S, B, i) => {
      if (!(B.s[i] > B.s[i - 24])) return 0;
      if (up(S.c, B.e, i)) return 1;
      if (dn(S.c, B.e, i)) return -1;
      return 0;
    },
    stop: { kind: 'atr', p: 14, mult: 2.5 },
    rules: ['Volatilite (StdDev 20) son 24 barda GENİŞLİYORSA', 'Fiyat EMA(50)\u2019yi kesince yönde işlem aç', 'Stop: 2,5×ATR'],
  },
  {
    id: 'histvol', title: 'Tarihsel Volatilite Düşüş Filtresi', dir: 'ls',
    load: (C) => ({ v: C.L('histvol', { p: 20 }, 'Yıllık Vol. %'), e: C.L('ema', { p: 50 }, 'EMA50') }),
    entry: (S, B, i) => {
      if (!(B.v[i] < B.v[i - 12])) return 0;
      if (up(S.c, B.e, i)) return 1;
      if (dn(S.c, B.e, i)) return -1;
      return 0;
    },
    rules: ['Tarihsel volatilite son 12 barda DÜŞÜYORSA', 'Fiyat EMA(50)\u2019yi kesince yönde işlem aç', 'Sakin piyasada trend avı'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'chaikinvol', title: 'Chaikin Volatilite + Zirve Kırılımı', dir: 'ls',
    load: (C) => {
      const cv = C.L('chaikinvol', {}, 'Chaikin Vol.');
      return { cv, cve: C.emaOf(cv, 21), hi20: C.rollMax(C.S.h, 20), lo20: C.rollMin(C.S.l, 20), hi10: C.rollMax(C.S.h, 10), lo10: C.rollMin(C.S.l, 10) };
    },
    entry: (S, B, i) => {
      const volOk = B.cv[i] > B.cve[i];
      if (volOk && S.c[i] > B.hi20[i - 1]) return 1;
      if (volOk && S.c[i] < B.lo20[i - 1]) return -1;
      return 0;
    },
    exit: (S, B, i, pos) => (pos === 1 ? S.c[i] < B.lo10[i - 1] : S.c[i] > B.hi10[i - 1]),
    rules: ['Chaikin volatilite artıyorsa VE', '20-bar zirvesi kırılırsa AL / dibi kırılırsa SAT (short)', 'Çıkış: 10-bar kanal kırılımı'],
    stop: 'Yok (10-bar kanal çıkışı)',
  },
  {
    id: 'natr', title: 'EMA(50) Trendi + NATR Yüzde Stopu', dir: 'ls',
    load: (C) => ({ e: C.L('ema', { p: 50 }, 'EMA50') }),
    entry: (S, B, i) => (up(S.c, B.e, i) ? 1 : dn(S.c, B.e, i) ? -1 : 0),
    stop: { kind: 'natr', p: 14, mult: 3 },
    rules: ['Fiyat EMA(50)\u2019yi kesince yönde işlem aç', 'Stop: giriş anında 3×NATR(14) yüzde mesafesi (sabit)'],
    stopText: 'Sabit 3×NATR yüzde stopu',
  },
  {
    id: 'ulcer', title: 'Ulcer Index Sakinlik Filtresi', dir: 'ls',
    load: (C) => { const u = C.L('ulcer', { p: 14 }, 'Ulcer Index'); return { u, ue: C.emaOf(u, 24), e: C.L('ema', { p: 50 }, 'EMA50') }; },
    entry: (S, B, i) => {
      if (!(B.u[i] < B.ue[i])) return 0;
      if (up(S.c, B.e, i)) return 1;
      if (dn(S.c, B.e, i)) return -1;
      return 0;
    },
    rules: ['Ulcer Index (düşüş acısı) kendi EMA(24)\u2019ünün altındaysa', 'Fiyat EMA(50)\u2019yi kesince yönde işlem aç', 'Sakin (az sancılı) piyasada trend avı'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'mass', title: 'Mass Index Tümsek Dönüşü (yaklaşım)', dir: 'ls',
    load: (C) => {
      const m = C.L('mass', {}, 'Mass Index');
      const mx = C.rollMax(m, 25);
      const n = C.S.c.length, bulge = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(mx[i]) && mx[i] > 27 && m[i] < mx[i]) bulge[i] = 1;
      return { bulge, sma20: C.L('sma', { p: 20 }, 'SMA20') };
    },
    entry: (S, B, i) => {
      if (!(B.bulge[i] && !B.bulge[i - 1])) return 0; // tümsek bitti
      return S.c[i] > B.sma20[i] ? 1 : S.c[i] < B.sma20[i] ? -1 : 0;
    },
    exit: (S, B, i, pos) => (pos === 1 ? dn(S.c, B.sma20, i) : up(S.c, B.sma20, i)),
    rules: ['Mass Index 27 üstünde tümsek yapıp geri dönerse (tümsek bitti)', 'Fiyat SMA(20) üstündeyse AL, altındaysa SAT (short)', 'Çıkış: SMA(20) kesişimi'],
    stop: 'Yok',
    caveat: 'Tümsek tespiti yaklaşıktır; klasik kullanımın mekanikleştirilmiş hâlidir.',
  },
  {
    id: 'chop', title: 'Choppiness Trend Filtresi (38)', dir: 'ls',
    load: (C) => ({ c: C.L('chop', { p: 14 }, 'Choppiness'), e: C.L('ema', { p: 50 }, 'EMA50') }),
    entry: (S, B, i) => {
      if (!(B.c[i] < 38)) return 0;
      if (up(S.c, B.e, i)) return 1;
      if (dn(S.c, B.e, i)) return -1;
      return 0;
    },
    rules: ['Choppiness 38\u2019in altındaysa (piyasa trendli)', 'Fiyat EMA(50)\u2019yi kesince yönde işlem aç'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'squeeze', title: 'TTM Squeeze Serbest Kalışı', dir: 'ls',
    load: (C) => {
      const r = C.calc('squeeze', { p: 20 });
      const n = C.S.c.length, on = new Uint8Array(n);
      for (const d of r.dots) on[d.i] = 1;
      return { on, m: r.bars.Momentum };
    },
    entry: (S, B, i) => {
      if (!(B.on[i - 1] && !B.on[i])) return 0; // sıkışma bu barda bitti
      return B.m[i] > 0 ? 1 : B.m[i] < 0 ? -1 : 0;
    },
    exit: (S, B, i, pos) => (pos === 1 ? B.m[i] < 0 : B.m[i] > 0),
    rules: ['Bollinger bantları Keltner kanalının içindeyken (sıkışma) BEKLE', 'Sıkışma bittiği barda momentum (+) ise AL, (−) ise SAT (short)', 'Çıkış: momentum yönü ters dönünce'],
    stop: 'Yok (momentum dönüşü)',
  },
  {
    id: 'truerange', title: 'True Range Patlaması', dir: 'ls',
    load: (C) => {
      const tr = C.B('truerange', {}, 'TR');
      const atr = C.L('atr', { p: 14 }, 'ATR');
      return { tr, atr };
    },
    entry: (S, B, i) => {
      const big = B.tr[i] > 1.5 * B.atr[i], fresh = !(B.tr[i - 1] > 1.5 * B.atr[i - 1]);
      if (big && fresh) return S.c[i] > S.o[i] ? 1 : S.c[i] < S.o[i] ? -1 : 0;
      return 0;
    },
    maxBars: 5,
    rules: ['True Range, 1,5×ATR(14)\u2019yü taze şekilde aşarsa (patlama barı)', 'Yeşil mum → AL; kırmızı mum → SAT (short)', 'En fazla 5 bar'],
    stop: 'Yok (5 bar zaman stopu)',
  },
  {
    id: 'chandelier', title: 'Chandelier Çıkış Çizgisi (22, 3)', dir: 'ls',
    load: (C) => ({ ch: C.L('chandelier', { p: 22, m: 3 }, 'Chandelier'), e: C.L('ema', { p: 50 }, 'EMA50') }),
    entry: (S, B, i) => (up(S.c, B.e, i) ? 1 : dn(S.c, B.e, i) ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? S.c[i] < B.ch[i] : S.c[i] > B.ch[i]),
    rules: ['Fiyat EMA(50)\u2019yi kesince yönde gir', 'Çıkış: Avize (Chandelier) 3×ATR çizgisi kırılınca'],
    stop: 'Yok (chandelier çizgisi)',
  },
  {
    id: 'relvol', title: 'RVI Bölgesi (50) Trendi', dir: 'ls',
    load: (C) => ({ r: C.L('relvol', { p: 10 }, 'RVI') }),
    entry: (S, B, i) => (upc(B.r, 50, i) ? 1 : dnc(B.r, 50, i) ? -1 : 0),
    rules: ['RVI 50\u2019yi yukarı keserse AL (yukarı oynaklık baskın)', 'Aşağı keserse SAT (short)'],
    stop: 'Yok (ters sinyal)',
  },
  {
    id: 'volratio', title: 'Volatilite Oranı Kırılımı (1,5)', dir: 'ls',
    load: (C) => ({ v: C.L('volratio', { p: 14 }, 'TR / Ort TR') }),
    entry: (S, B, i) => {
      if (upc(B.v, 1.5, i)) return S.c[i] > S.c[i - 1] ? 1 : S.c[i] < S.c[i - 1] ? -1 : 0;
      return 0;
    },
    exit: (S, B, i) => dnc(B.v, 0.8, i),
    maxBars: 10,
    rules: ['Volatilite oranı 1,5\u2019i taze şekilde aşarsa', 'Bar yönü yukarıysa AL, aşağıysa SAT (short)', 'Çıkış: oran 0,8 altına inince veya 10 bar'],
    stop: 'Yok',
  },
  {
    id: 'parkinson', title: 'Parkinson Volatilite + Zirve Kırılımı', dir: 'ls',
    load: (C) => {
      const p = C.L('parkinson', { p: 20 }, 'Parkinson Vol.');
      return { p, pct: C.rankPct(p, 100), hi: C.rollMax(C.S.h, 20), lo: C.rollMin(C.S.l, 20) };
    },
    entry: (S, B, i) => {
      if (!(B.pct[i] > 0.5)) return 0;
      if (S.c[i] > B.hi[i - 1]) return 1;
      if (S.c[i] < B.lo[i - 1]) return -1;
      return 0;
    },
    stop: { kind: 'atr', p: 14, mult: 3 },
    rules: ['Parkinson volatilitesi 100-bar medyanının üstündeyse', '20-bar zirvesi kırılırsa AL / dibi kırılırsa SAT (short)', 'Stop: 3×ATR'],
  },
  {
    id: 'vix', title: 'Kripto Korku Endeksi Rejim Anahtarı (yaklaşım)', dir: 'ls',
    load: (C) => {
      const hv = C.L('histvol', { p: 20 }, 'Yıllık Vol. %');
      const bb = C.calc('bb', { p: 20, m: 2 });
      return { r: C.rankPct(hv, 200), e: C.L('ema', { p: 50 }, 'EMA50'), alt: bb.lines.Alt, orta: bb.lines.Orta };
    },
    entry: (S, B, i) => {
      const panic = B.r[i] > 0.8;
      if (panic) return up(S.c, B.alt, i) ? 1 : 0; // panikte: alt bant tepkisi
      if (up(S.c, B.e, i)) return 1;
      if (dn(S.c, B.e, i)) return -1;
      return 0;
    },
    exit: (S, B, i, pos) => (pos === 1 && B.r[i] > 0.8 ? up(S.c, B.orta, i) : false),
    rules: ['Volatilite 200-bar yüzdelik %80 üstündeyse (panik rejimi): sadece alt bant dönüşünde AL', 'Sakin rejimde: EMA(50) kesişimleriyle iki yönlü işlem', 'Panik pozisyonları orta bandda kapatılır'],
    stop: 'Yok',
    caveat: 'VIX kriptoda doğrudan yoktur; tarihsel volatilite yüzdeliği vekil olarak kullanılır.',
  },
];

/* ----------------------- PİYASA YAPISI (20) ----------------------- */

const YAPI = [
  {
    id: 'sr', title: 'Destek/Direnç Pivot Kırılımı', dir: 'ls',
    load: (C) => { const p = C.piv(5); return { upLvl: p.upLvl, dnLvl: p.dnLvl }; },
    entry: (S, B, i) => {
      if (S.c[i] > B.upLvl[i] && S.c[i - 1] <= B.upLvl[i - 1]) return 1;
      if (S.c[i] < B.dnLvl[i] && S.c[i - 1] >= B.dnLvl[i - 1]) return -1;
      return 0;
    },
    stop: { kind: 'level', arr: 'dnLvl', arrShort: 'upLvl' },
    rules: ['Son onaylı direnç (pivot tepe) üstüne kapanış → AL', 'Son onaylı destek (pivot dip) altına kapanış → SAT (short)', 'Stop: karşı seviye'],
  },
  {
    id: 'channel', title: 'Regresyon Kanalı Kırılımı (50)', dir: 'ls',
    load: (C) => { const r = C.calc('linreg', { p: 50 }); return { ust: r.lines['Üst'], alt: r.lines.Alt }; },
    entry: (S, B, i) => (up(S.c, B.ust, i) ? 1 : dn(S.c, B.alt, i) ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? dn(S.c, B.ust, i) : up(S.c, B.alt, i)),
    rules: ['Fiyat üst kanal bandını yukarı keserse AL (kanal kırılımı)', 'Alt bandı aşağı keserse SAT (short)', 'Çıkış: kanala geri dönüş (bant ters kesişimi)'],
    stop: 'Yok',
  },
  {
    id: 'fib', title: 'Fibonacci %50-61,8 Geri Çekilme Alımı', dir: 'long',
    load: (C) => {
      const pl = pivotLevels(C, 5);
      const atr = C.L('atr', { p: 14 }, 'ATR');
      return { ph: pl.phVal, plv: pl.plVal, phi: pl.phIdx, pli: pl.plIdx, atr, stopLvl: pl.plVal };
    },
    entry: (S, B, i) => {
      if (!(B.phi[i] > B.pli[i])) return 0; // son hareket yukarı
      const rng = B.ph[i] - B.plv[i];
      if (!(rng > 2 * B.atr[i])) return 0;
      const zoneTop = B.ph[i] - 0.5 * rng, zoneBot = B.ph[i] - 0.618 * rng;
      if (S.l[i] <= zoneTop && S.c[i] > S.c[i - 1] && S.c[i] >= zoneBot && S.c[i] < B.ph[i]) return 1;
      return 0;
    },
    exit: (S, B, i) => S.c[i] >= B.ph[i],
    stop: { kind: 'level', arr: 'stopLvl' },
    rules: ['Son yukarı impuls (pivot dip→pivot tepe, >2×ATR) sonrası', 'Fiyat %50-61,8 geri çekilme bölgesine inip yukarı dönerse AL', 'Hedef: önceki tepe; stop: impuls dibi'],
  },
  {
    id: 'fibext', title: 'Fibonacci 1,618 Uzantı Hedefli Kırılım', dir: 'long',
    load: (C) => {
      const pl = pivotLevels(C, 5);
      const atr = C.L('atr', { p: 14 }, 'ATR');
      return { ph: pl.phVal, plv: pl.plVal, phi: pl.phIdx, pli: pl.plIdx, atr, stopLvl: pl.plVal };
    },
    entry: (S, B, i) => {
      if (!(B.phi[i] > B.pli[i])) return 0;
      const rng = B.ph[i] - B.plv[i];
      if (!(rng > 2 * B.atr[i])) return 0;
      return S.c[i] > B.ph[i] && S.c[i - 1] <= B.ph[i - 1] ? 1 : 0;
    },
    exit: (S, B, i) => {
      const rng = B.ph[i] - B.plv[i];
      const target = B.plv[i] + 1.618 * rng;
      return S.c[i] >= target || S.c[i] < B.plv[i];
    },
    stop: { kind: 'level', arr: 'stopLvl' },
    rules: ['Fiyat önceki tepeyi kırarsa AL (devam kırılımı)', 'Hedef: impuls dibinden 1,618 Fibonacci uzantısı', 'Stop: impuls dibi'],
  },
  {
    id: 'pivot', title: 'Klasik Pivot (PP/S1/R1) Sekmesi', dir: 'ls',
    load: (C) => {
      const d = C.days();
      const n = C.S.c.length;
      const PP = new Float64Array(n).fill(NaN), S1 = new Float64Array(n).fill(NaN), R1 = new Float64Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        const h = d.prevH[i], l = d.prevL[i], c = d.prevC[i];
        if (Number.isNaN(h)) continue;
        const pp = (h + l + c) / 3;
        PP[i] = pp; S1[i] = 2 * pp - h; R1[i] = 2 * pp - l;
      }
      const barsPerDay = Math.max(1, Math.round(86400000 / TF_MS[C.tf]));
      return { PP, S1, R1, maxBars: barsPerDay };
    },
    entry: (S, B, i) => {
      if (Number.isNaN(B.S1[i])) return 0;
      if (S.l[i] <= B.S1[i] && S.c[i] > B.S1[i]) return 1;
      if (S.h[i] >= B.R1[i] && S.c[i] < B.R1[i]) return -1;
      return 0;
    },
    exit: (S, B, i, pos) => (pos === 1 ? S.c[i] >= B.PP[i] : S.c[i] <= B.PP[i]),
    skipTfs: ['1d', '1w'],
    rules: ['Önceki günün H/L/C\u2019si ile PP, S1, R1 hesaplanır', 'S1\u2019den yukarı dönüş → AL; R1\u2019den aşağı dönüş → SAT (short)', 'Çıkış: PP (orta pivot)', 'Günlük/haftalıkta anlamsız olduğu için yalnızca 5m-4h arası test edilir'],
    stop: 'Yok',
  },
  {
    id: 'orderblock', title: 'Order Block Geri Testi (yaklaşım)', dir: 'ls',
    load: (C) => {
      const S = C.S, n = S.c.length;
      const atr = C.L('atr', { p: 14 }, 'ATR');
      const obT = new Float64Array(n).fill(NaN), obB = new Float64Array(n).fill(NaN), obTg = new Float64Array(n).fill(NaN), obD = new Int8Array(n);
      let aT = NaN, aB = NaN, aTg = NaN, aD = 0, expire = -1;
      for (let i = 2; i < n; i++) {
        // impuls taraması: 1-bar büyük hareket
        if (S.c[i] > S.c[i - 1] + 2 * atr[i] && S.c[i - 1] < S.o[i - 1]) {
          aT = S.h[i - 1]; aB = S.l[i - 1]; aTg = S.h[i]; aD = 1; expire = i + 60;
        } else if (S.c[i] < S.c[i - 1] - 2 * atr[i] && S.c[i - 1] > S.o[i - 1]) {
          aT = S.h[i - 1]; aB = S.l[i - 1]; aTg = S.l[i]; aD = -1; expire = i + 60;
        }
        if (i <= expire) { obT[i] = aT; obB[i] = aB; obTg[i] = aTg; obD[i] = aD; }
        else obD[i] = 0;
      }
      return { obT, obB, obTg, obD, sma50: C.L('ema', { p: 50 }, 'EMA50') };
    },
    entry: (S, B, i) => {
      if (B.obD[i] === 1 && S.c[i] > B.sma50[i]) { if (S.l[i] <= B.obT[i] && S.c[i] > B.obT[i]) return 1; }
      if (B.obD[i] === -1 && S.c[i] < B.sma50[i]) { if (S.h[i] >= B.obB[i] && S.c[i] < B.obB[i]) return -1; }
      return 0;
    },
    exit: (S, B, i, pos) => (pos === 1 ? S.c[i] >= B.obTg[i] : S.c[i] <= B.obTg[i]),
    maxBars: 60,
    stop: { kind: 'level', arr: 'obB', arrShort: 'obT' },
    rules: ['Impuls (1 barda >2×ATR) mumundan önceki ters mum = Order Block', 'Fiyat OB seviyesine geri çekip reddederse yönde gir', 'Stop: OB karşı kenarı; hedef: impuls zirvesi/dibi; 60 bar zaman aşımı'],
    caveat: 'OB tespiti mekanik yaklaşımdır; öznel çizime tam eşdeğer değildir.',
  },
  {
    id: 'fvg', title: 'FVG (Adaletsiz Fiyat Boşluğu) Dolumu', dir: 'ls',
    load: (C) => {
      const S = C.S, n = S.c.length;
      const gT = new Float64Array(n).fill(NaN), gB = new Float64Array(n).fill(NaN), gTg = new Float64Array(n).fill(NaN), gD = new Int8Array(n);
      let aT = NaN, aB = NaN, aTg = NaN, aD = 0, expire = -1;
      for (let i = 2; i < n; i++) {
        if (S.l[i] > S.h[i - 2]) { aT = S.l[i]; aB = S.h[i - 2]; aTg = S.h[i]; aD = 1; expire = i + 60; } // boğa boşluğu
        else if (S.h[i] < S.l[i - 2]) { aT = S.l[i - 2]; aB = S.h[i]; aTg = S.l[i]; aD = -1; expire = i + 60; } // ayı boşluğu
        if (i <= expire) { gT[i] = aT; gB[i] = aB; gTg[i] = aTg; gD[i] = aD; }
        else gD[i] = 0;
      }
      return { gT, gB, gTg, gD };
    },
    entry: (S, B, i) => {
      if (B.gD[i] === 1 && S.l[i] <= B.gT[i] && S.c[i] > B.gT[i]) return 1;
      if (B.gD[i] === -1 && S.h[i] >= B.gB[i] && S.c[i] < B.gB[i]) return -1;
      return 0;
    },
    exit: (S, B, i, pos) => (pos === 1 ? S.c[i] >= B.gTg[i] : S.c[i] <= B.gTg[i]),
    maxBars: 60,
    stop: { kind: 'level', arr: 'gB', arrShort: 'gT' },
    rules: ['3 mum arasında boşluk (FVG) oluşursa bölgeyi izle', 'Fiyat boşluğa geri dönüp doldurup dönerse yönde gir', 'Stop: boşluğun karşı kenarı; 60 bar zaman aşımı'],
  },
  {
    id: 'liquidity', title: 'Likidite Süpürme + Geri Alım', dir: 'ls',
    load: (C) => ({ hi20: C.rollMax(C.S.h, 20), lo20: C.rollMin(C.S.l, 20) }),
    entry: (S, B, i) => {
      if (S.l[i] < B.lo20[i - 1] && S.c[i] > B.lo20[i - 1]) return 1; // dip süpürüldü, geri alındı
      if (S.h[i] > B.hi20[i - 1] && S.c[i] < B.hi20[i - 1]) return -1; // zirve süpürüldü
      return 0;
    },
    maxBars: 30,
    stop: { kind: 'atr', p: 14, mult: 2 },
    rules: ['20-bar dibin altı süpürülüp aynı barda geri alınırsa AL (stop avı sonrası)', '20-bar zirve süpürülüp geri satılırsa SAT (short)', 'Stop: 2×ATR; 30 bar zaman aşımı'],
  },
  {
    id: 'candle1', title: 'Pin Bar / Çekiç Dönüşü', dir: 'ls',
    load: (C) => ({ hi20: C.rollMax(C.S.h, 20), lo20: C.rollMin(C.S.l, 20) }),
    entry: (S, B, i) => {
      const body = Math.abs(S.c[i] - S.o[i]);
      const lowerW = Math.min(S.o[i], S.c[i]) - S.l[i];
      const upperW = S.h[i] - Math.max(S.o[i], S.c[i]);
      if (lowerW > 2 * body && lowerW > upperW && S.l[i] <= B.lo20[i]) return 1;
      if (upperW > 2 * body && upperW > lowerW && S.h[i] >= B.hi20[i]) return -1;
      return 0;
    },
    maxBars: 5,
    rules: ['Uzun alt fitil (≥2×gövde), 20-bar dibinde: ÇEKİÇ → AL', 'Uzun üst fitil, 20-bar zirvesinde: KAYAN YILDIZ → SAT (short)', 'En fazla 5 bar'],
    stop: 'Yok (5 bar zaman stopu)',
  },
  {
    id: 'candle3', title: 'Yutan Mum + 3 Asker/Karga', dir: 'ls',
    load: (C) => ({ sma20: C.L('sma', { p: 20 }, 'SMA20') }),
    entry: (S, B, i) => {
      // boğa yutan: önceki kırmızıyı tam yutan yeşil; düşüş bağlamı
      const bullEng = S.c[i] > S.o[i] && S.c[i - 1] < S.o[i - 1] && S.o[i] <= S.c[i - 1] && S.c[i] >= S.o[i - 1] && S.c[i - 1] < B.sma20[i - 1];
      const bearEng = S.c[i] < S.o[i] && S.c[i - 1] > S.o[i - 1] && S.o[i] >= S.c[i - 1] && S.c[i] <= S.o[i - 1] && S.c[i - 1] > B.sma20[i - 1];
      // 3 beyaz asker: ardışık 3 yeşil, her biri bir öncekinin üstünde
      const threeUp = S.c[i] > S.o[i] && S.c[i - 1] > S.o[i - 1] && S.c[i - 2] > S.o[i - 2] && S.c[i] > S.c[i - 1] && S.c[i - 1] > S.c[i - 2];
      const threeDn = S.c[i] < S.o[i] && S.c[i - 1] < S.o[i - 1] && S.c[i - 2] < S.o[i - 2] && S.c[i] < S.c[i - 1] && S.c[i - 1] < S.c[i - 2];
      if (bullEng || threeUp) return 1;
      if (bearEng || threeDn) return -1;
      return 0;
    },
    maxBars: 8,
    rules: ['Yutan mum veya 3 asker (düşüş bağlamında) → AL', 'Yutan mum veya 3 karga (yükseliş bağlamında) → SAT (short)', 'En fazla 8 bar'],
    stop: 'Yok (8 bar zaman stopu)',
  },
  {
    id: 'patterns', title: 'Sıkışan Üçgen Kırılımı', dir: 'ls',
    load: (C) => {
      const hi = C.rollMax(C.S.h, 20), lo = C.rollMin(C.S.l, 20);
      const n = C.S.c.length, nar = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const rng = hi[i] - lo[i];
        if (!Number.isNaN(rng) && i >= 10 && rng < (hi[i - 10] - lo[i - 10]) * 0.75) nar[i] = 1;
      }
      return { hi, lo, nar };
    },
    entry: (S, B, i) => {
      let recent = 0;
      for (let j = i - 10; j <= i - 1; j++) if (B.nar[j]) { recent = 1; break; }
      if (!recent) return 0;
      if (S.c[i] > B.hi[i - 1]) return 1;
      if (S.c[i] < B.lo[i - 1]) return -1;
      return 0;
    },
    stop: { kind: 'atr', p: 14, mult: 2.5 },
    rules: ['20-bar aralığı daralıyorsa (≤ %75, üçgen sıkışma)', 'Kırılım yönünde gir: zirve üstü AL / dip altı SAT (short)', 'Stop: 2,5×ATR'],
  },
  {
    id: 'hns', title: 'Omuz-Baş-Omuz Boyun Çizgisi Kırılımı (yaklaşım)', dir: 'ls',
    load: (C) => {
      const S = C.S, n = S.c.length, lag = 4, atr = C.L('atr', { p: 14 }, 'ATR');
      const piv = C.piv(lag);
      const hi = piv.hi, lo = piv.lo;
      const shortLvl = new Float64Array(n).fill(NaN), longLvl = new Float64Array(n).fill(NaN);
      // ardışık pivotlar arası uç değerler (iki-işaretçi, O(n))
      const lowsBetween = new Float64Array(Math.max(1, hi.length)).fill(Infinity);
      {
        let li = 0;
        for (let k = 1; k < hi.length; k++) {
          while (li < lo.length && lo[li] <= hi[k - 1]) li++;
          let m = Infinity;
          for (let j = li; j < lo.length && lo[j] < hi[k]; j++) m = Math.min(m, S.l[lo[j]]);
          lowsBetween[k] = m;
        }
      }
      const highsBetween = new Float64Array(Math.max(1, lo.length)).fill(-Infinity);
      {
        let h2p = 0;
        for (let k = 1; k < lo.length; k++) {
          while (h2p < hi.length && hi[h2p] <= lo[k - 1]) h2p++;
          let m = -Infinity;
          for (let j = h2p; j < hi.length && hi[j] < lo[k]; j++) m = Math.max(m, S.h[hi[j]]);
          highsBetween[k] = m;
        }
      }
      for (let k = 2; k < hi.length; k++) {
        const h1 = hi[k - 2], h2 = hi[k - 1], h3 = hi[k];
        const t1 = S.h[h1], t2 = S.h[h2], t3 = S.h[h3];
        const valid = t2 > t1 + 0.3 * atr[h3] && t2 > t3 + 0.3 * atr[h3] && Math.abs(t1 - t3) < 0.6 * (t2 - Math.min(t1, t3));
        if (!valid) continue;
        const neck = Math.min(lowsBetween[k - 1], lowsBetween[k]);
        if (!isFinite(neck)) continue;
        const from = h3 + lag;
        for (let j = from; j < Math.min(n, from + 120); j++) shortLvl[j] = neck;
      }
      for (let k = 2; k < lo.length; k++) {
        const l1 = lo[k - 2], l2 = lo[k - 1], l3 = lo[k];
        const b1 = S.l[l1], b2 = S.l[l2], b3 = S.l[l3];
        const valid = b2 < b1 - 0.3 * atr[l3] && b2 < b3 - 0.3 * atr[l3] && Math.abs(b1 - b3) < 0.6 * (Math.max(b1, b3) - b2);
        if (!valid) continue;
        const neck = Math.max(highsBetween[k - 1], highsBetween[k]);
        if (!isFinite(neck)) continue;
        const from = l3 + lag;
        for (let j = from; j < Math.min(n, from + 120); j++) longLvl[j] = neck;
      }
      return { shortLvl, longLvl };
    },
    entry: (S, B, i) => {
      if (!Number.isNaN(B.shortLvl[i]) && S.c[i] < B.shortLvl[i] && S.c[i - 1] >= B.shortLvl[i - 1]) return -1;
      if (!Number.isNaN(B.longLvl[i]) && S.c[i] > B.longLvl[i] && S.c[i - 1] <= B.longLvl[i - 1]) return 1;
      return 0;
    },
    maxBars: 80,
    stop: { kind: 'atr', p: 14, mult: 2.5 },
    rules: ['Pivotlardan OBO (yüksek orta tepe + benzer omuzlar) tespit edilir', 'Boyun çizgisi aşağı kırılırsa SAT (short); ters OBO yukarı kırılırsa AL', 'Stop: 2,5×ATR; 80 bar zaman aşımı'],
    caveat: 'Formasyon tespiti pivot kurallarına dayalı yaklaşımdır.',
  },
  {
    id: 'double', title: 'İkiz Tepe / İkiz Dip Kırılımı (yaklaşım)', dir: 'ls',
    load: (C) => {
      const S = C.S, n = S.c.length, lag = 4;
      const piv = C.piv(lag);
      const shortLvl = new Float64Array(n).fill(NaN), longLvl = new Float64Array(n).fill(NaN);
      const hi = piv.hi, lo = piv.lo;
      const lowsBetween = new Float64Array(Math.max(1, hi.length)).fill(Infinity);
      {
        let li = 0;
        for (let k = 1; k < hi.length; k++) {
          while (li < lo.length && lo[li] <= hi[k - 1]) li++;
          let m = Infinity;
          for (let j = li; j < lo.length && lo[j] < hi[k]; j++) m = Math.min(m, S.l[lo[j]]);
          lowsBetween[k] = m;
        }
      }
      const highsBetween = new Float64Array(Math.max(1, lo.length)).fill(-Infinity);
      {
        let h2p = 0;
        for (let k = 1; k < lo.length; k++) {
          while (h2p < hi.length && hi[h2p] <= lo[k - 1]) h2p++;
          let m = -Infinity;
          for (let j = h2p; j < hi.length && hi[j] < lo[k]; j++) m = Math.max(m, S.h[hi[j]]);
          highsBetween[k] = m;
        }
      }
      for (let k = 1; k < hi.length; k++) {
        const h1 = hi[k - 1], h2 = hi[k];
        if (Math.abs(S.h[h2] - S.h[h1]) / S.h[h1] > 0.015) continue;
        const neck = lowsBetween[k];
        if (!isFinite(neck)) continue;
        const from = h2 + lag;
        for (let j = from; j < Math.min(n, from + 90); j++) shortLvl[j] = neck;
      }
      for (let k = 1; k < lo.length; k++) {
        const l1 = lo[k - 1], l2 = lo[k];
        if (Math.abs(S.l[l2] - S.l[l1]) / S.l[l1] > 0.015) continue;
        const neck = highsBetween[k];
        if (!isFinite(neck)) continue;
        const from = l2 + lag;
        for (let j = from; j < Math.min(n, from + 90); j++) longLvl[j] = neck;
      }
      return { shortLvl, longLvl };
    },
    entry: (S, B, i) => {
      if (!Number.isNaN(B.shortLvl[i]) && S.c[i] < B.shortLvl[i] && S.c[i - 1] >= B.shortLvl[i - 1]) return -1;
      if (!Number.isNaN(B.longLvl[i]) && S.c[i] > B.longLvl[i] && S.c[i - 1] <= B.longLvl[i - 1]) return 1;
      return 0;
    },
    maxBars: 60,
    stop: { kind: 'atr', p: 14, mult: 2.5 },
    rules: ['Yaklaşık aynı seviyede iki pivot tepe (≤ %1,5 fark): ikiz tepe', 'Ara dip (boyun) kırılırsa SAT; ikiz dip boyun kırılırsa AL', 'Stop: 2,5×ATR; 60 bar zaman aşımı'],
  },
  {
    id: 'breakout', title: '30-Bar Kırılım Sistemi', dir: 'ls',
    load: (C) => ({
      hi30: C.rollMax(C.S.h, 30), lo30: C.rollMin(C.S.l, 30),
      hi15: C.rollMax(C.S.h, 15), lo15: C.rollMin(C.S.l, 15),
    }),
    entry: (S, B, i) => (S.c[i] > B.hi30[i - 1] ? 1 : S.c[i] < B.lo30[i - 1] ? -1 : 0),
    exit: (S, B, i, pos) => (pos === 1 ? S.c[i] < B.lo15[i - 1] : S.c[i] > B.hi15[i - 1]),
    stop: { kind: 'atr', p: 14, mult: 2.5 },
    rules: ['30-bar zirvesi üstüne kapanış → AL', '30-bar dibi altına kapanış → SAT (short)', 'Çıkış: 15-bar kanal; stop: 2,5×ATR'],
  },
  {
    id: 'elliott', title: 'Dalga 3 Devam Kırılımı (yaklaşım)', dir: 'long',
    load: (C) => {
      const S = C.S, n = S.c.length;
      const hi50 = C.rollMax(S.c, 50);
      const entryFlag = new Int8Array(n);
      const stopLvl = new Float64Array(n).fill(NaN);
      let phase = 0, peak = NaN, startLow = NaN, retLow = NaN, barsUp = 0;
      for (let i = 60; i < n; i++) {
        const newHigh = S.c[i] >= hi50[i] && (hi50[i] !== hi50[i - 1] || S.c[i] > S.h[i - 1] && i === 60);
        if (phase === 0) {
          if (newHigh) {
            let sl = Infinity;
            for (let j = i - 20; j <= i; j++) sl = Math.min(sl, S.l[j]);
            phase = 1; peak = S.c[i]; startLow = sl; barsUp = 1;
          }
        } else if (phase === 1) {
          if (newHigh) { peak = S.c[i]; barsUp++; }
          else if (barsUp >= 3) { phase = 2; retLow = S.l[i]; }
          else phase = 0;
        } else if (phase === 2) {
          retLow = Math.min(retLow, S.l[i]);
          if (S.c[i] > peak) {
            if (retLow > startLow) { entryFlag[i] = 1; stopLvl[i] = retLow; }
            phase = 0;
          } else if (S.c[i] < startLow || i - barsUp > 200) phase = 0;
        }
      }
      return { entryFlag, stopLvl };
    },
    entry: (S, B, i) => B.entryFlag[i] === 1 ? 1 : 0,
    maxBars: 40,
    stop: { kind: 'level', arr: 'stopLvl' },
    rules: ['50-bar zirvesi kıran impuls (dalga 1) izlenir', 'Geri çekilme (dalga 2) dalga 1 dibinin üstünde kalırsa', 'Dalga 1 zirvesi kırılınca (dalga 3 başlangıcı) AL', 'Stop: dalga 2 dibi; 40 bar zaman aşımı'],
    caveat: 'Dalga sayımı otomatik yaklaşımdır; öznel sayımın yerini tutmaz.',
  },
  {
    id: 'harmonic', title: 'Harmonik 0,618-0,786 Bölgesi Dönüşü (yaklaşım)', dir: 'long',
    load: (C) => {
      const pl = pivotLevels(C, 5);
      const atr = C.L('atr', { p: 14 }, 'ATR');
      const n = C.S.c.length, stopL = new Float64Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (!Number.isNaN(pl.phVal[i]) && !Number.isNaN(pl.plVal[i])) stopL[i] = pl.phVal[i] - 0.886 * (pl.phVal[i] - pl.plVal[i]);
      }
      return { ph: pl.phVal, plv: pl.plVal, phi: pl.phIdx, pli: pl.plIdx, atr, stopL };
    },
    entry: (S, B, i) => {
      if (!(B.phi[i] > B.pli[i])) return 0;
      const rng = B.ph[i] - B.plv[i];
      if (!(rng > 2.5 * B.atr[i])) return 0;
      const zoneTop = B.ph[i] - 0.618 * rng, zoneBot = B.ph[i] - 0.786 * rng;
      if (S.l[i] <= zoneTop && S.c[i] > S.c[i - 1] && S.c[i] >= zoneBot && S.c[i] < B.ph[i]) return 1;
      return 0;
    },
    exit: (S, B, i) => {
      const rng = B.ph[i] - B.plv[i];
      return S.c[i] >= B.ph[i] + 0.272 * rng;
    },
    stop: { kind: 'level', arr: 'stopL' },
    rules: ['Yukarı impuls sonrası %61,8-78,6 (D noktası) bölgesine geri çekilme', 'Bölgede yukarı dönüş mumu gelirse AL (ipotetik Gartley benzeri)', 'Hedef: 1,272 uzantı; stop: %88,6 seviyesi'],
    caveat: 'Fibonacci oranlarına dayalı basitleştirilmiş harmonik yaklaşımdır.',
  },
  {
    id: 'wyckoff', title: 'Wyckoff Yay/Spring Dönüşü', dir: 'ls',
    load: (C) => {
      const hi20 = C.rollMax(C.S.h, 20), lo20 = C.rollMin(C.S.l, 20);
      const av = C.smaOf(C.S.v, 20);
      return { hi20, lo20, av };
    },
    entry: (S, B, i) => {
      const volLow = S.v[i] < B.av[i];
      if (S.l[i] < B.lo20[i - 1] && S.c[i] > B.lo20[i - 1] && volLow) return 1;  // spring
      if (S.h[i] > B.hi20[i - 1] && S.c[i] < B.hi20[i - 1] && volLow) return -1; // upthrust
      return 0;
    },
    maxBars: 25,
    stop: { kind: 'level', arr: 'l', arrShort: 'h' },
    rules: ['Aralık dibi DÜŞÜK hacimle süpürülüp geri alınırsa: SPRING → AL', 'Aralık zirvesi düşük hacimle süpürülüp geri satılırsa: UPTHRUST → SAT (short)', 'Stop: süpürme barının ucu; 25 bar zaman aşımı'],
    caveat: 'Wyckoff fazlarının mekanikleştirilmiş (spring/upthrust) yaklaşımıdır.',
  },
  {
    id: 'mprofile', title: 'POC Göçü Trendi (yaklaşım)', dir: 'ls',
    load: (C) => {
      const poc = C.vwapRoll(C.S, 50);
      return { poc };
    },
    entry: (S, B, i) => {
      const upSlope = B.poc[i] > B.poc[i - 5], dnSlope = B.poc[i] < B.poc[i - 5];
      if (up(S.c, B.poc, i) && upSlope) return 1;
      if (dn(S.c, B.poc, i) && dnSlope) return -1;
      return 0;
    },
    rules: ['50-bar VWAP (POC vekili) yükselirken fiyat üstüne çıkarsa AL', 'POC düşerken fiyat altına inerse SAT (short)', 'Değer alanının kayması trend olarak yorumlanır'],
    stop: 'Yok (ters sinyal)',
    caveat: 'Gerçek POC yerine kayan VWAP vekili kullanılır.',
  },
  {
    id: 'orb', title: 'Açılış Aralığı Kırılımı (ORB)', dir: 'ls',
    load: (C) => {
      const S = C.S, n = S.c.length, d = C.days();
      const K = C.tf === '5m' ? 6 : C.tf === '15m' ? 2 : 1; // ilk 30 dk
      const orH = new Float64Array(n).fill(NaN), orL = new Float64Array(n).fill(NaN);
      const dayEnd = new Uint8Array(n);
      let i = 0;
      while (i < n) {
        let j = i;
        while (j + 1 < n && d.day[j + 1] === d.day[i]) j++;
        let h = -Infinity, l = Infinity;
        for (let k = 0; k < K && i + k <= j; k++) { h = Math.max(h, S.h[i + k]); l = Math.min(l, S.l[i + k]); }
        for (let k2 = i + K; k2 <= j; k2++) { orH[k2] = h; orL[k2] = l; }
        dayEnd[j] = 1;
        i = j + 1;
      }
      return { orH, orL, dayEnd };
    },
    entry: (S, B, i) => {
      if (Number.isNaN(B.orH[i])) return 0;
      const prevAbove = S.c[i - 1] > B.orH[i - 1], prevBelow = S.c[i - 1] < B.orL[i - 1];
      if (S.c[i] > B.orH[i] && !prevAbove) return 1;
      if (S.c[i] < B.orL[i] && !prevBelow) return -1;
      return 0;
    },
    exit: (S, B, i) => B.dayEnd[i] === 1,
    skipTfs: ['4h', '1d', '1w'],
    rules: ['Günün ilk 30 dakikası aralığı belirler (5m: 6 bar, 15m: 2 bar, 1h: 1 bar)', 'Aralık üstü kırılım → AL; altı kırılım → SAT (short)', 'Gün sonunda pozisyon kapanır', '4h+ zaman dilimlerinde gün içi kavram anlamsız → test dışı'],
    stop: 'Yok (gün sonu çıkış)',
  },
  {
    id: 'mtf', title: 'Çoklu Zaman Dilimi Trend + EMA(20) Tetiği', dir: 'ls',
    load: (C) => {
      const k = { '5m': 48, '15m': 16, '1h': 4, '4h': 6, '1d': 7 }[C.tf] || 7;
      return { dirH: C.higherDir(k, 20, 50), e: C.L('ema', { p: 20 }, 'EMA20') };
    },
    entry: (S, B, i) => {
      if (B.dirH[i] === 1 && up(S.c, B.e, i)) return 1;
      if (B.dirH[i] === -1 && dn(S.c, B.e, i)) return -1;
      return 0;
    },
    exit: (S, B, i, pos) => (pos === 1 ? dn(S.c, B.e, i) : up(S.c, B.e, i)),
    skipTfs: ['1w'],
    rules: ['Üst zaman diliminde (4h üstü: günlük; 1d: haftalık) EMA20>EMA50 ise trend yukarı sayılır', 'Alt dilimde fiyat EMA(20)\u2019yi trend yönünde kesince gir', 'Çıkış: EMA(20) ters kesişimi', 'Haftalıkta üst dilim yok → test dışı'],
    stop: 'Yok',
  },
];

export const BT_STRATEGIES = [...TREND, ...MOMENTUM, ...HACIM, ...VOLATILITE, ...YAPI];

export const STRATEGY_BY_ID = Object.fromEntries(BT_STRATEGIES.map((s) => [s.id, s]));

export const BT_CATEGORY_OF = Object.fromEntries([
  ...TREND.map((s) => [s.id, 'trend']),
  ...MOMENTUM.map((s) => [s.id, 'momentum']),
  ...HACIM.map((s) => [s.id, 'hacim']),
  ...VOLATILITE.map((s) => [s.id, 'volatilite']),
  ...YAPI.map((s) => [s.id, 'yapi']),
]);
