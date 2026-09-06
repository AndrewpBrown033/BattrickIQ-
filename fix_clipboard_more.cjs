const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

const toReplace = [
  ['text += `- Spin Bowling Rating: ${getBattrickRatingLabel(ratings.spinBowling).full}\\n`;', 'text += `- Spin Bowling Rating: ${getBattrickRatingLabel(ratings.spinBowling).full} (${ratings.spinBowling.toFixed(1)})\\n`;'],
  ['text += `- Wicket Keeping: ${getBattrickRatingLabel(ratings.wicketKeeping).full}\\n`;', 'text += `- Wicket Keeping: ${getBattrickRatingLabel(ratings.wicketKeeping).full} (${ratings.wicketKeeping.toFixed(1)})\\n`;\\n    text += `- Fielding: ${getBattrickRatingLabel(ratings.fielding).full} (${ratings.fielding.toFixed(1)})\\n`;\\n    text += `- Estimated Lineup BTR: ${ratings.estimatedBTR > 0 ? ratings.estimatedBTR.toLocaleString() : "N/A"}\\n`;']
];

for (const [find, replace] of toReplace) {
  content = content.replace(find, replace);
}

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
