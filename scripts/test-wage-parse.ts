/** Run: npm run test:wageparse */
import assert from 'node:assert/strict';
import { parseWageFromText, parseMoneyLoose } from '../src/utils/wageParse';
import { parseTransferPanelFromHtml } from '../src/utils/bidBot';
import { parseTransferList } from '../src/utils/transferList';
import { profileFromWatchEntry, buildWatchFit } from '../src/utils/watchFit';

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }

const bidForm = '<form name="makeBid"><p>Your bid must be at least £51,000.</p><p>Wages must be at least £2,150 per week.</p><input name="bidValue" value="51000"></form>';
const page = (body: string) => `<title>Battrick - Tom Archer » x</title><h2>Tom Archer (123456)</h2>${body}${bidForm}`;

test('"Wage: £4,500" with a colon', () => assert.equal(parseTransferPanelFromHtml(page('<p>Wage: £4,500</p>')).wage, 4500));
test('table cells with no colon', () => assert.equal(parseTransferPanelFromHtml(page('<table><tr><td>Wage</td><td>£4,500</td></tr></table>')).wage, 4500));
test('"Weekly wage", "Wages", "Salary" labels', () => {
  for (const l of ['Weekly wage', 'Wages', 'Salary', 'Wages:']) assert.equal(parseWageFromText(`${l} £4,500`).wage, 4500, l);
});
test('"£4,500 per week" with no label', () => assert.equal(parseWageFromText('He earns £4,500 per week.').wage, 4500));
test('thousands written 4 500 and 4.500', () => {
  assert.equal(parseWageFromText('Wage: £ 4 500').wage, 4500);
  assert.equal(parseWageFromText('Wage: £4.500').wage, 4500);
  assert.equal(parseWageFromText('Wage: £1.234.567').wage, 1234567);
  assert.equal(parseMoneyLoose('£4,500.50'), 4500.5);
});

test('the bid minimum is never taken as the wage (the old bug)', () => {
  const r = parseTransferPanelFromHtml(page('<p>Age: 24</p>'));
  assert.equal(r.wage, undefined, 'no wage stated -> unknown, not £51,000');
  assert.equal(r.wagesMinContract, 2150, 'the minimum is the figure next to the wage words, not the bid minimum');
});
test('a stated wage wins over a minimum, and the minimum stays separate', () => {
  const r = parseTransferPanelFromHtml(page('<p>Wage: £4,500</p>'));
  assert.equal(r.wage, 4500);
  assert.equal(r.wagesMinContract, 2150);
});
test('a number after "minimum wage" / "at least" is not the wage', () => {
  assert.equal(parseWageFromText('Minimum wage: £2,150').wage, undefined);
  assert.equal(parseWageFromText('wages of at least £2,150 per week').wage, undefined);
  assert.equal(parseWageFromText('wages of at least £2,150 per week').minContractWage, 2150);
});
test('empty / unrelated text gives nothing', () => {
  assert.deepEqual(parseWageFromText(''), {});
  assert.deepEqual(parseWageFromText('Batting: Quality, Age: 24'), {});
});

test('the transfer-list parser reads wages the same way as the player page', () => {
  const row = (label: string, id: string) =>
    `<table><tr><td><a href="playerdetails.asp?playerID=${id}">Tom Archer</a></td><td>Age: 24 Batting: 9 ${label} £4,500 Asking Price: £50,000 Deadline: 20/11/2026 10:00</td></tr></table>`;
  for (const [label, id] of [['Wage:', '111'], ['Wages', '112'], ['Weekly wage', '113']] as const) {
    const l = parseTransferList(row(label, id)).find((x) => x.playerId === id);
    assert.ok(l, 'listing parsed for ' + label);
    assert.equal(l!.wage, 4500, label);
  }
});

test('Jarvis fit says so when only a minimum is known, and never uses it as the wage', () => {
  const entry: any = { name: 'Tom', age: 24, wage: undefined, wageMin: 2150, skills: { batting: 9, bowling: 1, keeping: 1 } };
  const profile = profileFromWatchEntry(entry);
  assert.equal(profile.wage, undefined);
  assert.equal(profile.wageSource, 'unknown');
  assert.equal(profile.minContractWage, 2150);
  const rep = buildWatchFit({ name: 'Tom', profile, squad: [], finances: null, targets: null });
  assert.ok(rep.dataGaps.some((g) => /minimum contract of £2,150/.test(g) && /not used as his wage/.test(g)), rep.dataGaps.join(' | '));
});

console.log(`\n${n} tests passed`);
