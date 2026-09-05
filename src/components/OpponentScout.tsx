import React, { useState, useEffect, useMemo } from 'react';
import { 
  BattrickPlayer, 
  BattrickGame, 
  PitchType, 
  WeatherType, 
  MatchFormat, 
  OpponentPlayer, 
  OpponentScoutDossier,
  ParsedBattrickMatch,
  SKILL_LEVELS,
  getSkillLabel
} from '../types';
import { 
  parseOpponentSquad, 
  generateOpponentScoutDossier, 
  generateRealisticOpponentRoster,
  parseBattrickFullMatch, 
  getExampleMatchData,
  getExampleMatchDataById,
  parseFixtures,
  TEST_MATCHES
} from '../parser';
import { 
  ShieldAlert, 
  Target, 
  Swords, 
  Flame, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Zap, 
  ArrowRight, 
  FileText, 
  Copy, 
  ChevronRight, 
  BarChart3, 
  Search, 
  ExternalLink, 
  Bot, 
  Percent,
  Calendar,
  CalendarDays,
  HelpCircle,
  Info,
  ListOrdered,
  Calculator,
  UserCheck,
  RefreshCw
} from 'lucide-react';

interface OpponentScoutProps {
  setActiveTab: (tab: any) => void;
}

const normalizeMatchFormat = (type?: string): MatchFormat => {
  if (!type) return 'One Day';
  if (type.toLowerCase().includes('first class')) return 'First Class';
  if (type.toLowerCase().includes('twenty20') || type.toLowerCase().includes('t20')) return 'Twenty20';
  return 'One Day';
};

export default function OpponentScout({ setActiveTab }: OpponentScoutProps) {
  // Navigation Sub-tab: match_analyzer | fixtures_scout | dossier
  const [activeSubTab, setActiveSubTab] = useState<'match_analyzer' | 'fixtures_scout' | 'dossier'>('match_analyzer');

  // 1. My Squad Context
  const [mySquad, setMySquad] = useState<BattrickPlayer[]>([]);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [myTeamName, setMyTeamName] = useState<string>('My Club');

  // 2. Selected Opponent & Match Settings
  const [opponentName, setOpponentName] = useState<string>('Steve');
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('One Day');
  const [pitch, setPitch] = useState<PitchType>('Green');
  const [weather, setWeather] = useState<WeatherType>('Overcast');
  const [venue, setVenue] = useState<'Home' | 'Away'>('Home');

  // 3. Opponent Squad Data
  const [opponentPlayers, setOpponentPlayers] = useState<OpponentPlayer[]>(() => generateRealisticOpponentRoster('Steve', false, 'One Day'));
  const [pastedText, setPastedText] = useState<string>('');
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // 4. Fixtures Parsing Drawer
  const [isFixturesPasteOpen, setIsFixturesPasteOpen] = useState<boolean>(false);
  const [pastedFixturesText, setPastedFixturesText] = useState<string>('');

  // 5. Match & Summary Intelligence State
  const [matchIdInput, setMatchIdInput] = useState<string>('32554717');
  const [pastedMatchText, setPastedMatchText] = useState<string>('');
  const [activeParsedMatch, setActiveParsedMatch] = useState<ParsedBattrickMatch>(() => getExampleMatchData());
  const [selectedTeamTab, setSelectedTeamTab] = useState<'home' | 'away'>('away');
  const [isFetchingMatch, setIsFetchingMatch] = useState<boolean>(false);
  const [fetchingMatchId, setFetchingMatchId] = useState<string | null>(null);
  const [fetchStatusMessage, setFetchStatusMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Load user data on mount
  useEffect(() => {
    try {
      const savedSquad = localStorage.getItem('bt_squad');
      if (savedSquad) setMySquad(JSON.parse(savedSquad));

      const savedFixtures = localStorage.getItem('bt_fixtures');
      let loadedFixtures: BattrickGame[] = [];
      if (savedFixtures) {
        loadedFixtures = JSON.parse(savedFixtures);
        setFixtures(loadedFixtures);
      } else {
        // Populate default user fixtures from real schedule
        loadedFixtures = parseFixtures('');
        setFixtures(loadedFixtures);
      }

      if (loadedFixtures.length > 0) {
        const firstGame = loadedFixtures[0];
        setOpponentName(firstGame.opponent);
        setMatchFormat(normalizeMatchFormat(firstGame.type));
        setVenue(firstGame.venue);
        if (firstGame.matchId) setMatchIdInput(firstGame.matchId);
        setOpponentPlayers(generateRealisticOpponentRoster(firstGame.opponent, firstGame.isBot, normalizeMatchFormat(firstGame.type)));
      }

      const savedName = localStorage.getItem('bt_team_name');
      if (savedName) setMyTeamName(savedName);

      const savedPavilion = localStorage.getItem('bt_pavilion');
      if (savedPavilion) {
        const pav = JSON.parse(savedPavilion);
        if (pav.pitchType) {
          const pt = pav.pitchType.trim();
          if (['Flat', 'Hard', 'Green', 'Dusty', 'Cracked', 'Uneven'].includes(pt)) {
            setPitch(pt as PitchType);
          }
        }
      }
    } catch (e) {
      console.error('Error loading local data for opponent scout:', e);
    }
  }, []);

  // Compute My Squad average BTR
  const myAvgBtr = useMemo(() => {
    if (mySquad.length === 0) return 26000;
    const sorted = [...mySquad].sort((a, b) => b.btRating - a.btRating).slice(0, 11);
    return Math.round(sorted.reduce((acc, p) => acc + p.btRating, 0) / sorted.length);
  }, [mySquad]);

  // Compute Opponent Scout Dossier
  const dossier: OpponentScoutDossier = useMemo(() => {
    return generateOpponentScoutDossier(opponentPlayers, opponentName, pitch, weather, matchFormat, myAvgBtr);
  }, [opponentPlayers, opponentName, pitch, weather, matchFormat, myAvgBtr]);

  // Handle parsing pasted opponent squad text
  const handleParseOpponent = () => {
    if (!pastedText.trim()) return;
    const parsed = parseOpponentSquad(pastedText, opponentName);
    if (parsed.length > 0) {
      setOpponentPlayers(parsed);
      setIsInputOpen(false);
      setPastedText('');
    } else {
      alert('Could not detect valid Battrick player statistics. Please copy the text directly from the squad or scorecard page.');
    }
  };

  // Handle parsing pasted fixtures list HTML / text
  const handleParsePastedFixtures = () => {
    if (!pastedFixturesText.trim()) return;
    const parsed = parseFixtures(pastedFixturesText);
    if (parsed.length > 0) {
      setFixtures(parsed);
      setIsFixturesPasteOpen(false);
      setPastedFixturesText('');
      const first = parsed[0];
      setOpponentName(first.opponent);
      setMatchFormat(normalizeMatchFormat(first.type));
      setOpponentPlayers(generateRealisticOpponentRoster(first.opponent, first.isBot, normalizeMatchFormat(first.type)));
    } else {
      alert('Could not detect fixture items. Please paste the HTML snippet or text from your Upcoming Matches page.');
    }
  };

  // Handle fixture opponent selection
  const handleSelectFixtureOpponent = (key: string) => {
    setOpponentName(key);
    const matched = fixtures.find(f => f.opponent.toLowerCase() === key.toLowerCase());
    if (matched) {
      setMatchFormat(normalizeMatchFormat(matched.type));
      setVenue(matched.venue);
      if (matched.matchId) setMatchIdInput(matched.matchId);
      setOpponentPlayers(generateRealisticOpponentRoster(matched.opponent, matched.isBot, normalizeMatchFormat(matched.type)));
    } else {
      setOpponentPlayers(generateRealisticOpponentRoster(key, false, matchFormat));
    }
  };

  // Handle parsing match scorecard and summary text
  const handleParseMatchData = () => {
    if (!pastedMatchText.trim()) {
      const example = getExampleMatchDataById(matchIdInput || '32554717');
      setActiveParsedMatch(example);
      return;
    }
    const parsed = parseBattrickFullMatch(pastedMatchText, matchIdInput);
    setActiveParsedMatch(parsed);
    setPastedMatchText('');
  };

  // 1-Click test match selector
  const handleSelectMatchExample = (mId: string) => {
    setMatchIdInput(mId);
    const matchData = getExampleMatchDataById(mId);
    setActiveParsedMatch(matchData);
    if (matchData.matchType.toLowerCase().includes('first class')) {
      setMatchFormat('First Class');
    } else if (matchData.matchType.toLowerCase().includes('twenty20')) {
      setMatchFormat('Twenty20');
    } else {
      setMatchFormat('One Day');
    }
    if (['Green', 'Hard', 'Dusty', 'Flat', 'Uneven', 'Cracked'].includes(matchData.pitch)) {
      setPitch(matchData.pitch as PitchType);
    }
    if (['Overcast', 'Sunny', 'Humid', 'Windy', 'Partially Cloudy'].includes(matchData.weather)) {
      setWeather(matchData.weather === 'Partially Cloudy' ? 'Overcast' : (matchData.weather as WeatherType));
    }
  };

  // Quick scout action directly from fixture list
  const handleScoutFixtureOpponent = (game: BattrickGame) => {
    setOpponentName(game.opponent);
    setMatchFormat(normalizeMatchFormat(game.type));
    setVenue(game.venue);

    if (game.matchId) {
      setMatchIdInput(game.matchId);
    }
    setOpponentPlayers(generateRealisticOpponentRoster(game.opponent, game.isBot, normalizeMatchFormat(game.type)));
    setActiveSubTab('dossier');
  };

  const handleAnalyzeFixtureMatch = (game: BattrickGame) => {
    if (game.matchId) {
      setMatchIdInput(game.matchId);
      const matchData = getExampleMatchDataById(game.matchId);
      setActiveParsedMatch(matchData);
    }
    setActiveSubTab('match_analyzer');
  };

  // Direct Live Sync for any Battrick Match ID (Fetches matchinfo & match summary)
  const handleDirectFetchMatch = async (targetMatchIdInput?: string) => {
    const targetMatchId = (targetMatchIdInput || matchIdInput || '').trim();
    if (!targetMatchId) {
      setFetchError('Please provide a valid Battrick Match ID (e.g. 32557622, 32554717).');
      return;
    }

    setIsFetchingMatch(true);
    setFetchingMatchId(targetMatchId);
    setFetchError(null);
    setFetchStatusMessage(`Connecting to Battrick server and fetching Match #${targetMatchId}...`);

    // Notify app-wide sync indicator
    try {
      window.dispatchEvent(new Event('bt_datasync_start'));
    } catch {
      // ignore
    }

    try {
      const username = localStorage.getItem('bt_direct_user') || '';
      const password = localStorage.getItem('bt_direct_pass') || '';
      const sessionToken = localStorage.getItem('bt_sync_session') || '';

      const response = await fetch('/api/sync-battrick-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: targetMatchId,
          username,
          password,
          sessionToken
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `HTTP ${response.status}: Failed to fetch match from Battrick.`);
      }

      if (data.sessionToken) {
        localStorage.setItem('bt_sync_session', data.sessionToken);
      }

      const combinedHtml = `${data.matchHtml || ''}\n${data.summaryHtml || ''}`;
      const parsed = parseBattrickFullMatch(combinedHtml, targetMatchId);

      setActiveParsedMatch(parsed);
      setMatchIdInput(targetMatchId);

      // Auto-synchronize conditions
      if (parsed.pitch && ['Green', 'Hard', 'Dusty', 'Flat', 'Uneven', 'Cracked'].includes(parsed.pitch)) {
        setPitch(parsed.pitch as PitchType);
      }
      if (parsed.weather && ['Overcast', 'Sunny', 'Humid', 'Windy'].includes(parsed.weather)) {
        setWeather(parsed.weather as WeatherType);
      }
      if (parsed.matchType) {
        if (parsed.matchType.toLowerCase().includes('first class')) setMatchFormat('First Class');
        else if (parsed.matchType.toLowerCase().includes('twenty20')) setMatchFormat('Twenty20');
        else setMatchFormat('One Day');
      }

      setFetchStatusMessage(`✓ Successfully fetched & parsed Match #${targetMatchId} (${parsed.homeTeam} vs ${parsed.awayTeam}) directly from Battrick!`);
      setActiveSubTab('match_analyzer');
    } catch (err: any) {
      console.warn('Match direct fetch error, falling back to cached knowledge formula:', err);
      // If direct fetch couldn't connect, fall back to built-in formula generator
      const fallbackData = getExampleMatchDataById(targetMatchId);
      setActiveParsedMatch(fallbackData);
      setMatchIdInput(targetMatchId);
      setActiveSubTab('match_analyzer');

      setFetchError(
        err.message?.includes('credentials') || err.message?.includes('Login')
          ? `${err.message} You can set your credentials in Sync Hub for direct live connections.`
          : `${err.message} Loaded simulated match model for #${targetMatchId}.`
      );
    } finally {
      setIsFetchingMatch(false);
      setFetchingMatchId(null);
      try {
        window.dispatchEvent(new Event('bt_datasync_complete'));
      } catch {
        // ignore
      }
    }
  };

  // Ask AI Coach to analyze this match with OpenRouter
  const handleConsultCoachJarvis = () => {
    const matchSummary = `Please provide a thorough Opponent Scouting Analysis for Battrick Match ID ${activeParsedMatch.matchId} (${activeParsedMatch.homeTeam} vs ${activeParsedMatch.awayTeam}).
Conditions: ${activeParsedMatch.matchType} on a ${activeParsedMatch.pitch} pitch with ${activeParsedMatch.weather} weather.
Home Ratings: Top Order ${activeParsedMatch.homeRatings?.topOrder} (${activeParsedMatch.homeRatings?.topOrderScore}), Middle Order ${activeParsedMatch.homeRatings?.middleOrder}, Lower Order ${activeParsedMatch.homeRatings?.lowerOrder}, Seam ${activeParsedMatch.homeRatings?.seamBowling}, Spin ${activeParsedMatch.homeRatings?.spinBowling}, Batstat ${activeParsedMatch.homeRatings?.batstat?.toLocaleString()}.
Away Ratings: Top Order ${activeParsedMatch.awayRatings?.topOrder} (${activeParsedMatch.awayRatings?.topOrderScore}), Middle Order ${activeParsedMatch.awayRatings?.middleOrder}, Lower Order ${activeParsedMatch.awayRatings?.lowerOrder}, Seam ${activeParsedMatch.awayRatings?.seamBowling}, Spin ${activeParsedMatch.awayRatings?.spinBowling}, Batstat ${activeParsedMatch.awayRatings?.batstat?.toLocaleString()}.

Explain how Battrick grouped and graded their lineup, analyze the Batstat breakdown, quantify their tail collapse probability, and give tactical bowling orders to exploit their 5th bowler.`;

    localStorage.setItem('bt_coach_initial_query', matchSummary);
    setActiveTab('coach');
  };

  // Import parsed opponent lineup into live Tactical Dossier
  const handleImportToDossier = (team: 'home' | 'away') => {
    const innIdx = team === 'home' ? 0 : 1;
    const inn = activeParsedMatch.innings[innIdx];
    if (inn && inn.batters && inn.batters.length > 0) {
      const convertedPlayers: OpponentPlayer[] = inn.batters.map((b, idx) => ({
        id: `scout_p_${idx + 1}`,
        name: b.name,
        age: 26,
        wage: idx < 3 ? 12000 : (idx < 6 ? 9000 : 4000),
        btRating: idx < 3 ? 38000 : (idx < 6 ? 27000 : 14000),
        role: idx < 6 ? 'Batter' : 'Bowler',
        bowlingType: idx >= 6 ? 'RFM' : 'RM',
        batting: idx < 3 ? 13 : (idx < 6 ? 10 : 4),
        bowling: idx >= 6 ? 11 : 2,
        keeping: idx === 6 ? 10 : 1,
        stamina: 7,
        experience: 7,
        concentration: idx < 3 ? 11 : 7,
        consistency: idx < 3 ? 10 : 8,
        order: idx + 1
      }));
      setOpponentName(inn.teamName);
      setOpponentPlayers(convertedPlayers);
      setActiveSubTab('dossier');
    }
  };

  // Copy tactical directives
  const handleCopyTactics = () => {
    const text = `=== BATTRICKIQ SCOUT DOSSIER: vs ${dossier.clubName} ===
Match Conditions: ${matchFormat} on ${pitch} Pitch (${weather})
Recommended Intensity: ${dossier.recommendedMatchIntensity}

KEY VULNERABILITIES:
${dossier.vulnerabilities.map(v => `• [${v.severity.toUpperCase()}] ${v.title}: ${v.tacticalAction}`).join('\n')}

TACTICAL ORDERS:
• Batting Aggression: ${dossier.battingAggressionAdvice}
• Bowling Rotation: ${dossier.bowlingRotationAdvice}
• Fielding Strategy: ${dossier.fieldingPressureAdvice}`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const activeDecomposition = activeParsedMatch.batstatAnalysis?.[selectedTeamTab === 'home' ? 0 : 1] || activeParsedMatch.batstatAnalysis?.[0];
  const activeInnings = activeParsedMatch.innings[selectedTeamTab === 'home' ? 0 : 1] || activeParsedMatch.innings[0];

  return (
    <div className="space-y-6 pb-12" id="opponent-scout-module">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-[#0b192e] to-[#0f172a] text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-blue-900/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-900/80 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-md shrink-0">
              <Swords className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-xl sm:text-2xl text-white tracking-tight">
                  Opponent Scout & Match Intelligence
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-400/30">
                  Batstat & Lineup Engine
                </span>
              </div>
              <p className="text-xs text-blue-100/80 mt-1 max-w-2xl leading-relaxed">
                Reverse-engineer Battrick match ratings, decompose Batstats across Top, Middle, and Lower orders (#1-3, #4-6, #7-11), uncover tail collapses, and target weak 5th bowlers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConsultCoachJarvis}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-200" />
              <span>Ask Coach Jarvis</span>
            </button>
            <button
              type="button"
              onClick={handleCopyTactics}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copySuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copySuccess ? 'Copied!' : 'Copy Plan'}</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 mt-5 border-t border-blue-900/60 pt-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('match_analyzer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'match_analyzer'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Match & Summary Intelligence (Batstat Engine)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('fixtures_scout')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'fixtures_scout'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Upcoming Fixtures & Opponents ({fixtures.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('dossier')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'dossier'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Live Tactical Scout Dossier</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: MATCH & SUMMARY INTELLIGENCE (BATSTAT & GROUPING) */}
      {/* ========================================================= */}
      {activeSubTab === 'match_analyzer' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Match Lookup & Test Scenario Presets Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600" />
                  Battrick Match & Summary Analysis
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Input match ID or paste scorecard / Reporter's summary text to reverse-engineer ratings & Batstats
                </p>
              </div>

              {/* Quick Scenarios from Real Fixtures & Matches */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-400 font-bold mr-1">Fixture Scenarios:</span>
                {fixtures.length > 0 ? (
                  fixtures.slice(0, 4).map((f, idx) => {
                    const mId = f.matchId || (idx === 0 ? '32554717' : idx === 1 ? '32550500' : '32161738');
                    const isSelected = matchIdInput === mId;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectMatchExample(mId)}
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-blue-50 border-slate-200'
                        }`}
                        title={`${f.type} Match vs ${f.opponent} (${f.venue})`}
                      >
                        {idx === 0 && <Sparkles className="w-3 h-3 text-amber-400" />}
                        <span>{f.opponent.split(' ')[0]} ({f.type === 'First Class' ? 'FC' : f.type === 'Twenty20' ? 'T20' : 'OD'})</span>
                      </button>
                    );
                  })
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectMatchExample('32554717')}
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        matchIdInput === '32554717' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 hover:bg-blue-50 border-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Steve (Cup)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectMatchExample('32550500')}
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        matchIdInput === '32550500' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 hover:bg-blue-50 border-slate-200'
                      }`}
                    >
                      <span>Sandshoe (FC)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectMatchExample('32161738')}
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        matchIdInput === '32161738' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 hover:bg-blue-50 border-slate-200'
                      }`}
                    >
                      <span>Bulolo (OD)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block">
                    Battrick Match ID / URL
                  </label>
                  <a
                    href={`https://www.battrick.org/nl/matchinfo.asp?matchID=${matchIdInput}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono font-bold text-blue-600 hover:underline flex items-center gap-1"
                    title="Open on Battrick"
                  >
                    <span>battrick.org</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={matchIdInput}
                    onChange={(e) => setMatchIdInput(e.target.value)}
                    placeholder="e.g. 32557622"
                    className="flex-1 text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleDirectFetchMatch(matchIdInput)}
                    disabled={isFetchingMatch}
                    className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-mono font-bold text-xs rounded-xl transition shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
                    title="Fetch and synchronize this match directly from Battrick servers"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingMatch ? 'animate-spin' : ''}`} />
                    <span>{isFetchingMatch ? 'Fetching...' : '⚡ Fetch Match'}</span>
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1">
                  Paste Scorecard or Summary Text (Optional Override)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pastedMatchText}
                    onChange={(e) => setPastedMatchText(e.target.value)}
                    placeholder="Paste raw Battrick text from matchinfo.asp or summary..."
                    className="flex-1 text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleParseMatchData}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-mono font-bold text-xs rounded-xl transition shrink-0 cursor-pointer shadow-xs"
                  >
                    Analyze Text
                  </button>
                </div>
              </div>
            </div>

            {/* Fetch Status Notification */}
            {isFetchingMatch && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs font-mono flex items-center gap-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                <span>Fetching Match #{fetchingMatchId} scorecard & Reporter's summary directly from Battrick...</span>
              </div>
            )}

            {fetchStatusMessage && !isFetchingMatch && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs font-mono flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{fetchStatusMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFetchStatusMessage(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {fetchError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-mono flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{fetchError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('sync')}
                  className="underline font-bold hover:text-rose-900 cursor-pointer shrink-0"
                >
                  Configure Sync Credentials →
                </button>
              </div>
            )}

            {/* Quick Links & Match Meta */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-600">
              <div className="flex flex-wrap items-center gap-4">
                <span>Match Links:</span>
                <a
                  href={activeParsedMatch.matchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Scorecard ({activeParsedMatch.matchId})</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={activeParsedMatch.summaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Reporter's Summary</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Format: <strong>{activeParsedMatch.matchType}</strong></span>
                <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">Pitch: <strong>{activeParsedMatch.pitch}</strong></span>
                <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-800 border border-blue-200">Weather: <strong>{activeParsedMatch.weather}</strong></span>
                <span className="font-bold text-slate-900">{activeParsedMatch.result}</span>
              </div>
            </div>
          </div>

          {/* Mathematical & Grouping Engine Explainer Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-indigo-900/40">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                <Calculator className="w-4 h-4" />
              </div>
              <h4 className="font-serif font-bold text-base text-white tracking-tight">
                How Battrick Groupings & Batstat Are Calculated
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono mt-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-emerald-300 font-bold">
                  <span>1. Top Order (#1–3)</span>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/30">55%–65% Weight</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed font-sans">
                  The primary run-scoring engine. The engine calculates ratings based heavily on primary Batting skill + Concentration. If Top Order fails, whole innings collapses.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-blue-300 font-bold">
                  <span>2. Middle Order (#4–6)</span>
                  <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded border border-blue-400/30">25%–35% Weight</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed font-sans">
                  Stabilizes innings and consolidates run rate against the opponent's change bowlers (overs 16–40). Requires strong Batting and high Stamina.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-rose-300 font-bold">
                  <span>3. Lower Order (#7–11)</span>
                  <span className="text-[10px] bg-rose-500/20 px-2 py-0.5 rounded border border-rose-400/30">5%–15% Weight</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed font-sans">
                  Specialist bowlers and keeper. Low batting rating here creates a severe <strong>Tail Dropoff</strong> (&gt;55%), meaning 5 quick wickets will wrap up the entire innings.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <span><strong>Batstat Formula:</strong> ∑(Player Batting Level × Position Weight × Pitch Multiplier) × Match Aggression Constant</span>
              <span className="text-indigo-300">Pitch Multiplier: Flat (+8%), Green (Seam +10%), Dusty (Spin +15%)</span>
            </div>
          </div>

          {/* Team Switcher & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTeamTab('home')}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                  selectedTeamTab === 'home'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {activeParsedMatch.homeTeam} (Home)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeamTab('away')}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                  selectedTeamTab === 'away'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {activeParsedMatch.awayTeam} (Away / Opponent)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleImportToDossier(selectedTeamTab)}
                className="text-xs font-mono font-bold px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Simulate Tactics vs this Lineup</span>
              </button>
            </div>
          </div>

          {/* 3. BATSTAT & LINEUP REVERSE-ENGINEERING METRICS (Battrick Formula Breakdown) */}
          {activeDecomposition && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Card 1: Batstat Rating & Power Share */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Batstat Metric</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Total Batting Power Index</p>
                    </div>
                  </div>
                  <span className="font-mono font-extrabold text-lg text-slate-900">
                    {activeDecomposition.batstatValue.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">Top Order Share (#1–3):</span>
                    <span className="font-bold text-emerald-600 font-mono">{activeDecomposition.topOrderContributionPct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 h-full" 
                      style={{ width: `${activeDecomposition.topOrderContributionPct}%` }}
                      title="Top Order Contribution"
                    />
                    <div 
                      className="bg-blue-500 h-full" 
                      style={{ width: `${Math.max(10, 100 - activeDecomposition.topOrderContributionPct - 15)}%` }}
                      title="Middle Order Contribution"
                    />
                    <div 
                      className="bg-rose-400 h-full flex-1" 
                      title="Lower Order Tail"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                    Battrick aggregates individual batting skills, pitch multipliers, and match orders to calculate this total Batstat rating. Over 60% of output originates from positions 1–3.
                  </p>
                </div>
              </div>

              {/* Card 2: Tail Dropoff & Collapse Risk */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Tail Dropoff Index</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Top #1-3 to Lower #7-11</p>
                    </div>
                  </div>
                  <span className={`font-mono font-extrabold text-lg ${activeDecomposition.tailDropoffPercent > 60 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {activeDecomposition.tailDropoffPercent}%
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">Tail Rating Grade:</span>
                    <span className="font-bold text-rose-600 font-mono uppercase">{activeDecomposition.lowerOrderRatingText}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {activeDecomposition.tailDropoffPercent > 55
                      ? "High Vulnerability: Severe dropoff after position 6. Once through the top 4-5 wickets, rapid tail wrap-up is guaranteed with attacking fielders."
                      : "Balanced Depth: Lineup maintains solid resistance through position 8."}
                  </p>
                </div>
              </div>

              {/* Card 3: 5th Bowler Exploit Window */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">5th Bowler Vulnerability</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Target Bowling Weakness</p>
                    </div>
                  </div>
                  <span className="font-mono font-extrabold text-lg text-indigo-600">
                    {activeDecomposition.fifthBowlerEcon} RPO
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">Bowler:</span>
                    <span className="font-bold text-slate-800 font-mono">{activeDecomposition.fifthBowlerName}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Conceded {activeDecomposition.fifthBowlerConceded} runs. Instruct middle-order batters to switch to 'Attacking' or 'Very Attacking' during overs 16–40 against this bowler.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* 4. LINEUP GROUPING & GRADING DETAIL TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Lineup Grouping & Scorecard Breakdown: {activeInnings.teamName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Battrick Reporter groupings: Top Order (1–3), Middle Order (4–6), Lower Order (7–11)
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  Top Order: <strong>{selectedTeamTab === 'home' ? activeParsedMatch.homeRatings?.topOrder : activeParsedMatch.awayRatings?.topOrder}</strong>
                </span>
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                  Middle: <strong>{selectedTeamTab === 'home' ? activeParsedMatch.homeRatings?.middleOrder : activeParsedMatch.awayRatings?.middleOrder}</strong>
                </span>
                <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg">
                  Lower: <strong>{selectedTeamTab === 'home' ? activeParsedMatch.homeRatings?.lowerOrder : activeParsedMatch.awayRatings?.lowerOrder}</strong>
                </span>
              </div>
            </div>

            {/* Scorecard Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Batter</th>
                    <th className="py-2.5 px-3">Battrick Grouping</th>
                    <th className="py-2.5 px-3">Dismissal</th>
                    <th className="py-2.5 px-3 text-right">Runs</th>
                    <th className="py-2.5 px-3 text-right">Balls</th>
                    <th className="py-2.5 px-3 text-right">4s</th>
                    <th className="py-2.5 px-3 text-right">6s</th>
                    <th className="py-2.5 px-3 text-right">SR</th>
                    <th className="py-2.5 px-3">Estimated Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {activeInnings.batters.map((b) => {
                    const isTop = b.order <= 3;
                    const isMid = b.order >= 4 && b.order <= 6;
                    const isTail = b.order >= 7;

                    return (
                      <tr 
                        key={b.order} 
                        className={`hover:bg-slate-50/80 transition ${
                          isTop ? 'bg-emerald-50/20' : isTail ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-bold text-slate-400">{b.order}</td>
                        <td className="py-2 px-3 font-bold font-sans text-slate-900">{b.name}</td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isTop 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : isMid 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {b.group}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">{b.dismissal}</td>
                        <td className="py-2 px-3 font-bold text-right text-slate-900">{b.runs}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{b.balls}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{b.fours}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{b.sixes}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-700">{b.strikeRate.toFixed(1)}</td>
                        <td className="py-2 px-3">
                          <span className={`font-bold ${isTop ? 'text-emerald-700' : isTail ? 'text-rose-600' : 'text-slate-700'}`}>
                            {b.estimatedSkillGrade || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bowling Analysis */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 mb-2">Bowling Figures & 5th Bowler Exposure</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Bowler</th>
                      <th className="py-2.5 px-3">Overs</th>
                      <th className="py-2.5 px-3">Maidens</th>
                      <th className="py-2.5 px-3">Runs</th>
                      <th className="py-2.5 px-3">Wickets</th>
                      <th className="py-2.5 px-3">Economy</th>
                      <th className="py-2.5 px-3">Attack Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeInnings.bowlers.map((bw, idx) => {
                      const isWeakest = idx === 4 || bw.economy >= 6.5;
                      return (
                        <tr key={idx} className={isWeakest ? 'bg-amber-50/40 font-bold' : ''}>
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-sans text-slate-900">{bw.name}</td>
                          <td className="py-2 px-3 text-slate-700">{bw.overs}</td>
                          <td className="py-2 px-3 text-slate-600">{bw.maidens}</td>
                          <td className="py-2 px-3 text-slate-900">{bw.runs}</td>
                          <td className="py-2 px-3 font-bold text-blue-700">{bw.wickets}</td>
                          <td className="py-2 px-3">{bw.economy.toFixed(2)}</td>
                          <td className="py-2 px-3">
                            {isWeakest ? (
                              <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                5th Bowler Target
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Frontline Bowler</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tactical Exploit Directives */}
            {activeDecomposition && activeDecomposition.tacticalExploits.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-blue-50/80 border border-blue-200">
                <h5 className="font-bold text-xs text-blue-950 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                  <Target className="w-4 h-4 text-blue-600" />
                  Tactical Match Directives Derived From This Match Data:
                </h5>
                <ul className="space-y-1.5 text-xs text-blue-900 font-sans">
                  {activeDecomposition.tacticalExploits.map((exploit, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold font-mono">•</span>
                      <span>{exploit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: UPCOMING FIXTURES & OPPONENT EXPLORER             */}
      {/* ========================================================= */}
      {activeSubTab === 'fixtures_scout' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Top Bar: Fixtures Overview & Ingest */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Upcoming Match Schedule & Fixture Scouting
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  All scheduled fixtures, match links, format types, and quick scouting actions
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFixturesPasteOpen(!isFixturesPasteOpen)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl border border-blue-200 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isFixturesPasteOpen ? 'Close Import' : 'Import Fixtures HTML'}</span>
                </button>
              </div>
            </div>

            {/* Fixtures Ingest Box */}
            {isFixturesPasteOpen && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fadeIn">
                <label className="text-xs font-mono font-bold text-slate-700 block">
                  Paste Upcoming Matches HTML or Raw List from Battrick:
                </label>
                <textarea
                  rows={4}
                  value={pastedFixturesText}
                  onChange={(e) => setPastedFixturesText(e.target.value)}
                  placeholder='Paste the snippet containing `<ul class="fixtures table striped condensed">` or plain fixture text...'
                  className="w-full text-xs font-mono p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleParsePastedFixtures}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Parse & Save Fixtures
                  </button>
                </div>
              </div>
            )}

            {/* Metric Summary Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">Total Fixtures</span>
                <span className="font-mono font-bold text-lg text-slate-900">{fixtures.length} Games</span>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200/70">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-700 block">Cup Knockouts</span>
                <span className="font-mono font-bold text-lg text-amber-900">
                  {fixtures.filter(f => f.type === 'Cup').length} Matches
                </span>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-200/70">
                <span className="text-[10px] font-mono font-bold uppercase text-purple-700 block">First Class (FC)</span>
                <span className="font-mono font-bold text-lg text-purple-900">
                  {fixtures.filter(f => f.type === 'First Class').length} Matches
                </span>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200/70">
                <span className="text-[10px] font-mono font-bold uppercase text-blue-700 block">One Day (OD)</span>
                <span className="font-mono font-bold text-lg text-blue-900">
                  {fixtures.filter(f => f.type === 'One Day').length} Matches
                </span>
              </div>
            </div>
          </div>

          {/* Fixtures Table List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h4 className="font-serif font-bold text-base text-slate-900">Scheduled Upcoming Matches</h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Format</th>
                    <th className="py-2.5 px-3">Opponent</th>
                    <th className="py-2.5 px-3">Venue</th>
                    <th className="py-2.5 px-3">Match ID</th>
                    <th className="py-2.5 px-3 text-right">Scout & Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fixtures.map((f, idx) => {
                    const isCup = f.type === 'Cup';
                    const isFC = f.type === 'First Class';
                    const isOD = f.type === 'One Day';
                    const isBT20 = f.type === 'Twenty20';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap">
                          {f.date} {f.time ? <span className="text-[10px] font-normal text-slate-400">({f.time})</span> : ''}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isCup ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            isFC ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            isOD ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {f.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{f.opponent}</span>
                            {f.isBot && (
                              <span className="text-[9px] font-mono bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-bold">
                                BOT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            f.venue === 'Home' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {f.venue}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {f.matchId ? (
                            <a
                              href={f.matchUrl || `https://www.battrick.org/nl/matchinfo.asp?matchID=${f.matchId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
                            >
                              <span>{f.matchId}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {f.matchId && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDirectFetchMatch(f.matchId)}
                                  disabled={isFetchingMatch && fetchingMatchId === f.matchId}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="Live Sync: Fetch scorecard & summary directly from Battrick"
                                >
                                  <RefreshCw className={`w-3 h-3 ${isFetchingMatch && fetchingMatchId === f.matchId ? 'animate-spin' : ''}`} />
                                  <span>{isFetchingMatch && fetchingMatchId === f.matchId ? 'Syncing...' : '⚡ Fetch'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAnalyzeFixtureMatch(f)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                                  title="Open in Batstat Engine"
                                >
                                  <BarChart3 className="w-3 h-3 text-blue-400" />
                                  <span>Batstat</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleScoutFixtureOpponent(f)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                              title="Scout Opponent Tactics"
                            >
                              <Target className="w-3 h-3 text-blue-600" />
                              <span>Tactics</span>
                            </button>
                            {f.ordersUrl && (
                              <a
                                href={`https://www.battrick.org/nl/${f.ordersUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition flex items-center gap-1"
                                title="Open Match Orders on Battrick"
                              >
                                <span>Orders</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
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

      {/* ========================================================= */}
      {/* VIEW 3: LIVE TACTICAL SCOUT DOSSIER                       */}
      {/* ========================================================= */}
      {activeSubTab === 'dossier' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Ingest Box (Collapsible) */}
          {isInputOpen && (
            <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Paste Opponent Squad / Scorecard Text
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Auto-extracts names, ratings, bowling types & skills
                </span>
              </div>
              <textarea
                rows={4}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste raw Battrick text from your opponent's squad page, match orders, or match scorecard here..."
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Quick Opponent Roster from Fixtures:</span>
                  {fixtures.slice(0, 4).map((f, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectFixtureOpponent(f.opponent)}
                      className="text-[11px] font-mono font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 transition cursor-pointer"
                    >
                      {f.opponent}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleParseOpponent}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Process Opponent Roster
                </button>
              </div>
            </div>
          )}

          {/* Match Conditions & Opponent Selection Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Target Opponent */}
              <div className="lg:col-span-2">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1.5">
                  Opponent Team
                </label>
                <div className="flex items-center gap-2">
                  {fixtures.length > 0 ? (
                    <select
                      value={opponentName}
                      onChange={(e) => {
                        const name = e.target.value;
                        handleSelectFixtureOpponent(name);
                      }}
                      className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {fixtures.map((f, idx) => (
                        <option key={idx} value={f.opponent}>
                          {f.opponent} ({f.venue} • {f.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={opponentName}
                      onChange={(e) => {
                        const name = e.target.value;
                        setOpponentName(name);
                        setOpponentPlayers(generateRealisticOpponentRoster(name, false, matchFormat));
                      }}
                      className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />
                  )}
                </div>
              </div>

              {/* Pitch */}
              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1.5">
                  Pitch Condition
                </label>
                <select
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value as PitchType)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="Green">Green (Seam/Swing +10%)</option>
                  <option value="Dusty">Dusty (Spin +15%)</option>
                  <option value="Flat">Flat (High Run-rate)</option>
                  <option value="Hard">Hard (Pace/Bounce)</option>
                  <option value="Uneven">Uneven (Variable Bounce)</option>
                  <option value="Cracked">Cracked (Spin/Variable)</option>
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1.5">
                  Match Format
                </label>
                <select
                  value={matchFormat}
                  onChange={(e) => setMatchFormat(e.target.value as MatchFormat)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="One Day">One Day (50 Overs)</option>
                  <option value="First Class">First Class (3 Days)</option>
                  <option value="Twenty20">Twenty20 (20 Overs)</option>
                </select>
              </div>

              {/* Venue & Weather */}
              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1.5">
                  Venue & Weather
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={venue}
                    onChange={(e) => setVenue(e.target.value as any)}
                    className="w-1/2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2"
                  >
                    <option value="Home">Home</option>
                    <option value="Away">Away</option>
                  </select>
                  <select
                    value={weather}
                    onChange={(e) => setWeather(e.target.value as WeatherType)}
                    className="w-1/2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2"
                  >
                    <option value="Sunny">Sunny</option>
                    <option value="Overcast">Overcast</option>
                    <option value="Humid">Humid</option>
                    <option value="Windy">Windy</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          {/* Tactical Dossier Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Batting Aggression Orders */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">Batting Aggression Orders</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {dossier.battingAggressionAdvice}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Match Intensity</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                  dossier.recommendedMatchIntensity === 'Take It Easy' ? 'bg-emerald-100 text-emerald-800' :
                  dossier.recommendedMatchIntensity === 'Go For It' ? 'bg-rose-100 text-rose-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {dossier.recommendedMatchIntensity}
                </span>
              </div>
            </div>

            {/* Card 2: Bowling Rotation & Spell Lengths */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">Bowling Rotation & Spells</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {dossier.bowlingRotationAdvice}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-1">
                  Pitch Synergy ({pitch})
                </span>
                <div className="text-xs text-slate-700 font-mono">
                  {pitch === 'Green' ? '• Fast Seam: +10% Wicket Bonus' : pitch === 'Dusty' ? '• Spin Attack: +15% Turn Bonus' : '• True Bounce: Consistency is key'}
                </div>
              </div>
            </div>

            {/* Card 3: Fielding & Pressure Settings */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">Fielding & Catching Pressure</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {dossier.fieldingPressureAdvice}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('lineup')}
                  className="w-full py-2 bg-slate-900 hover:bg-black text-white font-mono font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open Match XI Optimizer</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Opponent Scouted 11 Players Roster Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Scouted Lineup: {dossier.clubName} ({dossier.players.length} Players)
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Ordered by typical batting position with primary skills and bowling styles
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                Avg Wage: £{Math.round(dossier.players.reduce((acc, p) => acc + p.wage, 0) / (dossier.players.length || 1)).toLocaleString()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Player</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">BTR</th>
                    <th className="py-2.5 px-3">Batting</th>
                    <th className="py-2.5 px-3">Bowling</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Stamina</th>
                    <th className="py-2.5 px-3">Vulnerability / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dossier.players.map((p, idx) => {
                    const isTail = idx >= 6 && p.batting <= 5;
                    const isPartTimer = idx >= 6 && p.bowling >= 5 && p.bowling <= 7;
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/80 transition ${isTail ? 'bg-rose-50/20' : ''}`}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{p.name}</td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {p.role}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                          {p.btRating.toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`font-mono font-bold ${p.batting >= 10 ? 'text-emerald-600' : p.batting <= 4 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {getSkillLabel('batting', p.batting)} ({p.batting})
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`font-mono font-bold ${p.bowling >= 10 ? 'text-blue-600' : 'text-slate-500'}`}>
                            {p.bowling >= 3 ? `${getSkillLabel('bowling', p.bowling)} (${p.bowling})` : '—'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">
                          {p.bowlingType || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {getSkillLabel('stamina', p.stamina)}
                        </td>
                        <td className="py-2 px-3">
                          {isTail ? (
                            <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              Fragile Tail Target
                            </span>
                          ) : isPartTimer ? (
                            <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Weak 5th Bowler Target
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400">Standard</span>
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
  );
}
