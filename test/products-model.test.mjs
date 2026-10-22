import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPricesFile, updateItem } from '../scripts/lib/history.mjs';
import { isActive, isIsoDate, productsFromDocuments, validateProducts } from '../scripts/lib/products.mjs';

const NOW = '2026-10-22T10:00:00.000Z';
const LATER = '2026-10-22T16:00:00.000Z';

test('validateProducts accepts addedAt, archivedAt (ISO or null) and name', () => {
  const products = [
    { asin: 'B08N5WRWNW', name: 'Cuffie', targetPrice: 49.9, addedAt: NOW, archivedAt: null },
    { asin: 'B0C1234567', addedAt: NOW, archivedAt: LATER },
  ];
  assert.equal(validateProducts(products), products);
});

test('validateProducts rejects a non ISO addedAt or archivedAt', () => {
  assert.throws(() => validateProducts([{ asin: 'B08N5WRWNW', addedAt: '22/10/2026' }]), /addedAt/);
  assert.throws(() => validateProducts([{ asin: 'B08N5WRWNW', addedAt: 'ieri' }]), /addedAt/);
  assert.throws(() => validateProducts([{ asin: 'B08N5WRWNW', archivedAt: 'ora' }]), /archivedAt/);
  assert.throws(() => validateProducts([{ asin: 'B08N5WRWNW', name: 42 }]), /name/);
});

test('isIsoDate accepts ISO timestamps only', () => {
  assert.equal(isIsoDate(NOW), true);
  assert.equal(isIsoDate('2026-10-22T10:00:00+02:00'), true);
  assert.equal(isIsoDate('2026-10-22'), false);
  assert.equal(isIsoDate('2026-13-45T10:00:00Z'), false);
  assert.equal(isIsoDate(undefined), false);
});

test('a product is active when archivedAt is absent or null', () => {
  assert.equal(isActive({ asin: 'B08N5WRWNW' }), true);
  assert.equal(isActive({ asin: 'B08N5WRWNW', archivedAt: null }), true);
  assert.equal(isActive({ asin: 'B08N5WRWNW', archivedAt: LATER }), false);
});

test('buildPricesFile does not fetch archived products but keeps their stored entry', () => {
  const previous = {
    updatedAt: NOW,
    items: {
      B08N5WRWNW: updateItem(undefined, { name: 'Archiviato', price: 30, now: NOW }),
    },
  };
  const products = [{ asin: 'B08N5WRWNW', archivedAt: LATER }];
  const file = buildPricesFile({ products, previous, results: new Map(), now: LATER });
  assert.deepEqual(file.items.B08N5WRWNW, previous.items.B08N5WRWNW);
});

test('buildPricesFile does not invent an entry for an archived product without history', () => {
  const products = [{ asin: 'B08N5WRWNW', archivedAt: LATER }];
  const file = buildPricesFile({ products, previous: null, results: new Map(), now: LATER });
  assert.deepEqual(file.items, {});
});

test('productsFromDocuments validates the Firestore documents of the products collection', () => {
  const documents = [
    { id: 'B08N5WRWNW', data: { asin: 'B08N5WRWNW', targetPrice: 49.9, addedAt: NOW, archivedAt: null } },
    { id: 'B0C1234567', data: { asin: 'B0C1234567', addedAt: NOW, archivedAt: LATER } },
  ];
  const products = productsFromDocuments(documents);
  assert.deepEqual(products.map((p) => p.asin), ['B08N5WRWNW', 'B0C1234567']);
  assert.deepEqual(productsFromDocuments([]), []);
});

test('productsFromDocuments rejects a document whose asin differs from its id', () => {
  assert.throws(
    () => productsFromDocuments([{ id: 'B08N5WRWNW', data: { asin: 'B0C1234567', addedAt: NOW } }]),
    /non corrisponde/,
  );
});

test('productsFromDocuments rejects an invalid document', () => {
  assert.throws(
    () => productsFromDocuments([{ id: 'B08N5WRWNW', data: { asin: 'B08N5WRWNW', addedAt: 'ieri' } }]),
    /addedAt/,
  );
});
