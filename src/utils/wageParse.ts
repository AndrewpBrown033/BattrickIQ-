/**
 * Reading a player's WEEKLY WAGE out of page text, in one place.
 *
 * Two parsers used to do this differently. The transfer-list parser accepted "Wage 4,500"; the player-page parser
 * required "Wage:" with a colon and, when it did not find one, used the first "at least £N" ANYWHERE on the page
 * (a bid minimum, a contract minimum, anything) as if it were the wage. That value then overwrote the correct one
 * on the next check, so watched players showed a wage that did not match Battrick.
 *
 * Rules here:
 *  - a wage is a number that follows a wage / salary label (colon optional) or "£N per week";
 *  - anything introduced by "at least" / "minimum" is NOT the wage; it is reported separately as minContractWage,
 *    and only when it is clearly about wages;
 *  - thousands may be written 4,500 / 4 500 / 4.500; a value with no label is never guessed.
 */

const CUR = '[£$€]?';
// 1,234,567(.50) | 1 234 567 | 1.234.567 | plain digits(.50)
const NUM = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,3}(?:[\\s\\u00a0\\u202f]\\d{3})+|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:\\.\\d{1,2})?)';

export function parseMoneyLoose(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  let s = String(raw).replace(/[£$€\s\u00a0\u202f]/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 4.500 / 1.234.567 are thousands
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** True when the text just before `index` marks the number as a minimum / threshold rather than the wage itself. */
function inMinimumContext(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index).toLowerCase();
  return /(at\s+least|minimum|min\.?|no\s+less\s+than|from)\s*[^.]{0,30}$/.test(before) && /(at\s+least|minimum|min\.?|no\s+less\s+than)/.test(before);
}

export interface ParsedWage {
  /** The weekly wage the page states for the player. */
  wage?: number;
  /** A minimum contract wage, when the page says one next to a wage / contract word. Never used as the wage. */
  minContractWage?: number;
}

export function parseWageFromText(rawText: string): ParsedWage {
  if (!rawText) return {};
  const text = rawText.replace(/&nbsp;/gi, ' ').replace(/&#163;|&pound;/gi, '£').replace(/\s+/g, ' ');
  const out: ParsedWage = {};

  // 1) label then value: "Wage: £4,500", "Wage £4,500", "Weekly wage 4,500", "Wages: 4,500", "Salary = 4,500"
  const labelRe = new RegExp(`\\b(?:weekly\\s+)?(?:wages?|salary)\\b\\s*[:=\\-]?\\s*${CUR}\\s*${NUM}`, 'gi');
  for (const m of text.matchAll(labelRe)) {
    if (inMinimumContext(text, m.index ?? 0)) continue;
    const v = parseMoneyLoose(m[1]);
    if (v && v > 0) {
      out.wage = v;
      break;
    }
  }

  // 2) "£4,500 per week" / "£4,500 a week" / "£4,500/wk" (not when it is introduced by at least / minimum)
  if (out.wage === undefined) {
    const perWeekRe = new RegExp(`[£$€]\\s*${NUM}\\s*(?:per\\s+week|a\\s+week|/\\s*w(?:ee)?k|weekly)`, 'gi');
    for (const m of text.matchAll(perWeekRe)) {
      if (inMinimumContext(text, m.index ?? 0)) continue;
      const v = parseMoneyLoose(m[1]);
      if (v && v > 0) {
        out.wage = v;
        break;
      }
    }
  }

  // 3) minimum contract wage, only when the sentence is about wages / the contract
  const minRe = new RegExp(
    `(?:wages?|salary|contract)[^£$€.]{0,80}?(?:at\\s+least|minimum(?:\\s+of)?)\\s*${CUR}\\s*${NUM}` +
      `|(?:at\\s+least|minimum(?:\\s+of)?)\\s*${CUR}\\s*${NUM}\\s*(?:per\\s+week|a\\s+week|/\\s*w(?:ee)?k|weekly|in\\s+wages)`,
    'i'
  );
  const mm = text.match(minRe);
  if (mm) {
    const v = parseMoneyLoose(mm[1] || mm[2]);
    if (v && v > 0) out.minContractWage = v;
  }
  return out;
}
