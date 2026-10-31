/** Scenario tests for the club cash-flow model. Run: npm run test:cashflow */
import assert from 'node:assert/strict';
import { computeCashflow, isHomeFixture, describeCashflow } from '../src/utils/clubCashflow';

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log('  ok  ' + name); };

const NOW = new Date(2026, 10, 1, 9, 0).getTime(); // Sun 1 Nov 2026
const ME = { teamId: '5250', teamName: 'Hairy Bean Bags' };

const week = (date: string, over: any = {}) => ({
  date, playerSalaries: 60_000, staffSalaries: 8_000, groundMaintenance: 4_000,
  sponsorship: 30_000, interestReceived: 2_000, interestPaid: 0, ...over,
});
// weekly: income 32k, costs 72k -> -40k a week on its own
const fin: any = {
  cash: 300_000,
  sponsorsIncome: 30_000, interestReceived: 2_000, playerWages: 60_000, staffWages: 8_000, gateReceipts: 90_000,
  weeklyHistory: [week('2026-10-18'), week('2026-10-25')],
  gateHistory: [{ date: '2026-10-10', amount: 100_000 }, { date: '2026-10-17', amount: 110_000 }, { date: '2026-10-24', amount: 90_000 }],
};
const fx = (date: string, home: boolean, extra: any = {}) => ({
  date, time: '12:00', type: 'League', opponent: 'X', result: 'Upcoming',
  homeTeam: home ? 'Hairy Bean Bags' : 'X', awayTeam: home ? 'X' : 'Hairy Bean Bags',
  homeTeamId: home ? '5250' : '7001', awayTeamId: home ? '7001' : '5250', venue: home ? 'Home' : 'Away', ...extra,
});
// 4 games left, one a week, 3 at home
const fixtures: any[] = [fx('03/11/2026', true), fx('10/11/2026', false), fx('17/11/2026', true), fx('24/11/2026', true)];

test('the reported case: 4 games, 3 home -> season projection is POSITIVE even though a bare week is negative', () => {
  const c = computeCashflow(fin, fixtures, ME, NOW);
  assert.equal(c.weekly.net, -40_000);
  assert.equal(c.gate.average, 100_000);
  assert.deepEqual([c.remaining.games, c.remaining.home, c.remaining.away, c.remaining.weeks], [4, 3, 1, 4]);
  assert.equal(c.projectedNet, 4 * -40_000 + 3 * 100_000); // +140k
  assert.equal(c.projectedCash, 440_000);
  assert.equal(c.avgWeeklyNet, 35_000);
  assert.ok(c.avgWeeklyNet > 0);
});

test('old formula would be wrong here: one gate added to weekly figures ignored maintenance and home count', () => {
  const old = (fin.sponsorsIncome + fin.gateReceipts + fin.interestReceived) - (fin.playerWages + fin.staffWages);
  const c = computeCashflow(fin, fixtures, ME, NOW);
  assert.notEqual(old, c.avgWeeklyNet);
});

test('home/away comes from our team id, not the venue flag (parser default is Home)', () => {
  const wrong = fx('03/11/2026', false, { venue: 'Home' }); // we are the away side but flagged Home
  assert.deepEqual(isHomeFixture(wrong, ME), { home: false, certain: true });
  const c = computeCashflow(fin, [wrong], ME, NOW);
  assert.equal(c.remaining.home, 0);
  assert.equal(c.remaining.away, 1);
});

test('unknown own identity falls back to venue and says it is not certain', () => {
  const c = computeCashflow(fin, fixtures, {}, NOW);
  assert.equal(c.remaining.home, 3);
  assert.equal(c.remaining.homeAwayCertain, false);
  assert.ok(c.notes.some((x) => /venue flag/.test(x)));
});

test('only the last 5 gates are averaged', () => {
  const g = [10, 10, 10, 100, 100, 100, 100, 100].map((k, i) => ({ date: `2026-09-0${i + 1}`, amount: k * 1000 }));
  const c = computeCashflow({ ...fin, gateHistory: g }, fixtures, ME, NOW);
  assert.equal(c.gate.average, 100_000);
  assert.equal(c.gate.samples, 5);
});

test('two games in one week pay one weekly bill', () => {
  const two = [fx('03/11/2026', true), fx('05/11/2026', true)];
  const c = computeCashflow(fin, two, ME, NOW);
  assert.equal(c.remaining.weeks, 1);
  assert.equal(c.projectedNet, -40_000 + 2 * 100_000);
});

test('played games and past-dated "upcoming" rows are not counted', () => {
  const list = [fx('03/11/2026', true), fx('05/10/2026', true), fx('27/10/2026', true, { result: '212/5 v 180' })];
  const c = computeCashflow(fin, list, ME, NOW);
  assert.equal(c.remaining.games, 1);
});

test('no ledger: falls back to synced summary fields incl. maintenance, no gate double count', () => {
  const noLedger = { ...fin, weeklyHistory: undefined, gateHistory: undefined, groundMaintenance: 4_000 };
  const c = computeCashflow(noLedger, fixtures, ME, NOW);
  assert.equal(c.weekly.source, 'latest-sync');
  assert.equal(c.weekly.net, 32_000 - 72_000);
  assert.equal(c.gate.samples, 1);
  assert.equal(c.gate.average, 90_000);
});

test('no gate data: home games count as £0 and the page says so', () => {
  const c = computeCashflow({ ...fin, gateHistory: undefined, gateReceipts: 0 }, fixtures, ME, NOW);
  assert.equal(c.gate.average, 0);
  assert.ok(c.notes.some((x) => /No gate/.test(x)));
});

test('no fixtures: only the bare weekly figure, flagged, never invented', () => {
  const c = computeCashflow(fin, [], ME, NOW);
  assert.equal(c.remaining.fixturesKnown, false);
  assert.equal(c.avgWeeklyNet, -40_000);
  assert.equal(c.projectedNet, -40_000);
  assert.ok(c.notes.some((x) => /No upcoming fixtures/.test(x)));
});

test('no finances at all is safe', () => {
  const c = computeCashflow(null, fixtures, ME, NOW);
  assert.equal(c.cash, 0);
  assert.ok(Number.isFinite(c.projectedNet) && Number.isFinite(c.avgWeeklyNet));
});

test('a genuinely bad club stays negative (model is not just optimistic)', () => {
  const c = computeCashflow({ ...fin, gateHistory: [{ date: '2026-10-10', amount: 10_000 }] }, fixtures, ME, NOW);
  assert.equal(c.projectedNet, 4 * -40_000 + 3 * 10_000);
  assert.ok(c.avgWeeklyNet < 0);
});

test('description is readable and has no NaN', () => {
  const t = describeCashflow(computeCashflow(fin, fixtures, ME, NOW));
  assert.ok(t.includes('4 games left (3 home, 1 away)'), t);
  assert.ok(!/NaN|undefined/.test(t), t);
});

console.log(`\n${n} scenarios passed`);
