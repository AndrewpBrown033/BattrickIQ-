import type { BuyRecommendation, SquadGapNeed, TransferListing } from './transferList';
import { estimateWeeksToNextLevel } from '../parser';
import { hoursUntilDeadline } from './transferWatchlist';
import { estimateOwnershipCost, MIN_CONTRACT_WEEKS } from './transferCosting';

export type InvestFlagKind =
  | 'fills_gap'
  | 'grows_into_gap'
  | 'prospect'
  | 'cheap_for_rating'
  | 'ending_soon'
  | 'ageing'
  | 'wage_strain'
  | 'wage_ok';

export interface InvestFlag {
  kind: InvestFlagKind;
  label: string;
  detail: string;
  tone: 'good' | 'info' | 'warn';
}

export interface InvestmentView {
  flags: InvestFlag[];
  investScore: number;
  isInvestment: boolean;
  primary?: 'batting' | 'bowling' | 'keeping';
  primaryNow?: number;
  primaryInSeason?: number;
  weeksPerPop?: number;
}

type Primary = 'batting' | 'bowling' | 'keeping';

function primaryOf(l: TransferListing): Primary | undefined {
  const { batting = 0, bowling = 0, keeping = 0 } = l.skills || {};
  if (l.role === 'Keeper' && keeping > 0) return 'keeping';
  if (l.role === 'Bowler' && bowling > 0) return 'bowling';
  if (l.role === 'Batter' && batting > 0) return 'batting';
  const best = Math.max(batting, bowling, keeping);
  if (best <= 0) return undefined;
  return best === keeping ? 'keeping' : best === bowling ? 'bowling' : 'batting';
}

function needMatchesPrimary(n: SquadGapNeed, p: Primary): boolean {
  if (p === 'batting') return n.need === 'batting';
  if (p === 'bowling') return n.need === 'seam' || n.need === 'spin' || n.need === 'bowling';
  return n.need === 'keeping';
}

export function annotateInvestments(
  recs: BuyRecommendation[],
  needs: SquadGapNeed[],
  ctx: { coachLevel?: number; cash?: number; wageWeeks?: number; weeklyOutgoings?: number } = {}
): Map<string, InvestmentView> {
  const coach = ctx.coachLevel ?? 9;
  const wageWeeks = ctx.wageWeeks ?? MIN_CONTRACT_WEEKS;
  const out = new Map<string, InvestmentView>();

  const ratios = recs
    .map((r) => ({ id: r.listing.playerId, btr: r.listing.btRating || 0, cost: Math.max(1000, r.cost || 0) }))
    .filter((x) => x.btr > 0);
  const sortedBtr = ratios.map((x) => x.btr).sort((a, b) => a - b);
  const medianBtr = sortedBtr.length ? sortedBtr[Math.floor(sortedBtr.length / 2)] : 0;
  const ratioList = ratios.filter((x) => x.btr >= medianBtr).map((x) => x.btr / x.cost).sort((a, b) => a - b);
  const cheapCut = ratioList.length >= 4 ? ratioList[Math.floor(ratioList.length * 0.75)] : Infinity;

  for (const rec of recs) {
    try {
      const l = rec.listing;
      if (!l?.playerId) continue;
      const flags: InvestFlag[] = [];
      let score = 0;
      const skills = l.skills || {};
      const primary = primaryOf(l);
      const now = primary ? skills[primary] || 0 : 0;
      const age = l.age ?? 25;

      let weeksPerPop: number | undefined;
      let inSeason: number | undefined;
      if (primary && now < 20) {
        const w = estimateWeeksToNextLevel(now, age, 1, coach, primary);
        if (w > 0 && Number.isFinite(w)) {
          weeksPerPop = w;
          inSeason = Math.min(20, Math.round((now + 16 / w) * 10) / 10);
        }
      }

      if (rec.fitsNeed && rec.score >= 32) {
        flags.push({
          kind: 'fills_gap',
          label: 'Fills a gap now',
          detail: (rec.reasons[0] || 'Meets a squad need').replace(/\s+/g, ' '),
          tone: 'good',
        });
        score += 30;
      }

      if (primary && weeksPerPop && !flags.some((f) => f.kind === 'fills_gap')) {
        const need = needs.find((n) => needMatchesPrimary(n, primary) && now < n.minSkill);
        if (need) {
          let weeks = 0;
          for (let lvl = now; lvl < need.minSkill && weeks <= 60; lvl++) {
            const w = estimateWeeksToNextLevel(lvl, age, 1, coach, primary);
            weeks += Number.isFinite(w) ? w : 99;
          }
          if (weeks <= 32) {
            flags.push({
              kind: 'grows_into_gap',
              label: `Grows into gap (~${Math.round(weeks)}w)`,
              detail: `${primary} ${now} → ${need.minSkill} in about ${Math.round(weeks)} weeks on 1 net`,
              tone: 'good',
            });
            score += weeks <= 16 ? 26 : 16;
          }
        }
      }

      if (age <= 21 && primary && now >= 7) {
        flags.push({
          kind: 'prospect',
          label: 'Young prospect',
          detail: `Age ${age}, ${primary} ${now}; ~${weeksPerPop ? Math.round(weeksPerPop) : '?'}w per level, so ~${inSeason ?? now} in a season`,
          tone: 'info',
        });
        score += 15;
      }

      const cost = Math.max(1000, rec.cost || 0);
      if ((l.btRating || 0) >= medianBtr && l.btRating && l.btRating / cost >= cheapCut) {
        flags.push({
          kind: 'cheap_for_rating',
          label: 'Cheap for his rating',
          detail: `BT rating ${l.btRating.toLocaleString()} at £${cost.toLocaleString()} (top quarter on the market).`,
          tone: 'info',
        });
        score += 10;
      }

      const hrs = hoursUntilDeadline(l.deadline);
      if (hrs != null && hrs >= 0 && hrs <= 12) {
        flags.push({
          kind: 'ending_soon',
          label: `Ends in ~${Math.max(1, Math.round(hrs))}h`,
          detail: 'Auction closes soon',
          tone: 'warn',
        });
        if (score >= 20) score += 5;
      }

      if (age >= 32) {
        flags.push({
          kind: 'ageing',
          label: 'Ageing',
          detail: `Age ${age}: slower training and skills may decline. Short-term use only.`,
          tone: 'warn',
        });
        score -= 10;
      }

      if (ctx.cash != null) {
        const own = estimateOwnershipCost(l, {
          cash: ctx.cash,
          weeklyOutgoings: ctx.weeklyOutgoings,
          wageWeeks,
        });
        if (own.weeklyWage > 0) {
          if (!own.solvent) {
            flags.push({
              kind: 'wage_strain',
              label: `Wage strain (${wageWeeks}w)`,
              detail: `Fee £${own.transferFee.toLocaleString()} + £${own.weeklyWage.toLocaleString()}/wk × ${wageWeeks} = £${own.totalCost.toLocaleString()} exceeds comfortable cash`,
              tone: 'warn',
            });
            score -= 12;
          } else if (own.feeAffordable) {
            flags.push({
              kind: 'wage_ok',
              label: `OK after ${wageWeeks}w wages`,
              detail: `Total ~£${own.totalCost.toLocaleString()} (fee + wages)`,
              tone: 'good',
            });
            score += 4;
          }
        }
      }

      if (!(rec.active ?? rec.affordable)) score = Math.round(score * 0.5);
      const isInvestment = score >= 25 && (rec.active ?? rec.affordable);
      out.set(l.playerId, {
        flags,
        investScore: Math.max(0, score),
        isInvestment,
        primary,
        primaryNow: primary ? now : undefined,
        primaryInSeason: inSeason,
        weeksPerPop,
      });
    } catch {
      /* skip bad listing row */
    }
  }
  return out;
}
