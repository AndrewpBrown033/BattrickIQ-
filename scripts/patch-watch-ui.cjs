/**
 * Transfer Watch UI: Sydney countdown, safe cloud snapshot, +/- max bid, high bidder.
 * Idempotent.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'TransferWatchPage.tsx');
let t = fs.readFileSync(file, 'utf8');
let n = 0;

function once(label, oldStr, newStr) {
  if (!t.includes(oldStr)) {
    console.warn('[patch-watch-ui] missing', label);
    return;
  }
  t = t.replace(oldStr, newStr);
  n++;
  console.log('[patch-watch-ui]', label);
}

if (!t.includes('getDeadlineCountdown')) {
  once(
    'imports',
    `import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  hydrateWatchlistFromCloud,
  syncWatchlistFromCloud,
  type WatchEntry,
} from '../utils/transferWatchlist';`,
    `import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  hydrateWatchlistFromCloud,
  syncWatchlistFromCloud,
  applyIncomingCloudWatchlist,
  getDeadlineCountdown,
  type WatchEntry,
} from '../utils/transferWatchlist';`
  );
}

if (!t.includes('const [nowMs, setNowMs]')) {
  once(
    'nowMs state',
    '  const [syncing, setSyncing] = useState(false);\n',
    '  const [syncing, setSyncing] = useState(false);\n  const [nowMs, setNowMs] = useState(() => Date.now());\n'
  );
}

if (!t.includes('setNowMs(Date.now())')) {
  once(
    'countdown tick',
    `  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener('bt_transfer_watchlist_changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('bt_transfer_watchlist_changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [reload]);`,
    `  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener('bt_transfer_watchlist_changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('bt_transfer_watchlist_changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [reload]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);`
  );
}

if (t.includes("localStorage.setItem('bt_transfer_watchlist', JSON.stringify(data.items))")) {
  once(
    'snapshot',
    `    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { items?: WatchEntry[]; updatedAt?: string };
        if (!Array.isArray(data.items)) return;
        try {
          localStorage.setItem('bt_transfer_watchlist', JSON.stringify(data.items));
          const at = data.updatedAt || new Date().toISOString();
          localStorage.setItem('bt_transfer_watchlist_meta', JSON.stringify({ updatedAt: at }));
          window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
          setSyncMsg('Synced across your devices');
        } catch {
          // ignore
        }
      },
      () => setSyncMsg('Live sync paused')
    );`,
    `    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { items?: WatchEntry[]; updatedAt?: string };
        if (!Array.isArray(data.items)) return;
        try {
          const at = data.updatedAt || new Date().toISOString();
          const merged = applyIncomingCloudWatchlist(data.items, at);
          setList(merged);
          setSyncMsg('Synced across your devices');
        } catch {
          // ignore
        }
      },
      () => setSyncMsg('Live sync paused')
    );`
  );
}

if (!t.includes('const nudgeMax')) {
  once(
    'nudgeMax',
    '  const onArmBot = (w: WatchEntry) => {',
    `  const nudgeMax = (w: WatchEntry, delta: number) => {
    const draft = maxDraft[w.playerId] ?? String(w.maxBid || w.lastCost || 0);
    const base = Math.round(Number(String(draft).replace(/[^0-9]/g, '')) || w.maxBid || 0);
    const next = Math.max(1000, base + delta);
    setMaxDraft((d) => ({ ...d, [w.playerId]: String(next) }));
    setMaxBid(w.playerId, next);
    reload();
  };

  const onArmBot = (w: WatchEntry) => {`
  );
}

if (!t.includes('Auction ends (Sydney)')) {
  const oldHead = `                  <div className="text-[11px] text-slate-500 font-mono">
                    #{w.playerId}
                    {w.lastDeadline ? \` · \${w.lastDeadline}\` : ''}
                    {w.status === 'sold' ? ' · sold/delisted' : ''}
                  </div>`;
  const newHead = `                  <div className="text-[11px] text-slate-500 font-mono">
                    #{w.playerId}
                    {w.status === 'sold' ? ' · sold/delisted' : ''}
                  </div>`;
  if (t.includes(oldHead)) {
    t = t.replace(oldHead, newHead);
    n++;
    console.log('[patch-watch-ui] strip inline deadline');
  }

  const anchor = `{list.map((w) => {
          const expected = nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
          return (`;
  const replacement = `{list.map((w) => {
          const expected = nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
          const draft = maxDraft[w.playerId] ?? (w.maxBid != null ? String(w.maxBid) : '');
          const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
          const highBidder = (w as any).lastBidderTeam as string | undefined;
          return (`;
  if (t.includes(anchor)) {
    t = t.replace(anchor, replacement);
    n++;
    console.log('[patch-watch-ui] map vars');
  }

  const afterHeader = `                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-600 flex flex-wrap gap-x-3 gap-y-1">`;
  const withCountdown = `                </div>
              </div>

              {cd && (
                <div
                  className={\`rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 \${
                    cd.ended
                      ? 'bg-slate-100 text-slate-600'
                      : cd.msLeft <= 10 * 60 * 1000
                        ? 'bg-amber-50 text-amber-950 border border-amber-200'
                        : 'bg-indigo-50 text-indigo-950 border border-indigo-100'
                  }\`}
                >
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                      Auction ends (Sydney)
                    </div>
                    <div className="text-lg font-black tabular-nums tracking-tight">{cd.label}</div>
                  </div>
                  <div className="text-right text-[11px] font-mono">
                    <div>{cd.sydneyEndLabel}</div>
                    {w.lastDeadline && <div className="opacity-60">Listed {w.lastDeadline}</div>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5">
                  <div className="text-slate-400 font-mono">Current</div>
                  <div className="font-bold">{w.lastCurrentBid != null ? \`£\${w.lastCurrentBid.toLocaleString()}\` : '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5">
                  <div className="text-slate-400 font-mono">Next bid</div>
                  <div className="font-black text-indigo-700">{expected ? \`£\${expected.toLocaleString()}\` : '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5">
                  <div className="text-slate-400 font-mono">High bidder</div>
                  <div className="font-bold truncate">{highBidder || '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5">
                  <div className="text-slate-400 font-mono">Asking</div>
                  <div className="font-bold">{w.lastAskingPrice != null ? \`£\${w.lastAskingPrice.toLocaleString()}\` : '—'}</div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-600 flex flex-wrap gap-x-3 gap-y-1">`;
  if (t.includes(afterHeader) && !t.includes('Auction ends (Sydney)')) {
    t = t.replace(afterHeader, withCountdown);
    n++;
    console.log('[patch-watch-ui] countdown card');
  }
}

if (!t.includes("−£") && !t.includes("'−£")) {
  const armBtn = `{w.botEnabled ? (
                  <button
                    type="button"
                    onClick={() => onDisarm(w.playerId)}`;
  const withNudge = `<div className="flex flex-wrap gap-1 w-full" aria-label="Adjust max bid">
                  {[-100000, -50000, -10000, 10000, 50000, 100000].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => nudgeMax(w, d)}
                      className={\`px-2 py-1.5 rounded-lg border text-[11px] font-bold \${
                        d < 0
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      }\`}
                    >
                      {d > 0 ? '+' : '−'}£{Math.abs(d) / 1000}k
                    </button>
                  ))}
                </div>
                {w.botEnabled ? (
                  <button
                    type="button"
                    onClick={() => onDisarm(w.playerId)}`;
  if (t.includes(armBtn)) {
    t = t.replace(armBtn, withNudge);
    n++;
    console.log('[patch-watch-ui] nudge buttons');
  }
}

if (t.includes('setSuccessMsg(`Watching ${preview.name || id}`);') && !t.includes('setList(next)')) {
  once(
    'confirm setList',
    `      addToWatchlist({
        playerId: id,
        name: preview.name || \`Player \${id}\`,
        reason: addNote.trim() || 'Manual watch',
        lastAskingPrice: preview.askingPrice,
        lastCurrentBid: preview.currentBid,
        lastCost: cost,
        lastDeadline: preview.deadline,
        playerUrl: preview.playerUrl || PLAYER_URL(id),
      });
      setSuccessMsg(\`Watching \${preview.name || id}\`);
      setAddInput('');
      setAddNote('');
      clearPreview();
      reload();`,
    `      const next = addToWatchlist({
        playerId: id,
        name: preview.name || \`Player \${id}\`,
        reason: addNote.trim() || 'Manual watch',
        lastAskingPrice: preview.askingPrice,
        lastCurrentBid: preview.currentBid,
        lastCost: cost,
        lastDeadline: preview.deadline,
        playerUrl: preview.playerUrl || PLAYER_URL(id),
      });
      setList(next);
      setSuccessMsg(\`Watching \${preview.name || id} — saved\`);
      setAddInput('');
      setAddNote('');
      clearPreview();`
  );
}

fs.writeFileSync(file, t);
console.log('[patch-watch-ui] done changes=', n);
