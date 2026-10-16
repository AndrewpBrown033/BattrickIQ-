import React, { useEffect, useState } from 'react';
import { navigateTo } from '../lib/navigation';
import {
  getWatchlistMonitorSummary,
  shouldAutoScanTransfers,
  loadAlerts,
  markAlertsRead,
  type TransferAlert,
} from '../utils/transferWatchlist';

/**
 * Light transfer monitor for Manager desk (enhancements 3–5 surface).
 */
export default function TransferMonitorCard({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}) {
  const [watchMonitor, setWatchMonitor] = useState(() => getWatchlistMonitorSummary());
  const [transferAlerts, setTransferAlerts] = useState<TransferAlert[]>(() => loadAlerts());

  useEffect(() => {
    const tick = () => {
      let cash: number | undefined;
      try {
        const f = localStorage.getItem('bt_finances');
        cash = f ? JSON.parse(f)?.cash : undefined;
      } catch {
        cash = undefined;
      }
      setWatchMonitor(getWatchlistMonitorSummary(cash));
      setTransferAlerts(loadAlerts());
    };
    tick();
    window.addEventListener('storage', tick);
    window.addEventListener('bt_transfer_watchlist_changed', tick);
    window.addEventListener('bt_transfer_alerts_changed', tick);
    return () => {
      window.removeEventListener('storage', tick);
      window.removeEventListener('bt_transfer_watchlist_changed', tick);
      window.removeEventListener('bt_transfer_alerts_changed', tick);
    };
  }, []);

  const show =
    watchMonitor.watched > 0 ||
    watchMonitor.unreadAlerts > 0 ||
    (watchMonitor.staleHours != null && watchMonitor.staleHours >= 6);

  if (!show) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-indigo-950">Transfer monitor</div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem('bt_squad_subtab', 'estimator');
              if (shouldAutoScanTransfers(6)) {
                localStorage.setItem('bt_estimator_autoscan', '1');
              }
            } catch {}
            try {
              navigateTo({
                tab: 'squad',
                squadSub: 'estimator',
                autoScan: shouldAutoScanTransfers(6),
              });
            } catch {}
            setActiveTab('squad');
          }}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white"
        >
          Open Estimator / scan
        </button>
      </div>
      <p className="text-[12px] text-indigo-900/80">
        Watching {watchMonitor.watched} · {watchMonitor.listed} still listed · {watchMonitor.actionable}{' '}
        actionable
        {watchMonitor.endingSoon > 0 ? ` · ${watchMonitor.endingSoon} ending soon` : ''}
        {watchMonitor.staleHours != null
          ? ` · last scan ${
              watchMonitor.staleHours < 1
                ? 'just now'
                : `${Math.round(watchMonitor.staleHours)}h ago`
            }`
          : ' · never scanned'}
      </p>
      {watchMonitor.topLines.map((line) => (
        <p key={line} className="text-[11px] font-medium text-indigo-900">
          • {line}
        </p>
      ))}
      {transferAlerts
        .filter((a) => !a.read)
        .slice(0, 3)
        .map((a) => (
          <p
            key={a.id}
            className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1"
          >
            {a.message}
          </p>
        ))}
      {transferAlerts.some((a) => !a.read) && (
        <button
          type="button"
          onClick={() => {
            markAlertsRead();
            setTransferAlerts(loadAlerts());
          }}
          className="text-[10px] font-bold text-indigo-700 underline"
        >
          Mark alerts read
        </button>
      )}
    </div>
  );
}
