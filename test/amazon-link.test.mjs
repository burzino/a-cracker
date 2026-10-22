import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAsin } from '../src/lib/amazon-link.js';

test('parseAsin reads the ASIN from the common Amazon product URLs', () => {
  assert.equal(parseAsin('https://www.amazon.it/dp/B08N5WRWNW/'), 'B08N5WRWNW');
  assert.equal(parseAsin('https://www.amazon.it/Cuffie-XY/dp/B08N5WRWNW/ref=sr_1_1?keywords=cuffie'), 'B08N5WRWNW');
  assert.equal(parseAsin('https://www.amazon.it/gp/product/B08N5WRWNW?psc=1'), 'B08N5WRWNW');
  assert.equal(parseAsin('https://www.amazon.it/product/B08N5WRWNW'), 'B08N5WRWNW');
  assert.equal(parseAsin('amazon.it/dp/B08N5WRWNW'), 'B08N5WRWNW');
});

test('parseAsin accepts a bare ASIN and normalises its case', () => {
  assert.equal(parseAsin('B08N5WRWNW'), 'B08N5WRWNW');
  assert.equal(parseAsin('  b08n5wrwnw  '), 'B08N5WRWNW');
});

test('parseAsin returns null for anything that is not a product ASIN', () => {
  assert.equal(parseAsin(''), null);
  assert.equal(parseAsin('   '), null);
  assert.equal(parseAsin(null), null);
  assert.equal(parseAsin('B08N5WRWN'), null);
  assert.equal(parseAsin('B08N5WRWNWX'), null);
  assert.equal(parseAsin('B08N5WRW-W'), null);
  assert.equal(parseAsin('https://www.amazon.it/s?k=cuffie'), null);
  assert.equal(parseAsin('https://www.amazon.it/dp/B08N5WRWN'), null);
  assert.equal(parseAsin('https://example.com/dp/B08N5WRWNW'), null);
  assert.equal(parseAsin('https://amzn.to/abc123'), null);
});
