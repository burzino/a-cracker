import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeProducts,
  addProduct,
  archivedProducts,
  archiveProduct,
  describeFirestoreError,
  parseTargetPrice,
  restoreProduct,
} from '../src/lib/product-list.js';

const NOW = '2026-10-22T10:00:00.000Z';
const LATER = '2026-10-22T11:00:00.000Z';

test('addProduct appends an active product with addedAt and an optional target', () => {
  const list = addProduct([], { asin: 'b08n5wrwnw', targetPrice: 49.9, now: NOW });
  assert.deepEqual(list, [{ asin: 'B08N5WRWNW', addedAt: NOW, archivedAt: null, targetPrice: 49.9 }]);

  const noTarget = addProduct([], { asin: 'B0C1234567', now: NOW });
  assert.equal('targetPrice' in noTarget[0], false);
});

test('addProduct does not mutate the list it receives', () => {
  const list = [];
  addProduct(list, { asin: 'B08N5WRWNW', now: NOW });
  assert.equal(list.length, 0);
});

test('addProduct rejects invalid ASINs and duplicates', () => {
  assert.throws(() => addProduct([], { asin: 'corto', now: NOW }), /ASIN non valido/);
  const list = addProduct([], { asin: 'B08N5WRWNW', now: NOW });
  assert.throws(() => addProduct(list, { asin: 'B08N5WRWNW', now: LATER }), /già tracciato/);
});

test('addProduct points an archived duplicate to the archive instead of adding it twice', () => {
  const archived = archiveProduct(addProduct([], { asin: 'B08N5WRWNW', now: NOW }), 'B08N5WRWNW', LATER);
  assert.throws(() => addProduct(archived, { asin: 'B08N5WRWNW', now: LATER }), /archivio/);
});

test('archiveProduct and restoreProduct keep the product in the list', () => {
  const list = addProduct([], { asin: 'B08N5WRWNW', now: NOW });
  const archived = archiveProduct(list, 'B08N5WRWNW', LATER);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].archivedAt, LATER);
  assert.equal(list[0].archivedAt, null);

  const restored = restoreProduct(archived, 'B08N5WRWNW');
  assert.equal(restored[0].archivedAt, null);
});

test('archiveProduct rejects an unknown ASIN', () => {
  assert.throws(() => archiveProduct([], 'B08N5WRWNW', LATER), /non trovato/);
});

test('activeProducts and archivedProducts split the list', () => {
  let list = addProduct([], { asin: 'B08N5WRWNW', now: NOW });
  list = addProduct(list, { asin: 'B0C1234567', now: NOW });
  list = archiveProduct(list, 'B0C1234567', LATER);
  assert.deepEqual(activeProducts(list).map((p) => p.asin), ['B08N5WRWNW']);
  assert.deepEqual(archivedProducts(list).map((p) => p.asin), ['B0C1234567']);
});

test('parseTargetPrice accepts Italian and dot decimals and treats empty input as no target', () => {
  assert.equal(parseTargetPrice('49,90'), 49.9);
  assert.equal(parseTargetPrice('49.90'), 49.9);
  assert.equal(parseTargetPrice(''), undefined);
  assert.throws(() => parseTargetPrice('abc'), /numero maggiore di zero/);
  assert.throws(() => parseTargetPrice('0'), /numero maggiore di zero/);
});

test('describeFirestoreError gives a clear Italian message for the common Firestore codes', () => {
  assert.match(describeFirestoreError({ code: 'permission-denied' }), /regole/);
  assert.match(describeFirestoreError({ code: 'unavailable' }), /Connessione/);
  assert.match(describeFirestoreError({ code: 'weird' }), /weird/);
  assert.equal(
    describeFirestoreError(new Error('Firebase non configurato in questa build')),
    'Firebase non configurato in questa build',
  );
});
