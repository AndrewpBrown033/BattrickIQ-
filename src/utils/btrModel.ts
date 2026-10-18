/**
 * Data-fitted BT rating model (replaces hand-guessed "+1800 BTR per pop" constants).
 *
 * Battrick's BT rating is not published, so we learn it from real players: our own squad plus
 * the latest transfer-market scan (each listing carries skills AND a BT rating). We fit
 *   ln(BTR) = a + sum(b_k * skill_k)
 * by ridge-regularised least squares. A +1 level in skill k then multiplies BTR by e^b_k.
 * With too little data (< MIN_SAMPLES) the model reports null and callers keep their fallbacks.
 *
 * Wage change on a skill pop uses the community-documented wage formulas
 * (battrickhelpfile): primary (n-3)^3*(n-1)+250, secondary 0.05*((0.67n)-0.33)^5.
 */
import type { BattrickPlayer } from '../types';

export const BTR_SKILLS = ['batting', 'bowling', 'keeping', 'stamina', 'concentration', 'consistency', 'fielding'] as const;
export type BtrSkill = (typeof BTR_SKILLS)[number];

export interface BtrModel {
  intercept: number;
  coef: Record<BtrSkill, number>;
  n: number;
  /** Fit quality on ln(BTR), 0..1. */
  r2: number;
}

const MIN_SAMPLES = 20;

interface Sample { skills: Partial<Record<BtrSkill, number>>; btr: number }

function readJson<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}

export function collectSamples(): Sample[] {
  const out: Sample[] = [];
  const squad = readJson<BattrickPlayer[]>('bt_squad', []);
  for (const p of Array.isArray(squad) ? squad : []) {
    if (p?.btRating > 0 && p.skills) out.push({ skills: p.skills as any, btr: p.btRating });
  }
  const listings = readJson<any[]>('bt_transfer_listings', []);
  for (const l of Array.isArray(listings) ? listings : []) {
    if (l?.btRating > 0 && l.skills) out.push({ skills: l.skills, btr: l.btRating });
  }
  return out;
}

/** Solve (A) x = b by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function fitBtrModel(samples: Sample[] = collectSamples()): BtrModel | null {
  const rows = samples.filter((s) => s.btr > 0);
  if (rows.length < MIN_SAMPLES) return null;
  const k = BTR_SKILLS.length;
  const X = rows.map((r) => [1, ...BTR_SKILLS.map((s) => Number(r.skills[s]) || 0)]);
  const y = rows.map((r) => Math.log(r.btr));
  const lambda = 0.5; // ridge: keeps coefficients sane when a skill barely varies
  const A: number[][] = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0));
  const b: number[] = new Array(k + 1).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let r = 0; r <= k; r++) {
      b[r] += X[i][r] * y[i];
      for (let c = 0; c <= k; c++) A[r][c] += X[i][r] * X[i][c];
    }
  }
  for (let d = 1; d <= k; d++) A[d][d] += lambda; // do not penalise the intercept
  const beta = solve(A, b);
  if (!beta) return null;

  const mean = y.reduce((a, v) => a + v, 0) / y.length;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < X.length; i++) {
    const pred = X[i].reduce((a, v, j) => a + v * beta[j], 0);
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - mean) ** 2;
  }
  const coef = {} as Record<BtrSkill, number>;
  BTR_SKILLS.forEach((s, i) => { coef[s] = Math.max(0, beta[i + 1]); }); // a skill can't lower BTR
  return { intercept: beta[0], coef, n: rows.length, r2: ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0 };
}

/** Expected BTR gain from raising one skill by one level, for this player. null if no usable model. */
export function btrGainForLevelUp(model: BtrModel | null, player: BattrickPlayer, skill: BtrSkill): number | null {
  if (!model || model.r2 < 0.5) return null; // a weak fit is worse than an honest "unknown"
  const b = model.coef[skill];
  if (!(b > 0)) return 0;
  return Math.round(player.btRating * (Math.exp(b) - 1));
}

const primaryWage = (n: number) => Math.pow(Math.max(0, n) - 3, 3) * (Math.max(0, n) - 1) + 250;
const secondaryWage = (n: number) => 0.05 * Math.pow(Math.max(0, n) * 0.67 - 0.33, 5);

/** Weekly wage change when a skill goes from `from` to `to` (documented community formulas). */
export function wageDeltaForPop(skill: BtrSkill, from: number, to: number): number {
  if (skill === 'batting' || skill === 'bowling' || skill === 'keeping') {
    const f = (n: number) => (n <= 3 ? 250 : primaryWage(n));
    return Math.round(f(to) - f(from));
  }
  if (skill === 'concentration' || skill === 'consistency') return Math.round(secondaryWage(to) - secondaryWage(from));
  return 0; // stamina/fielding: no documented wage formula
}

export const SKILL_NAME_TO_KEY: Record<string, BtrSkill> = {
  Batting: 'batting',
  Bowling: 'bowling',
  'Wicket Keeping': 'keeping',
  Concentration: 'concentration',
  Consistency: 'consistency',
  Fielding: 'fielding',
  'Fielding (Squad)': 'fielding',
  Stamina: 'stamina',
  'Stamina (Squad)': 'stamina',
};
