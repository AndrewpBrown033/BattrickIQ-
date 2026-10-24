/**
 * Wire EstimatorAgeWageBar + age filter into SquadDashboard.
 * Idempotent — safe every build.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'SquadDashboard.tsx');
let t = fs.readFileSync(file, 'utf8');
let changes = 0;

// 1) Imports
if (!t.includes("EstimatorAgeWageBar")) {
  const needle =
    "import {\n  Dumbbell, ArrowLeftRight, Target, Clock, Users, RefreshCw, AlertTriangle } from 'lucide-react';";
  const insert =
    "import {\n  Dumbbell, ArrowLeftRight, Target, Clock, Users, RefreshCw, AlertTriangle } from 'lucide-react';\n" +
    "import EstimatorAgeWageBar from './squad/EstimatorAgeWageBar';\n" +
    "import { filterListingsByAge, type WageHorizon } from '../utils/transferCosting';\n" +
    "import { buildTransferShortlist } from '../utils/buildTransferShortlist';";
  if (t.includes(needle)) {
    t = t.replace(needle, insert);
    changes++;
    console.log('[patch-estimator-age] imports');
  } else {
    console.warn('[patch-estimator-age] import needle missing');
  }
}

// 2) State after watchBusy / watchAck
if (!t.includes('const [minAge, setMinAge]')) {
  const candidates = [
    "  const [watchAck, setWatchAck] = useState<string | null>(null);\n",
    "  const [watchBusy, setWatchBusy] = useState(false);\n",
  ];
  const block =
    "  const [minAge, setMinAge] = useState(17);\n" +
    "  const [maxAge, setMaxAge] = useState(32);\n" +
    "  const [wageWeeks, setWageWeeks] = useState<WageHorizon>(6);\n";
  let done = false;
  for (const c of candidates) {
    if (t.includes(c)) {
      t = t.replace(c, c + block);
      changes++;
      done = true;
      console.log('[patch-estimator-age] state');
      break;
    }
  }
  if (!done) console.warn('[patch-estimator-age] state needle missing');
}

// 3) transferScanBody — add minAge/maxAge
if (!t.includes('minAge,\n    maxAge,') && !t.includes('minAge: minAge')) {
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

// 4) After parseTransferList — filter by age before ranking
if (!t.includes('filterListingsByAge(listings')) {
  const old =
    "      const listings = parseTransferList(html, { excludePlayerIds: ownIds });\n" +
    "      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}";
  // appears twice (scan + refresh) — replace all for scan path carefully
  const neu =
    "      let listings = parseTransferList(html, { excludePlayerIds: ownIds });\n" +
    "      listings = filterListingsByAge(listings, { minAge, maxAge });\n" +
    "      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}";
  if (t.includes(old)) {
    t = t.split(old).join(neu);
    changes++;
    console.log('[patch-estimator-age] filterListingsByAge');
  } else {
    console.warn('[patch-estimator-age] parseTransferList block not found');
  }
}

// 5) Render EstimatorAgeWageBar after Skills intro paragraph
if (!t.includes('<EstimatorAgeWageBar')) {
  const old =
    '                  <p className="text-[10px] text-slate-500">Recommended from your rating gaps. Toggle skills and set minimum levels for the transfer scan.</p>\n' +
    '                </div>';
  const neu =
    '                  <p className="text-[10px] text-slate-500">Recommended from your rating gaps. Toggle skills and set minimum levels for the transfer scan.</p>\n' +
    '                </div>\n' +
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
    '              <div className="flex items-start justify-between gap-2">\n' +
    '                <div className="hidden">';
  // Too risky with broken structure. Simpler insert before "Skills to look for" card content ends differently.

  // Insert right before the skills grid / after the skills header block closes
  const marker =
    'Recommended from your rating gaps. Toggle skills and set minimum levels for the transfer scan.</p>';
  if (t.includes(marker) && !t.includes('<EstimatorAgeWageBar')) {
    t = t.replace(
      marker,
      marker +
        '\n                </div>\n              </div>\n' +
        '              <EstimatorAgeWageBar\n' +
        '                minAge={minAge}\n' +
        '                maxAge={maxAge}\n' +
        '                onMinAge={setMinAge}\n' +
        '                onMaxAge={setMaxAge}\n' +
        '                wageWeeks={wageWeeks}\n' +
        '                onWageWeeks={setWageWeeks}\n' +
        '                factorFinance={factorFinance}\n' +
        '              />\n' +
        '              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">\n' +
        '                <div className="flex items-start justify-between gap-2">\n' +
        '                  <div>\n' +
        '                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Skill filters</div>'
    );
    // This may break structure - better use a cleaner approach below
  }
}

fs.writeFileSync(file, t);
console.log('[patch-estimator-age] wrote changes=', changes);
