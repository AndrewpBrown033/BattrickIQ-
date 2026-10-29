/** Run: npm run test:skillcard */
import assert from 'node:assert/strict';
import { buildSkillCard, teamAlignment, alignmentTone } from '../src/utils/playerSkillCard';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }

const squad = [
  { id: '1', name: 'A', age: 27, role: 'Batter', skills: { batting: 8, bowling: 2, keeping: 1 }, btRating: 100000, wage: 40000 },
  { id: '2', name: 'B', age: 25, role: 'Batter', skills: { batting: 6, bowling: 2, keeping: 1 }, btRating: 90000, wage: 35000 },
  { id: '3', name: 'C', age: 29, role: 'Bowler', skills: { batting: 3, bowling: 9, keeping: 1 }, btRating: 110000, wage: 45000 },
  { id: '4', name: 'D', age: 24, role: 'Bowler', skills: { batting: 3, bowling: 7, keeping: 1 }, btRating: 95000, wage: 38000 },
];

test('card shows only skills that were read, with strengths best-first', () => {
  const c = buildSkillCard({ batting: 12, bowling: 3, fielding: 9, stamina: 0 });
  assert.deepEqual(c.rows.map((r) => r.key), ['batting', 'bowling', 'fielding']);
  assert.deepEqual(c.strengths, ['Batting', 'Fielding']);
  assert.equal(c.rows[0].pct, 60);
});
test('card with no skills is flagged and empty', () => {
  const c = buildSkillCard({});
  assert.equal(c.hasSkills, false);
  assert.equal(buildSkillCard(null).rows.length, 0);
});
test('values are capped at the top of the scale', () => {
  assert.equal(buildSkillCard({ batting: 25 }).rows[0].pct, 100);
});
test('a clear upgrade scores higher than a player below squad standard', () => {
  const star = teamAlignment({ name: 'S', age: 21, role: 'Batter', skills: { batting: 13 }, btRating: 160000 }, squad)!;
  const dud = teamAlignment({ name: 'D', age: 33, role: 'Batter', skills: { batting: 3 }, btRating: 40000 }, squad)!;
  assert.ok(star.score > dud.score, `${star.score} vs ${dud.score}`);
  assert.ok(star.score >= 0 && star.score <= 100 && dud.score >= 0 && dud.score <= 100);
});
test('no squad or no skills gives no score rather than a guess', () => {
  assert.equal(teamAlignment({ name: 'X', age: 20, skills: { batting: 10 } }, []), null);
  assert.equal(teamAlignment({ name: 'X', age: 20, skills: {} }, squad), null);
});
test('tone bands', () => {
  assert.equal(alignmentTone(80), 'good');
  assert.equal(alignmentTone(50), 'ok');
  assert.equal(alignmentTone(20), 'poor');
});
console.log(`\n${n} scenarios passed`);
