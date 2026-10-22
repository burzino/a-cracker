import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushUnavailableReason } from '../src/lib/push-support.js';

const supported = {
  configured: true,
  hasNotification: true,
  hasServiceWorker: true,
  hasPushManager: true,
  isIOS: false,
  standalone: false,
};

test('push is available on a configured desktop or Android browser', () => {
  assert.equal(pushUnavailableReason(supported), null);
});

test('push explains when the build has no Firebase config', () => {
  assert.match(pushUnavailableReason({ ...supported, configured: false }), /non configurate/);
});

test('iOS outside the installed app asks to add the app to the home screen first', () => {
  const reason = pushUnavailableReason({ ...supported, isIOS: true, hasNotification: false });
  assert.match(reason, /Aggiungi a Home/);
  assert.equal(pushUnavailableReason({ ...supported, isIOS: true, standalone: true }), null);
});

test('a browser without notifications or push is reported as unsupported', () => {
  assert.match(pushUnavailableReason({ ...supported, hasPushManager: false }), /non supporta/);
  assert.match(pushUnavailableReason({ ...supported, hasServiceWorker: false }), /non supporta/);
});
