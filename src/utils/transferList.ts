/**
 * Parse Battrick transferlist.asp HTML and score buy opportunities
 * against squad gaps / financial position.
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
  affordable: boolean;
  cost: number;
  fitsNeed?: string;
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

export function parseTransferList(html: string): TransferListing[] {
  if (!html || typeof html !== 'string') return [];

  const listings: TransferListing[] = [];
  const seen = new Set<string>();

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = Array.from(
      doc.querySelectorAll('a[href*="playerdetails.asp"], a[href*="playerid="], a[href*="PlayerID="]')
    );

    for (const link of links) {
      if (link.closest('#menubar, #rightmenu, .menu, #topmenu, nav')) continue;

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
        link.closest('tr, li, .transfer, .player, .card, article, div') || link.parentElement;
      const blockText = (block?.textContent || link.textContent || '').replace(/\s+/g, ' ').trim();

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

      let role: string | undefined;
      if ((skills.keeping || 0) >= 6 && (skills.keeping || 0) >= (skills.batting || 0)) role = 'Keeper';
      else if ((skills.batting || 0) >= 6 && (skills.bowling || 0) >= 6) role = 'All-rounder';
      else if ((skills.bowling || 0) > (skills.batting || 0)) role = 'Bowler';
      else if ((skills.batting || 0) > 0) role = 'Batter';

      const playerUrl = href.startsWith('http')
        ? href
        : `https://www.battrick.org/nl/${href.replace(/^\//, '')}`;

      listings.push({
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
      });
    }
  } catch (e) {
    console.warn('parseTransferList DOM parse failed', e);
  }

  if (listings.length === 0) {
    const re =
      /(?:playerdetails\.asp\?[^"'\s]*playerid=(\d+)[^"'\s]*|playerid=(\d+))[^<\n]{0,80}?([A-Za-z][A-Za-z\s.'-]{1,40})/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const playerId = m[1] || m[2];
      if (!playerId || seen.has(playerId)) continue;
      seen.add(playerId);
      listings.push({
        playerId,
        name: (m[3] || `Player ${playerId}`).trim(),
        skills: {},
        playerUrl: `https://www.battrick.org/nl/playerdetails.asp?playerid=${playerId}`,
      });
    }
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
  const minReserve = opts.minReserve ?? Math.max(100_000, (opts.weeklyOutgoings || 0) * 4);
  const cash = opts.cash ?? 0;
  const recs: BuyRecommendation[] = [];

  for (const listing of listings) {
    const cost = listing.currentBid || listing.askingPrice || 0;
    const wageHit = listing.wage || 0;
    const affordable =
      !opts.factorFinance ||
      (cost > 0 && cash - cost - wageHit >= minReserve) ||
      (cost === 0 && cash >= minReserve);

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

      if (skillVal >= need.minSkill) {
        const over = skillVal - need.minSkill;
        score += 20 + over * 8;
        reasons.push(`${need.reason} (listed ${need.need} ${skillVal}+)`);
        fitsNeed = need.need;
      }
    }

    if (listing.age != null) {
      if (listing.age <= 22) {
        score += 12;
        reasons.push('Young — development upside');
      } else if (listing.age <= 26) {
        score += 6;
      } else if (listing.age >= 30) {
        score -= 8;
        reasons.push('Older — limited trainability');
      }
    }

    if (listing.btRating && listing.btRating >= 8000) {
      score += 5;
      reasons.push(`Solid BTR ${listing.btRating.toLocaleString()}`);
    }

    if (opts.factorFinance) {
      if (affordable && cost > 0) {
        score += 10;
        reasons.push(`Affordable at £${cost.toLocaleString()} (reserve kept)`);
      } else if (!affordable) {
        score -= 25;
        reasons.push(
          cost > 0
            ? `Stretch — needs £${cost.toLocaleString()} (cash £${cash.toLocaleString()})`
            : 'Price unknown — check listing before bidding'
        );
      }
    }

    if (score <= 0 && prim.value === 0 && !fitsNeed) continue;

    recs.push({
      listing,
      score,
      reasons: reasons.slice(0, 4),
      affordable: opts.factorFinance ? affordable : true,
      cost,
      fitsNeed,
    });
  }

  recs.sort((a, b) => b.score - a.score || a.cost - b.cost);
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
  const neededSector = input.targetList / 21;
  const battersSorted = [...input.xiBattingSkills].sort((a, b) => a - b);
  const weakestBat = battersSorted[0] ?? 6;
  const medianBat = battersSorted[Math.floor(battersSorted.length / 2)] ?? 8;

  if (input.topOrder < neededSector - 0.3 || input.middleOrder < neededSector - 0.3) {
    needs.push({
      need: 'batting',
      minSkill: Math.max(weakestBat + 1, Math.ceil(medianBat)),
      maxAge: 27,
      reason: 'Batting list below target — upgrade a top/middle-order bat',
    });
  }

  const weakBowl = Math.min(...(input.xiBowlingSkills.length ? input.xiBowlingSkills : [6]));
  if (weakBowl < 8) {
    needs.push({
      need: 'bowling',
      minSkill: Math.max(weakBowl + 1, 8),
      maxAge: 28,
      reason: 'Bowling depth is soft — look for a primary bowler',
    });
  }

  const bestKeep = Math.max(...(input.xiKeepingSkills.length ? input.xiKeepingSkills : [0]));
  if (bestKeep < 8) {
    needs.push({
      need: 'keeping',
      minSkill: Math.max(bestKeep + 1, 8),
      maxAge: 29,
      reason: 'Wicketkeeping is a weak link',
    });
  }

  if (input.topOrder + input.middleOrder + input.lowerOrder < input.targetList / 7) {
    needs.push({
      need: 'batting',
      minSkill: Math.max(medianBat, 9),
      maxAge: 24,
      reason: 'Forward growth — young batter above current median',
    });
  }

  return needs;
}
