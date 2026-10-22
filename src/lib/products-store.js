// The product list lives in Firestore, collection "products", one document per ASIN (document id = asin).
// Business rules (duplicates, archive, restore) come from product-list.js; this module only moves the data.
import { getDb } from './firebase.js';
import { addProduct, archiveProduct, describeFirestoreError, restoreProduct } from './product-list.js';

const COLLECTION = 'products';

// Firestore errors carry a `code`; validation errors from product-list.js are plain Errors and pass through unchanged.
function userError(err) {
  if (err?.code) return new Error(describeFirestoreError(err));
  return err;
}

// Calls onChange with the whole list on every change (also from other devices). Returns the unsubscribe function.
export async function subscribeProducts(onChange, onError) {
  try {
    const db = await getDb();
    const { collection, onSnapshot } = await import('firebase/firestore');
    return onSnapshot(
      collection(db, COLLECTION),
      (snapshot) => onChange(snapshot.docs.map((doc) => ({ ...doc.data(), asin: doc.id }))),
      (err) => onError(new Error(describeFirestoreError(err))),
    );
  } catch (err) {
    onError(err);
    return () => {};
  }
}

// The transaction re-reads the document, so two devices adding the same ASIN cannot overwrite each other.
export async function trackProduct({ asin, targetPrice }) {
  const now = new Date().toISOString();
  try {
    const db = await getDb();
    const { doc, runTransaction } = await import('firebase/firestore');
    const ref = doc(db, COLLECTION, asin);
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(ref);
      const current = snapshot.exists() ? [{ ...snapshot.data(), asin: snapshot.id }] : [];
      const entry = addProduct(current, { asin, targetPrice, now }).at(-1);
      tx.set(ref, entry);
    });
  } catch (err) {
    throw userError(err);
  }
}

// Archiving keeps the document (and its price history in prices.json); it is never deleted.
export async function archiveTrackedProduct(list, asin) {
  const now = new Date().toISOString();
  archiveProduct(list, asin, now); // throws if the ASIN is unknown
  await updateArchivedAt(asin, now);
}

export async function restoreTrackedProduct(list, asin) {
  restoreProduct(list, asin); // throws if the ASIN is unknown
  await updateArchivedAt(asin, null);
}

async function updateArchivedAt(asin, value) {
  try {
    const db = await getDb();
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, COLLECTION, asin), { archivedAt: value });
  } catch (err) {
    throw userError(err);
  }
}
