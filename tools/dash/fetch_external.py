# ==========================================================================
# Indikator Akademi — Dashboard harici veri indirici
#   python tools/dash/fetch_external.py
# Cikti: tools/dash/data/fng.csv  (gun, deger, siniflandirma)
#
# Not: CoinGecko ucretsiz API gecmis veriyi 365 gunle sinirliyor; BTC
# dominans/likidite icin kendi 525-coin arsivimizden proxy uretiliyor
# (bkz. build_features.py). Korku/AcgOzluluk tam gecmis API'den gelir.
# ==========================================================================
import csv
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data')
URL = 'https://api.alternative.me/fng/?limit=0&format=json'


def main():
    os.makedirs(OUT, exist_ok=True)
    req = urllib.request.Request(URL, headers={'User-Agent': 'indikator-akademi/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        payload = json.loads(r.read().decode('utf-8'))
    rows = payload.get('data') or []
    if not rows:
        sys.exit('FNG verisi bos')
    rows.sort(key=lambda x: int(x['timestamp']))
    dest = os.path.join(OUT, 'fng.csv')
    with open(dest, 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['day', 'value', 'classification'])
        for it in rows:
            ts = int(it['timestamp'])
            day = ts // 86400
            w.writerow([day, int(it['value']), it.get('value_classification', '')])
    print(f'[fng] {len(rows)} gun -> {dest}')
    print(f'[fng] ilk gun: {rows[0]["timestamp"]} | son: {rows[-1]["timestamp"]}')


if __name__ == '__main__':
    main()
