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
  parseBattrickFullMatch, 
  getExampleMatchData 
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
  Percent 
} from 'lucide-react';

interface OpponentScoutProps {
  setActiveTab: (tab: any) => void;
}

// Sample realistic opponent rosters for rapid exploration
const SAMPLE_OPPONENTS: Record<string, OpponentPlayer[]> = {
  'Yorkshire Strikers (Tail Vulnerable)': [
    { id: 'ys_1', name: 'Marcus Sterling', age: 26, wage: 12500, btRating: 38000, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 2, keeping: 1, stamina: 8, experience: 8, concentration: 11, consistency: 8, order: 1 },
    { id: 'ys_2', name: 'Dean Higgins', age: 24, wage: 11000, btRating: 34000, role: 'Batter', bowlingType: 'RM', batting: 11, bowling: 2, keeping: 1, stamina: 7, experience: 6, concentration: 10, consistency: 7, order: 2 },
    { id: 'ys_3', name: 'Tariq Rashid', age: 28, wage: 14000, btRating: 42000, role: 'Batter', bowlingType: 'RM', batting: 13, bowling: 3, keeping: 1, stamina: 9, experience: 9, concentration: 12, consistency: 9, order: 3 },
    { id: 'ys_4', name: 'Callum Vance', age: 23, wage: 9500, btRating: 28000, role: 'All-rounder', bowlingType: 'RFM', batting: 10, bowling: 8, keeping: 1, stamina: 7, experience: 5, concentration: 8, consistency: 8, order: 4 },
    { id: 'ys_5', name: 'Liam O’Reilly', age: 27, wage: 8200, btRating: 24000, role: 'Keeper', bowlingType: 'RM', batting: 9, bowling: 1, keeping: 11, stamina: 7, experience: 7, concentration: 8, consistency: 7, order: 5 },
    { id: 'ys_6', name: 'Gareth North', age: 29, wage: 6500, btRating: 19000, role: 'Batter', bowlingType: 'RM', batting: 7, bowling: 2, keeping: 1, stamina: 6, experience: 7, concentration: 6, consistency: 6, order: 6 },
    { id: 'ys_7', name: 'Simon Archer', age: 25, wage: 4800, btRating: 14000, role: 'Bowler', bowlingType: 'LF', batting: 4, bowling: 11, keeping: 1, stamina: 6, experience: 6, concentration: 4, consistency: 10, order: 7 },
    { id: 'ys_8', name: 'Navid Qadir', age: 26, wage: 5200, btRating: 15500, role: 'Bowler', bowlingType: 'OB', batting: 3, bowling: 11, keeping: 1, stamina: 6, experience: 6, concentration: 3, consistency: 11, order: 8 },
    { id: 'ys_9', name: 'Ewan MacLeod', age: 22, wage: 4200, btRating: 12000, role: 'Bowler', bowlingType: 'RF', batting: 3, bowling: 10, keeping: 1, stamina: 7, experience: 4, concentration: 3, consistency: 9, order: 9 },
    { id: 'ys_10', name: 'Brendan Hayes', age: 30, wage: 5800, btRating: 16000, role: 'Bowler', bowlingType: 'LM', batting: 2, bowling: 11, keeping: 1, stamina: 6, experience: 8, concentration: 2, consistency: 11, order: 10 },
    { id: 'ys_11', name: 'Darren Cox', age: 21, wage: 2100, btRating: 6500, role: 'Bowler', bowlingType: 'RM', batting: 2, bowling: 5, keeping: 1, stamina: 5, experience: 3, concentration: 2, consistency: 5, order: 11 },
  ],
  'Surrey Spinners (Spin Heavy)': [
    { id: 'ss_1', name: 'Julian Croft', age: 27, wage: 10500, btRating: 32000, role: 'Batter', bowlingType: 'RM', batting: 11, bowling: 2, keeping: 1, stamina: 7, experience: 7, concentration: 10, consistency: 8, order: 1 },
    { id: 'ss_2', name: 'Ashley Miller', age: 25, wage: 9800, btRating: 30000, role: 'Batter', bowlingType: 'RM', batting: 10, bowling: 2, keeping: 1, stamina: 8, experience: 6, concentration: 9, consistency: 8, order: 2 },
    { id: 'ss_3', name: 'Kashif Mehmood', age: 29, wage: 13000, btRating: 39000, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 3, keeping: 1, stamina: 8, experience: 8, concentration: 11, consistency: 9, order: 3 },
    { id: 'ss_4', name: 'Peter Davenport', age: 26, wage: 11500, btRating: 35000, role: 'Keeper', bowlingType: 'RM', batting: 11, bowling: 1, keeping: 10, stamina: 7, experience: 7, concentration: 10, consistency: 8, order: 4 },
    { id: 'ss_5', name: 'Zubair Akram', age: 24, wage: 10200, btRating: 31000, role: 'All-rounder', bowlingType: 'OB', batting: 9, bowling: 10, keeping: 1, stamina: 7, experience: 5, concentration: 8, consistency: 9, order: 5 },
    { id: 'ss_6', name: 'Rory Campbell', age: 28, wage: 9000, btRating: 27000, role: 'Batter', bowlingType: 'RM', batting: 9, bowling: 2, keeping: 1, stamina: 6, experience: 7, concentration: 8, consistency: 7, order: 6 },
    { id: 'ss_7', name: 'Sunil Narine Jr', age: 25, wage: 11800, btRating: 36000, role: 'Bowler', bowlingType: 'SLC', batting: 6, bowling: 12, keeping: 1, stamina: 7, experience: 6, concentration: 5, consistency: 12, order: 7 },
    { id: 'ss_8', name: 'Devon Warner', age: 27, wage: 11200, btRating: 34000, role: 'Bowler', bowlingType: 'LB', batting: 5, bowling: 12, keeping: 1, stamina: 7, experience: 7, concentration: 4, consistency: 11, order: 8 },
    { id: 'ss_9', name: 'Imran Tahir Clone', age: 30, wage: 12500, btRating: 37000, role: 'Bowler', bowlingType: 'OB', batting: 4, bowling: 12, keeping: 1, stamina: 6, experience: 8, concentration: 3, consistency: 12, order: 9 },
    { id: 'ss_10', name: 'Glenn McGrath Jr', age: 23, wage: 7500, btRating: 23000, role: 'Bowler', bowlingType: 'RFM', batting: 3, bowling: 9, keeping: 1, stamina: 8, experience: 5, concentration: 3, consistency: 9, order: 10 },
    { id: 'ss_11', name: 'Tom Baxter', age: 22, wage: 4800, btRating: 14000, role: 'Bowler', bowlingType: 'SLW', batting: 2, bowling: 8, keeping: 1, stamina: 6, experience: 4, concentration: 2, consistency: 8, order: 11 },
  ]
};

export default function OpponentScout({ setActiveTab }: OpponentScoutProps) {
  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'match_analyzer' | 'dossier'>('match_analyzer');

  // 1. My Squad Context
  const [mySquad, setMySquad] = useState<BattrickPlayer[]>([]);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [myTeamName, setMyTeamName] = useState<string>('My Club');

  // 2. Selected Opponent & Match Settings
  const [opponentName, setOpponentName] = useState<string>('Southern Vipers CC');
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('One Day');
  const [pitch, setPitch] = useState<PitchType>('Green');
  const [weather, setWeather] = useState<WeatherType>('Overcast');
  const [venue, setVenue] = useState<'Home' | 'Away'>('Home');

  // 3. Opponent Squad Data
  const [opponentPlayers, setOpponentPlayers] = useState<OpponentPlayer[]>(SAMPLE_OPPONENTS['Yorkshire Strikers (Tail Vulnerable)']);
  const [pastedText, setPastedText] = useState<string>('');
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // 4. Match & Summary Intelligence State
  const [matchIdInput, setMatchIdInput] = useState<string>('32554717');
  const [pastedMatchText, setPastedMatchText] = useState<string>('');
  const [activeParsedMatch, setActiveParsedMatch] = useState<ParsedBattrickMatch>(() => getExampleMatchData());
  const [selectedTeamTab, setSelectedTeamTab] = useState<'home' | 'away'>('away');

  // Load user data on mount
  useEffect(() => {
    try {
      const savedSquad = localStorage.getItem('bt_squad');
      if (savedSquad) setMySquad(JSON.parse(savedSquad));

      const savedFixtures = localStorage.getItem('bt_fixtures');
      if (savedFixtures) setFixtures(JSON.parse(savedFixtures));

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

  // Handle sample selection
  const handleSelectSample = (key: string) => {
    if (SAMPLE_OPPONENTS[key]) {
      setOpponentName(key);
      setOpponentPlayers(SAMPLE_OPPONENTS[key]);
    }
  };

  // Handle parsing match scorecard and summary text
  const handleParseMatchData = () => {
    if (!pastedMatchText.trim()) {
      // Reload example match
      const example = getExampleMatchData();
      setActiveParsedMatch(example);
      return;
    }
    const parsed = parseBattrickFullMatch(pastedMatchText, matchIdInput);
    setActiveParsedMatch(parsed);
    setPastedMatchText('');
  };

  // Load preloaded example match 32554717
  const handleLoadExampleMatch = () => {
    setMatchIdInput('32554717');
    const example = getExampleMatchData();
    setActiveParsedMatch(example);
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
        <div className="flex items-center gap-2 mt-5 border-t border-blue-900/60 pt-3">
          <button
            type="button"
            onClick={() => setActiveSubTab('match_analyzer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
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
            onClick={() => setActiveSubTab('dossier')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
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
          
          {/* Match Lookup & Ingest Bar */}
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadExampleMatch}
                  className="text-xs font-mono font-bold px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl border border-blue-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Load Match 32554717 (Sample)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1">
                  Battrick Match ID / URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={matchIdInput}
                    onChange={(e) => setMatchIdInput(e.target.value)}
                    placeholder="e.g. 32554717"
                    className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                  />
                  <a
                    href={`https://www.battrick.org/nl/matchinfo.asp?matchID=${matchIdInput}`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-blue-600 transition"
                    title="Open in Battrick"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
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
                    Analyze Match
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500">
              <span>Links:</span>
              <a
                href={activeParsedMatch.matchUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Scorecard ({activeParsedMatch.matchId})</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={activeParsedMatch.summaryUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Reporter's Summary</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-400">|</span>
              <span>Pitch: <strong className="text-slate-800">{activeParsedMatch.pitch}</strong></span>
              <span>Weather: <strong className="text-slate-800">{activeParsedMatch.weather}</strong></span>
              <span>Result: <strong className="text-emerald-700">{activeParsedMatch.result}</strong></span>
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
      {/* VIEW 2: LIVE TACTICAL SCOUT DOSSIER                       */}
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
                  <span className="text-xs text-slate-500 font-medium">Or load quick test presets:</span>
                  {Object.keys(SAMPLE_OPPONENTS).map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectSample(key)}
                      className="text-[11px] font-mono font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 transition cursor-pointer"
                    >
                      {key.split(' (')[0]}
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
                        setOpponentName(name);
                        if (SAMPLE_OPPONENTS[name]) {
                          setOpponentPlayers(SAMPLE_OPPONENTS[name]);
                        }
                      }}
                      className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {fixtures.map((f, idx) => (
                        <option key={idx} value={f.opponent}>
                          {f.opponent} ({f.venue} • {f.type})
                        </option>
                      ))}
                      {Object.keys(SAMPLE_OPPONENTS).map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={opponentName}
                      onChange={(e) => setOpponentName(e.target.value)}
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
