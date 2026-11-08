# ==========================================================================
# Indikator Akademi — 525 sembolluk backtest veri seti hazirlayici
#
#   python tools/bt/prep-525.py [--src D:\1mDataBinance] [--out D:\1mDataBinance\bt525]
#
# Motor cok koklu okur (bkz. io.mjs):
#   {out}\{tf}\{SYM}\              → burada uretilen eksik dilimler
#   {src}\{5m,15m,1h,4h,1d}\{SYM}\ → mevcut 58 sembolluk hazir CSV'ler
#   {src}\yeni_coinler\{tf}\{SYM}\ → 462 sembol icin hazir 15m/1h/4h/1d
#
# Bu betik yalnizca EKSIK olanlari 1m parquet arsivinden uretir
# (pratikte: 58 disindaki sembollerin 5m'i + 5 kenar sembolun tum dilimleri)
# ve funding parquet'lerini CSV'ye cevirir.
# ==========================================================================
import argparse
import glob
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

import pandas as pd

TFS = ['5m', '15m', '1h', '4h', '1d']
RULES = {'5m': '5min', '15m': '15min', '1h': '1h', '4h': '4h', '1d': '24h'}
COLS = ['open_time', 'open', 'high', 'low', 'close', 'volume']


def list_syms(path):
    return sorted(d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d)))


def has_series(src, out, sym, tf):
    if os.path.isdir(os.path.join(out, tf, sym)):
        return True
    return os.path.isdir(os.path.join(src, tf, sym)) or os.path.isdir(os.path.join(src, 'yeni_coinler', tf, sym))


def resample_symbol(args):
    sym, src, out, tfs = args
    try:
        files = sorted(glob.glob(os.path.join(src, '1m', sym, '*.parquet')) +
                       glob.glob(os.path.join(src, '1m', sym, '*.csv')))
        if not files:
            return sym, 'veri yok', 0
        frames = []
        for f in files:
            if f.endswith('.parquet'):
                frames.append(pd.read_parquet(f, columns=COLS))
            else:
                frames.append(pd.read_csv(f, usecols=COLS))
        df = pd.concat(frames, ignore_index=True)
        df = df.drop_duplicates('open_time').sort_values('open_time')
        idx = pd.to_datetime(df['open_time'], unit='ms', utc=True)
        df = df.set_index(idx)
        wrote = 0
        for tf in tfs:
            agg = df.resample(RULES[tf], label='left', closed='left', origin='epoch').agg(
                {'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'})
            agg = agg.dropna(subset=['open', 'high', 'low', 'close'])
            if len(agg) < 60:
                continue
            odf = pd.DataFrame({
                # pandas 3 indeksi kaynak çözünürlükte tutar (burada ms) —
                # as_unit('ms') ile her sürümde milisaniye garanti edilir.
                'open_time': agg.index.as_unit('ms').asi8,
                'open': agg['open'].values,
                'high': agg['high'].values,
                'low': agg['low'].values,
                'close': agg['close'].values,
                'volume': agg['volume'].values,
            })
            dest_dir = os.path.join(out, tf, sym)
            os.makedirs(dest_dir, exist_ok=True)
            odf.to_csv(os.path.join(dest_dir, f'{sym}-{tf}.csv'), index=False, float_format='%.10g')
            wrote += 1
        return sym, 'ok', wrote
    except Exception as e:  # noqa: BLE001
        return sym, f'HATA: {e}', 0


def to_funding_csv(src, out):
    os.makedirs(out, exist_ok=True)
    files = sorted(glob.glob(os.path.join(src, 'active_525', 'funding', '*.parquet')))
    n = 0
    for f in files:
        sym = os.path.basename(f)[:-8]
        df = pd.read_parquet(f, columns=['fundingTime', 'fundingRate'])
        df = df.dropna().sort_values('fundingTime')
        dest = os.path.join(out, sym + '.csv')
        with open(dest, 'w', encoding='utf-8', newline='') as fh:
            fh.write('symbol,funding_time,funding_rate\n')
            for t, r in zip(df['fundingTime'].astype('int64'), df['fundingRate'].astype(float)):
                fh.write(f'{sym},{t},{r:.10g}\n')
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=r'D:\1mDataBinance')
    ap.add_argument('--out', default=r'D:\1mDataBinance\bt525')
    ap.add_argument('--workers', type=int, default=6)
    args = ap.parse_args()
    src, out = args.src, args.out
    t0 = time.time()

    if not os.path.isdir(os.path.join(src, '1m')):
        sys.exit(f'1m klasoru yok: {src}')
    syms = list_syms(os.path.join(src, '1m'))
    print(f'[prep] kaynak sembol: {len(syms)} | cikti: {out}', flush=True)

    # Hazir kapsam (bilgi amacli)
    for tf in TFS:
        have = sum(1 for s in syms if has_series(src, out, s, tf))
        print(f'[prep] {tf}: hazir {have}/{len(syms)}', flush=True)

    # Eksik dilimleri 1m'den uret
    tasks = []
    for sym in syms:
        missing = [tf for tf in TFS if not has_series(src, out, sym, tf)]
        if missing:
            tasks.append((sym, src, out, missing))
    n5 = sum(1 for t in tasks if t[3] == ['5m'])
    print(f'[prep] 1m\'den uretilecek: {len(tasks)} sembol (bunlarin {n5} tanesi yalnizca 5m)', flush=True)
    done = 0
    t1 = time.time()
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(resample_symbol, t): t[0] for t in tasks}
        for fu in as_completed(futs):
            sym, status, wrote = fu.result()
            done += 1
            if status != 'ok' or done % 10 == 0 or done == len(tasks):
                eta = (time.time() - t1) / done * (len(tasks) - done) if done else 0
                print(f'[prep] {done}/{len(tasks)} {sym}: {status} ({wrote} tf) ~{eta:.0f}s kaldi', flush=True)

    # Funding
    nf = to_funding_csv(src, os.path.join(out, 'funding'))
    print(f'[prep] funding CSV: {nf}', flush=True)

    for tf in TFS:
        p = os.path.join(out, tf)
        print(f'[prep] uretilen {tf}: {len(list_syms(p)) if os.path.isdir(p) else 0} sembol', flush=True)
    print(f'[prep] bitti: {(time.time() - t0):.0f}s', flush=True)


if __name__ == '__main__':
    main()
