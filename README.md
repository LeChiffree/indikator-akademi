# İndikatör Akademi

Mobil öncelikli, tamamen Türkçe, lüks görselli **indikatör eğitim sitesi**.
5 kategori × 20 indikatör = **100 sayfa**; her indikatör tek bir "slide" gibi
okunur: tek cümlelik özet → gerçek formülle hesaplanmış, işaretlenmiş örnek
grafik → yorumlama ve karar rehberi → **gerçek piyasa verisiyle backtest
panosu** (eğri, dağılım, ısı haritası).

> ⚠️ Eğitim amaçlıdır, **yatırım tavsiyesi değildir.**

---

## Çalıştırma

Node.js 20+ yeterli; **npm bağımlılığı yoktur.**

```bash
npm start          # veya: node tools/serve.mjs
```

→ Tarayıcıda aç: **http://localhost:4173** (telefon için: bilgisayarın
yerel IP'si + `:4173`, örn. `http://192.168.1.20:4173`)

Statik site olduğu için `index.html` ve `assets/` klasörünü herhangi bir
statik sunucuya (GitHub Pages, Netlify, nginx...) olduğu gibi koymak yeterli.
Backtest panoları da statiktir: `assets/bt/*.json` dosyaları sitenin yanında
taşınır, ek sunucu gerekmez.

### Diğer komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm start` | Yerel geliştirme sunucusu (http://localhost:4173) |
| `python3 serve.py` | Node'suz makineler için statik sunucu (macOS/Linux; varsayılan port 8080, `PORT=...` ile değişir) |
| `npm run validate` | İçerik + grafik + backtest kataloğu doğrulaması |
| `npm run smoke` | Sunucuyu açıp kritik dosyaların 200 döndüğünü test eder |
| `npm run bt` | **Backtest üretimi:** tüm sembol × zaman dilimi × indikatör |
| `python tools/bt/prep-525.py` | 1m parquet arşivinden 525 sembollük veri setini (`bt525`) hazırlar |
| `npm run bt:report` | Sonuçlardan `BACKTEST-RAPORU.md` dokümanını üretir |
| `python tools/dash/server.py` | **Analiz dashboard** (600 senaryo × 31 filtre) — port 8090 |
| `npm run bt:qa` | Backtest panosu QA: grafik motoru + sahte DOM ile uçtan uca akış |
| `npm run bt:test` | Hızlı deneme koşusu (3 sembol, 4h+1d, çıktı `.bt-test/`) |
| `npm run fonts` | Playfair Display + Manrope woff2 dosyalarını indirir |
| `tools\deploy-mac.ps1` | Siteyi Mac'e (berfin@192.168.1.102) aktarıp servisi yeniden başlatır |

`npm run bt` varsayılan olarak `assets/bt/` klasörüne yazar. Bayraklar:

```bash
node tools/bt/run.mjs --symbols=6 --workers=10          # ilk 6 sembol
node tools/bt/run.mjs "--tfs=4h,1d"                     # sadece iki dilim
node tools/bt/run.mjs --only=sma,rsi --out=.bt-test     # seçili indikatörler
```


Fontlar indirilmemişse site otomatik olarak sistem fontlarıyla çalışır.

---

## Klasör yapısı

```
indikator-akademi/
├─ index.html                 # Tek sayfa (SPA) girişi
├─ manifest.webmanifest       # PWA tanımı (ana ekrana ekle)
├─ serve.py                   # Node'suz statik sunucu (macOS/Linux, 8080)
├─ assets/
│  ├─ css/
│  │  ├─ main.css             # Tüm tema: koyu + altın, kartlar, animasyonlar
│  │  └─ fonts.css            # @font-face tanımları (otomatik üretilir)
│  ├─ fonts/                  # woff2 dosyaları (npm run fonts ile inilir)
│  ├─ img/                    # PWA ikonları (SVG)
│  ├─ bt/                     # Backtest çıktıları: {id}.json + index.json
│  └─ js/
│     ├─ app.js               # Hash yönlendirme, ekranlar, ilerleme, dokunma
│     ├─ data/
│     │  ├─ index.js          # DATA / ALL / byId / listByCat
│     │  ├─ categories.js     # 5 kategori tanımı
│     │  ├─ trend.js          # 20 indikatör (Trend)
│     │  ├─ momentum.js       # 20 indikatör (Hız/Momentum)
│     │  ├─ hacim.js          # 20 indikatör (Hacim)
│     │  ├─ volatilite.js     # 20 indikatör (Volatilite)
│     │  └─ yapi.js           # 20 indikatör (Piyasa Yapısı)
│     └─ engine/
│        ├─ synth.js          # Tohumlu (deterministik) sentetik OHLCV üretici
│        ├─ formulas.js       # ~75 gerçek formül (CALCS kayıt defteri)
│        ├─ charts.js         # SVG grafik çizici + anotasyon çözücüler
│        ├─ btcharts.js       # Backtest panosu grafikleri (eğri/bar/hist/ısı)
│        └─ scenes.js         # El çizimi diyagram sahneleri (S/R, formasyon...)
└─ tools/
   ├─ serve.mjs               # Bağımlılıksız minik dev sunucusu
   ├─ deploy-mac.ps1          # Siteyi Mac'e (berfin@192.168.1.102) aktarır
   ├─ validate.mjs            # İçerik + motor + backtest doğrulayıcı
   ├─ smoke.mjs               # Duman testi (sunucu + dosya kontrolleri)
   ├─ fetch-fonts.mjs         # Font indirici (woff2 + fonts.css üretir)
   └─ bt/                     # Backtest motoru (bağımsız, worker'lı)
      ├─ run.mjs              # Koşucu: CLI bayrakları, worker havuzu, JSON yazar
      ├─ prep-525.py          # 1m parquet arşivinden 525 sembollük veri seti üretir
      ├─ report.mjs           # BACKTEST-RAPORU.md üretici
      ├─ worker.mjs           # İşçi: sembol dilimini hesaplar
      ├─ io.mjs               # Veri katmanı: CSV ayrıştırma, seriler, funding
      ├─ strategies.mjs       # 100 indikatörün mekanik strateji kataloğu
      ├─ sim.mjs              # Simülasyon çekirdeği: emir modeli, maliyetler
      ├─ agg.mjs              # Toplama: haftalık eğri ızgarası, histogram, ısı
      └─ qa.mjs               # Pano QA: btcharts + sahte DOM ile uçtan uca test
```

---

## Mac'e kurulum (kalıcı yayın)

Site, ağdaki Mac'te (`berfin@192.168.1.102`, Apple Silicon) Node olmadan
**python3 + serve.py** ile yayınlanır:

- Adres: **http://192.168.1.102:8080** — 80 portu yönetici (sudo) izni
  gerektirdiği için 8080 kullanılır.
- Klasör: `/Users/berfin/indikator-akademi` · günlük: `serve.log`
- Servis: `~/Library/LaunchAgents/com.indikatorakademi.server.plist`
  (launchd; oturum açılışında otomatik başlar, süreç ölürse yeniden kalkar)
- **Güncelleme:** bu makinede `tools\deploy-mac.ps1` çalıştırın — dosyaları
  aktarır, servisi yeniden başlatır ve sağlık kontrolü yapar.
- Backtest üretimi Mac'te yapılmaz (Node yok); `assets/bt` çıktıları buradan
  aktarılır.

## Nasıl çalışıyor?

- **Yönlendirme:** `#/` (giriş) → `#/k/:kategori` (dizin) →
  `#/i/:kategori/:id` (indikatör). İleri/geri butonları, klavye okları,
  dokunma kaydırma (swipe) ve "ev" butonu desteklenir.
- **Grafikler:** Her indikatörün grafiği, tohumlu (seed) sentetik ~120 barlık
  OHLCV verisiyle **gerçek formülle** hesaplanır; sonuçlar SVG olarak çizilir,
  numaralı noktalarla işaretlenir ve altında/yanında not listesi çıkar.
- **Diyagramlar:** Formülle çizilemeyen kavramlar (Frayma 5-0, Elliott...)
  için elle çizilmiş şematik sahneler kullanılır.
- **İlerleme:** Okunan indikatörler `localStorage`'da saklanır
  (`ia.read`), kaldığın yer (`ia.last`) ve kategori yüzdesi girişte gösterilir.
- **PWA:** `manifest.webmanifest` + SVG ikonlarla telefonun ana ekranına
  eklenebilir; tam ekran (standalone) açılır.

## Backtest motoru (gerçek veri)

Her indikatörün sayfasındaki **"Backtest Sonuçlarını Gör"** butonu, o
indikatörün standart kullanımının gerçek piyasa verisiyle test edildiği
panoya götürür (`#/bt/:id`).

- **Veri:** Binance USDT-M vadeli (futures) verisi — **525 parite**, 6 zaman dilimi
  (5m, 15m, 1h, 4h, 1d, 1w; 1w, 1d'den yeniden örneklenir), Ağustos 2022 →
  Eylül 2026. Kaynak: `D:\1mDataBinance` (525 sembol × 1m parquet arşivi;
  5m–1d serileri `tools/bt/prep-525.py` ile `D:\1mDataBinance\bt525` altına
  hazırlanır; gerçek funding olayları dahildir).
- **Kural:** Her indikatör için tek, mekanik, yaygın kullanım senaryosu
  tanımlıdır (`tools/bt/strategies.mjs`) — örn. SMA(10/30) kesişimi,
  RSI(14) 30/70 dönüşü. Kurallar panoda aynen listelenir.
- **Emir modeli:** Sinyal mum kapanışında üretilir, emir **sonraki mumun
  açılışında** uygulanır. Taker komisyonu %0,04 + 1bp kayma her bacakta
  (giriş + çıkış) düşülür; pozisyon tutulan süre boyunca **gerçek 8 saatlik
  funding ödemeleri** işlenir. Kaldıraç yoktur (1×), her işlem eşit ağırlıklı
  bağımsız sermaye ile yapılır ve bileşik büyür.
- **Çıktı:** `assets/bt/{id}.json` — zaman dilimi başına: işlem sayısı,
  kazanma oranı, işlem başına ortalama getiri, profit factor, maks. düşüş,
  eşit ağırlıklı portföy eğrisi (215 haftalık nokta), işlem getiri dağılımı
  (82 kovalı histogram), yıl bazında getiri/kazanma, sembol × dilim ısı
  haritası verisi. `assets/bt/index.json` tüm indikatörlerin en iyi dilim
  özetini ve kullanılan sembol listesini taşır.
- **Pano:** Eğri (çizgi), dilim karşılaştırması (bar), dağılım (histogram),
  yıllık getiri/kazanma, sembol × dilim **ısı haritası** (metrik seçilebilir:
  ort. getiri, kazanma, işlem, düşüş, PF, al-tut). Mobilde tek kolon, geniş
  ekranda iki kolon; tüm grafikler bağımlılıksız SVG'dir.
- **Pano okunurluğu:** Her panelin altında "nasıl okunur" ipucu vardır.
  Grafikler dar ekranda daha büyük yazıyla çizilir; bar değerleri ve portföy
  eğrisinin son değeri etiketlidir; histogramda medyan çizgisi ve kâr/zarar
  bölge tonları bulunur. Isı haritasında satırlar zebra desenli, seçili dilim
  sütunu işaretlidir; **hücreye dokununca** detay altta ve ekran altında kısa
  süreli bir bildirimde görünür (masaüstünde üzerine gelince ipucu çıkar).
- **Sınırlar:** Statik JSON çıktısıdır; emir defteri derinliği, kısmi
  dolum ve gerçek kayma dağılımı modellenmez. Sonuçlar **yatırım tavsiyesi
  değildir**.

## Analiz Dashboard (600 senaryo × 31 filtre)

`tools/dash/` altındaki Python + Plotly tabanlı keşif aracı; mevcut statik
siteden bağımsız çalışır (**port 8090**).

- **Kapsam:** 100 indikatör × 6 zaman dilimi = **600 senaryo**; her senaryo için
  filtresiz + 20 tek filtre + 10 kombinasyon = **31 durum**.
- **Filtreler:** BTC yönü/trendi, Korku-Açgözlülük, hacim (1,2×/1,5×), ADX
  (>25 / <20), RSI (<30 / >70), EMA50/200 yönü, ATR bandı, BB sıkışması,
  hafta içi, saat 06–23, funding, BTC korelasyonu, BTC/ETH göreli güç,
  sakin volatilite + 10 kombinasyon.
- **Grafikler:** 600 senaryo haritası (tıklanabilir), 10$ kasa eğrisi (tüm
  dönem + 2025–26), günlük kâr/zarar (aynı grafikte yeşil/kırmızı) + 2025–26,
  yıllık kâr/zarar, kalma süresi dağılımı, mevsimsel/çeyreklik, takvim ısı
  haritası, gün×saat, drawdown, 31 filtre etkisi (ort. % ve toplam $), sembol
  katkısı.
- **KPI şeridi:** toplam işlem, 2026 işlem, ortalama %getiri, maks. düşüş,
  kârlı / zararlı gün sayısı.
- **Kural:** toplam **ve** 2026 ortalama getirisi birlikte negatif olan
  senaryolar listeden çıkarılır.
- **Veri üretimi:** `python tools/bt/prep-525.py` → `fetch_external.py` →
  `node tools/bt/run.mjs --workers=10 --records` → `merge_agg.py` →
  `server.py` (ayrıntı: `tools/dash/README.md`).
- **Not:** Korku/Açgözlülük alternative.me'den tam geçmiş olarak indirilir;
  BTC dominans/likidite için ücretsiz tarihsel veri olmadığından kendi
  verimizden **BTC/ETH göreli güç** ve **BTC oynaklık** proxy'leri kullanılır.

## İçerik düzenleme

Her indikatör `assets/js/data/*.js` içinde bir nesnedir:

```js
{
  id: 'sma', name: 'SMA', full: 'Basit Hareketli Ortalama', cat: 'trend',
  one: '...',          // tek cümlelik özet (≤ ~160 karakter)
  shows: ['...'],      // en az 1 madde: neyi gösterir
  calc: ['SMA = ...'], // formül satır(lar)ı
  calcNote: '...',     // formülle ilgili tek cümle ipucu
  play: [ { t: 'up'|'down'|'sig'|'info', l: '...', x: '...' } ],
  pairs: ['ema', 'rsi'],        // iyi eşleşen indikatörler (id!)
  chart: { scene: 'up', seed: 11, overlay: [{ calc: 'sma', p: 20 }], marks: [...] }
}
```

- Grafik türleri: `overlay` (fiyat üstü), `panel` (alt pencere), `marks`
  (anotasyonlar), `legendExtra` (lejantta özel nokta açıklaması).
- Yeni formül eklemek için `assets/js/engine/formulas.js` içindeki `CALCS`
  kayıt defterine `{ label, fn }` eklenir; `fn`, `{ lines, bars, dots, band }`
  döndürür (`lines`/`bars` içindeki her giriş `{ v: dizi, c: renk }`).
- Backtest tarafında yeni kural eklemek için `tools/bt/strategies.mjs`
  kataloğuna `{ id, title, dir, load, entry }` eklenir; `id` mutlaka
  `assets/js/data/` içindeki indikatör id'siyle aynı olmalıdır
  (`npm run validate` bunu zorlar).
- Değişiklikten sonra mutlaka `npm run validate` çalıştırın.

## Tasarım notları

- Renk dünyası: gece siyahı (#07070b / #0d0c13) + altın (#d9b45b → #f4e3a6),
  cam efektli (glassmorphism) kartlar, ince altın çizgiler.
- Tipografi: başlıklar Playfair Display, metin Manrope (Türkçe karakter tam
  destekli). Fontlar kendinden barındırılır (CDN yok).
- Mobil öncelik: tek elle, başparmakla gezilecek şekilde tasarlandı;
  ≥960px ekranlarda grafik solda, notlar sağda iki kolona açılır.
- Grafik okunurluğu: 720 birimlik SVG sahneler telefonda küçüldüğü için
  eksen/etiket yazıları `@media (max-width: 640px)` ile büyütülür; backtest
  grafikleri dar ekranda daha kompakt bir viewBox (400 birim) ile yeniden
  çizilir, böylece yazılar her ekranda aynı fiziksel boyutta okunur.

## Yasal not

Bu site yalnızca **eğitim** amaçlıdır. İçerikler **yatırım tavsiyesi
değildir**; yatırım kararlarınızı kendi araştırmanıza ve risk profilinize
göre vermelisiniz.
