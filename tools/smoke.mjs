// İndikatör Akademi — duman testi: sunucuyu kısa süreliğine başlatır,
// kritik dosyaların 200 döndüğünü doğrular ve kapatır.
// Kullanım: node tools/smoke.mjs   (PORT env ile port değiştirilebilir)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 4199);
const BASE = `http://localhost:${PORT}`;

const PATHS = [
  '/',
  '/manifest.webmanifest',
  '/assets/img/icon.svg',
  '/assets/img/icon-maskable.svg',
  '/assets/css/main.css',
  '/assets/css/fonts.css',
  '/assets/js/app.js',
  '/assets/js/data/index.js',
  '/assets/js/engine/charts.js',
  '/assets/js/engine/formulas.js',
  '/assets/js/engine/synth.js',
  '/assets/js/engine/scenes.js',
  '/assets/js/engine/btcharts.js',
  '/assets/fonts/font-01.woff2',
  '/assets/fonts/font-06.woff2',
];

// Backtest çıktıları koşu sonrası oluşur; yoksa duman testi başarısız sayılmaz.
const OPTIONAL_PATHS = ['/assets/bt/index.json', '/assets/bt/sma.json', '/assets/bt/rsi.json'];

const server = spawn(process.execPath, ['tools/serve.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await wait(700);
  let fails = 0;
  for (const p of PATHS) {
    const res = await fetch(BASE + p).catch(() => null);
    const ok = !!res && res.status === 200;
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'}  ${res ? res.status : 'İSTEK HATASI'}  ${p}`);
  }
  for (const p of OPTIONAL_PATHS) {
    const res = await fetch(BASE + p).catch(() => null);
    const ok = !!res && res.status === 200;
    console.log(`${ok ? '✓' : '·'}  ${res ? res.status : 'YOK'}  ${p}${ok ? '' : ' (opsiyonel)'}`);
  }
  console.log(fails ? `\n${fails} sorun bulundu.` : '\nDuman testi geçti.');
  process.exitCode = fails ? 1 : 0;
} finally {
  server.kill();
}
