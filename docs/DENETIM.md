# Backtest Denetimi — 8 Kasım 2026

Bu rapor, 525 sembollük üretimde "kârlı görünen" yöntemleri **sağlamlık**
açısından sıralar. Ölçü birimi: **işlem başına net getiri** (taker %0,04 +
1bp kayma/bacak ve gerçek funding sonrası), **10$ sabit pozisyon**. Dönem:
2022-08-01 → 2026-09-07 (1.498 gün), 525 USDT-M perpetual. Kaynak:
`assets/bt/*.json` ve `tools/dash/data/agg/*.bin` (600 senaryo × 31 filtre).

> Bu bir yatırım tavsiyesi veya işlem sinyali değildir.

---

## 1. Veri ve muhasebe kontrolleri

- Sinyal bar kapanışında üretilir, emir **sonraki bar açılışında** uygulanır.
- Stop yalnızca giriş barından sonra, bar içinde; long `min(açılış, stop)`,
  short `max(açılış, stop)` (boşlukta açılıştan).
- Taker %0,04 + 1bp kayma her bacakta; funding gerçek 8 saatlik olaylarla;
  kaldıraç yok (1×). Dönem sonunda açık pozisyon kapanır.
- Doğrulama: `sma|4h` → n=92.936, ort. %0,99, PF 1,284; motorun `sum` çıktısı
  ve dashboard toplaması birebir aynı.
- Histogram toplamı = işlem sayısı; eğri 215 haftalık nokta; yıllar toplam
  getiriye bileşikleniyor (bilinen hata düzeltildi).

### Maliyet stresi (2,2×: %0,08 taker + 3bp kayma/bacak)

| Yöntem | Baz ort. | Stres ort. | Baz PF | Stres PF |
|---|---:|---:|---:|---:|
| MA Şeridi 1h | %1,32 | %1,20 | 1,35 | 1,31 |
| NVI 4h | %1,96 | %1,83 | 1,60 | 1,55 |
| SMA 4h | %0,99 | %0,87 | 1,28 | 1,24 |
| Volume Osc. 1d | %2,15 | %2,03 | 1,43 | 1,40 |
| MFI 1d | %20,87 | %20,73 | 3,01 | 2,99 |
| Ultimate Osc. 1d | %110,18 | %109,93 | 7,30 | 7,27 |

**Sonuç:** Sabit maliyet, A-tier adaylarında bağlayıcı risk değil (kenar
maliyetin 5–20 katı). Asıl riskler: uç işlem büyüklükleri, likidite/dolum,
hayatta kalma yanlılığı ve rejim.

### Muhasebe uyarısı: maruziyet ve eşzamanlılık

- Eğri, **her işleme ayrı 10$** varsayar; eşzamanlı pozisyon sayısı ve toplam
  maruziyet **sınırlandırılmamıştır**. Bu bir hesap özsermayesi değil, P&L
  muhasebesidir.
- Little yasasıyla ortalama eşzamanlılık ≈ işlem/gün × ortalama tutuş:
  adayların çoğunda **~250 eşzamanlı pozisyon** → 10$ ile **~2.500$ ortalama
  maruziyet**. Bu yüzden DD'yi maruziyete oranladık (aşağıda).
- Paper'da sermaye ve **maksimum eşzamanlı pozisyon** tanımlanmalı; bu sınır
  backtestte yok, sonuçları değiştirebilir.

---

## 2. Seçim geçmişi

- 100 indikatör × 6 dilim = **600 deneme**. Her indikatörde "en iyi dilim"
  toplam getiriye göre seçildi; bu da bir **deneme**dir.
- Dilim tutarlılığı (pozitif dilim sayısı): Ribbon **6/6**, MFI **6/6**,
  StochRSI **6/6**, UO **6/6**; NVI/SMA/WMA/Fractals/PSAR/VWAP 5/6;
  VOI/Twiggs/Chop 4/6; **DPO 3/6**.
- **2026 bağımsız doğrulama değil**: dilim seçimi tüm yılları gördü.
- Parametre optimizasyonu yapılmadı (kurallar sabit); ancak strateji kataloğu
  ve dilim seçimi insan kararı.
- Evren: bugün listeli 525 kontrat; dönem içinde delist olanlar yok →
  **hayatta kalma yanlılığı** (özellikle 1d ve memecoin yoğun stratejilerde).

---

## 3. Kâr kaynağı ve kayıp mekanizması

- Adayların tamamı **iki yönlü (long/short)** trend/volatilite kuralları.
- Trend adaylarında medyan işlem **negatif** (Ribbon −%2,88, SMA −%1,88,
  WMA −%2,12, Fractals −%2,62, NVI −%0,88): kazanç sağ kuyrukta; tipik trend
  takibi, ama **rejim bağımlı**.
- Uç büyüklük bayrakları: UO ort. **%110,2**, medyan >+%10, işlemlerin %51'i
  >+%10; MFI ort. %20,9, medyan +%8,9; StochRSI ort. %21,6, medyan +%1,38;
  Chop ort. %3,86 ama **en iyi sembol payı %35 (yalnız 4 işlem)** ve ilk 5 gün
  payı %52.
- Yoğunlaşma (en iyi sembol payı): Chop %35 (LAB, 4 işlem), AO %12 (LAB,
  8 işlem), diğer adaylar %2–8 → çoğu geniş.
- Rejim: 2024–26 alt boğası baskın; 2022–23 birçok adayda zayıf/negatif.
  Karşılaştırma: BTC al-tut **+%237**, ETH +%44; 525 altın eşit ağırlıklı
  ortalaması **−%52,6**, medyanı **−%81,3**. Yani evren sert; stratejiler
  yalnızca beta değil, ama 2024–26 trendi de itici güç.

---

## 4. Sağlamlık sıralaması

Sıralama; dilim/yıl tutarlılığı, örneklem, PF, medyan, yoğunlaşma, maliyet
marjı, DD/maruziyet ve seçim riski birlikte değerlendirilerek yapılmıştır.

### A — Paper trade'a en yakın

| # | Yöntem / TF | n | Ort. | PF | 10$ DD | DD/maruz. | Dilim | Yıl | En iyi sembol | Karar |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | **NVI + EMA200 / 4h** | 56.215 | %1,96 | 1,60 | −$268 | %10,7 | 5/6 | 4/4 | %3 | Paper |
| 2 | **EMA Şeridi 13–89 / 1h** | 79.550 | %1,32 | 1,35 | −$735 | %27,9 | **6/6** | 4/4 | %6 | Paper |
| 3 | **Fractal Kırılımı / 4h** | 107.744 | %0,71 | 1,21 | −$697 | %28,2 | 5/6 | 4/4 | %8 | Paper |
| 4 | **Hacim Osilatörü / 1d** | 42.805 | %2,15 | 1,43 | −$564 | %22,8 | 4/6 | 4/4 | %6 | Paper (2026 zayıflıyor) |
| 5 | **SMA 10/30 / 4h** | 92.936 | %0,99 | 1,28 | −$1.433 | %54,9 | 5/6 | 4/4 | %5 | Paper (DD yüksek) |
| 6 | **WMA 10/30 / 4h** | 114.840 | %0,82 | 1,26 | −$1.249 | %47,8 | 5/6 | 4/4 | %8 | Paper (SMA ile korelasyonlu) |

### B — Koşullu / sınırlı paper

| # | Yöntem / TF | n | Ort. | PF | DD/maruz. | Dilim | Yıl | Not |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 7 | DPO Sıfır / 1d | 86.055 | %1,26 | 1,39 | %41,6 | **3/6** | 4/4 | Dilim seçimi riski; yalnız 1d'de güçlü |
| 8 | Twiggs MF / 4h | 204.949 | %0,50 | 1,24 | %30,6 | 4/6 | 4/4 | İnce kenar (maliyet 5×) |
| 9 | Parabolic SAR / 4h | 202.192 | %0,52 | 1,20 | %30,7 | 4/6 | 3/4 | 2023 negatif |
| 10 | VWAP + hacim / 4h | 199.062 | %0,62 | 1,28 | %48,0 | 5/6 | 3/4 | 2023 negatif, DD yüksek |

### C — Karar için veri eksik (yüksek potansiyel, doğrulanmamış uç)

| # | Yöntem / TF | n | Ort. | Medyan | PF | >+%10 işlem | Şüphe |
|---|---|---:|---:|---:|---:|---:|---|
| 11 | MFI 20/80 / 1d | 4.389 | %20,87 | +%8,88 | 3,01 | %48,7 | 1d barlarda aşırı büyük hareketler; listeleme/likidite |
| 12 | Ultimate Osc. / 1d | 1.150 | %110,18 | >+%10 | 7,30 | %51,4 | Aynı; n küçük, büyüklük inandırıcı değil |
| 13 | StochRSI / 4h | 11.594 | %21,60 | +%1,38 | 5,61 | %28,2 | 2025–26 patlaması; kuyruk |
| 14 | Awesome Osc. / 1d | 15.311 | %6,59 | −%4,88 | 1,89 | %21,7 | Kuyruk; en iyi sembol %12 (8 işlem) |
| 15 | Choppiness / 5m | 26.143 | %3,86 | −%0,12 | 1,82 | %14,1 | En iyi sembol %35 (4 işlem), ilk 5 gün %52 |

**Bu grup için gereken çıktılar:** en büyük 10 işlem (giriş/çıkış zamanı,
sembol, listeleme tarihi), giriş anındaki kotasyon/hacim, MAE/MFE, sonraki
açılışta gerçekleşme olasılığı, eşzamanlı pozisyon geçmişi. Bunlar olmadan
ortalama, birkaç uç olayın eseri mi ayrıştırılamaz.

### D — Bu sürümle paper trade önerilmez

| # | Yöntem / TF | Neden |
|---|---|---|
| 16 | CCI Aşırılık / 4h | 2023–24 negatif (2/4 yıl) |
| 17 | Supertrend / 1h | İlk 5 gün payı %54; 5 gün çıkarınca ort. %0,13; 2023 negatif |
| 18 | ADX + DI / 1h | İlk 5 gün payı %49; 5 gün çıkarınca %0,09; maliyet 1,8× |
| 19 | HMA 20 / 1h | Maliyet 1,5×; ilk 5 gün %38; 2023 negatif |
| 20 | Market Profile 15m | Ort. %0,08 < tur maliyeti %0,10 → kenar yok |
| 21 | Guppy / EMA 15m | PF ≤1,01 / negatif ortalama; artefakt |

---

## 5. Paper planı (A-tier için ortak)

1. **Sürümü kilitle:** kural seti (`strategies.mjs`), TF, maliyet varsayımı
   (%0,04 + 1bp/bacak), 10$ pozisyon, funding. Test boyunca parametre değişmez.
2. **Sermaye/maruziyet:** ortalama ~250 eşzamanlı pozisyon → 10$ ile ~2.500$
   maruziyet. Başlangıç sermayesi en az 5.000$ **veya** pozisyonu 2$'a düşür;
   maksimum eşzamanlılık sınırı koy. Sınır, backtestte olmadığı için sonuçları
   değiştirecektir; ayrı bir koşuyla doğrula.
3. **Kayıt:** sinyal kapanış saati, sonraki açılış kotasyonu, simüle dolum,
   kayma, kaçan emir, funding, çıkış nedeni. Haftalık mutabakat.
4. **Süre:** 8–12 hafta. Ribbon ~53 işlem/gün, NVI ~37/gün → binlerce işlem;
   ancak işlemler ilişkili, bağımsız olay sayısı daha az.
5. **Durdurma:** 200+ işlem sonrası ortalama < 0; DD backtest DD'sini aşarsa
   (Ribbon −$735, NVI −$268, 10$ ölçeğinde); dolum oranı <%95 veya kayma
   2× varsayımı aşarsa; eşzamanlılık sınırı aşılırsa.
6. **Sınır:** Paper, emir kuyruğu/derinliği doğrulamaz. Bağımsız ileriye dönük
   kanıt paper dönemiyle başlar; 2026 dilimi in-sample'dır.

---

## 6. Özet

- En sağlam: **NVI 4h** ve **EMA Şeridi 1h** (geniş örneklem, 5–6/6 dilim,
  4/4 yıl, düşük yoğunlaşma, maliyet stresi geçti).
- Orta: Fractals, Volume Osc., SMA/WMA; DPO yalnız 1d'de.
- Yüksek getirili ama **doğrulanmamış**: MFI, UO, StochRSI, AO, Choppiness —
  ortalama/medyan ve yoğunlaşma, uç işlem denetimi olmadan paper'a uygun değil.
- Zayıf: CCI, Supertrend, ADX, HMA, Market Profile, Guppy/EMA.

Ayrıntılı metrikler: `tools/dash/README.md`, `BACKTEST-RAPORU.md`.
