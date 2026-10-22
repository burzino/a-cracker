// Pure rules for the product list shown and edited by the PWA. Archived products stay in the list (archivedAt set).
// Mirrors "active" from scripts/lib/products.mjs.

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;

export function isActive(product) {
  return !product.archivedAt;
}

export function activeProducts(list) {
  return list.filter(isActive);
}

export function archivedProducts(list) {
  return list.filter((product) => !isActive(product));
}

function normalizeAsin(asin) {
  const normalized = typeof asin === 'string' ? asin.trim().toUpperCase() : '';
  if (!ASIN_PATTERN.test(normalized)) throw new Error('ASIN non valido');
  return normalized;
}

function findIndex(list, asin) {
  const index = list.findIndex((product) => product.asin === asin);
  if (index === -1) throw new Error(`Prodotto non trovato: ${asin}`);
  return index;
}

export function addProduct(list, { asin, targetPrice, now }) {
  const normalized = normalizeAsin(asin);
  const existing = list.find((product) => product.asin === normalized);
  if (existing) {
    throw new Error(
      isActive(existing)
        ? 'Questo prodotto è già tracciato'
        : 'Questo prodotto è nell\'archivio: ripristinalo dalla sezione Archivio',
    );
  }
  const entry = { asin: normalized, addedAt: now, archivedAt: null };
  if (targetPrice !== undefined) entry.targetPrice = targetPrice;
  return [...list, entry];
}

export function archiveProduct(list, asin, now) {
  const index = findIndex(list, normalizeAsin(asin));
  return list.map((product, i) => (i === index ? { ...product, archivedAt: now } : product));
}

export function restoreProduct(list, asin) {
  const index = findIndex(list, normalizeAsin(asin));
  return list.map((product, i) => (i === index ? { ...product, archivedAt: null } : product));
}

// Accepts "49,90" or "49.90"; empty input means no target. Throws a message for the UI on anything else.
export function parseTargetPrice(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) throw new Error('Il prezzo target deve essere un numero maggiore di zero');
  return value;
}

// Italian message for a Firestore error (err.code is the FirestoreError code). Anything unknown keeps a generic text.
export function describeFirestoreError(err) {
  const code = err?.code ?? '';
  if (code === 'permission-denied') return 'Firestore ha negato l\'accesso: controlla le regole pubblicate.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Connessione a Firestore non riuscita: riprova.';
  if (err?.message === 'Firebase non configurato in questa build') return err.message;
  return `Errore di Firestore${code ? ` (${code})` : ''}: riprova.`;
}
