// Pure HTML → price extraction. No I/O, so it can be tested against saved fixtures.

export class BlockedError extends Error {
  constructor(message = 'Amazon ha restituito una pagina di blocco (CAPTCHA / Robot Check)') {
    super(message);
    this.name = 'BlockedError';
  }
}

const BLOCK_MARKERS = ['Robot Check', 'api-services-support@amazon.com', 'Enter the characters you see below'];

// "1.299,99 €" → 1299.99 ; "12,90 €" → 12.9 ; returns null if not parseable.
export function parseItalianPrice(text) {
  const normalized = String(text).replace(/ | /g, ' ');
  // A match followed by a digit or '.' is rejected: "1,299.99" is English notation and must not read as 1.29.
  const match = normalized.match(/(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?![\d.])/);
  if (!match) return null;
  const value = Number(`${match[1].replace(/\./g, '')}.${match[2]}`);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Tries strategies from most to least specific; first hit wins.
export function extractPrice(html) {
  if (BLOCK_MARKERS.some((marker) => html.includes(marker))) {
    throw new BlockedError();
  }

  const candidates = [
    () => fromOffscreenInPriceBlock(html),
    () => fromEmbeddedJson(html),
    () => fromLegacyPriceBlock(html),
  ];

  for (const strategy of candidates) {
    const price = strategy();
    if (price !== null) return price;
  }
  return null;
}

// <div id="corePrice..."> … <span class="a-offscreen">12,99 €</span>
function fromOffscreenInPriceBlock(html) {
  const anchor = html.search(/id="corePrice[^"]*"/);
  if (anchor === -1) return null;
  const section = html.slice(anchor, anchor + 6000);
  const match = section.match(/class="a-offscreen">([^<]+)</);
  return match ? parseItalianPrice(match[1]) : null;
}

// Amazon embeds "priceAmount":12.99 in its JS state for the main buy box. The same key also appears in
// carousels and recommendations, so only the buy box section is searched.
function fromEmbeddedJson(html) {
  const section = buyBoxSection(html);
  if (section === null) return null;
  const match = section.match(/"priceAmount"\s*:\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 ? value : null;
}

const BUY_BOX_ANCHORS = /id="(?:corePrice|apex_desktop|buybox|desktop_buybox)[^"]*"/;

function buyBoxSection(html) {
  const anchor = html.search(BUY_BOX_ANCHORS);
  return anchor === -1 ? null : html.slice(anchor, anchor + 6000);
}

// True when the page has the markup of a product page at all. Used to tell "price missing"
// from "page is not a product page" (blocked, redirected or changed layout).
export function hasPriceMarkers(html) {
  return /id="corePrice|"priceAmount"|id="priceblock_/.test(html);
}

// Older layout: <span id="priceblock_ourprice">12,99 €</span>
function fromLegacyPriceBlock(html) {
  const match = html.match(/id="priceblock_(?:ourprice|dealprice|saleprice)"[^>]*>([^<]+)</);
  return match ? parseItalianPrice(match[1]) : null;
}

export function extractProductName(html) {
  const match = html.match(/id="productTitle"[^>]*>\s*([^<]+?)\s*</);
  return match ? decodeEntities(match[1]) : null;
}

// &amp; is decoded last so that "&amp;lt;" becomes "&lt;" and not "<".
function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
