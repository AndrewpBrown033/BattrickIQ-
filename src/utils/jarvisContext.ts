/**
 * Manager briefing for Coach Jarvis: money, games, squad, skill gaps.
 */
import type { BattrickPlayer, ClubFinances, BattrickGame } from '../types';
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
  const teamName = localStorage.getItem('bt_team_name') || 'Unnamed Club';
  const squad = loadJson<BattrickPlayer[]>('bt_squad', []);
  const finances = loadJson<ClubFinances | null>('bt_finances', null);
  const fixtures = loadJson<BattrickGame[]>('bt_fixtures', []) || [];
  const ratingTargets = loadJson<Record<string, number> | null>('bt_rating_targets', null);

  const parts: string[] = [];
  parts.push(`Club: ${teamName}`);
  parts.push(
    'Your role: help the manager win games without going broke. Decisions are about squad, skills, training, buys/sells, and XI selection.'
  );

  if (finances) {
    const income =
      (finances.sponsorsIncome || 0) +
      (finances.gateReceipts || 0) +
      (finances.interestReceived || 0);
    const wages = (finances.playerWages || 0) + (finances.staffWages || 0);
    const surplus = income - wages;
    const cash = finances.cash || 0;
    let moneyLabel = 'stable';
    if (cash < 0) moneyLabel = 'IN DEBT — urgent';
    else if (surplus < -10000) moneyLabel = 'weekly deficit — cut costs or sell';
    else if (surplus < 0) moneyLabel = 'tight';
    else if (surplus >= 25000) moneyLabel = 'strong surplus — can invest';
    else moneyLabel = 'healthy';
    parts.push(
      `\n[MONEY]\n- Cash: £${cash.toLocaleString()}\n- Weekly surplus: £${surplus.toLocaleString()}\n- Player wages: £${(finances.playerWages || 0).toLocaleString()}/wk\n- Staff wages: £${(finances.staffWages || 0).toLocaleString()}/wk\n- Status: ${moneyLabel}\n- Members: ${finances.members ?? 'n/a'}`
    );
  } else {
    parts.push('\n[MONEY] Not synced — advise manager to sync finances before big spends.');
  }

  const upcoming = fixtures.filter((f) => !f.result || f.result === 'Upcoming');
  const next7 = fixtures.filter((f) => isGameInNext7Days(f.date, f.time));
  const sorted = [...(next7.length ? next7 : upcoming)].sort(
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
4. Be concise, decisive, and manager-friendly — not a generic cricket essay.`;
