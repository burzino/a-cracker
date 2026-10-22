// Pure update rules for data/prices.json. Callers pass `now` so results are deterministic in tests.
import { isActive } from './products.mjs';

export const HISTORY_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns the next stored entry for one product.
// `price` is null when the scrape failed; the last known price is kept in that case.
export function updateItem(previous, { name, price, error = null, now }) {
  const history = previous?.history ?? [];
  const current = price ?? previous?.current ?? null;

  let nextHistory = history;
  if (price !== null && (history.length === 0 || history.at(-1).price !== price)) {
    nextHistory = [...history, { date: now, price }];
  }

  return {
    name: name ?? previous?.name ?? null,
    currency: 'EUR',
    current,
    checkedAt: now,
    error,
    history: trimHistory(nextHistory, now),
  };
}

// The last point is always kept: it is the start of the current price, even if it is older than the window.
export function trimHistory(history, now) {
  const cutoff = new Date(now).getTime() - HISTORY_DAYS * DAY_MS;
  return history.filter(
    (point, index) => index === history.length - 1 || new Date(point.date).getTime() >= cutoff,
  );
}

// True when the fields shown by the app differ. updatedAt and checkedAt are ignored: they change on every run,
// so comparing them would make the job rewrite and commit the file every time.
export function hasPriceChanges(previous, next) {
  if (!previous) return true;
  const previousItems = previous.items ?? {};
  const nextAsins = Object.keys(next.items);
  if (nextAsins.length !== Object.keys(previousItems).length) return true;

  return nextAsins.some((asin) => {
    const before = previousItems[asin];
    const after = next.items[asin];
    if (!before) return true;
    return ['name', 'current', 'error', 'history'].some(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    );
  });
}

// Builds the whole file from the product list and the previous file.
// Archived products are not fetched: their stored entry is carried over unchanged, so restoring one keeps its history.
export function buildPricesFile({ products, previous, results, now }) {
  const items = {};
  for (const product of products) {
    if (!isActive(product)) {
      if (previous?.items?.[product.asin]) items[product.asin] = previous.items[product.asin];
      continue;
    }
    const result = results.get(product.asin) ?? { price: null, error: 'Nessun risultato' };
    items[product.asin] = updateItem(previous?.items?.[product.asin], {
      name: result.name ?? product.name,
      price: result.price,
      error: result.error ?? null,
      now,
    });
  }
  return { updatedAt: now, items };
}
