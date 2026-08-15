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

export type PitchType = 'Flat' | 'Hard' | 'Green' | 'Dusty' | 'Cracked' | 'Uneven';
export type WeatherType = 'Sunny' | 'Cloudy' | 'Windy' | 'Overcast';
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
