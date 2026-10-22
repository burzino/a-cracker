import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServiceAccount, sendPriceNotifications } from '../scripts/lib/firebase-admin.mjs';

const VALID_KEY = '-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----\n';

test('parseServiceAccount rejects invalid JSON and incomplete accounts without echoing the content', () => {
  assert.throws(() => parseServiceAccount('{not json'), /non è JSON valido/);
  assert.throws(() => parseServiceAccount('{"project_id":"x"}'), /project_id, private_key e client_email/);
});

test('parseServiceAccount accepts a complete account', () => {
  const account = { project_id: 'p', private_key: VALID_KEY, client_email: 'e@example.com' };
  assert.deepEqual(parseServiceAccount(JSON.stringify(account)), account);
});

test('parseServiceAccount rejects a private_key without the PEM header, without echoing it', () => {
  const account = { project_id: 'p', private_key: 'non-una-chiave-pem', client_email: 'e@example.com' };
  assert.throws(
    () => parseServiceAccount(JSON.stringify(account)),
    (err) => {
      assert.match(err.message, /private_key non valida/);
      assert.match(err.message, /-----BEGIN PRIVATE KEY-----/);
      assert.doesNotMatch(err.message, /non-una-chiave-pem/);
      return true;
    },
  );
});

test('parseServiceAccount rejects a non-string private_key', () => {
  const account = { project_id: 'p', private_key: 12345, client_email: 'e@example.com' };
  assert.throws(() => parseServiceAccount(JSON.stringify(account)), /private_key non valida/);
});

// Fake db and messaging: records the sends and deletes, no network.
function fakeFirebase({ devices, responsesByCall }) {
  const deleted = [];
  const sentTokens = [];
  let call = 0;
  const db = {
    collection: (name) => ({
      select: () => ({ get: async () => ({ docs: devices.map((id) => ({ id })) }) }),
      doc: (id) => ({ name, id }),
    }),
    batch: () => {
      const ops = [];
      return {
        delete: (ref) => ops.push(ref),
        commit: async () => deleted.push(...ops.map((ref) => ref.id)),
      };
    },
  };
  const messaging = {
    sendEachForMulticast: async ({ tokens }) => {
      sentTokens.push([...tokens]);
      const failures = responsesByCall[call++] ?? {};
      const responses = tokens.map((token) =>
        failures[token]
          ? { success: false, error: { code: failures[token] } }
          : { success: true },
      );
      return { successCount: responses.filter((r) => r.success).length, responses };
    },
  };
  return { db, messaging, deleted, sentTokens };
}

test('sendPriceNotifications stops sending to a token FCM rejected in an earlier message of the same run', async () => {
  const { db, messaging, deleted, sentTokens } = fakeFirebase({
    devices: ['tokA', 'tokB'],
    responsesByCall: [{ tokA: 'messaging/registration-token-not-registered' }, {}],
  });
  const messages = [
    { title: 'Prezzo cambiato', body: 'uno' },
    { title: 'Prezzo cambiato', body: 'due' },
  ];
  const result = await sendPriceNotifications({ db, messaging, messages, log: () => {} });

  assert.deepEqual(sentTokens, [['tokA', 'tokB'], ['tokB']]);
  assert.deepEqual(deleted, ['tokA']);
  assert.deepEqual(result, { sent: 2, removed: 1 });
});

test('sendPriceNotifications does not delete tokens on a transient error', async () => {
  const { db, messaging, deleted } = fakeFirebase({
    devices: ['tokA'],
    responsesByCall: [{ tokA: 'messaging/internal-error' }],
  });
  const result = await sendPriceNotifications({
    db,
    messaging,
    messages: [{ title: 't', body: 'b' }],
    log: () => {},
  });
  assert.deepEqual(deleted, []);
  assert.deepEqual(result, { sent: 0, removed: 0 });
});
