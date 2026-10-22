// Background push handler for Firebase Cloud Messaging. Registered by src/lib/firebase.js in the scope ./firebase-push/,
// separate from sw.js (offline cache). The Firebase config comes from the query string of this script's URL, so there
// are no placeholders to replace: the values are the public VITE_FIREBASE_* values used at build time.
// The SDK version must match the "firebase" version in package.json (12.18.0), since the compat builds come from gstatic.

importScripts(
  'https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js',
);

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

// Only initialise when the config is present: an empty config would make the SDK throw on every push.
if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Messages are data-only ({ title, body }), so the notification is built here and shown even with the page closed.
  messaging.onBackgroundMessage((payload) => {
    const title = payload.data?.title || 'Prezzo cambiato';
    const body = payload.data?.body || '';
    return self.registration.showNotification(title, {
      body,
      icon: new URL('./icons/icon-192.png', self.location.href).href,
    });
  });
}

// Opens the app (its folder is the Pages root) when the notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./', self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(target));
      return open ? open.focus() : self.clients.openWindow(target);
    }),
  );
});
