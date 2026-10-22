// Firebase Admin access for the notification step: reads the "devices" collection, sends notifications, removes dead tokens.
// firebase-admin is imported lazily inside connect(), so the pure modules and the tests never load it.

const BATCH_SIZE = 500;
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const PRIVATE_KEY_HEADER = '-----BEGIN PRIVATE KEY-----';

// Parses the FIREBASE_SERVICE_ACCOUNT secret. The error never echoes the content.
// Throws a plain Error for any invalid value: the caller treats it like a missing secret (notifications skipped).
export function parseServiceAccount(raw) {
  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT non è JSON valido');
  }
  if (!account || typeof account !== 'object' || !account.project_id || !account.private_key || !account.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT non contiene project_id, private_key e client_email');
  }
  if (typeof account.private_key !== 'string' || !account.private_key.includes(PRIVATE_KEY_HEADER)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT: private_key non valida (manca l'header ${PRIVATE_KEY_HEADER})`);
  }
  return account;
}

// Returns { db, messaging, close }. Call close() when done, or the process may stay alive.
export async function connect(serviceAccount) {
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getMessaging } = await import('firebase-admin/messaging');
  const app = initializeApp({ credential: cert(serviceAccount) }, `job-${Date.now()}`);
  return {
    db: getFirestore(app),
    messaging: getMessaging(app),
    close: () => deleteApp(app),
  };
}

// `messages` is a list of { title, body }, sent as data-only messages: the service worker builds the notification,
// so it also appears when the page is closed. Tokens FCM rejects as unregistered are dropped from the list for the
// following messages of the same run, and deleted from "devices" at the end.
export async function sendPriceNotifications({ db, messaging, messages, log = console.log }) {
  if (messages.length === 0) return { sent: 0, removed: 0 };

  const snapshot = await db.collection('devices').select().get();
  let tokens = snapshot.docs.map((doc) => doc.id);
  if (tokens.length === 0) {
    log('Nessun dispositivo registrato: notifiche non inviate');
    return { sent: 0, removed: 0 };
  }

  const dead = new Set();
  let sent = 0;
  for (const message of messages) {
    const deadNow = new Set();
    for (let start = 0; start < tokens.length; start += BATCH_SIZE) {
      const chunk = tokens.slice(start, start + BATCH_SIZE);
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        data: { title: message.title, body: message.body },
      });
      sent += response.successCount;
      response.responses.forEach((result, index) => {
        if (!result.success && DEAD_TOKEN_CODES.has(result.error?.code)) deadNow.add(chunk[index]);
      });
    }
    tokens = tokens.filter((token) => !deadNow.has(token));
    deadNow.forEach((token) => dead.add(token));
  }

  const deadTokens = [...dead];
  for (let start = 0; start < deadTokens.length; start += BATCH_SIZE) {
    const batch = db.batch();
    for (const token of deadTokens.slice(start, start + BATCH_SIZE)) {
      batch.delete(db.collection('devices').doc(token));
    }
    await batch.commit();
  }
  log(`Notifiche inviate: ${sent} · dispositivi rimossi: ${deadTokens.length}`);
  return { sent, removed: deadTokens.length };
}
