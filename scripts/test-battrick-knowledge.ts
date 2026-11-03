/** Run: npm run test:knowledge */
import assert from 'node:assert/strict';
import {
  classifyBowlingType, normalizePitch, pitchEffectLine, weatherEffectLine, aggressionLevel, aggressionLabel,
  ORDER_LEVELS, rankCaptainCandidates, rankKeeperCandidates, captainKeeperBlock, BATTRICK_MECHANICS_PROMPT,
  OD_BOWLING_PRESETS, BT20_DEFAULT_ORDER, parseOvers, presetProfile, buildConditionsBlock, describeStyles, PITCH_EFFECTS,
} from '../src/utils/battrickKnowledge';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }

test('bowler types: words and hand+code forms', () => {
  for (const [raw, want] of [
    ['RFM', 'fastMedium'], ['LFM', 'fastMedium'], ['Fast Medium', 'fastMedium'], ['RM', 'medium'], ['Medium', 'medium'],
    ['RF', 'fast'], ['Fast', 'fast'], ['F', 'fast'], ['RS', 'spin'], ['Spin', 'spin'], ['OB', 'spin'], ['LBG', 'spin'],
    ['Right-arm off break', 'spin'], ['None', 'none'], ['', 'none'], [undefined, 'none'],
  ] as const) assert.equal(classifyBowlingType(raw as any), want, String(raw));
});
test('pitch table matches Battrickipedia, and labels (incl. UI wording) normalise', () => {
  assert.deepEqual(PITCH_EFFECTS.flat, { label: 'Flat', batting: 2, fast: -2, fastMedium: -2, medium: -1, spin: -2 });
  assert.deepEqual(PITCH_EFFECTS.dusty, { label: 'Dusty', batting: 1, fast: 1, fastMedium: 0, medium: 1, spin: 2 });
  assert.equal(normalizePitch('Flat (Runs-Galore)'), 'flat');
  assert.equal(normalizePitch('Hard'), 'hardAndFast');
  assert.equal(normalizePitch('Hard & Fast'), 'hardAndFast');
  assert.equal(normalizePitch('mystery'), null);
  assert.match(pitchEffectLine('Flat'), /batting \+2, fast -2, fast medium -2, medium -1, spin -2/);
  assert.equal(pitchEffectLine('nope'), '');
});
test('weather notes', () => {
  assert.match(weatherEffectLine('Sunny'), /fast bowlers and spinners/);
  assert.match(weatherEffectLine('Partially Cloudy'), /spinners and medium/);
  assert.match(weatherEffectLine('humid'), /all bowlers/);
  assert.equal(weatherEffectLine(''), '');
});
test('aggression levels', () => {
  assert.equal(aggressionLevel('destructive'), 4);
  assert.equal(aggressionLevel('defensive'), 0);
  assert.equal(aggressionLevel('a cautious RH batter'), 1);
  assert.equal(aggressionLevel(''), -1);
  assert.equal(aggressionLabel('Attacking'), 'attacking');
});
test('parseOvers handles ranges and lists', () => {
  assert.deepEqual(parseOvers('1-3, 45-46'), [1, 2, 3, 45, 46]);
  assert.deepEqual(parseOvers('1,3,5'), [1, 3, 5]);
});
test('transcription check: every EXACT OD preset assigns overs 1-50 once, 10 each, none consecutive', () => {
  const exact = OD_BOWLING_PRESETS.filter((p) => p.kind === 'exact');
  assert.equal(exact.length, 8);
  for (const p of exact) {
    const all: number[] = [];
    p.bowlers.forEach((spec, i) => {
      const o = parseOvers(spec);
      assert.equal(o.length, 10, `${p.name} B${i + 1} has ${o.length} overs`);
      const s = [...o].sort((a, b) => a - b);
      for (let k = 1; k < s.length; k++) assert.notEqual(s[k], s[k - 1] + 1, `${p.name} B${i + 1} bowls consecutive overs ${s[k - 1]},${s[k]}`);
      all.push(...o);
    });
    assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i + 1), p.name);
  }
});
test('there are 14 OD presets, each with 5 bowler slots; window presets stay inside 1-50', () => {
  assert.equal(OD_BOWLING_PRESETS.length, 14);
  for (const p of OD_BOWLING_PRESETS) {
    assert.equal(p.bowlers.length, 5, p.name);
    for (const s of p.bowlers) for (const o of parseOvers(s)) assert.ok(o >= 1 && o <= 50, `${p.name}: ${o}`);
  }
});
test('BT20 default order covers overs 1-20, max 4 overs each', () => {
  const all = BT20_DEFAULT_ORDER.flatMap(parseOvers);
  assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  for (const s of BT20_DEFAULT_ORDER) assert.equal(parseOvers(s).length, 4);
});
test('phase profile: Openers through gives B1/B2 no death overs; Default gives them opening AND death', () => {
  const through = presetProfile(OD_BOWLING_PRESETS.find((p) => p.name === 'Openers through')!);
  assert.deepEqual(through[0].phases, ['opening', 'middle']);
  assert.ok(through[2].phases.includes('death'));
  const def = presetProfile(OD_BOWLING_PRESETS.find((p) => p.name === 'Default orders')!);
  assert.ok(def[0].phases.includes('opening') && def[0].phases.includes('death'));
});
test('conditions block: format-specific rules and pitch/weather lines', () => {
  const od = buildConditionsBlock({ format: 'One Day', pitch: 'Flat', weather: 'Sunny' });
  assert.match(od, /Flat pitch effect/);
  assert.match(od, /max 10 overs each/);
  assert.match(od, /Openers through/);
  const t20 = buildConditionsBlock({ format: 'Twenty20' });
  assert.match(t20, /max 4 overs each/);
  assert.doesNotMatch(t20, /Openers through/);
  assert.match(buildConditionsBlock({ format: 'First Class' }), /at least 4 bowlers/);
});
test('describeStyles', () => {
  assert.equal(describeStyles({ battingStyle: 'steady', bowlingType: 'RFM', bowlingAggression: 'attacking' }), 'Bats: steady | Bowls: Fast Medium, bowling style attacking');
  assert.equal(describeStyles({ battingStyle: 'cautious', bowlingType: 'None' }), 'Bats: cautious');
});
test('match orders use the five in-game names, never N / A / D', () => {
  assert.deepEqual([...ORDER_LEVELS], ['Very Defensive', 'Defensive', 'Normal', 'Attacking', 'Very Attacking']);
  assert.match(BATTRICK_MECHANICS_PROMPT, /Very Defensive, Defensive, Normal, Attacking, Very Attacking/);
  assert.doesNotMatch(BATTRICK_MECHANICS_PROMPT, /A \(attacking\)|N \(normal\)|\bA\/N\/D\b/);
});
const P = (name: string, leadership: number, experience: number, keeping = 0, fielding = 0, concentration = 0, consistency = 0) =>
  ({ name, skills: { leadership, experience, keeping, fielding, concentration, consistency } });
test('captain: highest leadership first, then experience, then name', () => {
  const r = rankCaptainCandidates([P('Cal', 10, 5), P('Abe', 14, 3), P('Bob', 14, 9), P('Dan', 14, 9)]);
  assert.deepEqual(r.map((p) => p.name), ['Bob', 'Dan', 'Abe', 'Cal']);
});
test('keeper: needs a keeping skill; ties broken by fielding + concentration + consistency', () => {
  const r = rankKeeperCandidates([P('Ann', 5, 5, 0, 15), P('Ben', 5, 5, 12, 5, 5, 5), P('Cy', 5, 5, 12, 9, 9, 9), P('Di', 5, 5, 8)]);
  assert.deepEqual(r.map((p) => p.name), ['Cy', 'Ben', 'Di']);
});
test('shortlist comes from the XI when one is picked, otherwise the whole squad', () => {
  const squad = [P('Star', 18, 15, 0), P('Mid', 12, 10, 14, 8, 8, 8), P('Low', 6, 4, 0), P('Keep', 9, 9, 16, 9, 9, 9)];
  const withXI = captainKeeperBlock(squad, ['Mid', 'Low', 'Keep']);
  assert.match(withXI, /from the picked XI/);
  assert.ok(!withXI.includes('Star'));
  assert.match(withXI, /Captain shortlist from the picked XI, best first[^:]*: Mid \(leadership 12/);
  const noXI = captainKeeperBlock(squad, []);
  assert.match(noXI, /whole squad/);
  assert.match(noXI, /: Star \(leadership 18, experience 15\)/);
});
console.log(`\n${n} scenarios passed`);
