// Sends the push notifications for the price changes written by update-prices.mjs (argument: the changes file).
// Run by the workflow only after data/prices.json has been committed and pushed: if the push fails, the job stops
// before this step, and the next run detects the same change again, so it is never notified twice.
// Without FIREBASE_SERVICE_ACCOUNT, or with an invalid one, it warns and exits 0. Errors while sending fail the step.

import { readFile } from 'node:fs/promises';
import { buildNotificationMessage } from './lib/notifications.mjs';
import { connect, parseServiceAccount, sendPriceNotifications } from './lib/firebase-admin.mjs';

async function main() {
  const changesPath = process.argv[2];
  if (!changesPath) throw new Error('Uso: node scripts/notify-price-changes.mjs <file dei cambi>');

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) {
    console.warn('::warning::Notifiche disattivate: FIREBASE_SERVICE_ACCOUNT non impostato');
    return;
  }
  let serviceAccount;
  try {
    serviceAccount = parseServiceAccount(raw);
  } catch (err) {
    console.warn(`::warning::Notifiche disattivate: ${err.message}`);
    return;
  }

  const changes = JSON.parse(await readFile(changesPath, 'utf8'));
  if (changes.length === 0) {
    console.log('Nessuna variazione di prezzo da notificare');
    return;
  }

  const connection = await connect(serviceAccount);
  try {
    await sendPriceNotifications({
      db: connection.db,
      messaging: connection.messaging,
      messages: changes.map(buildNotificationMessage),
    });
  } finally {
    await connection.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
