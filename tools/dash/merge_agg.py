# ==========================================================================
# Indikator Akademi — Dashboard ham kayitlarini birlestirici
#   python tools/dash/merge_agg.py
# raw/w*.bin (10 isci, her biri 600 senaryo x 31 filtre) -> agg/{i}.bin
# Ayrica meta.json: senaryo listesi + filtresiz ozet (n, 2026 n/ort, DD, ...)
# ==========================================================================
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
RAW = os.path.join(DATA, 'raw')
AGG = os.path.join(DATA, 'agg')
ND, NH, NB, F = 1500, 168, 9, 31
HDR = 14  # n, wins, sumR, sumR2, grossW, grossL, barsSum, best, worst, winBars, longN, longSumR, shortN, shortSumR


def fbytes(nS):
    raw = HDR * 8 + ND * 12 + NH * 12 + NB * 12 + nS * 16
    return (raw + 7) // 8 * 8


def fbytes_old(nS):
    raw = 9 * 8 + ND * 12 + NH * 12 + NB * 12 + nS * 16
    return (raw + 7) // 8 * 8


def parse_block(buf, off, hdr=HDR):
    d = {}
    v = np.frombuffer(buf, dtype='<f8', count=hdr, offset=off)
    keys = ['n', 'wins', 'sumR', 'sumR2', 'grossW', 'grossL', 'barsSum', 'best', 'worst',
            'winBars', 'longN', 'longSumR', 'shortN', 'shortSumR'][:hdr]
    for k, x in zip(keys, v):
        d[k] = x
    for k in ('winBars', 'longN', 'longSumR', 'shortN', 'shortSumR'):
        d.setdefault(k, 0.0)
    off += hdr * 8
    def take(dtype, n):
        nonlocal off
        a = np.frombuffer(buf, dtype=dtype, count=n, offset=off)
        off += n * np.dtype(dtype).itemsize
        return a
    d['dPos'] = take('<f4', ND); d['dNeg'] = take('<f4', ND); d['dCnt'] = take('<u4', ND)
    d['hPos'] = take('<f4', NH); d['hNeg'] = take('<f4', NH); d['hCnt'] = take('<u4', NH)
    d['uPos'] = take('<f4', NB); d['uNeg'] = take('<f4', NB); d['uCnt'] = take('<u4', NB)
    return d, off


def parse_symbols(buf, off, nS):
    d = {}
    def take(dtype, n):
        nonlocal off
        a = np.frombuffer(buf, dtype=dtype, count=n, offset=off)
        off += n * np.dtype(dtype).itemsize
        return a
    d['ySum'] = take('<f4', nS); d['yEq'] = take('<f4', nS)
    d['yN'] = take('<u4', nS); d['yW'] = take('<u4', nS)
    off += (8 - off % 8) % 8
    return d, off


def put_block(out, off, d):
    def give(dtype, arr):
        nonlocal off
        view = np.frombuffer(out, dtype=dtype, count=len(arr), offset=off)
        view[:] = arr
        off += len(arr) * np.dtype(dtype).itemsize
    give('<f8', np.array([d['n'], d['wins'], d['sumR'], d['sumR2'], d['grossW'], d['grossL'], d['barsSum'], d['best'], d['worst'],
                          d['winBars'], d['longN'], d['longSumR'], d['shortN'], d['shortSumR']]))
    give('<f4', d['dPos']); give('<f4', d['dNeg']); give('<u4', d['dCnt'])
    give('<f4', d['hPos']); give('<f4', d['hNeg']); give('<u4', d['hCnt'])
    give('<f4', d['uPos']); give('<f4', d['uNeg']); give('<u4', d['uCnt'])
    give('<f4', d['ySum']); give('<f4', d['yEq']); give('<u4', d['yN']); give('<u4', d['yW'])
    off += (8 - off % 8) % 8
    return off


def main():
    t0 = time.time()
    man = json.load(open(os.path.join(DATA, 'scenarios.json'), encoding='utf-8'))
    nS = len(man['symbols'])
    nScen = len(man['scenarios'])
    FB = fbytes(nS)
    os.makedirs(AGG, exist_ok=True)
    raws = sorted(f for f in os.listdir(RAW) if f.endswith('.bin'))
    if not raws:
        sys.exit('raw/*.bin yok — once --records ile kosu yapin')
    print(f'[merge] {len(raws)} isci dosyasi | {nScen} senaryo | nS={nS} | FB={FB}')
    size0 = os.path.getsize(os.path.join(RAW, raws[0]))
    hdr = HDR if size0 == nScen * F * FB else 9
    print(f'[merge] ham format: {hdr} alan x 8 bayt (dosya {size0} bayt)')
    maps = [np.memmap(os.path.join(RAW, f), dtype=np.uint8, mode='r') for f in raws]
    scen_bytes = F * FB

    meta_scen = []
    import datetime as dt
    day0 = dt.date(2022, 8, 1)
    zero_sym = np.zeros(nS, dtype='<f4')
    u32_sym = np.zeros(nS, dtype='<u4')

    for si in range(nScen):
        out = bytearray(scen_bytes)
        off = 0
        for f in range(F):
            acc = None
            best = -9.0; worst = 9.0
            for mm in maps:
                base = si * scen_bytes + f * FB
                d, off2 = parse_block(mm, base, hdr)
                s, _ = parse_symbols(mm, off2, nS)
                if acc is None:
                    acc = {k: np.array(v, dtype=np.float64 if k not in ('dCnt', 'hCnt', 'uCnt') else np.uint64) for k, v in d.items()}
                    acc.update({k: np.array(v, dtype=np.float64 if k in ('ySum', 'yEq') else np.uint64) for k, v in s.items()})
                else:
                    for k, v in d.items():
                        acc[k] += v
                    for k, v in s.items():
                        acc[k] += v
                best = max(best, float(d['best'])); worst = min(worst, float(d['worst']))
            acc['best'] = best; acc['worst'] = worst
            # uint32 tasmasini engelle
            for k in ('dCnt', 'hCnt', 'uCnt', 'yN', 'yW'):
                acc[k] = np.minimum(acc[k], 2**32 - 1)
            off = put_block(out, off, acc)
        with open(os.path.join(AGG, f'{si}.bin'), 'wb') as fh:
            fh.write(out)
        if (si + 1) % 100 == 0:
            print(f'[merge] {si+1}/{nScen} — {time.time()-t0:.0f}s', flush=True)

    # meta: filtresiz ozet
    meta = {'gen': man['gen'], 'filters': man['filters'], 'symbols': man['symbols'], 'scenarios': []}
    meta['_buf'] = [np.memmap(os.path.join(AGG, '0.bin'), dtype=np.uint8, mode='r')]  # yer tutucu
    meta['FB'] = FB; meta['day0'] = day0
    # tum senaryolar icin ayri ayri oku
    for si in range(nScen):
        buf = np.memmap(os.path.join(AGG, f'{si}.bin'), dtype=np.uint8, mode='r')
        d, _ = parse_block(buf, 0)
        n = float(d['n'])
        row = dict(man['scenarios'][si])
        if n > 0:
            import datetime as dt2
            d26 = (dt2.date(2026, 1, 1) - day0).days
            p, ng, c = d['dPos'], d['dNeg'], d['dCnt']
            net = (p - ng) * 10.0
            cum = np.cumsum(net); peak = np.maximum.accumulate(cum)
            active = c > 0
            row.update({
                'n': int(n), 'avg': float(d['sumR'] / n), 'wr': float(d['wins'] / n),
                'n2026': int(c[d26:].sum()),
                'avg2026': float((p[d26:].sum() - ng[d26:].sum()) / c[d26:].sum()) if c[d26:].sum() > 0 else 0.0,
                'totPnl': float((p.sum() - ng.sum()) * 10.0),
                'maxDD': float((cum - peak).min()),
                'profitDays': int(((net > 0) & active).sum()),
                'lossDays': int(((net < 0) & active).sum()),
                'pf': float(d['grossW'] / d['grossL']) if d['grossL'] > 0 else None,
            })
        else:
            row.update({'n': 0, 'avg': 0, 'wr': 0, 'n2026': 0, 'avg2026': 0, 'totPnl': 0, 'maxDD': 0, 'profitDays': 0, 'lossDays': 0, 'pf': None})
        meta['scenarios'].append(row)
        del buf
    meta.pop('_buf', None)
    meta.pop('day0', None)
    with open(os.path.join(DATA, 'meta.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False)
    print(f'[merge] bitti: {nScen} senaryo, {time.time()-t0:.0f}s -> {AGG}')


if __name__ == '__main__':
    main()
