// Google Fonts'tan Playfair Display + Manrope woff2 dosyalarını indirir,
// CSS'i yerel yollara çevirip assets/css/fonts.css olarak kaydeder.
// Kullanım: node tools/fetch-fonts.mjs   (bir kez çalıştırılır; internet gerekir)
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FONT_DIR = resolve(ROOT, 'assets/fonts');
const CSS_OUT = resolve(ROOT, 'assets/css/fonts.css');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const GF_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Manrope:wght@300..800' +
  '&family=Playfair+Display:ital,wght@0,500..800;1,500..700' +
  '&display=swap';

const SUBSETS = new Set(['latin', 'latin-ext']); // Türkçe karakterler latin-ext içinde

async function main() {
  await mkdir(FONT_DIR, { recursive: true });
  await mkdir(resolve(ROOT, 'assets/css'), { recursive: true });
  console.log('Google Fonts CSS indiriliyor…');
  const cssRes = await fetch(GF_URL, { headers: { 'User-Agent': UA } });
  if (!cssRes.ok) throw new Error('CSS alınamadı: HTTP ' + cssRes.status);
  const css = await cssRes.text();

  // @font-face bloklarını subset yorumlarıyla birlikte ayrıştır
  const blocks = css.split(/\/\*\s*([a-z0-9-\[\]]+)\s*\*\//i).slice(1); // [subset, block, subset, block...]
  const kept = [];
  let idx = 0;
  for (let i = 0; i < blocks.length - 1; i += 2) {
    const subset = blocks[i].trim();
    const block = blocks[i + 1];
    if (!SUBSETS.has(subset)) continue;
    const urlMatch = block.match(/url\((https:[^)]+\.woff2)\)/);
    if (!urlMatch) continue;
    idx += 1;
    const fileName = `font-${String(idx).padStart(2, '0')}.woff2`;
    console.log(`  ↓ ${subset} → ${fileName}`);
    const fontRes = await fetch(urlMatch[1], { headers: { 'User-Agent': UA } });
    if (!fontRes.ok) throw new Error('Font alınamadı: ' + urlMatch[1]);
    await writeFile(resolve(FONT_DIR, fileName), Buffer.from(await fontRes.arrayBuffer()));
    kept.push(block.replace(urlMatch[1], `../fonts/${fileName}`));
  }

  await mkdir(FONT_DIR, { recursive: true });
  await writeFile(
    CSS_OUT,
    '/* Otomatik üretildi: tools/fetch-fonts.mjs */\n' + kept.map((b) => b.trim()).join('\n') + '\n',
    'utf8'
  );
  console.log(`Tamam: ${kept.length} font dosyası → assets/fonts/, CSS → assets/css/fonts.css`);
}

main().catch((err) => {
  console.error('Font indirme başarısız:', err.message);
  console.error('Sorun değil: uygulama sistem fontlarıyla çalışır. Sonra tekrar denemek istersen bu komutu çalıştır.');
  process.exitCode = 1;
});
