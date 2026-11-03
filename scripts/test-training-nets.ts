/** Run: npm run test:nets */
import assert from 'node:assert/strict';
import { netMultiplier, staminaMultiplier, netEffectivenessRows, MAX_NETS_PER_WEEK } from '../src/utils/trainingNets';
import {
  SECONDARY_SINGLE_WEEKS_BY_AGE, SECONDARY_DUAL_WEEKS_BY_AGE, SECONDARY_TRIPLE_WEEKS_BY_AGE,
  countQualifyingNetTypes, weeksToSecondaryPop,
} from '../src/utils/secondarySkills';
import { estimateSecondarySkillWeeks, estimateWeeksToNextLevel } from '../src/parser';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }

// Battrick Helpfile (Feb 2012), "Consistency & Concentration" table, ages 17..35.
const AGES = Array.from({ length: 19 }, (_, i) => 17 + i);
const HELPFILE = {
  single: [14.2, 13.6, 13.0, 12.4, 11.8, 11.2, 10.6, 10.0, 9.4, 8.8, 8.2, 7.6, 7.0, 6.4, 5.8, 5.2, 4.6, 4.0, 4.0],
  dual:   [7.1, 6.8, 6.5, 6.2, 5.9, 5.6, 5.3, 5.0, 4.7, 4.3, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
  triple: [5.2, 4.9, 4.6, 4.3, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
};

test('net multiplier follows the documented halving rule (1, 1.5, 1.75, 1.875, 1.9375)', () => {
  assert.equal(netMultiplier(0), 0);
  assert.equal(netMultiplier(1), 1);
  assert.equal(netMultiplier(2), 1.5);
  assert.equal(netMultiplier(3), 1.75);
  assert.equal(netMultiplier(4), 1.875);
  assert.equal(netMultiplier(5), 1.9375);
  assert.ok(netMultiplier(10) < 2 && netMultiplier(10) > 1.99);
  assert.equal(netMultiplier(50), netMultiplier(MAX_NETS_PER_WEEK)); // capped at the 10 weekly sessions
  assert.deepEqual(netEffectivenessRows(3).map((r) => r.effectiveness), [1, 0.5, 0.25]);
});
test('stamina is 6 / 4 / 3 weeks for 1 / 2 / 3 nets (published), not the 1.75x primary rule', () => {
  assert.equal(6 / staminaMultiplier(1), 6);
  assert.equal(6 / staminaMultiplier(2), 4);
  assert.equal(6 / staminaMultiplier(3), 3);
  assert.ok(6 / staminaMultiplier(4) < 3 && 6 / staminaMultiplier(4) > 2.5);
  assert.equal(estimateWeeksToNextLevel(3, 25, 1, 9, 'stamina'), 6);
  assert.equal(estimateWeeksToNextLevel(3, 25, 2, 9, 'stamina'), 4);
  assert.equal(estimateWeeksToNextLevel(3, 25, 3, 9, 'stamina'), 3);
});
test('secondary tables match the Battrick Helpfile for every age 17-35', () => {
  AGES.forEach((age, i) => {
    assert.equal(SECONDARY_SINGLE_WEEKS_BY_AGE[age], HELPFILE.single[i], `single @${age}`);
    assert.equal(SECONDARY_DUAL_WEEKS_BY_AGE[age], HELPFILE.dual[i], `dual @${age}`);
    assert.equal(SECONDARY_TRIPLE_WEEKS_BY_AGE[age], HELPFILE.triple[i], `triple @${age}`);
  });
});
test('older players train secondaries FASTER (Battrick rules: "older players ... improve concentration and consistency quicker")', () => {
  const nets = { batting: 1 };
  assert.ok(weeksToSecondaryPop('concentration', 5, 17, nets) > weeksToSecondaryPop('concentration', 5, 25, nets));
  assert.ok(weeksToSecondaryPop('concentration', 5, 25, nets) > weeksToSecondaryPop('concentration', 5, 33, nets));
});
test('conc / cons "nets received" by net combination matches the wiki table', () => {
  const t = (n: any) => [countQualifyingNetTypes('concentration', n), countQualifyingNetTypes('consistency', n)];
  assert.deepEqual(t({ batting: 1 }), [1, 0]);
  assert.deepEqual(t({ bowling: 1 }), [0, 1]);
  assert.deepEqual(t({ keeping: 1 }), [1, 1]);
  assert.deepEqual(t({ fielding: 1 }), [1, 1]);
  assert.deepEqual(t({ batting: 1, fielding: 1 }), [2, 1]);
  assert.deepEqual(t({ bowling: 1, keeping: 1 }), [1, 2]);
  assert.deepEqual(t({ keeping: 1, fielding: 1 }), [2, 2]);
  assert.deepEqual(t({ batting: 1, keeping: 1, fielding: 1 }), [3, 2]);
  assert.deepEqual(t({ bowling: 1, keeping: 1, fielding: 1 }), [2, 3]);
  assert.deepEqual(t({ batting: 1, bowling: 1, keeping: 1 }), [2, 2]);
  assert.deepEqual(t({ batting: 1, bowling: 1, keeping: 1, fielding: 1 }), [3, 3]);
});
test('extra nets of the SAME type do not speed secondaries (psychologists attend the first net of a type only)', () => {
  assert.equal(weeksToSecondaryPop('concentration', 5, 18, { batting: 1 }), weeksToSecondaryPop('concentration', 5, 18, { batting: 3 }));
  assert.equal(estimateSecondarySkillWeeks(5, 5, 18, 1, 9, 'batting'), estimateSecondarySkillWeeks(5, 5, 18, 3, 9, 'batting'));
  assert.equal(estimateWeeksToNextLevel(5, 18, 1, 9, 'concentration'), estimateWeeksToNextLevel(5, 18, 3, 9, 'concentration'));
});
test('forecast wrapper counts keeping + fielding nets, and gives Infinity when no qualifying net exists', () => {
  // batting + keeping + fielding at 17 -> triple row (5.2)
  assert.equal(estimateSecondarySkillWeeks(5, 5, 17, 1, 9, 'batting', { batting: 1, keeping: 1, fielding: 1 }), 5.2);
  // no batting net, but keeping + fielding still train concentration (dual, 7.1 at 17)
  assert.equal(estimateSecondarySkillWeeks(5, 5, 17, 0, 9, 'batting', { keeping: 1, fielding: 1 }), 7.1);
  // bowling-only player gets no concentration
  assert.equal(estimateSecondarySkillWeeks(5, 5, 17, 0, 9, 'batting', { bowling: 2 }), Infinity);
  // a maxed skill needs nothing
  assert.equal(estimateSecondarySkillWeeks(5, 20, 17, 1, 9, 'batting'), 0);
});
test('primary forecast uses the shared multiplier for 4+ nets (no longer capped at 1.75)', () => {
  const w3 = estimateWeeksToNextLevel(8, 20, 3, 9, 'batting');
  const w4 = estimateWeeksToNextLevel(8, 20, 4, 9, 'batting');
  const w1 = estimateWeeksToNextLevel(8, 20, 1, 9, 'batting');
  assert.ok(w4 < w3, `${w4} !< ${w3}`);
  assert.ok(Math.abs(w1 / w3 - 1.75) < 0.02);
  assert.ok(Math.abs(w1 / w4 - 1.875) < 0.02);
});
console.log(`\n${n} scenarios passed`);
