# Singular-Backtest — İndikatör Akademi

Bu klasör, İndikatör Akademi'nin 100 indikatör × 6 zaman dilimi × 31 filtre
laboratuvarının **tekil işlem** (Singular-Backtest) varyantını üretir. Mevcut
`tools/dash/` ve `assets/bt/` çıktılarına dokunulmaz; tüm yeni dosyalar bu
klasörde tutulur.

## Kural

Seçilen kapsamda (varsayılan: **indikatör**) aynı coinde aynı anda **en fazla bir
açık işlem** bulunabilir. Önceki işlem kapanmadan gelen yeni giriş sinyali bloke
edilir. Aynı giriş anında öncelik: kısa zaman dilimi önce
(`5m > 15m > 1h > 4h > 1d > 1w`), sonra doğal akış sırası.

Motor her senaryo (`id + TF`) içinde zaten tek pozisyon tutar. Bu yüzden
senaryo düzeyinde tekil kural normal sonuçla birebir aynıdır (`--scope=state`
bir no-op'tur). Anlamlı tekillik, **aynı indikatörün 6 zaman diliminin** aynı
coinde üst üste pozisyon açtığı durumdur.

| Kapsam | Anlam | Durum |
|---|---|---|
| `indicator` (varsayılan) | Aynı indikatör, tüm TF ve coinde tek pozisyon | Bu koşuda üretildi |
| `state` | Senaryo (`id + TF`) başına tek pozisyon | Normal ile aynı (no-op) |
| `portfolio` | Tüm portföyde coin başına tek işlem | Farklı bir geçiş gerektirir |

## Sonuçlar (indicator kapsamı, 525 sembol, 600 senaryo, 31 filtre)

| Metrik | Normal | Singular | Fark |
|---|---|---|---|
| İşlem | 1.053.489.499 | 652.125.244 | −401.364.255 (%38,10 bloke) |
| Ortalama getiri | −0,0894% | −0,1083% | −0,0189 puan |
| Kasa (10$ günlük) | −9.421.521$ | −7.062.804$ | +2.358.717$ |

17.870 senaryo × filtre satırının tamamı `singular_results.json` içinde
normal ve tekil metrikleriyle birlikte yer alır; 100 indikatör özeti ve 51.995
indikatör × coin kırılımı (filtre 0) ayrıca eklenir. Tekil kural işlemlerin
%38,1'ini keser; kalan işlemlerin ortalama getirisi bir miktar düşer
(−0,019 puan), ancak toplam zarar ~%25 azalır.

Kapsam dışı kalanlar: 1w verisi 60 bardan kısa olan semboller (çoğunlukla yeni
coinler) ve veri klasörü bulunmayan 5 sembol; normal sayım doğrulaması yine de
0 uyuşmazlık verir (bin'lerde de bu sembollerin işlemi yok).

> **Yorum:** 5m akışı en sık olduğu için tekil taramada pozisyonu genellikle o
> açar. Bloke oranı 5m'de %13,3 iken 15m ve üzerinde %91–94'e çıkar; yani kural
> pratikte çoğu indikatör için "aynı coinde önce 5m sinyali varsa dur" etkisi
> yapar. Bu, tek pozisyon kuralının doğal sonucudur; kapsam `state` seçilirse
> normal sonuç elde edilir.

## Yöntem

- **Normal metrikler** `tools/dash/data/agg/{scenario}.bin` dosyalarından
  birebir okunur. Formüller dashboard ile aynıdır: `retAll = sumR / n × 100`,
  `ret2026` 2026 çıkış günlerinin net/count oranı, kâr/zarar günleri günlük
  net işaretine göre, `winHoldH = winBars / wins / 60`.
- **Singular metrikler** aynı motorla (`tools/bt/sim.mjs`) yeniden üretilir.
  Her sembol için 6 TF serisi yüklenir; her indikatörün 6 akışı giriş zamanına
  göre birleştirilir; 31 filtrenin her biri kendi "son çıkış" durumunu tutar.
- Filtre maskeleri `tools/bt/dashagg.mjs` `buildMask` ile giriş barında
  hesaplanır; normal koşuyla aynı 17 özellik kullanılır.
- Veri katmanı `loader.mjs`: BigPlan binary önbelleği
  (`D:/BigPlan/cache/series`, `IA_SINGULAR_CACHE` ile değiştirilebilir) varsa
  okur, yoksa CSV'den üretip önbelleğe yazar. Sembol listesi
  `tools/dash/data/scenarios.json` ile birebir aynıdır (525).

## Dosyalar

- `run_singular.mjs` — ana koşucu (8 işçi, sembol blokları).
- `worker_singular.mjs` — işçi: simülasyon + filtre maskesi + tekil tarama.
- `loader.mjs` — io.mjs sözleşmeli hızlı veri katmanı.
- `verify_singular.mjs` — normal metrikleri `allinone.json`, işlem sayılarını
  bin'ler, tekil muhasebeyi ve toplamları doğrular.
- `results/singular_results.json` — dashboard payload'ı.
- `results/singular_rows.csv` — 17.870 senaryo × filtre satırı.
- `results/singular_coins.csv` — indikatör × coin kırılımı (filtre 0).
- `results/run_manifest.json`, `run.log`, `verify.log`.

## Kullanım

```bash
node Singular-Backtest/run_singular.mjs --workers=8
node Singular-Backtest/run_singular.mjs --symbols=10 --workers=4   # hızlı test
node Singular-Backtest/run_singular.mjs --scope=state              # no-op kontrolü
node Singular-Backtest/verify_singular.mjs
```

Tam koşu 8 işçiyle ~22 dakika sürer (525 sembol; bu makinede 1.303 s). Normal
metrikler bin'lerden geldiği için simülasyon yalnızca singular tarafta çalışır.
