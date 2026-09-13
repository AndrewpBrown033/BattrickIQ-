import React, { useState, useEffect, useMemo } from 'react';
import { 
  ParsedBattrickMatch, 
  BattrickGame, 
  PitchType, 
  WeatherType,
  SKILL_LEVELS,
  getSkillLabel
} from '../types';
import { 
  getStoredMatches, 
  getStoredMatchesList, 
  getStoredMatchById,
  saveStoredMatch, 
  saveMultipleStoredMatches, 
  deleteStoredMatch, 
  clearAllStoredMatches,
  fetchAndStoreSingleMatch,
  predictTeamLineupAndSkills,
  PredictedTeamLineup,
  MatchQueueItem
} from '../utils/matchArchive';
import { parseBattrickFullMatch } from '../parser';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import { 
  Calendar, Search, Trophy, Shield, Clock, Swords, ArrowUpRight, 
  FileText, BarChart3, MessageSquare, Play, Pause, RotateCw, CheckCircle, 
  AlertCircle, ChevronDown, ChevronUp, Layers, Users, Zap, ExternalLink,
  Download, Upload, Trash2, HelpCircle, Activity, Sparkles, Crosshair, Database
} from 'lucide-react';

interface MatchArchiveViewerProps {
  fixtures: BattrickGame[];
  setActiveTab: (tab: any) => void;
  onMatchSelected?: (match: ParsedBattrickMatch) => void;
}

export default function MatchArchiveViewer({ fixtures, setActiveTab, onMatchSelected }: MatchArchiveViewerProps) {
  const { username: battrickUser, password: battrickPass, isAuthenticated, requireAuth, openPrompt } = useBattrickAuth();
  
  const [storedMatches, setStoredMatches] = useState<Record<string, ParsedBattrickMatch>>({});
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedTeamPredictor, setSelectedTeamPredictor] = useState<string>('');
  const [predictorFormat, setPredictorFormat] = useState<string>('All');
  
  // Batch Queue State
  const [isQueueRunning, setIsQueueRunning] = useState<boolean>(false);
  const [queueItems, setQueueItems] = useState<MatchQueueItem[]>([]);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
  const [queueProgress, setQueueProgress] = useState<{ current: number; total: number; percent: number }>({ current: 0, total: 0, percent: 0 });
  const [queueStatusMsg, setQueueStatusMsg] = useState<string | null>(null);
  
  // Single match manual input
  const [manualMatchId, setManualMatchId] = useState<string>('');
  const [manualFetching, setManualFetching] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Active view sub-tab
  const [viewMode, setViewMode] = useState<'matches' | 'predictor' | 'queue'>('matches');
  const [selectedInningsIdx, setSelectedInningsIdx] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadMatchesFromStorage = () => {
    const matches = getStoredMatches();
    setStoredMatches(matches);
  };

  useEffect(() => {
    loadMatchesFromStorage();
    const handleUpdate = () => loadMatchesFromStorage();
    window.addEventListener('bt_matches_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('bt_matches_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const storedMatchesList = useMemo(() => {
    return (Object.values(storedMatches) as ParsedBattrickMatch[]).sort((a, b) => {
      return (parseInt(b.matchId, 10) || 0) - (parseInt(a.matchId, 10) || 0);
    });
  }, [storedMatches]);

  const clubName = useMemo(() => {
    if (typeof localStorage !== 'undefined') {
      const name = localStorage.getItem('bt_team_name');
      if (name && name !== 'My Battrick IQ Club') return name;
    }
    return 'My Club';
  }, []);

  // Filter played games from fixtures that have a matchId
  const playedFixtures = useMemo(() => {
    return fixtures.filter(f => {
      const hasId = Boolean(f.matchId && f.matchId.trim());
      const isPlayed = f.result && f.result !== 'Upcoming' && f.section !== 'upcoming';
      return hasId || isPlayed;
    });
  }, [fixtures]);

  // Set default predictor team if none selected
  useEffect(() => {
    if (!selectedTeamPredictor && storedMatchesList.length > 0) {
      const first = storedMatchesList[0];
      const otherTeam = first.homeTeam.toLowerCase().includes(clubName.toLowerCase()) ? first.awayTeam : first.homeTeam;
      setSelectedTeamPredictor(otherTeam || first.awayTeam || clubName);
    }
  }, [storedMatchesList, selectedTeamPredictor, clubName]);

  // Set default selected match if none selected
  useEffect(() => {
    if (!selectedMatchId && storedMatchesList.length > 0) {
      setSelectedMatchId(storedMatchesList[0].matchId);
    }
  }, [storedMatchesList, selectedMatchId]);

  const activeSelectedMatch = useMemo(() => {
    if (!selectedMatchId) return null;
    return storedMatches[selectedMatchId] || null;
  }, [selectedMatchId, storedMatches]);

  // Teams available in stored matches
  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    storedMatchesList.forEach(m => {
      if (m.homeTeam) teams.add(m.homeTeam);
      if (m.awayTeam) teams.add(m.awayTeam);
    });
    return Array.from(teams);
  }, [storedMatchesList]);

  // Computed Prediction Model
  const predictedModel = useMemo(() => {
    if (!selectedTeamPredictor) return null;
    return predictTeamLineupAndSkills(selectedTeamPredictor, predictorFormat, storedMatchesList);
  }, [selectedTeamPredictor, predictorFormat, storedMatchesList]);

  // Filtered stored matches
  const filteredMatchesList = useMemo(() => {
    if (!searchTerm.trim()) return storedMatchesList;
    const q = searchTerm.toLowerCase().trim();
    return storedMatchesList.filter(m => 
      m.matchId.includes(q) ||
      m.homeTeam.toLowerCase().includes(q) ||
      m.awayTeam.toLowerCase().includes(q) ||
      m.matchType.toLowerCase().includes(q) ||
      m.venue.toLowerCase().includes(q) ||
      m.result.toLowerCase().includes(q)
    );
  }, [storedMatchesList, searchTerm]);

  // -------------------------------------------------------------
  // Queue & Batch Retrieval Execution
  // -------------------------------------------------------------

  const handleStartQueue = async (customMatchIds?: string[], forceRefreshAll: boolean = false) => {
    let idsToQueue: { matchId: string; opponent?: string; homeTeam?: string; awayTeam?: string; date?: string; type?: string }[] = [];

    if (customMatchIds && customMatchIds.length > 0) {
      idsToQueue = customMatchIds.map(id => ({ matchId: id.trim() }));
    } else {
      // Find all played matches with matchId that are not yet stored or need refresh
      idsToQueue = playedFixtures
        .filter(f => f.matchId)
        .map(f => ({
          matchId: f.matchId!,
          opponent: f.opponent,
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          date: f.date,
          type: f.type
        }));
    }

    if (idsToQueue.length === 0) {
      alert('No played match IDs found to queue. You can enter a Match ID manually below.');
      return;
    }

    // Check if any match needs remote fetching
    const needsRemote = idsToQueue.some(item => {
      if (forceRefreshAll) return true;
      const cached = storedMatches[item.matchId] || getStoredMatchById(item.matchId);
      return !cached || (!cached.innings || cached.innings.length === 0);
    });

    // Require Direct Sync credentials only if we actually need to hit the Battrick server
    if (needsRemote && !requireAuth('batch queue and retrieve match scorecards & summaries')) {
      return;
    }

    const initialQueue: MatchQueueItem[] = idsToQueue.map(item => {
      const cached = storedMatches[item.matchId] || getStoredMatchById(item.matchId);
      return {
        matchId: item.matchId,
        opponent: item.opponent,
        homeTeam: item.homeTeam,
        awayTeam: item.awayTeam,
        date: item.date,
        type: item.type,
        status: (cached && !forceRefreshAll) ? 'success' : 'pending',
        matchData: cached || undefined
      };
    });

    setQueueItems(initialQueue);
    setIsQueueRunning(true);
    setViewMode('queue');
    setQueueProgress({ current: 0, total: initialQueue.length, percent: 0 });

    const username = battrickUser;
    const password = battrickPass;
    let sessionToken = localStorage.getItem('bt_sync_session') || '';

    let newCount = 0;
    let cachedCount = 0;
    const updatedQueue = [...initialQueue];

    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      setCurrentProcessingId(item.matchId);

      const existingMatch = storedMatches[item.matchId] || getStoredMatchById(item.matchId);
      if (!forceRefreshAll && existingMatch && ((existingMatch.innings && existingMatch.innings.length > 0) || existingMatch.homeRatings)) {
        setQueueStatusMsg(`[${i + 1}/${updatedQueue.length}] Loaded Match #${item.matchId} from local cache.`);
        updatedQueue[i] = {
          ...item,
          status: 'success',
          matchData: existingMatch
        };
        cachedCount++;
        setQueueItems([...updatedQueue]);
        setQueueProgress({
          current: i + 1,
          total: updatedQueue.length,
          percent: Math.round(((i + 1) / updatedQueue.length) * 100)
        });
        continue;
      }

      setQueueStatusMsg(`[${i + 1}/${updatedQueue.length}] Fetching Match #${item.matchId} (Scorecard + Summary) from Battrick...`);
      
      updatedQueue[i] = { ...item, status: 'fetching' };
      setQueueItems([...updatedQueue]);

      try {
        // Fetch via server proxy
        const res = await fetch('/api/sync-battrick-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: item.matchId,
            username,
            password,
            sessionToken
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || data.message || `HTTP ${res.status}`);
        }

        if (data.sessionToken) {
          sessionToken = data.sessionToken;
          localStorage.setItem('bt_sync_session', sessionToken);
        }

        const combinedHtml = `${data.matchHtml || ''}\n${data.summaryHtml || ''}`;
        const parsed = parseBattrickFullMatch(combinedHtml, item.matchId);

        await saveStoredMatch(parsed);

        updatedQueue[i] = {
          ...item,
          status: 'success',
          matchData: parsed
        };
        newCount++;
      } catch (err: any) {
        console.error(`Failed to fetch match ${item.matchId}:`, err);
        updatedQueue[i] = {
          ...item,
          status: 'error',
          error: err?.message || 'Connection failed'
        };
      }

      setQueueItems([...updatedQueue]);
      setQueueProgress({
        current: i + 1,
        total: updatedQueue.length,
        percent: Math.round(((i + 1) / updatedQueue.length) * 100)
      });

      // Pacing interval: wait 2.5 seconds between remote fetches to avoid Battrick HTTP 429
      if (i < updatedQueue.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    setIsQueueRunning(false);
    setCurrentProcessingId(null);
    setQueueStatusMsg(`✓ Batch complete! ${cachedCount} matches loaded from cache, ${newCount} new scorecards synced.`);
    loadMatchesFromStorage();
  };

  const handleFetchSingleManual = async () => {
    const id = manualMatchId.trim();
    if (!id) {
      setManualError('Please enter a valid Battrick Match ID (e.g. 32161741).');
      return;
    }

    const existingMatch = getStoredMatchById(id);
    if (existingMatch) {
      setSelectedMatchId(existingMatch.matchId);
      setManualMatchId('');
      loadMatchesFromStorage();
      setViewMode('matches');
      return;
    }

    if (!requireAuth(`retrieve Match #${id}`)) {
      return;
    }

    setManualFetching(true);
    setManualError(null);

    try {
      const parsed = await fetchAndStoreSingleMatch(id, {
        username: battrickUser,
        password: battrickPass
      });
      setSelectedMatchId(parsed.matchId);
      setManualMatchId('');
      loadMatchesFromStorage();
      setViewMode('matches');
    } catch (e: any) {
      setManualError(e.message || `Could not fetch match #${id}`);
    } finally {
      setManualFetching(false);
    }
  };

  const handleRefetchCurrentMatch = async (matchId: string) => {
    if (!requireAuth(`re-fetch Match #${matchId}`)) {
      return;
    }
    setManualFetching(true);
    setManualError(null);
    try {
      const parsed = await fetchAndStoreSingleMatch(matchId, {
        username: battrickUser,
        password: battrickPass
      }, true); // Force remote re-fetch
      setSelectedMatchId(parsed.matchId);
      loadMatchesFromStorage();
    } catch (e: any) {
      const msg = e.message || `Could not re-fetch match #${matchId}`;
      setManualError(msg);
      if (e.isAuthFailure || msg.includes('Session expired') || msg.includes('re-authenticate')) {
        openPrompt();
      }
    } finally {
      setManualFetching(false);
    }
  };

  const handleExportMatchesJson = () => {
    const jsonStr = JSON.stringify(storedMatches, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battrick_matches_archive_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMatchesJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) {
          const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
          await saveMultipleStoredMatches(list as ParsedBattrickMatch[]);
          loadMatchesFromStorage();
          alert(`Successfully imported ${list.length} matches into archive!`);
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all stored match scorecards and summaries?')) {
      clearAllStoredMatches();
      setStoredMatches({});
      setSelectedMatchId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6" id="match-archive-viewer-root">
      
      {/* Top Controls & Statistics Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                <Database className="w-6 h-6" />
              </span>
              <div>
                <h2 className="font-serif text-2xl font-bold tracking-tight">
                  Match Details &amp; Summary Intelligence Archive
                </h2>
                <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                  Batch queue and store complete game scorecards and Reporter's Summaries to reverse-engineer opponent batting line-ups, 5th bowler vulnerabilities, and hidden skill grades.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex rounded-xl shadow-sm border border-slate-700 overflow-hidden">
              <button
                type="button"
                disabled={isQueueRunning}
                onClick={() => handleStartQueue()}
                className={`text-xs font-mono font-bold px-4 py-2.5 flex items-center gap-2 transition cursor-pointer ${
                  isQueueRunning
                    ? 'bg-amber-600 text-white animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>{isQueueRunning ? 'Syncing Queue...' : `Sync Played Games (${playedFixtures.length})`}</span>
              </button>
              <button
                type="button"
                disabled={isQueueRunning}
                onClick={() => handleStartQueue(undefined, true)}
                title="Force re-fetch all matches directly from Battrick, overwriting local cache"
                className="text-[11px] font-mono font-bold px-2.5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border-l border-emerald-500/40 transition cursor-pointer flex items-center gap-1"
              >
                <RotateCw className="w-3 h-3" />
                <span>Force Re-fetch</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('predictor')}
              className={`text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer border ${
                viewMode === 'predictor'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-300" />
              <span>Lineup &amp; Skill Predictor</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('matches')}
              className={`text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer border ${
                viewMode === 'matches'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              <Layers className="w-4 h-4 text-blue-300" />
              <span>Archived Matches ({storedMatchesList.length})</span>
            </button>
          </div>
        </div>

        {/* Live Status Bar when Queue is Running */}
        {isQueueRunning && (
          <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-amber-300 font-bold flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                {queueStatusMsg || 'Processing batch queue...'}
              </span>
              <span className="text-slate-300 font-bold">
                {queueProgress.current} / {queueProgress.total} ({queueProgress.percent}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${queueProgress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Manual Single Match Retriever Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Enter specific Match ID to retrieve (e.g. 32161741)..."
            value={manualMatchId}
            onChange={(e) => setManualMatchId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchSingleManual()}
            className="w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            disabled={manualFetching}
            onClick={handleFetchSingleManual}
            className="text-xs font-mono font-bold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shrink-0 flex items-center gap-1.5"
          >
            {manualFetching ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Fetch &amp; Store</span>
              </>
            )}
          </button>
        </div>

        {/* JSON Backup & Clear Actions */}
        <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <button
            type="button"
            onClick={handleExportMatchesJson}
            title="Export match archive to JSON file"
            className="text-[11px] font-mono text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
          >
            <Download className="w-3 h-3" />
            <span>Export JSON</span>
          </button>

          <label 
            title="Import matches JSON backup"
            className="text-[11px] font-mono text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportMatchesJson} className="hidden" />
          </label>

          {storedMatchesList.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Clear all stored matches"
              className="text-[11px] font-mono text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {manualError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{manualError}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW MODE 1: LINEUP & SKILL PREDICTOR */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'predictor' && (
        <div className="space-y-6">
          
          {/* Predictor Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Team Lineup &amp; Skill Predictor
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reverse-engineers batting orders, hidden skill grades, and 5th bowler vulnerabilities from stored match history.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Select Team */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-mono font-bold text-slate-500 uppercase">Target Team:</label>
                  <select
                    value={selectedTeamPredictor}
                    onChange={(e) => setSelectedTeamPredictor(e.target.value)}
                    className="text-xs font-bold font-mono py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    {availableTeams.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    {availableTeams.length === 0 && (
                      <option value={clubName}>{clubName}</option>
                    )}
                  </select>
                </div>

                {/* Match Format Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-mono font-bold text-slate-500 uppercase">Format:</label>
                  <select
                    value={predictorFormat}
                    onChange={(e) => setPredictorFormat(e.target.value)}
                    className="text-xs font-bold font-mono py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    <option value="All">All Formats</option>
                    <option value="One Day">One Day</option>
                    <option value="Twenty20">Twenty20</option>
                    <option value="First Class">First Class</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {!predictedModel ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 text-base mb-1">No Stored Matches for {selectedTeamPredictor || 'Selected Team'}</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                Please queue and retrieve played matches from your fixtures list or enter match IDs above to unlock reverse-engineered team predictions.
              </p>
              <button
                type="button"
                onClick={() => handleStartQueue()}
                className="text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
              >
                Queue Played Fixtures
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Predicted Sector Ratings & Batstats Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-2xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Top Order</span>
                  <span className="text-sm font-bold text-indigo-700 block mt-0.5">{predictedModel.predictedRatings.topOrder.text}</span>
                  <span className="text-[10px] font-mono text-slate-400">({predictedModel.predictedRatings.topOrder.score.toFixed(1)})</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-2xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Middle Order</span>
                  <span className="text-sm font-bold text-indigo-700 block mt-0.5">{predictedModel.predictedRatings.middleOrder.text}</span>
                  <span className="text-[10px] font-mono text-slate-400">({predictedModel.predictedRatings.middleOrder.score.toFixed(1)})</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-2xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Lower Order</span>
                  <span className="text-sm font-bold text-slate-700 block mt-0.5">{predictedModel.predictedRatings.lowerOrder.text}</span>
                  <span className="text-[10px] font-mono text-slate-400">({predictedModel.predictedRatings.lowerOrder.score.toFixed(1)})</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-2xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Seam Bowling</span>
                  <span className="text-sm font-bold text-blue-700 block mt-0.5">{predictedModel.predictedRatings.seamBowling.text}</span>
                  <span className="text-[10px] font-mono text-slate-400">({predictedModel.predictedRatings.seamBowling.score.toFixed(1)})</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-2xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Spin Bowling</span>
                  <span className="text-sm font-bold text-emerald-700 block mt-0.5">{predictedModel.predictedRatings.spinBowling.text}</span>
                  <span className="text-[10px] font-mono text-slate-400">({predictedModel.predictedRatings.spinBowling.score.toFixed(1)})</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-2xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Fielding</span>
                  <span className="text-sm font-bold text-slate-700 block mt-0.5">{predictedModel.predictedRatings.fielding.text}</span>
                  <span className="text-[10px] font-mono text-slate-400">({predictedModel.predictedRatings.fielding.score.toFixed(1)})</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center shadow-2xs col-span-2 sm:col-span-3 lg:col-span-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-800 block">Batstats</span>
                  <span className="text-sm font-bold text-amber-900 block mt-0.5">
                    {predictedModel.predictedRatings.estimatedBatstats.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-mono text-amber-700">Projected</span>
                </div>
              </div>

              {/* Tactical Vulnerability & Exploit Alert */}
              <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-start gap-3">
                  <span className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
                    <Crosshair className="w-5 h-5" />
                  </span>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-serif font-bold text-base text-rose-950">
                        Tactical Exploit: 5th Bowler Target ({predictedModel.fifthBowlerRiskSummary.bowlerName})
                      </h4>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-200 text-rose-900 border border-rose-300">
                        {predictedModel.fifthBowlerRiskSummary.riskLevel} Vulnerability
                      </span>
                    </div>
                    <p className="text-xs text-rose-900 leading-relaxed">
                      {predictedModel.fifthBowlerRiskSummary.analysis}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {predictedModel.tacticalRecommendations.map((rec, rIdx) => (
                        <span key={rIdx} className="text-[11px] font-mono bg-white/80 border border-rose-200 text-slate-800 px-2.5 py-1 rounded-lg">
                          • {rec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Predicted Batting Lineup Table (#1 to #11) */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Predicted Batting Lineup &amp; Implied Skill Grades ({selectedTeamPredictor})
                  </h4>
                  <span className="text-xs font-mono text-slate-500">
                    Based on {predictedModel.sampleMatchesCount} stored matches
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-mono font-bold uppercase">
                        <th className="py-2.5 px-4 w-12 text-center">Pos</th>
                        <th className="py-2.5 px-4">Player</th>
                        <th className="py-2.5 px-4">Role</th>
                        <th className="py-2.5 px-4 text-center">Batting Grade (Implied)</th>
                        <th className="py-2.5 px-4 text-center">Avg Runs</th>
                        <th className="py-2.5 px-4 text-center">Strike Rate</th>
                        <th className="py-2.5 px-4 text-center">Bowling Grade</th>
                        <th className="py-2.5 px-4 text-center">5th Bowler Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {predictedModel.predictedBattingOrder.map((player, idx) => {
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-mono font-bold text-center text-slate-700 bg-slate-50/50">
                              #{player.battingOrderModal || (idx + 1)}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {player.name}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                {player.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                {player.estimatedBattingGrade} ({player.estimatedBattingScore})
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {player.averageRuns}
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-600">
                              {player.strikeRate}%
                            </td>
                            <td className="py-3 px-4 text-center">
                              {player.isBowler ? (
                                <span className={`font-mono font-semibold px-2 py-0.5 rounded ${
                                  player.bowlingType === 'Spin' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'
                                }`}>
                                  {player.estimatedBowlingGrade} ({player.bowlingType})
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {player.isFifthBowlerRisk ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3" />
                                  Targetable ({player.economy} RPO)
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">Normal</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW MODE 2: MATCHES ARCHIVE & COMPLETE SCORECARD INSPECTOR */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'matches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Matches List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-base text-slate-900">
                  Archived Games ({storedMatchesList.length})
                </h4>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                  Scorecards &amp; Summaries
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search team or Match ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto pr-1">
                {filteredMatchesList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No stored matches match your search.
                  </div>
                ) : (
                  filteredMatchesList.map(m => {
                    const isSelected = selectedMatchId === m.matchId;
                    return (
                      <div
                        key={m.matchId}
                        onClick={() => {
                          setSelectedMatchId(m.matchId);
                          setSelectedInningsIdx(0);
                        }}
                        className={`py-3 px-3 rounded-xl cursor-pointer transition flex flex-col gap-1.5 ${
                          isSelected 
                            ? 'bg-indigo-50/90 border border-indigo-200 shadow-2xs ring-1 ring-indigo-300' 
                            : 'hover:bg-slate-50 border border-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            #{m.matchId} • {m.matchType}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-indigo-700">
                            {m.matchDate}
                          </span>
                        </div>

                        <div className="font-serif font-bold text-sm text-slate-900">
                          {m.homeTeam} v {m.awayTeam}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>{m.pitch} • {m.weather}</span>
                          <span className="text-emerald-700 font-mono font-bold">
                            {m.homeRatings?.batstat ? `${m.homeRatings.batstat.toLocaleString()} pts` : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 mt-0.5">
                          <span className="text-[10px] font-mono font-medium text-slate-500 truncate max-w-[150px]">
                            {m.result || 'Match Archived'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMatchId(m.matchId);
                              setSelectedInningsIdx(0);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                            {isSelected ? 'Viewing Summary' : 'Open Local Summary'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Match Scorecard & Reporter's Summary */}
          <div className="lg:col-span-8 space-y-5">
            {!activeSelectedMatch ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-bold text-slate-800 text-base mb-1">No Match Selected</h4>
                <p className="text-xs text-slate-500">
                  Select a match from the left column or queue your played games to inspect its full scorecard and ratings breakdown.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                
                {/* Match Header Details Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                          Match #{activeSelectedMatch.matchId}
                        </span>
                        <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {activeSelectedMatch.matchType}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {activeSelectedMatch.matchDate}
                        </span>
                      </div>
                      <h3 className="font-serif font-bold text-2xl text-slate-900 mt-1">
                        {activeSelectedMatch.homeTeam} v {activeSelectedMatch.awayTeam}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {activeSelectedMatch.venue} • Pitch: <strong className="text-slate-800">{activeSelectedMatch.pitch}</strong> • Weather: <strong className="text-slate-800">{activeSelectedMatch.weather}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                      <button
                        type="button"
                        disabled={manualFetching}
                        onClick={() => handleRefetchCurrentMatch(activeSelectedMatch.matchId)}
                        className="text-xs font-mono font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                        title="Re-fetch scorecard and reporter summary from Battrick to refresh cached Batstats"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${manualFetching ? 'animate-spin' : ''}`} />
                        <span>Re-sync Summary</span>
                      </button>
                      <a
                        href={activeSelectedMatch.matchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Battrick Scorecard</span>
                      </a>
                      <a
                        href={activeSelectedMatch.summaryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Batstats Summary</span>
                      </a>
                    </div>
                  </div>

                  {/* Match Result Banner */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="font-semibold text-slate-800">
                      <strong>Result:</strong> {activeSelectedMatch.result}
                    </span>
                    {activeSelectedMatch.toss && (
                      <span className="font-mono text-slate-500">
                        {activeSelectedMatch.toss}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reporter's Summary & Ratings Comparison */}
                {(activeSelectedMatch.homeRatings || activeSelectedMatch.awayRatings) && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-600" />
                        Reporter's Summary Ratings &amp; Batstats
                      </h4>
                      <span className="text-[11px] font-mono text-slate-500">
                        Official Battrick Match Ratings (1–20 Score)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Home Team Ratings */}
                      {activeSelectedMatch.homeRatings && (
                        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-serif font-bold text-slate-900">{activeSelectedMatch.homeTeam}</span>
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              Batstats: {activeSelectedMatch.homeRatings.batstat.toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Top Order:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.homeRatings.topOrder} ({activeSelectedMatch.homeRatings.topOrderScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Middle Order:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.homeRatings.middleOrder} ({activeSelectedMatch.homeRatings.middleOrderScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Lower Order:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.homeRatings.lowerOrder} ({activeSelectedMatch.homeRatings.lowerOrderScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Seam Bowling:</span>
                              <span className="font-bold text-blue-700">{activeSelectedMatch.homeRatings.seamBowling} ({activeSelectedMatch.homeRatings.seamBowlingScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Spin Bowling:</span>
                              <span className="font-bold text-emerald-700">{activeSelectedMatch.homeRatings.spinBowling} ({activeSelectedMatch.homeRatings.spinBowlingScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Fielding:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.homeRatings.fielding} ({activeSelectedMatch.homeRatings.fieldingScore})</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Away Team Ratings */}
                      {activeSelectedMatch.awayRatings && (
                        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-serif font-bold text-slate-900">{activeSelectedMatch.awayTeam}</span>
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              Batstats: {activeSelectedMatch.awayRatings.batstat.toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Top Order:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.awayRatings.topOrder} ({activeSelectedMatch.awayRatings.topOrderScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Middle Order:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.awayRatings.middleOrder} ({activeSelectedMatch.awayRatings.middleOrderScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Lower Order:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.awayRatings.lowerOrder} ({activeSelectedMatch.awayRatings.lowerOrderScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Seam Bowling:</span>
                              <span className="font-bold text-blue-700">{activeSelectedMatch.awayRatings.seamBowling} ({activeSelectedMatch.awayRatings.seamBowlingScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Spin Bowling:</span>
                              <span className="font-bold text-emerald-700">{activeSelectedMatch.awayRatings.spinBowling} ({activeSelectedMatch.awayRatings.spinBowlingScore})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Fielding:</span>
                              <span className="font-bold text-slate-800">{activeSelectedMatch.awayRatings.fielding} ({activeSelectedMatch.awayRatings.fieldingScore})</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Scorecard Innings Selector */}
                {activeSelectedMatch.innings.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        {activeSelectedMatch.innings.map((inn, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedInningsIdx(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                              selectedInningsIdx === idx
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Innings {idx + 1}: {inn.teamName}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Innings Batting Table */}
                    {activeSelectedMatch.innings[selectedInningsIdx] && (
                      <div className="space-y-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-mono font-bold uppercase">
                                <th className="py-2 px-3 w-8">#</th>
                                <th className="py-2 px-3">Batter</th>
                                <th className="py-2 px-3">Dismissal</th>
                                <th className="py-2 px-3 text-right">R</th>
                                <th className="py-2 px-3 text-right">B</th>
                                <th className="py-2 px-3 text-right">4s</th>
                                <th className="py-2 px-3 text-right">6s</th>
                                <th className="py-2 px-3 text-right">SR</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-mono">
                              {activeSelectedMatch.innings[selectedInningsIdx].batters.map((b, bIdx) => (
                                <tr key={bIdx} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 text-slate-400">{b.order || (bIdx + 1)}</td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900 font-sans">{b.name}</td>
                                  <td className="py-2.5 px-3 text-slate-500">{b.dismissal}</td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900 text-right">{b.runs}</td>
                                  <td className="py-2.5 px-3 text-slate-600 text-right">{b.balls}</td>
                                  <td className="py-2.5 px-3 text-slate-600 text-right">{b.fours}</td>
                                  <td className="py-2.5 px-3 text-slate-600 text-right">{b.sixes}</td>
                                  <td className="py-2.5 px-3 text-indigo-700 text-right font-bold">{b.strikeRate}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Bowling Table */}
                        {activeSelectedMatch.innings[selectedInningsIdx].bowlers.length > 0 && (
                          <div className="pt-2">
                            <h5 className="font-serif font-bold text-sm text-slate-800 mb-2">Bowling Analysis</h5>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-mono font-bold uppercase">
                                    <th className="py-2 px-3">Bowler</th>
                                    <th className="py-2 px-3 text-right">O</th>
                                    <th className="py-2 px-3 text-right">M</th>
                                    <th className="py-2 px-3 text-right">R</th>
                                    <th className="py-2 px-3 text-right">W</th>
                                    <th className="py-2 px-3 text-right">Econ</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-mono">
                                  {activeSelectedMatch.innings[selectedInningsIdx].bowlers.map((bw, bwIdx) => (
                                    <tr key={bwIdx} className="hover:bg-slate-50">
                                      <td className="py-2.5 px-3 font-bold text-slate-900 font-sans">
                                        {bw.name} {bw.isSpin ? '(Spin)' : '(Seam)'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">{bw.overs}</td>
                                      <td className="py-2.5 px-3 text-right text-slate-500">{bw.maidens}</td>
                                      <td className="py-2.5 px-3 text-right text-slate-800">{bw.runs}</td>
                                      <td className="py-2.5 px-3 text-right font-bold text-indigo-700">{bw.wickets}</td>
                                      <td className="py-2.5 px-3 text-right font-bold text-slate-700">{bw.economy}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW MODE 3: QUEUE STATUS MONITOR */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'queue' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-serif font-bold text-xl text-slate-900">
                Match Retrieval Batch Queue
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pacing requests to Battrick server to securely retrieve scorecards and Batstats summaries without hitting HTTP 429 rate limits.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('matches')}
                className="text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg"
              >
                Close Queue View
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {queueItems.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <span className="text-slate-400">#{idx + 1}</span>
                  <span className="font-bold text-slate-800">Match #{item.matchId}</span>
                  {item.opponent && (
                    <span className="text-slate-500 font-sans">({item.opponent})</span>
                  )}
                  {item.date && (
                    <span className="text-slate-400">({item.date})</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'pending' && (
                    <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Pending</span>
                  )}
                  {item.status === 'fetching' && (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold flex items-center gap-1 animate-pulse">
                      <RotateCw className="w-3 h-3 animate-spin" /> Fetching
                    </span>
                  )}
                  {item.status === 'success' && (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Synced &amp; Stored
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {item.error || 'Failed'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
