const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

// The matching needs to be more exact, so let's just do it by lines array.
let lines = content.split('\n');
lines[687] = '                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] rounded font-mono uppercase font-bold">';
lines[688] = '                              Keeper';
lines[689] = '                            </span>';
lines[695] = '                        <span>';
lines[696] = '                          {player.bowlingType !== \'None\' ? `${player.bowlingType} Bowler` : \'No Bowling\'}';
lines[697] = '                        </span>';

fs.writeFileSync('src/components/LineupOptimizer.tsx', lines.join('\n'));
