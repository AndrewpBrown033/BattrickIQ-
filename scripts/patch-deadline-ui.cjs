const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'TransferWatchPage.tsx');
if (!fs.existsSync(file)) { console.warn('no TransferWatchPage'); process.exit(0); }
let t = fs.readFileSync(file, 'utf8');
if (t.includes('PLACEHOLDER') || t.length < 100) {
  console.warn('[patch-deadline-ui] TransferWatchPage is placeholder — skip UI patch');
  process.exit(0);
}
if (t.includes('Ends (Sydney)')) {
  console.log('[patch-deadline-ui] already applied');
  process.exit(0);
}
const old = `const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
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
                    );`;
const neu = `const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
                    if (!cd && !w.lastDeadline) return null;
                    if (!cd) {
                      return (
                        <div className="text-[11px] text-slate-500">
                          Deadline (raw): {w.lastDeadline}
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        <div className="text-slate-600">
                          <span className="font-semibold text-slate-500">Ends (Sydney)</span>{' '}
                          <span className="font-mono font-bold text-slate-900">{cd.sydneyEndLabel}</span>
                        </div>
                        <div className="text-slate-500">
                          <span className="font-semibold">Ends (GMT)</span>{' '}
                          <span className="font-mono">{cd.gmtEndLabel}</span>
                        </div>
                        {cd.ended ? (
                          <div className="font-semibold text-slate-500">Auction ended</div>
                        ) : (
                          <div
                            className={
                              'font-black tabular-nums text-sm ' +
                              (cd.msLeft <= 10 * 60 * 1000 ? 'text-amber-700' : 'text-indigo-700')
                            }
                          >
                            {cd.label}
                            <span className="font-semibold text-[10px] ml-1 opacity-80">remaining</span>
                          </div>
                        )}
                      </div>
                    );`;
if (t.includes(old)) {
  t = t.replace(old, neu);
  console.log('[patch-deadline-ui] UI updated');
} else if (t.includes('getDeadlineCountdown(w.lastDeadline')) {
  console.warn('[patch-deadline-ui] countdown block shape differs — manual check');
} else {
  console.warn('[patch-deadline-ui] no countdown block found');
}
fs.writeFileSync(file, t);
