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

export interface BuyRecommendation {
  listing: TransferListing;
  score: number;
  reasons: string[];
  affordable: boolean;
  cost: number;
  fitsNeed?: string;
  active: boolean;
}

export interface SquadGapNeed {
  need: string;
  minSkill: number;
  reason: string;
  ratingKey?: TeamRatingKey;
}

function parseMoney(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
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
    keeping: parseSkillToken(blockText, ['keeping', 'wicket keeping', 'wk', 'keeper']),
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

/** True when a listing has transfer-market signals (not just a squad roster link). */
export function looksLikeTransferListing(l: TransferListing, relaxed = false): boolean {
  if (
    (l.askingPrice != null && l.askingPrice > 0) ||
    (l.currentBid != null && l.currentBid > 0) ||
    (l.deadline && String(l.deadline).trim())
  ) {
    return true;
  }
  const snip = l.snippet || '';
  if (/(?:asking|current\s*bid|deadline|reserve|min(?:imum)?\s*bid|time\s*left|ends?\s*in)/i.test(snip)) {
    return true;
  }
  if (/[£$€]\s*[\d,]+/.test(snip)) return true;
  if (relaxed) {
    if (l.age && (l.skills.batting || l.skills.bowling || l.skills.keeping || l.skills.fielding)) return true;
    if (l.age && /\b(?:bat|bowl|keep|field|stam|wage|btr)\b/i.test(snip)) return true;
  }
  return false;
}

/** True when HTML is the transfer search form with no result rows yet. */
export function isTransferSearchFormOnly(html: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  const playerLinks = (lower.match(/playerdetails\.asp/g) || []).length;
  const hasSearchUi =
    /transfer\s*list|transfer\s*market|search/.test(lower) &&
    (lower.includes('<form') || lower.includes('type="submit"') || lower.includes("type='submit'"));
  const hasResultMarkers =
    (lower.match(/asking\s*price/g) || []).length >= 2 ||
    (lower.match(/current\s*bid/g) || []).length >= 2 ||
    (lower.match(/time\s*left/g) || []).length >= 1;
  return hasSearchUi && playerLinks < 3 && !hasResultMarkers;
}

/** Reject pages that are clearly squad/office rather than the transfer market. */
export function isTransferMarketHtml(html: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  if (lower.includes('log in to battrick') && lower.includes('name="password"')) return false;
  const marketHits =
    (lower.match(/asking\s*price/g) || []).length +
    (lower.match(/current\s*bid/g) || []).length +
    (lower.match(/deadline/g) || []).length +
    (lower.match(/transfer\s*list/g) || []).length +
    (lower.match(/transfer\s*market/g) || []).length;
  const squadHits =
    (lower.match(/\bnets\b/g) || []).length +
    (lower.match(/player\s*form/g) || []).length +
    (lower.match(/training\s*type/g) || []).length;
  if (marketHits >= 2) return true;
  if (marketHits >= 1 && squadHits < 3) return true;
  return false;
}

export function parseTransferList(
  html: string,
  opts?: { excludePlayerIds?: Iterable<string> }
): TransferListing[] {
  if (!html || typeof html !== 'string') return [];
  const exclude = new Set(
    [...(opts?.excludePlayerIds || [])].map((id) => String(id)).filter(Boolean)
  );
  const listings: TransferListing[] = [];
  const seen = new Set<string>();

  const relaxed = isTransferMarketHtml(html) || /transfer\s*list|transfer\s*market/i.test(html);
  const push = (item: TransferListing) => {
    if (!item.playerId || seen.has(item.playerId)) return;
    if (exclude.has(item.playerId)) return;
    if (!looksLikeTransferListing(item, relaxed)) return;
    seen.add(item.playerId);
    listings.push(item);
  };

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
        if (
          link.closest(
            '#menubar, #rightmenu, .menu, #topmenu, nav, #leftmenu, #menu, .leftmenu, #sidebar, header, footer'
          )
        ) {
          continue;
        }
        const href = link.getAttribute('href') || '';
        const idMatch =
          href.match(/playerid=(\d+)/i) ||
          href.match(/PlayerID=(\d+)/i) ||
          href.match(/(?:playerid|id)[=_](\d+)/i);
        if (!idMatch) continue;
        const playerId = idMatch[1];
        if (seen.has(playerId) || exclude.has(playerId)) continue;
        const name = (link.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 2 || name.length > 60) continue;
        const block =
          link.closest('tr, li, .transfer, .player, .card, article, table, tbody, div') ||
          link.parentElement;
        const blockText = (block?.textContent || link.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        push(extractListingFromBlock(playerId, name, href, blockText));
      }
    }
  } catch (e) {
    console.warn('parseTransferList DOM parse failed', e);
  }

  for (const item of parseTransferListRegex(html)) {
    push(item);
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

export function labelToLevel(label: string): number {
  const normalized = String(label || '').toLowerCase().trim();
  const idx = SKILL_LEVELS.findIndex((l) => String(l).toLowerCase() === normalized);
  if (idx >= 0) return idx;
  const n = Number(normalized);
  if (Number.isFinite(n)) return Math.max(0, Math.min(20, Math.round(n)));
  return 0;
}

export function levelToLabel(level: number): string {
  const clamped = Math.max(0, Math.min(20, Math.round(level)));
  return SKILL_LEVELS[clamped] || String(clamped);
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
  const midLvl = clampLvl(avg(ordered.slice(6, 9).map(batEff)));
  const midLvl2 = clampLvl(avg(ordered.slice(3, 6).map(batEff)));
  const lowLvl = clampLvl(avg(ordered.slice(6, 9).map(batEff)));

  const seamers = xi.filter((p) => isSeamBowler(p.bowlingType) && (p.skills.bowling || 0) >= 5);
  const spinners = xi.filter((p) => isSpinBowler(p.bowlingType) && (p.skills.bowling || 0) >= 5);
  const bowlPool = seamers.length ? seamers : xi.filter((p) => (p.skills.bowling || 0) >= 4);
  const spinPool = spinners.length ? spinners : xi.filter((p) => (p.skills.bowling || 0) >= 4);
  const seamLvl = clampLvl(avg(bowlPool.slice(0, 4).map((p) => p.skills.bowling)));
  const spinLvl = clampLvl(avg(spinPool.slice(0, 3).map((p) => p.skills.bowling)));
  const fieldLvl = clampLvl(
    avg(xi.map((p) => p.skills.fielding ?? Math.min(12, (p.skills.batting + p.skills.bowling) / 2)))
  );
  const keepLvl = clampLvl(Math.max(...xi.map((p) => p.skills.keeping || 0), 0));

  return {
    topOrder: { level: topLvl, label: levelToLabel(topLvl) },
    middleOrder: { level: midLvl2, label: levelToLabel(midLvl2) },
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
): { key: TeamRatingKey; current: number; target: number; gap: number }[] {
  const keys: TeamRatingKey[] = [
    'topOrder',
    'middleOrder',
    'lowerOrder',
    'seamBowling',
    'spinBowling',
    'fielding',
    'wicketKeeping',
  ];
  return keys
    .map((key) => {
      const cur = current[key]?.level ?? 0;
      const target = targets[key] ?? 0;
      return { key, current: cur, target, gap: target - cur };
    })
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap);
}

export function deriveNeedsFromRatingGaps(
  gaps: { key: TeamRatingKey; current: number; target: number; gap: number }[]
): SquadGapNeed[] {
  const needs: SquadGapNeed[] = [];
  for (const g of gaps) {
    if (g.gap <= 0) continue;
    const minSkill = Math.max(1, g.target - 1);
    if (g.key === 'topOrder' || g.key === 'middleOrder' || g.key === 'lowerOrder') {
      needs.push({
        need: 'batting',
        minSkill,
        reason: `${g.key} gap +${g.gap} (need ~${levelToLabel(g.target)})`,
        ratingKey: g.key,
      });
    } else if (g.key === 'seamBowling') {
      needs.push({
        need: 'seam',
        minSkill,
        reason: `Seam gap +${g.gap} (need ~${levelToLabel(g.target)})`,
        ratingKey: g.key,
      });
    } else if (g.key === 'spinBowling') {
      needs.push({
        need: 'spin',
        minSkill,
        reason: `Spin gap +${g.gap} (need ~${levelToLabel(g.target)})`,
        ratingKey: g.key,
      });
    } else if (g.key === 'fielding') {
      needs.push({
        need: 'fielding',
        minSkill,
        reason: `Fielding gap +${g.gap}`,
        ratingKey: g.key,
      });
    } else if (g.key === 'wicketKeeping') {
      needs.push({
        need: 'keeping',
        minSkill,
        reason: `WK gap +${g.gap}`,
        ratingKey: g.key,
      });
    }
  }
  return needs;
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
          reasons.push(need.reason + ' — has ' + skillVal + ' (' + getSkillLabel(sk as any, skillVal) + ')');
          fitsNeed = need.ratingKey || need.need;
        } else if (skillVal >= need.minSkill - 2) {
          score += 14;
          reasons.push('Near fit: ' + need.need + ' ' + skillVal);
        }
      }
    }

    if (listing.age && listing.age <= 25) score += 6;
    if (listing.age && listing.age >= 32) score -= 4;
    if (opts.factorFinance) {
      if (affordable) score += 8;
      else score -= 6;
    }

    if (score <= 0 && reasons.length === 0) {
      reasons.push('On transfer list');
    }

    recs.push({
      listing,
      score,
      reasons: reasons.slice(0, 4),
      affordable: opts.factorFinance ? affordable : true,
      cost,
      fitsNeed,
      active: opts.factorFinance ? affordable : true,
    });
  }

  return recs.sort((a, b) => b.score - a.score);
}
