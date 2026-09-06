const fs = require('fs');
let content = fs.readFileSync('src/components/LineupOptimizer.tsx', 'utf8');

// Modify the Wicket Keeping section to add Fielding and Estimated BTR
const wicketKeepingStr = `{/* Wicket Keeping */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Wicket Keeping</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Gloves accuracy & fielding strength</div>
              </div>
              <div className={\`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase \${getBattrickRatingLabel(ratings.wicketKeeping).color}\`}>
                {getBattrickRatingLabel(ratings.wicketKeeping).full}
              </div>
            </div>`;

const newSections = `{/* Wicket Keeping */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Wicket Keeping</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Gloves accuracy & fielding strength</div>
              </div>
              <div className={\`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase \${getBattrickRatingLabel(ratings.wicketKeeping).color}\`}>
                {getBattrickRatingLabel(ratings.wicketKeeping).full} <span className="text-[10px] opacity-75">({ratings.wicketKeeping.toFixed(1)})</span>
              </div>
            </div>

            {/* Fielding */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Fielding</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Ground fielding & catching ability</div>
              </div>
              <div className={\`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase \${getBattrickRatingLabel(ratings.fielding).color}\`}>
                {getBattrickRatingLabel(ratings.fielding).full} <span className="text-[10px] opacity-75">({ratings.fielding.toFixed(1)})</span>
              </div>
            </div>

            {/* Estimated Battrick Rating (BTR) Score */}
            <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Estimated Lineup BTR</div>
                <div className="text-[11px] text-indigo-700 mt-0.5 font-medium">Total Battrick Rating score for XI</div>
              </div>
              <div className="font-mono text-sm font-bold px-3 py-1.5 bg-white text-indigo-700 rounded border border-indigo-300 shadow-sm">
                {ratings.estimatedBTR > 0 ? ratings.estimatedBTR.toLocaleString() : 'N/A'}
              </div>
            </div>`;

content = content.replace(wicketKeepingStr, newSections);

// Now let's add the (score) to the other ratings too!
content = content.replace(
  '{getBattrickRatingLabel(ratings.topOrder).full}',
  '{getBattrickRatingLabel(ratings.topOrder).full} <span className="text-[10px] opacity-75">({ratings.topOrder.toFixed(1)})</span>'
);
content = content.replace(
  '{getBattrickRatingLabel(ratings.middleOrder).full}',
  '{getBattrickRatingLabel(ratings.middleOrder).full} <span className="text-[10px] opacity-75">({ratings.middleOrder.toFixed(1)})</span>'
);
content = content.replace(
  '{getBattrickRatingLabel(ratings.lowerOrder).full}',
  '{getBattrickRatingLabel(ratings.lowerOrder).full} <span className="text-[10px] opacity-75">({ratings.lowerOrder.toFixed(1)})</span>'
);
content = content.replace(
  '{getBattrickRatingLabel(ratings.seamBowling).full}',
  '{getBattrickRatingLabel(ratings.seamBowling).full} <span className="text-[10px] opacity-75">({ratings.seamBowling.toFixed(1)})</span>'
);
content = content.replace(
  '{ratings.spinBowling > 0 ? getBattrickRatingLabel(ratings.spinBowling).full : \'none\'}',
  '{ratings.spinBowling > 0 ? <>{getBattrickRatingLabel(ratings.spinBowling).full} <span className="text-[10px] opacity-75">({ratings.spinBowling.toFixed(1)})</span></> : \'none\'}'
);

fs.writeFileSync('src/components/LineupOptimizer.tsx', content);
