/**
 * Scenario tests for the Watch "Jarvis check". Run: npm run test:watch-fit
 * (plain node:assert, no test framework in this repo)
 */
import assert from 'node:assert/strict';
import {
  buildWatchFit,
  buildWatchFitBriefing,
  profileFromWatchEntry,
  skillsWereRead,
  weeklySurplus,
  WATCH_FIT_SYSTEM_PROMPT,
  type WatchSquadPlayer,
  type WatchFinances,
} from '../src/utils/watchFit';

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log('  ok  ' + name);
}

const P = (name: string, age: number, wage: number, bat: number, bowl: number, keep = 0, bowlingType = 'Medium'): WatchSquadPlayer => ({
  name, age, wage, btRating: 9000,
  skills: { batting: bat, bowling: bowl, keeping: keep, fielding: 7, stamina: 8, concentration: 6, consistency: 6 },
  bowlingType,
});

// A middling squad: batting ~7, bowling ~7, weak keeper
const squad: WatchSquadPlayer[] = [
  P('Ann', 27, 9000, 8, 2), P('Bob', 26, 8000, 7, 2), P('Cal', 25, 7000, 7, 3), P('Dan', 28, 7500, 6, 3),
  P('Eve', 24, 6000, 6, 4), P('Fay', 29, 6500, 5, 4, 2), P('Gus', 30, 6000, 3, 8), P('Hal', 27, 7000, 3, 7),
  P('Ian', 25, 5000, 2, 7), P('Jon', 31, 5500, 2, 6), P('Kim', 22, 4000, 4, 5), P('Leo', 23, 3000, 3, 4),
];

// income 100k - wages (players 90k + staff 5k) = +5k/wk surplus
const fin: WatchFinances = { cash: 400_000, sponsorsIncome: 60_000, gateReceipts: 38_000, interestReceived: 2_000, playerWages: 90_000, staffWages: 5_000 };
const targets = { topOrder: 11, bowlingDummy: 0 } as any;
delete targets.bowlingDummy;

const star = { name: 'Star Bat', age: 21, wage: 12_000, skills: { batting: 12, bowling: 2, keeping: 0, fielding: 7, stamina: 8, concentration: 8, consistency: 8 } };
const check = (e: any, o: Partial<Parameters<typeof buildWatchFit>[0]> = {}) =>
  buildWatchFit({ name: e.name, profile: profileFromWatchEntry(e), fallbackAge: e.age, price: 150_000, squad, finances: fin, targets, ...o });

// ---- reading the entry ------------------------------------------------------------------------
test('skills of all 0 mean "not read"; keeping 0 alone does not', () => {
  assert.equal(skillsWereRead({ name: 'x', skills: { batting: 0, bowling: 0, keeping: 0 } }), false);
  assert.equal(skillsWereRead({ name: 'x' }), false);
  assert.equal(skillsWereRead({ name: 'x', skills: { batting: 9, bowling: 0, keeping: 0 } }), true);
});

test('profile: bowlingType "None" is dropped, unread wage stays unknown (never defaulted)', () => {
  const p = profileFromWatchEntry({ name: 'x', skills: { batting: 5, bowling: 1 }, bowlingType: 'None' });
  assert.equal(p.bowlingType, undefined);
  assert.equal(p.wage, undefined);
  assert.equal(p.wageSource, 'unknown');
});

// ---- money -------------------------------------------------------------------------------------
test('weekly surplus = income minus player + staff wages', () => {
  assert.equal(weeklySurplus(fin), 5_000);
});

test('weekly impact is exact: surplus - wage, cash - price', () => {
  const r = check(star);
  assert.equal(r.money!.surplusBefore, 5_000);
  assert.equal(r.money!.surplusAfter, 5_000 - 12_000);
  assert.equal(r.money!.cashAfter, 400_000 - 150_000);
});

test('adding a wage that pushes the club into deficit is flagged, even a small one', () => {
  const r = check({ ...star, wage: 6_000 }); // 5k - 6k = -1k: was positive, now negative
  assert.equal(r.money!.surplusAfter, -1_000);
  assert.equal(r.money!.level, 'bad');
});

test('big deficit (worse than -10k) is bad; healthy surplus stays ok', () => {
  assert.equal(check(star).money!.level, 'bad');
  const rich = { ...fin, sponsorsIncome: 160_000 }; // surplus +105k
  const r = check({ ...star, wage: 8_000 }, { finances: rich });
  assert.equal(r.money!.surplusAfter, 105_000 - 8_000);
  assert.equal(r.money!.level, 'ok');
});

test('club already in deficit: small extra wage = warn, pushing past -£10k = bad', () => {
  const deficit = { ...fin, sponsorsIncome: 52_000 }; // surplus -3k
  assert.equal(weeklySurplus(deficit), -3_000);
  const small = check({ ...star, wage: 2_000 }, { finances: deficit }); // -5k
  assert.equal(small.money!.surplusAfter, -5_000);
  assert.equal(small.money!.level, 'warn');
  const big = check({ ...star, wage: 9_000 }, { finances: deficit }); // -12k
  assert.equal(big.money!.surplusAfter, -12_000);
  assert.equal(big.money!.level, 'bad');
});

test('price above cash is bad; thin cash buffer (< 4 weeks of his wage) is a warning', () => {
  const rich = { ...fin, sponsorsIncome: 160_000 };
  assert.equal(check({ ...star, wage: 8_000 }, { finances: rich, price: 500_000 }).money!.level, 'bad');
  const thin = { ...rich, cash: 150_000 + 20_000 }; // 20k left, wage 8k*4 = 32k
  assert.equal(check({ ...star, wage: 8_000 }, { finances: thin }).money!.level, 'warn');
});

test('unknown wage: no weekly figure is invented, gap is reported', () => {
  const r = check({ ...star, wage: undefined });
  assert.equal(r.money!.surplusAfter, undefined);
  assert.ok(r.dataGaps.some((g) => /wage/i.test(g)));
  assert.notEqual(r.money!.level, 'ok');
});

test('letting the replaced player go adds back exactly his wage', () => {
  const rich = { ...fin, sponsorsIncome: 160_000 };
  const r = check({ ...star, wage: 8_000 }, { finances: rich });
  if (r.squad.verdict?.replaces) {
    const w = squad.find((p) => p.name === r.squad.verdict!.replaces)!.wage!;
    assert.equal(r.money!.surplusAfterIfReplaces, 105_000 - 8_000 + w);
  } else {
    assert.equal(r.money!.surplusAfterIfReplaces, undefined);
  }
});

test('finances not synced: no money section, gap reported, nothing invented', () => {
  const r = check(star, { finances: null });
  assert.equal(r.money, null);
  assert.ok(r.dataGaps.some((g) => /finances/i.test(g)));
});

// ---- squad fit + goals -------------------------------------------------------------------------
test('skills not read: squad fit and goals are NOT judged, gap says why', () => {
  const r = check({ name: 'Mystery', age: 22, wage: 5000, skills: { batting: 0, bowling: 0, keeping: 0 } });
  assert.equal(r.squad.verdict, null);
  assert.equal(r.goals, null);
  assert.ok(r.dataGaps.some((g) => /skills/i.test(g)));
  assert.notEqual(r.level, 'ok');
});

test('a clearly better batter than the squad lifts the top-order goal', () => {
  const r = check(star);
  const top = r.goals!.rows.find((g) => g.key === 'topOrder')!;
  assert.ok(top.after > top.before, `top order ${top.before} -> ${top.after}`);
  assert.equal(r.goals!.level, 'ok');
  assert.ok(r.goals!.improved.some((g) => g.key === 'topOrder'));
});

test('a weak player moves no goal that is still below target', () => {
  const r = check({ name: 'Weak', age: 33, wage: 2000, skills: { batting: 2, bowling: 2, keeping: 0 } });
  assert.equal(r.goals!.improved.length, 0);
  assert.equal(r.goals!.level, 'warn');
  assert.ok(['PASS', 'MAYBE'].includes(r.squad.verdict!.verdict));
});

test('no rating goals set: goals not assessed, gap reported', () => {
  const r = check(star, { targets: null });
  assert.equal(r.goals, null);
  assert.ok(r.dataGaps.some((g) => /goal/i.test(g)));
});

test('empty squad: nothing judged, gap reported', () => {
  const r = check(star, { squad: [] });
  assert.equal(r.squad.verdict, null);
  assert.equal(r.goals, null);
  assert.ok(r.dataGaps.some((g) => /squad/i.test(g)));
});

test('overall level is the worst of the three areas', () => {
  const r = check(star); // money bad (deficit) even though the batter is good
  assert.equal(r.level, 'bad');
  const rich = check({ ...star, wage: 8_000 }, { finances: { ...fin, sponsorsIncome: 160_000 } });
  assert.notEqual(rich.money!.level, 'bad');
});

// ---- what Jarvis is told -----------------------------------------------------------------------
test('briefing carries the exact computed numbers and no NaN / undefined', () => {
  const r = check({ ...star, wage: 8_000 }, { finances: { ...fin, sponsorsIncome: 160_000 } });
  const b = buildWatchFitBriefing(r, { squad, maxBid: 175_000 });
  assert.ok(b.includes('£105,000'), 'surplus now');
  assert.ok(b.includes('£97,000'), 'surplus after');
  assert.ok(b.includes('£175,000'), 'max bid');
  assert.ok(!/NaN|undefined/.test(b), b);
});

test('briefing states data gaps and unknown wage plainly', () => {
  const r = check({ ...star, wage: undefined, skills: { batting: 0, bowling: 0, keeping: 0 } });
  const b = buildWatchFitBriefing(r, { squad });
  assert.ok(/DATA GAPS/.test(b));
  assert.ok(/UNKNOWN/.test(b));
  assert.ok(!/NaN|undefined/.test(b), b);
});

test('system prompt keeps Jarvis to the three questions and forbids recalculating', () => {
  assert.ok(/never recalculate/i.test(WATCH_FIT_SYSTEM_PROMPT));
  assert.ok(/DATA GAP/.test(WATCH_FIT_SYSTEM_PROMPT));
  assert.ok(/Weekly income/.test(WATCH_FIT_SYSTEM_PROMPT));
});

console.log(`\n${n} scenarios passed`);
