const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

const toReplace = [
  ['text += `- Top Order Batting: ${getBattrickRatingLabel(ratings.topOrder).full} <span className="text-[10px] opacity-75">({ratings.topOrder.toFixed(1)})</span>\\n`;', 'text += `- Top Order Batting: ${getBattrickRatingLabel(ratings.topOrder).full} (${ratings.topOrder.toFixed(1)})\\n`;'],
  ['text += `- Middle Order Batting: ${getBattrickRatingLabel(ratings.middleOrder).full} <span className="text-[10px] opacity-75">({ratings.middleOrder.toFixed(1)})</span>\\n`;', 'text += `- Middle Order Batting: ${getBattrickRatingLabel(ratings.middleOrder).full} (${ratings.middleOrder.toFixed(1)})\\n`;'],
  ['text += `- Seam Bowling Rating: ${getBattrickRatingLabel(ratings.seamBowling).full} <span className="text-[10px] opacity-75">({ratings.seamBowling.toFixed(1)})</span>\\n`;', 'text += `- Seam Bowling Rating: ${getBattrickRatingLabel(ratings.seamBowling).full} (${ratings.seamBowling.toFixed(1)})\\n`;'],
  ['text += `- Spin Bowling Rating: ${getBattrickRatingLabel(ratings.spinBowling).full} <span className="text-[10px] opacity-75">({ratings.spinBowling.toFixed(1)})</span>\\n`;', 'text += `- Spin Bowling Rating: ${getBattrickRatingLabel(ratings.spinBowling).full} (${ratings.spinBowling.toFixed(1)})\\n`;'],
  ['text += `- Wicket Keeping: ${getBattrickRatingLabel(ratings.wicketKeeping).full} <span className="text-[10px] opacity-75">({ratings.wicketKeeping.toFixed(1)})</span>\\n`;', 'text += `- Wicket Keeping: ${getBattrickRatingLabel(ratings.wicketKeeping).full} (${ratings.wicketKeeping.toFixed(1)})\\n`;']
];

for (const [find, replace] of toReplace) {
  content = content.replace(find, replace);
}

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
