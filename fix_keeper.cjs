const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

content = content.replace(
  '<span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] rounded font-mono uppercase font-bold"></span>\n                              Keeper\n                            \n                          )}',
  '<span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] rounded font-mono uppercase font-bold">\n                              Keeper\n                            </span>\n                          )}'
);

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
