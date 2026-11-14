/** Run: npm run test:maxprice */
import assert from 'node:assert/strict';
import { parseMaxPrice, listingPrice, passesMaxPrice, filterListingsByMaxPrice } from '../src/utils/transferMaxPrice';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }
const L = (name: string, askingPrice?: number, currentBid?: number) => ({ name, askingPrice, currentBid });

test('drops listings above the max and keeps those at or below it', () => {
  const out = filterListingsByMaxPrice([L('a', 500000), L('b', 1000000), L('c', 1000001)], 1000000);
  assert.deepEqual(out.map((p) => p.name), ['a', 'b']);
});
test('current bid takes priority over asking price', () => {
  assert.equal(listingPrice(L('x', 100000, 900000)), 900000);
  assert.ok(!passesMaxPrice(L('x', 100000, 900000), 500000)); // cheap ask but bid already too high
  assert.ok(passesMaxPrice(L('x', 900000, undefined), 1000000));
});
test('listings with no price are kept', () => {
  assert.ok(passesMaxPrice(L('none'), 1000));
  assert.equal(listingPrice(L('zero', 0, 0)), undefined);
});
test('blank / zero / invalid max means no limit and returns the same list', () => {
  const list = [L('a', 9e9)];
  assert.equal(filterListingsByMaxPrice(list, undefined), list);
  assert.equal(filterListingsByMaxPrice(list, 0), list);
  assert.equal(filterListingsByMaxPrice(list, null), list);
});
test('parses typed amounts: commas, currency symbols, k and m', () => {
  assert.equal(parseMaxPrice('2,500,000'), 2500000);
  assert.equal(parseMaxPrice('£2.5m'), 2500000);
  assert.equal(parseMaxPrice('$750k'), 750000);
  assert.equal(parseMaxPrice(' 1000 '), 1000);
  assert.equal(parseMaxPrice(''), undefined);
  assert.equal(parseMaxPrice('abc'), undefined);
  assert.equal(parseMaxPrice('0'), undefined);
  assert.equal(parseMaxPrice(-5), undefined);
});
console.log(`\n${n} tests passed`);
