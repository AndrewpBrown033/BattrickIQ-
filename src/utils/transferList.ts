/**
 * Parse Battrick transferlist.asp HTML and score buy opportunities
 * against squad gaps / financial position.
 *
 * Unaffordable listings are still returned with affordable=false so the UI
 * can show them as inactive "watch / stretch" targets.
 */

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
  playerUrl?: string;
  snippet?: string;
}

export interface SquadGapNeed {
  need: 'batting' | 'bowling' | 'keeping' | 'all-rounder';
  minSkill: number;
  maxAge?: number;
  reason: string;
}

export interface BuyRecommendation {
  listing: TransferListing;
  score: number;
  reasons: string[];
  /** True when bid is within cash + reserve rules (or finance filter is off). */
  affordable: boolean;
  cost: number;
  fitsNeed?: string;
  /** Active = worth bidding now; inactive = good fit but over budget / stretch. */
  active: boolean;
}

function parseMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/[£$€,\s]/g, '');
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseSkillToken(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:=]?\\s*(\\d{1,2})`, 'i');
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
    blockText.match(/\\b(?:age|aged)\\s*[:=]?\\s*(\\d{1,2})\\b/i) || blockText.match(/\\((\\d{2})\\)/);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;
  const priceMatch =
    blockText.match(/(?:asking\\s*price|reserve|min(?:imum)?\\s*bid|price)\\s*[:=]?\\s*[£$€]?\\s*([\\d,]+)/i) ||
    blockText.match(/[£$€]\\s*([\\d,]{3,})/);
  const askingPrice = priceMatch ? parseMoney(priceMatch[1]) : undefined;
  const bidMatch = blockText.match(/(?:current\\s*bid|highest\\s*bid|bid)\\s*[:=]?\\s*[£$€]?\\s*([\\d,]+)/i);
  const currentBid = bidMatch ? parseMoney(bidMatch[1]) : undefined;
  const deadlineMatch =
    blockText.match(/(?:deadline|ends?|closes?)\\s*[:=]?\\s*([0-3]?\\d\\/[0-1]?\\d\\/\\d{2,4}(?:\\s+\\d{1,2}:\\d{2})?)/i) ||
    blockText.match(/\\b(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\s+\\d{1,2}:\\d{2})\\b/);
  const deadline = deadlineMatch ? deadlineMatch[1] : undefined;
  const btrMatch = blockText.match(/\\b(?:BTR|Battrick\\s*Rating|BT\\s*Rating)\\s*[:=]?\\s*([\\d,]+)/i);
  const btRating = btrMatch ? parseMoney(btrMatch[1]) : undefined;
  const wageMatch = blockText.match(/\\b(?:wage|salary)\\s*[:=]?\\s*[£$€]?\\s*([\\d,]+)/i);
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
  let role: string | undefined;
  if ((skills.keeping || 0) >= 6 && (skills.keeping || 0) >= (skills.batting || 0)) role = 'Keeper';
  else if ((skills.batting || 0) >= 6 && (skills.bowling || 0) >= 6) role = 'All-rounder';
  else if ((skills.bowling || 0) > (skills.batting || 0)) role = 'Bowler';
  else if ((skills.batting || 0) > 0) role = 'Batter';

  const playerUrl = href.startsWith('http')
    ? href
    : `https://www.battrick.org/nl/${href.replace(/^\\//, '')}`;

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
    playerUrl,
    snippet: blockText.slice(0, 220),
  };
}

/** Regex fallback when DOMParser finds few / no player links. */
function parseTransferListRegex(html: string): TransferListing[] {
  const listings: TransferListing[] = [];
  const seen = new Set<string>();
  const re =
    /<a[^>]+href=["']([^"']*(?:playerdetails\\.asp|playerid=|PlayerID=)[^"']*)["'][^>]*>([\\s\\S]*?)<\\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const idMatch =
      href.match(/playerid=(\\d+)/i) ||
      href.match(/PlayerID=(\\d+)/i) ||
      href.match(/(?:playerid|id)[=_](\\d+)/i);
    if (!idMatch) continue;
    const playerId = idMatch[1];
    if (seen.has(playerId)) continue;
    seen.add(playerId);
    const name = m[2].replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
    if (!name || name.length < 2 || name.length > 60) continue;
    const start = Math.max(0, m.index - 400);
    const end = Math.min(html.length, m.index + m[0].length + 600);
    const blockText = html
      .slice(start, end)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\\s+/g, ' ')
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
          'a[href*="playerdetails.asp"], a[href*="playerid="], a[href*="PlayerID="]'
        )
      );
      for (const link of links) {
        if (link.closest('#menubar, #rightmenu, .menu, #topmenu, nav, #leftmenu')) continue;
        const href = link.getAttribute('href') || '';
        const idMatch =
          href.match(/playerid=(\\d+)/i) ||
          href.match(/PlayerID=(\\d+)/i) ||
          href.match(/(?:playerid|id)[=_](\\d+)/i);
        if (!idMatch) continue;
        const playerId = idMatch[1];
        if (seen.has(playerId)) continue;
        seen.add(playerId);
        const name = (link.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!name || name.length < 2 || name.length > 60) continue;
        const block =
          link.closest('tr, li, .transfer, .player, .card, article, table, div') ||
          link.parentElement;
        const blockText = (block?.textContent || link.textContent || '')
          .replace(/\\s+/g, ' ')
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

function primarySkill(listing: TransferListing): { key: string; value: number } {
  const s = listing.skills;
  const pairs: [string, number][] = [
    ['batting', s.batting || 0],
    ['bowling', s.bowling || 0],
    ['keeping', s.keeping || 0],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  return { key: pairs[0][0], value: pairs[0][1] };
}

/**
 * Rank transfer listings vs squad gaps.
 * Never drops unaffordable players — they come back with affordable/active=false.
 */
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
      cost <= 0
        ? cash >= minReserve * 0.5
        : cash - cost >= minReserve * 0.25;

    const prim = primarySkill(listing);
    const reasons: string[] = [];
    let score = 0;
    let fitsNeed: string | undefined;

    for (const need of needs) {
      const skillVal =
        need.need === 'batting'
          ? listing.skills.batting || 0
          : need.need === 'bowling'
          ? listing.skills.bowling || 0
          : need.need === 'keeping'
          ? listing.skills.keeping || 0
          : Math.min(listing.skills.batting || 0, listing.skills.bowling || 0);

      if (skillVal > 0) {
        if (skillVal >= need.minSkill) {
          score += 28 + (skillVal - need.minSkill) * 10;
          reasons.push(`${need.reason} (${need.need} ${skillVal})`);
          fitsNeed = need.need;
        } else if (skillVal >= need.minSkill - 2) {
          score += 12;
          reasons.push(`Near fit for ${need.need} (has ${skillVal}, want ${need.minSkill}+)`);
          fitsNeed = fitsNeed || need.need;
        }
      } else if (need.maxAge && listing.age != null && listing.age <= need.maxAge) {
        score += 6;
        reasons.push(`Age fits ${need.need} target (≤${need.maxAge})`);
        fitsNeed = fitsNeed || need.need;
      }
    }

    if (listing.btRating) {
      if (listing.btRating >= 12000) {
        score += 14;
        reasons.push(`Strong BTR ${listing.btRating.toLocaleString()}`);
      } else if (listing.btRating >= 8000) {
        score += 8;
        reasons.push(`Solid BTR ${listing.btRating.toLocaleString()}`);
      } else if (listing.btRating >= 5000) {
        score += 3;
      }
    }
    if (prim.value >= 10) {
      score += 10;
      reasons.push(`Primary ${prim.key} ${prim.value}`);
    } else if (prim.value >= 7) {
      score += 5;
    }

    if (listing.age != null) {
      if (listing.age <= 21) {
        score += 14;
        reasons.push('Young — high development upside');
      } else if (listing.age <= 24) {
        score += 9;
        reasons.push('Still developing');
      } else if (listing.age <= 27) {
        score += 4;
      } else if (listing.age >= 32) {
        score -= 6;
        reasons.push('Older — limited trainability');
      }
    }

    if (opts.factorFinance) {
      if (affordable && cost > 0) {
        score += 8;
        reasons.push(`Within budget at £${cost.toLocaleString()}`);
      } else if (affordable && cost === 0) {
        reasons.push('Price unknown — verify before bidding');
      } else if (!affordable) {
        score -= 4;
        reasons.push(
          cost > 0
            ? `Out of budget — needs ~£${cost.toLocaleString()} (cash £${cash.toLocaleString()})`
            : 'Budget unclear — stretch target'
        );
      }
    }

    if (score < -5 && prim.value === 0 && !listing.btRating && !fitsNeed) continue;

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

/**
 * Derive squad gap needs from estimated XI sectors vs a target list.
 * Always returns at least one growth-oriented need so transfer scan has goals.
 */
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
  const neededSector = input.targetList / 21;
  const battersSorted = [...input.xiBattingSkills].sort((a, b) => a - b);
  const weakestBat = battersSorted[0] ?? 6;
  const medianBat = battersSorted[Math.floor(battersSorted.length / 2)] ?? 8;
  const strongestBat = battersSorted[battersSorted.length - 1] ?? 8;

  if (input.topOrder < neededSector - 0.2 || input.middleOrder < neededSector - 0.2) {
    needs.push({
      need: 'batting',
      minSkill: Math.max(weakestBat + 1, Math.ceil(medianBat)),
      maxAge: 27,
      reason: 'Batting list below target — upgrade top/middle order',
    });
  }

  const weakBowl = Math.min(...(input.xiBowlingSkills.length ? input.xiBowlingSkills : [6]));
  const bestBowl = Math.max(...(input.xiBowlingSkills.length ? input.xiBowlingSkills : [6]));
  if (weakBowl < 9 || bestBowl < 10) {
    needs.push({
      need: 'bowling',
      minSkill: Math.max(weakBowl + 1, 8),
      maxAge: 28,
      reason: 'Bowling depth soft — look for a primary bowler',
    });
  }

  const bestKeep = Math.max(...(input.xiKeepingSkills.length ? input.xiKeepingSkills : [0]));
  if (bestKeep < 9) {
    needs.push({
      need: 'keeping',
      minSkill: Math.max(bestKeep + 1, 8),
      maxAge: 29,
      reason: 'Wicketkeeping is a weak link',
    });
  }

  needs.push({
    need: 'batting',
    minSkill: Math.max(medianBat, Math.min(strongestBat, 10)),
    maxAge: 24,
    reason: 'Youth growth — young batter to build list long-term',
  });

  if (bestBowl < 12) {
    needs.push({
      need: 'all-rounder',
      minSkill: 7,
      maxAge: 26,
      reason: 'All-rounder depth for flexibility',
    });
  }

  return needs;
}
