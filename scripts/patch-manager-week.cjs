/** Insert This week's updates card on Manager home. */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'ManagerDesk.tsx');
let t = fs.readFileSync(file, 'utf8');

if (t.includes('ThisWeekUpdatesCard')) {
  console.log('[patch-manager-week] already present');
  process.exit(0);
}

if (!t.includes("from './TransferMonitorCard'")) {
  console.warn('[patch-manager-week] TransferMonitorCard import missing');
  process.exit(0);
}

t = t.replace(
  "import TransferMonitorCard from './TransferMonitorCard';",
  "import TransferMonitorCard from './TransferMonitorCard';\nimport ThisWeekUpdatesCard from './ThisWeekUpdatesCard';"
);

if (!t.includes('<TransferMonitorCard setActiveTab={setActiveTab} />')) {
  console.warn('[patch-manager-week] TransferMonitorCard JSX missing');
  process.exit(1);
}

t = t.replace(
  '<TransferMonitorCard setActiveTab={setActiveTab} />',
  '<ThisWeekUpdatesCard setActiveTab={setActiveTab} />\n\n      <TransferMonitorCard setActiveTab={setActiveTab} />'
);

fs.writeFileSync(file, t);
console.log('[patch-manager-week] injected ThisWeekUpdatesCard');
