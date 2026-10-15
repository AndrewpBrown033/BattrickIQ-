/**
 * Parse Battrick transferlist.asp HTML and score buy opportunities
 * against squad gaps / team rating targets / financial position.
 *
 * Unaffordable listings are still returned with active=false (Inactive).
 */

import { SKILL_LEVELS, getSkillLabel } from '../types';

export interface TransferListing {
  playerId: string;
  name: string;
  age?: number;
  role?: string;
  askingPrice?: number;
  currentBid?: number;
  deadline?: string;
  btRating?: number;
  wage?: number;
  skills: {
    batting?: number;
    bowling?: number;
    keeping?: number;
    stamina?: number;
    fielding?: number;
    concentration?: number;
    consistency?: number;
  };
  bowlingType?: string;
  playerUrl?: string;
  snippet?: string;
}

export type TeamRatingKey =
  | 'topOrder'
  | 'middleOrder'
  | 'lowerOrder'
  | 'seamBowling'
  | 'spinBowling'
  | 'fielding'
  | 'wicketKeeping';

export interface SquadGapNeed {
  need: 'batting' | 'bowling' | 'keeping' | 'all-rounder' | 'fielding' | 'seam' | 'spin';
  minSkill: number;
  maxAge?: number;
  reason: string;
  ratingKey?: TeamRatingKey;
}

export interface BuyRecommendation {
  listing: TransferListing;
  score: number;
  reasons: string[];
  affordable: boolean;
  cost: number;
  fitsNeed?: string;
  active: boolean;
}

export interface RatingSnapshot {
  key: TeamRatingKey;
  label: string;
  level: number;
  currentLevel: number;
  currentLabel: string;
  gap: number;
}

export const TEAM_RATING_KEYS: { key: TeamRatingKey; title: string }[] = [
  { key: 'topOrder', title: 'Top Order' },
  { key: 'middleOrder', title: 'Middle Order' },
  { key: 'lowerOrder', title: 'Lower Order' },
  { key: 'seamBowling', title: 'Seam Bowling' },
  { key: 'spinBowling', title: 'Spin Bowling' },
  { key: 'fielding', title: 'Fielding' },
  { key: 'wicketKeeping', title: 'Wicket Keeping' },
];

export const RATING_LABELS = SKILL_LEVELS;

export function labelToLevel(label: string): number {
  const n = String(label || '').trim().toLowerCase();
  if (!n) return 0;
  const idx = RATING_LABELS.findIndex((l) => l === n);
  if (idx >= 0) return idx;
  const fuzzy = RATING_LABELS.findIndex((l) => l.startsWith(n) || n.startsWith(l));
  return fuzzy >= 0 ? fuzzy : 0;
}

export function levelToLabel(level: number): string {
  const i = Math.max(0, Math.min(RATING_LABELS.length - 1, Math.round(level)));
  return RATING_LABELS[i] || 'useless';
}

function parseMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/[£$€,\s]/g, '');
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseSkillToken(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(label + '\\s*[:=]?\\s*(\\d{1,2})', 'i');
    const m = text.match(re);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v >= 0 && v <= 20) return v;
    }
  }
  return undefined;
}

function extractListingFromBlock(
  playerId: string,
  name: string,
  href: string,
  blockText: string
): TransferListing {
  const ageMatch =
    blockText.match(/\b(?:age|aged)\s*[:=]?\s*(\d{1,2})\b/i) || blockText.match(/\((\d{2})\)/);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;
  const priceMatch =
    blockText.match(/(?:asking\s*price|reserve|min(?:imum)?\s*bid|price)\s*[:=]?\s*[£$€]?\s*([\d,]+)/i) ||
    blockText.match(/[£$€]\s*([\d,]{3,})/);
  const askingPrice = priceMatch ? parseMoney(priceMatch[1]) : undefined;
  const bidMatch = blockText.match(/(?:current\s*bid|highest\s*bid|bid)\s*[:=]?\s*[£$€]?\s*([\d,]+)/i);
  const currentBid = bidMatch ? parseMoney(bidMatch[1]) : undefined;
  const deadlineMatch =
    blockText.match(/(?:deadline|ends?|closes?)\s*[:=]?\s*([0-3]?\d\/[0-1]?\d\/\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i) ||
    blockText.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2})\b/);
  const deadline = deadlineMatch ? deadlineMatch[1] : undefined;
  const btrMatch = blockText.match(/\b(?:BTR|Battrick\s*Rating|BT\s*Rating)\s*[:=]?\s*([\d,]+)/i);
  const btRating = btrMatch ? parseMoney(btrMatch[1]) : undefined;
  const wageMatch = blockText.match(/\b(?:wage|salary)\s*[:=]?\s*[£$€]?\s*([\d,]+)/i);
  const wage = wageMatch ? parseMoney(wageMatch[1]) : undefined;
  const skills = {
    batting: parseSkillToken(blockText, ['batting', 'bat']),
    bowling: parseSkillToken(blockText, ['bowling', 'bowl']),
    keeping: parseSkillToken(blockText, ['keeping', 'wicket\\s*keeping', 'wk', 'keeper']),
    stamina: parseSkillToken(blockText, ['stamina', 'stam']),
    fielding: parseSkillToken(blockText, ['fielding', 'field']),
    concentration: parseSkillToken(blockText, ['concentration', 'conc']),
    consistency: parseSkillToken(blockText, ['consistency', 'cons']),
  };
  const bowlTypeMatch = blockText.match(
    /\b(RFM|LFM|RF|LF|RM|LM|RS|LS|RO|LO|RMF|LMF|fast|medium|spin|off.?spin|leg.?spin|orthodox|chinaman)\b/i
  );
  const bowlingType = bowlTypeMatch ? bowlTypeMatch[1] : undefined;
  let role: string | undefined;
  if ((skills.keeping || 0) >= 6 && (skills.keeping || 0) >= (skills.batting || 0)) role = 'Keeper';
  else if ((skills.batting || 0) >= 6 && (skills.bowling || 0) >= 6) role = 'All-rounder';
  else if ((skills.bowling || 0) > (skills.batting || 0)) role = 'Bowler';
  else if ((skills.batting || 0) > 0) role = 'Batter';

  const playerUrl = href.startsWith('http')
    ? href
    : 'https://www.battrick.org/nl/' + href.replace(/^\//, '');

  return {
    playerId,
    name,
    age: age && age >= 15 && age <= 45 ? age : undefined,
    role,
    askingPrice,
    currentBid,
    deadline,
    btRating,
    wage,
    skills,
    bowlingType,
    playerUrl,
    snippet: blockText.slice(0, 220),
  };
}

function parseTransferListRegex(html: string): TransferListing[] {
  const listings: TransferListing[] = [];
  const seen = new Set<string>();
  const re =
    /<a[^>]+href=["']([^"']*(?:playerdetails\.asp|player\.asp|playerid=|PlayerID=|player_id=)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const idMatch =
      href.match(/playerid=(\d+)/i) ||
      href.match(/PlayerID=(\d+)/i) ||
      href.match(/(?:playerid|id)[=_](\d+)/i);
    if (!idMatch) continue;
    const playerId = idMatch[1];
    if (seen.has(playerId)) continue;
    seen.add(playerId);
    const name = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2 || name.length > 60) continue;
    const start = Math.max(0, m.index - 400);
    const end = Math.min(html.length, m.index + m[0].length + 600);
    const blockText = html
      .slice(start, end)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    listings.push(extractListingFromBlock(playerId, name, href, blockText));
  }
  return listings;
}

export function parseTransferList(html: string): TransferListing[] {
  if (!html || typeof html !== 'string') return [];
  const listings: TransferListing[] = [];
  const seen = new Set<string>();

  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = Array.from(
        doc.querySelectorAll(
          'a[href*="playerdetails.asp"], a[href*="player.asp"], a[href*="playerid="], a[href*="PlayerID="], a[href*="player_id="]'
        )
      );
      for (const link of links) {
        if (link.closest('#menubar, #rightmenu, .menu, #topmenu, nav, #leftmenu')) continue;
        const href = link.getAttribute('href') || '';
        const idMatch =
          href.match(/playerid=(\d+)/i) ||
          href.match(/PlayerID=(\d+)/i) ||
          href.match(/(?:playerid|id)[=_](\d+)/i);
        if (!idMatch) continue;
        const playerId = idMatch[1];
        if (seen.has(playerId)) continue;
        seen.add(playerId);
        const name = (link.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 2 || name.length > 60) continue;
        const block =
          link.closest('tr, li, .transfer, .player, .card, article, table, div') ||
          link.parentElement;
        const blockText = (block?.textContent || link.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        listings.push(extractListingFromBlock(playerId, name, href, blockText));
      }
    }
  } catch (e) {
    console.warn('parseTransferList DOM parse failed', e);
  }

  for (const item of parseTransferListRegex(html)) {
    if (seen.has(item.playerId)) continue;
    seen.add(item.playerId);
    listings.push(item);
  }

  return listings;
}

function isSpinBowler(bowlingType?: string): boolean {
  const t = (bowlingType || '').toLowerCase();
  return /spin|off|leg|orthodox|chinaman|rs\b|ls\b|ro\b|lo\b/.test(t);
}

function isSeamBowler(bowlingType?: string): boolean {
  const t = (bowlingType || '').toLowerCase();
  if (!t) return true;
  if (isSpinBowler(t)) return false;
  return true;
}

export function estimateTeamRatings(xi: {
  skills: {
    batting: number;
    bowling: number;
    keeping: number;
    fielding?: number;
    concentration?: number;
  };
  bowlingType?: string;
  role?: string;
}[]): Record<TeamRatingKey, { level: number; label: string }> {
  const empty = { level: 0, label: 'useless' as string };
  if (!xi.length) {
    return {
      topOrder: empty,
      middleOrder: empty,
      lowerOrder: empty,
      seamBowling: empty,
      spinBowling: empty,
      fielding: empty,
      wicketKeeping: empty,
    };
  }

  const batEff = (p: (typeof xi)[0]) =>
    p.skills.batting + 0.25 * (p.skills.concentration ?? Math.min(10, p.skills.batting));
  const ordered = [...xi].sort((a, b) => batEff(b) - batEff(a));
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
  const clampLvl = (n: number) => Math.max(0, Math.min(20, Math.round(n)));

  const topLvl = clampLvl(avg(ordered.slice(0, 3).map(batEff)));
  const midLvl = clampLvl(avg(ordered.slice(3, 6).map(batEff)));
  const lowLvl = clampLvl(avg(ordered.slice(6, 9).map(batEff)));

  const seamers = xi.filter((p) => isSeamBowler(p.bowlingType) && (p.skills.bowling || 0) >= 5);
  const spinners = xi.filter((p) => isSpinBowler(p.bowlingType) && (p.skills.bowling || 0) >= 5);
  const bowlPool = [...xi].sort((a, b) => b.skills.bowling - a.skills.bowling);
  const seamLvl = clampLvl(
    avg((seamers.length ? seamers : bowlPool.slice(0, 3)).map((p) => p.skills.bowling))
  );
  const spinLvl = clampLvl(
    avg((spinners.length ? spinners : bowlPool.slice(0, 2)).map((p) => p.skills.bowling))
  );
  const fieldLvl = clampLvl(avg(xi.map((p) => p.skills.fielding ?? 6)));
  const keepLvl = clampLvl(Math.max(...xi.map((p) => p.skills.keeping || 0), 0));

  return {
    topOrder: { level: topLvl, label: levelToLabel(topLvl) },
    middleOrder: { level: midLvl, label: levelToLabel(midLvl) },
    lowerOrder: { level: lowLvl, label: levelToLabel(lowLvl) },
    seamBowling: { level: seamLvl, label: levelToLabel(seamLvl) },
    spinBowling: { level: spinLvl, label: levelToLabel(spinLvl) },
    fielding: { level: fieldLvl, label: levelToLabel(fieldLvl) },
    wicketKeeping: { level: keepLvl, label: levelToLabel(keepLvl) },
  };
}

export function buildRatingGaps(
  current: Record<TeamRatingKey, { level: number; label: string }>,
  targets: Record<TeamRatingKey, number>
): RatingSnapshot[] {
  return TEAM_RATING_KEYS.map(({ key }) => {
    const targetLevel = targets[key] ?? 0;
    const cur = current[key] || { level: 0, label: 'useless' };
    return {
      key,
      label: levelToLabel(targetLevel),
      level: targetLevel,
      currentLevel: cur.level,
      currentLabel: cur.label,
      gap: targetLevel - cur.level,
    };
  });
}

export function deriveNeedsFromRatingGaps(gaps: RatingSnapshot[]): SquadGapNeed[] {
  const needs: SquadGapNeed[] = [];
  for (const g of gaps) {
    if (g.gap <= 0) continue;
    const minSkill = Math.max(g.level, g.currentLevel + 1);
    const title = TEAM_RATING_KEYS.find((k) => k.key === g.key)?.title || g.key;
    if (g.key === 'topOrder' || g.key === 'middleOrder' || g.key === 'lowerOrder') {
      needs.push({
        need: 'batting',
        minSkill,
        maxAge: g.key === 'lowerOrder' ? 30 : 27,
        reason: title + ' gap: need ' + g.label + ' (now ' + g.currentLabel + ')',
        ratingKey: g.key,
      });
    } else if (g.key === 'seamBowling') {
      needs.push({
        need: 'seam',
        minSkill,
        maxAge: 28,
        reason: 'Seam Bowling gap: need ' + g.label + ' (now ' + g.currentLabel + ')',
        ratingKey: g.key,
      });
    } else if (g.key === 'spinBowling') {
      needs.push({
        need: 'spin',
        minSkill,
        maxAge: 28,
        reason: 'Spin Bowling gap: need ' + g.label + ' (now ' + g.currentLabel + ')',
        ratingKey: g.key,
      });
    } else if (g.key === 'fielding') {
      needs.push({
        need: 'fielding',
        minSkill,
        maxAge: 29,
        reason: 'Fielding gap: need ' + g.label + ' (now ' + g.currentLabel + ')',
        ratingKey: g.key,
      });
    } else if (g.key === 'wicketKeeping') {
      needs.push({
        need: 'keeping',
        minSkill,
        maxAge: 29,
        reason: 'Wicket Keeping gap: need ' + g.label + ' (now ' + g.currentLabel + ')',
        ratingKey: g.key,
      });
    }
  }
  return needs;
}

export function listTargetToSkillProfile(
  targetList: number,
  effortMult: number
): { avgBatting: number; suggestedLabel: string; sectorMin: number } {
  const avgBatScore = targetList / 9;
  const avgBatting = Math.max(3, Math.min(20, avgBatScore / (effortMult * 1.05)));
  const sectorMin = Math.max(3, Math.round(avgBatting) - 1);
  return {
    avgBatting: Math.round(avgBatting * 10) / 10,
    suggestedLabel: levelToLabel(Math.round(avgBatting)),
    sectorMin,
  };
}

export function rankBuyRecommendations(
  listings: TransferListing[],
  needs: SquadGapNeed[],
  opts: {
    cash?: number;
    weeklyOutgoings?: number;
    factorFinance: boolean;
    minReserve?: number;
  }
): BuyRecommendation[] {
  const minReserve = opts.minReserve ?? Math.max(50_000, (opts.weeklyOutgoings || 0) * 2);
  const cash = opts.cash ?? 0;
  const recs: BuyRecommendation[] = [];

  for (const listing of listings) {
    const cost = listing.currentBid || listing.askingPrice || 0;
    const affordable =
      cost <= 0 ? cash >= minReserve * 0.5 : cash - cost >= minReserve * 0.25;

    const primPairs: [string, number][] = [
      ['batting', listing.skills.batting || 0],
      ['bowling', listing.skills.bowling || 0],
      ['keeping', listing.skills.keeping || 0],
      ['fielding', listing.skills.fielding || 0],
    ];
    primPairs.sort((a, b) => b[1] - a[1]);
    const prim = { key: primPairs[0][0], value: primPairs[0][1] };

    const reasons: string[] = [];
    let score = 0;
    let fitsNeed: string | undefined;

    for (const need of needs) {
      let skillVal = 0;
      if (need.need === 'batting') skillVal = listing.skills.batting || 0;
      else if (need.need === 'bowling' || need.need === 'seam' || need.need === 'spin') {
        skillVal = listing.skills.bowling || 0;
        if (need.need === 'spin' && listing.bowlingType && !isSpinBowler(listing.bowlingType)) continue;
        if (need.need === 'seam' && listing.bowlingType && isSpinBowler(listing.bowlingType)) continue;
      } else if (need.need === 'keeping') skillVal = listing.skills.keeping || 0;
      else if (need.need === 'fielding') skillVal = listing.skills.fielding || 0;
      else if (need.need === 'all-rounder') {
        skillVal = Math.min(listing.skills.batting || 0, listing.skills.bowling || 0);
      }

      if (skillVal > 0) {
        if (skillVal >= need.minSkill) {
          score += 32 + (skillVal - need.minSkill) * 12;
          const sk =
            need.need === 'keeping'
              ? 'keeping'
              : need.need === 'fielding'
                ? 'fielding'
                : need.need === 'batting'
                  ? 'batting'
                  : 'bowling';
          reasons.push(need.reason + ' — has ' + skillVal + ' (' + getSkillLabel(sk, skillVal) + ')');
          fitsNeed = need.ratingKey || need.need;
        } else if (skillVal >= need.minSkill - 2) {
          score += 14;
          reasons.push('Near fit: ' + need.need + ' ' + skillVal + ' (want ' + need.minSkill + '+)');
          fitsNeed = fitsNeed || need.ratingKey || need.need;
        }
      } else if (need.maxAge && listing.age != null && listing.age <= need.maxAge) {
        score += 5;
        reasons.push('Age fits ' + (need.ratingKey || need.need) + ' target');
        fitsNeed = fitsNeed || need.ratingKey || need.need;
      }
    }

    if (listing.btRating) {
      if (listing.btRating >= 12000) {
        score += 12;
        reasons.push('Strong BTR ' + listing.btRating.toLocaleString());
      } else if (listing.btRating >= 8000) score += 7;
      else if (listing.btRating >= 5000) score += 3;
    }
    if (prim.value >= 10) score += 8;
    else if (prim.value >= 7) score += 4;

    if (listing.age != null) {
      if (listing.age <= 21) {
        score += 12;
        reasons.push('Young — development upside');
      } else if (listing.age <= 24) score += 8;
      else if (listing.age <= 27) score += 3;
      else if (listing.age >= 32) {
        score -= 6;
        reasons.push('Older — limited trainability');
      }
    }

    if (opts.factorFinance) {
      if (affordable && cost > 0) {
        score += 8;
        reasons.push('Within budget at £' + cost.toLocaleString());
      } else if (!affordable) {
        score -= 4;
        reasons.push(
          cost > 0
            ? 'Out of budget — ~£' + cost.toLocaleString() + ' (cash £' + cash.toLocaleString() + ')'
            : 'Budget unclear — stretch target'
        );
      }
    }

    if (score < -5 && prim.value === 0 && !listing.btRating && !fitsNeed) {
      score = 0;
      if (!reasons.length) reasons.push('On the transfer list — review vs your gaps');
    }

    const active = opts.factorFinance ? affordable : true;
    recs.push({
      listing,
      score,
      reasons: reasons.slice(0, 5),
      affordable: opts.factorFinance ? affordable : true,
      cost,
      fitsNeed,
      active,
    });
  }

  recs.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.score - a.score || a.cost - b.cost;
  });
  return recs;
}

export function deriveGapNeeds(input: {
  topOrder: number;
  middleOrder: number;
  lowerOrder: number;
  targetList: number;
  xiBattingSkills: number[];
  xiBowlingSkills: number[];
  xiKeepingSkills: number[];
}): SquadGapNeed[] {
  const needs: SquadGapNeed[] = [];
  const battersSorted = [...input.xiBattingSkills].sort((a, b) => a - b);
  const medianBat = battersSorted[Math.floor(battersSorted.length / 2)] ?? 8;
  const profile = listTargetToSkillProfile(input.targetList, 0.85);
  needs.push({
    need: 'batting',
    minSkill: Math.max(profile.sectorMin, medianBat),
    maxAge: 26,
    reason: 'List target ' + input.targetList + ' → ~' + profile.suggestedLabel + ' batting',
  });
  const weakBowl = Math.min(...(input.xiBowlingSkills.length ? input.xiBowlingSkills : [6]));
  if (weakBowl < 9) {
    needs.push({
      need: 'bowling',
      minSkill: Math.max(8, weakBowl + 1),
      maxAge: 27,
      reason: 'Bowling depth thin (weakest XI bowler ' + weakBowl + ')',
    });
  }
  const bestKeep = Math.max(...(input.xiKeepingSkills.length ? input.xiKeepingSkills : [0]), 0);
  if (bestKeep < 8) {
    needs.push({
      need: 'keeping',
      minSkill: 8,
      maxAge: 28,
      reason: 'Keeper upgrade path (current best ' + bestKeep + ')',
    });
  }
  return needs;
}
