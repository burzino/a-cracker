// Extracts the ASIN from an Amazon product link or from a bare ASIN. Returns null when nothing valid is found.
// Short links (amzn.to) carry no ASIN and are not resolved here: the user must paste the full product link.

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;
const AMAZON_HOST = /(^|\.)amazon\.[a-z.]+$/i;
const PATH_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})(?=[/?#]|$)/i,
  /\/gp\/product\/([A-Z0-9]{10})(?=[/?#]|$)/i,
  /\/product\/([A-Z0-9]{10})(?=[/?#]|$)/i,
];

export function parseAsin(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (text === '') return null;

  if (!text.includes('/')) {
    const bare = text.toUpperCase();
    return ASIN_PATTERN.test(bare) ? bare : null;
  }

  let url;
  try {
    url = new URL(text.includes('://') ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!AMAZON_HOST.test(url.hostname)) return null;

  for (const pattern of PATH_PATTERNS) {
    const match = url.pathname.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}
