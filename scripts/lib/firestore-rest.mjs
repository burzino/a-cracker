// Reads the "products" collection with the public Firestore REST API, without credentials. firestore.rules allows
// public read on "products", so the price job can update prices even when FIREBASE_SERVICE_ACCOUNT is missing.
// Decoding is pure and tested; fetchPublicProducts takes the fetch function as a parameter, so tests never hit the network.
import { productsFromDocuments } from './products.mjs';

const API_BASE = 'https://firestore.googleapis.com/v1';
const PAGE_SIZE = 300;
const TIMEOUT_MS = 15000;

// Converts one Firestore REST value (e.g. { stringValue: 'x' }) into a plain JS value.
// Unknown types throw: a schema change fails the job instead of silently dropping fields.
export function decodeValue(value) {
  if (!value || typeof value !== 'object') throw new Error('Valore Firestore non valido');
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  throw new Error(`Tipo Firestore non supportato: ${Object.keys(value).join(', ')}`);
}

export function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

// Input: the documents as returned by the REST list endpoint. The document id is the last segment of `name`.
export function documentsToProducts(documents) {
  return productsFromDocuments(
    documents.map((doc) => ({
      id: doc.name.split('/').pop(),
      data: decodeFields(doc.fields ?? {}),
    })),
  );
}

// Returns the validated product list (archived ones included). Throws on HTTP errors; the body is never echoed.
export async function fetchPublicProducts(projectId, { fetchImpl = fetch } = {}) {
  const documents = [];
  let pageToken;
  do {
    const url = new URL(`${API_BASE}/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/products`);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Lettura della lista prodotti da Firestore non riuscita: HTTP ${response.status}`);
    const body = await response.json();
    documents.push(...(body.documents ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return documentsToProducts(documents);
}
