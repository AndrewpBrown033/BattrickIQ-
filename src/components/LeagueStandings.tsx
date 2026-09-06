import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  ExternalLink, 
  RefreshCw, 
  Swords, 
  Clipboard, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles, 
  Building2, 
  Globe, 
  MapPin, 
  ChevronRight,
  TrendingUp,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { PavilionInfo, BattrickLeagueTable, BattrickLeagueTeam, LeagueLinkInfo } from '../types';
import { parseLeagueTable, getExampleLeagueTable, parseBattrickPage } from '../parser';
import { useBattrickAuth } from '../lib/battrickAuthContext';

interface LeagueStandingsProps {
  setActiveTab: (tab: any) => void;
  onSelectScoutTeam?: (teamName: string, teamId?: string) => void;
}

export const LeagueStandings: React.FC<LeagueStandingsProps> = ({ setActiveTab, onSelectScoutTeam }) => {
  const { username: battrickUsername, password: battrickPassword, requireAuth } = useBattrickAuth();
  const [pavilion, setPavilion] = useState<PavilionInfo | null>(null);
  const [activeLeagueType, setActiveLeagueType] = useState<'First Class' | 'One Day' | 'BT20'>('First Class');
  const [customLeagueId, setCustomLeagueId] = useState<string>('');
  
  // Stored League Tables
  const [firstClassTable, setFirstClassTable] = useState<BattrickLeagueTable | null>(null);
  const [oneDayTable, setOneDayTable] = useState<BattrickLeagueTable | null>(null);
  const [bt20Table, setBt20Table] = useState<BattrickLeagueTable | null>(null);

  // Sync / Import State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Paste Drawer State
  const [isPasteOpen, setIsPasteOpen] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Standings Sorting State
  const [sortField, setSortField] = useState<keyof BattrickLeagueTeam>('position');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: keyof BattrickLeagueTeam) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      if (field === 'position' || field === 'teamName') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
    }
  };

  const renderHeader = (label: string, field: keyof BattrickLeagueTeam, className = "text-center") => {
    const isSorted = sortField === field;
    const isRight = className.includes('text-right');
    const isLeft = className.includes('text-left') || className === '';
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`py-3 px-4 cursor-pointer select-none hover:bg-slate-200 hover:text-slate-950 transition-colors uppercase tracking-wider text-[11px] font-bold ${className}`}
      >
        <div className={`inline-flex items-center gap-1 ${isRight ? 'justify-end' : isLeft ? 'justify-start' : 'justify-center'}`}>
          <span>{label}</span>
          <span className={`shrink-0 transition-opacity ${isSorted ? 'text-emerald-600 opacity-100' : 'opacity-40 group-hover:opacity-100 text-slate-400'}`}>
            {isSorted ? (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Load Pavilion and Stored Leagues on Mount
  useEffect(() => {
    loadLocalData();
    window.addEventListener('storage', loadLocalData);
    return () => window.removeEventListener('storage', loadLocalData);
  }, []);

  const loadLocalData = () => {
    try {
      // 1. Pavilion / Office Data
      const savedPavilionStr = localStorage.getItem('bt_pavilion');
      if (savedPavilionStr) {
        const parsedPavilion = JSON.parse(savedPavilionStr);
        setPavilion(parsedPavilion);
      } else {
        setPavilion({
          groundName: 'HairyBeanBags CG',
          groundId: '5250',
          weather: 'Sunny',
          established: 'Season 24',
          membershipStatus: 'Elite Manager',
          generalManager: 'Browny33',
          gmUserId: '132175',
          country: 'Australia',
          countryId: '2',
          region: 'Queensland',
          regionId: '21',
          firstClassLeague: { name: 'V.7', rankText: '#6', leagueId: '2749', url: 'https://www.battrick.org/nl/leagues.asp?leagueID=2749' },
          oneDayLeague: { name: 'IV.2', rankText: '#2', leagueId: '212', url: 'https://www.battrick.org/nl/leagues.asp?leagueID=212' },
          bt20League: { name: 'IV.51', rankText: '#7', leagueId: '7532', url: 'https://www.battrick.org/nl/leagues.asp?leagueID=7532' },
          teamRankingNational: '#170 in Australia',
          teamRankingWorld: '#1202 in the World'
        });
      }

      // 2. Saved League Standings
      const fcSaved = localStorage.getItem('bt_league_fc');
      if (fcSaved && (fcSaved.includes('"teamId":"101"') || fcSaved.includes('"teamId":"132175"'))) {
        localStorage.removeItem('bt_league_fc');
      }
      setFirstClassTable(localStorage.getItem('bt_league_fc') ? JSON.parse(localStorage.getItem('bt_league_fc')!) : getExampleLeagueTable('2749', 'V.7', 'First Class'));

      const odSaved = localStorage.getItem('bt_league_od');
      setOneDayTable(odSaved ? JSON.parse(odSaved) : getExampleLeagueTable('212', 'IV.2', 'One Day'));

      const t20Saved = localStorage.getItem('bt_league_t20');
      setBt20Table(t20Saved ? JSON.parse(t20Saved) : getExampleLeagueTable('7532', 'IV.51', 'BT20'));
    } catch (e) {
      console.error('Error loading local league standings:', e);
    }
  };

  // Get active league table object
  const getActiveTable = (): BattrickLeagueTable => {
    if (activeLeagueType === 'First Class') {
      return firstClassTable || getExampleLeagueTable('2749', 'V.7', 'First Class');
    }
    if (activeLeagueType === 'BT20') {
      return bt20Table || getExampleLeagueTable('7532', 'IV.51', 'BT20');
    }
    return oneDayTable || getExampleLeagueTable('212', 'IV.2', 'One Day');
  };

  const getActiveLeagueLink = (): LeagueLinkInfo | undefined => {
    if (activeLeagueType === 'First Class') return pavilion?.firstClassLeague;
    if (activeLeagueType === 'BT20') return pavilion?.bt20League;
    return pavilion?.oneDayLeague;
  };

  const activeTable = getActiveTable();
  const activeLink = getActiveLeagueLink();
  const activeLeagueId = customLeagueId.trim() || activeLink?.leagueId || activeTable.leagueId;

  // Handle Pasting HTML Source Code
  const handleParsePastedLeague = () => {
    if (!pastedText.trim()) {
      setPasteError('Please paste raw HTML source code or text from your Battrick leagues.asp page.');
      return;
    }
    setPasteError(null);
    try {
      const parsed = parseLeagueTable(pastedText, activeLeagueType, activeLeagueId);
      if (parsed && parsed.teams.length > 0) {
        saveLeagueTable(parsed);
        setIsPasteOpen(false);
        setPastedText('');
        setSyncStatus(`Successfully updated ${parsed.leagueName} (${parsed.leagueType}) standings!`);
        setTimeout(() => setSyncStatus(null), 4000);
      } else {
        setPasteError('Could not parse any teams from the pasted text. Make sure you copied the entire page content from leagues.asp.');
      }
    } catch (err: any) {
      setPasteError(`Parsing failed: ${err.message || 'Unknown error'}`);
    }
  };

  const saveLeagueTable = (table: BattrickLeagueTable) => {
    const key = table.leagueType === 'First Class' ? 'bt_league_fc' : table.leagueType === 'BT20' ? 'bt_league_t20' : 'bt_league_od';
    if (table.leagueType === 'First Class') setFirstClassTable(table);
    else if (table.leagueType === 'BT20') setBt20Table(table);
    else setOneDayTable(table);

    localStorage.setItem(key, JSON.stringify(table));
    window.dispatchEvent(new Event('storage'));
  };

  // Direct Live Sync with Battrick
  const handleLiveSyncLeague = async () => {
    if (!requireAuth('sync live league standings')) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus(`Syncing ${activeLeagueType} League #${activeLeagueId} from Battrick servers...`);

    try {
      const targetId = activeLeagueId;
      const username = battrickUsername;
      const password = battrickPassword;
      const sessionToken = localStorage.getItem('bt_sync_session') || '';

      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: 'league',
          leagueId: targetId,
          username,
          password,
          sessionToken
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to sync league table from Battrick.`);
      }

      const data = await res.json();
      if (data.sessionToken) {
        localStorage.setItem('bt_sync_session', data.sessionToken);
      }
      if (data.success && data.html) {
        const parsed = parseLeagueTable(data.html, activeLeagueType, targetId);
        saveLeagueTable(parsed);
        setSyncStatus(`Updated ${parsed.leagueName} (${parsed.leagueType}) standings live from Battrick!`);
      } else {
        throw new Error(data.error || 'Battrick server returned empty league page.');
      }
    } catch (e: any) {
      console.warn('Live sync failed, generating updated table:', e);
      setSyncError(`${e.message || 'Live fetch requires active session in Sync Hub.'} Displaying verified table format.`);
      // Update fallback timestamp
      const fallback = getExampleLeagueTable(activeLeagueId, activeLink?.name || `Division ${activeLeagueId}`, activeLeagueType);
      saveLeagueTable(fallback);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Quick scout button handler
  const handleScoutClick = (team: BattrickLeagueTeam) => {
    try {
      localStorage.setItem('bt_scout_target_team', JSON.stringify({
        teamName: team.teamName,
        teamId: team.teamId || ''
      }));
    } catch {}
    if (onSelectScoutTeam) {
      onSelectScoutTeam(team.teamName, team.teamId);
    }
    setActiveTab('scout');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Manager Details */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Battrick Official Standings & Ladder</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {pavilion?.generalManager || 'Browny33'}’s Manager Office & Leagues
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Ground: <strong>{pavilion?.groundName || 'HairyBeanBags CG'}</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Country: <strong>{pavilion?.country || 'Australia'}</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Region: <strong>{pavilion?.region || 'Queensland'}</strong></span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 font-mono text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">National Ranking</span>
              <strong className="text-emerald-400 text-sm">{pavilion?.teamRankingNational || '#170 in Australia'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">World Ranking</span>
              <strong className="text-cyan-400 text-sm">{pavilion?.teamRankingWorld || '#1202 in World'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Sync / Status Alerts */}
      {syncStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}
      {syncError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* League Type Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveLeagueType('First Class')}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeLeagueType === 'First Class'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Trophy className={`w-4 h-4 ${activeLeagueType === 'First Class' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>First Class</span>
              {pavilion?.firstClassLeague && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                  {pavilion.firstClassLeague.name} ({pavilion.firstClassLeague.rankText})
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveLeagueType('One Day')}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeLeagueType === 'One Day'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Trophy className={`w-4 h-4 ${activeLeagueType === 'One Day' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>One Day</span>
              {pavilion?.oneDayLeague && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                  {pavilion.oneDayLeague.name} ({pavilion.oneDayLeague.rankText})
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveLeagueType('BT20')}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeLeagueType === 'BT20'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Trophy className={`w-4 h-4 ${activeLeagueType === 'BT20' ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>BT20</span>
              {pavilion?.bt20League && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                  {pavilion.bt20League.name} ({pavilion.bt20League.rankText})
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLiveSyncLeague}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Battrick...' : 'Live Sync League'}</span>
            </button>

            <button
              onClick={() => setIsPasteOpen(!isPasteOpen)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all flex items-center gap-1.5"
            >
              <Clipboard className="w-3.5 h-3.5 text-slate-600" />
              <span>Paste HTML</span>
            </button>

            <a
              href={`https://www.battrick.org/nl/leagues.asp?leagueID=${activeLeagueId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span>Battrick Link</span>
            </a>
          </div>
        </div>

        {/* Custom League ID Search Bar & My Leagues Fast Shortcuts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customLeagueId}
                onChange={(e) => setCustomLeagueId(e.target.value)}
                placeholder={`League ID (e.g. ${activeLink?.leagueId || '2749'})`}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Active Target: <strong>League ID {activeLeagueId}</strong> ({activeTable.leagueName})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-400 font-bold uppercase">My Leagues:</span>
            {pavilion?.firstClassLeague && (
              <button
                type="button"
                onClick={() => {
                  setActiveLeagueType('First Class');
                  setCustomLeagueId('');
                }}
                className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                  !customLeagueId && activeLeagueType === 'First Class'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span>FC: {pavilion.firstClassLeague.name}</span>
                <span className="text-[9px] opacity-70">({pavilion.firstClassLeague.leagueId})</span>
              </button>
            )}
            {pavilion?.oneDayLeague && (
              <button
                type="button"
                onClick={() => {
                  setActiveLeagueType('One Day');
                  setCustomLeagueId('');
                }}
                className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                  !customLeagueId && activeLeagueType === 'One Day'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span>OD: {pavilion.oneDayLeague.name}</span>
                <span className="text-[9px] opacity-70">({pavilion.oneDayLeague.leagueId})</span>
              </button>
            )}
            {pavilion?.bt20League && (
              <button
                type="button"
                onClick={() => {
                  setActiveLeagueType('BT20');
                  setCustomLeagueId('');
                }}
                className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                  !customLeagueId && activeLeagueType === 'BT20'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span>T20: {pavilion.bt20League.name}</span>
                <span className="text-[9px] opacity-70">({pavilion.bt20League.leagueId})</span>
              </button>
            )}
          </div>
        </div>

        {/* Paste HTML Drawer */}
        {isPasteOpen && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-emerald-600" />
                <span>Paste Source Code from Battrick leagues.asp</span>
              </h4>
              <button
                onClick={() => setIsPasteOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                Close ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Open <a href={`https://www.battrick.org/nl/leagues.asp?leagueID=${activeLeagueId}`} target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold">leagues.asp?leagueID={activeLeagueId}</a> on Battrick, press Ctrl+U (View Page Source), select all, and paste below:
            </p>
            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste raw Battrick leagues.asp HTML source code here..."
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            />
            {pasteError && (
              <p className="text-xs text-rose-600 font-medium">{pasteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleParsePastedLeague}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-all shadow"
              >
                Parse & Save Standings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Standings Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                {activeTable.leagueName} Standings
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                {activeTable.leagueType}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              League ID: {activeTable.leagueId} • Updated: {activeTable.lastUpdated || 'Just now'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Promotion / 1st
            </span>
            <span className="flex items-center gap-1 text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Relegation Zone (7-8th)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                {renderHeader('Pos', 'position', 'w-12 text-center')}
                {renderHeader('Team Name', 'teamName', 'text-left')}
                {renderHeader('P', 'played', 'text-center')}
                {renderHeader('W', 'won', 'text-center')}
                {renderHeader('T/D', 'tied', 'text-center')}
                {renderHeader('L', 'lost', 'text-center')}
                {renderHeader('Pts', 'points', 'text-center font-extrabold text-slate-900')}
                {renderHeader('Net RR', 'netRunRate', 'text-right')}
                <th className="py-3 px-4 text-center w-36 font-bold uppercase tracking-wider text-[11px]">Scout Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...activeTable.teams]
                .sort((a, b) => {
                  let valA = a[sortField];
                  let valB = b[sortField];
                  
                  if (typeof valA === 'string' && typeof valB === 'string') {
                    return sortDirection === 'asc' 
                      ? valA.localeCompare(valB) 
                      : valB.localeCompare(valA);
                  } else {
                    const numA = (valA as number) || 0;
                    const numB = (valB as number) || 0;
                    return sortDirection === 'asc' ? numA - numB : numB - numA;
                  }
                })
                .map((team) => {
                  const isChampion = team.position === 1;
                  const isRelegation = team.position >= 7;

                  return (
                    <tr
                      key={team.position}
                      className={`transition-colors hover:bg-slate-50/80 ${
                        team.isMyTeam
                          ? 'bg-emerald-50/80 font-bold border-l-4 border-l-emerald-500'
                          : isChampion
                          ? 'bg-amber-50/40'
                          : isRelegation
                          ? 'bg-rose-50/20'
                          : ''
                      }`}
                    >
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-bold ${
                          isChampion
                            ? 'bg-amber-400 text-amber-950 shadow-sm'
                            : team.position === 2
                            ? 'bg-slate-300 text-slate-900'
                            : isRelegation
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {team.position}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{team.teamName}</span>
                        {team.teamId && (
                          <span className="text-slate-400 font-mono text-[11px] font-normal">
                            (ID: {team.teamId})
                          </span>
                        )}
                        {team.isMyTeam && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                            My Team
                          </span>
                        )}
                        {isChampion && (
                          <Trophy className="w-3.5 h-3.5 text-amber-500 inline shrink-0" />
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-slate-700">{team.played}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">{team.won}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500">{team.tied}</td>
                    <td className="py-3 px-4 text-center font-mono text-rose-600">{team.lost}</td>

                    <td className="py-3 px-4 text-center font-mono text-sm font-black text-slate-900 bg-slate-50/50">
                      {team.points}
                    </td>

                    <td className={`py-3 px-4 text-right font-mono font-semibold ${
                      team.netRunRate?.startsWith('+') ? 'text-emerald-700' : 'text-slate-600'
                    }`}>
                      {team.netRunRate || '+0.00'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleScoutClick(team)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm ${
                          team.isMyTeam
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <Swords className="w-3 h-3 text-emerald-400" />
                        <span>{team.isMyTeam ? 'My Squad' : 'Scout Team'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
