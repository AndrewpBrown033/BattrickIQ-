import React, { useState, useEffect, useMemo } from 'react';
import { BattrickGame } from '../types';
import { getBattrickDateForString, getCurrentBattrickDate, isGameInNext7Days, parseGameDateToTimestamp, getNext7DaysDateRange } from '../utils/history';
import { getStoredMatches, fetchAndStoreSingleMatch } from '../utils/matchArchive';
import MatchArchiveViewer from './MatchArchiveViewer';
import GameDetailView from './GameDetailView';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import { getKnownTeamIdByName } from '../parser';
import { 
  Calendar, Search, MapPin, Trophy, Shield, Clock, Swords, 
  ArrowUpRight, FileText, BarChart3, MessageSquare, Edit3, Filter,
  CheckCircle, XCircle, HelpCircle, ExternalLink, Zap, RotateCw, Database,
  Sparkles, Layers, Bot
} from 'lucide-react';

interface FixturesDashboardProps {
  setActiveTab: (tab: any) => void;
  onSelectScoutTeam?: (teamName: string, teamId?: string) => void;
}

export default function FixturesDashboard({ setActiveTab, onSelectScoutTeam }: FixturesDashboardProps) {
  const { username: battrickUser, password: battrickPass, requireAuth, openPrompt } = useBattrickAuth();
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [filterType, setFilterType] = useState<string>('All');
  const [sectionFilter, setSectionFilter] = useState<'all' | 'upcoming' | 'previous'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [clubName, setClubName] = useState<string>('My Club');
  const [activeSubTab, setActiveSubTab] = useState<'draw' | 'archive' | 'predictor'>('draw');
  const [selectedGameForDetail, setSelectedGameForDetail] = useState<BattrickGame | null>(null);
  
  // Track stored matches map for instant badge indicator
  const [storedMatchMap, setStoredMatchMap] = useState<Record<string, any>>({});
  const [syncingMatchId, setSyncingMatchId] = useState<string | null>(null);

  const loadData = () => {
    const savedFixtures = localStorage.getItem('bt_fixtures');
    if (savedFixtures) {
      try {
        const parsed = JSON.parse(savedFixtures);
        if (Array.isArray(parsed)) {
          setFixtures(parsed);
        }
      } catch (e) {
        console.error('Failed to parse fixtures', e);
      }
    }
    
    const team = localStorage.getItem('bt_team_name');
    if (team && team !== 'My Battrick IQ Club') setClubName(team);

    setStoredMatchMap(getStoredMatches());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('bt_matches_updated', loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('bt_matches_updated', loadData);
    };
  }, []);

  const handleSyncSingleMatch = async (mId: string) => {
    if (!requireAuth(`sync match #${mId}`)) return;
    setSyncingMatchId(mId);
    try {
      await fetchAndStoreSingleMatch(mId, {
        username: battrickUser,
        password: battrickPass
      });
      loadData();
    } catch (e: any) {
      const msg = e.message || `Failed to sync match #${mId}`;
      if (e.isAuthFailure || msg.includes('Session expired') || msg.includes('re-authenticate')) {
        openPrompt();
      } else {
        alert(msg);
      }
    } finally {
      setSyncingMatchId(null);
    }
  };

  const currentBattrickDate = getCurrentBattrickDate();
  const next7DaysRange = getNext7DaysDateRange();

  const filteredFixtures = useMemo(() => {
    let filtered = fixtures;

    // Section filter (Upcoming vs Previous)
    if (sectionFilter === 'upcoming') {
      filtered = filtered.filter(f => !f.result || f.result === 'Upcoming' || f.section === 'upcoming');
    } else if (sectionFilter === 'previous') {
      filtered = filtered.filter(f => (f.result && f.result !== 'Upcoming') || f.section === 'previous');
    }

    // Format filter
    if (filterType !== 'All') {
      filtered = filtered.filter(f => f.type === filterType);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(f => 
        (f.homeTeam && f.homeTeam.toLowerCase().includes(query)) ||
        (f.awayTeam && f.awayTeam.toLowerCase().includes(query)) ||
        (f.opponent && f.opponent.toLowerCase().includes(query)) ||
        (f.matchId && f.matchId.includes(query)) ||
        (f.date && f.date.includes(query)) ||
        (f.league && f.league.toLowerCase().includes(query))
      );
    }
    
    // Sort by timestamp or season/week
    return filtered.sort((a, b) => {
      const tsA = parseGameDateToTimestamp(a.date, a.time);
      const tsB = parseGameDateToTimestamp(b.date, b.time);
      if (tsA && tsB) return tsA - tsB;

      const dateA = getBattrickDateForString(a.date);
      const dateB = getBattrickDateForString(b.date);
      if (dateA && dateB) {
        if (dateA.season !== dateB.season) return dateA.season - dateB.season;
        return dateA.week - dateB.week;
      }
      return 0;
    });
  }, [fixtures, filterType, sectionFilter, searchQuery]);

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    fixtures.forEach(f => {
      if (f.type) types.add(f.type);
    });
    return ['All', ...Array.from(types)];
  }, [fixtures]);

  const stats = useMemo(() => {
    const total = fixtures.length;
    const upcoming = fixtures.filter(f => !f.result || f.result === 'Upcoming').length;
    const won = fixtures.filter(f => f.result && f.result.toLowerCase().includes('won')).length;
    const lost = fixtures.filter(f => f.result && f.result.toLowerCase().includes('lost')).length;
    const tied = fixtures.filter(f => f.result && f.result.toLowerCase().includes('tie')).length;
    return { total, upcoming, won, lost, tied };
  }, [fixtures]);

  const getResultBadge = (result?: string) => {
    if (!result || result === 'Upcoming') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
          Upcoming
        </span>
      );
    }
    const lower = result.toLowerCase();
    if (lower.includes('won')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <CheckCircle className="w-3 h-3" />
          {result}
        </span>
      );
    }
    if (lower.includes('lost') || lower.includes('loss')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
          <XCircle className="w-3 h-3" />
          {result}
        </span>
      );
    }
    if (lower.includes('tied') || lower.includes('tie')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
          <HelpCircle className="w-3 h-3" />
          {result}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
        {result}
      </span>
    );
  };

  if (selectedGameForDetail) {
    return (
      <GameDetailView
        fixture={selectedGameForDetail}
        onBack={() => setSelectedGameForDetail(null)}
        setActiveTab={setActiveTab}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6" id="fixtures-dashboard-view">
      
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('draw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeSubTab === 'draw'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-400" />
          <span>Full Fixtures Draw ({fixtures.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('archive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeSubTab === 'archive'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4 text-indigo-400" />
          <span>Match Details &amp; Summary Archive ({Object.keys(storedMatchMap).length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('predictor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeSubTab === 'predictor'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Lineup &amp; Skill Predictor</span>
        </button>
      </div>

      {activeSubTab === 'archive' || activeSubTab === 'predictor' ? (
        <MatchArchiveViewer 
          fixtures={fixtures} 
          setActiveTab={setActiveTab} 
          onMatchSelected={(m) => {
            setSelectedGameForDetail({
              matchId: m.matchId,
              date: m.matchDate || 'Archived Game',
              opponent: m.awayTeam?.toLowerCase().includes(clubName.toLowerCase()) ? m.homeTeam : m.awayTeam,
              homeTeam: m.homeTeam,
              awayTeam: m.awayTeam,
              type: m.matchType || 'One Day',
              venue: m.homeTeam?.toLowerCase().includes(clubName.toLowerCase()) ? 'Home' : 'Away',
              result: m.result || `${m.homeTeam} vs ${m.awayTeam}`
            });
          }}
        />
      ) : (
        <>
          {/* Top Header Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Calendar className="w-6 h-6" />
                  </span>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-slate-900">
                      Fixtures Draw &amp; Match Results
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Complete match schedules, scores, lineup orders, reporter summaries &amp; Batstats links
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Record Counters & Queue Button */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('archive')}
                  className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Queue &amp; Store All Matches ({Object.keys(storedMatchMap).length} saved)</span>
                </button>

                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-center">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Total</span>
                  <span className="text-sm font-bold text-slate-800">{stats.total}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 text-center">
                  <span className="text-[10px] uppercase font-mono text-blue-600 font-bold block">Upcoming</span>
                  <span className="text-sm font-bold text-blue-700">{stats.upcoming}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-center">
                  <span className="text-[10px] uppercase font-mono text-emerald-600 font-bold block">Won</span>
                  <span className="text-sm font-bold text-emerald-700">{stats.won}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 text-center">
                  <span className="text-[10px] uppercase font-mono text-rose-600 font-bold block">Lost</span>
                  <span className="text-sm font-bold text-rose-700">{stats.lost}</span>
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Section Selector (All / Upcoming / Previous) */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setSectionFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    sectionFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Matches ({fixtures.length})
                </button>
                <button
                  onClick={() => setSectionFilter('upcoming')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    sectionFilter === 'upcoming'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upcoming ({stats.upcoming})
                </button>
                <button
                  onClick={() => setSectionFilter('previous')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    sectionFilter === 'previous'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Results / Played ({stats.won + stats.lost + stats.tied})
                </button>
              </div>

              {/* Search Input & Format Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search opponent or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto">
                  {uniqueTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                        filterType === type 
                          ? 'bg-slate-900 text-white shadow-xs' 
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fixtures Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {fixtures.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/50">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-slate-900 font-bold text-lg mb-1">No Club Fixtures Imported</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-5">
                  Copy your Battrick Club fixtures page (from Previous Matches to Upcoming Matches) and paste it into the Sync Hub to view your full draw, match URLs, and lined up skills.
                </p>
                <button
                  onClick={() => setActiveTab('sync')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs font-mono uppercase tracking-wider px-5 py-2.5 rounded-xl transition shadow-sm"
                >
                  Open Sync Hub
                </button>
              </div>
            ) : filteredFixtures.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-500">
                <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No matches match your active filter.</p>
                <button
                  onClick={() => { setFilterType('All'); setSectionFilter('all'); setSearchQuery(''); }}
                  className="mt-2 text-xs text-blue-600 hover:underline font-mono font-bold"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                      <th className="py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider">Date &amp; Time</th>
                      <th className="py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider">Matchup</th>
                      <th className="py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider">Format / League</th>
                      <th className="py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider">Match Links &amp; Tools</th>
                      <th className="py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider text-right">Result &amp; Archive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFixtures.map((game, idx) => {
                      const bDate = getBattrickDateForString(game.date);
                      const is7Days = isGameInNext7Days(game.date, game.time);
                      const isCurrentWeek = bDate && bDate.season === currentBattrickDate.season && bDate.week === currentBattrickDate.week;
                      
                      const isStored = Boolean(game.matchId && storedMatchMap[game.matchId]);
                      const isSyncingThis = syncingMatchId === game.matchId;
                      const isPlayedGame = Boolean(game.result && game.result !== 'Upcoming');

                      const matchInfoUrl = game.matchUrl || (game.matchId ? `https://www.battrick.org/nl/matchinfo.asp?matchID=${game.matchId}` : undefined);
                      const summaryUrl = game.summaryUrl || (game.matchId ? `https://www.battrick.org/nl/matchinfo.asp?matchID=${game.matchId}&action=summary` : undefined);
                      const graphsUrl = game.graphsUrl || (game.matchId ? `https://www.battrick.org/nl/matchgraphs.asp?matchID=${game.matchId}` : undefined);
                      const commentaryUrl = game.commentaryUrl || (game.matchId ? `https://www.battrick.org/nl/matchcomms.asp?matchID=${game.matchId}` : undefined);
                      const ordersUrl = game.ordersUrl || (game.matchId ? `https://www.battrick.org/nl/matchorders.asp?matchID=${game.matchId}` : undefined);
                      
                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-slate-50/80 transition ${
                            is7Days ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          {/* Date & Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {game.date}
                              </span>
                              {game.time && (
                                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {game.time}
                                </span>
                              )}
                              {is7Days && (
                                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded w-max">
                                  Next 7 Days
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Matchup Teams */}
                          <td className="py-3.5 px-4 align-top">
                            {(() => {
                              const homeName = game.homeTeam || (game.venue === 'Home' ? clubName : (game.opponent || 'Home Team'));
                              const awayName = game.awayTeam || (game.venue === 'Away' ? clubName : (game.opponent || 'Away Team'));
                              
                              const homeId = game.homeTeamId || (game.venue === 'Away' ? game.opponentTeamId : undefined) || getKnownTeamIdByName(homeName) || '';
                              const awayId = game.awayTeamId || (game.venue === 'Home' ? game.opponentTeamId : undefined) || getKnownTeamIdByName(awayName) || '';

                              // My team is whichever side matches this fixture's venue - never the scout target.
                              const isHomeMyTeam = game.venue === 'Home';
                              const isAwayMyTeam = game.venue === 'Away';
                              const myTeamId = isHomeMyTeam ? homeId : awayId;

                              const handleScoutTeam = (teamName: string, teamId: string, targetVenue?: 'Home' | 'Away') => {
                                const resolvedTeamId = teamId || getKnownTeamIdByName(teamName) || '';
                                localStorage.setItem('bt_scout_target_team', JSON.stringify({
                                  teamName,
                                  teamId: resolvedTeamId,
                                  matchId: game.matchId,
                                  type: game.type,
                                  venue: targetVenue || game.venue,
                                  myTeamId
                                }));
                                window.dispatchEvent(new CustomEvent('bt_scout_target_updated', {
                                  detail: { teamName, teamId: resolvedTeamId }
                                }));
                                window.dispatchEvent(new Event('storage'));
                                if (onSelectScoutTeam) {
                                  onSelectScoutTeam(teamName, resolvedTeamId);
                                }
                                setActiveTab('scout');
                              };

                              return (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isHomeMyTeam ? (
                                      <span
                                        className="text-sm font-extrabold text-blue-900 flex items-center gap-1.5"
                                        title={`${homeName} is your team${homeId ? ` (Team ID: ${homeId})` : ''} \u2014 not scoutable`}
                                      >
                                        <span>{homeName}</span>
                                        {homeId && <span className="text-[10.5px] font-mono text-slate-400 font-medium">({homeId})</span>}
                                        <span className="text-[9px] uppercase tracking-wider font-bold text-blue-500">You</span>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleScoutTeam(homeName, homeId, 'Home')}
                                        className="text-sm font-bold text-slate-800 transition hover:text-indigo-600 hover:underline cursor-pointer flex items-center gap-1.5 text-left"
                                        title={`Click to scout ${homeName}${homeId ? ` (Team ID: ${homeId})` : ''}`}
                                      >
                                        <span>{homeName}</span>
                                        {homeId && <span className="text-[10.5px] font-mono text-slate-400 font-medium">({homeId})</span>}
                                      </button>
                                    )}
                                    
                                    <span className="text-xs text-slate-400 font-mono font-bold">v</span>
                                    
                                    {isAwayMyTeam ? (
                                      <span
                                        className="text-sm font-extrabold text-blue-900 flex items-center gap-1.5"
                                        title={`${awayName} is your team${awayId ? ` (Team ID: ${awayId})` : ''} \u2014 not scoutable`}
                                      >
                                        <span>{awayName}</span>
                                        {awayId && <span className="text-[10.5px] font-mono text-slate-400 font-medium">({awayId})</span>}
                                        <span className="text-[9px] uppercase tracking-wider font-bold text-blue-500">You</span>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleScoutTeam(awayName, awayId, 'Away')}
                                        className="text-sm font-bold text-slate-800 transition hover:text-indigo-600 hover:underline cursor-pointer flex items-center gap-1.5 text-left"
                                        title={`Click to scout ${awayName}${awayId ? ` (Team ID: ${awayId})` : ''}`}
                                      >
                                        <span>{awayName}</span>
                                        {awayId && <span className="text-[10.5px] font-mono text-slate-400 font-medium">({awayId})</span>}
                                      </button>
                                    )}

                                    {game.isBot && (
                                      <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded" title="This team is unmanaged (bot)">
                                        BOT
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      <span className={`font-medium ${game.venue === 'Home' ? 'text-blue-700 font-bold' : ''}`}>
                                        {game.venue} Match
                                      </span>
                                    </div>
                                    {game.matchId && (
                                      <span className="font-mono text-[10.5px] text-slate-400">
                                        ID: {game.matchId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>

                          {/* Format & League */}
                          <td className="py-3.5 px-4 whitespace-nowrap align-top">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium w-max">
                                {game.type}
                              </span>
                              {game.league && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {game.league}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Match Links & Action Tools */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center gap-2 flex-wrap">
                              {matchInfoUrl && (
                                <a
                                  href={matchInfoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-200/60 transition"
                                  title="Open Official Match Info"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Match
                                </a>
                              )}

                              {summaryUrl && (
                                <a
                                  href={summaryUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200/60 transition"
                                  title="Reporter's Summary & Batstats (Skills Lined Up)"
                                >
                                  <FileText className="w-3 h-3" />
                                  Summary &amp; Batstats
                                </a>
                              )}

                              {graphsUrl && (
                                <a
                                  href={graphsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
                                  title="Match Graphs"
                                >
                                  <BarChart3 className="w-3 h-3" />
                                  Graphs
                                </a>
                              )}

                              {commentaryUrl && (
                                <a
                                  href={commentaryUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
                                  title="Match Commentary"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  Comms
                                </a>
                              )}

                              {ordersUrl && (!game.result || game.result === 'Upcoming') && (
                                <a
                                  href={ordersUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                                  title="Submit Match Orders"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  Orders
                                </a>
                              )}

                              <button 
                                type="button"
                                onClick={() => setSelectedGameForDetail(game)}
                                className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
                                title="Drill into match view, fetch opponent player details, and ask Jarvis AI"
                              >
                                <Bot className="w-3.5 h-3.5 text-indigo-200" />
                                <span>Drill Into Game &amp; Jarvis</span>
                              </button>

                              <button 
                                type="button"
                                onClick={() => {
                                  const resolvedTeamId = game.opponentTeamId || getKnownTeamIdByName(game.opponent) || '';
                                  localStorage.setItem('bt_scout_target_team', JSON.stringify({
                                    teamName: game.opponent,
                                    teamId: resolvedTeamId,
                                    matchId: game.matchId,
                                    type: game.type,
                                    venue: game.venue
                                  }));
                                  window.dispatchEvent(new CustomEvent('bt_scout_target_updated', {
                                    detail: { teamName: game.opponent, teamId: resolvedTeamId }
                                  }));
                                  window.dispatchEvent(new Event('storage'));
                                  if (onSelectScoutTeam) {
                                    onSelectScoutTeam(game.opponent, resolvedTeamId);
                                  }
                                  setActiveTab('scout');
                                }}
                                className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition cursor-pointer"
                                title="Scout this opponent's ratings & weaknesses"
                              >
                                <Swords className="w-3 h-3" />
                                Scout
                              </button>
                            </div>
                          </td>

                          {/* Result & Scorecard/Summary Archive Status */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                            <div className="flex flex-col items-end gap-1.5">
                              {getResultBadge(game.result)}
                              
                              {game.matchId && isPlayedGame && (
                                <div>
                                  {isStored ? (
                                    <button
                                      type="button"
                                      onClick={() => setActiveSubTab('archive')}
                                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition"
                                      title="Click to view stored scorecard & ratings in Archive"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      Scorecard &amp; Summary Stored
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isSyncingThis}
                                      onClick={() => handleSyncSingleMatch(game.matchId!)}
                                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded cursor-pointer transition"
                                      title="Fetch scorecard & summary from Battrick and store it"
                                    >
                                      {isSyncingThis ? (
                                        <>
                                          <RotateCw className="w-3 h-3 animate-spin" />
                                          Syncing...
                                        </>
                                      ) : (
                                        <>
                                          <Zap className="w-3 h-3 text-indigo-500" />
                                          Sync Details &amp; Summary
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
