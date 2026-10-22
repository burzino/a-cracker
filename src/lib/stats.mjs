// Pure presentation helpers for the PWA. No DOM access, so they are unit-tested in test/.

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

export function formatEUR(value) {
  return value === null || value === undefined ? 'n/d' : eur.format(value);
}

export function summarize(history) {
  if (!history || history.length === 0) return null;
  const prices = history.map((point) => point.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    first: prices[0],
    last: prices.at(-1),
  };
}

export function isBelowTarget(current, targetPrice) {
  return current !== null && current !== undefined && targetPrice !== undefined && current <= targetPrice;
}

// SVG polyline points for a sparkline. X is evenly spaced by entry, Y is scaled to min..max.
export function sparklinePoints(history, width, height, padding = 4) {
  if (!history || history.length === 0) return '';
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const stepX = history.length > 1 ? innerWidth / (history.length - 1) : 0;

  return prices
    .map((price, index) => {
      const x = history.length > 1 ? padding + index * stepX : width / 2;
      const y = span === 0 ? height / 2 : padding + (1 - (price - min) / span) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
