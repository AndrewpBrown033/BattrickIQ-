import { deriveInterestModel } from '../src/utils/financeHistory';
let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wk = (date: string, before: number, interest: number) => ({
  date, playerSalaries: 0, staffSalaries: 0, groundMaintenance: 0, sponsorship: 0,
  interestReceived: interest, interestPaid: 0, balanceBefore: before, balanceAfter: before,
});

// 1. Rate rose over the season (more Financial Advisors): that is NOT a cap, and rate = latest week.
{
  const m = deriveInterestModel([
    wk('2026-09-14', 1_800_000, 7200), wk('2026-09-21', 1_850_000, 7400),
    wk('2026-10-05', 1_950_000, 9750), wk('2026-10-12', 2_000_000, 10000),
  ] as any);
  ok(m.interestCap === undefined, 'rising rate is not mistaken for a cap');
  ok(Math.abs((m.interestRate ?? 0) - 0.005) < 1e-9, 'rate is the latest week (0.5%)');
}
// 2. Genuine plateau: same payout in 2+ weeks at different balances -> cap in POUNDS of interest.
{
  const m = deriveInterestModel([
    wk('2026-09-14', 1_000_000, 5000), wk('2026-09-21', 1_200_000, 6000),
    wk('2026-09-28', 3_000_000, 10000), wk('2026-10-05', 3_400_000, 10000),
  ] as any);
  ok(m.interestCap === 10000, 'plateau detected, cap = £10,000 interest');
  ok(Math.abs((m.interestRate ?? 0) - 0.005) < 1e-9, 'rate from latest uncapped week');
}
// 3. Single big week is not a plateau.
{
  const m = deriveInterestModel([wk('2026-09-14', 1_000_000, 5000), wk('2026-09-21', 2_000_000, 10000)] as any);
  ok(m.interestCap === undefined, 'one max week is not a cap');
}
// 4. No history -> empty model.
ok(Object.keys(deriveInterestModel([])).length === 0, 'empty history -> empty model');
if (fails) { console.error(fails + ' failed'); process.exit(1); }
