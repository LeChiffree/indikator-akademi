# Proje Geçmişi ve Karar Kaydı

Bu dosya, İndikatör Akademi projesinin başlangıçtan bugüne geçirdiği aşamaları,
alınan teknik kararları ve mevcut durumu tek yerde toplar. Yeni bir ekip üyesi
veya yapay zekâ oturumu için "hafıza" işlevi görür.

---

## 1. Projenin amacı

Mobil öncelikli, tamamen Türkçe, lüks görselli **statik eğitim sitesi**:
100 indikatörü 5 kategoride, slayt benzeri sayfalarla öğretmek ve her indikatör
için **gerçek veriyle backtest panosu** sunmak. Ardından bu panonun üzerine
**600 senaryoluk analiz dashboard'u** eklendi.

- Site: `index.html` + hash yönlendirme (`#/`, `#/i/:id`, `#/bt/:id`)
- Tema: koyu + altın; fontlar Manrope + Playfair Display (yerel woff2)
- Bağımlılıksız statik ön yüz (SVG grafikler), Node/Python yalnızca araçlarda

---

## 2. Zaman çizelgesi

| Aşama | Yapılan |
| --- | --- |
| 1 | 100 indikatörlük içerik kataloğu, 5 kategori, slayt sayfaları, diyagramlar |
| 2 | Backtest motoru (`tools/bt/`): 100 mekanik strateji × 6 zaman dilimi |
| 3 | İlk üretim: 58 sembol, 2022-08 → 2026-09, `assets/bt/*.json` |
| 4 | Pano UX iyileştirmeleri (medyan, etiketler, dokunmatik ısı detayı) |
| 5 | Yıllık getiri metriği düzeltildi (işlem bileşiği → portföy eğrisi) |
| 6 | Kapsam 58 → **525 sembol** (1m arşivinden eksik dilimler üretildi) |
| 7 | `BACKTEST-RAPORU.md` otomatik rapor üreticisi |
| 8 | **Analiz Dashboard**: 600 senaryo × 31 filtre (FastAPI + Plotly) |
| 9 | Mac'e yayın (site 8080, dashboard 8090) |

---

## 3. Veri kaynağı ve kapsam

- **Kaynak:** `D:\1mDataBinance` — Binance USDT-M vadeli arşivi.
  - `1m/{SYM}/*.parquet` (525 sembol; eski aylar parquet, bazıları CSV)
  - `5m,15m,1h,4h,1d` hazır CSV setleri (58 sembol)
  - `yeni_coinler/{tf}/*` (462 sembol, 5m dahil tüm dilimler)
  - `active_525/funding/*.parquet` (525 sembol, gerçek funding)
- **Üretilen veri seti:** `D:\1mDataBinance\bt525`
  - Motor çok köklü okur: `bt525` → `5m..1d` → `yeni_coinler`
  - 525/525 5m–4h, 521/525 1d; 4 kontrat yalnızca Ekim 2026'da listelendi
  - Funding 525 sembol için CSV'ye çevrildi
- **Doğrulama:** 1m → 5m yeniden örnekleme, mevcut Binance 5m CSV'siyle
  birebir aynı (OHLC farkı 0.0).
- **Pencere:** İşlemler 2022-08-01 → 2026-09-07 aralığında; daha eski barlar
  yalnızca indikatör ısınması için kullanılır (istatistikleri bozmaz).

---

## 4. Backtest metodolojisi (özet)

- Sinyal bar kapanışında, emir **sonraki bar açılışında**.
- Maliyet: taker %0,04 + 1bp kayma **her bacakta**; gerçek funding dahil; 1×.
- Her sembol bağımsız, eşit başlangıç sermayesi; portföy eğrisi = eğrilerin
  ortalaması, dönem içi yeniden dengeleme yok.
- "En iyi dilim": işlem kademesi (n≥100 → n≥30 → diğer), sonra en yüksek
  portföy toplam getirisi.
- Ayrıntılı sözleşme: `BACKTEST-RAPORU.md` §3–§6.

### Düzeltilen iki önemli hata

1. **Yıllık getiri**: İlk sürüm tüm işlemleri art arda bileşikliyordu ve uç
   işlemler değeri astronomik şişiriyordu (ör. +1,49e17). Artık portföy
   eğrisinden `yıl sonu / önceki yıl sonu − 1` hesaplanır; yıllar toplam
   getiriyle birebir bileşiklenir.
2. **Pencere tutarlılığı**: 2020'den başlayan 1m verisi nedeniyle işlem
   penceresi portföy ızgarasıyla sınırlandı; `bh` (al-tut) de aynı pencereden.

---

## 5. 525 sembollük üretim sonuçları (özet)

- 100 JSON + `index.json`, 30 MB; toplam **1,06 milyar** işlem.
- 164 kontratın 1w geçmişi <60 bar (1w sonuçlarına girmez).
- En iyi dilimi pozitif: 96/100 (filtresiz tanım).
- Öne çıkanlar (en iyi dilim): Supertrend 1h +1330%, EMA/HMA/Guppy 4h,
  Ultimate Oscillator 1d (+1443%, PF 7,3), VWAP 4h, StochRSI 4h.
- Uyarı: yeni listelenen memecoinler manşet toplamları şişirir; PF ve pozitif
  sembol oranı ile okunmalıdır (rapor §12).

---

## 6. Analiz Dashboard (600 senaryo × 31 filtre)

- **Motor kaydı:** `node tools/bt/run.mjs --records` her senaryo için 31 filtre
  durumunun günlük/saatlik/süre/sembol toplamalarını üretir.
  - Neden işlem-başına kayıt değil? 1,06 milyar işlem ~40+ GB olurdu; aynı
    grafikleri üreten ön-toplamalar 507 MB ve 30–75 ms yanıt verir.
  - Ödünleşim: kombinasyonlar 10 seçilmişle sınırlı; keyfi kombinasyon için
    işlem-başına kayıt ayrıca eklenebilir.
- **Filtreler:** 20 tek + 10 kombinasyon + filtresiz = 31 durum.
- **Harici veri:** Korku/Açgözlülük tam geçmişi (alternative.me, 2018→).
  BTC dominans/likidite ücretsiz tarihsel olmadığından BTC/ETH göreli güç ve
  BTC oynaklık proxy'leri kullanılır.
- **Dışlama kuralı:** Toplam **ve** 2026 ortalama getirisi birlikte negatifse
  senaryo listeden çıkar (600 → 345 kullanılabilir).
- **Grafikler:** 600 senaryo haritası, 10$ kasa (tüm dönem + 2025-26), günlük
  kâr/zarar (+25-26), yıllık, kalma süresi, mevsim/çeyrek, takvim ve gün×saat
  ısı haritaları, drawdown, 31 filtre etkisi (2 grafik), sembol katkısı.
- **KPI:** toplam işlem, 2026 işlem, ort. %getiri, maks. DD, kârlı/zararlı gün.

---

## 7. Mevcut mimari ve dosyalar

```
indikator-akademi/
├─ index.html, manifest.webmanifest, serve.py
├─ assets/
│  ├─ css/, js/ (app, engine/charts, engine/btcharts, engine/scenes)
│  ├─ fonts/ (woff2)
│  └─ bt/ (100 JSON + index.json — backtest çıktısı)
├─ tools/
│  ├─ bt/ (motor: run, worker, io, sim, agg, strategies, features, dashagg)
│  ├─ dash/ (FastAPI + Plotly dashboard, veri, web)
│  └─ deploy-mac.ps1, deploy-mac-dash.ps1…
├─ BACKTEST-RAPORU.md
└─ README.md
```

- **Site:** statik; `python3 serve.py` (8080) veya `npm start` (4173).
- **Dashboard:** `python tools/dash/server.py` (8090).
- **Mac:** `/Users/berfin/indikator-akademi`; site 8080, dashboard 8090.

---

## 8. Yeniden üretim

```powershell
python tools/bt/prep-525.py
python tools/dash/fetch_external.py
$env:IA_BT_DATA='D:\1mDataBinance\bt525'; $env:IA_BT_SRC='D:\1mDataBinance'
node tools/bt/run.mjs --workers=10 --records
python tools/dash/merge_agg.py
python tools/dash/server.py
npm run bt:report
```

> **Not:** Mum verileri (`D:\1mDataBinance`, `tools/dash/data/raw`) repoya
> dahil edilmez; bunlar yerelde üretilir. Repoda dashboard için yalnızca
> türetilmiş `tools/dash/data/agg` bulunur.

---

## 9. Bilinen sınırlar

- Emir defteri derinliği, kısmi dolum, değişken kayma modellenmez.
- Hayatta kalma etkisi: yalnızca arşivdeki güncel kontratlar.
- Yeni listelenen coinlerin uç barları gerçek ama manşet getiriyi şişirir.
- 1w örneklemi küçük; sonuçlar diğer dilimlere göre gürültülüdür.
- Sonuçlar yatırım tavsiyesi değildir.

---

## 10. Sonraki fikirler

- Keyfi filtre kombinasyonları için işlem-başına kayıt katmanı.
- Mac'te launchd ile otomatik başlatma (GUI oturumu gerektirir).
- Dashboard'a strateji karşılaştırma (çoklu senaryo) modu.
- Portföy simülatörü: seçilen senaryoları birlikte, sermaye paylaşımlı çalıştırma.
