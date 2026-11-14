/** Run: npm run test:sanitize */
import assert from 'node:assert/strict';
import { sanitizeSquad, sanitizePlayer, repairStoredSquad, toNum } from '../src/utils/sanitizeSquad';
import { estimateTeamRatings } from '../src/utils/transferList';
import { getPlayerGrade } from '../src/utils/playerGrade';
import { buildTrainingBriefing } from '../src/utils/trainingAdvice';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }
const memStore = (init?: string) => { let v = init ?? null; return { getItem: () => v, setItem: (_k: string, x: string) => { v = x; }, get value() { return v; } } as any; };

test('numbers saved as text are read as numbers', () => {
  assert.equal(toNum('1,500'), 1500);
  assert.equal(toNum('£2,150'), 2150);
  assert.equal(toNum(' 7 '), 7);
  assert.equal(toNum('abc', 3), 3);
  assert.equal(toNum(NaN, 2), 2);
  const p = sanitizePlayer({ id: 1, name: 'A', age: '24', wage: '1,500', skills: { batting: '7' }, nets: { batting: '2' } })!;
  assert.equal(p.age, 24); assert.equal(p.wage, 1500); assert.equal(p.skills.batting, 7); assert.equal(p.nets.batting, 2);
});
test('missing skills / nets become complete zeroed objects', () => {
  const p = sanitizePlayer({ id: '1', name: 'A' })!;
  assert.deepEqual(Object.values(p.skills).every((v) => v === 0), true);
  assert.deepEqual(p.nets, { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 });
});
test('junk entries are dropped, non-arrays give an empty squad', () => {
  assert.equal(sanitizeSquad([null, 5, 'x', [], { id: '1', name: 'A' }]).length, 1);
  assert.deepEqual(sanitizeSquad({ players: [] } as any), []);
  assert.deepEqual(sanitizeSquad(undefined), []);
});
test('other player fields are preserved and skills are clamped to 0-20', () => {
  const p = sanitizePlayer({ id: '1', name: 'A', role: 'Bowler', teamName: 'X', skills: { bowling: 99, batting: -4 } })!;
  assert.equal(p.role, 'Bowler'); assert.equal((p as any).teamName, 'X');
  assert.equal(p.skills.bowling, 20); assert.equal(p.skills.batting, 0);
});
test('missing ids and names get safe placeholders', () => {
  const p = sanitizePlayer({}, 4)!;
  assert.equal(p.id, 'player-4'); assert.match(p.name, /Player/);
});

test('repair rewrites only when something changed, and handles {players: []}', () => {
  const dirty = memStore(JSON.stringify([{ id: '1', name: 'A', skills: { batting: '7' } }]));
  assert.equal(repairStoredSquad(dirty), true);
  assert.equal(JSON.parse(dirty.value)[0].skills.batting, 7);
  assert.equal(repairStoredSquad(dirty), false, 'second run is a no-op');
  const wrapped = memStore(JSON.stringify({ players: [{ id: '1', name: 'A' }] }));
  assert.equal(repairStoredSquad(wrapped), true);
  assert.ok(Array.isArray(JSON.parse(wrapped.value)));
  assert.equal(repairStoredSquad(memStore('{not json')), false);
  assert.equal(repairStoredSquad(memStore(undefined)), false);
});

test('the crashes that blanked the Squad page no longer happen, even on unsanitised data', () => {
  const bad: any[] = [{ name: 'NoSkills' }, { name: 'Strings', skills: { batting: '7', bowling: '3', keeping: '1' } }];
  assert.doesNotThrow(() => estimateTeamRatings(bad as any));
  for (const p of bad) assert.doesNotThrow(() => getPlayerGrade(p as any));
  assert.doesNotThrow(() => buildTrainingBriefing(bad as any, null));
});

console.log(`\n${n} tests passed`);
