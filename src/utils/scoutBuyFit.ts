/**
 * Scout buy-fit: is an external player worth buying vs the current squad.
 */
import { getSkillLabel, SKILL_LEVELS } from '../types';

export type TeamRatingKey =
  | 'topOrder'
  | 'middleOrder'
  | 'lowerOrder'
  | 'seamBowling'
  | 'spinBowling'
  | 'fielding'
  | 'wicketKeeping';

function levelToLabel(level: number): string {
  const i = Math.max(0, Math.min(SKILL_LEVELS.length - 1, Math.round(level)));
  return SKILL_LEVELS[i] || 'useless';
}

export interface BuyFitPlayer {
  id?: string;
  name: string;
  age: number;
  wage?: number;
  btRating?: number;
  role?: string;
  skills: {
    batting?: number;
    bowling?: number;
    keeping?: number;
    fielding?: number;
    stamina?: number;
    concentration?: number;
    consistency?: number;
  };
  bowlingType?: string;
}

export interface BuyFitComparison {
  label: string;
  yours: string;
  theirs: string;
  better: boolean;
}

export interface BuyFitVerdict {
  verdict: 'BUY' | 'MAYBE' | 'PASS';
  score: number;
  reasons: string[];
  comparisons: BuyFitComparison[];
  replaces?: string;
  replacesReason?: string;
  affordable: boolean;
  summary: string;
}

function primaryOf(p: BuyFitPlayer): { key: 'batting' | 'bowling' | 'keeping'; value: number } {
  const bat = p.skills.batting || 0;
  const bowl = p.skills.bowling || 0;
  const keep = p.skills.keeping || 0;
  const role = (p.role || '').toLowerCase();
  if (role.includes('keep') || keep >= Math.max(bat, bowl) + 1) {
    return { key: 'keeping', value: keep };
  }
  if (role.includes('bowl') || bowl > bat) return { key: 'bowling', value: bowl };
  if (role.includes('bat')) return { key: 'batting', value: bat };
  if (keep >= 8 && keep >= bat && keep >= bowl) return { key: 'keeping', value: keep };
  if (bowl >= bat) return { key: 'bowling', value: bowl };
  return { key: 'batting', value: bat };
}

/**
 * Decide if a scouted external player is worth buying relative to the current squad.
 */
export function evaluateScoutBuyFit(
  candidate: BuyFitPlayer,
  squad: BuyFitPlayer[],
  opts?: {
    cash?: number;
    weeklyOutgoings?: number;
    ratingTargets?: Partial<Record<TeamRatingKey, number>>;
    factorFinance?: boolean;
  }
): BuyFitVerdict {
  const reasons: string[] = [];
  const comparisons: BuyFitComparison[] = [];
  let score = 50;

  if (!squad.length) {
    return {
      verdict: 'MAYBE',
      score: 40,
      reasons: ['No squad synced — sync your roster so we can compare skill gaps.'],
      comparisons: [],
      affordable: true,
      summary: 'Sync your squad to get a proper buy recommendation.',
    };
  }

  const cand = primaryOf(candidate);
  const sameRole = squad
    .map((p) => ({ p, prim: primaryOf(p) }))
    .filter((x) => x.prim.key === cand.key)
    .sort((a, b) => a.prim.value - b.prim.value);

  const allPrim = squad.map((p) => primaryOf(p).value).sort((a, b) => a - b);
  const squadMedian = allPrim[Math.floor(allPrim.length / 2)] ?? 6;
  const roleMedian =
    sameRole.length > 0
      ? sameRole[Math.floor(sameRole.length / 2)].prim.value
      : squadMedian;
  const roleWeakest = sameRole.length > 0 ? sameRole[0].prim.value : squadMedian;
  const roleBest = sameRole.length > 0 ? sameRole[sameRole.length - 1].prim.value : squadMedian;

  comparisons.push({
    label: cand.key.charAt(0).toUpperCase() + cand.key.slice(1),
    yours: levelToLabel(roleMedian) + ' (median)',
    theirs: levelToLabel(cand.value),
    better: cand.value > roleMedian,
  });

  const skillDelta = cand.value - roleMedian;
  if (skillDelta >= 3) {
    score += 28;
    reasons.push(
      'Clearly upgrades your ' + cand.key + ' (' + levelToLabel(cand.value) +
      ' vs squad median ' + levelToLabel(roleMedian) + ')'
    );
  } else if (skillDelta >= 1) {
    score += 16;
    reasons.push(
      'Solid step up in ' + cand.key + ' (+' + skillDelta +
      ' vs median ' + levelToLabel(roleMedian) + ')'
    );
  } else if (skillDelta === 0) {
    score += 2;
    reasons.push('Matches your current ' + cand.key + ' median — depth only');
  } else if (skillDelta >= -1) {
    score -= 8;
    reasons.push('Only marginally below your ' + cand.key + ' median');
  } else {
    score -= 22;
    reasons.push(
      'Below your ' + cand.key + ' standard (' + levelToLabel(cand.value) +
      ' vs ' + levelToLabel(roleMedian) + ')'
    );
  }

  let replaces: string | undefined;
  let replacesReason: string | undefined;
  if (sameRole.length && cand.value > roleWeakest) {
    const weak = sameRole[0];
    if (cand.value >= weak.prim.value + 1) {
      replaces = weak.p.name;
      replacesReason =
        'Could replace ' + weak.p.name + ' (' + levelToLabel(weak.prim.value) +
        ' → ' + levelToLabel(cand.value) + ')';
      score += 10;
      reasons.push(replacesReason);
    }
  }

  const age = candidate.age ?? 25;
  if (age <= 20) {
    score += 14;
    reasons.push('Young (' + age + ') — strong development upside');
  } else if (age <= 23) {
    score += 9;
    reasons.push('Still developing at ' + age);
  } else if (age <= 26) {
    score += 3;
  } else if (age >= 30) {
    score -= 12;
    reasons.push('Older at ' + age + ' — limited trainability');
  } else if (age >= 28) {
    score -= 6;
    reasons.push('Late 20s — peak window, not a long project');
  }

  const squadBtrs = squad.map((p) => p.btRating || 0).filter((n) => n > 0).sort((a, b) => a - b);
  const medBtr = squadBtrs.length ? squadBtrs[Math.floor(squadBtrs.length / 2)] : 0;
  if (candidate.btRating && medBtr) {
    comparisons.push({
      label: 'BTR',
      yours: medBtr.toLocaleString() + ' (median)',
      theirs: candidate.btRating.toLocaleString(),
      better: candidate.btRating > medBtr,
    });
    if (candidate.btRating > medBtr * 1.25) {
      score += 10;
      reasons.push('BTR well above your squad median');
    } else if (candidate.btRating < medBtr * 0.7) {
      score -= 8;
      reasons.push('BTR below typical squad quality');
    }
  }

  const wage = candidate.wage || 0;
  const squadWages = squad.map((p) => p.wage || 0).filter((n) => n > 0).sort((a, b) => a - b);
  const medWage = squadWages.length ? squadWages[Math.floor(squadWages.length / 2)] : 0;
  if (wage && medWage) {
    comparisons.push({
      label: 'Wage',
      yours: '£' + medWage.toLocaleString() + '/wk median',
      theirs: '£' + wage.toLocaleString() + '/wk',
      better: wage <= medWage,
    });
    const wagePerSkill = wage / Math.max(1, cand.value);
    const medPerSkill = medWage / Math.max(1, roleMedian);
    if (wagePerSkill < medPerSkill * 0.85 && skillDelta >= 0) {
      score += 8;
      reasons.push('Good wage-for-skill vs your squad');
    } else if (wagePerSkill > medPerSkill * 1.4) {
      score -= 10;
      reasons.push('Expensive for the skill level vs your squad wages');
    }
  }

  const targets = opts?.ratingTargets;
  if (targets && Object.keys(targets).length) {
    if (cand.key === 'batting') {
      const want = Math.max(targets.topOrder ?? 0, targets.middleOrder ?? 0);
      if (want && cand.value >= want) {
        score += 12;
        reasons.push('Meets your batting rating target (' + levelToLabel(want) + ')');
      } else if (want && cand.value >= want - 1) {
        score += 5;
        reasons.push('Near your batting rating target (' + levelToLabel(want) + ')');
      }
    }
    if (cand.key === 'bowling') {
      const want = Math.max(targets.seamBowling ?? 0, targets.spinBowling ?? 0);
      if (want && cand.value >= want) {
        score += 12;
        reasons.push('Meets your bowling rating target (' + levelToLabel(want) + ')');
      }
    }
    if (cand.key === 'keeping') {
      const wkT = targets.wicketKeeping ?? 0;
      if (wkT && cand.value >= wkT) {
        score += 12;
        reasons.push('Meets your WK rating target (' + levelToLabel(wkT) + ')');
      } else if (wkT && cand.value > roleBest) {
        score += 8;
        reasons.push('Would improve your keeping vs current best');
      }
    }
  }

  const cash = opts?.cash ?? 0;
  const weekly = opts?.weeklyOutgoings ?? 0;
  const factorFinance = opts?.factorFinance !== false;
  let affordable = true;
  if (factorFinance && wage > 0 && (weekly > 0 || cash > 0)) {
    affordable = cash >= wage * 4 || cash > 100_000;
    if (!affordable) {
      score -= 15;
      reasons.push(
        'Wage £' + wage.toLocaleString() + '/wk may strain cash (£' + cash.toLocaleString() + ')'
      );
    } else if (cash > 0) {
      reasons.push('Wage looks absorbable given current cash position');
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict: 'BUY' | 'MAYBE' | 'PASS' = 'MAYBE';
  if (score >= 68 && (skillDelta >= 1 || age <= 22)) verdict = 'BUY';
  else if (score >= 62 && skillDelta >= 2) verdict = 'BUY';
  else if (score < 42) verdict = 'PASS';

  if (verdict === 'BUY' && !affordable) {
    verdict = 'MAYBE';
    reasons.push('Fit is strong but budget is tight — treat as stretch target');
  }

  const summary =
    verdict === 'BUY'
      ? 'Worth buying for your current squad — upgrades a clear gap.'
      : verdict === 'PASS'
      ? 'Not a priority vs your current squad quality and needs.'
      : 'Situational — useful depth or near-fit, but not a must-buy.';

  return {
    verdict,
    score,
    reasons: reasons.slice(0, 6),
    comparisons,
    replaces,
    replacesReason,
    affordable,
    summary,
  };
}
