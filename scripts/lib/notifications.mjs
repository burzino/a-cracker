// Pure price-change detection and notification text. No I/O: the sender lives in firebase-admin.mjs.
import { isActive } from './products.mjs';

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

const isPrice = (value) => typeof value === 'number' && Number.isFinite(value);

// Compares the stored `current` before and after this run, for active products only.
// A first detection (no previous price) and a missing price on either side are not changes.
export function detectPriceChanges(previousPrices, nextPrices, products) {
  const changes = [];
  for (const product of products) {
    if (!isActive(product)) continue;
    const before = previousPrices?.items?.[product.asin];
    const after = nextPrices?.items?.[product.asin];
    if (!before || !after) continue;
    if (!isPrice(before.current) || !isPrice(after.current)) continue;
    if (before.current === after.current) continue;
    changes.push({
      asin: product.asin,
      name: after.name ?? product.name ?? null,
      from: before.current,
      to: after.current,
    });
  }
  return changes;
}

export function buildNotificationMessage({ asin, name, from, to }) {
  return {
    title: 'Prezzo cambiato',
    body: `${name ?? asin}: da ${eur.format(from)} a ${eur.format(to)}`,
  };
}
