// İndikatör Akademi — Singular-Backtest işçisi (worker_threads)
// Bir sembol bloğunu işler: 100 indikatör × 6 TF simülasyonu, 31 filtre
// maskesi, kapsam bazında (varsayılan: indikatör) tek pozisyon kuralı.
// Normal metrikler üretilmez; onlar `tools/dash/data/agg/*.bin` dosyalarından
// birebir okunur. Burada yalnızca tekil (singular) toplamlar ve normal işlem
// sayısı doğrulaması biriktirilir.
import { parentPort, workerData } from 'node:worker_threads';
import { BT_STRATEGIES } from '../tools/bt/strategies.mjs';
import { simulate } from '../tools/bt/sim.mjs';
import { initFeatures, makeFeat } from '../tools/bt/features.mjs';
import { buildMask, F, ND, DAY0 } from '../tools/bt/dashagg.mjs';
import { TFS } from '../tools/bt/io.mjs';
import { makeCtx, clearMemCache } from './loader.mjs';

const symbols = workerData.symbols;
const tfs = workerData.tfs || TFS;
const scope = workerData.scope || 'indicator';
const NS = workerData.nSymbols || symbols.length;
const IDX = new Map(BT_STRATEGIES.map((s, i) => [s.id, i]));
const NSC = BT_STRATEGIES.length * tfs.length; // 600
const NIND = BT_STRATEGIES.length;             // 100
const Y26 = Date.UTC(2026, 0, 1);

const S = NSC * F; // 18.600 senaryo-filtre satırı
const I = NIND * F; // 3.100 indikatör-filtre satırı

// skaler biriktiriciler
const sN = new Float64Array(S), sWins = new Float64Array(S), sSum = new Float64Array(S);
const sSum26 = new Float64Array(S), sN26 = new Float64Array(S);
const sDurSum = new Float64Array(S), sDurWin = new Float64Array(S);
const sGrossW = new Float64Array(S), sGrossL = new Float64Array(S);
const sBest = new Float64Array(S).fill(-9), sWorst = new Float64Array(S).fill(9);
const iN = new Float64Array(I), iWins = new Float64Array(I), iSum = new Float64Array(I);
const iSum26 = new Float64Array(I), iN26 = new Float64Array(I);
const iDurSum = new Float64Array(I), iDurWin = new Float64Array(I);
const iGrossW = new Float64Array(I), iGrossL = new Float64Array(I);
const iBest = new Float64Array(I).fill(-9), iWorst = new Float64Array(I).fill(9);
// günlük net (r toplamı)
const sDaily = new Float32Array(S * ND);
const iDaily = new Float32Array(I * ND);
// filtre 0 için normal işlem sayısı (bin n[0] doğrulaması)
const normalN = new Int32Array(NSC);
// coin kırılımı (filtre 0): id|sym -> [nN,sumN,wN,nS,sumS,wS]
const coins = new Map();
const errors = [];

const t0 = Date.now();
await initFeatures(tfs);

const featOut = new Float64Array(17);

function coinAcc(idIdx, sym) {
  const key = idIdx + '|' + sym;
  let a = coins.get(key);
  if (!a) { a = [0, 0, 0, 0, 0, 0]; coins.set(key, a); }
  return a;
}

for (let wi = 0; wi < symbols.length; wi++) {
  const symbol = symbols[wi];
  const symIdx = wi;
  // ctx ve özellik fonksiyonları TF başına bir kez
  const ctxs = {};
  const feats = {};
  for (const tf of tfs) {
    try {
      const ctx = await makeCtx(tf, symbol);
      ctxs[tf] = ctx;
      feats[tf] = makeFeat(ctx);
    } catch (e) {
      errors.push({ symbol, tf, msg: e.message });
    }
  }

  for (let idIdx = 0; idIdx < BT_STRATEGIES.length; idIdx++) {
    const spec = BT_STRATEGIES[idIdx];
    // TF akışları
    const streams = [];
    const streamTf = [];
    for (let ti = 0; ti < tfs.length; ti++) {
      const tf = tfs[ti];
      if (!ctxs[tf]) continue;
      if (spec.skipTfs && spec.skipTfs.includes(tf)) continue;
      let cur = null;
      const et = [], xt = [], rr = [], dd = [], du = [], mk = [];
      const feat = feats[tf];
      const rec = {
        open(i, d) {
          feat(i, featOut);
          cur = { i, d, mask: buildMask(featOut, d) };
        },
        trade(side, exitMs, r, durMin) {
          if (!cur) return;
          et.push(ctxs[tf].S.t[cur.i]);
          xt.push(exitMs);
          rr.push(r);
          dd.push(side);
          du.push(durMin);
          mk.push(cur.mask);
          cur = null;
        },
      };
      try {
        simulate(spec, ctxs[tf], rec);
      } catch (e) {
        errors.push({ symbol, tf, id: spec.id, msg: e.message });
      }
      if (et.length) {
        streams.push({ et, xt, r: rr, d: dd, dur: du, mask: mk });
        streamTf.push(ti);
      }
    }
    if (!streams.length) continue;

    // 6 akışı giriş zamanına göre birleştir (kısa TF öncelikli)
    let T = 0;
    for (const st of streams) T += st.et.length;
    const MET = new Float64Array(T), MXT = new Float64Array(T), MR = new Float64Array(T),
      MDU = new Float64Array(T), MMK = new Uint32Array(T);
    const MTF = new Uint8Array(T);
    mergeInto(streams, streamTf, MET, MXT, MR, MDU, MMK, MTF);

    // normal işlem sayısı (senaryo, filtre 0)
    const perTfN = new Int32Array(tfs.length);
    for (let k = 0; k < T; k++) perTfN[MTF[k]]++;
    for (let ti = 0; ti < tfs.length; ti++) normalN[idIdx * tfs.length + ti] += perTfN[ti];

    // tekil tarama: her filtre kendi son çıkışını izler
    const last = new Float64Array(F).fill(-1);
    for (let k = 0; k < T; k++) {
      const etv = MET[k], xtv = MXT[k], r = MR[k];
      const dur = MDU[k];
      const win = r > 0 ? 1 : 0;
      const day = Math.floor((xtv - DAY0) / 86400000);
      const y26 = xtv >= Y26;
      const ti = MTF[k];
      const si = idIdx * tfs.length + ti;
      let m = MMK[k] | 1;
      while (m) {
        const lb = m & -m;
        const f = 31 - Math.clz32(lb);
        m ^= lb;
        if (etv < last[f]) continue;
        last[f] = xtv;

        const rs = si * F + f;
        sN[rs]++; sWins[rs] += win; sSum[rs] += r;
        sDurSum[rs] += dur; if (win) sDurWin[rs] += dur;
        if (r > 0) sGrossW[rs] += r; else sGrossL[rs] -= r;
        if (r > sBest[rs]) sBest[rs] = r;
        if (r < sWorst[rs]) sWorst[rs] = r;
        if (y26) { sSum26[rs] += r; sN26[rs]++; }
        if (day >= 0 && day < ND) sDaily[rs * ND + day] += r;

        const ri = idIdx * F + f;
        iN[ri]++; iWins[ri] += win; iSum[ri] += r;
        iDurSum[ri] += dur; if (win) iDurWin[ri] += dur;
        if (r > 0) iGrossW[ri] += r; else iGrossL[ri] -= r;
        if (r > iBest[ri]) iBest[ri] = r;
        if (r < iWorst[ri]) iWorst[ri] = r;
        if (y26) { iSum26[ri] += r; iN26[ri]++; }
        if (day >= 0 && day < ND) iDaily[ri * ND + day] += r;
      }
    }

    // coin toplamları (filtre 0)
    const ca = coinAcc(idIdx, symbol);
    for (let k = 0; k < T; k++) {
      ca[0]++;
      ca[1] += MR[k];
      if (MR[k] > 0) ca[2]++;
      // tekil kabul: filtre 0 her zaman açık; son çıkışı yeniden izle
    }
    // tekil coin sayımı ayrı tarama (filtre 0)
    let last0 = -1;
    for (let k = 0; k < T; k++) {
      if (MET[k] < last0) continue;
      last0 = MXT[k];
      ca[3]++;
      ca[4] += MR[k];
      if (MR[k] > 0) ca[5]++;
    }
  }

  clearMemCache();
  parentPort.postMessage({ type: 'progress', symbol, done: wi + 1, total: symbols.length, secs: (Date.now() - t0) / 1000 });
}

function mergeInto(streams, streamTf, MET, MXT, MR, MDU, MMK, MTF) {
  const ptr = new Int32Array(streams.length);
  const lens = streams.map((s) => s.et.length);
  let k = 0;
  for (;;) {
    let best = -1, bestEt = Infinity, bestTf = 99;
    for (let s = 0; s < streams.length; s++) {
      const p = ptr[s];
      if (p >= lens[s]) continue;
      const et = streams[s].et[p];
      if (et < bestEt || (et === bestEt && streamTf[s] < bestTf)) {
        bestEt = et; best = s; bestTf = streamTf[s];
      }
    }
    if (best < 0) break;
    const st = streams[best];
    const j = ptr[best]++;
    MET[k] = st.et[j]; MXT[k] = st.xt[j]; MR[k] = st.r[j];
    MDU[k] = st.dur[j]; MMK[k] = st.mask[j]; MTF[k] = streamTf[best];
    k++;
  }
  return k;
}

// coin map'i aktarılabilir diziye çevir
const coinKeys = [...coins.keys()];
const coinVals = new Float64Array(coinKeys.length * 6);
for (let i = 0; i < coinKeys.length; i++) {
  const a = coins.get(coinKeys[i]);
  for (let k = 0; k < 6; k++) coinVals[i * 6 + k] = a[k];
}

parentPort.postMessage({
  type: 'done',
  errors,
  elapsed: (Date.now() - t0) / 1000,
  sN, sWins, sSum, sSum26, sN26, sDurSum, sDurWin, sGrossW, sGrossL, sBest, sWorst,
  iN, iWins, iSum, iSum26, iN26, iDurSum, iDurWin, iGrossW, iGrossL, iBest, iWorst,
  sDaily, iDaily, normalN, coinKeys, coinVals,
}, [
  sN.buffer, sWins.buffer, sSum.buffer, sSum26.buffer, sN26.buffer,
  sDurSum.buffer, sDurWin.buffer, sGrossW.buffer, sGrossL.buffer, sBest.buffer, sWorst.buffer,
  iN.buffer, iWins.buffer, iSum.buffer, iSum26.buffer, iN26.buffer,
  iDurSum.buffer, iDurWin.buffer, iGrossW.buffer, iGrossL.buffer, iBest.buffer, iWorst.buffer,
  sDaily.buffer, iDaily.buffer, normalN.buffer, coinVals.buffer,
]);
