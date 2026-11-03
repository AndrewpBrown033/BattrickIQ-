/**
 * Battrick match mechanics that Jarvis needs for lineup / bowling advice.
 *
 * SOURCE: Battrickipedia (community wiki, www.wombatnet.com/bthf and whamgip.co.uk/battrickipedia: OD / BT20 / FC
 * orders, pitch, weather, aggression, player types) plus Battrick's own Rules page snippets (individual orders).
 * Battrick's site disallows automated fetching, so the wiki is the working source. It says it is not affiliated
 * with Battrick; re-check against the game if a rule looks off.
 *
 * Everything here is FACT from those pages except where a name or comment says HEURISTIC (community rule of thumb).
 * Pure module: no DOM, no network. Tested by scripts/test-battrick-knowledge.ts.
 */

// ---------------------------------------------------------------- bowler types

export type BowlerClass = 'fast' | 'fastMedium' | 'medium' | 'spin' | 'none';

export const BOWLER_CLASS_LABEL: Record<BowlerClass, string> = {
  fast: 'Fast',
  fastMedium: 'Fast Medium',
  medium: 'Medium',
  spin: 'Spin',
  none: 'Non-bowler',
};

/**
 * Battrick has 5 bowler types: Fast, Fast Medium, Medium, Spin (wrist), Spin (finger). The app stores either a
 * word ("Fast Medium", "Spin") or a hand + code ("RFM", "LFM", "RM", "RS", "OB", "LBG"). Wrist and finger spin
 * share one column in the pitch table, so both map to 'spin'.
 */
export function classifyBowlingType(raw?: string | null): BowlerClass {
  const t = String(raw || '').trim().toLowerCase();
  if (!t || t === 'none' || t === 'n/a' || t === '-') return 'none';
  if (/spin|orthodox|break|wrist|finger|googly|chinaman/.test(t)) return 'spin';
  if (/fast[\s-]*medium|medium[\s-]*fast/.test(t)) return 'fastMedium';
  if (/\bfast\b/.test(t)) return 'fast';
  if (/\bmedium\b/.test(t)) return 'medium';
  const code = t.replace(/^[rl](?=[a-z])/, '').toUpperCase(); // drop the bowling hand: RFM -> FM
  if (code === 'FM') return 'fastMedium';
  if (code === 'F') return 'fast';
  if (code === 'M' || code === 'MF') return code === 'MF' ? 'fastMedium' : 'medium';
  if (['S', 'OB', 'LB', 'LBG', 'SLA', 'SLO', 'LS', 'RS', 'LWS', 'RWS'].includes(code) || ['OB', 'LBG', 'SLA'].includes(t.toUpperCase())) return 'spin';
  return 'none';
}

// ---------------------------------------------------------------- pitch & weather

export type PitchKey = 'uneven' | 'cracked' | 'hardAndFast' | 'green' | 'flat' | 'slow' | 'dusty';

/** Rough guide from Battrickipedia: modifier to each player type on that pitch (+ helps, - hurts). */
export const PITCH_EFFECTS: Record<PitchKey, { label: string; batting: number; fast: number; fastMedium: number; medium: number; spin: number }> = {
  uneven:      { label: 'Uneven',       batting: -1, fast: 1,  fastMedium: 2,  medium: 1,  spin: 0 },
  cracked:     { label: 'Cracked',      batting: 0,  fast: 2,  fastMedium: 1,  medium: 1,  spin: 1 },
  hardAndFast: { label: 'Hard & Fast',  batting: 2,  fast: -1, fastMedium: -1, medium: -2, spin: -1 },
  green:       { label: 'Green',        batting: 0,  fast: 0,  fastMedium: 1,  medium: 2,  spin: 0 },
  flat:        { label: 'Flat',         batting: 2,  fast: -2, fastMedium: -2, medium: -1, spin: -2 },
  slow:        { label: 'Slow',         batting: -1, fast: -2, fastMedium: 0,  medium: 2,  spin: 1 },
  dusty:       { label: 'Dusty',        batting: 1,  fast: 1,  fastMedium: 0,  medium: 1,  spin: 2 },
};

export function normalizePitch(raw?: string | null): PitchKey | null {
  const t = String(raw || '').toLowerCase();
  if (/hard/.test(t)) return 'hardAndFast';
  for (const k of ['uneven', 'cracked', 'green', 'flat', 'slow', 'dusty'] as PitchKey[]) {
    if (t.includes(k)) return k;
  }
  return null;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** One line for the briefing, e.g. "Flat pitch: batting +2, fast -2, fast medium -2, medium -1, spin -2". */
export function pitchEffectLine(raw?: string | null): string {
  const k = normalizePitch(raw);
  if (!k) return '';
  const e = PITCH_EFFECTS[k];
  return `${e.label} pitch effect (+ helps, - hurts): batting ${signed(e.batting)}, fast ${signed(e.fast)}, fast medium ${signed(e.fastMedium)}, medium ${signed(e.medium)}, spin ${signed(e.spin)}`;
}

/** Weather notes from Battrickipedia. There is no rain in Battrick. */
export function weatherEffectLine(raw?: string | null): string {
  const t = String(raw || '').toLowerCase();
  if (!t) return '';
  if (/humid/.test(t)) return 'Weather (partially cloudy & humid): helps all bowlers, harder to score runs';
  if (/wind/.test(t)) return 'Weather (partially cloudy & windy): helps spinners and medium bowlers';
  if (/partial/.test(t) || /cloud/.test(t)) return 'Weather (partially cloudy): helps spinners and medium bowlers';
  if (/overcast|cold/.test(t)) return 'Weather (overcast & cold): not a bad batting pitch';
  if (/sun/.test(t)) return 'Weather (sunny): good for fast bowlers and spinners, good for making runs';
  return '';
}

// ---------------------------------------------------------------- aggression

export const AGGRESSION_LEVELS = ['defensive', 'cautious', 'steady', 'attacking', 'destructive'] as const;
export type AggressionLevel = (typeof AGGRESSION_LEVELS)[number];

/** 0 (defensive) .. 4 (destructive), or -1 if unknown. Used for both batters and bowlers. */
export function aggressionLevel(raw?: string | null): number {
  const t = String(raw || '').toLowerCase();
  for (let i = AGGRESSION_LEVELS.length - 1; i >= 0; i--) if (t.includes(AGGRESSION_LEVELS[i])) return i;
  if (/aggressive/.test(t)) return 3;
  return -1;
}

export function aggressionLabel(raw?: string | null): string {
  const i = aggressionLevel(raw);
  return i < 0 ? 'unknown' : AGGRESSION_LEVELS[i];
}

// ---------------------------------------------------------------- bowling-order presets

export interface BowlingPreset {
  name: string;
  /** 'windows': each entry is the over ranges the bowler works within (he shares them with others).
   *  'exact': each entry is exactly the overs he bowls. */
  kind: 'windows' | 'exact';
  bowlers: [string, string, string, string, string];
}

/** One Day (50 overs, 5 bowlers, max 10 overs each, never two consecutive overs). From the OD orders drop-list. */
export const OD_BOWLING_PRESETS: BowlingPreset[] = [
  { name: 'Default orders', kind: 'windows', bowlers: ['1-13, 45-50', '1-10, 42-50', '12-20, 32-40', '15-35', '22-30, 35-40'] },
  { name: 'Openers through', kind: 'windows', bowlers: ['1-20', '1-20', '21-25, 35-45, 50', '21-35, 44-48', '27-33, 36-42, 47-49'] },
  { name: 'B1 through', kind: 'windows', bowlers: ['1-20', '1-10, 41-50', '11-20, 31-40', '21-33, 46-50', '21-30, 35-40, 42-44'] },
  { name: 'B2 through', kind: 'windows', bowlers: ['1-10, 31-40', '1-20', '21-30, 41-50', '11-20, 31-40', '21-30, 41-50'] },
  { name: 'B4 & 5 finish', kind: 'windows', bowlers: ['1-14, 35-40', '1-14, 35-40', '15-35', '15-25, 41-50', '25-35, 41-50'] },
  { name: 'Sets of 5', kind: 'windows', bowlers: ['1-10, 41-50', '1-10, 21-30', '11-20, 31-40', '11-20, 31-40', '21-30, 41-50'] },
  { name: 'Bowler 1 & 2 Start & Finish', kind: 'exact', bowlers: [
    '1,3,5,7,9,41,43,45,47,49', '2,4,6,8,10,42,44,46,48,50', '11,13,15,17,19,32,34,36,38,40',
    '12,14,16,18,20,22,24,26,28,30', '21,23,25,27,29,31,33,35,37,39'] },
  { name: 'Bowler 4 Finish', kind: 'exact', bowlers: [
    '1,3,5,18,20,22,24,26,28,30', '2,4,6,8,10,41,43,45,47,49', '7,9,12,14,16,21,23,25,27,29',
    '32,34,36,38,40,42,44,46,48,50', '11,13,15,17,19,31,33,35,37,39'] },
  { name: 'Bowler 5 Finish', kind: 'exact', bowlers: [
    '1,3,5,7,9,21,23,25,27,29', '2,4,6,8,10,22,24,26,28,30', '11,13,15,17,19,42,44,46,48,50',
    '12,14,16,18,20,32,34,36,38,40', '31,33,35,37,39,41,43,45,47,49'] },
  { name: 'Rotation', kind: 'exact', bowlers: [
    '1,6,11,16,21,26,31,36,41,46', '2,7,12,17,22,27,32,37,42,47', '3,8,13,18,23,28,33,38,43,48',
    '4,9,14,19,24,29,34,39,44,49', '5,10,15,20,25,30,35,40,45,50'] },
  { name: 'Sets of 4 and 6', kind: 'exact', bowlers: [
    '1,3,5,7,9,11,25,27,29,31', '2,4,6,8,40,42,44,46,48,50', '10,12,14,16,26,28,30,32,34,36',
    '13,15,17,19,21,23,33,35,37,39', '18,20,22,24,38,41,43,45,47,49'] },
  { name: 'Bowler 5 Middle Spell', kind: 'exact', bowlers: [
    '1,3,5,7,17,19,37,39,47,49', '2,4,6,8,21,23,38,40,48,50', '9,11,13,15,25,27,29,41,43,45',
    '10,12,14,16,31,33,35,42,44,46', '18,20,22,24,26,28,30,32,34,36'] },
  { name: 'Short Spells', kind: 'exact', bowlers: [
    '1,3,5,14,16,18,20,35,37,39', '2,4,6,19,21,23,25,38,40,42', '7,9,11,22,24,26,28,41,43,45',
    '8,10,12,27,29,31,33,44,47,49', '13,15,17,30,32,34,36,46,48,50'] },
  { name: 'Short Spells 2', kind: 'exact', bowlers: [
    '1,3,5,7,18,20,22,33,35,37', '2,4,6,8,21,23,25,39,41,43', '9,11,13,24,26,28,30,40,42,44',
    '10,12,14,16,27,29,31,45,47,49', '15,17,19,32,34,36,38,46,48,50'] },
];

/** BT20 (20 overs, 5 bowlers, max 4 overs each, 6 fielding-restriction overs at the start) has ONE preset. */
export const BT20_DEFAULT_ORDER: string[] = ['1,3,17,19', '2,4,6,20', '5,7,12,14', '8,10,16,18', '9,11,13,15'];

/** "1-13, 45-50" -> [1..13, 45..50]; "1,3,5" -> [1,3,5]. */
export function parseOvers(spec: string): number[] {
  const out: number[] = [];
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) for (let o = Number(m[1]); o <= Number(m[2]); o++) out.push(o);
    else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return out;
}

/** Analysis buckets (OURS, not Battrick rules): opening overs 1-10, middle 11-40, death 41-50. */
export type Phase = 'opening' | 'middle' | 'death';
export const phaseOfOver = (o: number): Phase => (o <= 10 ? 'opening' : o <= 40 ? 'middle' : 'death');

export interface SlotProfile {
  slot: number; // 1-5
  spec: string;
  phases: Phase[]; // phases in which this slot bowls (windows: phases the window reaches)
}

export function presetProfile(p: BowlingPreset): SlotProfile[] {
  return p.bowlers.map((spec, i) => {
    const set = new Set(parseOvers(spec).map(phaseOfOver));
    return { slot: i + 1, spec, phases: (['opening', 'middle', 'death'] as Phase[]).filter((x) => set.has(x)) };
  });
}

/** Compact catalogue for the briefing: one line per preset, with the phases each bowler slot reaches. */
export function presetCatalogueText(): string {
  return OD_BOWLING_PRESETS.map((p) => {
    const slots = presetProfile(p)
      .map((s) => `B${s.slot} ${s.phases.map((x) => x[0].toUpperCase()).join('')}`)
      .join(', ');
    return `- ${p.name} [${p.kind === 'exact' ? 'exact overs' : 'over windows'}]: ${slots}`;
  }).join('\n') + '\n(O = opening overs 1-10, M = middle 11-40, D = death 41-50. B1..B5 are the bowlers in the order you list them.)';
}

// ---------------------------------------------------------------- briefing text

export type FormatKey = 'One Day' | 'Twenty20' | 'First Class' | string;

/** Conditions + format rules block that goes into every lineup briefing. */
export function buildConditionsBlock(opts: { format?: FormatKey; pitch?: string | null; weather?: string | null }): string {
  const lines: string[] = [];
  const pitch = pitchEffectLine(opts.pitch);
  const weather = weatherEffectLine(opts.weather);
  if (pitch) lines.push(pitch);
  if (weather) lines.push(weather);
  const f = String(opts.format || '').toLowerCase();
  if (/first|fc/.test(f)) {
    lines.push('Format rules (First Class): at least 4 bowlers, no cap on overs per bowler; set a bowler priority order, min/max spell length (max 25) and a max runs-per-over cut-off per bowler; the pitch deteriorates away from green during the match.');
  } else if (/20|t20|bt20/.test(f)) {
    lines.push('Format rules (BT20): 5 bowlers (not the keeper), max 4 overs each, 6 fielding-restriction overs at the start of each innings, ONE fixed bowling order (B1: overs 1,3,17,19; B2: 2,4,6,20; B3: 5,7,12,14; B4: 8,10,16,18; B5: 9,11,13,15).');
  } else {
    lines.push('Format rules (One Day, 50 overs): 5 bowlers (not the keeper), max 10 overs each, no bowler bowls consecutive overs. Pick ONE of these bowling-order presets (it fixes when B1..B5 bowl):\n' + presetCatalogueText());
  }
  return lines.join('\n');
}

/** "Bats: attacking | Bowls: Fast Medium (RFM), bowling style attacking" for a squad / opponent line. */
export function describeStyles(p: { battingStyle?: string; bowlingType?: string; bowlingAggression?: string; skills?: { bowling?: number } }): string {
  const bat = aggressionLabel(p.battingStyle);
  const cls = classifyBowlingType(p.bowlingType);
  const parts = [`Bats: ${bat}`];
  if (cls !== 'none') {
    const agg = aggressionLabel(p.bowlingAggression);
    parts.push(`Bowls: ${BOWLER_CLASS_LABEL[cls]}${agg !== 'unknown' ? `, bowling style ${agg}` : ''}`);
  }
  return parts.join(' | ');
}

/** System-prompt section: mechanics Jarvis must respect. Kept short; the per-match numbers come in the briefing. */
export const BATTRICK_MECHANICS_PROMPT = `BATTRICK MECHANICS (facts from Battrickipedia; never contradict them)
- Bowler types: Fast, Fast Medium, Medium, Spin (wrist or finger). Pitch and weather help or hurt each type; the briefing gives the numbers for this game. Prefer a balanced attack: at least one type the pitch favours, and do not stack bowlers the pitch hurts unless there is no alternative.
- Aggression has two layers. (1) Natural level on each player: defensive, cautious, steady, attacking, destructive. (2) Your individual match order per player: A (attacking), N (normal) or D (defensive), which tempers the natural level. Players mostly follow the order but may deviate, more so when experienced. A defensive-natured player on D can still bat aggressively.
- Batters: more aggressive = faster runs but more likely to get out. Bowlers: more aggressive = more wickets but more runs conceded; defensive bowlers keep it tight with run-saving fields and take fewer wickets; attacking bowlers get catching fields.
- Batting order is fixed before the match; best batters usually bat higher, bowlers lower. The keeper cannot be one of the 5 bowlers.
- A bowling-order preset fixes when B1..B5 bowl. "Over windows" presets give each bowler a range of overs he works inside; "exact overs" presets list every over. B1 and B2 are the bowlers you name first and second, so name your best new-ball and death bowlers in the slots the preset gives opening and death overs.
- Community rule of thumb (not a game rule, say so if you use it): match a player's order to his nature (attacking natures on A, defensive on D/N), and do not put all five bowlers on A or all five on D.`;
