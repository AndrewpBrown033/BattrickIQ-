/**
 * Build-time patch: Estimator "Watch" button shows acknowledgement.
 * Idempotent — safe to run every build.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'SquadDashboard.tsx');
let t = fs.readFileSync(file, 'utf8');
let changes = 0;

if (!t.includes('const [watchAck, setWatchAck]')) {
  const needle = '  const [watchBusy, setWatchBusy] = useState(false);\n';
  if (t.includes(needle)) {
    t = t.replace(
      needle,
      "  const [watchBusy, setWatchBusy] = useState(false);\n  const [watchAck, setWatchAck] = useState<string | null>(null);\n"
    );
    changes++;
    console.log('[patch-watch-ack] added watchAck state');
  } else {
    console.warn('[patch-watch-ack] watchBusy state not found');
  }
}

const oldBtn = `                    <button type="button" className="text-[10px] font-bold text-indigo-700 underline"
                      onClick={() => { try { addRecommendationToWatchlist(r); setWatchlist(loadWatchlist()); } catch {} }}>
                      Watch
                    </button>`;

const newBtn = `                    {(() => {
                      const pid = String(r.listing?.playerId || '');
                      const pname = r.listing?.name || 'player';
                      const isWatched = !!pid && watchlist.some((w) => w.playerId === pid);
                      return (
                        <button
                          type="button"
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isWatched
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          }`}
                          onClick={() => {
                            try {
                              addRecommendationToWatchlist(r);
                              setWatchlist(loadWatchlist());
                              setWatchAck(`✓ Watching ${pname} — open the Watch tab to set a max bid`);
                              window.setTimeout(() => setWatchAck(null), 5000);
                            } catch (e: any) {
                              setWatchAck(e?.message || 'Could not add to watch');
                              window.setTimeout(() => setWatchAck(null), 5000);
                            }
                          }}
                        >
                          {isWatched ? '✓ Watching' : '+ Watch'}
                        </button>
                      );
                    })()}`;

if (t.includes(oldBtn)) {
  t = t.replace(oldBtn, newBtn);
  changes++;
  console.log('[patch-watch-ack] replaced Watch button');
} else if (t.includes('✓ Watching')) {
  console.log('[patch-watch-ack] Watch button already patched');
} else {
  console.warn('[patch-watch-ack] original Watch button not found');
}

const oldBanner = `            {transferError && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {transferError}
              </div>
            )}`;

const newBanner = `            {transferError && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {transferError}
              </div>
            )}
            {watchAck && (
              <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span className="font-semibold">{watchAck}</span>
                <button
                  type="button"
                  className="text-[10px] font-bold underline shrink-0"
                  onClick={() => setWatchAck(null)}
                >
                  Dismiss
                </button>
              </div>
            )}`;

if (t.includes(oldBanner) && !t.includes('{watchAck &&')) {
  t = t.replace(oldBanner, newBanner);
  changes++;
  console.log('[patch-watch-ack] added watchAck banner');
} else if (t.includes('{watchAck &&')) {
  console.log('[patch-watch-ack] banner already present');
} else {
  console.warn('[patch-watch-ack] transferError banner not found');
}

fs.writeFileSync(file, t);
console.log('[patch-watch-ack] wrote', file, 'changes=', changes);
