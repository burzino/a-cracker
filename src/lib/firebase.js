// Firebase client: Firestore (product list and device registrations) and Web Push. The config comes from VITE_*
// variables, which are public by design. Without them the app still builds and shows "Firebase non configurato".
import { permissionDeniedMessage, pushUnavailableReason } from './push-support.js';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const FIREBASE_NOT_CONFIGURED = 'Firebase non configurato in questa build';
export const FIREBASE_CONFIGURED = Object.values(config).every(Boolean) && Boolean(vapidKey);

// The service worker is registered in its own scope, so it does not replace the offline cache worker (sw.js).
// It reads the Firebase config from its query string, so no value is hard-coded in public/.
const SW_PATH = './firebase-messaging-sw.js';
const SW_SCOPE = './firebase-push/';

let appPromise = null;

// Lazy: the Firebase SDK is loaded only when the app needs it. Rejects when the config is missing.
export function getFirebaseApp() {
  if (!FIREBASE_CONFIGURED) return Promise.reject(new Error(FIREBASE_NOT_CONFIGURED));
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp, getApps, getApp }) =>
      getApps().length ? getApp() : initializeApp(config),
    );
  }
  return appPromise;
}

export async function getDb() {
  const app = await getFirebaseApp();
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}

// Registers the device in Firestore: "devices/<token>" with createdAt and lastSeenAt.
// The client cannot read the collection, so it tries an update first and creates the document when that fails.
async function saveDevice(db, token) {
  const { doc, setDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  const ref = doc(db, 'devices', token);
  try {
    await updateDoc(ref, { lastSeenAt: serverTimestamp() });
  } catch {
    await setDoc(ref, { createdAt: serverTimestamp(), lastSeenAt: serverTimestamp() });
  }
}

// Returns { ok, message } and never throws, so the UI can show the reason.
export async function enablePushNotifications() {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches === true || navigator.standalone === true;
  const reason = pushUnavailableReason({
    configured: FIREBASE_CONFIGURED,
    hasNotification: 'Notification' in window,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    isIOS,
    standalone,
  });
  if (reason) return { ok: false, message: reason };

  try {
    // First await: keeps the user gesture that the permission prompt needs.
    const permission = await Notification.requestPermission();
    if (permission === 'denied') return { ok: false, message: permissionDeniedMessage() };
    if (permission !== 'granted') return { ok: false, message: 'Permesso non concesso.' };

    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return { ok: false, message: 'Questo browser non supporta le notifiche push.' };

    const app = await getFirebaseApp();
    const registration = await navigator.serviceWorker.register(
      `${SW_PATH}?${new URLSearchParams(config).toString()}`,
      { scope: SW_SCOPE },
    );
    const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, message: 'Impossibile ottenere il dispositivo per le notifiche. Riprova.' };

    await saveDevice(await getDb(), token);
    return { ok: true, message: 'Notifiche attivate per questo dispositivo.' };
  } catch (err) {
    return { ok: false, message: `Attivazione non riuscita: ${err.message}` };
  }
}
