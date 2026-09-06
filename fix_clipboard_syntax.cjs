const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

// Use proper multiline replacement instead of raw \n text which caused a syntax error
content = content.replace(
  '\\n\`;\\n    text += `- Fielding: ${getBattrickRatingLabel(ratings.fielding).full} (${ratings.fielding.toFixed(1)})\\n\`;\\n    text += `- Estimated Lineup BTR: ${ratings.estimatedBTR > 0 ? ratings.estimatedBTR.toLocaleString() : "N/A"}\\n\`;',
  '\\n\`;\n    text += `- Fielding: ${getBattrickRatingLabel(ratings.fielding).full} (${ratings.fielding.toFixed(1)})\\n\`;\n    text += `- Estimated Lineup BTR: ${ratings.estimatedBTR > 0 ? ratings.estimatedBTR.toLocaleString() : "N/A"}\\n\`;'
);

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
