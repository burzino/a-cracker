// Reads the product list from Firestore ("products"), fetches the current price of every active product and rewrites
// data/prices.json. Sends a push notification for each price change to the devices in "devices".
// Run by .github/workflows/update-prices.yml. Requires Node 20.19+ (global fetch).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BlockedError, extractPrice, extractProductName, hasPriceMarkers } from './lib/parse-price.mjs';
import { buildPricesFile, hasPriceChanges } from './lib/history.mjs';
import { isActive } from './lib/products.mjs';
import { buildNotificationMessage, detectPriceChanges } from './lib/notifications.mjs';
import { connect, parseServiceAccount, readProducts, sendPriceNotifications } from './lib/firebase-admin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRICES_PATH = resolve(ROOT, 'data/prices.json');

const MARKETPLACE = 'https://www.amazon.it';
const REQUEST_DELAY_MS = 4000;
const TIMEOUT_MS = 15000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function fetchProductPage(asin) {
  const response = await fetch(`${MARKETPLACE}/dp/${asin}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'it-IT,it;q=0.9' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 429 || response.status === 503) {
    throw new BlockedError(`Amazon ha risposto HTTP ${response.status}: richieste bloccate o limitate`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

// Never throws: a failure for one product is recorded and the run continues.
async function scrapeOne(asin) {
  try {
    const html = await fetchProductPage(asin);
    const price = extractPrice(html);
    const name = extractProductName(html);
    if (price !== null) return { price, name, error: null };
    const error = hasPriceMarkers(html)
      ? 'Prezzo non trovato nella pagina'
      : 'Nessun prezzo nella pagina: possibile blocco o layout cambiato';
    return { price: null, name, error };
  } catch (err) {
    const error = err instanceof BlockedError ? err.message : `Errore: ${err.message}`;
    return { price: null, error };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Notifications are best effort: a push error is logged and never fails the price update.
async function notifyPriceChanges(connection, changes) {
  if (changes.length === 0) return;
  try {
    await sendPriceNotifications({
      db: connection.db,
      messaging: connection.messaging,
      messages: changes.map(buildNotificationMessage),
    });
  } catch (err) {
    console.warn(`Notifiche non inviate: ${err.message}`);
  }
}

// Missing or invalid service account: nothing can be read, so the job warns and exits cleanly.
// Runtime errors (network, Firestore) fail the job, so they show up in Actions.
function serviceAccountOrNull() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) return null;
  try {
    return parseServiceAccount(raw);
  } catch (err) {
    console.warn(`${err.message}: aggiornamento saltato`);
    return null;
  }
}

async function main() {
  const serviceAccount = serviceAccountOrNull();
  if (!serviceAccount) {
    console.warn('FIREBASE_SERVICE_ACCOUNT non disponibile: la lista prodotti è in Firestore, nulla da aggiornare. data/prices.json non modificato.');
    return;
  }

  const connection = await connect(serviceAccount);
  try {
    const products = await readProducts(connection.db);
    const previous = await readJson(PRICES_PATH, null);
    const now = new Date().toISOString();

    // Archived products are not fetched; their stored entries are carried over by buildPricesFile.
    const active = products.filter(isActive);
    if (products.length === 0) console.log('Nessun prodotto in Firestore');

    const results = new Map();
    for (const [index, product] of active.entries()) {
      if (index > 0) await sleep(REQUEST_DELAY_MS);
      const result = await scrapeOne(product.asin);
      results.set(product.asin, result);
      console.log(`${product.asin} → ${result.price ?? 'n/d'}${result.error ? ` (${result.error})` : ''}`);
    }

    const file = buildPricesFile({ products, previous, results, now });
    // Computed in memory only: the changes are never written to prices.json.
    const changes = detectPriceChanges(previous, file, products);
    if (!hasPriceChanges(previous, file)) {
      console.log(`Nessuna variazione: ${PRICES_PATH} non riscritto`);
      return;
    }
    await mkdir(dirname(PRICES_PATH), { recursive: true });
    await writeFile(PRICES_PATH, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`Scritto ${PRICES_PATH} (${active.length} prodotti attivi, ${changes.length} cambi di prezzo)`);
    await notifyPriceChanges(connection, changes);
  } finally {
    await connection.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
