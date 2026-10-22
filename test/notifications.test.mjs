import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationMessage, detectPriceChanges } from '../scripts/lib/notifications.mjs';
import { parseServiceAccount } from '../scripts/lib/firebase-admin.mjs';

const NOW = '2026-10-22T10:00:00.000Z';
const LATER = '2026-10-22T11:00:00.000Z';
const active = { asin: 'B08N5WRWNW', name: 'Cuffie' };

const file = (current, name = 'Cuffie XY') => ({
  updatedAt: NOW,
  items: { B08N5WRWNW: { name, currency: 'EUR', current, checkedAt: NOW, error: null, history: [] } },
});

test('detectPriceChanges reports a change between two known prices', () => {
  const changes = detectPriceChanges(file(59.99), file(49.9), [active]);
  assert.deepEqual(changes, [{ asin: 'B08N5WRWNW', name: 'Cuffie XY', from: 59.99, to: 49.9 }]);
});

test('detectPriceChanges ignores an unchanged price', () => {
  assert.deepEqual(detectPriceChanges(file(59.99), file(59.99), [active]), []);
});

test('detectPriceChanges does not notify the first detection', () => {
  assert.deepEqual(detectPriceChanges(null, file(49.9), [active]), []);
  assert.deepEqual(detectPriceChanges({ items: {} }, file(49.9), [active]), []);
});

test('detectPriceChanges ignores a missing price on either side', () => {
  assert.deepEqual(detectPriceChanges(file(null), file(49.9), [active]), []);
  assert.deepEqual(detectPriceChanges(file(49.9), file(null), [active]), []);
});

test('detectPriceChanges skips archived products', () => {
  const archived = { ...active, archivedAt: LATER };
  assert.deepEqual(detectPriceChanges(file(59.99), file(49.9), [archived]), []);
});

test('detectPriceChanges falls back to the product name when the item has none', () => {
  const next = file(49.9);
  next.items.B08N5WRWNW.name = null;
  const [change] = detectPriceChanges(file(59.99), next, [{ asin: 'B08N5WRWNW', name: 'Dal file' }]);
  assert.equal(change.name, 'Dal file');
});

test('detectPriceChanges ignores a product that is no longer in the list', () => {
  assert.deepEqual(detectPriceChanges(file(59.99), file(49.9), []), []);
});

test('buildNotificationMessage formats the prices in euro, Italian style', () => {
  const message = buildNotificationMessage({ asin: 'B08N5WRWNW', name: 'Cuffie XY', from: 59.99, to: 49.9 });
  assert.equal(message.title, 'Prezzo cambiato');
  assert.match(message.body, /^Cuffie XY: da 59,99\s€ a 49,90\s€$/);
});

test('buildNotificationMessage uses the ASIN when there is no name', () => {
  const message = buildNotificationMessage({ asin: 'B08N5WRWNW', name: null, from: 10, to: 12 });
  assert.match(message.body, /^B08N5WRWNW: da 10,00\s€ a 12,00\s€$/);
});

test('parseServiceAccount rejects invalid JSON and incomplete accounts without echoing the content', () => {
  assert.throws(() => parseServiceAccount('{not json'), /non è JSON valido/);
  assert.throws(() => parseServiceAccount('{"project_id":"x"}'), /project_id, private_key e client_email/);
});

test('parseServiceAccount accepts a complete account', () => {
  const account = { project_id: 'p', private_key: 'k', client_email: 'e@example.com' };
  assert.deepEqual(parseServiceAccount(JSON.stringify(account)), account);
});
