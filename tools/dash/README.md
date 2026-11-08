# İndikatör Akademi — Analiz Dashboard

600 senaryo (100 indikatör × 6 zaman dilimi) × 31 filtre durumu için
kârlılık keşif aracı. Python (FastAPI + Plotly) backend, tarayıcıda Plotly.js.

## 1) Veri setini hazırla (bir kez)

```powershell
python tools/bt/prep-525.py          # 1m arşivinden eksik dilimleri üretir
python tools/dash/fetch_external.py  # Korku/Açgözlülük endeksini indirir
```

## 2) Backtest + filtre kayıtları

```powershell
$env:IA_BT_DATA='D:\1mDataBinance\bt525'
$env:IA_BT_SRC='D:\1mDataBinance'
node tools/bt/run.mjs --workers=10 --records
```

`--records` her senaryo × filtre için günlük kâr/zarar, gün×saat,
kalma süresi ve sembol toplamalarını `tools/dash/data/raw/` altına yazar
(~5 GB). Sonraki adım bunları birleştirir (~0,5 GB).

## 3) Birleştir

```powershell
python tools/dash/merge_agg.py
# → tools/dash/data/agg/{0..599}.bin + meta.json
```

## 4) Sunucu

```powershell
python tools/dash/server.py     # http://127.0.0.1:8090
```

## Filtreler (31 durum)

0. Filtresiz
1–20. Tek filtreler: BTC yönü, BTC trendi, Korku/Açgözlülük, hacim (1,2×/1,5×),
   ADX (>25 / <20), RSI (<30 / >70), EMA50/200 yönü, ATR bandı, BB sıkışması,
   hafta içi, saat 06–23, funding, BTC korelasyonu, BTC/ETH göreli güç,
   sakin volatilite.
21–30. Kombinasyonlar (BTC yönü + hacim, ADX + EMA50, RSI + funding, …).

## API

- `GET /api/meta` — senaryo listesi + filtresiz özet (n, 2026 n/ort, maxDD,
  kârlı/zararlı gün).
- `GET /api/scenario/{i}?filter=0..30` — KPI'lar, günlük seriler, kasa eğrisi,
  yıllık/çeyrek/mevsim/ay, gün×saat, kalma süresi, semboller, 31 filtre etkisi.

## Notlar

- Kasa eğrisi **10$ sabit pozisyon**, 0$ başlangıç, kaldıraçsız; maliyet ve
  gerçek funding dahildir.
- Korku/Açgözlülük: alternative.me tam geçmiş (2018→). BTC dominans/likidite
  için ücretsiz tarihsel veri olmadığından kendi verimizden **BTC/ETH göreli
  güç** ve **BTC oynaklık** proxy'leri kullanılır.
- Senaryolar, toplam **ve** 2026 ortalama getirisi birlikte negatifse listeden
  çıkarılır.
