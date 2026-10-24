/**
 * Restore Transfer Watch card layout (Check now, +/- bids, Bot badges)
 * from the preferred design, then wire Sydney countdown + safe cloud merge.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const file = path.join(__dirname, '..', 'src', 'components', 'TransferWatchPage.tsx');

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

function alreadyGood(src) {
  return (
    src.includes('Check now') &&
    src.includes('100_000') &&
    src.includes('Next expected bid') &&
    src.includes('Stop bot') &&
    src.includes('getDeadlineCountdown')
  );
}

(async () => {
  let src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!alreadyGood(src)) {
    console.log('[patch-watch-ui] restoring design layout from known-good commit…');
    src = await fetchText(
      'https://raw.githubusercontent.com/AndrewpBrown033/BattrickIQ-/26c24fa5/src/components/TransferWatchPage.tsx'
    );
  }

  // Imports: cloud + Sydney countdown
  if (!src.includes('getDeadlineCountdown')) {
    const oldImp =
      "import {\n  loadWatchlist,\n  addToWatchlist,\n  removeFromWatchlist,\n  type WatchEntry,\n} from '../utils/transferWatchlist';";
    const newImp =
      "import {\n  loadWatchlist,\n  addToWatchlist,\n  removeFromWatchlist,\n  hydrateWatchlistFromCloud,\n  syncWatchlistFromCloud,\n  applyIncomingCloudWatchlist,\n  getDeadlineCountdown,\n  type WatchEntry,\n} from '../utils/transferWatchlist';";
    if (src.includes(oldImp)) {
      src = src.replace(oldImp, newImp);
      console.log('[patch-watch-ui] imports');
    } else if (src.includes("from '../utils/transferWatchlist'")) {
      src = src.replace(
        "from '../utils/transferWatchlist';",
        "from '../utils/transferWatchlist';\n/* ensure getDeadlineCountdown is exported from transferWatchlist */"
      );
      // force named imports if older style single line
      src = src.replace(
        /import\s*\{([^}]*)\}\s*from\s*'\.\.\/utils\/transferWatchlist';/,
        (m, inner) => {
          let names = inner;
          for (const need of [
            'hydrateWatchlistFromCloud',
            'syncWatchlistFromCloud',
            'applyIncomingCloudWatchlist',
            'getDeadlineCountdown',
          ]) {
            if (!names.includes(need)) names += ',\n  ' + need;
          }
          return "import {" + names + "} from '../utils/transferWatchlist';";
        }
      );
      console.log('[patch-watch-ui] imports patched');
    }
  }

  // nowMs tick for live countdown
  if (!src.includes('setNowMs')) {
    if (src.includes('const [maxDraft, setMaxDraft]')) {
      src = src.replace(
        'const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});',
        "const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});\n  const [nowMs, setNowMs] = useState(() => Date.now());"
      );
      src = src.replace(
        '}, [reload]);',
        `}, [reload]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);`
      );
      console.log('[patch-watch-ui] nowMs');
    }
  }

  // Sydney countdown under deadline in each card
  if (!src.includes('(Sydney)')) {
    const old =
      '{w.lastDeadline && <div>Deadline: {w.lastDeadline}</div>}';
    const neu =
      `{w.lastDeadline && <div>Deadline: {w.lastDeadline}</div>}
                  {(() => {
                    const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
                    if (!cd) return null;
                    if (cd.ended)
                      return <div className="font-semibold text-slate-500">Auction ended (Sydney)</div>;
                    return (
                      <div
                        className={
                          'font-black tabular-nums ' +
                          (cd.msLeft <= 10 * 60 * 1000 ? 'text-amber-700' : 'text-indigo-700')
                        }
                      >
                        {cd.label} left (Sydney)
                      </div>
                    );
                  })()}`;
    if (src.includes(old)) {
      src = src.replace(old, neu);
      console.log('[patch-watch-ui] sydney countdown');
    }
  }

  // High bidder line
  if (!src.includes('High bidder:')) {
    const old =
      '{w.lastDeadline && <div>Deadline: {w.lastDeadline}</div>}';
    // may already be replaced — inject after Current block instead
    if (src.includes('Next expected bid:') && !src.includes('High bidder:')) {
      src = src.replace(
        `{expected ? \`£\${expected.toLocaleString()}\` : '—'}\n                    </span>\n                  </div>`,
        `{expected ? \`£\${expected.toLocaleString()}\` : '—'}\n                    </span>\n                  </div>\n                  {(w as any).lastBidderTeam && (\n                    <div>\n                      High bidder:{' '}\n                      <span className="font-semibold text-slate-800">{(w as any).lastBidderTeam}</span>\n                    </div>\n                  )}`
      );
      console.log('[patch-watch-ui] high bidder');
    }
  }

  fs.writeFileSync(file, src);
  console.log('[patch-watch-ui] done', src.length, 'bytes');
})().catch((e) => {
  console.error('[patch-watch-ui]', e);
  process.exit(1);
});
