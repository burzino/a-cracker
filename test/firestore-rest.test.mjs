import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeValue, documentsToProducts, fetchPublicProducts } from '../scripts/lib/firestore-rest.mjs';

const doc = (asin, fields) => ({
  name: `projects/p/databases/(default)/documents/products/${asin}`,
  fields,
});

test('decodeValue converts the Firestore REST value types', () => {
  assert.equal(decodeValue({ stringValue: 'x' }), 'x');
  assert.equal(decodeValue({ nullValue: null }), null);
  assert.equal(decodeValue({ booleanValue: true }), true);
  assert.equal(decodeValue({ integerValue: '42' }), 42);
  assert.equal(decodeValue({ doubleValue: 49.9 }), 49.9);
  assert.equal(decodeValue({ timestampValue: '2026-10-22T10:00:00Z' }), '2026-10-22T10:00:00Z');
  assert.deepEqual(decodeValue({ mapValue: { fields: { a: { stringValue: 'b' } } } }), { a: 'b' });
  assert.deepEqual(decodeValue({ arrayValue: { values: [{ integerValue: '1' }] } }), [1]);
});

test('decodeValue throws on an unsupported type instead of dropping the field', () => {
  assert.throws(() => decodeValue({ geoPointValue: { latitude: 1, longitude: 2 } }), /non supportato/);
});

test('documentsToProducts builds the validated list, with the id taken from the document name', () => {
  const products = documentsToProducts([
    doc('B08N5WRWNW', {
      asin: { stringValue: 'B08N5WRWNW' },
      targetPrice: { doubleValue: 49.9 },
      addedAt: { stringValue: '2026-10-22T10:00:00.000Z' },
      archivedAt: { nullValue: null },
    }),
  ]);
  assert.deepEqual(products, [
    { asin: 'B08N5WRWNW', targetPrice: 49.9, addedAt: '2026-10-22T10:00:00.000Z', archivedAt: null },
  ]);
});

test('documentsToProducts rejects a document whose asin differs from its id', () => {
  assert.throws(
    () => documentsToProducts([doc('B08N5WRWNW', { asin: { stringValue: 'B00000000X' } })]),
    /non corrisponde all'id/,
  );
});

test('fetchPublicProducts follows nextPageToken and reads every page', async () => {
  const requested = [];
  const pages = [
    { documents: [doc('B08N5WRWNW', { asin: { stringValue: 'B08N5WRWNW' } })], nextPageToken: 'next' },
    { documents: [doc('B00000000X', { asin: { stringValue: 'B00000000X' } })] },
  ];
  const fakeFetch = async (url) => {
    requested.push(new URL(url));
    const body = pages[requested.length - 1];
    return { ok: true, json: async () => body };
  };
  const products = await fetchPublicProducts('my-project', { fetchImpl: fakeFetch });

  assert.deepEqual(
    products.map((p) => p.asin),
    ['B08N5WRWNW', 'B00000000X'],
  );
  assert.equal(requested[0].pathname, '/v1/projects/my-project/databases/(default)/documents/products');
  assert.equal(requested[0].searchParams.get('pageToken'), null);
  assert.equal(requested[1].searchParams.get('pageToken'), 'next');
});

test('fetchPublicProducts returns an empty list for an empty collection', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({}) });
  assert.deepEqual(await fetchPublicProducts('my-project', { fetchImpl: fakeFetch }), []);
});

test('fetchPublicProducts throws on an HTTP error with the status only', async () => {
  const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'secret body' }) });
  await assert.rejects(
    fetchPublicProducts('my-project', { fetchImpl: fakeFetch }),
    (err) => {
      assert.match(err.message, /HTTP 403/);
      assert.doesNotMatch(err.message, /secret body/);
      return true;
    },
  );
});
