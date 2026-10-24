/**
 * Wire age min/max (+ wage horizon) into Estimator.
 * Idempotent — safe to run every build/dev.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'SquadDashboard.tsx');
let t = fs.readFileSync(file, 'utf8');
let changes = 0;

// --- imports ---
if (!t.includes("from './squad/EstimatorAgeWageBar'")) {
  const needle =
    "import {\n  Dumbbell, ArrowLeftRight, Target, Clock, Users, RefreshCw, AlertTriangle } from 'lucide-react';";
  const insert =
    needle +
    "\nimport EstimatorAgeWageBar from './squad/EstimatorAgeWageBar';\n" +
    "import { filterListingsByAge, type WageHorizon } from '../utils/transferCosting';";
  if (t.includes(needle)) {
    t = t.replace(needle, insert);
    changes++;
    console.log('[patch-estimator-age] imports');
  } else {
    console.warn('[patch-estimator-age] import needle missing');
  }
}

// --- state ---
if (!t.includes('const [minAge, setMinAge]')) {
  const block =
    '  const [minAge, setMinAge] = useState(17);\n' +
    '  const [maxAge, setMaxAge] = useState(32);\n' +
    '  const [wageWeeks, setWageWeeks] = useState<WageHorizon>(6);\n';
  const afterWatchAck = '  const [watchAck, setWatchAck] = useState<string | null>(null);\n';
  const afterWatchBusy = '  const [watchBusy, setWatchBusy] = useState(false);\n';
  if (t.includes(afterWatchAck)) {
    t = t.replace(afterWatchAck, afterWatchAck + block);
    changes++;
    console.log('[patch-estimator-age] state after watchAck');
  } else if (t.includes(afterWatchBusy)) {
    t = t.replace(afterWatchBusy, afterWatchBusy + block);
    changes++;
    console.log('[patch-estimator-age] state after watchBusy');
  } else {
    console.warn('[patch-estimator-age] state needle missing');
  }
}

// --- scan body ---
if (!t.includes('minAge,\n    maxAge,')) {
  const old =
    "  const transferScanBody = () => ({\n" +
    "    pageName: 'transfers.asp',\n" +
    "    pageUrl: 'https://www.battrick.org/nl/transfers.asp',\n" +
    "    username,\n" +
    "    password,\n" +
    "    sessionToken: localStorage.getItem('bt_sync_session') || '',\n" +
    "    skillMins: selectedSkills.reduce((acc, sk) => {\n" +
    "      const m = skillMins[sk];\n" +
    "      if (m != null && m > 0) acc[sk] = m;\n" +
    "      return acc;\n" +
    "    }, {} as Record<string, number>),\n" +
    "  });";
  const neu =
    "  const transferScanBody = () => ({\n" +
    "    pageName: 'transfers.asp',\n" +
    "    pageUrl: 'https://www.battrick.org/nl/transfers.asp',\n" +
    "    username,\n" +
    "    password,\n" +
    "    sessionToken: localStorage.getItem('bt_sync_session') || '',\n" +
    "    minAge,\n" +
    "    maxAge,\n" +
    "    skillMins: selectedSkills.reduce((acc, sk) => {\n" +
    "      const m = skillMins[sk];\n" +
    "      if (m != null && m > 0) acc[sk] = m;\n" +
    "      return acc;\n" +
    "    }, {} as Record<string, number>),\n" +
    "  });";
  if (t.includes(old)) {
    t = t.replace(old, neu);
    changes++;
    console.log('[patch-estimator-age] scan body');
  } else {
    console.warn('[patch-estimator-age] transferScanBody not found');
  }
}

// --- filter listings ---
if (!t.includes('filterListingsByAge(listings')) {
  const old =
    "      const listings = parseTransferList(html, { excludePlayerIds: ownIds });\n" +
    "      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}";
  const neu =
    "      let listings = parseTransferList(html, { excludePlayerIds: ownIds });\n" +
    "      listings = filterListingsByAge(listings, { minAge, maxAge });\n" +
    "      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}";
  if (t.includes(old)) {
    const n = t.split(old).length - 1;
    t = t.split(old).join(neu);
    changes += n;
    console.log('[patch-estimator-age] age filter x', n);
  } else {
    console.warn('[patch-estimator-age] parseTransferList block not found');
  }
}

// --- UI bar ---
if (!t.includes('<EstimatorAgeWageBar')) {
  const old =
    '                <button type="button" className="text-[10px] font-bold text-teal-700 underline shrink-0"\n' +
    '                  onClick={() => {\n' +
    '                    const rec = skillRecs.filter((r) => r.recommended).map((r) => r.skill);\n' +
    '                    setSelectedSkills(rec.length ? rec : SEARCH_SKILLS.map((s) => s.id));\n' +
    '                    setSkillMins((prev) => {\n' +
    '                      const next = { ...prev };\n' +
    '                      for (const r of skillRecs) { if (r.recommended) next[r.skill] = r.minSkill; }\n' +
    '                      return next;\n' +
    '                    });\n' +
    '                  }}>\n' +
    '                  Reset to recommended\n' +
    '                </button>\n' +
    '              </div>\n' +
    '              <div className="flex flex-wrap gap-2">';
  const neu =
    '                <button type="button" className="text-[10px] font-bold text-teal-700 underline shrink-0"\n' +
    '                  onClick={() => {\n' +
    '                    const rec = skillRecs.filter((r) => r.recommended).map((r) => r.skill);\n' +
    '                    setSelectedSkills(rec.length ? rec : SEARCH_SKILLS.map((s) => s.id));\n' +
    '                    setSkillMins((prev) => {\n' +
    '                      const next = { ...prev };\n' +
    '                      for (const r of skillRecs) { if (r.recommended) next[r.skill] = r.minSkill; }\n' +
    '                      return next;\n' +
    '                    });\n' +
    '                  }}>\n' +
    '                  Reset to recommended\n' +
    '                </button>\n' +
    '              </div>\n' +
    '              <EstimatorAgeWageBar\n' +
    '                minAge={minAge}\n' +
    '                maxAge={maxAge}\n' +
    '                onMinAge={setMinAge}\n' +
    '                onMaxAge={setMaxAge}\n' +
    '                wageWeeks={wageWeeks}\n' +
    '                onWageWeeks={setWageWeeks}\n' +
    '                factorFinance={factorFinance}\n' +
    '              />\n' +
    '              <div className="flex flex-wrap gap-2">';
  if (t.includes(old)) {
    t = t.replace(old, neu);
    changes++;
    console.log('[patch-estimator-age] UI bar');
  } else {
    console.warn('[patch-estimator-age] skills header UI not found');
  }
}

fs.writeFileSync(file, t);
console.log('[patch-estimator-age] done changes=', changes);
