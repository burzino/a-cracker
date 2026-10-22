import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASSWORD_SHA256 } from '../src/lib/gate.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAIN = 'paperino';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test('the password hash in src/lib matches SHA-256 of the access password', () => {
  const expected = createHash('sha256').update(PLAIN, 'utf8').digest('hex');
  assert.equal(PASSWORD_SHA256, expected);
});

test('the plain password does not appear anywhere in src/', () => {
  const offenders = walk(join(ROOT, 'src')).filter((file) =>
    readFileSync(file, 'utf8').toLowerCase().includes(PLAIN),
  );
  assert.deepEqual(offenders, []);
});
