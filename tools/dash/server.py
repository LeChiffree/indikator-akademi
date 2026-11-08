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
DAY0 = dt.date(2022, 8, 1)
DUR_LABELS = ['<1sa', '1-6sa', '6-24sa', '1-3g', '3-7g', '7-14g', '14-35g', '35-65g', '>65g']
SEASONS = ['Kış', 'İlkbahar', 'Yaz', 'Sonbahar']
SEASON_OF = {12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3}

APP = FastAPI(title='İndikatör Akademi — Analiz')


def fbytes(nS):
    raw = 9 * 8 + ND * 12 + NH * 12 + NB * 12 + nS * 16
    return (raw + 7) // 8 * 8


def load_meta():
    with open(os.path.join(DATA, 'meta.json'), encoding='utf-8') as fh:
        return json.load(fh)


META = load_meta()
NS = len(META['symbols'])
FB = fbytes(NS)
SCEN_BYTES = F * FB


def parse_scenario(si):
    if si < 0 or si >= len(META['scenarios']):
        raise HTTPException(404, 'senaryo yok')
    buf = np.fromfile(os.path.join(AGG, f'{si}.bin'), dtype=np.uint8)
    if len(buf) < SCEN_BYTES:
        raise HTTPException(500, 'bozuk veri')
    out = []
    for f in range(F):
        off = f * FB
        d = {}
        v = np.frombuffer(buf, dtype='<f8', count=9, offset=off)
        d['n'], d['wins'], d['sumR'], d['sumR2'], d['grossW'], d['grossL'], d['barsSum'], d['best'], d['worst'] = [float(x) for x in v]
        off += 72
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


def symbols(d, top=12, bottom=8):
    yN, yW, ySum, yEq = d['yN'], d['yW'], d['ySum'], d['yEq']
    rows = []
    for i, s in enumerate(META['symbols']):
        if yN[i] > 0:
            rows.append({'sym': s, 'n': int(yN[i]), 'wr': float(yW[i] / yN[i]), 'sumR': float(ySum[i]),
                         'avg': float(ySum[i] / yN[i]), 'eq': float(yEq[i])})
    rows.sort(key=lambda r: r['sumR'], reverse=True)
    if len(rows) <= top + bottom:
        return rows
    return rows[:top] + [{'sep': True}] + rows[-bottom:]


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
    }


@APP.get('/api/meta')
def api_meta():
    return {'gen': META['gen'], 'filters': META['filters'], 'scenarios': META['scenarios']}


@APP.get('/api/scenario/{si}')
def api_scenario(si: int, filter: int = Query(0, ge=0, le=30)):
    return scenario_payload(si, filter)


@APP.get('/')
def index():
    return FileResponse(os.path.join(WEB, 'index.html'))


if os.path.isdir(WEB):
    APP.mount('/static', StaticFiles(directory=WEB), name='static')


if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('DASH_PORT', '8090'))
    uvicorn.run(APP, host='0.0.0.0', port=port, log_level='warning')
