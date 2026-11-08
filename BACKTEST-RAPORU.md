# İndikatör Akademi — Backtest Raporu

> **Üretim:** 2026-11-01 · **Motor:** ia-bt-v1 · **Kapsam:** 100 indikatör × 525 sembol × 6 zaman dilimi
> Bu rapor otomatik üretilir: `node tools/bt/report.mjs` — tüm sayılar `assets/bt/*.json` çıktılarından okunur.

## 1. Özet

- **Dönem:** En eski kontratlar için arşiv **2022-08**'de başlar ve veri **Eylül 2026**'ya kadar sürer; portföy eğrisi **2022-08-01 → 2026-09-07** arasını haftalık **215 noktayla** örnekler. Sonradan listelenen semboller daha kısa geçmişle katkı verir.
- **Simüle edilen işlem:** 1.056.378.973 adet (100 indikatörün tüm zaman dilimleri toplamı, ham işlem sayısı).
- **Maliyetler:** %0,04 taker + 1bp kayma / bacak; funding dahil; 1x (kaldıraçsız).
- **En iyi dilimi pozitif olan:** 96/100 indikatör.
- Hiçbir parametre optimizasyonu yapılmadı; her indikatör için tek, mekanik ve öğretilebilir bir kural kullanıldı.

**En yüksek portföy toplam getirisi (en iyi dilim):**

| İndikatör | Dilim | İşlem | Kazanma | İşlem başına | PF | Portföy toplamı |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| RVI | 4h | 411.113 | 25.0% | +0.18% | 1.12 | +17857.73% |
| ADX / DMI | 1h | 241.510 | 35.6% | +0.18% | 1.09 | +14581.83% |
| ORB | 5m | 1.144.274 | 28.0% | -0.05% | 0.96 | +4940.83% |
| SMA | 4h | 92.936 | 34.9% | +0.99% | 1.28 | +3351.91% |
| Hull MA | 1h | 320.853 | 33.9% | +0.15% | 1.08 | +3112.17% |
| McGinley | 15m | 5.604.799 | 20.4% | -0.09% | 0.79 | +2865.82% |
| Ulcer Index | 1h | 411.821 | 19.8% | +0.10% | 1.08 | +2815.52% |
| Parabolic SAR | 4h | 202.192 | 38.8% | +0.52% | 1.20 | +2572.39% |
| Hacim Profili | 15m | 500.993 | 29.2% | +0.04% | 1.03 | +2281.24% |
| Choppiness | 5m | 26.143 | 30.7% | +3.86% | 1.81 | +2261.08% |

**En zayıf portföy toplam getirisi (en iyi dilim):**

| İndikatör | Dilim | İşlem | Kazanma | İşlem başına | PF | Portföy toplamı |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Alligator | 1w | 4.595 | 35.0% | -8.73% | 0.41 | -58.31% |
| Fibo Geri Çekilme | 1d | 10.508 | 48.1% | -0.28% | 0.95 | -6.10% |
| Harmonik Formasyonlar | 1d | 10.071 | 26.6% | -0.32% | 0.94 | -5.88% |
| RSI | 1d | 1.591 | 44.7% | -1.02% | 0.94 | -4.75% |
| Coppock | 1d | 9.183 | 27.8% | +0.67% | 1.08 | +2.48% |

## 2. Veri kaynağı ve kapsam

- **Kaynak:** Binance USDT-M vadeli işlemler, 1 dakikalık (1m) kline arşivi (yerel `D:\1mDataBinance`, aylık CSV dosyaları).
- **Semboller:** 525 USDT-M kontratı (tam liste §11). Dönem içinde kotasyon dışı kalan kontratlar veri setinde yoktur — bu bir **hayatta kalma (survivorship) etkisi** yaratabilir.
- **Zaman dilimleri:** 5m, 15m, 1h, 4h, 1d, 1w — 5m'ten 1d'ye arşivdeki hazır kline serileri kullanılır; **1w**, 1d barlarından Pazartesi başlangıçlı haftalara toplanarak türetilir (veri setinin son haftası kısmi olabilir).
- **Funding:** Binance vadeli funding arşivindeki gerçek olaylar; pozisyonun tutulduğu zaman aralığına düşen oranların toplamı olarak uygulanır (long pozitif oranda öder, short tahsil eder).
- **Isınma:** Strateji, indikatör serisinin ilk geçerli değerinden 2 bar sonra işlem yapmaya başlar (en az 40 bar). Böylece ısınma dönemi işlem üretmez.
- **Veri geçmişi:** arşiv en eski kontratlar için 2022-08'de başlar (BTCUSDT, ETHUSDT); sonradan listelenen kontratlar (ör. AKEUSDT) yalnızca liste tarihinden sonrasına sahiptir. `tot` (toplam getiri) her sembol için kendi verisinin başlangıcından dönem sonuna kadardır.
- **1w kapsamı:** 1w'de yeterli geçmişi veya işlemi olmayan kontratlar sonuçlara girmez (bu üretimde 155 kontrat: 0GUSDT, 2ZUSDT, 4USDT, ACUUSDT, AIAUSDT, AIGENSYNUSDT, AIOUSDT, AKEUSDT, ALLOUSDT, ALLUSDT, APRUSDT, ARIAUSDT …). 60 bardan az haftalık geçmişi olanlar test edilemez; kısa geçmişli diğer kontratlarda da haftalık ısınma penceresi işlem üretmeye yetmeyebilir ve ilgili hücre ısı tablosunda boş kalır.

## 3. Emir, maliyet ve sermaye modeli

- **Sinyal → emir:** Sinyal bar *i* kapanışında üretilir; emir bar *i+1* **açılışında** uygulanır (bakışsızlık / look-ahead yok).
- **Maliyet:** Her bacakta (giriş ve çıkış) taker komisyonu **%0,04** + **1bp kayma**; yani işlem başına maliyet ≈ %0,10 (5bp giriş + 5bp çıkış). Long: çıkış / giriş maliyetli kurlardan; short simetrik.
- **Funding:** Pozisyon açık kaldığı her 8 saatlik funding anı için gerçek oran uygulanır.
- **Kaldıraç yok (1×):** Her sembole ayrılan sermaye tam olarak tek pozisyonda değerlendirilir; sinyalsiz dönemde nakit (faiz yok). Semboller birbirinden bağımsızdır.
- **Stop:** Stop türleri: ATR (izleyen/trailing — her barda en yüksek/dip değere göre güncellenir), NATR, sabit seviye (indikatör çizgisi) veya yüzde. Stop giriş barından itibaren izlenir ama **yalnızca sonraki barlarda** tetiklenir; long'da `min(açılış, stop)`, short'ta `max(açılış, stop)` fiyatından gerçekleşir (boşluklu açılışta açılıştan).
- **Ters sinyal (flip):** İki yönlü stratejilerde karşıt sinyal aynı bar açılışında pozisyonu kapatıp yenisini açar.
- **Zaman aşımı:** Bazı stratejilerde `maxBars` süre sınırı vardır; süre dolunca pozisyon kapanır.
- **Tek işlem kaybı** en fazla %99,9 olarak sınırlandırılır (r ≥ −0,999). Dönem sonunda açık pozisyon son kapanıştan kapatılır.

## 4. Strateji kataloğu ve test dışı dilimler

Her indikatör için **tek** mekanik yorum vardır: ya "sadece long" (sinyal tersine dönünce nakde geçer) ya "iki yön" (long/short flip). Kuralların tam listesi §10'dadır.

Bazı indikatörler kavramsal olarak anlamsız olduğu için belirli dilimlerde **hiç test edilmedi**:

| İndikatör | Test dışı dilimler |
| --- | --- |
| Çoklu Zaman Dilimi — Çoklu Zaman Dilimi Trend + EMA(20) Tetiği | 1w |
| ORB — Açılış Aralığı Kırılımı (ORB) | 4h, 1d, 1w |
| Pivot Noktaları — Klasik Pivot (PP/S1/R1) Sekmesi | 1d, 1w |

Ayrıca veri kaynaklı boşluklar olabilir: bir dilimde hiç işlem üremezse özet `null` olur (örnek: Cross 1w).

## 5. Metrik sözlüğü

| Alan | Anlamı |
| --- | --- |
| `n` | İşlem sayısı (tüm semboller toplamı, ilgili zaman diliminde) |
| `wr` | Kazanma oranı = kârlı işlem / n |
| `avg` | İşlem başına ortalama getiri (aritmetik ortalama) |
| `sd` | İşlem getirilerinin standart sapması |
| `pf` | Profit factor = brüt kâr / brüt zarar (99 üstü 99'a kırpılır) |
| `tot` | **Eşit ağırlıklı portföyün toplam getirisi**: eğrinin son değeri − 1 (bileşik) |
| `dd` | Portföy eğrisinin maksimum düşüşü (tepe → dip, negatif) |
| `bars` | Ortalama tutma süresi (bar sayısı) |
| `best` / `worst` | En iyi / en kötü tek işlem getirisi |
| `nsym` | En az 3 işlem yapan sembol sayısı |
| `pos` | Ortalaması pozitif olan sembollerin oranı (nsym içinde) |
| `top` / `bot` | Sembol bazında en iyi / en kötü **ortalama işlem getirisi** olan sembol |
| `hist` | Tüm işlem getirilerinin dağılımı: 82 kova (−10%…+10% arası 0,25'lik 80 kova + alt/üst taşma) |
| `heat` | Sembol × dilim tablosu; metrikler: `avg`, `wr`, `n`, `dd`, `pf`, `bh` |
| `bh` | Al-tut getirisi: sembolün son kapanışı / ilk kapanışı − 1 |
| `years` | `[portföy yıllık getirisi, o yıl kazanma oranı, işlem sayısı]` |

**Not:** Ortalama işlem getirisi ile toplam portföy getirisi farklı şeylerdir; yeni listelenen coinlerin uç işlemleri ortalamayı saptırabildiği için medyan > ortalama olabilir (§12).

## 6. Portföy eğrisi ve "en iyi dilim" kuralı

- Her sembole başlangıçta **1 birim** sermaye verilir; sembolün eğrisi işlem getirileriyle sırayla bileşiklenir.
- **Portföy eğrisi** = o hafta verisi olan sembollerin eğri değerlerinin **ortalaması** (haftalık 215 nokta).
- Dönem içinde **yeniden dengeleme yoktur**; kazanan semboller portföyde doğal olarak büyür (eşit ağırlıklı al-tut mantığı).
- Yıllık getiri, portföy eğrisinden yıl sonu / önceki yıl sonu − 1 olarak hesaplanır. 2022 yılı ızgara Ağustos'ta başladığı için **2022 (Ağu–Ara)**, son yıl ise **kısmi** dönemdir.
- **En iyi dilim kuralı:** Önce uygunluk kademesi (n ≥ 100 → n ≥ 30 → diğer), eşitlikte **en yüksek portföy toplam getirisi** (`tot`). Böylece hem istatistiksel olarak güvenilir hem de gerçekten kazandıran dilim seçilir.

## 7. Sonuçlar — en iyi dilim (100 indikatör)

### Trend (20 indikatör)

| İndikatör | Strateji | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı | Poz. sembol |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ADX / DMI | ADX + DI Kesişimi (14) | 1h | 241.510 | 35.6% | +0.18% | 1.09 | -47.7% | **+14581.83%** | 59% |
| SMA | SMA Kesişimi (10/30) | 4h | 92.936 | 34.9% | +0.99% | 1.28 | -52.3% | **+3351.91%** | 75% |
| Hull MA | HMA(20) Fiyat Kesişimi | 1h | 320.853 | 33.9% | +0.15% | 1.08 | -84.7% | **+3112.17%** | 59% |
| McGinley | McGinley Dinamik Eğrisi (14) | 15m | 5.604.799 | 20.4% | -0.09% | 0.79 | -96.6% | **+2865.82%** | 8% |
| Parabolic SAR | Parabolic SAR Dönüşü | 4h | 202.192 | 38.8% | +0.52% | 1.20 | -39.8% | **+2572.39%** | 77% |
| WMA | WMA Kesişimi (10/30) | 4h | 114.840 | 32.8% | +0.82% | 1.26 | -53.5% | **+1956.78%** | 75% |
| Aroon | Aroon Eşik Kesişimi (25) | 1h | 328.995 | 35.1% | +0.14% | 1.07 | -58.4% | **+1703.05%** | 58% |
| MA Şeridi | EMA Şeridi Hizalanması (13-89) | 1h | 79.550 | 30.0% | +1.32% | 1.35 | -34.6% | **+1415.27%** | 76% |
| Supertrend | Supertrend Dönüşü (10, 3) | 1h | 218.645 | 34.2% | +0.28% | 1.11 | -43.8% | **+1330.45%** | 62% |
| EMA | EMA Kesişimi (12/26) | 15m | 1.390.774 | 26.1% | -0.05% | 0.95 | -77.6% | **+1064.66%** | 30% |
| Guppy MMA | GMMA Kısa/Uzun Grup Kesişimi | 15m | 723.058 | 27.7% | +0.02% | 1.01 | -61.3% | **+678.68%** | 48% |
| Vortex | Vortex Kesişimi (14) | 4h | 251.003 | 34.1% | +0.37% | 1.19 | -42.5% | **+662.02%** | 70% |
| LinReg Kanalı | LinReg Kanal Orta Çizgisi (50) | 4h | 272.491 | 26.2% | +0.19% | 1.10 | -83.6% | **+626.48%** | 59% |
| Fractals | Fractal Kırılımı (Bill Williams) | 4h | 107.744 | 33.2% | +0.71% | 1.21 | -35.1% | **+605.63%** | 70% |
| TRIX | TRIX Sinyal Kesişimi (15) | 4h | 123.969 | 38.6% | +0.69% | 1.21 | -46.1% | **+226.58%** | 72% |
| Trend Çizgileri | Trend Çizgisi Kırılımı (yaklaşım) | 1w | 2.932 | 42.4% | +13.22% | 2.05 | -20.0% | **+103.50%** | 68% |
| Ichimoku | Ichimoku Bulut Kırılımı | 1w | 767 | 31.9% | +47.49% | 2.57 | -43.0% | **+37.46%** | 52% |
| Altın / Ölüm Kesişimi | Altın / Ölüm Kesişimi (50/200) | 4h | 6.787 | 26.7% | +1.99% | 1.22 | -42.4% | **+17.20%** | 36% |
| Zarflar | Zarf Geri Dönüşü (20, %2,5) | 5m | 212.519 | 62.9% | +0.03% | 1.04 | -19.4% | **+14.73%** | 59% |
| Alligator | Alligator Hizalanması | 1w | 4.595 | 35.0% | -8.73% | 0.41 | -60.3% | **-58.31%** | 16% |

### Hız (Momentum) (20 indikatör)

| İndikatör | Strateji | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı | Poz. sembol |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ultimate Osc. | Ultimate Oscillator Dönüşü | 1d | 1.150 | 58.6% | +110.18% | 7.30 | -10.0% | **+1442.59%** | 85% |
| StochRSI | StochRSI Kesişimi (0,2/0,8) | 4h | 11.594 | 56.5% | +21.60% | 5.61 | -31.6% | **+1224.87%** | 96% |
| CCI | CCI Aşırılık Dönüşü (20) | 4h | 89.959 | 60.4% | +0.70% | 1.22 | -42.9% | **+943.40%** | 75% |
| DPO | DPO Sıfır Kesişimi (20) | 1d | 86.055 | 53.3% | +1.26% | 1.39 | -30.3% | **+832.80%** | 87% |
| Awesome Oscillator | Awesome Oscillator Sıfır Kesişimi | 1d | 15.311 | 34.1% | +6.59% | 1.89 | -44.3% | **+727.20%** | 77% |
| Williams %R | Williams %R Dönüşü (14) | 4h | 111.837 | 61.3% | +0.62% | 1.21 | -46.3% | **+647.16%** | 74% |
| SMI | SMI Aşırılık Dönüşü (14,3) | 4h | 84.125 | 54.0% | +1.11% | 1.33 | -28.3% | **+602.13%** | 76% |
| CMO | CMO Sıfır Kesişimi (14) | 4h | 296.814 | 31.3% | +0.25% | 1.14 | -39.4% | **+597.03%** | 65% |
| Momentum | Momentum Sıfır Kesişimi (10) | 1d | 55.912 | 32.9% | +1.26% | 1.31 | -40.1% | **+519.84%** | 66% |
| PPO | PPO Sinyal Kesişimi | 1h | 754.348 | 32.8% | 0.00% | 1.00 | -66.5% | **+514.76%** | 45% |
| MACD | MACD Sinyal Kesişimi | 4h | 183.167 | 34.0% | +0.47% | 1.18 | -61.7% | **+508.34%** | 71% |
| ROC | ROC Sıfır Kesişimi (9) | 1d | 59.233 | 33.2% | +1.21% | 1.31 | -48.6% | **+479.28%** | 68% |
| TSI | TSI Sinyal Kesişimi (25,13) | 1d | 35.265 | 34.7% | +2.92% | 1.50 | -49.8% | **+454.37%** | 65% |
| Fisher Transform | Fisher Dönüşü (10) | 4h | 53.463 | 61.5% | +1.53% | 1.37 | -34.8% | **+445.76%** | 76% |
| PMO | PMO Sinyal Kesişimi | 4h | 138.167 | 33.4% | +0.62% | 1.20 | -43.5% | **+316.01%** | 71% |
| Stochastic | Stokastik Kesişimi (14,3,3) | 4h | 65.666 | 62.6% | +0.96% | 1.24 | -53.9% | **+289.76%** | 73% |
| KST | KST Sinyal Kesişimi | 1d | 21.108 | 39.3% | +3.36% | 1.44 | -44.4% | **+209.99%** | 67% |
| RVI | RVI Sinyal Kesişimi (10) | 1d | 116.797 | 40.4% | +0.62% | 1.20 | -38.4% | **+195.51%** | 68% |
| Coppock | Coppock Eğrisi Sıfır Kesişimi | 1d | 9.183 | 27.8% | +0.67% | 1.08 | -51.5% | **+2.48%** | 36% |
| RSI | RSI Aşırılık Dönüşü (14) | 1d | 1.591 | 44.7% | -1.02% | 0.94 | -17.3% | **-4.75%** | 42% |

### Hacim (20 indikatör)

| İndikatör | Strateji | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı | Poz. sembol |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hacim Profili | Hacim Profili / Değer Alanı Kırılımı (yaklaşım) | 15m | 500.993 | 29.2% | +0.04% | 1.03 | -51.5% | **+2281.24%** | 49% |
| Force Index | Force Index EMA(13) Sıfır Kesişimi | 1h | 1.107.292 | 24.7% | -0.05% | 0.95 | -74.1% | **+2178.18%** | 28% |
| OBV | OBV + EMA(21) Kesişimi | 4h | 328.015 | 25.3% | +0.19% | 1.12 | -38.6% | **+2152.84%** | 67% |
| PVT | PVT + EMA(21) Kesişimi | 1h | 799.558 | 23.5% | -0.03% | 0.97 | -69.3% | **+1610.68%** | 33% |
| VWAP | VWAP Üstü/Altı + Hacim Filtresi | 4h | 199.062 | 36.2% | +0.62% | 1.28 | -54.6% | **+1571.03%** | 86% |
| NVI | NVI + EMA(200) Trendi | 4h | 56.215 | 37.3% | +1.96% | 1.60 | -26.7% | **+1570.22%** | 79% |
| PVI | PVI + EMA(200) Trendi | 1h | 207.348 | 22.8% | +0.47% | 1.25 | -65.6% | **+1351.90%** | 61% |
| EOM | Ease of Movement Sıfır Kesişimi (14) | 4h | 329.794 | 30.7% | +0.22% | 1.13 | -70.9% | **+930.86%** | 63% |
| Chaikin Osc. | Chaikin Oscillator Sıfır Kesişimi | 4h | 268.541 | 34.7% | +0.37% | 1.18 | -31.6% | **+902.39%** | 76% |
| Volume Osc. | Hacim Osilatörü Sıfır Kesişimi (5,20) | 1d | 42.805 | 46.6% | +2.15% | 1.43 | -34.5% | **+606.35%** | 77% |
| A/D Çizgisi | A/D Çizgisi + EMA(21) | 1h | 1.257.527 | 29.5% | -0.05% | 0.95 | -82.3% | **+578.89%** | 31% |
| Hacim ROC | Hacim ROC Sıfır Kesişimi (25) | 1d | 99.966 | 47.7% | +0.79% | 1.25 | -39.2% | **+553.45%** | 69% |
| VWMA | VWMA(20) Fiyat Kesişimi | 4h | 300.685 | 24.4% | +0.27% | 1.15 | -40.0% | **+549.91%** | 69% |
| CMF | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | 254.348 | 36.9% | +0.35% | 1.18 | -39.6% | **+476.05%** | 72% |
| Twiggs MF | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | 204.949 | 30.9% | +0.50% | 1.24 | -36.1% | **+458.03%** | 80% |
| MFI | MFI Aşırılık Dönüşü (14) | 1d | 4.389 | 61.2% | +20.87% | 3.01 | -7.7% | **+454.73%** | 82% |
| KVO | KVO Sinyal Kesişimi | 4h | 251.234 | 37.2% | +0.31% | 1.14 | -56.5% | **+274.62%** | 70% |
| RVOL | RVOL Patlaması (1,5×) | 1h | 616.573 | 43.2% | -0.05% | 0.96 | -71.0% | **+248.91%** | 33% |
| Anchored VWAP | Anchored VWAP Kesişimi | 1d | 32.716 | 21.9% | +2.54% | 1.56 | -38.4% | **+215.28%** | 72% |
| Hacim Barları | Hacim Patlaması (2× ortalama) | 1d | 20.034 | 42.3% | +1.05% | 1.21 | -17.6% | **+75.48%** | 58% |

### Volatilite (20 indikatör)

| İndikatör | Strateji | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı | Poz. sembol |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RVI | RVI Bölgesi (50) Trendi | 4h | 411.113 | 25.0% | +0.18% | 1.12 | -45.9% | **+17857.73%** | 65% |
| Ulcer Index | Ulcer Index Sakinlik Filtresi | 1h | 411.821 | 19.8% | +0.10% | 1.08 | -51.9% | **+2815.52%** | 60% |
| Choppiness | Choppiness Trend Filtresi (38) | 5m | 26.143 | 30.7% | +3.86% | 1.81 | -24.8% | **+2261.08%** | 63% |
| Donchian | Donchian Kırılımı (20/10 — Turtle) | 1h | 244.493 | 33.7% | +0.09% | 1.04 | -51.0% | **+1687.77%** | 47% |
| Chaikin Vol. | Chaikin Volatilite + Zirve Kırılımı | 1h | 230.590 | 33.5% | +0.07% | 1.03 | -51.7% | **+1636.74%** | 46% |
| Tarihsel Vol. | Tarihsel Volatilite Düşüş Filtresi | 4h | 80.520 | 21.6% | +1.09% | 1.42 | -66.8% | **+1363.81%** | 68% |
| NATR | EMA(50) Trendi + NATR Yüzde Stopu | 1h | 829.155 | 17.8% | 0.00% | 1.00 | -65.1% | **+801.38%** | 38% |
| TTM Squeeze | TTM Squeeze Serbest Kalışı | 1h | 224.592 | 36.1% | +0.12% | 1.07 | -41.8% | **+520.72%** | 54% |
| Keltner | Keltner Kanal Kırılımı (20, 1,5) | 1h | 287.010 | 31.4% | +0.04% | 1.02 | -47.0% | **+302.86%** | 46% |
| VIX / Korku | Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 4h | 153.981 | 22.4% | +0.48% | 1.26 | -59.9% | **+272.23%** | 72% |
| ATR | EMA(50) Trendi + ATR Takip Stopu | 4h | 191.333 | 21.4% | +0.36% | 1.20 | -42.1% | **+244.35%** | 70% |
| Parkinson | Parkinson Volatilite + Zirve Kırılımı | 1d | 5.994 | 36.0% | +4.13% | 1.45 | -35.2% | **+114.06%** | 55% |
| Bollinger | Bollinger Ortalamaya Dönüş (20, 2) | 1d | 13.544 | 66.6% | +2.36% | 1.46 | -23.3% | **+95.55%** | 73% |
| %B | %B Aşırılık Dönüşü | 1d | 13.541 | 66.7% | +2.36% | 1.46 | -23.3% | **+95.54%** | 73% |
| True Range | True Range Patlaması | 4h | 175.203 | 46.6% | +0.16% | 1.08 | -44.3% | **+82.91%** | 63% |
| Std Sapma | Standart Sapma Genişleme Filtresi | 4h | 68.621 | 25.2% | +0.45% | 1.22 | -17.4% | **+77.94%** | 62% |
| Band Genişliği | Bant Sıkışması Kırılımı | 1w | 273 | 42.9% | +37.06% | 4.13 | -7.2% | **+55.23%** | 40% |
| Volatilite Oranı | Volatilite Oranı Kırılımı (1,5) | 1d | 29.983 | 43.6% | +0.49% | 1.14 | -22.5% | **+50.34%** | 54% |
| Chandelier Exit | Chandelier Çıkış Çizgisi (22, 3) | 1d | 22.248 | 33.2% | +1.19% | 1.35 | -21.7% | **+48.78%** | 51% |
| Mass Index | Mass Index Tümsek Dönüşü (yaklaşım) | 1w | 551 | 38.8% | +16.43% | 2.37 | -9.7% | **+23.62%** | 46% |

### Piyasa Yapısı (20 indikatör)

| İndikatör | Strateji | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı | Poz. sembol |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ORB | Açılış Aralığı Kırılımı (ORB) | 5m | 1.144.274 | 28.0% | -0.05% | 0.96 | -78.7% | **+4940.83%** | 31% |
| Market Profile | POC Göçü Trendi (yaklaşım) | 15m | 427.388 | 31.9% | +0.08% | 1.05 | -41.8% | **+1369.52%** | 56% |
| Destek & Direnç | Destek/Direnç Pivot Kırılımı | 4h | 107.744 | 33.2% | +0.71% | 1.21 | -35.1% | **+605.63%** | 70% |
| Üç Mum Formasyonları | Yutan Mum + 3 Asker/Karga | 1d | 57.064 | 39.9% | +0.76% | 1.17 | -46.5% | **+441.29%** | 57% |
| Çoklu Zaman Dilimi | Çoklu Zaman Dilimi Trend + EMA(20) Tetiği | 4h | 154.583 | 23.7% | +0.28% | 1.18 | -27.3% | **+419.00%** | 70% |
| Kırılım & Tuzak | 30-Bar Kırılım Sistemi | 1d | 10.151 | 36.5% | +2.55% | 1.36 | -25.4% | **+140.41%** | 60% |
| Omuz-Baş-Omuz | Omuz-Baş-Omuz Boyun Çizgisi Kırılımı (yaklaşım) | 1d | 9.573 | 38.5% | +3.23% | 1.53 | -13.8% | **+132.09%** | 66% |
| İkili Dip / Tepe | İkiz Tepe / İkiz Dip Kırılımı (yaklaşım) | 1h | 436.794 | 34.3% | 0.00% | 1.00 | -49.5% | **+121.54%** | 48% |
| Likidite & Stop Avı | Likidite Süpürme + Geri Alım | 1w | 1.984 | 38.9% | +11.30% | 1.75 | -19.9% | **+108.75%** | 58% |
| Sıkışma Formasyonları | Sıkışan Üçgen Kırılımı | 1w | 855 | 42.0% | +49.88% | 4.37 | -10.9% | **+106.11%** | 55% |
| Wyckoff Şeması | Wyckoff Yay/Spring Dönüşü | 1h | 171.040 | 52.3% | +0.14% | 1.07 | -27.6% | **+72.40%** | 62% |
| Pivot Noktaları | Klasik Pivot (PP/S1/R1) Sekmesi | 5m | 294.488 | 66.1% | +0.08% | 1.05 | -48.3% | **+71.64%** | 63% |
| FVG | FVG (Adaletsiz Fiyat Boşluğu) Dolumu | 1w | 6.733 | 44.5% | +3.80% | 1.47 | -26.8% | **+63.46%** | 74% |
| Fiyat Kanalları | Regresyon Kanalı Kırılımı (50) | 4h | 110.189 | 32.0% | +0.04% | 1.03 | -38.6% | **+55.03%** | 48% |
| Elliott Dalga | Dalga 3 Devam Kırılımı (yaklaşım) | 1h | 11.493 | 45.7% | +0.63% | 1.22 | -8.0% | **+32.45%** | 54% |
| Tek Mum Formasyonları | Pin Bar / Çekiç Dönüşü | 1d | 12.786 | 50.4% | +1.19% | 1.27 | -13.1% | **+30.75%** | 63% |
| Order Block | Order Block Geri Testi (yaklaşım) | 1d | 1.330 | 50.4% | +2.32% | 1.29 | -4.7% | **+8.85%** | 48% |
| Fibo Uzantı | Fibonacci 1,618 Uzantı Hedefli Kırılım | 1d | 2.264 | 52.2% | +0.82% | 1.11 | -11.3% | **+2.81%** | 49% |
| Harmonik Formasyonlar | Harmonik 0,618-0,786 Bölgesi Dönüşü (yaklaşım) | 1d | 10.071 | 26.6% | -0.32% | 0.94 | -31.6% | **-5.88%** | 38% |
| Fibo Geri Çekilme | Fibonacci %50-61,8 Geri Çekilme Alımı | 1d | 10.508 | 48.1% | -0.28% | 0.95 | -32.8% | **-6.10%** | 43% |

## 8. Yıllık portföy getirileri (en iyi dilim)

Yıllar: 2022 = Ağu–Ara (kısmi), 2026 = Oca–8 Eyl (kısmi). Değerler portföy eğrisinden; işlem sayıları o yıl kapanan işlemlerdir.

| İndikatör | 2022* | 2023 | 2024 | 2025 | 2026* |
| --- | ---: | ---: | ---: | ---: | ---: |
| RVI | +5.7% | +1.5% | +6.7% | +272.6% | +4109.4% |
| ADX / DMI | -2.6% | -9.9% | -10.6% | +2048.0% | +771.0% |
| ORB | -31.5% | -49.8% | -5.3% | +283.9% | +3931.6% |
| SMA | -3.6% | +8.7% | +242.0% | +14.1% | +744.4% |
| Hull MA | -12.2% | -21.9% | +102.3% | +1320.0% | +63.1% |
| McGinley | -95.3% | +93.5% | +50.2% | +360.7% | +4641.4% |
| Ulcer Index | -10.6% | -2.4% | +67.4% | +37.7% | +1349.0% |
| Parabolic SAR | -9.8% | +0.4% | +96.7% | +164.0% | +468.5% |
| Hacim Profili | -28.2% | -15.5% | +18.8% | +230.7% | +898.0% |
| Choppiness | +3.5% | +9.1% | +59.2% | +227.8% | +300.6% |
| Force Index | -37.6% | -35.8% | -13.1% | +361.5% | +1317.6% |
| OBV | +14.8% | -0.1% | +27.9% | +260.6% | +326.0% |
| WMA | -7.3% | +21.6% | +221.5% | +16.6% | +387.0% |
| Aroon | -23.3% | -27.0% | +65.1% | +139.9% | +713.2% |
| Donchian | -29.1% | -12.8% | +7.2% | +305.1% | +565.7% |
| Chaikin Vol. | -28.5% | -15.4% | +7.6% | +296.4% | +572.6% |
| PVT | -32.1% | -39.4% | -4.9% | +557.6% | +565.4% |
| VWAP | +83.1% | -25.2% | +30.5% | +128.8% | +308.3% |
| NVI | +12.2% | +29.0% | +157.5% | +72.6% | +159.7% |
| Ultimate Osc. | 0.0% | +3.5% | +22.9% | +83.7% | +560.3% |
| MA Şeridi | -9.7% | +39.8% | +148.1% | +28.8% | +275.6% |
| Market Profile | -10.7% | +4.2% | +54.9% | +69.3% | +501.9% |
| Tarihsel Vol. | +2.7% | +23.5% | +9.9% | +111.9% | +395.4% |
| PVI | -11.0% | -9.3% | +34.0% | +224.1% | +313.9% |
| Supertrend | -19.6% | -16.8% | +63.8% | +83.1% | +612.3% |
| StochRSI | +59.3% | -0.9% | -2.4% | +192.1% | +194.3% |
| EMA | -49.4% | -40.0% | +12.7% | +413.7% | +561.5% |
| CCI | +25.6% | -15.4% | -18.8% | +219.6% | +278.6% |
| EOM | -10.2% | -15.6% | +111.2% | +85.4% | +247.2% |
| Chaikin Osc. | -30.9% | +42.6% | +238.3% | +43.2% | +110.0% |
| DPO | +27.6% | +60.4% | +6.0% | +172.0% | +58.2% |
| NATR | -30.4% | -20.5% | -4.4% | +230.9% | +415.5% |
| Awesome Oscillator | -23.4% | +34.1% | +33.7% | +34.0% | +349.6% |
| Guppy MMA | -32.6% | -21.8% | +8.7% | +363.4% | +193.6% |
| Vortex | -11.1% | -10.3% | +231.4% | +22.9% | +134.8% |
| Williams %R | +30.1% | +8.2% | -34.6% | +540.6% | +26.7% |
| LinReg Kanalı | +9.3% | -15.0% | +109.6% | +335.1% | -14.3% |
| Volume Osc. | -2.7% | +54.0% | +241.9% | +12.8% | +22.2% |
| Fractals | -9.8% | +3.1% | +96.6% | +47.9% | +160.7% |
| Destek & Direnç | -9.8% | +3.1% | +96.6% | +47.9% | +160.7% |
| SMI | +37.4% | -2.0% | -3.7% | +144.0% | +121.9% |
| CMO | -14.5% | -14.1% | +148.0% | +47.5% | +159.4% |
| A/D Çizgisi | -33.0% | -52.9% | -1.8% | +264.5% | +501.3% |
| Hacim ROC | +18.4% | +88.9% | +228.2% | +4.0% | -14.3% |
| VWMA | +0.7% | -7.4% | +139.6% | +37.9% | +110.9% |
| TTM Squeeze | -6.8% | -7.0% | +20.1% | +82.2% | +227.5% |
| Momentum | -16.1% | +39.2% | +59.0% | -8.3% | +264.2% |
| PPO | -19.1% | -40.6% | -20.9% | +358.4% | +253.2% |
| MACD | +7.3% | +7.8% | +131.9% | +171.2% | -16.4% |
| ROC | +20.6% | +13.5% | +90.7% | -35.5% | +244.0% |
| CMF | -31.7% | +24.9% | +178.1% | +15.7% | +110.0% |
| Twiggs MF | -29.4% | +61.0% | +151.5% | +17.1% | +66.8% |
| MFI | +7.6% | +32.2% | +30.2% | +73.2% | +73.1% |
| TSI | -3.2% | +41.5% | +69.0% | -40.0% | +299.1% |
| Fisher Transform | +27.6% | -12.9% | +7.1% | +127.2% | +101.7% |
| Üç Mum Formasyonları | +13.2% | -4.2% | +40.1% | +6.5% | +234.6% |
| Çoklu Zaman Dilimi | +3.9% | +3.2% | +19.8% | +85.5% | +117.8% |
| PMO | +1.2% | +17.3% | +154.7% | +6.9% | +28.7% |
| Keltner | -19.0% | -16.8% | -5.1% | +155.6% | +146.6% |
| Stochastic | +25.6% | -3.7% | -30.1% | +150.7% | +83.7% |
| KVO | +48.2% | -34.2% | +52.4% | +156.0% | -1.6% |
| VIX / Korku | -19.4% | +6.8% | +102.3% | +211.7% | -31.4% |
| RVOL | -32.4% | -35.9% | +24.3% | +68.1% | +285.5% |
| ATR | +8.9% | -23.7% | +76.5% | +64.9% | +42.3% |
| TRIX | -2.8% | +4.5% | +163.7% | +7.2% | +13.8% |
| Anchored VWAP | -7.7% | +20.4% | -16.6% | +30.9% | +159.9% |
| KST | -28.4% | +37.6% | +107.1% | -31.3% | +121.3% |
| RVI | -2.7% | -3.6% | +115.4% | +28.2% | +14.1% |
| Kırılım & Tuzak | -6.0% | +5.3% | -9.9% | +24.4% | +116.8% |
| Omuz-Baş-Omuz | -2.4% | +5.9% | +7.9% | +21.2% | +71.8% |
| İkili Dip / Tepe | -21.0% | -25.9% | -0.1% | +137.8% | +59.4% |
| Parkinson | -3.9% | -9.4% | -11.7% | +20.4% | +131.4% |
| Likidite & Stop Avı | 0.0% | +0.9% | +22.5% | +10.1% | +53.3% |
| Sıkışma Formasyonları | 0.0% | -3.8% | -1.0% | -5.4% | +128.7% |
| Trend Çizgileri | 0.0% | -2.5% | +8.3% | +23.8% | +55.7% |
| Bollinger | +19.9% | -7.0% | +6.8% | +19.4% | +37.5% |
| %B | +19.9% | -7.0% | +6.8% | +19.4% | +37.5% |
| True Range | +7.5% | -11.4% | +6.6% | +36.7% | +31.9% |
| Std Sapma | +5.0% | -5.7% | +8.3% | +18.4% | +40.1% |
| Hacim Barları | +8.2% | +10.4% | -8.2% | +4.7% | +52.7% |
| Wyckoff Şeması | +17.7% | -13.0% | +2.4% | +43.0% | +15.0% |
| Pivot Noktaları | +15.3% | +21.4% | -9.2% | -6.4% | +44.3% |
| FVG | 0.0% | +14.8% | -6.3% | +16.1% | +31.0% |
| Band Genişliği | 0.0% | 0.0% | +1.6% | -3.1% | +57.7% |
| Fiyat Kanalları | +15.8% | -20.9% | -18.1% | +67.6% | +23.3% |
| Volatilite Oranı | -3.0% | +15.8% | +21.6% | -13.8% | +27.6% |
| Chandelier Exit | -7.7% | +12.5% | +31.1% | -14.1% | +27.3% |
| Ichimoku | 0.0% | -3.6% | -25.4% | -14.3% | +123.0% |
| Elliott Dalga | -1.2% | +5.8% | +9.0% | +12.1% | +3.7% |
| Tek Mum Formasyonları | +3.4% | -0.5% | +7.6% | +0.1% | +17.9% |
| Mass Index | 0.0% | -9.2% | +13.0% | -1.1% | +21.8% |
| Altın / Ölüm Kesişimi | -24.1% | +19.6% | +20.1% | -12.1% | +22.3% |
| Zarflar | -9.4% | +13.6% | +18.9% | -10.0% | +4.2% |
| Order Block | +1.8% | -1.2% | -1.2% | +2.1% | +7.2% |
| Fibo Uzantı | -3.6% | +8.6% | +5.4% | -8.3% | +1.6% |
| Coppock | -24.9% | +34.9% | +34.6% | -35.4% | +16.4% |
| RSI | +1.3% | +7.1% | +1.5% | +2.8% | -15.8% |
| Harmonik Formasyonlar | -6.2% | +10.4% | +8.2% | -22.5% | +8.5% |
| Fibo Geri Çekilme | -2.1% | +17.5% | -4.5% | -22.4% | +10.2% |
| Alligator | 0.0% | -20.4% | -22.0% | -8.8% | -26.4% |

## 9. Tüm zaman dilimi sonuçları (tam tablo)

100 indikatör × 6 dilim; `null` (test dışı / işlemsiz) dilimler atlanmıştır. Sıralama: indikatör adı.

| İndikatör | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| %B | 5m | 4.216.942 | 61.4% | -0.07% | 0.82 | -92.0% | -75.40% |
| %B | 15m | 1.428.715 | 64.5% | -0.05% | 0.92 | -65.6% | -24.63% |
| %B | 1h | 353.034 | 65.9% | +0.05% | 1.04 | -46.4% | +68.96% |
| %B | 4h | 86.188 | 66.3% | +0.34% | 1.14 | -40.4% | +78.84% |
| %B | 1d | 13.541 | 66.7% | +2.36% | 1.46 | -23.3% | +95.54% |
| %B | 1w | 1.042 | 62.1% | +10.27% | 1.94 | -7.8% | +38.22% |
| A/D Çizgisi | 5m | 14.051.940 | 25.7% | -0.10% | 0.69 | -99.8% | -99.20% |
| A/D Çizgisi | 15m | 5.009.664 | 27.5% | -0.10% | 0.81 | -97.6% | -97.23% |
| A/D Çizgisi | 1h | 1.257.527 | 29.5% | -0.05% | 0.95 | -82.3% | +578.89% |
| A/D Çizgisi | 4h | 308.048 | 32.1% | +0.32% | 1.18 | -36.4% | +385.96% |
| A/D Çizgisi | 1d | 46.462 | 31.9% | +1.80% | 1.41 | -50.0% | +235.84% |
| A/D Çizgisi | 1w | 3.299 | 34.8% | +18.29% | 2.75 | -18.1% | +152.82% |
| ADX / DMI | 5m | 2.755.422 | 32.9% | -0.08% | 0.88 | -91.6% | -84.90% |
| ADX / DMI | 15m | 927.920 | 34.6% | -0.01% | 0.99 | -75.3% | +1246.97% |
| ADX / DMI | 1h | 241.510 | 35.6% | +0.18% | 1.09 | -47.7% | +14581.83% |
| ADX / DMI | 4h | 59.396 | 36.5% | +1.31% | 1.34 | -41.7% | +625.58% |
| ADX / DMI | 1d | 9.596 | 37.2% | +7.71% | 1.90 | -20.0% | +246.11% |
| ADX / DMI | 1w | 731 | 38.4% | +90.69% | 6.71 | -9.1% | +222.48% |
| Alligator | 5m | 14.604.233 | 19.2% | -0.50% | 0.10 | -100.0% | -99.67% |
| Alligator | 15m | 4.905.524 | 23.6% | -0.77% | 0.13 | -100.0% | -99.51% |
| Alligator | 1h | 1.223.620 | 27.2% | -1.40% | 0.16 | -99.7% | -99.67% |
| Alligator | 4h | 305.494 | 29.6% | -2.56% | 0.19 | -99.0% | -99.03% |
| Alligator | 1d | 47.805 | 30.2% | -5.42% | 0.25 | -92.8% | -92.83% |
| Alligator | 1w | 4.595 | 35.0% | -8.73% | 0.41 | -60.3% | -58.31% |
| Altın / Ölüm Kesişimi | 5m | 369.330 | 29.8% | -0.09% | 0.93 | -58.1% | -38.62% |
| Altın / Ölüm Kesişimi | 15m | 121.893 | 29.7% | +0.04% | 1.02 | -50.6% | +4.03% |
| Altın / Ölüm Kesişimi | 1h | 29.837 | 27.9% | -0.08% | 0.98 | -50.3% | -13.51% |
| Altın / Ölüm Kesişimi | 4h | 6.787 | 26.7% | +1.99% | 1.22 | -42.4% | +17.20% |
| Altın / Ölüm Kesişimi | 1d | 791 | 20.2% | -13.30% | 0.48 | -39.1% | -30.14% |
| Anchored VWAP | 5m | 1.006.247 | 8.8% | -0.01% | 0.98 | -75.2% | +40.34% |
| Anchored VWAP | 15m | 557.442 | 10.5% | +0.07% | 1.09 | -61.5% | +71.51% |
| Anchored VWAP | 1h | 253.230 | 13.1% | +0.25% | 1.19 | -42.4% | +115.94% |
| Anchored VWAP | 4h | 109.290 | 16.5% | +0.74% | 1.33 | -44.1% | +148.60% |
| Anchored VWAP | 1d | 32.716 | 21.9% | +2.54% | 1.56 | -38.4% | +215.28% |
| Anchored VWAP | 1w | 4.341 | 27.3% | +13.62% | 2.44 | -17.5% | +154.68% |
| Aroon | 5m | 4.003.562 | 32.1% | -0.10% | 0.84 | -94.0% | -80.41% |
| Aroon | 15m | 1.322.252 | 34.0% | -0.05% | 0.95 | -83.3% | +459.63% |
| Aroon | 1h | 328.995 | 35.1% | +0.14% | 1.07 | -58.4% | +1703.05% |
| Aroon | 4h | 80.672 | 36.3% | +1.01% | 1.26 | -33.7% | +889.24% |
| Aroon | 1d | 12.714 | 38.7% | +7.72% | 1.87 | -43.2% | +999.34% |
| Aroon | 1w | 1.300 | 37.0% | +54.50% | 3.49 | -34.5% | +86.47% |
| ATR | 5m | 10.576.993 | 17.7% | -0.10% | 0.68 | -99.4% | -98.85% |
| ATR | 15m | 3.467.127 | 18.3% | -0.10% | 0.80 | -94.1% | -93.95% |
| ATR | 1h | 829.155 | 19.7% | -0.03% | 0.96 | -62.7% | -9.97% |
| ATR | 4h | 191.333 | 21.4% | +0.36% | 1.20 | -42.1% | +244.35% |
| ATR | 1d | 27.381 | 22.4% | +2.58% | 1.59 | -34.8% | +158.28% |
| ATR | 1w | 1.693 | 28.1% | +40.85% | 5.04 | -26.5% | +240.12% |
| Awesome Oscillator | 5m | 5.242.806 | 26.9% | -0.10% | 0.81 | -95.1% | -94.61% |
| Awesome Oscillator | 15m | 1.730.296 | 29.0% | -0.06% | 0.94 | -81.1% | +173.37% |
| Awesome Oscillator | 1h | 423.485 | 30.4% | +0.13% | 1.07 | -54.8% | +544.02% |
| Awesome Oscillator | 4h | 103.838 | 31.4% | +0.84% | 1.26 | -40.2% | +478.94% |
| Awesome Oscillator | 1d | 15.311 | 34.1% | +6.59% | 1.89 | -44.3% | +727.20% |
| Awesome Oscillator | 1w | 1.183 | 35.8% | +63.37% | 4.41 | -32.7% | +136.30% |
| Band Genişliği | 5m | 2.092.758 | 30.4% | -0.11% | 0.75 | -91.4% | -91.10% |
| Band Genişliği | 15m | 702.608 | 32.0% | -0.13% | 0.82 | -69.6% | -69.46% |
| Band Genişliği | 1h | 171.821 | 34.5% | 0.00% | 1.00 | -30.3% | +42.82% |
| Band Genişliği | 4h | 43.139 | 36.1% | +0.46% | 1.17 | -23.1% | +45.75% |
| Band Genişliği | 1d | 6.976 | 36.9% | +1.65% | 1.27 | -16.7% | +16.67% |
| Band Genişliği | 1w | 273 | 42.9% | +37.06% | 4.13 | -7.2% | +55.23% |
| Bollinger | 5m | 4.217.030 | 61.4% | -0.07% | 0.82 | -92.0% | -75.27% |
| Bollinger | 15m | 1.428.723 | 64.5% | -0.05% | 0.92 | -65.6% | -24.53% |
| Bollinger | 1h | 353.040 | 65.9% | +0.05% | 1.04 | -46.1% | +69.98% |
| Bollinger | 4h | 86.194 | 66.3% | +0.34% | 1.15 | -40.4% | +79.04% |
| Bollinger | 1d | 13.544 | 66.6% | +2.36% | 1.46 | -23.3% | +95.55% |
| Bollinger | 1w | 1.042 | 62.1% | +10.27% | 1.94 | -7.8% | +38.22% |
| CCI | 5m | 4.473.168 | 54.4% | -0.08% | 0.84 | -94.5% | -88.38% |
| CCI | 15m | 1.489.006 | 56.8% | -0.05% | 0.94 | -61.6% | -9.01% |
| CCI | 1h | 368.260 | 59.1% | +0.13% | 1.08 | -68.1% | +449.62% |
| CCI | 4h | 89.959 | 60.4% | +0.70% | 1.22 | -42.9% | +943.40% |
| CCI | 1d | 14.027 | 59.6% | +3.32% | 1.45 | -24.5% | +169.39% |
| CCI | 1w | 1.395 | 58.3% | +27.47% | 2.91 | -26.4% | +168.86% |
| Chaikin Osc. | 5m | 12.437.809 | 28.9% | -0.11% | 0.72 | -99.7% | -99.08% |
| Chaikin Osc. | 15m | 4.324.096 | 30.7% | -0.10% | 0.84 | -95.5% | -95.16% |
| Chaikin Osc. | 1h | 1.084.411 | 32.5% | -0.04% | 0.97 | -81.0% | +463.74% |
| Chaikin Osc. | 4h | 268.541 | 34.7% | +0.37% | 1.18 | -31.6% | +902.39% |
| Chaikin Osc. | 1d | 41.310 | 34.4% | +1.90% | 1.38 | -56.0% | +155.76% |
| Chaikin Osc. | 1w | 2.953 | 38.2% | +21.41% | 2.84 | -20.8% | +179.77% |
| Chaikin Vol. | 5m | 2.826.994 | 30.7% | -0.12% | 0.82 | -91.8% | -90.62% |
| Chaikin Vol. | 15m | 934.627 | 32.5% | -0.10% | 0.91 | -81.0% | +150.19% |
| Chaikin Vol. | 1h | 230.590 | 33.5% | +0.07% | 1.03 | -51.7% | +1636.74% |
| Chaikin Vol. | 4h | 56.085 | 35.3% | +0.92% | 1.23 | -29.5% | +182.75% |
| Chaikin Vol. | 1d | 8.929 | 35.3% | +6.26% | 1.66 | -40.2% | +473.92% |
| Chaikin Vol. | 1w | 929 | 31.9% | +31.28% | 2.30 | -31.1% | +57.62% |
| Chandelier Exit | 5m | 8.355.287 | 21.0% | -0.10% | 0.59 | -99.1% | -98.62% |
| Chandelier Exit | 15m | 2.752.901 | 25.0% | -0.11% | 0.72 | -91.0% | -90.08% |
| Chandelier Exit | 1h | 661.887 | 28.9% | -0.06% | 0.91 | -54.7% | -33.78% |
| Chandelier Exit | 4h | 153.705 | 31.1% | +0.08% | 1.06 | -18.6% | +10.26% |
| Chandelier Exit | 1d | 22.248 | 33.2% | +1.19% | 1.35 | -21.7% | +48.78% |
| Chandelier Exit | 1w | 1.391 | 34.7% | +5.77% | 1.69 | -9.7% | +30.30% |
| Choppiness | 5m | 26.143 | 30.7% | +3.86% | 1.81 | -24.8% | +2261.08% |
| Choppiness | 15m | 7.057 | 23.9% | +6.76% | 1.82 | -7.6% | +101.50% |
| Choppiness | 1h | 1.575 | 25.9% | +19.31% | 2.12 | -5.6% | +60.49% |
| Choppiness | 4h | 384 | 29.9% | +15.02% | 1.53 | -1.2% | +14.58% |
| Choppiness | 1d | 131 | 24.4% | +1.31% | 1.03 | -1.1% | -1.09% |
| Choppiness | 1w | 14 | 7.1% | -60.92% | 0.03 | -64.1% | -64.15% |
| CMF | 5m | 11.624.259 | 29.3% | -0.10% | 0.71 | -99.6% | -98.60% |
| CMF | 15m | 4.084.441 | 32.2% | -0.09% | 0.84 | -94.4% | -85.34% |
| CMF | 1h | 1.012.579 | 34.9% | -0.01% | 0.99 | -64.2% | +380.67% |
| CMF | 4h | 254.348 | 36.9% | +0.35% | 1.18 | -39.6% | +476.05% |
| CMF | 1d | 39.583 | 37.4% | +2.14% | 1.46 | -44.3% | +224.06% |
| CMF | 1w | 2.837 | 37.8% | +16.50% | 2.37 | -24.4% | +101.91% |
| CMO | 5m | 14.103.682 | 24.0% | -0.10% | 0.69 | -99.7% | -99.20% |
| CMO | 15m | 4.884.369 | 26.3% | -0.10% | 0.80 | -95.0% | -89.53% |
| CMO | 1h | 1.195.887 | 29.4% | -0.05% | 0.95 | -72.7% | +14.48% |
| CMO | 4h | 296.814 | 31.3% | +0.25% | 1.14 | -39.4% | +597.03% |
| CMO | 1d | 45.151 | 34.3% | +2.18% | 1.52 | -48.8% | +586.53% |
| CMO | 1w | 3.778 | 37.3% | +15.40% | 2.65 | -21.4% | +162.25% |
| Coppock | 5m | 2.947.768 | 28.7% | -0.11% | 0.78 | -94.9% | -94.52% |
| Coppock | 15m | 977.460 | 30.0% | -0.11% | 0.87 | -80.2% | -61.19% |
| Coppock | 1h | 239.807 | 31.7% | -0.04% | 0.98 | -57.3% | -15.72% |
| Coppock | 4h | 59.623 | 29.9% | +0.03% | 1.01 | -55.8% | -3.49% |
| Coppock | 1d | 9.183 | 27.8% | +0.67% | 1.08 | -51.5% | +2.48% |
| Coppock | 1w | 723 | 20.7% | -10.26% | 0.54 | -39.3% | -25.78% |
| Çoklu Zaman Dilimi | 5m | 8.288.985 | 18.5% | -0.10% | 0.65 | -98.9% | -98.41% |
| Çoklu Zaman Dilimi | 15m | 2.740.104 | 19.5% | -0.10% | 0.78 | -89.0% | -36.84% |
| Çoklu Zaman Dilimi | 1h | 640.035 | 21.1% | -0.06% | 0.93 | -52.0% | +1.54% |
| Çoklu Zaman Dilimi | 4h | 154.583 | 23.7% | +0.28% | 1.18 | -27.3% | +419.00% |
| Çoklu Zaman Dilimi | 1d | 23.008 | 26.8% | +2.10% | 1.54 | -23.2% | +142.26% |
| Destek & Direnç | 5m | 4.958.544 | 29.0% | -0.11% | 0.80 | -97.4% | -96.95% |
| Destek & Direnç | 15m | 1.707.581 | 30.3% | -0.10% | 0.89 | -84.9% | +203.01% |
| Destek & Direnç | 1h | 435.816 | 32.0% | +0.04% | 1.02 | -60.7% | +356.44% |
| Destek & Direnç | 4h | 107.744 | 33.2% | +0.71% | 1.21 | -35.1% | +605.63% |
| Destek & Direnç | 1d | 17.762 | 33.2% | +4.48% | 1.55 | -38.9% | +449.58% |
| Destek & Direnç | 1w | 1.767 | 39.4% | +43.19% | 3.68 | -21.6% | +150.21% |
| Donchian | 5m | 3.029.061 | 30.7% | -0.12% | 0.82 | -92.3% | -91.14% |
| Donchian | 15m | 993.344 | 32.6% | -0.09% | 0.91 | -82.4% | +61.84% |
| Donchian | 1h | 244.493 | 33.7% | +0.09% | 1.04 | -51.0% | +1687.77% |
| Donchian | 4h | 59.647 | 35.3% | +0.94% | 1.24 | -38.1% | +209.65% |
| Donchian | 1d | 9.418 | 35.4% | +6.69% | 1.71 | -41.3% | +570.12% |
| Donchian | 1w | 1.008 | 34.3% | +51.98% | 3.27 | -31.1% | +97.09% |
| DPO | 5m | 27.436.631 | 39.4% | -0.09% | 0.65 | -100.0% | -99.19% |
| DPO | 15m | 9.189.981 | 44.4% | -0.08% | 0.79 | -98.9% | -97.02% |
| DPO | 1h | 2.218.902 | 48.4% | -0.03% | 0.96 | -72.0% | -28.13% |
| DPO | 4h | 533.965 | 48.6% | -0.07% | 0.96 | -68.0% | +178.15% |
| DPO | 1d | 86.055 | 53.3% | +1.26% | 1.39 | -30.3% | +832.80% |
| DPO | 1w | 8.045 | 48.8% | +2.14% | 1.25 | -48.1% | +45.59% |
| Elliott Dalga | 5m | 142.440 | 43.2% | -0.09% | 0.91 | -20.5% | -18.60% |
| Elliott Dalga | 15m | 47.718 | 44.3% | -0.03% | 0.98 | -11.3% | -2.63% |
| Elliott Dalga | 1h | 11.493 | 45.7% | +0.63% | 1.22 | -8.0% | +32.45% |
| Elliott Dalga | 4h | 2.605 | 41.5% | -0.22% | 0.96 | -12.4% | -1.01% |
| Elliott Dalga | 1d | 285 | 31.9% | -4.48% | 0.74 | -15.8% | -8.27% |
| Elliott Dalga | 1w | 12 | 41.7% | -6.17% | 0.69 | -16.7% | -9.72% |
| EMA | 5m | 4.273.263 | 24.4% | -0.10% | 0.83 | -94.0% | -88.87% |
| EMA | 15m | 1.390.774 | 26.1% | -0.05% | 0.95 | -77.6% | +1064.66% |
| EMA | 1h | 340.702 | 27.2% | +0.19% | 1.10 | -66.4% | +602.33% |
| EMA | 4h | 81.863 | 28.7% | +1.17% | 1.33 | -34.2% | +652.44% |
| EMA | 1d | 11.914 | 30.7% | +9.26% | 2.09 | -43.6% | +403.10% |
| EMA | 1w | 881 | 31.0% | +80.49% | 4.83 | -45.7% | +143.05% |
| EOM | 5m | 16.439.506 | 24.4% | -0.10% | 0.67 | -99.9% | -99.24% |
| EOM | 15m | 5.628.746 | 26.5% | -0.10% | 0.80 | -95.1% | -88.71% |
| EOM | 1h | 1.377.203 | 28.9% | -0.05% | 0.94 | -78.6% | +516.30% |
| EOM | 4h | 329.794 | 30.7% | +0.22% | 1.13 | -70.9% | +930.86% |
| EOM | 1d | 43.588 | 32.3% | +2.39% | 1.55 | -49.5% | +358.06% |
| EOM | 1w | 2.450 | 37.3% | +53.61% | 6.71 | -10.1% | +451.66% |
| Fibo Geri Çekilme | 5m | 3.580.239 | 48.9% | -0.11% | 0.73 | -95.3% | -94.86% |
| Fibo Geri Çekilme | 15m | 1.203.517 | 50.2% | -0.11% | 0.83 | -77.6% | -77.27% |
| Fibo Geri Çekilme | 1h | 294.721 | 49.6% | -0.14% | 0.89 | -49.6% | -47.00% |
| Fibo Geri Çekilme | 4h | 73.348 | 49.0% | -0.12% | 0.95 | -26.5% | -14.67% |
| Fibo Geri Çekilme | 1d | 10.508 | 48.1% | -0.28% | 0.95 | -32.8% | -6.10% |
| Fibo Geri Çekilme | 1w | 696 | 34.2% | -9.41% | 0.57 | -37.5% | -25.79% |
| Fibo Uzantı | 5m | 986.945 | 48.2% | -0.12% | 0.75 | -78.5% | -78.30% |
| Fibo Uzantı | 15m | 299.723 | 48.9% | -0.14% | 0.83 | -49.4% | -49.37% |
| Fibo Uzantı | 1h | 70.354 | 48.9% | -0.12% | 0.93 | -20.5% | -15.12% |
| Fibo Uzantı | 4h | 15.895 | 49.2% | -0.07% | 0.98 | -12.3% | -2.17% |
| Fibo Uzantı | 1d | 2.264 | 52.2% | +0.82% | 1.11 | -11.3% | +2.81% |
| Fibo Uzantı | 1w | 94 | 50.0% | -2.15% | 0.89 | -16.4% | -4.06% |
| Fisher Transform | 5m | 2.598.353 | 57.0% | -0.07% | 0.90 | -87.4% | -19.03% |
| Fisher Transform | 15m | 843.871 | 58.5% | -0.01% | 0.99 | -52.2% | +137.10% |
| Fisher Transform | 1h | 211.118 | 59.6% | +0.15% | 1.06 | -63.0% | +114.26% |
| Fisher Transform | 4h | 53.463 | 61.5% | +1.53% | 1.37 | -34.8% | +445.76% |
| Fisher Transform | 1d | 7.791 | 59.0% | +4.89% | 1.48 | -29.6% | +335.34% |
| Fisher Transform | 1w | 771 | 50.5% | +23.62% | 2.00 | -26.6% | +68.63% |
| Fiyat Kanalları | 5m | 5.767.381 | 23.2% | -0.11% | 0.60 | -98.4% | -97.91% |
| Fiyat Kanalları | 15m | 1.923.688 | 26.1% | -0.11% | 0.73 | -85.9% | -84.29% |
| Fiyat Kanalları | 1h | 464.319 | 29.5% | -0.09% | 0.89 | -63.3% | -2.03% |
| Fiyat Kanalları | 4h | 110.189 | 32.0% | +0.04% | 1.03 | -38.6% | +55.03% |
| Fiyat Kanalları | 1d | 16.770 | 34.3% | +0.32% | 1.09 | -17.2% | +15.98% |
| Fiyat Kanalları | 1w | 864 | 26.4% | -0.56% | 0.94 | -9.8% | -4.20% |
| Force Index | 5m | 13.019.994 | 22.4% | -0.11% | 0.69 | -99.6% | -98.90% |
| Force Index | 15m | 4.507.568 | 23.1% | -0.10% | 0.80 | -94.1% | -79.48% |
| Force Index | 1h | 1.107.292 | 24.7% | -0.05% | 0.95 | -74.1% | +2178.18% |
| Force Index | 4h | 268.154 | 26.2% | +0.28% | 1.15 | -53.3% | +1222.16% |
| Force Index | 1d | 40.368 | 27.5% | +2.18% | 1.49 | -35.5% | +681.04% |
| Force Index | 1w | 3.902 | 28.6% | +9.01% | 1.85 | -17.7% | +69.46% |
| Fractals | 5m | 4.958.544 | 29.0% | -0.11% | 0.80 | -97.4% | -96.95% |
| Fractals | 15m | 1.707.581 | 30.3% | -0.10% | 0.89 | -84.9% | +203.01% |
| Fractals | 1h | 435.816 | 32.0% | +0.04% | 1.02 | -60.7% | +356.44% |
| Fractals | 4h | 107.744 | 33.2% | +0.71% | 1.21 | -35.1% | +605.63% |
| Fractals | 1d | 17.762 | 33.2% | +4.48% | 1.55 | -38.9% | +449.58% |
| Fractals | 1w | 1.767 | 39.4% | +43.19% | 3.68 | -21.6% | +150.21% |
| FVG | 5m | 22.467.920 | 36.8% | -0.10% | 0.59 | -100.0% | -99.18% |
| FVG | 15m | 7.244.841 | 39.6% | -0.10% | 0.75 | -98.7% | -98.25% |
| FVG | 1h | 1.742.469 | 40.3% | -0.09% | 0.89 | -77.3% | -45.97% |
| FVG | 4h | 444.258 | 41.1% | -0.03% | 0.98 | -37.4% | +4.42% |
| FVG | 1d | 68.947 | 39.7% | +0.18% | 1.05 | -38.5% | +16.37% |
| FVG | 1w | 6.733 | 44.5% | +3.80% | 1.47 | -26.8% | +63.46% |
| Guppy MMA | 5m | 2.228.913 | 26.0% | -0.08% | 0.89 | -84.8% | +28.91% |
| Guppy MMA | 15m | 723.058 | 27.7% | +0.02% | 1.01 | -61.3% | +678.68% |
| Guppy MMA | 1h | 177.441 | 29.1% | +0.55% | 1.22 | -32.6% | +606.88% |
| Guppy MMA | 4h | 43.138 | 30.4% | +2.61% | 1.52 | -39.0% | +385.90% |
| Guppy MMA | 1d | 6.277 | 34.5% | +20.47% | 2.86 | -39.7% | +264.32% |
| Guppy MMA | 1w | 779 | 40.2% | +117.28% | 5.85 | -28.8% | +156.60% |
| Hacim Barları | 5m | 7.690.152 | 36.7% | -0.10% | 0.70 | -98.8% | -98.36% |
| Hacim Barları | 15m | 2.374.203 | 39.5% | -0.10% | 0.82 | -90.4% | -90.27% |
| Hacim Barları | 1h | 558.269 | 41.5% | -0.04% | 0.96 | -48.8% | -26.62% |
| Hacim Barları | 4h | 130.452 | 44.8% | +0.22% | 1.11 | -29.7% | +59.03% |
| Hacim Barları | 1d | 20.034 | 42.3% | +1.05% | 1.21 | -17.6% | +75.48% |
| Hacim Barları | 1w | 2.017 | 40.8% | +2.76% | 1.25 | -5.4% | +9.53% |
| Hacim Profili | 5m | 1.565.432 | 27.5% | -0.08% | 0.90 | -80.5% | +41.79% |
| Hacim Profili | 15m | 500.993 | 29.2% | +0.04% | 1.03 | -51.5% | +2281.24% |
| Hacim Profili | 1h | 120.526 | 31.4% | +0.64% | 1.24 | -32.1% | +756.43% |
| Hacim Profili | 4h | 28.432 | 34.3% | +2.64% | 1.52 | -26.5% | +442.49% |
| Hacim Profili | 1d | 3.861 | 38.2% | +16.89% | 2.51 | -28.4% | +118.70% |
| Hacim Profili | 1w | 246 | 49.6% | +85.17% | 5.14 | -27.5% | +100.82% |
| Hacim ROC | 5m | 41.433.619 | 34.9% | -0.10% | 0.56 | -100.0% | -99.15% |
| Hacim ROC | 15m | 12.875.547 | 40.9% | -0.09% | 0.73 | -99.4% | -98.72% |
| Hacim ROC | 1h | 2.956.132 | 45.7% | -0.06% | 0.91 | -83.2% | -82.72% |
| Hacim ROC | 4h | 724.699 | 47.3% | +0.02% | 1.02 | -72.9% | +12.05% |
| Hacim ROC | 1d | 99.966 | 47.7% | +0.79% | 1.25 | -39.2% | +553.45% |
| Hacim ROC | 1w | 9.444 | 46.0% | +2.81% | 1.36 | -32.6% | +306.55% |
| Harmonik Formasyonlar | 5m | 2.986.591 | 28.5% | -0.10% | 0.76 | -93.2% | -92.62% |
| Harmonik Formasyonlar | 15m | 998.175 | 28.2% | -0.11% | 0.83 | -76.9% | -76.14% |
| Harmonik Formasyonlar | 1h | 248.149 | 27.2% | -0.15% | 0.88 | -48.0% | -43.90% |
| Harmonik Formasyonlar | 4h | 64.653 | 26.9% | -0.18% | 0.93 | -28.5% | -19.43% |
| Harmonik Formasyonlar | 1d | 10.071 | 26.6% | -0.32% | 0.94 | -31.6% | -5.88% |
| Harmonik Formasyonlar | 1w | 765 | 16.7% | -9.81% | 0.45 | -34.6% | -26.72% |
| Hull MA | 5m | 3.855.465 | 31.1% | -0.09% | 0.86 | -92.8% | -71.24% |
| Hull MA | 15m | 1.296.682 | 32.4% | -0.05% | 0.95 | -72.9% | +183.49% |
| Hull MA | 1h | 320.853 | 33.9% | +0.15% | 1.08 | -84.7% | +3112.17% |
| Hull MA | 4h | 75.851 | 35.4% | +1.28% | 1.34 | -34.5% | +568.06% |
| Hull MA | 1d | 11.722 | 38.4% | +8.67% | 2.04 | -29.6% | +617.61% |
| Hull MA | 1w | 1.238 | 37.6% | +25.98% | 2.30 | -25.0% | +62.24% |
| Ichimoku | 5m | 2.273.128 | 15.4% | -1.06% | 0.25 | -99.9% | -99.44% |
| Ichimoku | 15m | 754.559 | 16.2% | -1.76% | 0.27 | -99.6% | -98.87% |
| Ichimoku | 1h | 186.009 | 16.6% | -3.28% | 0.30 | -98.9% | -98.67% |
| Ichimoku | 4h | 46.882 | 17.5% | -5.56% | 0.38 | -93.1% | -87.33% |
| Ichimoku | 1d | 7.150 | 19.8% | -8.34% | 0.57 | -66.1% | -58.08% |
| Ichimoku | 1w | 767 | 31.9% | +47.49% | 2.57 | -43.0% | +37.46% |
| İkili Dip / Tepe | 5m | 5.622.330 | 31.1% | -0.10% | 0.77 | -98.0% | -97.52% |
| İkili Dip / Tepe | 15m | 1.871.253 | 32.6% | -0.10% | 0.86 | -83.7% | -83.32% |
| İkili Dip / Tepe | 1h | 436.794 | 34.3% | 0.00% | 1.00 | -49.5% | +121.54% |
| İkili Dip / Tepe | 4h | 92.028 | 35.7% | +0.40% | 1.16 | -27.2% | +81.70% |
| İkili Dip / Tepe | 1d | 8.453 | 37.9% | +1.95% | 1.34 | -11.3% | +40.72% |
| İkili Dip / Tepe | 1w | 145 | 39.3% | +29.59% | 2.85 | -12.0% | +30.22% |
| Keltner | 5m | 3.884.005 | 27.3% | -0.11% | 0.78 | -96.8% | -96.38% |
| Keltner | 15m | 1.205.333 | 29.5% | -0.10% | 0.89 | -80.1% | +233.84% |
| Keltner | 1h | 287.010 | 31.4% | +0.04% | 1.02 | -47.0% | +302.86% |
| Keltner | 4h | 68.963 | 33.5% | +0.80% | 1.25 | -25.1% | +250.85% |
| Keltner | 1d | 10.364 | 33.3% | +4.15% | 1.53 | -31.2% | +269.99% |
| Keltner | 1w | 758 | 26.4% | +12.53% | 1.64 | -26.8% | +30.09% |
| Kırılım & Tuzak | 5m | 3.327.028 | 30.8% | -0.10% | 0.79 | -94.7% | -94.33% |
| Kırılım & Tuzak | 15m | 1.089.809 | 32.7% | -0.09% | 0.89 | -77.4% | -49.28% |
| Kırılım & Tuzak | 1h | 264.885 | 34.6% | +0.03% | 1.02 | -50.7% | +99.33% |
| Kırılım & Tuzak | 4h | 65.482 | 36.2% | +0.53% | 1.18 | -32.6% | +79.82% |
| Kırılım & Tuzak | 1d | 10.151 | 36.5% | +2.55% | 1.36 | -25.4% | +140.41% |
| Kırılım & Tuzak | 1w | 941 | 38.7% | +44.93% | 3.83 | -17.9% | +102.87% |
| KST | 5m | 6.489.548 | 33.6% | -0.10% | 0.81 | -98.3% | -97.92% |
| KST | 15m | 2.132.899 | 35.8% | -0.07% | 0.92 | -85.3% | -63.72% |
| KST | 1h | 529.491 | 38.0% | +0.05% | 1.03 | -67.0% | +89.70% |
| KST | 4h | 131.163 | 38.4% | +0.59% | 1.18 | -41.0% | +162.17% |
| KST | 1d | 21.108 | 39.3% | +3.36% | 1.44 | -44.4% | +209.99% |
| KST | 1w | 1.885 | 46.3% | +24.84% | 2.78 | -21.1% | +129.16% |
| KVO | 5m | 12.857.155 | 30.7% | -0.10% | 0.74 | -99.5% | -98.78% |
| KVO | 15m | 4.313.668 | 32.6% | -0.10% | 0.84 | -95.6% | -95.11% |
| KVO | 1h | 1.067.050 | 35.2% | -0.03% | 0.97 | -73.1% | +19.05% |
| KVO | 4h | 251.234 | 37.2% | +0.31% | 1.14 | -56.5% | +274.62% |
| KVO | 1d | 34.720 | 38.8% | +1.85% | 1.34 | -42.7% | +217.52% |
| KVO | 1w | 2.380 | 43.4% | +13.94% | 2.16 | -10.5% | +124.26% |
| Likidite & Stop Avı | 5m | 6.963.674 | 34.2% | -0.09% | 0.79 | -97.8% | -97.10% |
| Likidite & Stop Avı | 15m | 2.513.845 | 35.8% | -0.09% | 0.87 | -88.4% | -87.69% |
| Likidite & Stop Avı | 1h | 656.570 | 36.7% | -0.06% | 0.95 | -60.0% | -38.88% |
| Likidite & Stop Avı | 4h | 162.226 | 37.8% | +0.13% | 1.05 | -36.8% | +57.66% |
| Likidite & Stop Avı | 1d | 24.698 | 38.4% | +1.37% | 1.23 | -32.6% | +44.46% |
| Likidite & Stop Avı | 1w | 1.984 | 38.9% | +11.30% | 1.75 | -19.9% | +108.75% |
| LinReg Kanalı | 5m | 14.293.080 | 21.7% | -0.10% | 0.70 | -99.7% | -99.20% |
| LinReg Kanalı | 15m | 4.695.927 | 23.0% | -0.10% | 0.81 | -95.0% | -94.68% |
| LinReg Kanalı | 1h | 1.127.956 | 25.0% | -0.06% | 0.94 | -72.0% | -25.47% |
| LinReg Kanalı | 4h | 272.491 | 26.2% | +0.19% | 1.10 | -83.6% | +626.48% |
| LinReg Kanalı | 1d | 40.616 | 28.2% | +1.88% | 1.39 | -54.9% | +195.64% |
| LinReg Kanalı | 1w | 2.655 | 34.6% | +8.26% | 1.70 | -39.1% | +40.35% |
| MA Şeridi | 5m | 984.570 | 28.2% | -0.01% | 0.99 | -68.0% | +446.32% |
| MA Şeridi | 15m | 324.459 | 29.0% | +0.23% | 1.12 | -62.5% | +521.93% |
| MA Şeridi | 1h | 79.550 | 30.0% | +1.32% | 1.35 | -34.6% | +1415.27% |
| MA Şeridi | 4h | 18.312 | 32.4% | +7.30% | 2.00 | -44.4% | +698.76% |
| MA Şeridi | 1d | 2.591 | 40.9% | +66.81% | 5.63 | -27.7% | +290.43% |
| MA Şeridi | 1w | 373 | 57.9% | +159.94% | 9.49 | -22.2% | +175.87% |
| MACD | 5m | 9.394.771 | 28.8% | -0.10% | 0.77 | -99.1% | -98.58% |
| MACD | 15m | 3.095.140 | 30.2% | -0.10% | 0.86 | -90.5% | -88.17% |
| MACD | 1h | 753.769 | 32.8% | 0.00% | 1.00 | -68.3% | +62.36% |
| MACD | 4h | 183.167 | 34.0% | +0.47% | 1.18 | -61.7% | +508.34% |
| MACD | 1d | 27.945 | 34.6% | +2.17% | 1.32 | -60.7% | +161.63% |
| MACD | 1w | 2.074 | 43.9% | +18.97% | 2.43 | -26.9% | +144.86% |
| Market Profile | 5m | 1.324.531 | 30.4% | -0.04% | 0.95 | -77.1% | -10.34% |
| Market Profile | 15m | 427.388 | 31.9% | +0.08% | 1.05 | -41.8% | +1369.52% |
| Market Profile | 1h | 104.495 | 32.7% | +0.72% | 1.23 | -40.5% | +163.24% |
| Market Profile | 4h | 24.705 | 34.2% | +2.98% | 1.50 | -24.4% | +645.72% |
| Market Profile | 1d | 3.713 | 35.8% | +17.60% | 2.30 | -24.8% | +219.46% |
| Market Profile | 1w | 312 | 36.2% | +151.06% | 6.51 | -9.0% | +236.26% |
| Mass Index | 5m | 706.566 | 27.0% | -0.10% | 0.80 | -64.7% | -64.25% |
| Mass Index | 15m | 263.661 | 29.4% | -0.01% | 0.98 | -34.8% | +2.91% |
| Mass Index | 1h | 59.611 | 29.2% | -0.06% | 0.96 | -25.4% | +3.14% |
| Mass Index | 4h | 16.746 | 30.4% | +0.15% | 1.05 | -27.4% | +10.80% |
| Mass Index | 1d | 3.202 | 32.2% | +3.13% | 1.50 | -11.0% | +19.01% |
| Mass Index | 1w | 551 | 38.8% | +16.43% | 2.37 | -9.7% | +23.62% |
| McGinley | 5m | 15.687.075 | 19.3% | -0.10% | 0.66 | -99.9% | -91.19% |
| McGinley | 15m | 5.604.799 | 20.4% | -0.09% | 0.79 | -96.6% | +2865.82% |
| McGinley | 1h | 1.470.982 | 22.4% | -0.07% | 0.91 | -75.9% | -13.41% |
| McGinley | 4h | 354.492 | 23.7% | +0.06% | 1.04 | -35.0% | +66.89% |
| McGinley | 1d | 55.182 | 24.5% | +0.38% | 1.11 | -55.3% | +23.98% |
| McGinley | 1w | 5.217 | 23.6% | +2.11% | 1.23 | -31.9% | +5.60% |
| MFI | 5m | 1.361.693 | 58.3% | -0.05% | 0.95 | -57.3% | +259.67% |
| MFI | 15m | 411.354 | 59.4% | +0.06% | 1.04 | -44.8% | +411.17% |
| MFI | 1h | 100.400 | 60.1% | +0.55% | 1.16 | -41.1% | +285.43% |
| MFI | 4h | 25.736 | 60.2% | +3.01% | 1.49 | -25.9% | +409.19% |
| MFI | 1d | 4.389 | 61.2% | +20.87% | 3.01 | -7.7% | +454.73% |
| MFI | 1w | 754 | 60.1% | +86.57% | 6.67 | -2.8% | +318.01% |
| Momentum | 5m | 16.603.676 | 24.4% | -0.10% | 0.67 | -99.9% | -99.09% |
| Momentum | 15m | 5.758.475 | 26.8% | -0.10% | 0.79 | -96.2% | -95.78% |
| Momentum | 1h | 1.428.846 | 29.7% | -0.06% | 0.94 | -78.5% | +324.31% |
| Momentum | 4h | 352.647 | 32.5% | +0.24% | 1.15 | -39.6% | +447.89% |
| Momentum | 1d | 55.912 | 32.9% | +1.26% | 1.31 | -40.1% | +519.84% |
| Momentum | 1w | 4.777 | 36.6% | +13.09% | 2.43 | -32.6% | +163.83% |
| NATR | 5m | 10.576.993 | 15.5% | -0.10% | 0.69 | -99.3% | -98.83% |
| NATR | 15m | 3.467.127 | 16.3% | -0.10% | 0.81 | -90.3% | -18.92% |
| NATR | 1h | 829.155 | 17.8% | 0.00% | 1.00 | -65.1% | +801.38% |
| NATR | 4h | 191.333 | 19.4% | +0.53% | 1.28 | -62.5% | +744.08% |
| NATR | 1d | 27.381 | 20.7% | +4.19% | 1.90 | -46.8% | +257.21% |
| NATR | 1w | 1.693 | 24.6% | +49.74% | 5.49 | -38.3% | +221.35% |
| NVI | 5m | 3.528.709 | 31.4% | -0.08% | 0.85 | -89.1% | -79.95% |
| NVI | 15m | 1.128.756 | 33.7% | -0.02% | 0.98 | -58.9% | +175.82% |
| NVI | 1h | 264.090 | 35.8% | +0.29% | 1.17 | -43.2% | +1462.05% |
| NVI | 4h | 56.215 | 37.3% | +1.96% | 1.60 | -26.7% | +1570.22% |
| NVI | 1d | 5.224 | 38.1% | +16.74% | 3.52 | -12.8% | +409.65% |
| NVI | 1w | 165 | 45.5% | +91.13% | 10.60 | -15.0% | +294.90% |
| OBV | 5m | 14.228.590 | 21.8% | -0.10% | 0.68 | -99.8% | -99.03% |
| OBV | 15m | 5.121.311 | 22.7% | -0.10% | 0.80 | -95.7% | -95.02% |
| OBV | 1h | 1.320.796 | 24.0% | -0.04% | 0.96 | -74.3% | +362.61% |
| OBV | 4h | 328.015 | 25.3% | +0.19% | 1.12 | -38.6% | +2152.84% |
| OBV | 1d | 50.116 | 25.2% | +1.09% | 1.27 | -37.6% | +326.67% |
| OBV | 1w | 4.572 | 26.0% | +7.37% | 1.74 | -15.9% | +47.05% |
| Omuz-Baş-Omuz | 5m | 3.075.335 | 31.1% | -0.10% | 0.78 | -94.7% | -94.24% |
| Omuz-Baş-Omuz | 15m | 1.050.031 | 32.9% | -0.09% | 0.88 | -69.8% | -66.90% |
| Omuz-Baş-Omuz | 1h | 265.338 | 34.7% | +0.03% | 1.02 | -40.4% | +26.08% |
| Omuz-Baş-Omuz | 4h | 65.726 | 36.4% | +0.55% | 1.21 | -25.1% | +106.87% |
| Omuz-Baş-Omuz | 1d | 9.573 | 38.5% | +3.23% | 1.53 | -13.8% | +132.09% |
| Omuz-Baş-Omuz | 1w | 600 | 44.7% | +48.07% | 4.79 | -8.0% | +109.06% |
| ORB | 5m | 1.144.274 | 28.0% | -0.05% | 0.96 | -78.7% | +4940.83% |
| ORB | 15m | 994.733 | 31.2% | -0.05% | 0.96 | -80.2% | +2761.16% |
| ORB | 1h | 677.271 | 39.7% | -0.02% | 0.98 | -69.8% | +835.48% |
| Order Block | 5m | 587.632 | 48.6% | -0.07% | 0.83 | -50.8% | -50.54% |
| Order Block | 15m | 176.433 | 53.2% | -0.09% | 0.88 | -21.9% | -21.89% |
| Order Block | 1h | 44.494 | 55.0% | -0.03% | 0.98 | -10.2% | -2.03% |
| Order Block | 4h | 11.125 | 55.7% | +0.31% | 1.10 | -7.9% | +5.95% |
| Order Block | 1d | 1.330 | 50.4% | +2.32% | 1.29 | -4.7% | +8.85% |
| Order Block | 1w | 96 | 39.6% | 0.00% | 1.00 | -15.8% | +0.64% |
| Parabolic SAR | 5m | 10.016.038 | 32.6% | -0.10% | 0.77 | -99.2% | -98.12% |
| Parabolic SAR | 15m | 3.367.377 | 34.4% | -0.09% | 0.88 | -90.7% | -85.13% |
| Parabolic SAR | 1h | 834.325 | 36.7% | +0.01% | 1.01 | -70.5% | +772.09% |
| Parabolic SAR | 4h | 202.192 | 38.8% | +0.52% | 1.20 | -39.8% | +2572.39% |
| Parabolic SAR | 1d | 30.201 | 40.4% | +3.16% | 1.51 | -30.3% | +855.96% |
| Parabolic SAR | 1w | 2.362 | 44.8% | +28.96% | 3.19 | -26.5% | +221.44% |
| Parkinson | 5m | 2.162.036 | 31.8% | -0.09% | 0.84 | -87.9% | -85.69% |
| Parkinson | 15m | 717.533 | 33.6% | -0.06% | 0.94 | -66.0% | +13.60% |
| Parkinson | 1h | 175.388 | 34.8% | +0.08% | 1.04 | -55.3% | +111.54% |
| Parkinson | 4h | 41.755 | 37.1% | +0.75% | 1.20 | -31.0% | +85.39% |
| Parkinson | 1d | 5.994 | 36.0% | +4.13% | 1.45 | -35.2% | +114.06% |
| Parkinson | 1w | 332 | 44.3% | +58.75% | 4.25 | -18.4% | +86.23% |
| Pivot Noktaları | 5m | 294.488 | 66.1% | +0.08% | 1.05 | -48.3% | +71.64% |
| Pivot Noktaları | 15m | 278.308 | 66.3% | +0.08% | 1.05 | -50.0% | +63.73% |
| Pivot Noktaları | 1h | 246.146 | 66.0% | +0.09% | 1.06 | -46.6% | +63.93% |
| Pivot Noktaları | 4h | 192.669 | 64.1% | +0.10% | 1.06 | -43.6% | +39.00% |
| PMO | 5m | 6.998.912 | 28.7% | -0.10% | 0.79 | -98.1% | -97.59% |
| PMO | 15m | 2.301.196 | 30.2% | -0.09% | 0.89 | -88.3% | -43.63% |
| PMO | 1h | 560.616 | 32.6% | +0.05% | 1.03 | -60.5% | +84.21% |
| PMO | 4h | 138.167 | 33.4% | +0.62% | 1.20 | -43.5% | +316.01% |
| PMO | 1d | 21.873 | 34.0% | +3.71% | 1.51 | -51.8% | +167.35% |
| PMO | 1w | 2.085 | 38.3% | +16.69% | 2.11 | -26.2% | +56.87% |
| PPO | 5m | 9.395.396 | 28.8% | -0.10% | 0.77 | -99.1% | -98.60% |
| PPO | 15m | 3.095.308 | 30.2% | -0.10% | 0.86 | -90.9% | -84.70% |
| PPO | 1h | 754.348 | 32.8% | 0.00% | 1.00 | -66.5% | +514.76% |
| PPO | 4h | 183.983 | 33.9% | +0.48% | 1.18 | -48.0% | +449.28% |
| PPO | 1d | 28.947 | 34.2% | +2.59% | 1.40 | -59.4% | +184.73% |
| PPO | 1w | 2.474 | 40.6% | +21.76% | 2.67 | -24.9% | +172.74% |
| PVI | 5m | 2.748.792 | 20.7% | -0.08% | 0.86 | -88.4% | -64.90% |
| PVI | 15m | 891.847 | 22.0% | -0.02% | 0.97 | -63.6% | +119.07% |
| PVI | 1h | 207.348 | 22.8% | +0.47% | 1.25 | -65.6% | +1351.90% |
| PVI | 4h | 49.010 | 24.2% | +2.24% | 1.60 | -26.4% | +524.16% |
| PVI | 1d | 8.380 | 26.6% | +10.65% | 2.21 | -33.1% | +1151.04% |
| PVI | 1w | 1.166 | 26.0% | +32.83% | 2.77 | -35.6% | +100.87% |
| PVT | 5m | 9.456.368 | 21.5% | -0.10% | 0.73 | -98.9% | -98.42% |
| PVT | 15m | 3.243.183 | 22.2% | -0.10% | 0.84 | -89.4% | -37.17% |
| PVT | 1h | 799.558 | 23.5% | -0.03% | 0.97 | -69.3% | +1610.68% |
| PVT | 4h | 191.098 | 24.9% | +0.37% | 1.17 | -41.7% | +345.27% |
| PVT | 1d | 28.351 | 25.7% | +2.13% | 1.42 | -34.6% | +245.22% |
| PVT | 1w | 2.772 | 25.5% | +3.85% | 1.31 | -24.6% | +10.70% |
| ROC | 5m | 17.417.652 | 24.6% | -0.10% | 0.67 | -99.9% | -99.17% |
| ROC | 15m | 6.056.135 | 26.9% | -0.10% | 0.79 | -98.1% | -97.41% |
| ROC | 1h | 1.507.760 | 29.9% | -0.06% | 0.94 | -79.1% | +106.25% |
| ROC | 4h | 369.558 | 32.3% | +0.22% | 1.13 | -42.4% | +406.14% |
| ROC | 1d | 59.233 | 33.2% | +1.21% | 1.31 | -48.6% | +479.28% |
| ROC | 1w | 5.309 | 34.4% | +9.74% | 2.03 | -33.9% | +97.84% |
| RSI | 5m | 388.806 | 60.5% | -0.09% | 0.93 | -68.6% | -37.23% |
| RSI | 15m | 129.909 | 60.5% | -0.09% | 0.96 | -60.8% | -24.26% |
| RSI | 1h | 34.076 | 57.5% | -0.20% | 0.95 | -48.4% | -13.91% |
| RSI | 4h | 8.785 | 53.7% | -0.53% | 0.94 | -41.5% | -5.09% |
| RSI | 1d | 1.591 | 44.7% | -1.02% | 0.94 | -17.3% | -4.75% |
| RSI | 1w | 228 | 29.8% | -8.38% | 0.67 | -17.7% | -8.64% |
| RVI | 5m | 18.886.258 | 20.9% | -0.10% | 0.65 | -99.9% | -99.37% |
| RVI | 15m | 6.687.403 | 22.2% | -0.10% | 0.77 | -97.0% | -96.70% |
| RVI | 1h | 1.687.420 | 23.8% | -0.05% | 0.94 | -73.9% | +338.62% |
| RVI | 4h | 411.113 | 25.0% | +0.18% | 1.12 | -45.9% | +17857.73% |
| RVI | 1d | 62.089 | 25.3% | +1.69% | 1.46 | -35.1% | +313.02% |
| RVI | 1w | 4.078 | 27.4% | +30.58% | 4.50 | -13.6% | +351.43% |
| RVI | 5m | 36.134.263 | 29.3% | -0.10% | 0.60 | -100.0% | -99.30% |
| RVI | 15m | 12.131.117 | 33.2% | -0.10% | 0.74 | -99.5% | -98.92% |
| RVI | 1h | 3.011.475 | 36.4% | -0.09% | 0.88 | -92.6% | -86.28% |
| RVI | 4h | 744.395 | 38.7% | 0.00% | 1.00 | -79.3% | +81.79% |
| RVI | 1d | 116.797 | 40.4% | +0.62% | 1.20 | -38.4% | +195.51% |
| RVI | 1w | 11.409 | 42.0% | +3.61% | 1.46 | -45.5% | +174.05% |
| RVOL | 5m | 8.378.618 | 38.4% | -0.11% | 0.73 | -98.9% | -98.35% |
| RVOL | 15m | 2.610.784 | 40.8% | -0.10% | 0.85 | -92.6% | -92.47% |
| RVOL | 1h | 616.573 | 43.2% | -0.05% | 0.96 | -71.0% | +248.91% |
| RVOL | 4h | 149.853 | 45.2% | +0.30% | 1.12 | -24.2% | +119.41% |
| RVOL | 1d | 20.770 | 44.2% | +1.13% | 1.18 | -29.0% | +73.07% |
| RVOL | 1w | 2.110 | 41.6% | +4.30% | 1.30 | -8.3% | +25.50% |
| Sıkışma Formasyonları | 5m | 2.638.039 | 30.9% | -0.10% | 0.78 | -93.5% | -93.11% |
| Sıkışma Formasyonları | 15m | 880.843 | 32.5% | -0.09% | 0.88 | -72.2% | -66.89% |
| Sıkışma Formasyonları | 1h | 220.322 | 34.6% | +0.01% | 1.00 | -48.5% | +33.31% |
| Sıkışma Formasyonları | 4h | 54.709 | 35.5% | +0.39% | 1.14 | -33.4% | +55.52% |
| Sıkışma Formasyonları | 1d | 9.009 | 35.9% | +1.67% | 1.25 | -22.3% | +30.81% |
| Sıkışma Formasyonları | 1w | 855 | 42.0% | +49.88% | 4.37 | -10.9% | +106.11% |
| SMA | 5m | 4.654.110 | 29.8% | -0.10% | 0.83 | -94.3% | -86.17% |
| SMA | 15m | 1.532.897 | 32.0% | -0.05% | 0.95 | -82.5% | +502.96% |
| SMA | 1h | 376.826 | 33.5% | +0.19% | 1.10 | -51.5% | +1269.14% |
| SMA | 4h | 92.936 | 34.9% | +0.99% | 1.28 | -52.3% | +3351.91% |
| SMA | 1d | 13.710 | 36.3% | +7.44% | 1.93 | -53.4% | +960.50% |
| SMA | 1w | 1.223 | 38.3% | +48.38% | 3.46 | -36.5% | +85.13% |
| SMI | 5m | 4.320.302 | 45.8% | -0.08% | 0.85 | -91.9% | -89.37% |
| SMI | 15m | 1.389.781 | 49.4% | -0.04% | 0.96 | -52.9% | +13.95% |
| SMI | 1h | 334.643 | 52.1% | +0.09% | 1.05 | -53.3% | +107.41% |
| SMI | 4h | 84.125 | 54.0% | +1.11% | 1.33 | -28.3% | +602.13% |
| SMI | 1d | 11.845 | 52.2% | +4.75% | 1.59 | -45.9% | +223.24% |
| SMI | 1w | 1.035 | 56.3% | +44.60% | 3.52 | -4.4% | +210.25% |
| Std Sapma | 5m | 3.902.041 | 21.9% | -0.10% | 0.71 | -95.9% | -95.63% |
| Std Sapma | 15m | 1.277.774 | 22.6% | -0.09% | 0.83 | -76.6% | -76.31% |
| Std Sapma | 1h | 292.636 | 24.0% | -0.03% | 0.97 | -39.6% | -4.74% |
| Std Sapma | 4h | 68.621 | 25.2% | +0.45% | 1.22 | -17.4% | +77.94% |
| Std Sapma | 1d | 10.835 | 26.4% | +2.31% | 1.47 | -13.7% | +53.23% |
| Std Sapma | 1w | 576 | 31.6% | +13.02% | 2.22 | -11.9% | +41.15% |
| Stochastic | 5m | 3.425.003 | 59.4% | -0.06% | 0.91 | -88.6% | -20.02% |
| Stochastic | 15m | 1.081.372 | 60.6% | -0.02% | 0.98 | -48.6% | +106.39% |
| Stochastic | 1h | 259.496 | 60.5% | +0.05% | 1.02 | -66.5% | +99.19% |
| Stochastic | 4h | 65.666 | 62.6% | +0.96% | 1.24 | -53.9% | +289.76% |
| Stochastic | 1d | 8.768 | 60.5% | +3.81% | 1.39 | -34.4% | +110.92% |
| Stochastic | 1w | 853 | 50.2% | +16.65% | 1.71 | -35.5% | +75.11% |
| StochRSI | 5m | 524.162 | 47.7% | +0.30% | 1.31 | -55.5% | +593.11% |
| StochRSI | 15m | 155.298 | 50.4% | +1.16% | 1.68 | -43.4% | +881.28% |
| StochRSI | 1h | 34.548 | 51.6% | +6.54% | 3.16 | -37.6% | +1045.53% |
| StochRSI | 4h | 11.594 | 56.5% | +21.60% | 5.61 | -31.6% | +1224.87% |
| StochRSI | 1d | 2.004 | 67.6% | +139.20% | 22.54 | -7.3% | +1081.23% |
| StochRSI | 1w | 612 | 70.6% | +208.83% | 26.18 | -7.8% | +380.33% |
| Supertrend | 5m | 2.975.397 | 31.5% | -0.09% | 0.88 | -90.5% | -56.99% |
| Supertrend | 15m | 904.766 | 33.2% | -0.03% | 0.98 | -71.9% | +248.49% |
| Supertrend | 1h | 218.645 | 34.2% | +0.28% | 1.11 | -43.8% | +1330.45% |
| Supertrend | 4h | 52.714 | 36.1% | +1.89% | 1.39 | -28.3% | +1062.30% |
| Supertrend | 1d | 8.054 | 38.6% | +14.13% | 2.29 | -43.0% | +970.33% |
| Supertrend | 1w | 784 | 39.5% | +94.13% | 5.04 | -34.3% | +180.17% |
| Tarihsel Vol. | 5m | 4.407.699 | 18.8% | -0.09% | 0.79 | -94.1% | -54.97% |
| Tarihsel Vol. | 15m | 1.445.160 | 19.4% | -0.05% | 0.92 | -75.6% | -48.17% |
| Tarihsel Vol. | 1h | 353.805 | 21.0% | +0.20% | 1.15 | -38.4% | +159.22% |
| Tarihsel Vol. | 4h | 80.520 | 21.6% | +1.09% | 1.42 | -66.8% | +1363.81% |
| Tarihsel Vol. | 1d | 10.883 | 24.5% | +9.26% | 2.58 | -25.3% | +387.64% |
| Tarihsel Vol. | 1w | 641 | 29.3% | +93.15% | 8.17 | -14.9% | +317.14% |
| Tek Mum Formasyonları | 5m | 3.960.793 | 42.7% | -0.09% | 0.71 | -95.0% | -94.23% |
| Tek Mum Formasyonları | 15m | 1.301.218 | 46.9% | -0.07% | 0.85 | -71.7% | -70.77% |
| Tek Mum Formasyonları | 1h | 336.512 | 49.3% | -0.05% | 0.95 | -36.5% | -23.24% |
| Tek Mum Formasyonları | 4h | 83.801 | 51.4% | +0.19% | 1.10 | -22.9% | +27.96% |
| Tek Mum Formasyonları | 1d | 12.786 | 50.4% | +1.19% | 1.27 | -13.1% | +30.75% |
| Tek Mum Formasyonları | 1w | 1.048 | 43.7% | +3.59% | 1.33 | -13.0% | +21.23% |
| Trend Çizgileri | 5m | 7.960.737 | 32.4% | -0.10% | 0.75 | -98.7% | -98.26% |
| Trend Çizgileri | 15m | 2.799.476 | 34.0% | -0.10% | 0.84 | -90.6% | -89.75% |
| Trend Çizgileri | 1h | 736.143 | 36.2% | -0.05% | 0.96 | -61.9% | -43.69% |
| Trend Çizgileri | 4h | 186.675 | 38.1% | +0.21% | 1.09 | -30.6% | +88.08% |
| Trend Çizgileri | 1d | 30.842 | 39.3% | +1.01% | 1.19 | -30.9% | +57.88% |
| Trend Çizgileri | 1w | 2.932 | 42.4% | +13.22% | 2.05 | -20.0% | +103.50% |
| TRIX | 5m | 6.169.580 | 33.8% | -0.10% | 0.81 | -98.0% | -97.57% |
| TRIX | 15m | 2.030.553 | 35.9% | -0.07% | 0.92 | -85.3% | -38.15% |
| TRIX | 1h | 504.306 | 38.1% | +0.06% | 1.04 | -62.8% | +116.87% |
| TRIX | 4h | 123.969 | 38.6% | +0.69% | 1.21 | -46.1% | +226.58% |
| TRIX | 1d | 19.760 | 38.3% | +4.32% | 1.53 | -47.9% | +179.24% |
| TRIX | 1w | 1.717 | 45.3% | +19.41% | 2.25 | -29.9% | +115.92% |
| True Range | 5m | 8.226.179 | 37.9% | -0.10% | 0.71 | -99.1% | -98.54% |
| True Range | 15m | 2.590.484 | 40.9% | -0.10% | 0.82 | -92.7% | -92.20% |
| True Range | 1h | 679.384 | 43.1% | -0.09% | 0.92 | -68.5% | -26.34% |
| True Range | 4h | 175.203 | 46.6% | +0.16% | 1.08 | -44.3% | +82.91% |
| True Range | 1d | 24.385 | 47.3% | +1.36% | 1.29 | -19.6% | +76.55% |
| True Range | 1w | 1.776 | 48.4% | +7.53% | 1.78 | -10.0% | +39.52% |
| TSI | 5m | 11.318.262 | 29.1% | -0.10% | 0.75 | -99.5% | -97.69% |
| TSI | 15m | 3.765.024 | 30.4% | -0.10% | 0.85 | -94.7% | -91.25% |
| TSI | 1h | 917.501 | 32.8% | -0.01% | 0.99 | -72.9% | +179.23% |
| TSI | 4h | 224.817 | 34.1% | +0.44% | 1.19 | -38.1% | +375.74% |
| TSI | 1d | 35.265 | 34.7% | +2.92% | 1.50 | -49.8% | +454.37% |
| TSI | 1w | 3.140 | 39.1% | +20.09% | 2.61 | -37.7% | +184.40% |
| TTM Squeeze | 5m | 2.548.424 | 31.2% | -0.12% | 0.79 | -91.6% | -83.11% |
| TTM Squeeze | 15m | 896.640 | 34.0% | -0.09% | 0.90 | -75.0% | +4.24% |
| TTM Squeeze | 1h | 224.592 | 36.1% | +0.12% | 1.07 | -41.8% | +520.72% |
| TTM Squeeze | 4h | 56.657 | 37.4% | +0.61% | 1.18 | -49.1% | +379.21% |
| TTM Squeeze | 1d | 8.880 | 37.8% | +3.67% | 1.47 | -31.0% | +105.80% |
| TTM Squeeze | 1w | 759 | 47.6% | +26.71% | 2.54 | -20.7% | +51.67% |
| Twiggs MF | 5m | 9.703.315 | 24.9% | -0.10% | 0.73 | -99.3% | -98.65% |
| Twiggs MF | 15m | 3.446.992 | 26.7% | -0.09% | 0.84 | -91.8% | -62.62% |
| Twiggs MF | 1h | 851.154 | 28.5% | +0.01% | 1.01 | -81.3% | +329.20% |
| Twiggs MF | 4h | 204.949 | 30.9% | +0.50% | 1.24 | -36.1% | +458.03% |
| Twiggs MF | 1d | 28.903 | 31.2% | +3.05% | 1.61 | -52.8% | +184.58% |
| Twiggs MF | 1w | 2.104 | 33.2% | +28.40% | 3.34 | -29.8% | +168.69% |
| Ulcer Index | 5m | 5.077.951 | 17.6% | -0.09% | 0.77 | -95.9% | -93.54% |
| Ulcer Index | 15m | 1.685.306 | 18.4% | -0.06% | 0.91 | -81.4% | -2.20% |
| Ulcer Index | 1h | 411.821 | 19.8% | +0.10% | 1.08 | -51.9% | +2815.52% |
| Ulcer Index | 4h | 97.005 | 21.2% | +0.95% | 1.40 | -23.7% | +1734.35% |
| Ulcer Index | 1d | 14.471 | 22.1% | +6.54% | 2.15 | -28.6% | +592.18% |
| Ulcer Index | 1w | 932 | 28.6% | +92.77% | 9.18 | -22.5% | +294.12% |
| Ultimate Osc. | 5m | 713.443 | 56.1% | +0.09% | 1.08 | -34.7% | +529.24% |
| Ultimate Osc. | 15m | 169.736 | 55.9% | +0.47% | 1.19 | -36.6% | +423.65% |
| Ultimate Osc. | 1h | 34.212 | 57.4% | +2.72% | 1.53 | -39.9% | +649.58% |
| Ultimate Osc. | 4h | 7.479 | 55.2% | +9.47% | 1.92 | -25.3% | +414.89% |
| Ultimate Osc. | 1d | 1.150 | 58.6% | +110.18% | 7.30 | -10.0% | +1442.59% |
| Ultimate Osc. | 1w | 407 | 44.7% | +100.53% | 5.75 | -2.1% | +140.11% |
| Üç Mum Formasyonları | 5m | 15.026.326 | 35.7% | -0.10% | 0.70 | -99.8% | -99.07% |
| Üç Mum Formasyonları | 15m | 5.317.059 | 37.3% | -0.11% | 0.80 | -98.4% | -98.00% |
| Üç Mum Formasyonları | 1h | 1.374.192 | 39.2% | -0.08% | 0.93 | -77.6% | -53.04% |
| Üç Mum Formasyonları | 4h | 350.141 | 40.3% | +0.06% | 1.03 | -47.5% | +127.63% |
| Üç Mum Formasyonları | 1d | 57.064 | 39.9% | +0.76% | 1.17 | -46.5% | +441.29% |
| Üç Mum Formasyonları | 1w | 5.226 | 46.0% | +9.78% | 2.05 | -12.7% | +252.41% |
| VIX / Korku | 5m | 8.767.800 | 18.6% | -0.10% | 0.69 | -99.1% | -98.68% |
| VIX / Korku | 15m | 2.882.209 | 19.4% | -0.10% | 0.80 | -89.7% | -89.63% |
| VIX / Korku | 1h | 694.631 | 20.8% | 0.00% | 1.00 | -48.1% | +37.69% |
| VIX / Korku | 4h | 153.981 | 22.4% | +0.48% | 1.26 | -59.9% | +272.23% |
| VIX / Korku | 1d | 18.725 | 23.4% | +2.36% | 1.54 | -38.2% | +114.38% |
| VIX / Korku | 1w | 187 | 33.2% | +9.29% | 1.75 | -18.1% | +22.94% |
| Volatilite Oranı | 5m | 9.434.582 | 30.6% | -0.10% | 0.62 | -99.4% | -98.65% |
| Volatilite Oranı | 15m | 2.947.674 | 35.5% | -0.10% | 0.78 | -94.3% | -93.78% |
| Volatilite Oranı | 1h | 768.523 | 40.0% | -0.08% | 0.90 | -64.1% | -18.47% |
| Volatilite Oranı | 4h | 202.817 | 42.9% | +0.04% | 1.02 | -35.5% | +36.25% |
| Volatilite Oranı | 1d | 29.983 | 43.6% | +0.49% | 1.14 | -22.5% | +50.34% |
| Volatilite Oranı | 1w | 2.574 | 43.0% | +1.60% | 1.21 | -15.6% | +5.76% |
| Volume Osc. | 5m | 15.471.243 | 40.5% | -0.09% | 0.73 | -99.6% | -98.80% |
| Volume Osc. | 15m | 4.812.409 | 44.2% | -0.08% | 0.86 | -95.6% | -94.83% |
| Volume Osc. | 1h | 1.143.277 | 47.2% | -0.01% | 0.99 | -65.9% | +76.32% |
| Volume Osc. | 4h | 284.666 | 47.0% | +0.17% | 1.08 | -43.3% | +183.67% |
| Volume Osc. | 1d | 42.805 | 46.6% | +2.15% | 1.43 | -34.5% | +606.35% |
| Volume Osc. | 1w | 4.023 | 46.8% | +11.14% | 2.00 | -12.2% | +223.40% |
| Vortex | 5m | 11.912.035 | 26.0% | -0.10% | 0.71 | -99.6% | -99.21% |
| Vortex | 15m | 4.064.012 | 29.1% | -0.09% | 0.84 | -93.7% | -68.25% |
| Vortex | 1h | 1.003.661 | 32.3% | -0.02% | 0.98 | -67.2% | +85.81% |
| Vortex | 4h | 251.003 | 34.1% | +0.37% | 1.19 | -42.5% | +662.02% |
| Vortex | 1d | 38.325 | 35.9% | +2.41% | 1.51 | -43.5% | +553.62% |
| Vortex | 1w | 3.257 | 39.9% | +16.92% | 2.67 | -23.3% | +147.00% |
| VWAP | 5m | 3.243.555 | 19.9% | -0.06% | 0.89 | -87.4% | -37.85% |
| VWAP | 15m | 1.802.128 | 24.7% | -0.03% | 0.96 | -79.7% | +32.12% |
| VWAP | 1h | 691.252 | 32.3% | +0.13% | 1.10 | -62.1% | +393.35% |
| VWAP | 4h | 199.062 | 36.2% | +0.62% | 1.28 | -54.6% | +1571.03% |
| VWAP | 1d | 22.020 | 33.5% | +6.07% | 2.09 | -33.6% | +778.70% |
| VWAP | 1w | 2.728 | 38.3% | +32.10% | 4.18 | -9.4% | +257.41% |
| VWMA | 5m | 15.716.074 | 20.0% | -0.10% | 0.68 | -99.8% | -99.23% |
| VWMA | 15m | 5.227.853 | 21.0% | -0.10% | 0.80 | -98.0% | -95.16% |
| VWMA | 1h | 1.243.389 | 22.9% | -0.04% | 0.96 | -71.4% | +187.09% |
| VWMA | 4h | 300.685 | 24.4% | +0.27% | 1.15 | -40.0% | +549.91% |
| VWMA | 1d | 46.052 | 25.7% | +2.17% | 1.50 | -44.1% | +249.70% |
| VWMA | 1w | 3.671 | 30.8% | +20.96% | 3.18 | -21.3% | +221.77% |
| Williams %R | 5m | 5.981.214 | 54.8% | -0.08% | 0.83 | -94.4% | -89.90% |
| Williams %R | 15m | 1.941.329 | 57.9% | -0.06% | 0.92 | -77.4% | -13.34% |
| Williams %R | 1h | 463.670 | 59.5% | +0.04% | 1.03 | -64.0% | +150.26% |
| Williams %R | 4h | 111.837 | 61.3% | +0.62% | 1.21 | -46.3% | +647.16% |
| Williams %R | 1d | 16.658 | 60.9% | +4.04% | 1.59 | -27.8% | +388.05% |
| Williams %R | 1w | 1.518 | 56.6% | +25.48% | 2.71 | -28.8% | +163.72% |
| WMA | 5m | 5.804.492 | 28.0% | -0.10% | 0.81 | -95.4% | -94.76% |
| WMA | 15m | 1.913.397 | 29.7% | -0.07% | 0.92 | -83.0% | +76.93% |
| WMA | 1h | 468.470 | 31.6% | +0.13% | 1.08 | -43.3% | +565.19% |
| WMA | 4h | 114.840 | 32.8% | +0.82% | 1.26 | -53.5% | +1956.78% |
| WMA | 1d | 17.148 | 33.9% | +6.27% | 1.83 | -46.5% | +1035.24% |
| WMA | 1w | 1.363 | 42.3% | +57.01% | 4.83 | -23.4% | +178.74% |
| Wyckoff Şeması | 5m | 1.971.196 | 49.7% | -0.07% | 0.88 | -80.1% | -70.69% |
| Wyckoff Şeması | 15m | 666.603 | 50.4% | -0.07% | 0.93 | -51.3% | -28.24% |
| Wyckoff Şeması | 1h | 171.040 | 52.3% | +0.14% | 1.07 | -27.6% | +72.40% |
| Wyckoff Şeması | 4h | 44.495 | 51.7% | +0.61% | 1.16 | -27.6% | +56.19% |
| Wyckoff Şeması | 1d | 7.109 | 49.0% | +5.48% | 1.60 | -30.1% | +60.02% |
| Wyckoff Şeması | 1w | 795 | 51.6% | +21.81% | 2.50 | -7.5% | +63.69% |
| Zarflar | 5m | 212.519 | 62.9% | +0.03% | 1.04 | -19.4% | +14.73% |
| Zarflar | 15m | 225.735 | 63.4% | -0.03% | 0.96 | -49.4% | -15.57% |
| Zarflar | 1h | 153.144 | 64.0% | -0.07% | 0.95 | -43.3% | -19.18% |
| Zarflar | 4h | 62.118 | 63.7% | -0.21% | 0.90 | -42.7% | -23.65% |
| Zarflar | 1d | 12.063 | 55.8% | -0.48% | 0.91 | -34.8% | -14.79% |
| Zarflar | 1w | 1.072 | 40.8% | -3.10% | 0.80 | -32.2% | -15.31% |

## 10. İndikatör başına strateji kuralları

Her indikatörün raporda kullanılan **tek** mekanik stratejisi. "Test dışı" satırı, o indikatörün kavramsal olarak anlamsız olduğu için hiç koşulmadığı dilimleri gösterir.

### Trend

**SMA — SMA Kesişimi (10/30)**
- Yön: İki yön (long/short flip)
- SMA(10) SMA(30)’u yukarı keserse AL (long)
- Aşağı keserse SAT (short) — ters sinyalde pozisyon döner
- Stop: Yok (ters sinyal)

**EMA — EMA Kesişimi (12/26)**
- Yön: İki yön (long/short flip)
- EMA(12) EMA(26)’yı yukarı keserse AL
- Aşağı keserse SAT (short) — ters sinyalde döner
- Stop: Yok (ters sinyal)

**WMA — WMA Kesişimi (10/30)**
- Yön: İki yön (long/short flip)
- WMA(10) WMA(30)’u yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Hull MA — HMA(20) Fiyat Kesişimi**
- Yön: İki yön (long/short flip)
- Fiyat HMA(20)’yı yukarı keser ve HMA yükseliyorsa AL
- Aşağı keser ve HMA düşüyorsa SAT (short)
- Stop: Yok (ters sinyal)

**MA Şeridi — EMA Şeridi Hizalanması (13-89)**
- Yön: İki yön (long/short flip)
- EMA’lar yukarıdan aşağı hizalanınca (13>21>34>55>89) AL
- Aşağı hizalanınca SAT (short)
- Stop: Yok (hizalama bozulana kadar)

**Guppy MMA — GMMA Kısa/Uzun Grup Kesişimi**
- Yön: İki yön (long/short flip)
- Kısa EMA grubu uzun grubun tamamen üstüne çıkınca AL
- Tamamen altına inince SAT (short)
- Stop: Yok (grup kesişimi ters dönene kadar)

**Ichimoku — Ichimoku Bulut Kırılımı**
- Yön: İki yön (long/short flip)
- Fiyat bulutu yukarı keser ve Tenkan>Kijun ise AL
- Bulut aşağı kesilir ve Tenkan<Kijun ise SAT (short)
- Stop: Yok (ters sinyal / bulut)
- Not: Bulut değerleri kaydırılmadan (anlık) kullanılır — basitleştirilmiştir.

**Parabolic SAR — Parabolic SAR Dönüşü**
- Yön: İki yön (long/short flip)
- Fiyat SAR’ı yukarı kesince AL (dönüş)
- Aşağı kesince SAT (short)
- Stop: Yok (SAR ters tarafta iz sürer)

**ADX / DMI — ADX + DI Kesişimi (14)**
- Yön: İki yön (long/short flip)
- +DI, -DI’yi yukarı keser VE ADX>20 ise AL
- -DI üste geçer VE ADX>20 ise SAT (short)
- ADX eşiği trend gücü filtresidir
- Stop: Yok (ters sinyal)

**Supertrend — Supertrend Dönüşü (10, 3)**
- Yön: İki yön (long/short flip)
- Fiyat Supertrend çizgisini yukarı kesince AL
- Aşağı kesince SAT (short)
- Stop: Yok (Supertrend iz süren stop gibi davranır)

**Aroon — Aroon Eşik Kesişimi (25)**
- Yön: İki yön (long/short flip)
- Aroon Up 70’i yukarı kesince AL (taze zirve)
- Aroon Down 70’i yukarı kesince SAT (short)
- Stop: Yok (ters sinyal)

**LinReg Kanalı — LinReg Kanal Orta Çizgisi (50)**
- Yön: İki yön (long/short flip)
- Fiyat regresyon kanalının orta çizgisini yukarı kesince AL
- Aşağı kesince SAT (short)
- Stop: Yok (ters sinyal)

**Zarflar — Zarf Geri Dönüşü (20, %2,5)**
- Yön: Sadece long (sinyalsizken nakit)
- Fiyat alt zarfı yukarı kesince (ortalamadan sapma) AL
- Orta çizgiye dönünce SAT (kâr al)
- Stop: Yok

**TRIX — TRIX Sinyal Kesişimi (15)**
- Yön: İki yön (long/short flip)
- TRIX sinyal çizgisini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**McGinley — McGinley Dinamik Eğrisi (14)**
- Yön: İki yön (long/short flip)
- Fiyat McGinley’i yukarı keser ve eğri yükseliyorsa AL
- Aşağı keser ve eğri düşüyorsa SAT (short)
- Stop: Yok (ters sinyal)

**Alligator — Alligator Hizalanması**
- Yön: İki yön (long/short flip)
- Dudak>Diş>Çene sıralaması oluşunca (ağız açılınca) AL
- Ters sıralama oluşunca SAT (short)
- Uyuyan timsah = sıralama karışık, işlem yok
- Stop: Yok (hizalama ters dönene kadar)

**Fractals — Fractal Kırılımı (Bill Williams)**
- Yön: İki yön (long/short flip)
- Son yukarı fractal zirvesi kırılınca AL
- Son aşağı fractal dibi kırılınca SAT (short)
- Stop: karşı fractal seviyesi
- Stop: Teknik stop (kurallarda)

**Altın / Ölüm Kesişimi — Altın / Ölüm Kesişimi (50/200)**
- Yön: Sadece long (sinyalsizken nakit)
- SMA50 SMA200’ü yukarı keserse (altın kesişim) AL
- Aşağı keserse (ölüm kesişimi) pozisyonu KAPAT
- Stop: Yok (kesişim)
- Not: SMA200 ısınması uzundur; kısa geçmişli sembollerin payı düşüktür.

**Trend Çizgileri — Trend Çizgisi Kırılımı (yaklaşım)**
- Yön: İki yön (long/short flip)
- Düşen direnç çizgisi (son iki alçalan tepe) yukarı kırılırsa AL
- Yükselen destek çizgisi aşağı kırılırsa SAT (short)
- Stop: 2,5×ATR
- Stop: Teknik stop (kurallarda)
- Not: Çizgiler otomatik olarak son iki pivot tepe/dipten çizilir — elle çizime yaklaşımdır.

**Vortex — Vortex Kesişimi (14)**
- Yön: İki yön (long/short flip)
- VI+ VI-’yi yukarı keserse AL (yükseliş hareketi başlar)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

### Hız (Momentum)

**RSI — RSI Aşırılık Dönüşü (14)**
- Yön: Sadece long (sinyalsizken nakit)
- RSI 30’un altına inip geri yukarı kesince AL
- RSI 70’i aşağı kesince SAT (kâr al)
- Stop: Yok

**MACD — MACD Sinyal Kesişimi**
- Yön: İki yön (long/short flip)
- MACD sinyal çizgisini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Stochastic — Stokastik Kesişimi (14,3,3)**
- Yön: İki yön (long/short flip)
- %K, %D’yi aşırı satım bölgesinde (K<25) yukarı keserse AL
- %K, %D’yi aşırı alımda (K>75) aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**StochRSI — StochRSI Kesişimi (0,2/0,8)**
- Yön: İki yön (long/short flip)
- %K, %D’yi 0,25 altında yukarı keserse AL
- 0,75 üstünde aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**CCI — CCI Aşırılık Dönüşü (20)**
- Yön: İki yön (long/short flip)
- CCI -100’ü yukarı kesince AL
- CCI +100’ü aşağı kesince SAT (short)
- Stop: Yok (ters sinyal)

**ROC — ROC Sıfır Kesişimi (9)**
- Yön: İki yön (long/short flip)
- ROC sıfırı yukarı keserse AL (pozitif ivme)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Momentum — Momentum Sıfır Kesişimi (10)**
- Yön: İki yön (long/short flip)
- Momentum sıfırı yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Williams %R — Williams %R Dönüşü (14)**
- Yön: İki yön (long/short flip)
- %R -80’i yukarı kesince AL (aşırı satım çıkışı)
- %R -20’yi aşağı kesince SAT (short)
- Stop: Yok (ters sinyal)

**TSI — TSI Sinyal Kesişimi (25,13)**
- Yön: İki yön (long/short flip)
- TSI sinyalini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Ultimate Osc. — Ultimate Oscillator Dönüşü**
- Yön: İki yön (long/short flip)
- UO 30’u yukarı kesince AL
- UO 70’i aşağı kesince SAT (short)
- Stop: Yok (ters sinyal)

**Awesome Oscillator — Awesome Oscillator Sıfır Kesişimi**
- Yön: İki yön (long/short flip)
- AO sıfırı yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**PPO — PPO Sinyal Kesişimi**
- Yön: İki yön (long/short flip)
- PPO sinyalini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**DPO — DPO Sıfır Kesişimi (20)**
- Yön: İki yön (long/short flip)
- DPO sıfırı yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**KST — KST Sinyal Kesişimi**
- Yön: İki yön (long/short flip)
- KST sinyalini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**CMO — CMO Sıfır Kesişimi (14)**
- Yön: İki yön (long/short flip)
- CMO sıfırı yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Fisher Transform — Fisher Dönüşü (10)**
- Yön: İki yön (long/short flip)
- Fisher -2’yi yukarı kesince AL (aşırı satımdan dönüş)
- Fisher +2’yi aşağı kesince SAT (short)
- Stop: Yok (ters sinyal)

**SMI — SMI Aşırılık Dönüşü (14,3)**
- Yön: İki yön (long/short flip)
- SMI -40’ı yukarı kesince AL
- SMI +40’ı aşağı kesince SAT (short)
- Stop: Yok (ters sinyal)

**RVI — RVI Sinyal Kesişimi (10)**
- Yön: İki yön (long/short flip)
- RVI sinyal çizgisini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**PMO — PMO Sinyal Kesişimi**
- Yön: İki yön (long/short flip)
- PMO sinyalini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Coppock — Coppock Eğrisi Sıfır Kesişimi**
- Yön: Sadece long (sinyalsizken nakit)
- Coppock sıfırı yukarı keserse AL
- Sıfırı aşağı keserse SAT
- Stop: Yok (kesişim)

### Hacim

**OBV — OBV + EMA(21) Kesişimi**
- Yön: İki yön (long/short flip)
- OBV, kendi EMA(21)’ini yukarı keserse AL (birikim)
- Aşağı keserse SAT (short, dağıtım)
- Stop: Yok (ters sinyal)

**VWAP — VWAP Üstü/Altı + Hacim Filtresi**
- Yön: İki yön (long/short flip)
- Fiyat VWAP’ı yukarı keser VE hacim 20-bar ortalamasının üstündeyse AL
- VWAP altına inerse SAT (short)
- Gün içi TF’lerde günlük, üstlerinde 24 saatlik/kayan VWAP kullanılır
- Stop: Yok (ters sinyal)

**Anchored VWAP — Anchored VWAP Kesişimi**
- Yön: İki yön (long/short flip)
- Fiyat AVWAP’ı yukarı keserse AL
- Aşağı keserse SAT (short)
- Demir noktası: son onaylı pivot dipten başlatılır, daha düşük dip gelirse taşınır
- Stop: Yok (ters sinyal)

**Hacim Barları — Hacim Patlaması (2× ortalama)**
- Yön: İki yön (long/short flip)
- Hacim 20-bar ortalamasının 2 katını aşarsa
- Yeşil mum → AL; kırmızı mum → SAT (short)
- En fazla 5 bar tutulur (patlama işlemi)
- Stop: Yok (5 bar zaman stopu)

**Hacim Profili — Hacim Profili / Değer Alanı Kırılımı (yaklaşım)**
- Yön: İki yön (long/short flip)
- Fiyat değer alanı üst sınırını (VWAP+1,5σ) yukarı keserse AL
- Alt sınırı aşağı keserse SAT (short)
- Çıkış: POC (orta çizgi)
- Stop: Yok
- Not: Gerçek hacim profili yerine VWAP±σ değer alanı vekili kullanılır.

**MFI — MFI Aşırılık Dönüşü (14)**
- Yön: İki yön (long/short flip)
- MFI 20’yi yukarı kesince AL
- MFI 80’i aşağı kesince SAT (short)
- Stop: Yok (ters sinyal)

**CMF — Chaikin Para Akışı Sıfır Kesişimi (20)**
- Yön: İki yön (long/short flip)
- CMF sıfırı yukarı keserse AL (alım baskısı)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**A/D Çizgisi — A/D Çizgisi + EMA(21)**
- Yön: İki yön (long/short flip)
- A/D çizgisi kendi EMA(21)’ini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Chaikin Osc. — Chaikin Oscillator Sıfır Kesişimi**
- Yön: İki yön (long/short flip)
- Chaikin Osc sıfırı yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Force Index — Force Index EMA(13) Sıfır Kesişimi**
- Yön: İki yön (long/short flip)
- Force Index (EMA 13) sıfırı yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**EOM — Ease of Movement Sıfır Kesişimi (14)**
- Yön: İki yön (long/short flip)
- EOM sıfırı yukarı keserse AL (kolay yükseliş)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Volume Osc. — Hacim Osilatörü Sıfır Kesişimi (5,20)**
- Yön: İki yön (long/short flip)
- Kısa hacim ortalaması uzunu yukarı keserse AL (hacim artıyor)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**KVO — KVO Sinyal Kesişimi**
- Yön: İki yön (long/short flip)
- KVO sinyalini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**NVI — NVI + EMA(200) Trendi**
- Yön: İki yön (long/short flip)
- NVI kendi EMA(200)’ünü yukarı keserse AL (sessiz birikim)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**PVI — PVI + EMA(200) Trendi**
- Yön: İki yön (long/short flip)
- PVI kendi EMA(200)’ünü yukarı keserse AL (kalabalık katılımı)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**PVT — PVT + EMA(21) Kesişimi**
- Yön: İki yön (long/short flip)
- PVT kendi EMA(21)’ini yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**RVOL — RVOL Patlaması (1,5×)**
- Yön: İki yön (long/short flip)
- RVOL 1,5×’i yukarı kesince (hacim ortalamanın 1,5 katı)
- Mum yönü yukarıysa AL, aşağıysa SAT (short)
- En fazla 10 bar
- Stop: Yok (10 bar zaman stopu)

**VWMA — VWMA(20) Fiyat Kesişimi**
- Yön: İki yön (long/short flip)
- Fiyat VWMA(20)’yi yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Twiggs MF — Twiggs Money Flow Sıfır Kesişimi (21)**
- Yön: İki yön (long/short flip)
- Twiggs MF sıfırı yukarı keserse AL
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Hacim ROC — Hacim ROC Sıfır Kesişimi (25)**
- Yön: İki yön (long/short flip)
- Hacim ROC sıfırı yukarı keserse AL (hacim ivmeleniyor)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

### Volatilite

**ATR — EMA(50) Trendi + ATR Takip Stopu**
- Yön: İki yön (long/short flip)
- Fiyat EMA(50)’yi yukarı kesince AL, aşağı kesince SAT (short)
- Stop: en yüksek zirveden 3×ATR(14) iz süren (chandelier tipi)
- Stop: İz süren 3×ATR(14)

**Bollinger — Bollinger Ortalamaya Dönüş (20, 2)**
- Yön: İki yön (long/short flip)
- Fiyat alt bandı yukarı keserse AL (ortalamaya dönüş)
- Üst bandı aşağı keserse SAT (short)
- Çıkış: orta band
- Stop: Yok

**%B — %B Aşırılık Dönüşü**
- Yön: İki yön (long/short flip)
- %B 0’ı yukarı kesince AL (bandın altından dönüş)
- %B 1’i aşağı kesince SAT (short)
- Çıkış: 0,5 (orta)
- Stop: Yok

**Band Genişliği — Bant Sıkışması Kırılımı**
- Yön: İki yön (long/short flip)
- Bant genişliği son 10 barda 100-bar yüzdelik %15’inin altına inmişse (sıkışma)
- 20-bar zirvesi kırılırsa AL, dibi kırılırsa SAT (short)
- Stop: 2,5×ATR
- Stop: Teknik stop (kurallarda)

**Keltner — Keltner Kanal Kırılımı (20, 1,5)**
- Yön: İki yön (long/short flip)
- Fiyat üst kanalı yukarı keserse AL (kırılım)
- Alt kanalı aşağı keserse SAT (short)
- Çıkış: orta çizgi
- Stop: Yok

**Donchian — Donchian Kırılımı (20/10 — Turtle)**
- Yön: İki yön (long/short flip)
- 20-bar zirvesi üstüne kapanış → AL (Turtle kuralı)
- 20-bar dibi altına kapanış → SAT (short)
- Çıkış: ters yönde 10-bar kanal kırılımı
- Stop: Yok (10-bar kanal çıkışı)

**Std Sapma — Standart Sapma Genişleme Filtresi**
- Yön: İki yön (long/short flip)
- Volatilite (StdDev 20) son 24 barda GENİŞLİYORSA
- Fiyat EMA(50)’yi kesince yönde işlem aç
- Stop: 2,5×ATR
- Stop: Teknik stop (kurallarda)

**Tarihsel Vol. — Tarihsel Volatilite Düşüş Filtresi**
- Yön: İki yön (long/short flip)
- Tarihsel volatilite son 12 barda DÜŞÜYORSA
- Fiyat EMA(50)’yi kesince yönde işlem aç
- Sakin piyasada trend avı
- Stop: Yok (ters sinyal)

**Chaikin Vol. — Chaikin Volatilite + Zirve Kırılımı**
- Yön: İki yön (long/short flip)
- Chaikin volatilite artıyorsa VE
- 20-bar zirvesi kırılırsa AL / dibi kırılırsa SAT (short)
- Çıkış: 10-bar kanal kırılımı
- Stop: Yok (10-bar kanal çıkışı)

**NATR — EMA(50) Trendi + NATR Yüzde Stopu**
- Yön: İki yön (long/short flip)
- Fiyat EMA(50)’yi kesince yönde işlem aç
- Stop: giriş anında 3×NATR(14) yüzde mesafesi (sabit)
- Stop: Sabit 3×NATR yüzde stopu

**Ulcer Index — Ulcer Index Sakinlik Filtresi**
- Yön: İki yön (long/short flip)
- Ulcer Index (düşüş acısı) kendi EMA(24)’ünün altındaysa
- Fiyat EMA(50)’yi kesince yönde işlem aç
- Sakin (az sancılı) piyasada trend avı
- Stop: Yok (ters sinyal)

**Mass Index — Mass Index Tümsek Dönüşü (yaklaşım)**
- Yön: İki yön (long/short flip)
- Mass Index 27 üstünde tümsek yapıp geri dönerse (tümsek bitti)
- Fiyat SMA(20) üstündeyse AL, altındaysa SAT (short)
- Çıkış: SMA(20) kesişimi
- Stop: Yok
- Not: Tümsek tespiti yaklaşıktır; klasik kullanımın mekanikleştirilmiş hâlidir.

**Choppiness — Choppiness Trend Filtresi (38)**
- Yön: İki yön (long/short flip)
- Choppiness 38’in altındaysa (piyasa trendli)
- Fiyat EMA(50)’yi kesince yönde işlem aç
- Stop: Yok (ters sinyal)

**TTM Squeeze — TTM Squeeze Serbest Kalışı**
- Yön: İki yön (long/short flip)
- Bollinger bantları Keltner kanalının içindeyken (sıkışma) BEKLE
- Sıkışma bittiği barda momentum (+) ise AL, (−) ise SAT (short)
- Çıkış: momentum yönü ters dönünce
- Stop: Yok (momentum dönüşü)

**True Range — True Range Patlaması**
- Yön: İki yön (long/short flip)
- True Range, 1,5×ATR(14)’yü taze şekilde aşarsa (patlama barı)
- Yeşil mum → AL; kırmızı mum → SAT (short)
- En fazla 5 bar
- Stop: Yok (5 bar zaman stopu)

**Chandelier Exit — Chandelier Çıkış Çizgisi (22, 3)**
- Yön: İki yön (long/short flip)
- Fiyat EMA(50)’yi kesince yönde gir
- Çıkış: Avize (Chandelier) 3×ATR çizgisi kırılınca
- Stop: Yok (chandelier çizgisi)

**RVI — RVI Bölgesi (50) Trendi**
- Yön: İki yön (long/short flip)
- RVI 50’yi yukarı keserse AL (yukarı oynaklık baskın)
- Aşağı keserse SAT (short)
- Stop: Yok (ters sinyal)

**Volatilite Oranı — Volatilite Oranı Kırılımı (1,5)**
- Yön: İki yön (long/short flip)
- Volatilite oranı 1,5’i taze şekilde aşarsa
- Bar yönü yukarıysa AL, aşağıysa SAT (short)
- Çıkış: oran 0,8 altına inince veya 10 bar
- Stop: Yok

**Parkinson — Parkinson Volatilite + Zirve Kırılımı**
- Yön: İki yön (long/short flip)
- Parkinson volatilitesi 100-bar medyanının üstündeyse
- 20-bar zirvesi kırılırsa AL / dibi kırılırsa SAT (short)
- Stop: 3×ATR
- Stop: Teknik stop (kurallarda)

**VIX / Korku — Kripto Korku Endeksi Rejim Anahtarı (yaklaşım)**
- Yön: İki yön (long/short flip)
- Volatilite 200-bar yüzdelik %80 üstündeyse (panik rejimi): sadece alt bant dönüşünde AL
- Sakin rejimde: EMA(50) kesişimleriyle iki yönlü işlem
- Panik pozisyonları orta bandda kapatılır
- Stop: Yok
- Not: VIX kriptoda doğrudan yoktur; tarihsel volatilite yüzdeliği vekil olarak kullanılır.

### Piyasa Yapısı

**Destek & Direnç — Destek/Direnç Pivot Kırılımı**
- Yön: İki yön (long/short flip)
- Son onaylı direnç (pivot tepe) üstüne kapanış → AL
- Son onaylı destek (pivot dip) altına kapanış → SAT (short)
- Stop: karşı seviye
- Stop: Teknik stop (kurallarda)

**Fiyat Kanalları — Regresyon Kanalı Kırılımı (50)**
- Yön: İki yön (long/short flip)
- Fiyat üst kanal bandını yukarı keserse AL (kanal kırılımı)
- Alt bandı aşağı keserse SAT (short)
- Çıkış: kanala geri dönüş (bant ters kesişimi)
- Stop: Yok

**Fibo Geri Çekilme — Fibonacci %50-61,8 Geri Çekilme Alımı**
- Yön: Sadece long (sinyalsizken nakit)
- Son yukarı impuls (pivot dip→pivot tepe, >2×ATR) sonrası
- Fiyat %50-61,8 geri çekilme bölgesine inip yukarı dönerse AL
- Hedef: önceki tepe; stop: impuls dibi
- Stop: Teknik stop (kurallarda)

**Fibo Uzantı — Fibonacci 1,618 Uzantı Hedefli Kırılım**
- Yön: Sadece long (sinyalsizken nakit)
- Fiyat önceki tepeyi kırarsa AL (devam kırılımı)
- Hedef: impuls dibinden 1,618 Fibonacci uzantısı
- Stop: impuls dibi
- Stop: Teknik stop (kurallarda)

**Pivot Noktaları — Klasik Pivot (PP/S1/R1) Sekmesi**
- Yön: İki yön (long/short flip)
- Önceki günün H/L/C’si ile PP, S1, R1 hesaplanır
- S1’den yukarı dönüş → AL; R1’den aşağı dönüş → SAT (short)
- Çıkış: PP (orta pivot)
- Günlük/haftalıkta anlamsız olduğu için yalnızca 5m-4h arası test edilir
- Stop: Yok
- Test dışı dilimler: 1d, 1w

**Order Block — Order Block Geri Testi (yaklaşım)**
- Yön: İki yön (long/short flip)
- Impuls (1 barda >2×ATR) mumundan önceki ters mum = Order Block
- Fiyat OB seviyesine geri çekip reddederse yönde gir
- Stop: OB karşı kenarı; hedef: impuls zirvesi/dibi; 60 bar zaman aşımı
- Stop: Teknik stop (kurallarda)
- Not: OB tespiti mekanik yaklaşımdır; öznel çizime tam eşdeğer değildir.

**FVG — FVG (Adaletsiz Fiyat Boşluğu) Dolumu**
- Yön: İki yön (long/short flip)
- 3 mum arasında boşluk (FVG) oluşursa bölgeyi izle
- Fiyat boşluğa geri dönüp doldurup dönerse yönde gir
- Stop: boşluğun karşı kenarı; 60 bar zaman aşımı
- Stop: Teknik stop (kurallarda)

**Likidite & Stop Avı — Likidite Süpürme + Geri Alım**
- Yön: İki yön (long/short flip)
- 20-bar dibin altı süpürülüp aynı barda geri alınırsa AL (stop avı sonrası)
- 20-bar zirve süpürülüp geri satılırsa SAT (short)
- Stop: 2×ATR; 30 bar zaman aşımı
- Stop: Teknik stop (kurallarda)

**Tek Mum Formasyonları — Pin Bar / Çekiç Dönüşü**
- Yön: İki yön (long/short flip)
- Uzun alt fitil (≥2×gövde), 20-bar dibinde: ÇEKİÇ → AL
- Uzun üst fitil, 20-bar zirvesinde: KAYAN YILDIZ → SAT (short)
- En fazla 5 bar
- Stop: Yok (5 bar zaman stopu)

**Üç Mum Formasyonları — Yutan Mum + 3 Asker/Karga**
- Yön: İki yön (long/short flip)
- Yutan mum veya 3 asker (düşüş bağlamında) → AL
- Yutan mum veya 3 karga (yükseliş bağlamında) → SAT (short)
- En fazla 8 bar
- Stop: Yok (8 bar zaman stopu)

**Sıkışma Formasyonları — Sıkışan Üçgen Kırılımı**
- Yön: İki yön (long/short flip)
- 20-bar aralığı daralıyorsa (≤ %75, üçgen sıkışma)
- Kırılım yönünde gir: zirve üstü AL / dip altı SAT (short)
- Stop: 2,5×ATR
- Stop: Teknik stop (kurallarda)

**Omuz-Baş-Omuz — Omuz-Baş-Omuz Boyun Çizgisi Kırılımı (yaklaşım)**
- Yön: İki yön (long/short flip)
- Pivotlardan OBO (yüksek orta tepe + benzer omuzlar) tespit edilir
- Boyun çizgisi aşağı kırılırsa SAT (short); ters OBO yukarı kırılırsa AL
- Stop: 2,5×ATR; 80 bar zaman aşımı
- Stop: Teknik stop (kurallarda)
- Not: Formasyon tespiti pivot kurallarına dayalı yaklaşımdır.

**İkili Dip / Tepe — İkiz Tepe / İkiz Dip Kırılımı (yaklaşım)**
- Yön: İki yön (long/short flip)
- Yaklaşık aynı seviyede iki pivot tepe (≤ %1,5 fark): ikiz tepe
- Ara dip (boyun) kırılırsa SAT; ikiz dip boyun kırılırsa AL
- Stop: 2,5×ATR; 60 bar zaman aşımı
- Stop: Teknik stop (kurallarda)

**Kırılım & Tuzak — 30-Bar Kırılım Sistemi**
- Yön: İki yön (long/short flip)
- 30-bar zirvesi üstüne kapanış → AL
- 30-bar dibi altına kapanış → SAT (short)
- Çıkış: 15-bar kanal; stop: 2,5×ATR
- Stop: Teknik stop (kurallarda)

**Elliott Dalga — Dalga 3 Devam Kırılımı (yaklaşım)**
- Yön: Sadece long (sinyalsizken nakit)
- 50-bar zirvesi kıran impuls (dalga 1) izlenir
- Geri çekilme (dalga 2) dalga 1 dibinin üstünde kalırsa
- Dalga 1 zirvesi kırılınca (dalga 3 başlangıcı) AL
- Stop: dalga 2 dibi; 40 bar zaman aşımı
- Stop: Teknik stop (kurallarda)
- Not: Dalga sayımı otomatik yaklaşımdır; öznel sayımın yerini tutmaz.

**Harmonik Formasyonlar — Harmonik 0,618-0,786 Bölgesi Dönüşü (yaklaşım)**
- Yön: Sadece long (sinyalsizken nakit)
- Yukarı impuls sonrası %61,8-78,6 (D noktası) bölgesine geri çekilme
- Bölgede yukarı dönüş mumu gelirse AL (ipotetik Gartley benzeri)
- Hedef: 1,272 uzantı; stop: %88,6 seviyesi
- Stop: Teknik stop (kurallarda)
- Not: Fibonacci oranlarına dayalı basitleştirilmiş harmonik yaklaşımdır.

**Wyckoff Şeması — Wyckoff Yay/Spring Dönüşü**
- Yön: İki yön (long/short flip)
- Aralık dibi DÜŞÜK hacimle süpürülüp geri alınırsa: SPRING → AL
- Aralık zirvesi düşük hacimle süpürülüp geri satılırsa: UPTHRUST → SAT (short)
- Stop: süpürme barının ucu; 25 bar zaman aşımı
- Stop: Teknik stop (kurallarda)
- Not: Wyckoff fazlarının mekanikleştirilmiş (spring/upthrust) yaklaşımıdır.

**Market Profile — POC Göçü Trendi (yaklaşım)**
- Yön: İki yön (long/short flip)
- 50-bar VWAP (POC vekili) yükselirken fiyat üstüne çıkarsa AL
- POC düşerken fiyat altına inerse SAT (short)
- Değer alanının kayması trend olarak yorumlanır
- Stop: Yok (ters sinyal)
- Not: Gerçek POC yerine kayan VWAP vekili kullanılır.

**ORB — Açılış Aralığı Kırılımı (ORB)**
- Yön: İki yön (long/short flip)
- Günün ilk 30 dakikası aralığı belirler (5m: 6 bar, 15m: 2 bar, 1h: 1 bar)
- Aralık üstü kırılım → AL; altı kırılım → SAT (short)
- Gün sonunda pozisyon kapanır
- 4h+ zaman dilimlerinde gün içi kavram anlamsız → test dışı
- Stop: Yok (gün sonu çıkış)
- Test dışı dilimler: 4h, 1d, 1w

**Çoklu Zaman Dilimi — Çoklu Zaman Dilimi Trend + EMA(20) Tetiği**
- Yön: İki yön (long/short flip)
- Üst zaman diliminde (4h üstü: günlük; 1d: haftalık) EMA20>EMA50 ise trend yukarı sayılır
- Alt dilimde fiyat EMA(20)’yi trend yönünde kesince gir
- Çıkış: EMA(20) ters kesişimi
- Haftalıkta üst dilim yok → test dışı
- Stop: Yok
- Test dışı dilimler: 1w

## 11. Sembol listesi (525)

```
0GUSDT, 1000000MOGUSDT, 1000BONKUSDT, 1000CATUSDT, 1000CHEEMSUSDT, 1000FLOKIUSDT, 1000LUNCUSDT, 1000PEPEUSDT
1000RATSUSDT, 1000SATSUSDT, 1000SHIBUSDT, 1000XECUSDT, 1INCHUSDT, 1MBABYDOGEUSDT, 2ZUSDT, 4USDT
AAVEUSDT, ACEUSDT, ACHUSDT, ACTUSDT, ACUUSDT, ADAUSDT, AEROUSDT, AEVOUSDT
AGLDUSDT, AGTUSDT, AIAUSDT, AIGENSYNUSDT, AINUSDT, AIOTUSDT, AIOUSDT, AIXBTUSDT
AKEUSDT, AKTUSDT, ALCHUSDT, ALGOUSDT, ALICEUSDT, ALLOUSDT, ALLUSDT, ALPINEUSDT
ALTUSDT, ANIMEUSDT, ANKRUSDT, APEUSDT, API3USDT, APRUSDT, APTUSDT, ARBUSDT
ARCUSDT, ARIAUSDT, ARKMUSDT, ARKUSDT, ARPAUSDT, ARUSDT, ARXUSDT, ASRUSDT
ASTERUSDT, ASTRUSDT, ATHUSDT, ATOMUSDT, ATUSDT, AUCTIONUSDT, AUSDT, AVAAIUSDT
AVAUSDT, AVAXUSDT, AVNTUSDT, AWEUSDT, AXLUSDT, AXSUSDT, AZTECUSDT, B2USDT
BABYUSDT, BANANAS31USDT, BANANAUSDT, BANDUSDT, BANKUSDT, BANUSDT, BARDUSDT, BASEDUSDT
BASUSDT, BATUSDT, BBUSDT, BCHUSDT, BEAMXUSDT, BEATUSDT, BELUSDT, BERAUSDT
BICOUSDT, BIGTIMEUSDT, BILLUSDT, BIOUSDT, BIRBUSDT, BLESSUSDT, BLUAIUSDT, BLURUSDT
BMTUSDT, BNBUSDT, BNTUSDT, BOMEUSDT, BRETTUSDT, BREVUSDT, BROCCOLI714USDT, BROCCOLIF3BUSDT
BRUSDT, BSBUSDT, BSVUSDT, BTCDOMUSDT, BTCUSDT, BTRUSDT, BTWUSDT, BULLAUSDT
BUSDT, C98USDT, CAKEUSDT, CAPUSDT, CARVUSDT, CATIUSDT, CCUSDT, CELOUSDT
CELRUSDT, CETUSUSDT, CFGUSDT, CFXUSDT, CGPTUSDT, CHILLGUYUSDT, CHIPUSDT, CHRUSDT
CHZUSDT, CKBUSDT, CLANKERUSDT, CLOUSDT, COAIUSDT, COLLECTUSDT, COMPUSDT, COOKIEUSDT
COTIUSDT, COWUSDT, CROSSUSDT, CRVUSDT, CTKUSDT, CTRUSDT, CTSIUSDT, CTUSDT
CUSDT, CVCUSDT, CVXUSDT, CYBERUSDT, CYSUSDT, DASHUSDT, DATAIPUSDT, DEEPUSDT
DEXEUSDT, DIAUSDT, DODOXUSDT, DOGEUSDT, DOGSUSDT, DOLOUSDT, DOODUSDT, DOSUSDT
DOTUSDT, DRIFTUSDT, DUSKUSDT, DYDXUSDT, DYMUSDT, EDENUSDT, EDGEUSDT, EDUUSDT
EGLDUSDT, EIGENUSDT, ELSAUSDT, ENAUSDT, ENJUSDT, ENSOUSDT, ENSUSDT, EPICUSDT
ERAUSDT, ESPORTSUSDT, ESPUSDT, ETCUSDT, ETHFIUSDT, ETHUSDT, ETHWUSDT, EULUSDT
EVAAUSDT, FARTCOINUSDT, FETUSDT, FFUSDT, FHEUSDT, FIDAUSDT, FIGHTUSDT, FILUSDT
FLOCKUSDT, FLOWUSDT, FLUIDUSDT, FLUXUSDT, FOGOUSDT, FOLKSUSDT, FORMUSDT, FRAXUSDT
FUSDT, GALAUSDT, GASUSDT, GENIUSUSDT, GIGGLEUSDT, GLMUSDT, GMTUSDT, GMXUSDT
GOATUSDT, GPSUSDT, GRAMUSDT, GRASSUSDT, GRIFFAINUSDT, GRTUSDT, GRVTUSDT, GTCUSDT
GUAUSDT, GUNUSDT, GUSDT, GWEIUSDT, HAEDALUSDT, HANAUSDT, HBARUSDT, HEIUSDT
HEMIUSDT, HIVEUSDT, HMSTRUSDT, HOLOUSDT, HOMEUSDT, HOTUSDT, HUMAUSDT, HUSDT
HYPERUSDT, HYPEUSDT, ICNTUSDT, ICPUSDT, IDOLUSDT, IDUSDT, ILVUSDT, IMXUSDT
INITUSDT, INJUSDT, INUSDT, INXUSDT, IOSTUSDT, IOTAUSDT, IOTXUSDT, IOUSDT
IRYSUSDT, JASMYUSDT, JCTUSDT, JELLYJELLYUSDT, JOEUSDT, JSTUSDT, JTOUSDT, JUPUSDT
KAIAUSDT, KAITOUSDT, KASUSDT, KATUSDT, KAVAUSDT, KERNELUSDT, KGENUSDT, KITEUSDT
KMNOUSDT, KNCUSDT, KOMAUSDT, KSMUSDT, LABUSDT, LAUSDT, LAYERUSDT, LDOUSDT
LIGHTUSDT, LINEAUSDT, LINKUSDT, LISTAUSDT, LITUSDT, LPTUSDT, LQTYUSDT, LSKUSDT
LTCUSDT, LUMIAUSDT, LUNA2USDT, LYNUSDT, MAGICUSDT, MAGMAUSDT, MANAUSDT, MANTAUSDT
MANTRAUSDT, MARSCOINUSDT, MASKUSDT, MAVIAUSDT, MAVUSDT, MEGAUSDT, MELANIAUSDT, MEMEUSDT
MERLUSDT, METISUSDT, METUSDT, MEUSDT, MEWUSDT, MINAUSDT, MIRAUSDT, MITOUSDT
MMTUSDT, MOCAUSDT, MONUSDT, MOODENGUSDT, MORPHOUSDT, MOVEUSDT, MOVRUSDT, MTLUSDT
MUBARAKUSDT, MUSDT, MYXUSDT, NAORISUSDT, NEARUSDT, NEIROUSDT, NEOUSDT, NEWTUSDT
NIGHTUSDT, NILUSDT, NMRUSDT, NOMUSDT, NOTUSDT, NXPCUSDT, OGNUSDT, OGUSDT
ONDOUSDT, ONEUSDT, ONGUSDT, ONTUSDT, ONUSDT, OPENUSDT, OPGUSDT, OPNUSDT
OPUSDT, ORCAUSDT, ORDERUSDT, ORDIUSDT, OUSDT, PARTIUSDT, PAXGUSDT, PENDLEUSDT
PENGUUSDT, PEOPLEUSDT, PHAROSUSDT, PHAUSDT, PIEVERSEUSDT, PIPPINUSDT, PIXELUSDT, PLAYUSDT
PLUMEUSDT, PNUTUSDT, POLUSDT, POLYXUSDT, PONSUSDT, POPCATUSDT, PORTALUSDT, POWERUSDT
POWRUSDT, PRLUSDT, PROMUSDT, PROVEUSDT, PTBUSDT, PUMPUSDT, PUNDIXUSDT, PYTHUSDT
QNTUSDT, QTUMUSDT, QUSDT, RAREUSDT, RAVEUSDT, RAYSOLUSDT, RECALLUSDT, REDUSDT
RENDERUSDT, RESOLVUSDT, REUSDT, REZUSDT, RIFUSDT, RIVERUSDT, RLCUSDT, ROBOUSDT
RONINUSDT, ROSEUSDT, RPLUSDT, RSRUSDT, RUNEUSDT, RVNUSDT, SAFEUSDT, SAGAUSDT
SAHARAUSDT, SANDUSDT, SANTOSUSDT, SAPIENUSDT, SCRUSDT, SEIUSDT, SENTUSDT, SFPUSDT
SHELLUSDT, SIGNUSDT, SIRENUSDT, SKLUSDT, SKRUSDT, SKYAIUSDT, SKYUSDT, SLPUSDT
SLXUSDT, SNXUSDT, SOLUSDT, SOLVUSDT, SOMIUSDT, SONICUSDT, SOONUSDT, SOPHUSDT
SPACEUSDT, SPELLUSDT, SPKUSDT, SPORTFUNUSDT, SPXUSDT, SQDUSDT, SSVUSDT, STABLEUSDT
STARUSDT, STBLUSDT, STEEMUSDT, STOUSDT, STRKUSDT, STXUSDT, SUIUSDT, SUNUSDT
SUPERUSDT, SUSDT, SUSHIUSDT, SWARMSUSDT, SXTUSDT, SYNUSDT, SYRUPUSDT, TACUSDT
TAGUSDT, TAIKOUSDT, TAKEUSDT, TAOUSDT, TAUSDT, THETAUSDT, THEUSDT, TIAUSDT
TLMUSDT, TNSRUSDT, TOSHIUSDT, TOWNSUSDT, TRADOORUSDT, TRBUSDT, TREEUSDT, TRIAUSDT
TRUMPUSDT, TRUSTUSDT, TRUTHUSDT, TRXUSDT, TSTUSDT, TURBOUSDT, TURTLEUSDT, TUSDT
TUTUSDT, TWTUSDT, UAIUSDT, UBUSDT, UMAUSDT, UNIUSDT, USDCUSDT, USELESSUSDT
USTCUSDT, USUALUSDT, USUSDT, VANAUSDT, VELODROMEUSDT, VELVETUSDT, VETUSDT, VIRTUALUSDT
VTHOUSDT, VVVUSDT, WALUSDT, WAXPUSDT, WCTUSDT, WETUSDT, WIFUSDT, WLDUSDT
WLFIUSDT, WOOUSDT, WUSDT, XAIUSDT, XANUSDT, XAUTUSDT, XLMUSDT, XMRUSDT
XNYUSDT, XPINUSDT, XPLUSDT, XRPUSDT, XTZUSDT, XVGUSDT, XVSUSDT, YBUSDT
YFIUSDT, YGGUSDT, ZAMAUSDT, ZBTUSDT, ZECUSDT, ZENUSDT, ZEREBROUSDT, ZESTUSDT
ZETAUSDT, ZILUSDT, ZKCUSDT, ZKPUSDT, ZKUSDT, ZORAUSDT, ZROUSDT, ZRXUSDT
哈基米USDT, 币安人生USDT, 我踏马来了USDT, 牛来USDT, 龙虾USDT
```

## 12. Sınırlar ve varsayımlar

- Emir defteri derinliği, kısmi dolum ve likidite şokları modellenmez; kayma sabit 1bp varsayılır. Gerçek kayma, özellikle düşük likiditeli altcoinlerde daha yüksek olur.
- Marj/limit koşulları ve tasfiye yoktur (1× kaldıraç).
- Veri setindeki 525 güncel kontrat kapsanır; dönem içinde delist olan kontratlar dahil değildir (hayatta kalma etkisi).
- Yeni listelenen coinlerin ilk mumları ve düşük likidite dönemleri **gerçek** ama uç sonuçlar üretir (ör. ilk saatlerde ±%1000 barlar). Bu yüzden birçok indikatörde medyan işlem getirisi ortalamadan daha iyidir; dağılım grafikleri ve medyan çizgisi bu nedenle panoda vurgulanır.
- 1w diliminde bar sayısı azdır (dönem ≈ 4 yıl / ~210 hafta); bu dilimin istatistikleri diğerlerine göre daha gürültülüdür. Ayrıca yeni listelenen kontratlarda haftalık ısınma penceresi işlem üretmeye yetmeyebilir; bu hücreler ısı tablosunda boş görünür ve ilgili zaman diliminin toplamlarına katkı vermez (sıfır işlemli semboller ortalama ve dağılım dışında bırakılır).
- Sonuçlar geçmiş veriye dayanır; **gelecek getiriyi garanti etmez ve yatırım tavsiyesi değildir**.

## 13. Yeniden üretim

```bash
python tools/bt/prep-525.py  # 1m arşivinden 525 sembollük veri seti üretir (bt525)
node tools/bt/run.mjs        # tüm backtestleri yeniden üretir (tüm semboller, 10 işçi)
node tools/bt/report.mjs     # bu raporu yeniden oluşturur
npm run validate           # içerik + katalog + çıktı doğrulaması
npm run bt:qa              # pano uçtan uca testi (45 kontrol)
```

---

*İndikatör Akademi — Backtest Raporu · 2026-11-01 · Eğitim amaçlıdır; yatırım tavsiyesi değildir.*
