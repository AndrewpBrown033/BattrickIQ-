import type { ClubFinances, FinanceWeekRecord, GateReceiptRecord } from '../types';

/**
 * Parses the real transaction list on finances.asp into weekly billing records and
 * individual gate-receipt payments, and derives the club's real interest model from them.
 *
 * Page structure (newest first): a DATED row starts a group, and the undated rows that
 * follow it share its date. The dated row's Balance column is the balance after the whole
 * group, so "balance before" = balance after minus the group's net amount. A weekly billing
 * run is the group containing the Player Salaries line.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "09 Oct 2026" -> "2026-10-09" */
export function parseBattrickLongDate(text: string): string | null {
  const m = (text || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (mon === undefined) return null;
  const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[1], 10)));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toNum(text: string): number | null {
  const t = (text || '').replace(/[£$€,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function median(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface ParsedFinanceTransactions {
  weeklyHistory: FinanceWeekRecord[];
  gateHistory: GateReceiptRecord[];
}

export function parseFinanceTransactions(doc: Document): ParsedFinanceTransactions {
  const out: ParsedFinanceTransactions = { weeklyHistory: [], gateHistory: [] };
  const list = doc.querySelector('ul.transactions');
  if (!list) return out;

  type Row = { date: string | null; details: string; amount: number; balance: number | null };
  type Group = { date: string; rows: Row[]; balanceAfter: number | null };
  const groups: Group[] = [];

  Array.from(list.children).forEach((li) => {
    const spans = Array.from(li.children).map((s) => (s.textContent || '').trim());
    if (spans.length < 2) return;
    const details = spans[1];
    if (/^details$/i.test(details)) return; // header row
    if (/balance\s+(carried|brought)\s+forward/i.test(details)) return;

    const date = parseBattrickLongDate(spans[0]);
    const paidOut = toNum(spans[2] || '') ?? 0;
    const paidIn = toNum(spans[3] || '') ?? 0;
    const amount = toNum(spans[5] || '') ?? (paidIn - paidOut);
    const balance = toNum(spans[4] || '');
    const row: Row = { date, details, amount, balance };

    if (date) {
      groups.push({ date, rows: [row], balanceAfter: balance });
    } else if (groups.length > 0) {
      groups[groups.length - 1].rows.push(row);
    }
  });

  const sumOf = (rows: Row[], re: RegExp) =>
    rows.filter((r) => re.test(r.details)).reduce((a, r) => a + r.amount, 0);

  for (const g of groups) {
    g.rows.forEach((r) => {
      if (/gate\s+receipts/i.test(r.details) && r.amount > 0) {
        out.gateHistory.push({ date: g.date, amount: r.amount });
      }
    });

    if (!g.rows.some((r) => /player\s+salaries/i.test(r.details))) continue;
    const net = g.rows.reduce((a, r) => a + r.amount, 0);
    out.weeklyHistory.push({
      date: g.date,
      playerSalaries: -sumOf(g.rows, /player\s+salaries/i),
      staffSalaries: -sumOf(g.rows, /backroom\s+staff\s+salaries/i),
      groundMaintenance: -sumOf(g.rows, /ground\s+maintenance/i),
      sponsorship: sumOf(g.rows, /sponsorship/i),
      interestReceived: sumOf(g.rows, /interest\s+received/i),
      interestPaid: -sumOf(g.rows, /interest\s+paid/i),
      balanceAfter: g.balanceAfter ?? undefined,
      balanceBefore: g.balanceAfter !== null ? g.balanceAfter - net : undefined,
    });
  }

  out.weeklyHistory.sort((a, b) => a.date.localeCompare(b.date));
  out.gateHistory.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Real interest model, derived purely from the club's own weekly billing history. */
export function deriveInterestModel(
  weeks: FinanceWeekRecord[]
): Pick<ClubFinances, 'interestRate' | 'interestCap' | 'overdraftRate'> {
  const pos = weeks
    .filter((w) => w.interestReceived > 0 && (w.balanceBefore ?? 0) > 0)
    .map((w) => ({ r: w.interestReceived / (w.balanceBefore as number), v: w.interestReceived }));
  const neg = weeks
    .filter((w) => w.interestPaid > 0 && (w.balanceBefore ?? 0) < 0)
    .map((w) => w.interestPaid / Math.abs(w.balanceBefore as number));

  const result: Pick<ClubFinances, 'interestRate' | 'interestCap' | 'overdraftRate'> = {};
  const rate = median(pos.map((p) => p.r));
  if (rate !== undefined) {
    result.interestRate = rate;
    // A week paying clearly less than rate x balance was held back by a cap.
    const capped = pos.filter((p) => p.r < rate * 0.97);
    if (capped.length > 0) result.interestCap = Math.max(...capped.map((p) => p.v));
  }
  const od = median(neg);
  if (od !== undefined) result.overdraftRate = od;
  return result;
}

/**
 * Merge a freshly parsed finances object into the saved one. A later sync of a SHORT
 * range (e.g. "week to date") must never wipe the longer history from an earlier
 * "season to date" sync, so histories are unioned by date and the interest model re-derived.
 */
export function mergeFinances(
  prev: ClubFinances | null | undefined,
  next: Partial<ClubFinances>
): ClubFinances {
  const merged = { ...(prev || {}), ...next } as ClubFinances;

  const weekMap = new Map<string, FinanceWeekRecord>();
  (prev?.weeklyHistory || []).forEach((w) => weekMap.set(w.date, w));
  (next.weeklyHistory || []).forEach((w) => weekMap.set(w.date, w));
  const weeks = Array.from(weekMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const gateMap = new Map<string, GateReceiptRecord>();
  const gateKey = (g: GateReceiptRecord, i: number) => `${g.date}|${g.amount}|${i}`;
  // Same-date, same-amount payments are kept distinct by occurrence index within their source
  // list; a newer list for the same date replaces the older one wholesale.
  const nextDates = new Set((next.gateHistory || []).map((g) => g.date));
  (prev?.gateHistory || []).filter((g) => !nextDates.has(g.date)).forEach((g, i) => gateMap.set(gateKey(g, i), g));
  (next.gateHistory || []).forEach((g, i) => gateMap.set(gateKey(g, 1000000 + i), g));
  const gates = Array.from(gateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (weeks.length > 0) {
    merged.weeklyHistory = weeks;
    Object.assign(merged, deriveInterestModel(weeks));
    const latest = weeks[weeks.length - 1];
    if (latest.groundMaintenance > 0) merged.groundMaintenance = latest.groundMaintenance;
  }
  if (gates.length > 0) merged.gateHistory = gates;
  return merged;
}
