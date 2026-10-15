import React from 'react';
import { Calendar, Landmark, RefreshCw, Upload, ChevronRight } from 'lucide-react';

type Props = {
  teamName: string;
  groundName?: string;
  pitchName?: string;
  weatherName?: string;
  seasonWeek: string;
  isPendingSync: boolean;
  onOpenSync: () => void;
};

export default function ClubHeroHeader({
  teamName,
  groundName,
  pitchName,
  weatherName,
  seasonWeek,
  isPendingSync,
  onOpenSync,
}: Props) {
  const hasReal =
    !!(teamName && teamName !== 'My Battrick IQ Club' && teamName !== 'Your Club' && teamName !== 'My Club');
  const display = hasReal ? teamName : 'Your Club';

  return (
    <div className="bg-gradient-to-br from-slate-950 via-[#0b192e] to-[#0f172a] text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-md border border-blue-900/40 relative overflow-hidden" id="club-hero-heading-banner">
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-200 bg-blue-900/80 border border-blue-400/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-blue-300" />
              {seasonWeek}
            </span>
            {isPendingSync ? (
              <span className="text-[11px] font-mono font-bold text-amber-200 bg-amber-900/60 border border-amber-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-300" />
                Syncing Live Data...
              </span>
            ) : (
              <span className="text-[11px] font-mono font-bold text-emerald-200 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Pavilion Synchronized
              </span>
            )}
          </div>

          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-blue-300/90 mt-1">
            Club
          </p>
          <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
            {display}
          </h1>
          {!hasReal && (
            <p className="text-xs text-blue-200/80 mt-1">
              Sync Pavilion / Office to load your real club name.
            </p>
          )}

          <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-100/90 font-medium flex-wrap mt-2">
            {groundName ? (
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
                <Landmark className="w-3.5 h-3.5 text-blue-200" />
                <span>Home · {groundName}</span>
              </span>
            ) : null}
            {pitchName ? (
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
                <span>{pitchName} Pitch</span>
              </span>
            ) : null}
            {weatherName ? (
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
                <span>{weatherName}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={onOpenSync}
            className="bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold transition-all duration-150 flex items-center gap-2 cursor-pointer shadow-sm backdrop-blur-xs"
            title="Open Pavilion Direct Sync Hub"
          >
            <Upload className="w-4 h-4 text-blue-200" />
            <span>Pavilion Sync</span>
            <ChevronRight className="w-3.5 h-3.5 text-blue-200" />
          </button>
        </div>
      </div>
    </div>
  );
}
