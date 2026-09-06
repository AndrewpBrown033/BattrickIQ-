const fs = require('fs');
let lines = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8').split('\n');

const linesToFix = [
  614, 615, 658, 659, 681, 688, 694, 695, 696, 707, 708, 712, 713, 718, 719,
  800, 801, 817, 818, 835, 836, 853, 854, 868, 869, 1021, 1034
];

for (let i of linesToFix) {
  let idx = i - 1; // 0-indexed
  lines[idx] = lines[idx] + '</span>';
}

fs.writeFileSync('src/components/LineupOptimizer.tsx', lines.join('\n'));
