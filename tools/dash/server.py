# ==========================================================================
# Indikator Akademi — Analiz Dashboard API'si (FastAPI)
#   python tools/dash/server.py  → http://127.0.0.1:8090
# Veri: tools/dash/data/agg/{i}.bin (600 senaryo x 31 filtre)
# ==========================================================================
import datetime as dt
import json
import os
import sys
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('DASH_DATA') or os.path.join(HERE, 'data')
AGG = os.path.join(DATA, 'agg')
WEB = os.environ.get('DASH_WEB') or os.path.join(HERE, 'web')
ND, NH, NB, F = 1500, 168, 9, 31
HDR = 14
HDR_KEYS = ['n', 'wins', 'sumR', 'sumR2', 'grossW', 'grossL', 'barsSum', 'best', 'worst',
            'winBars', 'longN', 'longSumR', 'shortN', 'shortSumR']
DAY0 = dt.date(2022, 8, 1)
DUR_MID_H = [0.5, 3.5, 15, 48, 120, 252, 588, 1200, 1920]
DUR_LABELS = ['<1sa', '1-6sa', '6-24sa', '1-3g', '3-7g', '7-14g', '14-35g', '35-65g', '>65g']
SEASONS = ['Kış', 'İlkbahar', 'Yaz', 'Sonbahar']
SEASON_OF = {12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3}

APP = FastAPI(title='İndikatör Akademi — Analiz')


def fbytes(nS, hdr=HDR):
    raw = hdr * 8 + ND * 12 + NH * 12 + NB * 12 + nS * 16
    return (raw + 7) // 8 * 8


def load_meta():
    with open(os.path.join(DATA, 'meta.json'), encoding='utf-8') as fh:
        return json.load(fh)


META = load_meta()
NS = len(META['symbols'])
FB = fbytes(NS)
FB_OLD = fbytes(NS, 9)
SCEN_BYTES = F * FB


def fmt_of(path):
    """Dosya boyutundan kayit formatini sec (yeni 14 alan / eski 9 alan)."""
    size = os.path.getsize(path)
    if size == F * FB:
        return HDR, FB
    if size == F * FB_OLD:
        return 9, FB_OLD
    raise HTTPException(500, 'bozuk veri boyutu')


def parse_scenario(si):
    if si < 0 or si >= len(META['scenarios']):
        raise HTTPException(404, 'senaryo yok')
    path = os.path.join(AGG, f'{si}.bin')
    hdr, fb = fmt_of(path)
    buf = np.fromfile(path, dtype=np.uint8)
    out = []
    for f in range(F):
        off = f * fb
        d = {}
        v = np.frombuffer(buf, dtype='<f8', count=hdr, offset=off)
        for k, x in zip(HDR_KEYS[:hdr], v):
            d[k] = float(x)
        for k in HDR_KEYS[hdr:]:
            d[k] = 0.0
        off += hdr * 8
        def take(dtype, n):
            nonlocal off
            a = np.frombuffer(buf, dtype=dtype, count=n, offset=off)
            off += n * np.dtype(dtype).itemsize
            return a
        d['dPos'] = take('<f4', ND); d['dNeg'] = take('<f4', ND); d['dCnt'] = take('<u4', ND)
        d['hPos'] = take('<f4', NH); d['hNeg'] = take('<f4', NH); d['hCnt'] = take('<u4', NH)
        d['uPos'] = take('<f4', NB); d['uNeg'] = take('<f4', NB); d['uCnt'] = take('<u4', NB)
        d['ySum'] = take('<f4', NS); d['yEq'] = take('<f4', NS)
        d['yN'] = take('<u4', NS); d['yW'] = take('<u4', NS)
        out.append({k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in d.items()})
    return out


@lru_cache(maxsize=48)
def scenario_cache(si):
    return parse_scenario(si)


def dates_for(n):
    return [DAY0 + dt.timedelta(days=i) for i in range(n)]


def summarize(d):
    n = int(d['n'])
    days = d['dPos'].astype(np.float64) - d['dNeg'].astype(np.float64)
    cash = np.cumsum(days * 10.0)
    peak = np.maximum.accumulate(cash)
    dd = float((cash - peak).min()) if len(cash) else 0.0
    cnt = d['dCnt']
    active = cnt > 0
    profit_days = int(((days > 0) & active).sum())
    loss_days = int(((days < 0) & active).sum())
    gross_w = float(d['grossW']) * 10.0
    gross_l = float(d['grossL']) * 10.0
    wins = int(d['wins'])
    wb = float(d['winBars'])
    if wins > 0 and wb > 0:
        win_h = wb / wins / 60.0
        win_exact = True
    elif wins <= 0:
        win_h = None
        win_exact = True
    else:
        up = d['uPos'].astype(np.float64)
        tot = float(up.sum())
        win_h = float((up * np.array(DUR_MID_H)).sum() / tot) if tot > 0 else 0.0
        win_exact = False
    return {
        'n': n,
        'wr': float(d['wins'] / n) if n else 0.0,
        'avg': float(d['sumR'] / n) if n else 0.0,
        'pf': float(d['grossW'] / d['grossL']) if d['grossL'] > 0 else None,
        'best': float(d['best']) if n else 0.0,
        'worst': float(d['worst']) if n else 0.0,
        'avgDurDays': float(d['barsSum'] / n / 1440) if n else 0.0,
        'maxDD': dd,
        'profitDays': profit_days,
        'lossDays': loss_days,
        'totPnl': float((d['dPos'].sum() - d['dNeg'].sum()) * 10.0),
        'grossW': gross_w,
        'grossL': gross_l,
        'wins': int(d['wins']),
        'losses': n - int(d['wins']),
        'winHours': win_h,
        'winHoursExact': win_exact,
    }


def last_active(d):
    idx = np.nonzero(d['dCnt'] > 0)[0]
    return int(idx[-1]) + 1 if len(idx) else 0


def yearly(d, end):
    pos, neg, cnt = d['dPos'], d['dNeg'], d['dCnt']
    out = {}
    for i in range(end):
        y = (DAY0 + dt.timedelta(days=i)).year
        row = out.setdefault(y, {'year': y, 'pos': 0.0, 'neg': 0.0, 'n': 0})
        row['pos'] += float(pos[i]); row['neg'] += float(neg[i]); row['n'] += int(cnt[i])
    return [out[y] for y in sorted(out)]


def quarters(d, end):
    pos, neg, cnt = d['dPos'], d['dNeg'], d['dCnt']
    out = [{'q': q + 1, 'pos': 0.0, 'neg': 0.0, 'n': 0} for q in range(4)]
    for i in range(end):
        q = ((DAY0 + dt.timedelta(days=i)).month - 1) // 3
        out[q]['pos'] += float(pos[i]); out[q]['neg'] += float(neg[i]); out[q]['n'] += int(cnt[i])
    return out


def seasons(d, end):
    pos, neg, cnt = d['dPos'], d['dNeg'], d['dCnt']
    out = [{'s': SEASONS[k], 'pos': 0.0, 'neg': 0.0, 'n': 0} for k in range(4)]
    for i in range(end):
        m = (DAY0 + dt.timedelta(days=i)).month
        k = SEASON_OF[m]
        out[k]['pos'] += float(pos[i]); out[k]['neg'] += float(neg[i]); out[k]['n'] += int(cnt[i])
    return out


def months(d, end):
    pos, neg, cnt = d['dPos'], d['dNeg'], d['dCnt']
    out = {}
    for i in range(end):
        dd = DAY0 + dt.timedelta(days=i)
        key = f'{dd.year}-{dd.month:02d}'
        row = out.setdefault(key, {'ym': key, 'y': dd.year, 'm': dd.month, 'pos': 0.0, 'neg': 0.0, 'n': 0})
        row['pos'] += float(pos[i]); row['neg'] += float(neg[i]); row['n'] += int(cnt[i])
    return [out[k] for k in sorted(out)]


def dowhour(d):
    p = d['hPos'].reshape(7, 24); n = d['hNeg'].reshape(7, 24); c = d['hCnt'].reshape(7, 24)
    return {'pos': p.round(5).tolist(), 'neg': n.round(5).tolist(), 'n': c.tolist()}


def dow(d):
    p = d['hPos'].reshape(7, 24).sum(axis=1); n = d['hNeg'].reshape(7, 24).sum(axis=1); c = d['hCnt'].reshape(7, 24).sum(axis=1)
    return {'pos': p.round(5).tolist(), 'neg': n.round(5).tolist(), 'n': c.tolist()}


def weekly(d, end):
    pos, neg, cnt = d['dPos'], d['dNeg'], d['dCnt']
    out = {}
    for i in range(end):
        dd = DAY0 + dt.timedelta(days=i)
        iso = dd.isocalendar()
        key = f'{iso[0]}-W{iso[1]:02d}'
        row = out.setdefault(key, {'w': key, 'pos': 0.0, 'neg': 0.0, 'n': 0})
        row['pos'] += float(pos[i]); row['neg'] += float(neg[i]); row['n'] += int(cnt[i])
    return [out[k] for k in sorted(out)]


def rolling(d, end):
    net = (d['dPos'].astype(np.float64) - d['dNeg'].astype(np.float64)) * 10.0
    cs = np.cumsum(net[:end])
    out = {}
    for w in (30, 90, 365):
        r = cs.copy()
        if end > w:
            r[w:] = cs[w:] - cs[:-w]
        r[:min(w, end)] = np.nan
        out[str(w)] = [None if not np.isfinite(v) else round(float(v), 2) for v in r]
    return out


def filter_years(blocks, end):
    years = [2022, 2023, 2024, 2025, 2026]
    mat = []
    for f, d in enumerate(blocks):
        net = (d['dPos'].astype(np.float64) - d['dNeg'].astype(np.float64)) * 10.0
        row = []
        for y in years:
            a = (dt.date(y, 1, 1) - DAY0).days
            b = (dt.date(y + 1, 1, 1) - DAY0).days
            row.append(round(float(net[max(0, a):min(end, b)].sum()), 2))
        mat.append(row)
    return {'years': years, 'rows': mat}


def year2026(d, blocks, end):
    """Secili filtrenin 2026 dilimi + 31 filtrenin 2026 ozeti."""
    a = (dt.date(2026, 1, 1) - DAY0).days
    if end <= a:
        return None
    pos = d['dPos'][a:end].astype(np.float64); neg = d['dNeg'][a:end].astype(np.float64)
    cnt = d['dCnt'][a:end].astype(np.float64)
    net = pos - neg
    cash = np.cumsum(net * 10.0)
    peak = np.maximum.accumulate(cash)
    active = cnt > 0
    kpi = {
        'n': int(cnt.sum()), 'net': round(float(net.sum() * 10.0), 2),
        'avg': float(net.sum() / cnt.sum()) if cnt.sum() else 0.0,
        'profitDays': int(((net > 0) & active).sum()), 'lossDays': int(((net < 0) & active).sum()),
        'maxDD': float((cash - peak).min()) if len(cash) else 0.0,
    }
    # haftalik / aylik / mevsim / ceyrek
    wk = {}; mo = {}
    seP = [0.0, 0.0, 0.0, 0.0]; seN = [0.0, 0.0, 0.0, 0.0]; seC = [0, 0, 0, 0]
    qP = [0.0, 0.0, 0.0, 0.0]; qN = [0.0, 0.0, 0.0, 0.0]; qC = [0, 0, 0, 0]
    for i in range(a, end):
        dd = DAY0 + dt.timedelta(days=i)
        v = float(net[i - a]); c = int(cnt[i - a])
        iso = dd.isocalendar(); key = f'{iso[0]}-W{iso[1]:02d}'
        r = wk.setdefault(key, {'w': key, 'pos': 0.0, 'neg': 0.0, 'n': 0})
        if v >= 0: r['pos'] += v
        else: r['neg'] += -v
        r['n'] += c
        mk = dd.strftime('%Y-%m')
        m = mo.setdefault(mk, {'ym': mk, 'pos': 0.0, 'neg': 0.0, 'n': 0})
        if v >= 0: m['pos'] += v
        else: m['neg'] += -v
        m['n'] += c
        sk = SEASON_OF[dd.month]
        if v >= 0: seP[sk] += v
        else: seN[sk] += -v
        seC[sk] += c
        qk = (dd.month - 1) // 3
        if v >= 0: qP[qk] += v
        else: qN[qk] += -v
        qC[qk] += c
    effects = []
    for k, dd in enumerate(blocks):
        p = dd['dPos'][a:].astype(np.float64); n = dd['dNeg'][a:].astype(np.float64); c = dd['dCnt'][a:].astype(np.float64)
        nn = float(c.sum())
        effects.append({'i': k, 'label': META['filters'][k]['label'], 'group': META['filters'][k]['group'],
                        'n': int(nn), 'net': round(float((p - n).sum() * 10.0), 2),
                        'avg': float((p - n).sum() / nn) if nn else 0.0,
                        'profitDays': int(((p - n) > 0).sum()), 'lossDays': int(((p - n) < 0).sum())})
    # 2026 ay isi haritasi
    months26 = []
    for mk, m in mo.items():
        months26.append({'ym': mk, 'pos': m['pos'], 'neg': m['neg'], 'n': m['n']})
    return {
        'kpi': kpi, 'daily': {'pos': pos.tolist(), 'neg': neg.tolist(), 'n': cnt.astype(int).tolist()},
        'cash': [round(float(v), 2) for v in cash],
        'weekly': [wk[k] for k in sorted(wk)],
        'monthly': months26,
        'seasons': [{'s': SEASONS[i], 'pos': seP[i], 'neg': seN[i], 'n': seC[i]} for i in range(4)],
        'quarters': [{'q': i + 1, 'pos': qP[i], 'neg': qN[i], 'n': qC[i]} for i in range(4)],
        'filterEffects': effects,
    }


def symbols(d, n=40):
    yN, yW, ySum, yEq = d['yN'], d['yW'], d['ySum'], d['yEq']
    rows = []
    for i, s in enumerate(META['symbols']):
        if yN[i] > 0:
            rows.append({'sym': s, 'n': int(yN[i]), 'wr': float(yW[i] / yN[i]), 'sumR': float(ySum[i]),
                         'avg': float(ySum[i] / yN[i]), 'eq': float(yEq[i])})
    rows.sort(key=lambda r: r['n'], reverse=True)
    rows = rows[:n]
    rows.sort(key=lambda r: r['sumR'], reverse=True)
    return rows


RANK = {'data': None}


def ranking_rows():
    """Tum senaryo x filtre satirlari (kompakt sutun dizileri)."""
    if RANK['data'] is not None:
        return RANK['data']
    a26 = (dt.date(2026, 1, 1) - DAY0).days
    mids = np.array(DUR_MID_H)
    cols = {'s': [], 'f': [], 'n': [], 'a': [], 'a26': [], 'wh': [], 'w': [], 'l': []}
    exact = True
    for si in range(len(META['scenarios'])):
        path = os.path.join(AGG, f'{si}.bin')
        hdr, fb = fmt_of(path)
        if hdr < HDR:
            exact = False
        buf = np.fromfile(path, dtype=np.uint8)
        for f in range(F):
            off = f * fb
            v = np.frombuffer(buf, dtype='<f8', count=hdr, offset=off)
            n = float(v[0])
            if n <= 0:
                continue
            wins = float(v[1])
            base = off + hdr * 8
            dcnt = np.frombuffer(buf, dtype='<u4', count=ND, offset=base + ND * 8)
            n26 = int(dcnt[a26:].sum())
            if n26:
                dpos = np.frombuffer(buf, dtype='<f4', count=ND, offset=base)
                dneg = np.frombuffer(buf, dtype='<f4', count=ND, offset=base + ND * 4)
                r26 = float(dpos[a26:].astype(np.float64).sum() - dneg[a26:].astype(np.float64).sum())
                av26 = r26 / n26
            else:
                av26 = 0.0
            wb = float(v[9]) if hdr > 9 else 0.0
            if wins <= 0:
                wh = None
            elif wb > 0:
                wh = wb / wins / 60.0
            else:
                ub = base + ND * 12 + NH * 12
                upos = np.frombuffer(buf, dtype='<f4', count=NB, offset=ub).astype(np.float64)
                tot = float(upos.sum())
                wh = float((upos * mids).sum() / tot) if tot > 0 else None
                exact = False
            cols['s'].append(si)
            cols['f'].append(f)
            cols['n'].append(int(n))
            cols['a'].append(round(float(v[2]) / n, 6))
            cols['a26'].append(round(av26, 6))
            cols['wh'].append(None if wh is None else round(wh, 3))
            cols['w'].append(int(wins))
            cols['l'].append(int(n - wins))
    RANK['data'] = {'exact': exact, 'rows': cols}
    return RANK['data']


APP_STATE = {}


def scenario_payload(si, fi):
    f = int(fi)
    if f < 0 or f >= F:
        raise HTTPException(400, 'filtre 0..30')
    blocks = scenario_cache(si)
    d = blocks[f]
    end = last_active(d)
    days = d['dPos'].astype(np.float64) - d['dNeg'].astype(np.float64)
    cash = np.cumsum(days * 10.0)
    # 2025-2026 kasa eğrisi
    d25 = (dt.date(2025, 1, 1) - DAY0).days
    cash25 = np.cumsum(days[d25:] * 10.0)
    kpi = summarize(d)
    k26 = d['dCnt'][(dt.date(2026, 1, 1) - DAY0).days:].sum()
    s26 = (d['dPos'][(dt.date(2026, 1, 1) - DAY0).days:].sum() - d['dNeg'][(dt.date(2026, 1, 1) - DAY0).days:].sum())
    kpi['n2026'] = int(k26)
    kpi['avg2026'] = float(s26 / k26) if k26 > 0 else 0.0
    effects = []
    for k, dd in enumerate(blocks):
        s = summarize(dd)
        s['i'] = k
        s['label'] = META['filters'][k]['label']
        s['group'] = META['filters'][k]['group']
        effects.append(s)
    return {
        'scenario': META['scenarios'][si],
        'filter': META['filters'][f],
        'kpi': kpi,
        'daily': {
            'start': '2022-08-01',
            'pos': np.round(d['dPos'][:end], 5).tolist(),
            'neg': np.round(d['dNeg'][:end], 5).tolist(),
            'n': d['dCnt'][:end].tolist(),
        },
        'cash': {'all': np.round(cash[:end], 2).tolist(), 'y25': np.round(cash25, 2).tolist()},
        'years': yearly(d, end),
        'quarters': quarters(d, end),
        'seasons': seasons(d, end),
        'months': months(d, end),
        'dowhour': dowhour(d),
        'durations': [{'label': DUR_LABELS[k], 'n': int(d['uCnt'][k]), 'pos': float(d['uPos'][k]), 'neg': float(d['uNeg'][k])} for k in range(NB)],
        'symbols': symbols(d),
        'filterEffects': effects,
        'weekly': weekly(d, end),
        'rolling': rolling(d, end),
        'dow': dow(d),
        'filterYears': filter_years(blocks, end),
        'y2026': year2026(d, blocks, end),
    }


@APP.get('/api/meta')
def api_meta():
    return {'gen': META['gen'], 'filters': META['filters'], 'scenarios': META['scenarios']}


@APP.get('/api/scenario/{si}')
def api_scenario(si: int, filter: int = Query(0, ge=0, le=30)):
    return scenario_payload(si, filter)


@APP.get('/api/ranking')
def api_ranking(refresh: int = 0):
    if refresh:
        RANK['data'] = None
    return ranking_rows()


@APP.get('/')
def index():
    return FileResponse(os.path.join(WEB, 'index.html'))


if os.path.isdir(WEB):
    APP.mount('/static', StaticFiles(directory=WEB), name='static')


if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('DASH_PORT', '8090'))
    uvicorn.run(APP, host='0.0.0.0', port=port, log_level='warning')
