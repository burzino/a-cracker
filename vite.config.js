import { cpSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(ROOT, 'dist');

// The price data lives in data/ at the repo root (written by the update job), not in public/.
// Copy it into the build output after Vite has written the bundle.
function copyPriceData() {
  return {
    name: 'copy-price-data',
    apply: 'build',
    closeBundle() {
      cpSync(resolve(ROOT, 'data'), resolve(OUT_DIR, 'data'), { recursive: true });
    },
  };
}

export default defineConfig({
  root: resolve(ROOT, 'src'),
  // Relative base: the site is served from https://<user>.github.io/<repo>/, not from the domain root.
  base: './',
  publicDir: resolve(ROOT, 'public'),
  plugins: [svelte(), copyPriceData()],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
  },
});
