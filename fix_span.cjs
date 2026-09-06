const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

// Replace standard ({value}) with styled span inside the JSX elements, being careful not to touch the clipboard string!
content = content.replace(/\{getBattrickRatingLabel\(ratings\.topOrder\)\.full\}  \(\{ratings\.topOrder\.toFixed\(1\)\}\)/g, '{getBattrickRatingLabel(ratings.topOrder).full} <span className="text-[10px] opacity-75">({ratings.topOrder.toFixed(1)})</span>');
content = content.replace(/\{getBattrickRatingLabel\(ratings\.middleOrder\)\.full\}  \(\{ratings\.middleOrder\.toFixed\(1\)\}\)/g, '{getBattrickRatingLabel(ratings.middleOrder).full} <span className="text-[10px] opacity-75">({ratings.middleOrder.toFixed(1)})</span>');
content = content.replace(/\{getBattrickRatingLabel\(ratings\.lowerOrder\)\.full\}  \(\{ratings\.lowerOrder\.toFixed\(1\)\}\)/g, '{getBattrickRatingLabel(ratings.lowerOrder).full} <span className="text-[10px] opacity-75">({ratings.lowerOrder.toFixed(1)})</span>');
content = content.replace(/\{getBattrickRatingLabel\(ratings\.seamBowling\)\.full\}  \(\{ratings\.seamBowling\.toFixed\(1\)\}\)/g, '{getBattrickRatingLabel(ratings.seamBowling).full} <span className="text-[10px] opacity-75">({ratings.seamBowling.toFixed(1)})</span>');
content = content.replace(/\{getBattrickRatingLabel\(ratings\.spinBowling\)\.full\}  \(\{ratings\.spinBowling\.toFixed\(1\)\}\)/g, '{getBattrickRatingLabel(ratings.spinBowling).full} <span className="text-[10px] opacity-75">({ratings.spinBowling.toFixed(1)})</span>');
content = content.replace(/\{getBattrickRatingLabel\(ratings\.wicketKeeping\)\.full\}  \(\{ratings\.wicketKeeping\.toFixed\(1\)\}\)/g, '{getBattrickRatingLabel(ratings.wicketKeeping).full} <span className="text-[10px] opacity-75">({ratings.wicketKeeping.toFixed(1)})</span>');
content = content.replace(/\{getBattrickRatingLabel\(ratings\.fielding\)\.full\}  \(\{ratings\.fielding\.toFixed\(1\)\}\)/g, '{getBattrickRatingLabel(ratings.fielding).full} <span className="text-[10px] opacity-75">({ratings.fielding.toFixed(1)})</span>');

// Clean up the clipboard string replacements that got the span added back
content = content.replace(/\`\- Top Order Batting: \$\{getBattrickRatingLabel\(ratings\.topOrder\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.topOrder\.toFixed\(1\)\})\)<\/span>\\n\`/g, '\`- Top Order Batting: ${getBattrickRatingLabel(ratings.topOrder).full} (${ratings.topOrder.toFixed(1)})\\n\`');
content = content.replace(/\`\- Middle Order Batting: \$\{getBattrickRatingLabel\(ratings\.middleOrder\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.middleOrder\.toFixed\(1\)\})\)<\/span>\\n\`/g, '\`- Middle Order Batting: ${getBattrickRatingLabel(ratings.middleOrder).full} (${ratings.middleOrder.toFixed(1)})\\n\`');
content = content.replace(/\`\- Seam Bowling Rating: \$\{getBattrickRatingLabel\(ratings\.seamBowling\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.seamBowling\.toFixed\(1\)\})\)<\/span>\\n\`/g, '\`- Seam Bowling Rating: ${getBattrickRatingLabel(ratings.seamBowling).full} (${ratings.seamBowling.toFixed(1)})\\n\`');
content = content.replace(/\`\- Spin Bowling Rating: \$\{getBattrickRatingLabel\(ratings\.spinBowling\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.spinBowling\.toFixed\(1\)\})\)<\/span>\\n\`/g, '\`- Spin Bowling Rating: ${getBattrickRatingLabel(ratings.spinBowling).full} (${ratings.spinBowling.toFixed(1)})\\n\`');
content = content.replace(/\`\- Wicket Keeping: \$\{getBattrickRatingLabel\(ratings\.wicketKeeping\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.wicketKeeping\.toFixed\(1\)\})\)<\/span>\\n\`/g, '\`- Wicket Keeping: ${getBattrickRatingLabel(ratings.wicketKeeping).full} (${ratings.wicketKeeping.toFixed(1)})\\n\`');

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
