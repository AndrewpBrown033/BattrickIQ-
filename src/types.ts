/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SkillName {
  Batting = 'Batting',
  Bowling = 'Bowling',
  Keeping = 'Keeping',
  Stamina = 'Stamina',
  Leadership = 'Leadership',
  Experience = 'Experience',
  Concentration = 'Concentration',
  Consistency = 'Consistency',
}

export const SKILL_LEVELS = [
  'useless',       // 0
  'worthless',     // 1
  'abysmal',       // 2
  'woeful',        // 3
  'feeble',        // 4
  'mediocre',      // 5
  'competent',     // 6
  'respectable',   // 7
  'proficient',    // 8
  'strong',        // 9
  'superb',        // 10
  'quality',       // 11
  'remarkable',    // 12
  'wonderful',     // 13
  'exceptional',   // 14
  'sensational',   // 15
  'exquisite',     // 16
  'masterful',     // 17
  'miraculous',    // 18
  'phenomenal',    // 19
  'elite',         // 20
];

export const STAMINA_LEVELS = [
  'useless',       // 0
  'worthless',     // 1
  'abysmal',       // 2
  'woeful',        // 3
  'feeble',        // 4
  'mediocre',      // 5
  'competent',     // 6
  'respectable',   // 7
  'proficient',    // 8
  'strong',        // 9
  'superb',        // 10
  'superb*',       // 11
];

export function getSkillLabel(skillKey: string, value: number): string {
  const normalizedKey = skillKey.trim().toLowerCase();
  if (normalizedKey === 'stamina') {
    return STAMINA_LEVELS[Math.min(value, STAMINA_LEVELS.length - 1)] || 'useless';
  }
  return SKILL_LEVELS[Math.min(value, SKILL_LEVELS.length - 1)] || 'useless';
}

export type PitchType = 'Flat' | 'Hard' | 'Green' | 'Dusty' | 'Cracked' | 'Uneven' | 'Slow';
export type WeatherType = 'Sunny' | 'Cloudy' | 'Windy' | 'Overcast' | 'Humid' | 'Partially Cloudy';
export type MatchFormat = 'First Class' | 'One Day' | 'Twenty20';

export interface BattrickPlayer {
  id: string;
  name: string;
  age: number;
  wage: number;
  btRating: number;
  bowlingType: string;
  role: 'Batter' | 'Bowler' | 'Keeper' | 'All-rounder' | 'Prospect';
  skills: {
    batting: number;
    bowling: number;
    keeping: number;
    stamina: number;
    leadership: number;
    experience: number;
    concentration: number;
    consistency: number;
    fielding: number;
  };
  form: number; // 0-10
  fitness: number; // 0-10
  nets: {
    batting: number; // count of nets
    bowling: number;
    keeping: number;
    fielding: number;
    stamina: number;
  };
  history?: {
    date?: string;
    season: number;
    week: number;
    btRating: number;
    wage: number;
    form?: number;
    fitness?: number;
    skills: {
      batting: number;
      bowling: number;
      keeping: number;
      stamina: number;
      concentration: number;
      consistency: number;
      fielding: number;
      leadership: number;
      experience: number;
    };
    note?: string;
  }[];
}

export interface StadiumConfig {
  terracing: number;
  grass: number;
  seats: number;
  boxes: number;
  capacity: number;
}

export interface BattrickGame {
  date: string;
  opponent: string;
  type: string;
  venue: 'Home' | 'Away';
  result?: string;
}

export interface PavilionInfo {
  groundName: string;
  pitchType?: string;
  weather: string;
  established: string;
  membershipStatus: string;
}

export interface ClubFinances {
  cash: number;
  members: number;
  prOfficers: number;
  finAdvisors: number;
  sponsorsIncome: number;
  gateReceipts: number;
  interestReceived: number;
  playerWages: number;
  staffWages: number;
  morale: string;
  sponsorsMood: string;
  membersConfidence?: string;
  academyCondition?: string;
  academyInvestment?: number;
  academyIts?: number;
  bowlingCoaches?: number;
  battingCoaches?: number;
  fieldingCoaches?: number;
  keepingCoaches?: number;
  staminaCoaches?: number;
  psychologists?: number;
}

export interface LineupPlayer {
  id: string;
  name: string;
  role: 'Batter' | 'Bowler' | 'Keeper' | 'All-rounder';
  batting: number;
  bowling: number;
  keeping: number;
  stamina: number;
  experience: number;
  bowlingType: string;
  order: number; // 1-11
}

export interface MatchConditions {
  pitch: PitchType;
  weather: WeatherType;
  format: MatchFormat;
}

export interface OpponentPlayer {
  id: string;
  name: string;
  age: number;
  wage: number;
  btRating: number;
  role: 'Batter' | 'Bowler' | 'Keeper' | 'All-rounder' | 'Prospect';
  bowlingType: string;
  batting: number;
  bowling: number;
  keeping: number;
  stamina: number;
  experience: number;
  concentration?: number;
  consistency?: number;
  fielding?: number;
  order?: number;
}

export interface OpponentVulnerability {
  id: string;
  severity: 'critical' | 'moderate' | 'minor' | 'strength';
  category: 'batting_tail' | 'fifth_bowler' | 'pitch_mismatch' | 'stamina_fatigue' | 'spin_weakness' | 'pace_weakness';
  title: string;
  description: string;
  tacticalAction: string;
}

export interface OpponentScoutDossier {
  clubName: string;
  scoutedDate: string;
  players: OpponentPlayer[];
  topOrderRating: number;
  middleOrderRating: number;
  tailVulnerabilityRating: number;
  paceAttackRating: number;
  spinAttackRating: number;
  overallSquadPower: number;
  vulnerabilities: OpponentVulnerability[];
  recommendedMatchIntensity: 'Take It Easy' | 'Play As Normal' | 'Go For It';
  battingAggressionAdvice: string;
  bowlingRotationAdvice: string;
  fieldingPressureAdvice: string;
}

export interface MatchSummaryRatings {
  topOrder: string;
  topOrderScore: number;
  middleOrder: string;
  middleOrderScore: number;
  lowerOrder: string;
  lowerOrderScore: number;
  seamBowling: string;
  seamBowlingScore: number;
  spinBowling: string;
  spinBowlingScore: number;
  fielding: string;
  fieldingScore: number;
  batstat: number;
}

export interface MatchBatterStat {
  order: number;
  name: string;
  id?: string;
  dismissal: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  group: 'Top Order' | 'Middle Order' | 'Lower Order';
  estimatedSkillGrade?: string;
}

export interface MatchBowlerStat {
  order: number;
  name: string;
  id?: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  bowlingType?: string;
  isSeam?: boolean;
  isSpin?: boolean;
}

export interface MatchFallOfWicket {
  wicket: number;
  score: number;
  player: string;
  over: string;
}

export interface MatchInnings {
  teamName: string;
  inningsNumber: number;
  totalRuns: number;
  wickets: number;
  overs: string;
  batters: MatchBatterStat[];
  bowlers: MatchBowlerStat[];
  fallOfWickets: MatchFallOfWicket[];
}

export interface BatstatDecomposition {
  teamName: string;
  batstatValue: number;
  topOrderRatingText: string;
  topOrderRatingValue: number;
  middleOrderRatingText: string;
  middleOrderRatingValue: number;
  lowerOrderRatingText: string;
  lowerOrderRatingValue: number;
  seamBowlingText: string;
  spinBowlingText: string;
  fieldingText: string;
  tailDropoffPercent: number; // percentage drop from top order to tail
  topOrderContributionPct: number;
  fifthBowlerConceded: number;
  fifthBowlerEcon: number;
  fifthBowlerName: string;
  keyInsights: string[];
  tacticalExploits: string[];
}

export interface ParsedBattrickMatch {
  matchId: string;
  matchUrl: string;
  summaryUrl: string;
  matchDate: string;
  matchType: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  crowd?: string;
  toss?: string;
  pitch: PitchType;
  weather: WeatherType;
  result: string;
  homeRatings?: MatchSummaryRatings;
  awayRatings?: MatchSummaryRatings;
  innings: MatchInnings[];
  batstatAnalysis?: BatstatDecomposition[];
}

export type LLMProvider = 'openrouter' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  openRouterApiKey?: string;
  geminiApiKey?: string;
}
