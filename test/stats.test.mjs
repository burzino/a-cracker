import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatEUR, isBelowTarget, sparklinePoints, summarize } from '../src/lib/stats.mjs';

test('formatEUR uses Italian currency formatting', () => {
  assert.equal(formatEUR(12345.6), '12.345,60 €');
  assert.equal(formatEUR(null), 'n/d');
});

test('summarize returns min, max, first and last price', () => {
  const history = [
    { date: 'a', price: 20 },
    { date: 'b', price: 10 },
    { date: 'c', price: 15 },
  ];
  assert.deepEqual(summarize(history), { min: 10, max: 20, first: 20, last: 15 });
  assert.equal(summarize([]), null);
});

test('isBelowTarget is true only when a price exists and is at or under the target', () => {
  assert.equal(isBelowTarget(49.9, 49.9), true);
  assert.equal(isBelowTarget(50, 49.9), false);
  assert.equal(isBelowTarget(null, 49.9), false);
  assert.equal(isBelowTarget(40, undefined), false);
});

test('sparklinePoints scales prices into the box, highest price at the top', () => {
  const history = [
    { date: 'a', price: 10 },
    { date: 'b', price: 20 },
  ];
  assert.equal(sparklinePoints(history, 100, 50, 0), '0.0,50.0 100.0,0.0');
});

test('sparklinePoints handles a single point and a flat history', () => {
  assert.equal(sparklinePoints([{ date: 'a', price: 5 }], 100, 50, 0), '50.0,25.0');
  const flat = [
    { date: 'a', price: 5 },
    { date: 'b', price: 5 },
  ];
  assert.equal(sparklinePoints(flat, 100, 50, 0), '0.0,25.0 100.0,25.0');
});
