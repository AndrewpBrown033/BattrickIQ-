/**
 * Scenario tests for opponent resolution. Run: npm run test:opponent
 * (plain node:assert, no test framework in this repo)
 */
import assert from 'node:assert/strict';
import {
  resolveFixtureOpponent,
  looksLikeMySquad,
  stripMine,
  sameTeamName,
  countOverlap,
} from '../src/utils/opponentResolve';

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log('  ok  ' + name);
}

const ME = { teamId: '5250', teamName: 'Hairy Bean Bags' };

test('away game where the parser recorded OUR club as the opponent (the bug) -> picks the home side', () => {
  // parser default: opponent = awayTeam, venue = 'Home' - but we are actually the away team
  const r = resolveFixtureOpponent(
    {
      homeTeam: 'Bulolo Seahawks', awayTeam: 'Hairy Bean Bags',
      homeTeamId: '7001', awayTeamId: '5250',
      opponent: 'Hairy Bean Bags', opponentTeamId: '5250', venue: 'Home',
    },
    ME
  );
  assert.deepEqual(r.opponent, { name: 'Bulolo Seahawks', teamId: '7001' });
  assert.deepEqual(r.alternate, { name: 'Hairy Bean Bags', teamId: '5250' });
  assert.equal(r.certain, true);
});

test('home game resolves to the away side', () => {
  const r = resolveFixtureOpponent(
    { homeTeam: 'Hairy Bean Bags', awayTeam: 'Atlanta Braves', homeTeamId: '5250', awayTeamId: '7002', opponent: 'Atlanta Braves', venue: 'Home' },
    ME
  );
  assert.deepEqual(r.opponent, { name: 'Atlanta Braves', teamId: '7002' });
  assert.equal(r.certain, true);
});

test('own id alone (name unknown / placeholder) is enough', () => {
  const r = resolveFixtureOpponent(
    { homeTeam: 'Steve', awayTeam: 'Some Club', homeTeamId: '7003', awayTeamId: '5250', opponent: 'Some Club', opponentTeamId: '5250' },
    { teamId: '5250', teamName: 'My Battrick IQ Club' }
  );
  assert.equal(r.opponent.teamId, '7003');
  assert.equal(r.certain, true);
});

test('own name alone is enough (id unknown)', () => {
  const r = resolveFixtureOpponent(
    { homeTeam: 'Sandshoe Crushers', awayTeam: 'hairy  bean bags', opponent: 'hairy  bean bags' },
    { teamName: 'Hairy Bean Bags' }
  );
  assert.equal(r.opponent.name, 'Sandshoe Crushers');
  assert.equal(r.certain, true);
});

test('fuzzy substring must NOT make an opponent look like us', () => {
  const r = resolveFixtureOpponent(
    { homeTeam: 'Royal West Herts GC', awayTeam: 'Hairy Bean Bags', homeTeamId: '7004', awayTeamId: '5250' },
    { teamName: 'Royal', teamId: '' }
  );
  // "Royal" is not exactly either club, so identity can't decide -> not certain, never a false "that's us"
  assert.equal(r.certain, false);
});

test('identity unknown: uncertain, keeps the stored side and offers the other as alternate', () => {
  const r = resolveFixtureOpponent(
    { homeTeam: 'A FC', awayTeam: 'B FC', homeTeamId: '1', awayTeamId: '2', opponent: 'B FC', opponentTeamId: '2', venue: 'Home' },
    {}
  );
  assert.deepEqual(r.opponent, { name: 'B FC', teamId: '2' });
  assert.deepEqual(r.alternate, { name: 'A FC', teamId: '1' });
  assert.equal(r.certain, false);
});

test('identity unknown and no stored opponent: venue Away means they are the home side', () => {
  const r = resolveFixtureOpponent({ homeTeam: 'A FC', awayTeam: 'B FC', homeTeamId: '1', awayTeamId: '2', venue: 'Away' }, {});
  assert.equal(r.opponent.name, 'A FC');
  assert.equal(r.certain, false);
});

test('legacy fixture with only opponent + venue still resolves', () => {
  const r = resolveFixtureOpponent({ opponent: 'Bulolo Seahawks', opponentTeamId: '7001', venue: 'Home' }, ME);
  assert.deepEqual(r.opponent, { name: 'Bulolo Seahawks', teamId: '7001' });
  assert.equal(r.alternate, null);
});

test('numeric ids from older stored fixtures are handled', () => {
  const r = resolveFixtureOpponent(
    { homeTeam: 'X', awayTeam: 'Me', homeTeamId: 9 as any, awayTeamId: 5250 as any },
    { teamId: '5250' }
  );
  assert.deepEqual(r.opponent, { name: 'X', teamId: '9' });
});

test('sameTeamName is exact but forgiving about case/punctuation', () => {
  assert.equal(sameTeamName("St. John's  XI", 'st johns xi'), true);
  assert.equal(sameTeamName('Royals', 'Royal West Herts GC'), false);
  assert.equal(sameTeamName('', ''), false);
});

// --- roster-is-mine detection ------------------------------------------------------------------
const mine = Array.from({ length: 15 }, (_, i) => ({ id: String(1000 + i), name: `My Player ${i}` }));
const theirs = Array.from({ length: 15 }, (_, i) => ({ id: String(2000 + i), name: `Their Player ${i}` }));

test('their real squad is not flagged', () => {
  assert.equal(looksLikeMySquad(theirs, mine), false);
});

test('our own squad fetched as "opponent" is flagged (by id)', () => {
  assert.equal(looksLikeMySquad(mine, mine), true);
});

test('archive-predicted lineup built from our own matches is flagged (no ids, names only)', () => {
  const predicted = mine.slice(0, 11).map((p, i) => ({ id: `pred_${i}_${p.name}`, name: p.name.toUpperCase() }));
  assert.equal(looksLikeMySquad(predicted, mine), true);
});

test('one or two coincidental shared names do not flag a squad of 15', () => {
  const r = [...theirs.slice(0, 13), { id: '2901', name: 'My Player 3' }, { id: '2902', name: 'My Player 4' }];
  assert.equal(countOverlap(r, mine), 2);
  assert.equal(looksLikeMySquad(r, mine), false);
});

test('empty / missing inputs are safe', () => {
  assert.equal(looksLikeMySquad([], mine), false);
  assert.equal(looksLikeMySquad(theirs, []), false);
  assert.deepEqual(stripMine(theirs, []), theirs);
});

test('stripMine removes only players with one of our Battrick ids', () => {
  const mixed = [...theirs.slice(0, 5), mine[0], mine[1]];
  const out = stripMine(mixed, mine);
  assert.equal(out.length, 5);
  assert.ok(out.every((p) => p.id.startsWith('2')));
});

console.log(`\n${n} scenarios passed`);
