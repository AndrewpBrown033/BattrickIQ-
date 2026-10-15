import React from 'react';
import {
  Building2,
  Calendar,
  ChevronRight,
  Cloud,
  Landmark,
  RefreshCw,
  Upload,
} from 'lucide-react';

type Props = {
  teamName: string;
  groundName?: string;
  pitchName?: string;
  weatherName?: string;
  seasonWeek: string;
  isPendingSync: boolean;
  onOpenSync: () => void;
  generalManager?: string;
  country?: string;
  region?: string;
  nationalRank?: string;
  worldRank?: string;
};

/**
 * Home / Manager desk hero — same visual language as LeagueStandings top banner.
 */
export default function ClubHeroHeader({
  teamName,
  groundName,
  pitchName,
  weatherName,
  seasonWeek,
  isPendingSync,
  onOpenSync,
  generalManager,
  country,
  region,
  nationalRank,
  worldRank,
}: Props) {
  const hasReal =
    !!(
      teamName &&
      teamName !== 'My Battrick IQ Club' &&
      teamName !== 'Your Club' &&
      teamName !== 'My Club'
    );
  const display = hasReal ? teamName : 'Your Club';
  const gm = (generalManager || '').trim();

  return (
    <div
      className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden"
      id="club-hero-heading-banner"
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manager desk · Club</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{seasonWeek}</span>
            </div>
            {isPendingSync ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing…</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Pavilion synced</span>
              </div>
            )}
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {gm ? (
              <>
                {gm}
                <span className="font-semibold text-slate-300">’s Club</span>
                {hasReal ? (
                  <span className="block text-lg md:text-xl font-bold text-emerald-300 mt-0.5">
                    {display}
                  </span>
                ) : null}
              </>
            ) : (
              display
            )}
          </h2>
          {!hasReal && !gm && (
            <p className="text-xs text-slate-400">
              Sync Pavilion / Office to load your real club name.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 font-medium">
            {groundName ? (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>
                  Ground: <strong className="text-white">{groundName}</strong>
                </span>
              </span>
            ) : null}
            {pitchName ? (
              <span className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-cyan-400" />
                <span>
                  Pitch: <strong className="text-white">{pitchName}</strong>
                </span>
              </span>
            ) : null}
            {weatherName ? (
              <span className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-amber-400" />
                <span>
                  Weather: <strong className="text-white">{weatherName}</strong>
                </span>
              </span>
            ) : null}
            {country ? (
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">Country:</span>
                <strong className="text-white">{country}</strong>
              </span>
            ) : null}
            {region ? (
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">Region:</span>
                <strong className="text-white">{region}</strong>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
          {(nationalRank || worldRank) && (
            <div className="grid grid-cols-2 gap-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 font-mono text-xs">
              {nationalRank ? (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                    National Ranking
                  </span>
                  <strong className="text-emerald-400 text-sm">{nationalRank}</strong>
                </div>
              ) : null}
              {worldRank ? (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                    World Ranking
                  </span>
                  <strong className="text-cyan-400 text-sm">{worldRank}</strong>
                </div>
              ) : null}
            </div>
          )}
          <button
            type="button"
            onClick={onOpenSync}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white border border-slate-700 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
            title="Open Pavilion Direct Sync Hub"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Pavilion Sync</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
