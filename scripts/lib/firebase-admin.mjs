// Firebase Admin access for the hourly job: reads the "products" collection and sends notifications to "devices".
// firebase-admin is imported lazily inside connect(), so the pure modules and the tests never load it.
import { productsFromDocuments } from './products.mjs';

const BATCH_SIZE = 500;
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// Parses the FIREBASE_SERVICE_ACCOUNT secret. The error never echoes the content.
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

// All products, archived ones included: the caller decides which ones to fetch.
export async function readProducts(db) {
  const snapshot = await db.collection('products').get();
  return productsFromDocuments(snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })));
}

// `messages` is a list of { title, body }, sent as data-only messages: the service worker builds the notification,
// so it also appears when the page is closed. Tokens FCM rejects as unregistered are deleted from "devices".
export async function sendPriceNotifications({ db, messaging, messages, log = console.log }) {
  if (messages.length === 0) return { sent: 0, removed: 0 };

  const snapshot = await db.collection('devices').select().get();
  const tokens = snapshot.docs.map((doc) => doc.id);
  if (tokens.length === 0) {
    log('Nessun dispositivo registrato: notifiche non inviate');
    return { sent: 0, removed: 0 };
  }

  const dead = new Set();
  let sent = 0;
  for (const message of messages) {
    for (let start = 0; start < tokens.length; start += BATCH_SIZE) {
      const chunk = tokens.slice(start, start + BATCH_SIZE);
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        data: { title: message.title, body: message.body },
      });
      sent += response.successCount;
      response.responses.forEach((result, index) => {
        if (!result.success && DEAD_TOKEN_CODES.has(result.error?.code)) dead.add(chunk[index]);
      });
    }
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
