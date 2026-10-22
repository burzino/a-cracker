// Price data for the PWA. The path is relative so it resolves under the GitHub Pages sub-path.
// The product list is not here: it comes from Firestore (products-store.js).

export async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

// prices.json may be missing before the first update run.
export function loadPrices() {
  return loadJson('./data/prices.json').catch(() => ({ items: {} }));
}
