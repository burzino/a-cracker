import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPricesFile, hasPriceChanges, trimHistory, updateItem } from '../scripts/lib/history.mjs';
import { validateProducts } from '../scripts/lib/products.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = '2026-10-22T10:00:00.000Z';
const LATER = '2026-10-22T16:00:00.000Z';

test('updateItem adds a history point only when the price changes', () => {
  const first = updateItem(undefined, { name: 'A', price: 10, now: NOW });
  assert.deepEqual(first.history, [{ date: NOW, price: 10 }]);

  const same = updateItem(first, { price: 10, now: LATER });
  assert.equal(same.history.length, 1);
  assert.equal(same.checkedAt, LATER);

  const changed = updateItem(same, { price: 8, now: LATER });
  assert.deepEqual(changed.history.at(-1), { date: LATER, price: 8 });
  assert.equal(changed.current, 8);
});

test('updateItem keeps the last known price when a scrape fails', () => {
  const known = updateItem(undefined, { name: 'A', price: 10, now: NOW });
  const failed = updateItem(known, { price: null, error: 'HTTP 503', now: LATER });
  assert.equal(failed.current, 10);
  assert.equal(failed.error, 'HTTP 503');
  assert.equal(failed.history.length, 1);
});

test('trimHistory drops points older than 365 days', () => {
  const now = Date.parse(NOW);
  const history = [
    { date: new Date(now - 400 * DAY).toISOString(), price: 1 },
    { date: new Date(now - 364 * DAY).toISOString(), price: 2 },
  ];
  const trimmed = trimHistory(history, NOW);
  assert.deepEqual(trimmed, [history[1]]);
});

test('trimHistory keeps the last point even when it is outside the window', () => {
  const now = Date.parse(NOW);
  const old = { date: new Date(now - 400 * DAY).toISOString(), price: 1 };
  assert.deepEqual(trimHistory([old], NOW), [old]);
});

test('updateItem keeps min and max when the price has not changed for over a year', () => {
  const old = { date: new Date(Date.parse(NOW) - 400 * DAY).toISOString(), price: 10 };
  const previous = { name: 'A', current: 10, error: null, history: [old] };
  const next = updateItem(previous, { price: 10, now: NOW });
  assert.deepEqual(next.history, [old]);
});

test('hasPriceChanges ignores updatedAt and checkedAt', () => {
  const before = buildPricesFile({
    products: [{ asin: 'NEW0000001', name: 'New' }],
    previous: null,
    results: new Map([['NEW0000001', { price: 12, name: null, error: null }]]),
    now: NOW,
  });
  const after = buildPricesFile({
    products: [{ asin: 'NEW0000001', name: 'New' }],
    previous: before,
    results: new Map([['NEW0000001', { price: 12, name: null, error: null }]]),
    now: LATER,
  });
  assert.equal(hasPriceChanges(before, after), false);
});

test('hasPriceChanges detects price, error, name and list changes', () => {
  const base = { items: { A: { name: 'A', current: 10, error: null, history: [{ date: NOW, price: 10 }] } } };
  const clone = () => structuredClone(base);
  assert.equal(hasPriceChanges(null, base), true);

  const priceChanged = clone();
  priceChanged.items.A.current = 9;
  assert.equal(hasPriceChanges(base, priceChanged), true);

  const errorChanged = clone();
  errorChanged.items.A.error = 'HTTP 503';
  assert.equal(hasPriceChanges(base, errorChanged), true);

  const renamed = clone();
  renamed.items.A.name = 'B';
  assert.equal(hasPriceChanges(base, renamed), true);

  const removed = { items: { B: base.items.A } };
  assert.equal(hasPriceChanges(base, removed), true);
  assert.equal(hasPriceChanges(base, { items: {} }), true);
});

test('buildPricesFile keeps only products still in the list', () => {
  const previous = {
    items: {
      OLD0000001: updateItem(undefined, { name: 'Old', price: 5, now: NOW }),
    },
  };
  const products = [{ asin: 'NEW0000001', name: 'New' }];
  const results = new Map([['NEW0000001', { price: 12, name: null, error: null }]]);

  const file = buildPricesFile({ products, previous, results, now: LATER });

  assert.equal(file.updatedAt, LATER);
  assert.deepEqual(Object.keys(file.items), ['NEW0000001']);
  assert.equal(file.items.NEW0000001.name, 'New');
  assert.equal(file.items.NEW0000001.current, 12);
});

test('buildPricesFile records an error for products without a result', () => {
  const products = [{ asin: 'NEW0000001' }];
  const file = buildPricesFile({ products, previous: null, results: new Map(), now: NOW });
  assert.equal(file.items.NEW0000001.current, null);
  assert.equal(file.items.NEW0000001.error, 'Nessun risultato');
});

test('validateProducts accepts a valid list', () => {
  const products = [{ asin: 'B08N5WRWNW', targetPrice: 49.9 }, { asin: 'B0C1234567' }];
  assert.equal(validateProducts(products), products);
});

test('validateProducts rejects malformed entries', () => {
  assert.throws(() => validateProducts({}), /array/);
  assert.throws(() => validateProducts([{ asin: 'short' }]), /ASIN non valido/);
  assert.throws(
    () => validateProducts([{ asin: 'B08N5WRWNW' }, { asin: 'B08N5WRWNW' }]),
    /duplicato/,
  );
  assert.throws(
    () => validateProducts([{ asin: 'B08N5WRWNW', targetPrice: -1 }]),
    /targetPrice/,
  );
});
