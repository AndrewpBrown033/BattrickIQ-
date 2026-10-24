/**
 * Patch src/parser.ts so secondary skill weeks use helpfile tables
 * from src/utils/secondarySkills.ts (not the old inverted age formula).
 * Runs before vite build / dev.
 *
 * Important: never insert inside a multi-line `import { ... } from '...'`.
 */
const fs = require('fs');
const path = require('path');

const parserPath = path.join(__dirname, '..', 'src', 'parser.ts');
let t = fs.readFileSync(parserPath, 'utf8');

const IMPORT_MARKER = "from './utils/secondarySkills'";
const importLine =
  "import { weeksToSecondaryPop, estimateSecondarySkillWeeks as estimateSecondarySkillWeeksFromTable, SECONDARY_TRAINING_SYNERGY as SECONDARY_TRAINING_SYNERGY_TABLE } from './utils/secondarySkills';";

function findEndOfImportBlock(src) {
  // Walk line-by-line; track brace depth inside import statements.
  const lines = src.split('\n');
  let lastCompleteImportLine = -1;
  let inImport = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inImport) {
      if (trimmed.startsWith('import ')) {
        inImport = true;
        braceDepth = 0;
        for (const ch of line) {
          if (ch === '{') braceDepth++;
          if (ch === '}') braceDepth--;
        }
        // Single-line import ends when we see from '...' and braceDepth is 0
        if (braceDepth <= 0 && /\bfrom\s+['"]/.test(line)) {
          lastCompleteImportLine = i;
          inImport = false;
        }
      } else if (
        trimmed === '' ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        // allow comments / blanks between imports
        continue;
      } else {
        // first non-import code
        break;
      }
    } else {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0 && /\bfrom\s+['"]/.test(line)) {
        lastCompleteImportLine = i;
        inImport = false;
      }
    }
  }
  return lastCompleteImportLine;
}

if (!t.includes(IMPORT_MARKER)) {
  const lines = t.split('\n');
  const insertAfter = findEndOfImportBlock(t);
  if (insertAfter < 0) {
    lines.unshift(importLine);
    console.log('[patch-secondary] prepended secondarySkills import');
  } else {
    lines.splice(insertAfter + 1, 0, importLine);
    console.log('[patch-secondary] inserted secondarySkills import after line', insertAfter + 1);
  }
  t = lines.join('\n');
} else {
  console.log('[patch-secondary] secondarySkills import already present');
}

const oldFn = `export const SECONDARY_TRAINING_SYNERGY = 0.25;

export function estimateSecondarySkillWeeks(
  primaryLevel: number,
  secondaryLevel: number,
  playerAge: number,
  primaryNets: number,
  coachLevel: number,
  primary: 'batting' | 'bowling'
): number {
  if (secondaryLevel >= 20 || primaryNets <= 0) return primaryNets <= 0 ? Infinity : 0;
  const primaryWeeks = estimateWeeksToNextLevel(primaryLevel, playerAge, primaryNets, coachLevel, primary);
  if (!(primaryWeeks > 0) || primaryWeeks === Infinity) return Infinity;
  return parseFloat((primaryWeeks / SECONDARY_TRAINING_SYNERGY).toFixed(1));
}`;

const newFn = `/** Re-export — real tables live in utils/secondarySkills.ts */
export const SECONDARY_TRAINING_SYNERGY = SECONDARY_TRAINING_SYNERGY_TABLE;

export function estimateSecondarySkillWeeks(
  primaryLevel: number,
  secondaryLevel: number,
  playerAge: number,
  primaryNets: number,
  coachLevel: number,
  primary: 'batting' | 'bowling',
  extra?: { batting?: number; bowling?: number; keeping?: number; fielding?: number }
): number {
  return estimateSecondarySkillWeeksFromTable(
    primaryLevel,
    secondaryLevel,
    playerAge,
    primaryNets,
    coachLevel,
    primary,
    extra
  );
}`;

if (t.includes(oldFn)) {
  t = t.replace(oldFn, newFn);
  console.log('[patch-secondary] patched estimateSecondarySkillWeeks');
} else if (t.includes('estimateSecondarySkillWeeksFromTable')) {
  console.log('[patch-secondary] estimateSecondarySkillWeeks already patched');
} else {
  console.warn('[patch-secondary] WARNING: could not find estimateSecondarySkillWeeks block');
}

const oldBranch = `  // 3. Secondary Skills (Concentration trained by Batting nets, Consistency trained by Bowling nets):
  // Secondary skills train at ~38% of the primary skill rate (~2.6x to 3x longer per pop)
  if (skillType === 'concentration' || skillType === 'consistency') {
    if (netsCount <= 0) return Infinity;
    const effectiveNets = Math.max(1, netsCount);
    let effectiveNetStrength = 1.0;
    if (effectiveNets === 2) effectiveNetStrength = 1.5;
    else if (effectiveNets >= 3) effectiveNetStrength = 1.75;

    const ageFactor = Math.pow(1.22, Math.max(0, playerAge - 17));
    const coachFactor = 1.0 / (0.6 + (coachLevel * 0.044));
    const skillFactor = 4.0 + (currentSkillLevel * 0.14);
    const totalWeeks = ((skillFactor * ageFactor * coachFactor) / effectiveNetStrength) / 0.38;

    return parseFloat(totalWeeks.toFixed(1));
  }`;

const newBranch = `  // 3. Secondary skills — Battrick helpfile tables (older = faster; distinct net types stack)
  if (skillType === 'concentration' || skillType === 'consistency') {
    return weeksToSecondaryPop(
      skillType,
      currentSkillLevel,
      playerAge,
      {
        batting: skillType === 'concentration' ? netsCount : 0,
        bowling: skillType === 'consistency' ? netsCount : 0,
      }
    );
  }`;

if (t.includes(oldBranch)) {
  t = t.replace(oldBranch, newBranch);
  console.log('[patch-secondary] patched estimateWeeksToNextLevel secondary branch');
} else if (t.includes('weeksToSecondaryPop(') && t.includes("skillType === 'concentration'")) {
  console.log('[patch-secondary] secondary branch already patched');
} else {
  console.warn('[patch-secondary] WARNING: could not find secondary branch in estimateWeeksToNextLevel');
}

fs.writeFileSync(parserPath, t);
console.log('[patch-secondary] wrote', parserPath);
