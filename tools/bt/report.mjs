// ==========================================================================
// İndikatör Akademi — Backtest raporu üretici
// Kullanım: node tools/bt/report.mjs   →   BACKTEST-RAPORU.md (proje kökü)
//
// Tüm sayılar assets/bt/*.json çıktılarından okunur; rapor metni sabit
// metodoloji açıklamaları + otomatik tablolardan oluşur.
// ==========================================================================
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const BT = join(ROOT, 'assets/bt');

const { ALL } = await import(pathToFileURL(join(ROOT, 'assets/js/data/index.js')).href);
const { CATEGORIES } = await import(pathToFileURL(join(ROOT, 'assets/js/data/categories.js')).href);

const idx = JSON.parse(await readFile(join(BT, 'index.json'), 'utf8'));
const files = (await readdir(BT)).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
const data = {};
for (const f of files) data[f.replace('.json', '')] = JSON.parse(await readFile(join(BT, f), 'utf8'));

const byId = new Map(ALL.map((a) => [a.id, a]));
const nameOf = (id) => (byId.get(id) || {}).name || id;

/* ------------------------------ biçimleme ------------------------------ */
const int = (v) => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('tr-TR'));
const pct = (v, d = 2) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%');
const pctPlain = (v, d = 1) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d) + '%');
const num = (v, d = 2) => (v == null || !isFinite(v) ? '—' : v.toFixed(d));
const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
const isoD = (d) => d.toISOString().slice(0, 10);

const firstDate = isoD(new Date(idx.grid.start));
const lastDate = isoD(new Date(idx.grid.start + (idx.grid.n - 1) * idx.grid.stepMs));
const tfs = idx.tfs;

/* --------------------------- veri toplama --------------------------- */
let totalTrades = 0;
let posBest = 0;
const rows = []; // { id, name, title, cat, best, s }
for (const [id, d] of Object.entries(data)) {
  const e = idx.ids[id] || {};
  const best = e.best || null;
  const s = best && d.sum[best] ? d.sum[best] : null;
  for (const tf of tfs) if (d.sum[tf]) totalTrades += d.sum[tf].n;
  if (s && s.tot > 0) posBest++;
  rows.push({ id, name: nameOf(id), full: (byId.get(id) || {}).full || '', title: d.title || '', cat: d.cat, best, s });
}
const byCat = (cat) => rows.filter((r) => r.cat === cat).sort((a, b) => (b.s ? b.s.tot : -9) - (a.s ? a.s.tot : -9));
const allSorted = rows.slice().sort((a, b) => (b.s ? b.s.tot : -9) - (a.s ? a.s.tot : -9));
const skipped = rows.filter((r) => (data[r.id].skipTfs || []).length);

// 1w kapsamı: hiçbir indikatörde 1w işlemi olmayan semboller (yetersiz bar)
const covered1w = new Set();
for (const d of Object.values(data)) for (const s of Object.keys((d.heat['1w'] || {}).n || {})) covered1w.add(s);
const excl1w = idx.symbols.filter((s) => !covered1w.has(s));

/* ------------------------------ metin ------------------------------ */
const L = [];
const w = (s = '') => L.push(s);

w('# İndikatör Akademi — Backtest Raporu');
w();
w(`> **Üretim:** ${idx.gen} · **Motor:** ${idx.engine} · **Kapsam:** ${rows.length} indikatör × ${idx.symbols.length} sembol × ${tfs.length} zaman dilimi`);
w('> Bu rapor otomatik üretilir: `node tools/bt/report.mjs` — tüm sayılar `assets/bt/*.json` çıktılarından okunur.');
w();

/* 1 ------------------------------------------------------------------- */
w('## 1. Özet');
w();
w(`- **Dönem:** En eski kontratlar için arşiv **2022-08**'de başlar ve veri **Eylül 2026**'ya kadar sürer; portföy eğrisi **${firstDate} → ${lastDate}** arasını haftalık **${idx.grid.n} noktayla** örnekler. Sonradan listelenen semboller daha kısa geçmişle katkı verir.`);
w(`- **Simüle edilen işlem:** ${int(totalTrades)} adet (100 indikatörün tüm zaman dilimleri toplamı, ham işlem sayısı).`);
w(`- **Maliyetler:** ${idx.costs}.`);
w(`- **En iyi dilimi pozitif olan:** ${posBest}/${rows.length} indikatör.`);
w('- Hiçbir parametre optimizasyonu yapılmadı; her indikatör için tek, mekanik ve öğretilebilir bir kural kullanıldı.');
w();
w('**En yüksek portföy toplam getirisi (en iyi dilim):**');
w();
w('| İndikatör | Dilim | İşlem | Kazanma | İşlem başına | PF | Portföy toplamı |');
w('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const t of allSorted.slice(0, 10)) {
  w(`| ${t.name} | ${t.best} | ${int(t.s.n)} | ${pctPlain(t.s.wr)} | ${pct(t.s.avg)} | ${num(t.s.pf)} | ${pct(t.s.tot)} |`);
}
w();
w('**En zayıf portföy toplam getirisi (en iyi dilim):**');
w();
w('| İndikatör | Dilim | İşlem | Kazanma | İşlem başına | PF | Portföy toplamı |');
w('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const t of allSorted.slice(-5).reverse()) {
  w(`| ${t.name} | ${t.best} | ${int(t.s.n)} | ${pctPlain(t.s.wr)} | ${pct(t.s.avg)} | ${num(t.s.pf)} | ${pct(t.s.tot)} |`);
}
w();

/* 2 ------------------------------------------------------------------- */
w('## 2. Veri kaynağı ve kapsam');
w();
w('- **Kaynak:** Binance USDT-M vadeli işlemler, 1 dakikalık (1m) kline arşivi (yerel `D:\\1mDataBinance`, aylık CSV dosyaları).');
w(`- **Semboller:** ${idx.symbols.length} USDT-M kontratı (tam liste §11). Dönem içinde kotasyon dışı kalan kontratlar veri setinde yoktur — bu bir **hayatta kalma (survivorship) etkisi** yaratabilir.`);
w(`- **Zaman dilimleri:** ${tfs.join(', ')} — 5m'ten 1d'ye arşivdeki hazır kline serileri kullanılır; **1w**, 1d barlarından Pazartesi başlangıçlı haftalara toplanarak türetilir (veri setinin son haftası kısmi olabilir).`);
w('- **Funding:** Binance vadeli funding arşivindeki gerçek olaylar; pozisyonun tutulduğu zaman aralığına düşen oranların toplamı olarak uygulanır (long pozitif oranda öder, short tahsil eder).');
w('- **Isınma:** Strateji, indikatör serisinin ilk geçerli değerinden 2 bar sonra işlem yapmaya başlar (en az 40 bar). Böylece ısınma dönemi işlem üretmez.');
w('- **Veri geçmişi:** arşiv en eski kontratlar için 2022-08\'de başlar (BTCUSDT, ETHUSDT); sonradan listelenen kontratlar (ör. AKEUSDT) yalnızca liste tarihinden sonrasına sahiptir. `tot` (toplam getiri) her sembol için kendi verisinin başlangıcından dönem sonuna kadardır.');
w(`- **1w kapsamı:** 1w'de yeterli geçmişi veya işlemi olmayan kontratlar sonuçlara girmez (bu üretimde ${excl1w.length} kontrat${excl1w.length ? ': ' + excl1w.slice(0, 12).join(', ') + (excl1w.length > 12 ? ' …' : '') : ''}). 60 bardan az haftalık geçmişi olanlar test edilemez; kısa geçmişli diğer kontratlarda da haftalık ısınma penceresi işlem üretmeye yetmeyebilir ve ilgili hücre ısı tablosunda boş kalır.`);
w();

/* 3 ------------------------------------------------------------------- */
w('## 3. Emir, maliyet ve sermaye modeli');
w();
w('- **Sinyal → emir:** Sinyal bar *i* kapanışında üretilir; emir bar *i+1* **açılışında** uygulanır (bakışsızlık / look-ahead yok).');
w('- **Maliyet:** Her bacakta (giriş ve çıkış) taker komisyonu **%0,04** + **1bp kayma**; yani işlem başına maliyet ≈ %0,10 (5bp giriş + 5bp çıkış). Long: çıkış / giriş maliyetli kurlardan; short simetrik.');
w('- **Funding:** Pozisyon açık kaldığı her 8 saatlik funding anı için gerçek oran uygulanır.');
w('- **Kaldıraç yok (1×):** Her sembole ayrılan sermaye tam olarak tek pozisyonda değerlendirilir; sinyalsiz dönemde nakit (faiz yok). Semboller birbirinden bağımsızdır.');
w('- **Stop:** Stop türleri: ATR (izleyen/trailing — her barda en yüksek/dip değere göre güncellenir), NATR, sabit seviye (indikatör çizgisi) veya yüzde. Stop giriş barından itibaren izlenir ama **yalnızca sonraki barlarda** tetiklenir; long\'da `min(açılış, stop)`, short\'ta `max(açılış, stop)` fiyatından gerçekleşir (boşluklu açılışta açılıştan).');
w('- **Ters sinyal (flip):** İki yönlü stratejilerde karşıt sinyal aynı bar açılışında pozisyonu kapatıp yenisini açar.');
w('- **Zaman aşımı:** Bazı stratejilerde `maxBars` süre sınırı vardır; süre dolunca pozisyon kapanır.');
w('- **Tek işlem kaybı** en fazla %99,9 olarak sınırlandırılır (r ≥ −0,999). Dönem sonunda açık pozisyon son kapanıştan kapatılır.');
w();

/* 4 ------------------------------------------------------------------- */
w('## 4. Strateji kataloğu ve test dışı dilimler');
w();
w('Her indikatör için **tek** mekanik yorum vardır: ya "sadece long" (sinyal tersine dönünce nakde geçer) ya "iki yön" (long/short flip). Kuralların tam listesi §10\'dadır.');
w();
if (skipped.length) {
  w('Bazı indikatörler kavramsal olarak anlamsız olduğu için belirli dilimlerde **hiç test edilmedi**:');
  w();
  w('| İndikatör | Test dışı dilimler |');
  w('| --- | --- |');
  for (const r of skipped) w(`| ${r.name} — ${r.title} | ${data[r.id].skipTfs.join(', ')} |`);
  w();
}
w('Ayrıca veri kaynaklı boşluklar olabilir: bir dilimde hiç işlem üremezse özet `null` olur (örnek: Cross 1w).');
w();

/* 5 ------------------------------------------------------------------- */
w('## 5. Metrik sözlüğü');
w();
w('| Alan | Anlamı |');
w('| --- | --- |');
w('| `n` | İşlem sayısı (tüm semboller toplamı, ilgili zaman diliminde) |');
w('| `wr` | Kazanma oranı = kârlı işlem / n |');
w('| `avg` | İşlem başına ortalama getiri (aritmetik ortalama) |');
w('| `sd` | İşlem getirilerinin standart sapması |');
w('| `pf` | Profit factor = brüt kâr / brüt zarar (99 üstü 99\'a kırpılır) |');
w('| `tot` | **Eşit ağırlıklı portföyün toplam getirisi**: eğrinin son değeri − 1 (bileşik) |');
w('| `dd` | Portföy eğrisinin maksimum düşüşü (tepe → dip, negatif) |');
w('| `bars` | Ortalama tutma süresi (bar sayısı) |');
w('| `best` / `worst` | En iyi / en kötü tek işlem getirisi |');
w('| `nsym` | En az 3 işlem yapan sembol sayısı |');
w('| `pos` | Ortalaması pozitif olan sembollerin oranı (nsym içinde) |');
w('| `top` / `bot` | Sembol bazında en iyi / en kötü **ortalama işlem getirisi** olan sembol |');
w('| `hist` | Tüm işlem getirilerinin dağılımı: 82 kova (−10%…+10% arası 0,25\'lik 80 kova + alt/üst taşma) |');
w('| `heat` | Sembol × dilim tablosu; metrikler: `avg`, `wr`, `n`, `dd`, `pf`, `bh` |');
w('| `bh` | Al-tut getirisi: sembolün son kapanışı / ilk kapanışı − 1 |');
w('| `years` | `[portföy yıllık getirisi, o yıl kazanma oranı, işlem sayısı]` |');
w();
w('**Not:** Ortalama işlem getirisi ile toplam portföy getirisi farklı şeylerdir; yeni listelenen coinlerin uç işlemleri ortalamayı saptırabildiği için medyan > ortalama olabilir (§12).');
w();

/* 6 ------------------------------------------------------------------- */
w('## 6. Portföy eğrisi ve "en iyi dilim" kuralı');
w();
w('- Her sembole başlangıçta **1 birim** sermaye verilir; sembolün eğrisi işlem getirileriyle sırayla bileşiklenir.');
w(`- **Portföy eğrisi** = o hafta verisi olan sembollerin eğri değerlerinin **ortalaması** (haftalık ${idx.grid.n} nokta).`);
w('- Dönem içinde **yeniden dengeleme yoktur**; kazanan semboller portföyde doğal olarak büyür (eşit ağırlıklı al-tut mantığı).');
w('- Yıllık getiri, portföy eğrisinden yıl sonu / önceki yıl sonu − 1 olarak hesaplanır. 2022 yılı ızgara Ağustos\'ta başladığı için **2022 (Ağu–Ara)**, son yıl ise **kısmi** dönemdir.');
w('- **En iyi dilim kuralı:** Önce uygunluk kademesi (n ≥ 100 → n ≥ 30 → diğer), eşitlikte **en yüksek portföy toplam getirisi** (`tot`). Böylece hem istatistiksel olarak güvenilir hem de gerçekten kazandıran dilim seçilir.');
w();

/* 7 ------------------------------------------------------------------- */
w('## 7. Sonuçlar — en iyi dilim (100 indikatör)');
w();
for (const cat of CATEGORIES) {
  const list = byCat(cat.id);
  if (!list.length) continue;
  w(`### ${cat.name} (${list.length} indikatör)`);
  w();
  w('| İndikatör | Strateji | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı | Poz. sembol |');
  w('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const r of list) {
    w(`| ${r.name} | ${esc(r.title)} | ${r.best} | ${int(r.s.n)} | ${pctPlain(r.s.wr)} | ${pct(r.s.avg)} | ${num(r.s.pf)} | ${pctPlain(r.s.dd)} | **${pct(r.s.tot)}** | ${pctPlain(r.s.pos, 0)} |`);
  }
  w();
}

/* 8 ------------------------------------------------------------------- */
w('## 8. Yıllık portföy getirileri (en iyi dilim)');
w();
w('Yıllar: 2022 = Ağu–Ara (kısmi), 2026 = Oca–8 Eyl (kısmi). Değerler portföy eğrisinden; işlem sayıları o yıl kapanan işlemlerdir.');
w();
w('| İndikatör | 2022* | 2023 | 2024 | 2025 | 2026* |');
w('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const r of allSorted) {
  const y = (data[r.id].years || {})[r.best] || {};
  const ys = Object.keys(y).sort();
  const cells = ['2022', '2023', '2024', '2025', '2026'].map((k) => (y[k] ? pct(y[k][0], 1) : '—'));
  if (!ys.length) continue;
  w(`| ${r.name} | ${cells.join(' | ')} |`);
}
w();

/* 9 ------------------------------------------------------------------- */
w('## 9. Tüm zaman dilimi sonuçları (tam tablo)');
w();
w('100 indikatör × 6 dilim; `null` (test dışı / işlemsiz) dilimler atlanmıştır. Sıralama: indikatör adı.');
w();
w('| İndikatör | Dilim | İşlem | Kazanma | İşlem başına | PF | Mak. düşüş | Portföy toplamı |');
w('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const r of rows.slice().sort((a, b) => a.name.localeCompare(b.name, 'tr'))) {
  for (const tf of tfs) {
    const s = data[r.id].sum[tf];
    if (!s) continue;
    w(`| ${r.name} | ${tf} | ${int(s.n)} | ${pctPlain(s.wr)} | ${pct(s.avg)} | ${num(s.pf)} | ${pctPlain(s.dd)} | ${pct(s.tot)} |`);
  }
}
w();

/* 10 ------------------------------------------------------------------ */
w('## 10. İndikatör başına strateji kuralları');
w();
w('Her indikatörün raporda kullanılan **tek** mekanik stratejisi. "Test dışı" satırı, o indikatörün kavramsal olarak anlamsız olduğu için hiç koşulmadığı dilimleri gösterir.');
w();
for (const cat of CATEGORIES) {
  const list = ALL.filter((a) => a.cat === cat.id);
  if (!list.length) continue;
  w(`### ${cat.name}`);
  w();
  for (const a of list) {
    const d = data[a.id];
    if (!d) continue;
    w(`**${a.name} — ${esc(d.title)}**`);
    w(`- Yön: ${d.dir === 'long' ? 'Sadece long (sinyalsizken nakit)' : 'İki yön (long/short flip)'}`);
    (d.rules || []).forEach((r) => w(`- ${esc(r)}`));
    w(`- Stop: ${esc(d.stopText || 'Yok (ters sinyal)')}`);
    if ((d.skipTfs || []).length) w(`- Test dışı dilimler: ${d.skipTfs.join(', ')}`);
    if (d.caveat) w(`- Not: ${esc(d.caveat)}`);
    w();
  }
}

/* 11 ------------------------------------------------------------------ */
w('## 11. Sembol listesi (' + idx.symbols.length + ')');
w();
w('```');
for (let i = 0; i < idx.symbols.length; i += 8) w(idx.symbols.slice(i, i + 8).join(', '));
w('```');
w();

/* 12 ------------------------------------------------------------------ */
w('## 12. Sınırlar ve varsayımlar');
w();
w('- Emir defteri derinliği, kısmi dolum ve likidite şokları modellenmez; kayma sabit 1bp varsayılır. Gerçek kayma, özellikle düşük likiditeli altcoinlerde daha yüksek olur.');
w('- Marj/limit koşulları ve tasfiye yoktur (1× kaldıraç).');
w(`- Veri setindeki ${idx.symbols.length} güncel kontrat kapsanır; dönem içinde delist olan kontratlar dahil değildir (hayatta kalma etkisi).`);
w('- Yeni listelenen coinlerin ilk mumları ve düşük likidite dönemleri **gerçek** ama uç sonuçlar üretir (ör. ilk saatlerde ±%1000 barlar). Bu yüzden birçok indikatörde medyan işlem getirisi ortalamadan daha iyidir; dağılım grafikleri ve medyan çizgisi bu nedenle panoda vurgulanır.');
w('- 1w diliminde bar sayısı azdır (dönem ≈ 4 yıl / ~210 hafta); bu dilimin istatistikleri diğerlerine göre daha gürültülüdür. Ayrıca yeni listelenen kontratlarda haftalık ısınma penceresi işlem üretmeye yetmeyebilir; bu hücreler ısı tablosunda boş görünür ve ilgili zaman diliminin toplamlarına katkı vermez (sıfır işlemli semboller ortalama ve dağılım dışında bırakılır).');
w('- Sonuçlar geçmiş veriye dayanır; **gelecek getiriyi garanti etmez ve yatırım tavsiyesi değildir**.');
w();

/* 13 ------------------------------------------------------------------ */
w('## 13. Yeniden üretim');
w();
w('```bash');
w('python tools/bt/prep-525.py  # 1m arşivinden 525 sembollük veri seti üretir (bt525)');
w('node tools/bt/run.mjs        # tüm backtestleri yeniden üretir (tüm semboller, 10 işçi)');
w('node tools/bt/report.mjs     # bu raporu yeniden oluşturur');
w('npm run validate           # içerik + katalog + çıktı doğrulaması');
w('npm run bt:qa              # pano uçtan uca testi (45 kontrol)');
w('```');
w();
w('---');
w();
w('*İndikatör Akademi — Backtest Raporu · ' + idx.gen + ' · Eğitim amaçlıdır; yatırım tavsiyesi değildir.*');
w();

await writeFile(join(ROOT, 'BACKTEST-RAPORU.md'), L.join('\n'), 'utf8');
console.log(`[rapor] BACKTEST-RAPORU.md yazıldı — ${L.length} satır, ${rows.length} indikatör, ${int(totalTrades)} işlem`);
