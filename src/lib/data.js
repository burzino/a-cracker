// Data loading for the PWA. Paths are relative so they resolve under the GitHub Pages sub-path.

export async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

// products.json is required; prices.json may be missing before the first update run.
export async function loadData() {
  const [products, prices] = await Promise.all([
    loadJson('./data/products.json'),
    loadJson('./data/prices.json').catch(() => ({ items: {} })),
  ]);
  return { products, prices };
}
