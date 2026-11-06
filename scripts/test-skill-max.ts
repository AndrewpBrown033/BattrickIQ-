/** Run: npm run test:skillmax */
import assert from 'node:assert/strict';
import { activeSkillMaxes, filterListingsBySkillMax, passesSkillMax, maxBelowMin } from '../src/utils/transferSkillMax';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }
const P = (name: string, batting: number, bowling: number, bowlingType?: string) => ({ name, skills: { batting, bowling }, bowlingType });

test('batting max drops players above it and keeps those at or below', () => {
  const out = filterListingsBySkillMax([P('a', 8, 0), P('b', 9, 0), P('c', 7, 0)], { batting: 8 });
  assert.deepEqual(out.map((p) => p.name), ['a', 'c']);
});
test('seam and spin maxes apply to the matching bowler type only', () => {
  const list = [P('seamHigh', 0, 12, 'RFM'), P('seamOk', 0, 8, 'RM'), P('spinHigh', 0, 12, 'RS'), P('spinOk', 0, 9, 'Orthodox spin')];
  assert.deepEqual(filterListingsBySkillMax(list, { seam: 10 }).map((p) => p.name), ['seamOk', 'spinHigh', 'spinOk']);
  assert.deepEqual(filterListingsBySkillMax(list, { spin: 10 }).map((p) => p.name), ['seamHigh', 'seamOk', 'spinOk']);
  assert.deepEqual(filterListingsBySkillMax(list, { seam: 10, spin: 10 }).map((p) => p.name), ['seamOk', 'spinOk']);
});
test('unknown bowling type is not dropped unless both limits exclude him', () => {
  assert.ok(passesSkillMax(P('u', 0, 12), { seam: 10 }));            // could be spin: keep
  assert.ok(passesSkillMax(P('u', 0, 12), { seam: 10, spin: 14 }));  // under the more generous limit: keep
  assert.ok(!passesSkillMax(P('u', 0, 12), { seam: 10, spin: 11 })); // over both: drop
});
test('non-bowlers are not affected by a bowling max', () => {
  assert.ok(passesSkillMax(P('bat', 10, 0), { seam: 5, spin: 5 }));
});
test('no limits returns the same list; zero / blank means no limit', () => {
  const list = [P('a', 15, 15)];
  assert.equal(filterListingsBySkillMax(list, {}), list);
  assert.deepEqual(activeSkillMaxes({ batting: 0, seam: undefined, spin: NaN }, ['batting', 'seam', 'spin']), {});
});
test('only maxes for switched-on skills count, and values are clamped to 20', () => {
  assert.deepEqual(activeSkillMaxes({ batting: 8, seam: 9, spin: 30 }, ['batting', 'spin']), { batting: 8, spin: 20 });
});
test('max below min is flagged', () => {
  assert.ok(maxBelowMin(10, 8));
  assert.ok(!maxBelowMin(8, 10));
  assert.ok(!maxBelowMin(0, 8));
  assert.ok(!maxBelowMin(8, undefined));
});
console.log(`\n${n} scenarios passed`);
