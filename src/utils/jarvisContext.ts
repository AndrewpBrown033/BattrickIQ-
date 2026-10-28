/**
 * Manager briefing context for Jarvis (AI coach).
 * Money, games, squad — the levers that win Battrick.
 */
import type { BattrickPlayer, BattrickGame, ClubFinances } from '../types';
import { isGameInNext7Days, parseGameDateToTimestamp } from './history';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function buildManagerBriefing(): string {
  const finances = loadJson<ClubFinances | null>('bt_finances', null);
  const squad = loadJson<BattrickPlayer[]>('bt_squad', []);
  const ratingTargets = loadJson<Record<string, number> | null>('bt_rating_targets', null);
  const fixtures =
    loadJson<BattrickGame[]>('bt_fixtures', []) ||
    loadJson<BattrickGame[]>('bt_league_office_fixtures', []);

  const parts: string[] = [];
  parts.push('[MANAGER BRIEFING — BattrickIQ]');

  if (finances) {
    const cash = finances.cash ?? 0;
    const weekly = (finances as any).weeklyOutgoings ?? (finances as any).weeklyCosts ?? 0;
    const income = (finances as any).weeklyIncome ?? 0;
    parts.push(
      `\n[MONEY]\n- Cash: £${Number(cash).toLocaleString()}\n- Weekly income: £${Number(income).toLocaleString()}\n- Weekly outgoings: £${Number(weekly).toLocaleString()}\n- Net weekly: £${Number(income - weekly).toLocaleString()}`
    );
  } else {
    parts.push('\n[MONEY] Unknown — sync finances before cash-sensitive advice.');
  }

  const upcoming = (Array.isArray(fixtures) ? fixtures : []).filter(
    (f) => !f.result || f.result === 'Upcoming'
  );
  const next7 = upcoming.filter((f) => isGameInNext7Days(f.date, f.time));
  const pool = next7.length ? next7 : upcoming;
  const sorted = [...pool].sort(
    (a, b) =>
      (parseGameDateToTimestamp(a.date, a.time) || 0) -
      (parseGameDateToTimestamp(b.date, b.time) || 0)
  );
  if (sorted.length) {
    parts.push('\n[GAMES]');
    sorted.slice(0, 5).forEach((f, i) => {
      parts.push(
        `- ${i === 0 ? 'NEXT: ' : ''}${f.opponent || 'TBD'} · ${f.type || 'Match'} · ${f.date || '?'} ${f.time || ''} · ${f.venue || ''}`
      );
    });
  } else {
    parts.push('\n[GAMES] No fixtures synced — recommend syncing the draw.');
  }

  if (squad.length) {
    const onNets = squad.filter((p) => {
      const n = p.nets;
      if (!n) return false;
      return (
        (n.batting || 0) +
          (n.bowling || 0) +
          (n.keeping || 0) +
          (n.fielding || 0) +
          (n.stamina || 0) >
        0
      );
    }).length;
    const avgAge =
      squad.reduce((s, p) => s + (p.age || 0), 0) / Math.max(1, squad.length);
    const totalWage = squad.reduce((s, p) => s + (p.wage || 0), 0);
    parts.push(
      `\n[SQUAD]\n- Size: ${squad.length}\n- Avg age: ${avgAge.toFixed(1)}\n- On nets: ${onNets}\n- Squad wages: £${totalWage.toLocaleString()}/wk`
    );
    const brief = squad
      .map(
        (p) =>
          `- ${p.name}: ${p.age}y ${p.role || ''} BTR ${p.btRating || 0} wage £${p.wage || 0} bat ${p.skills?.batting ?? 0} bowl ${p.skills?.bowling ?? 0} keep ${p.skills?.keeping ?? 0} field ${p.skills?.fielding ?? 0} sta ${p.skills?.stamina ?? 0}`
      )
      .join('\n');
    parts.push(`[ROSTER]\n${brief}`);
  } else {
    parts.push('\n[SQUAD] Empty — sync roster before tactical advice.');
  }

  if (ratingTargets && Object.keys(ratingTargets).length) {
    parts.push(
      `\n[TEAM RATING TARGETS]\n${Object.entries(ratingTargets)
        .map(([k, v]) => `- ${k}: level ${v}`)
        .join('\n')}\nUse these when recommending who to train or buy.`
    );
  }

  // Transfer Watch — salary, team plan, affordability for Jarvis purchase advice
  try {
    const rawWatch = localStorage.getItem('bt_transfer_watchlist');
    const watchList = rawWatch ? (JSON.parse(rawWatch) as any[]) : [];
    if (Array.isArray(watchList) && watchList.length) {
      parts.push('\n[TRANSFER WATCH — PURCHASE DECISIONS]');
      parts.push(
        'Advise BUY / MAYBE / PASS for each watched player using: (1) cash & wage affordability, (2) team rating targets and squad skill gaps, (3) asking/current bid vs value. Prefer stored buyFit when present; explain salary impact and plan fit clearly.'
      );
      for (const w of watchList.slice(0, 12)) {
        const sk = w.skills || {};
        const fit = w.buyFit;
        parts.push(
          `- ${w.name || w.playerId} (ID ${w.playerId}): age ${w.age ?? '?'} role ${w.role || '?'} ` +
            `bowlType ${w.bowlingType || 'None'} wage £${w.wage ?? '?'}/wk ` +
            `ask £${w.lastAskingPrice ?? '?'} bid £${w.lastCurrentBid ?? '?'} maxBid £${w.maxBid ?? '—'} ` +
            `skills bat ${sk.batting ?? '?'} bowl ${sk.bowling ?? '?'} keep ${sk.keeping ?? '?'} ` +
            `field ${sk.fielding ?? '?'} sta ${sk.stamina ?? '?'} ` +
            (fit
              ? `buyFit ${fit.verdict} score ${fit.score} affordable=${fit.affordable} — ${fit.summary}`
              : 'buyFit pending (open Transfer Watch and Check now)')
        );
      }
    }
  } catch {
    /* ignore */
  }

  parts.push(
    '\n[ADVICE STYLE]\n- Lead with money impact and match impact.\n- Prefer concrete actions: train X, sell Y, buy Z for gap G, field this XI.\n- If cash is tight, do not recommend expensive buys.\n- Tie skill gaps to upcoming formats (FC / OD / BT20) when known.'
  );

  return parts.join('\n');
}

export const JARVIS_SYSTEM_PROMPT = `You are Coach Jarvis, the strategic manager advisor for BattrickIQ — a Battrick cricket club management tool.

Core truth: money, games, and winning are everything. Squad and skill decisions are the levers.

Always:
1. Respect cash and weekly surplus before recommending buys or high wages.
2. Tie advice to upcoming fixtures and formats when available.
3. Point to train / sell / buy / XI actions that close skill or rating gaps.
4. Be concise, decisive, and manager-friendly — not a generic cricket essay.
5. When TRANSFER WATCH players are listed, explicitly say if each is a good purchase for THIS club: salary/wage load, affordability vs cash, and fit to team rating targets / skill gaps. Use BUY / MAYBE / PASS.`;
