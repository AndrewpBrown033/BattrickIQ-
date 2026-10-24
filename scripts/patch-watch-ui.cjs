/** Force-restore TransferWatchPage to the preferred card layout on every build. */
const fs = require('fs');
const path = require('path');
const https = require('https');

const file = path.join(__dirname, '..', 'src', 'components', 'TransferWatchPage.tsx');
// Prefer local artifacts copy if present during CI; else fetch from this repo's artifacts branch path is unavailable — use embedded marker version.
// Inline: if current file already has Check now + Bot badges layout, skip.

function alreadyGood(src) {
  return (
    src.includes('Next expected bid') &&
    src.includes('Check') &&
    src.includes('Stop bot') &&
    src.includes('100_000') &&
    src.includes('getDeadlineCountdown') &&
    src.includes('applyIncomingCloudWatchlist') &&
    src.includes('Bot {')
  );
}

const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
if (alreadyGood(current) && current.includes('idx + 1')) {
  console.log('[patch-watch-ui] layout already matches design');
  process.exit(0);
}

console.log('[patch-watch-ui] applying design layout via surgical rebuild markers…');

// If not good, write a minimal notice — full file is restored from commit below when possible.
const GOOD =
  'https://raw.githubusercontent.com/AndrewpBrown033/BattrickIQ-/26c24fa5/src/components/TransferWatchPage.tsx';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'BattrickIQ-patch' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

(async () => {
  try {
    let src = await fetchText(GOOD);
    // Upgrade imports for cloud + sydney countdown
    if (!src.includes('getDeadlineCountdown')) {
      src = src.replace(
        "from '../utils/transferWatchlist';",
        "from '../utils/transferWatchlist';\n// patched imports below"
      );
      src = src.replace(
        "import {\n  loadWatchlist,\n  addToWatchlist,\n  removeFromWatchlist,\n  type WatchEntry,\n} from '../utils/transferWatchlist';",
        "import {\n  loadWatchlist,\n  addToWatchlist,\n  removeFromWatchlist,\n  hydrateWatchlistFromCloud,\n  syncWatchlistFromCloud,\n  applyIncomingCloudWatchlist,\n  getDeadlineCountdown,\n  type WatchEntry,\n} from '../utils/transferWatchlist';"
      );
    }
    // Inject countdown under deadline line in card if missing
    if (!src.includes('getDeadlineCountdown') || !src.includes('(Sydney)')) {
      src = src.replace(
        '{w.lastDeadline && <div>Deadline: {w.lastDeadline}</div>}',
        `{w.lastDeadline && <div>Deadline: {w.lastDeadline}</div>}
                  {typeof getDeadlineCountdown === 'function' && (() => {
                    const cd = getDeadlineCountdown(w.lastDeadline);
                    if (!cd) return null;
                    if (cd.ended) return <div className="font-semibold text-slate-500">Auction ended (Sydney)</div>;
                    return (
                      <div className={\`font-black tabular-nums \${cd.msLeft <= 10 * 60 * 1000 ? 'text-amber-700' : 'text-indigo-700'}\`}>
                        {cd.label} left (Sydney)
                      </div>
                    );
                  })()}`
      );
    }
    fs.writeFileSync(file, src);
    console.log('[patch-watch-ui] restored from 26c24fa5 + countdown hooks', src.length);
  } catch (e) {
    console.warn('[patch-watch-ui] fetch failed', e && e.message);
  }
})();
