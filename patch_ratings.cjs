const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

content = content.replace(
  'const avgExperience = lineup.reduce((acc, curr) => acc + curr.experience, 0) / 11;',
  `const avgExperience = lineup.reduce((acc, curr) => acc + curr.experience, 0) / 11;
    const avgFielding = lineup.reduce((acc, curr) => acc + (curr.fielding || 5), 0) / 11;
    const fieldingRaw = avgFielding + (avgExperience * 0.1);
    
    const estimatedTotalBTR = lineup.reduce((acc, curr) => acc + (curr.btRating || 0), 0);`
);

content = content.replace(
  'wicketKeeping: Math.min(20, Math.max(0, keepingRaw * staminaMulti)),',
  `wicketKeeping: Math.min(20, Math.max(0, keepingRaw * staminaMulti)),
      fielding: Math.min(20, Math.max(0, fieldingRaw * staminaMulti)),
      estimatedBTR: estimatedTotalBTR,`
);

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
