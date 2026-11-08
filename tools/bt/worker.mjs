// İndikatör Akademi — Backtest motoru · İşçi (worker_threads)
import { parentPort, workerData } from 'node:worker_threads';
import { openSync, writeSync, closeSync } from 'node:fs';
import { makeCtx, clearCache } from './io.mjs';
import { BT_STRATEGIES } from './strategies.mjs';
import { simulate, symbolStats, sampleEquity } from './sim.mjs';
import { GRID, newAcc, addSymbolResult } from './agg.mjs';
import { newAgg, addTrade, buildMask, finalizeInto, scenBytes } from './dashagg.mjs';
import { initFeatures, makeFeat } from './features.mjs';

const tfs = workerData.tfs;
const symbols = workerData.symbols;
const STRATEGIES = workerData.only && workerData.only.length
  ? BT_STRATEGIES.filter((s) => workerData.only.includes(s.id))
  : BT_STRATEGIES;

const accs = {};
for (const s of STRATEGIES) {
  accs[s.id] = {};
  for (const tf of tfs) accs[s.id][tf] = newAcc();
}
const errors = [];

/* ------------------------- dashboard kayıt modu ------------------------- */
const REC = workerData.recOut || null;
const scenarioIds = workerData.scenarioIds || {};
const symIds = workerData.symIds || {};
const nSym = workerData.nSym || 0;
const nScen = workerData.nScen || 0;
let aggs = null, recFd = null, featOut = null;
if (REC) {
  await initFeatures(tfs);
  aggs = Array.from({ length: nScen }, () => newAgg(nSym));
  recFd = openSync(REC, 'w');
  featOut = new Float64Array(17);
}

for (const symbol of symbols) {
  for (const tf of tfs) {
    let ctx;
    try {
      ctx = await makeCtx(tf, symbol);
    } catch (e) {
      errors.push({ symbol, tf, id: '-', msg: e.message });
      continue;
    }
    const feat = REC ? makeFeat(ctx) : null;
    for (const spec of STRATEGIES) {
      if (spec.skipTfs && spec.skipTfs.includes(tf)) continue;
      try {
        let rec = null;
        if (REC) {
          const sidx = scenarioIds[spec.id + '|' + tf];
          const agg = aggs[sidx];
          const symIdx = symIds[symbol];
          let mask = 0;
          rec = {
            open(i, d) { feat(i, featOut); mask = buildMask(featOut, d); },
            trade(side, exitMs, r, durMin) { addTrade(agg, mask, symIdx, exitMs, r, durMin); },
          };
        }
        const { trades, errCount, firstErr, i0, i1 } = simulate(spec, ctx, rec);
        if (errCount) errors.push({ symbol, tf, id: spec.id, msg: `entry/exit hatası ×${errCount}: ${firstErr}` });
        if (!trades.length) continue;
        const st = symbolStats(trades, ctx.S, i0, i1);
        if (!st) continue;
        const eq = sampleEquity(trades, ctx.S, GRID);
        addSymbolResult(accs[spec.id][tf], symbol, trades, st, eq);
      } catch (e) {
        errors.push({ symbol, tf, id: spec.id, msg: e.message });
      }
    }
  }
  clearCache(); // sembol bitti — seri/funding önbelleğini boşalt
  parentPort.postMessage({ type: 'progress', symbol });
}

const payload = {};
for (const s of STRATEGIES) {
  payload[s.id] = {};
  for (const tf of tfs) payload[s.id][tf] = accs[s.id][tf];
}

if (REC) {
  const per = scenBytes(nSym);
  const buf = Buffer.allocUnsafeSlow(per);
  for (let s = 0; s < aggs.length; s++) {
    finalizeInto(aggs[s], buf);
    writeSync(recFd, buf, 0, per);
  }
  closeSync(recFd);
  aggs = null;
}

parentPort.postMessage({ type: 'done', payload, errors, rec: REC });
