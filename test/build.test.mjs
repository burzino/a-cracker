import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('npm run build produces the deployable site in dist/', () => {
  execSync('npm run build', { cwd: ROOT, stdio: 'pipe', shell: true, timeout: 180_000 });

  const expected = [
    'index.html',
    'sw.js',
    'firebase-messaging-sw.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'data/prices.json',
  ];
  for (const file of expected) {
    assert.ok(existsSync(join(ROOT, 'dist', file)), `dist/${file} mancante`);
  }
});

test('the plain access password does not appear in dist/assets/ after build', () => {
  const assetsDir = join(ROOT, 'dist', 'assets');
  const files = readdirSync(assetsDir);
  assert.ok(files.length > 0, 'dist/assets vuoto');
  const offenders = files.filter((name) =>
    readFileSync(join(assetsDir, name), 'utf8').toLowerCase().includes('paperino'),
  );
  assert.deepEqual(offenders, []);
});
