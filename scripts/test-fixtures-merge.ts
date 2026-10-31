/** Run: npm run test:fixtures */
import assert from 'node:assert/strict';
import { mergeFixtures, countUpcoming, fixtureKey } from '../src/utils/fixturesMerge';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }
const g = (o: any) => ({ date: '01/11', opponent: 'X', type: 'One Day', venue: 'Home', ...o });

test('new page wins for core fields; stored team ids survive', () => {
  const old = [g({ matchId: '1', opponent: 'Old Name', homeTeamId: '10', awayTeamId: '20', opponentTeamId: '20', section: 'upcoming' })];
  const inc = [g({ matchId: '1', opponent: 'Bulolo Seahawks', venue: 'Away', section: 'upcoming' })];
  const out = mergeFixtures(old as any, inc as any);
  assert.equal(out.length, 1);
  assert.equal(out[0].opponent, 'Bulolo Seahawks');
  assert.equal(out[0].venue, 'Away');
  assert.equal(out[0].homeTeamId, '10');
  assert.equal(out[0].opponentTeamId, '20');
});
test('empty values from the page never wipe richer stored data', () => {
  const old = [g({ matchId: '1', matchUrl: 'matchinfo.asp?matchID=1', section: 'upcoming' })];
  const inc = [g({ matchId: '1', matchUrl: '', section: 'upcoming' })];
  assert.equal(mergeFixtures(old as any, inc as any)[0].matchUrl, 'matchinfo.asp?matchID=1');
});
test('a match that gets played picks up its result and moves to previous', () => {
  const old = [g({ matchId: '1', section: 'upcoming' })];
  const inc = [g({ matchId: '1', section: 'previous', result: 'Won by 3 wickets' })];
  const out = mergeFixtures(old as any, inc as any);
  assert.equal(out[0].section, 'previous');
  assert.equal(out[0].result, 'Won by 3 wickets');
});
test('played matches that left the page are kept; stale upcoming ones are dropped', () => {
  const old = [
    g({ matchId: '1', section: 'previous', result: 'Lost', homeTeamId: '10' }),
    g({ matchId: '2', section: 'upcoming' }),
  ];
  const inc = [g({ matchId: '3', section: 'upcoming' })];
  const out = mergeFixtures(old as any, inc as any);
  assert.deepEqual(out.map((f) => f.matchId), ['1', '3']);
  assert.equal(out[0].homeTeamId, '10');
});
test('new upcoming fixtures are added and counted', () => {
  const out = mergeFixtures([], [g({ matchId: '5', section: 'upcoming' }), g({ matchId: '6', section: 'upcoming' }), g({ matchId: '4', section: 'previous', result: 'Won' })] as any);
  assert.equal(out.length, 3);
  assert.equal(countUpcoming(out), 2);
});
test('fixtures without a match id still match on date + teams', () => {
  const a = g({ date: '05/11', homeTeam: 'A', awayTeam: 'B' });
  assert.equal(fixtureKey(a as any), fixtureKey({ ...a } as any));
  const out = mergeFixtures([{ ...a, homeTeamId: '9' }] as any, [{ ...a, venue: 'Away' }] as any);
  assert.equal(out.length, 1);
  assert.equal(out[0].homeTeamId, '9');
});
console.log(`\n${n} scenarios passed`);
