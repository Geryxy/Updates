import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

/**
 * A build végén a service worker megkapja a teljes fájllistát, így az első
 * betöltés után a játék internetkapcsolat nélkül is elindul.
 */
function precacheManifest(): Plugin {
  return {
    name: 'kod-koronaja-precache',
    apply: 'build',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push(relative(dist, full).split('\\').join('/'));
        }
      };
      walk(dist);
      const list = files.filter(f => f !== 'sw.js' && f !== 'launcher.html' && !f.endsWith('.map'));
      const swPath = join(dist, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace('"__PRECACHE__"', JSON.stringify(['./', ...list.map(f => `./${f}`)]))
        .replace('__VERSION__', `${pkg.version}-${Date.now().toString(36)}`);
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: { port: 5173, strictPort: true, host: true },
  build: {
    target: ['es2020', 'safari14'],
    chunkSizeWarningLimit: 2500,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), launcher: resolve(__dirname, 'launcher.html') } },
  },
  plugins: [precacheManifest()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
