// İndikatör Akademi — Backtest motoru · Toplulaştırma ve JSON üretimi
export const GRID = (() => {
  const start = Date.UTC(2022, 7, 1), end = Date.UTC(2026, 8, 8);
  const out = [];
  for (let t = start; t <= end; t += 7 * 86400000) out.push(t);
  return out;
})();

export const HIST_N = 82; // -10%..+10% arası 0,25'lik 80 kova + alt/üst taşma

export function histIndex(r) {
  const pct = r * 100;
  let idx = Math.floor((pct + 10) / 0.25);
  if (idx < 0) return 80;
  if (idx >= 80) return 81;
  return idx;
}

export function newAcc() {
  return {
    pool: { n: 0, sum: 0, sum2: 0, wins: 0, grossW: 0, grossL: 0, bars: 0, best: -1, worst: 1 },
    hist: new Int32Array(HIST_N),
    years: {},           // '2022' → { n, wins, sumLog }
    syms: {},            // symbol → stats
    eqSums: new Float64Array(GRID.length),
    eqCnts: new Int32Array(GRID.length),
  };
}

export function addSymbolResult(acc, symbol, trades, stats, eq) {
  const p = acc.pool;
  for (const t of trades) {
    p.n++; p.sum += t.r; p.sum2 += t.r * t.r;
    if (t.r > 0) { p.wins++; p.grossW += t.r; } else p.grossL -= t.r;
    p.bars += t.bars;
    if (t.r > p.best) p.best = t.r;
    if (t.r < p.worst) p.worst = t.r;
    acc.hist[histIndex(t.r)]++;
    // Yıl istatistikleri yalnızca eğri penceresine (GRID başlangıcından
    // sonrası) giren işlemlerden sayılır — yıllık getiriyle tutarlı olsun.
    if (t.xt >= GRID[0]) {
      const y = String(new Date(t.xt).getUTCFullYear());
      let ya = acc.years[y];
      if (!ya) ya = acc.years[y] = { n: 0, wins: 0 };
      ya.n++;
      if (t.r > 0) ya.wins++;
    }
  }
  acc.syms[symbol] = stats;
  for (let g = 0; g < GRID.length; g++) {
    const v = eq[g];
    if (!Number.isNaN(v)) { acc.eqSums[g] += v; acc.eqCnts[g]++; }
  }
}

export function mergeAcc(dst, src) {
  const a = dst.pool, b = src.pool;
  a.n += b.n; a.sum += b.sum; a.sum2 += b.sum2; a.wins += b.wins;
  a.grossW += b.grossW; a.grossL += b.grossL; a.bars += b.bars;
  if (b.best > a.best) a.best = b.best;
  if (b.worst < a.worst) a.worst = b.worst;
  for (let i = 0; i < HIST_N; i++) dst.hist[i] += src.hist[i];
  for (const [y, ya] of Object.entries(src.years)) {
    let d = dst.years[y];
    if (!d) d = dst.years[y] = { n: 0, wins: 0 };
    d.n += ya.n; d.wins += ya.wins;
  }
  for (const [s, st] of Object.entries(src.syms)) dst.syms[s] = st;
  for (let g = 0; g < GRID.length; g++) { dst.eqSums[g] += src.eqSums[g]; dst.eqCnts[g] += src.eqCnts[g]; }
}

const r4 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
const r3 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e3) / 1e3);

// acc → indikatör JSON gövdesi
export function finalizeIndicator(id, metaOf, accByTf, symbols, tfs) {
  const out = {
    id,
    gen: new Date().toISOString().slice(0, 10),
    engine: 'ia-bt-v1',
    ...metaOf,
    meta: {
      symbols: symbols.length,
      tfs,
      gridStart: GRID[0],
      gridStepMs: 7 * 86400000,
      fees: '%0,04 taker + 1bp kayma / bacak',
      funding: 'gerçek funding olayları dahil',
      note: 'Sinyal kapanışta üretilir, emir sonraki barın açılışında uygulanır. Kaldıraç yok (1x).',
    },
    sum: {},
    eq: {},
    hist: {},
    heat: {},
    years: {},
  };

  for (const tf of tfs) {
    const acc = accByTf[tf];
    if (!acc || acc.pool.n < 1) { out.sum[tf] = null; continue; }
    const p = acc.pool;
    const avg = p.sum / p.n;
    const sd = Math.sqrt(Math.max(0, p.sum2 / p.n - avg * avg));
    const wr = p.wins / p.n;
    const pf = p.grossL > 1e-9 ? p.grossW / p.grossL : (p.grossW > 0 ? 99 : 0);

    // portföy eğrisi (eşit ağırlıklı ortalama)
    const eq = GRID.map((_, g) => (acc.eqCnts[g] ? acc.eqSums[g] / acc.eqCnts[g] : null));
    let peak = -Infinity, dd = 0;
    for (const v of eq) {
      if (v == null) continue;
      if (v > peak) peak = v;
      const d = v / peak - 1;
      if (d < dd) dd = d;
    }
    const lastEq = [...eq].reverse().find((v) => v != null) ?? 1;

    const symEntries = Object.entries(acc.syms).filter(([, s]) => s.n >= 3);
    const sorted = symEntries.slice().sort((a, b) => b[1].avg - a[1].avg);
    const posN = symEntries.filter(([, s]) => s.avg > 0).length;

    out.sum[tf] = {
      n: p.n,
      wr: r3(wr),
      avg: r4(avg),
      sd: r4(sd),
      pf: r3(Math.min(pf, 99)),
      tot: r4(lastEq - 1),
      dd: r4(dd),
      bars: r3(p.bars / p.n),
      best: r4(p.best),
      worst: r4(p.worst),
      nsym: symEntries.length,
      pos: symEntries.length ? r3(posN / symEntries.length) : 0,
      top: sorted[0] ? [sorted[0][0], r4(sorted[0][1].avg)] : null,
      bot: sorted.length > 1 ? [sorted[sorted.length - 1][0], r4(sorted[sorted.length - 1][1].avg)] : null,
    };
    out.eq[tf] = eq.map((v) => r4(v));
    out.hist[tf] = Array.from(acc.hist);

    const heat = { avg: {}, wr: {}, n: {}, dd: {}, pf: {}, bh: {} };
    for (const [s, st] of Object.entries(acc.syms)) {
      heat.avg[s] = r4(st.avg);
      heat.wr[s] = r3(st.wr);
      heat.n[s] = st.n;
      heat.dd[s] = r4(st.dd);
      heat.pf[s] = r3(Math.min(st.pf, 99));
      heat.bh[s] = r4(st.bh);
    }
    out.heat[tf] = heat;

    const years = {};
    // Yıllık getiri PORTFÖY eğrisinden: yıl sonu değeri / önceki yıl sonu - 1.
    // İlk yıl (2022) ızgara Ağustos'ta başladığı için taban, eğrinin ilk
    // değeridir → "2022 (Ağu-Ara)" penceresi. Kazanma oranı ve adet, aynı
    // pencereye düşen işlemlerden gelir (bkz. addSymbolResult).
    // (Eski yöntem tüm işlemleri art arda bileşikliyordu; uç işlemler değeri
    //  astronomik şişiriyordu.)
    const yearEnds = new Map();
    let firstEq = null;
    for (let g = 0; g < GRID.length; g++) {
      if (eq[g] == null) continue;
      if (firstEq === null) firstEq = eq[g];
      yearEnds.set(new Date(GRID[g]).getUTCFullYear(), eq[g]);
    }
    let prevEnd = firstEq ?? 1;
    for (const y of [...yearEnds.keys()].sort((a, b) => a - b)) {
      const end = yearEnds.get(y);
      const ya = acc.years[String(y)] || { n: 0, wins: 0 };
      years[y] = [r4(end / prevEnd - 1), r3(ya.wins / Math.max(1, ya.n)), ya.n];
      prevEnd = end;
    }
    out.years[tf] = years;
  }
  return out;
}
