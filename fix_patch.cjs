const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

// Revert the clipboard function replacements
content = content.replace(
  /\`\- Top Order Batting: \$\{getBattrickRatingLabel\(ratings\.topOrder\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.topOrder\.toFixed\(1\)\})\)<\/span>\\n\`/g,
  '\`- Top Order Batting: ${getBattrickRatingLabel(ratings.topOrder).full} (${ratings.topOrder.toFixed(1)})\\n\`'
);
content = content.replace(
  /\`\- Middle Order Batting: \$\{getBattrickRatingLabel\(ratings\.middleOrder\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.middleOrder\.toFixed\(1\)\})\)<\/span>\\n\`/g,
  '\`- Middle Order Batting: ${getBattrickRatingLabel(ratings.middleOrder).full} (${ratings.middleOrder.toFixed(1)})\\n\`'
);
content = content.replace(
  /\`\- Seam Bowling Rating: \$\{getBattrickRatingLabel\(ratings\.seamBowling\)\.full\} <span className="text-\[10px\] opacity-75">\((\$\{ratings\.seamBowling\.toFixed\(1\)\})\)<\/span>\\n\`/g,
  '\`- Seam Bowling Rating: ${getBattrickRatingLabel(ratings.seamBowling).full} (${ratings.seamBowling.toFixed(1)})\\n\`'
);


// Now replace the JSX elements explicitly
content = content.replace(
  /\{getBattrickRatingLabel\(ratings\.topOrder\)\.full\}\n              <\/div>/g,
  '{getBattrickRatingLabel(ratings.topOrder).full} <span className="text-[10px] opacity-75">({ratings.topOrder.toFixed(1)})</span>\n              </div>'
);
content = content.replace(
  /\{getBattrickRatingLabel\(ratings\.middleOrder\)\.full\}\n              <\/div>/g,
  '{getBattrickRatingLabel(ratings.middleOrder).full} <span className="text-[10px] opacity-75">({ratings.middleOrder.toFixed(1)})</span>\n              </div>'
);
content = content.replace(
  /\{getBattrickRatingLabel\(ratings\.lowerOrder\)\.full\}\n              <\/div>/g,
  '{getBattrickRatingLabel(ratings.lowerOrder).full} <span className="text-[10px] opacity-75">({ratings.lowerOrder.toFixed(1)})</span>\n              </div>'
);
content = content.replace(
  /\{getBattrickRatingLabel\(ratings\.seamBowling\)\.full\}\n              <\/div>/g,
  '{getBattrickRatingLabel(ratings.seamBowling).full} <span className="text-[10px] opacity-75">({ratings.seamBowling.toFixed(1)})</span>\n              </div>'
);

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
