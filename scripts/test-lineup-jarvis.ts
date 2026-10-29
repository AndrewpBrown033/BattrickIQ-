/** Run: npm run test:lineupjarvis */
import assert from 'node:assert/strict';
import { buildLineupBriefing, nextUpcomingFixture } from '../src/utils/lineupJarvis';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }

const squad = [
  { id: '1', name: 'Alan Smith', role: 'Batter', skills: { batting: 9, bowling: 2, keeping: 1 } },
  { id: '2', name: 'Bob Jones', role: 'Bowler', skills: { batting: 3, bowling: 10, keeping: 1 }, bowlingType: 'Fast' },
  { id: '3', name: 'Carl Wu', role: 'Keeper', skills: { batting: 6, bowling: 1, keeping: 11 } },
];
const xi = [{ name: 'Alan Smith', role: 'Batter', batting: 9 }, { name: 'Bob Jones', role: 'Bowler', bowling: 10, bowlingType: 'Fast' }];
const fixture = { homeTeam: 'Bulolo Seahawks', awayTeam: 'My FC', homeTeamId: '222', awayTeamId: '111', venue: 'Away', type: 'League', date: '31/10' };

test('next upcoming fixture skips played games', () => {
  const f = nextUpcomingFixture([{ result: '3-1' } as any, { result: 'Upcoming', homeTeam: 'X' }, { homeTeam: 'Y' }]);
  assert.equal(f?.homeTeam, 'X');
  assert.equal(nextUpcomingFixture([]), null);
  assert.equal(nextUpcomingFixture(undefined), null);
});
test('opponent is the other side from our identity; scouted roster is used', () => {
  const b = buildLineupBriefing({
    xi, squad, fixture, own: { teamId: '111' },
    opponentPlayers: [{ id: '900', name: 'Dan Hart', role: 'Bowler', bowling: 8 }, { id: '901', name: 'Ed Park' }],
  });
  assert.equal(b.opponentName, 'Bulolo Seahawks');
  assert.equal(b.opponentStatus, 'real');
  assert.ok(b.text.includes('Dan Hart'));
});
test('a roster that is really our own squad is reported unavailable, never listed as theirs', () => {
  const b = buildLineupBriefing({
    xi, squad, fixture, own: { teamId: '111' },
    opponentPlayers: squad.map((p) => ({ id: p.id, name: p.name })),
  });
  assert.equal(b.opponentStatus, 'unavailable');
  assert.ok(b.text.includes('squad is unavailable'));
  assert.ok(b.text.includes('No opponent players available'));
});
test('no fixture still gives a usable briefing', () => {
  const b = buildLineupBriefing({ xi, squad, fixture: null });
  assert.ok(b.text.includes('No upcoming fixture'));
  assert.equal(b.opponentStatus, 'unavailable');
});
test('full squad and XI are both included', () => {
  const b = buildLineupBriefing({ xi, squad, fixture });
  assert.ok(b.text.includes('Carl Wu'));
  assert.ok(b.text.includes('1. Alan Smith'));
});
console.log(`\n${n} scenarios passed`);
