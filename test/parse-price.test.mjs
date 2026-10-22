import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BlockedError,
  extractPrice,
  extractProductName,
  hasPriceMarkers,
  parseItalianPrice,
} from '../scripts/lib/parse-price.mjs';

test('parseItalianPrice rejects English notation instead of reading a wrong value', () => {
  assert.equal(parseItalianPrice('1,299.99'), null);
  assert.equal(parseItalianPrice('12,999'), null);
  assert.equal(parseItalianPrice('12,9'), null);
});

test('parseItalianPrice reads thousands dot and decimal comma', () => {
  assert.equal(parseItalianPrice('1.299,99 €'), 1299.99);
  assert.equal(parseItalianPrice('12,90 €'), 12.9);
  assert.equal(parseItalianPrice('€ 49,00'), 49);
  assert.equal(parseItalianPrice('12.345.678,50'), 12345678.5);
});

test('parseItalianPrice returns null for text without a price', () => {
  assert.equal(parseItalianPrice('Non disponibile'), null);
  assert.equal(parseItalianPrice('0,00 €'), null);
});

test('extractPrice reads the offscreen price inside the core price block', () => {
  const html = `
    <div id="corePriceDisplay_desktop_feature_div">
      <span class="a-offscreen">54,99 €</span>
    </div>`;
  assert.equal(extractPrice(html), 54.99);
});

test('extractPrice falls back to the embedded priceAmount inside the buy box', () => {
  const html = `<div id="apex_desktop"><script>{"priceAmount": 19.5, "currency": "EUR"}</script></div>`;
  assert.equal(extractPrice(html), 19.5);
});

test('extractPrice ignores a carousel priceAmount that comes before the buy box', () => {
  const html = `
    <div id="sims-carousel"><script>{"priceAmount": 9.99, "currency": "EUR"}</script></div>
    <div id="apex_desktop"><script>{"priceAmount": 19.5, "currency": "EUR"}</script></div>`;
  assert.equal(extractPrice(html), 19.5);
});

test('extractPrice does not use a priceAmount outside the buy box', () => {
  const html = `<div id="sims-carousel"><script>{"priceAmount": 9.99}</script></div>`;
  assert.equal(extractPrice(html), null);
});

test('hasPriceMarkers tells a product page from an unrelated page', () => {
  assert.equal(hasPriceMarkers('<div id="corePriceDisplay_desktop_feature_div">'), true);
  assert.equal(hasPriceMarkers('<span id="priceblock_ourprice">'), true);
  assert.equal(hasPriceMarkers('<html><body>Pagina di servizio</body></html>'), false);
});

test('extractPrice reads the legacy priceblock layout', () => {
  const html = `<span id="priceblock_ourprice" class="a-size-medium">1.020,00 €</span>`;
  assert.equal(extractPrice(html), 1020);
});

test('extractPrice returns null when no strategy matches', () => {
  assert.equal(extractPrice('<html><body>nessun prezzo</body></html>'), null);
});

test('extractPrice throws BlockedError on a CAPTCHA page', () => {
  const html = `<form><p>Enter the characters you see below</p></form>`;
  assert.throws(() => extractPrice(html), BlockedError);
});

test('extractProductName decodes entities in the title', () => {
  const html = `<span id="productTitle" class="a">  Cuffie &amp; Cavo XY  </span>`;
  assert.equal(extractProductName(html), 'Cuffie & Cavo XY');
});

test('extractProductName decodes &#x27; and &nbsp;', () => {
  const html = `<span id="productTitle">Dave&#x27;s&nbsp;cuffie</span>`;
  assert.equal(extractProductName(html), "Dave's cuffie");
});

test('extractProductName decodes &amp; only once', () => {
  const html = `<span id="productTitle">A &amp;lt; B</span>`;
  assert.equal(extractProductName(html), 'A &lt; B');
});
