// Az alkalmazásikonok előállítása a játék saját logórajzoló kódjából.
// Futtatás: npm run icons  (utána: npx tauri icon scripts/icon-source.png)
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5199/launcher.html');

const render = (size, pad, round, splash) => page.evaluate(async ({ size, pad, round, splash }) => {
  const { drawLogo } = await import('/src/render/TextureFactory.ts');
  const c = document.createElement('canvas');
  c.width = splash ? splash.w : size; c.height = splash ? splash.h : size;
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#22304a'); g.addColorStop(1, '#0d1118');
  ctx.fillStyle = g;
  if (round) { ctx.beginPath(); ctx.roundRect(0, 0, w, h, size * 0.2); ctx.fill(); } else ctx.fillRect(0, 0, w, h);
  drawLogo(ctx, w / 2, h / 2, size * (1 - pad * 2));
  return c.toDataURL('image/png');
}, { size, pad, round, splash });

const save = async (file, ...args) => {
  const url = await render(...args);
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('✓', file);
};

await save('scripts/icon-source.png', 1024, 0.08, true);
await save('public/icons/icon-192.png', 192, 0.06, false);
await save('public/icons/icon-512.png', 512, 0.06, false);
await save('public/icons/icon-maskable-512.png', 512, 0.18, false);
await save('public/icons/apple-touch-icon.png', 180, 0.06, false);
await save('public/icons/favicon-32.png', 32, 0.02, true);
await save('public/icons/splash.png', 420, 0.1, false, { w: 1170, h: 2532 });

await browser.close();
await server.close();
