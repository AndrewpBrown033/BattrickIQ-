/** Run: npm run test:training */
import assert from 'node:assert/strict';
import { buildTrainingBriefing, suggestNetAllocation, netsUsed, weeksFor, TRAINING_MECHANICS_PROMPT } from '../src/utils/trainingAdvice';
import { estimateWeeksToNextLevel as helperWeeks } from '../src/components/squad/squadHelpers';
import { estimateWeeksToNextLevel as realWeeks } from '../src/parser';
import { JARVIS_SYSTEM_PROMPT } from '../src/utils/jarvisContext';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }

const P = (id: string, name: string, age: number, skills: any, nets: any = {}, role = ''): any =>
  ({ id, name, age, role, skills: { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0, ...skills },
     nets: { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0, ...nets } });

const squad = [
  P('1', 'Young Bat', 18, { batting: 7, stamina: 5 }, {}, 'Batter'),
  P('2', 'Prime Bat', 26, { batting: 12 }, { batting: 2 }, 'Batter'),
  P('3', 'Old Bowler', 33, { bowling: 11 }, { bowling: 1 }, 'Bowler'),
  P('4', 'Young Bowler', 19, { bowling: 6 }, {}, 'Bowler'),
  P('5', 'Keeper', 24, { keeping: 9, batting: 4 }, { stamina: 1 }, 'Keeper'),
];

test('the Training tab now uses the real forecast, not the old simplified formula', () => {
  assert.equal(helperWeeks, realWeeks, 'squadHelpers must re-export the parser forecast');
  assert.equal(helperWeeks(3, 25, 1, 9, 'stamina'), 6); // published stamina table, was 12+ with the old maths
});

test('stamina and fielding use their own rules, not the batting curve', () => {
  const bat = realWeeks(5, 25, 1, 9, 'batting');
  const sta = realWeeks(5, 25, 1, 9, 'stamina');
  assert.notEqual(bat, sta);
  assert.equal(sta, 6);
  assert.equal(realWeeks(11, 25, 1, 9, 'stamina'), 0); // stamina caps at 11
});

test('net budget is counted and free nets never exceed what is left', () => {
  assert.equal(netsUsed(squad), 4);
  const sug = suggestNetAllocation(squad, 6);
  assert.equal(sug.reduce((s, x) => s + x.nets, 0), 6);
  assert.ok(suggestNetAllocation(squad, 0).length === 0);
});

test('suggestions favour young players and are deterministic', () => {
  const a = suggestNetAllocation(squad, 4);
  const b = suggestNetAllocation(squad, 4);
  assert.deepEqual(a, b);
  const names = a.map((x) => x.name);
  assert.ok(names.includes('Young Bat') || names.includes('Young Bowler'), 'a young player should get nets');
  assert.ok(!names.includes('Old Bowler') || a.find((x) => x.name === 'Old Bowler')!.nets <= 1);
  for (const s of a) assert.ok(s.weeksAfter <= s.weeksBefore, `${s.name} should not get slower`);
});

test('a team-rating gap pulls nets toward the skill that closes it', () => {
  const noGap = suggestNetAllocation(squad, 1);
  const bowlGap = suggestNetAllocation(squad, 1, [{ key: 'seamBowling', current: 3, target: 9, gap: 6 }]);
  assert.ok(bowlGap[0].skill === 'bowling');
  assert.ok(noGap.length === 1);
});

test('briefing has the facts Jarvis needs and no NaN / Infinity', () => {
  const t = buildTrainingBriefing(squad, { battingCoaches: 1, psychologists: 0 } as any, [{ key: 'topOrder', current: 5, target: 12, gap: 7 }]);
  assert.match(t, /\[TRAINING/);
  assert.match(t, /4 of 10 assigned, 6 free/);
  assert.match(t, /Prime Bat/);
  assert.match(t, /Young Bat/);
  assert.match(t, /Concentration and Consistency cannot be trained/);
  assert.match(t, /Suggested use of the 6 free net/);
  assert.ok(!/NaN|Infinity|undefined/.test(t), t);
});

test('handles empty squad, missing finances, and players with no skills', () => {
  assert.match(buildTrainingBriefing([], null), /No squad synced/);
  const odd: any[] = [{ id: 'x', name: 'Sparse' }, P('y', 'Full', 22, { batting: 5 })];
  const t = buildTrainingBriefing(odd, null);
  assert.ok(!/NaN|Infinity|undefined/.test(t), t);
  assert.match(t, /Staff: not synced/);
});

test('all nets used: says so and suggests nothing', () => {
  const full = [P('1', 'A', 20, { batting: 5 }, { batting: 4 }), P('2', 'B', 21, { bowling: 5 }, { bowling: 3 }), P('3', 'C', 22, { keeping: 5 }, { keeping: 3 })];
  const t = buildTrainingBriefing(full, null);
  assert.match(t, /10 of 10 assigned, 0 free/);
  assert.match(t, /All nets are in use/);
  assert.ok(!/Suggested use/.test(t));
});

test('Jarvis system prompt carries the training rules; mechanics prompt is accurate to the code', () => {
  assert.ok(JARVIS_SYSTEM_PROMPT.includes('TRAINING MECHANICS'));
  assert.ok(JARVIS_SYSTEM_PROMPT.includes('[TRAINING] section'));
  assert.ok(!JARVIS_SYSTEM_PROMPT.includes('\\\\n'), 'no literal backslash-n in the prompt');
  assert.match(TRAINING_MECHANICS_PROMPT, /10 nets/);
  assert.match(TRAINING_MECHANICS_PROMPT, /1\.75x/);
  assert.match(TRAINING_MECHANICS_PROMPT, /6 \/ 4 \/ 3 weeks/);
  assert.equal(weeksFor(squad[0], 'stamina', 1), 6);
});

console.log(`\n${n} tests passed`);
