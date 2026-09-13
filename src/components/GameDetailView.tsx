import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BattrickGame, 
  BattrickPlayer, 
  OpponentPlayer, 
  PitchType, 
  WeatherType, 
  MatchFormat,
  ParsedBattrickMatch,
  SKILL_LEVELS,
  getSkillLabel
} from '../types';
import { 
  predictTeamLineupAndSkills, 
  getStoredMatchesList 
} from '../utils/matchArchive';
import { 
  parseOpponentSquad, 
  generateOpponentScoutDossier, 
  generateRealisticOpponentRoster 
} from '../parser';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import { 
  ArrowLeft, 
  Bot, 
  Send, 
  Sparkles, 
  ShieldAlert, 
  Swords, 
  Calendar, 
  Clock, 
  MapPin, 
  ExternalLink, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  UserCheck, 
  Target, 
  Flame, 
  RotateCw, 
  HelpCircle,
  FileText,
  ChevronRight,
  RefreshCw,
  Trophy,
  Activity,
  Award,
  Users
} from 'lucide-react';

interface GameDetailViewProps {
  fixture: BattrickGame;
  onBack: () => void;
  setActiveTab: (tab: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function GameDetailView({ fixture, onBack, setActiveTab }: GameDetailViewProps) {
  const { username: battrickUser, password: battrickPass } = useBattrickAuth();
  
  // State variables
  const [pitch, setPitch] = useState<PitchType>('Flat');
  const [weather, setWeather] = useState<WeatherType>('Sunny');
  const [myPlayers, setMyPlayers] = useState<BattrickPlayer[]>([]);
  const [opponentPlayers, setOpponentPlayers] = useState<OpponentPlayer[]>([]);
  const [storedMatch, setStoredMatch] = useState<ParsedBattrickMatch | null>(null);
  
  const [isSyncingOpponent, setIsSyncingOpponent] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [manualHtml, setManualHtml] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);

  // Sub-tabs in Game View
  const [activeTab, setActiveSubTab] = useState<'overview' | 'lineups' | 'opponent' | 'jarvis'>('overview');

  // Jarvis Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isJarvisThinking, setIsJarvisThinking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Determine opponent name and venue
  const opponentName = fixture.opponent || (fixture.venue === 'Home' ? fixture.awayTeam : fixture.homeTeam) || 'Opponent Club';
  const matchFormat = (fixture.type as MatchFormat) || 'One Day';
  const isPlayed = Boolean(fixture.result && fixture.result !== 'Upcoming');

  // Load My Squad & Opponent Data on Mount
  useEffect(() => {
    // 1. Load My Squad
    try {
      const savedSquad = localStorage.getItem('bt_squad');
      if (savedSquad) {
        const parsed = JSON.parse(savedSquad);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMyPlayers(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load local squad:', e);
    }

    // 2. Load Stored Match details if available
    if (fixture.matchId) {
      try {
        const storedMap = localStorage.getItem('MATCH_STORAGE_KEY');
        if (storedMap) {
          const map = JSON.parse(storedMap);
          if (map[fixture.matchId]) {
            setStoredMatch(map[fixture.matchId]);
          }
        }
      } catch (e) {
        console.warn('Failed to load stored match:', e);
      }
    }

    // 3. Load or Predict Opponent Players
    loadOpponentData();
  }, [fixture.matchId, fixture.opponent]);

  // Scroll to bottom of Jarvis chat when new messages arrive
  useEffect(() => {
    if (activeTab === 'jarvis') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isJarvisThinking]);

  // Load / Predict Opponent Roster
  const loadOpponentData = () => {
    try {
      const allMatches = getStoredMatchesList();
      const predicted = predictTeamLineupAndSkills(opponentName, fixture.type, allMatches);

      if (predicted && predicted.predictedBattingOrder && predicted.predictedBattingOrder.length > 0) {
        // Convert predicted lineup to OpponentPlayer format
        const converted: OpponentPlayer[] = predicted.predictedBattingOrder.map((p, idx) => ({
          id: `pred_${idx}_${p.name}`,
          name: p.name,
          age: 26,
          wage: 15000,
          btRating: 45000,
          role: (p.role as any) || (p.isBowler ? 'Bowler' : 'Batter'),
          bowlingType: p.bowlingType === 'Spin' ? 'SLA' : 'RFM',
          batting: p.estimatedBattingScore || 8,
          bowling: p.estimatedBowlingScore || 8,
          keeping: 3,
          stamina: 8,
          experience: 8,
          order: idx + 1,
          estimatedSkillLabel: p.estimatedBattingGrade || getSkillLabel('batting', p.estimatedBattingScore || 8),
          estimatedSkillLevel: p.estimatedBattingScore || 8,
          battingAverage: p.averageRuns,
          bowlingAverage: p.economy ? p.economy * 4 : undefined
        }));
        setOpponentPlayers(converted);
        return;
      }

      // Check scout target team cache
      const scoutTargetStr = localStorage.getItem('bt_scout_target_team');
      if (scoutTargetStr) {
        const parsed = JSON.parse(scoutTargetStr);
        if (parsed.opponentPlayers && Array.isArray(parsed.opponentPlayers) && parsed.opponentPlayers.length > 0) {
          setOpponentPlayers(parsed.opponentPlayers);
          return;
        }
      }

      // Fallback: Generate realistic opponent benchmark roster
      const targetId = fixture.opponentTeamId || (fixture.venue === 'Home' ? fixture.awayTeamId : fixture.homeTeamId);
      const benchmark = generateRealisticOpponentRoster(opponentName, false, matchFormat, targetId);
      setOpponentPlayers(benchmark);

    } catch (err) {
      console.error('Error loading opponent data:', err);
    }
  };

  // Initialize Jarvis Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome_msg',
          role: 'assistant',
          content: `### 🏏 Welcome Manager! I am **Coach Jarvis**.
I have analyzed your fixture against **${opponentName}** (${matchFormat} format at ${fixture.venue}).

**Opponent Intelligence Status:**
- **Opponent Roster Loaded:** ${opponentPlayers.length} players analyzed
- **Match Pitch Condition:** ${pitch}
- **Weather Conditions:** ${weather}

Ask me anything about your lineup against their bowlers, top order targets, 5th bowler vulnerabilities, or tactical match orders (GFI / PAN / TIE).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [opponentName, pitch, weather, opponentPlayers.length]);

  // Live Opponent Sync via Battrick Direct API
  const handleFetchOpponentSquadLive = async () => {
    if (!fixture.opponentTeamId && !fixture.homeTeamId && !fixture.awayTeamId) {
      setSyncStatusMsg('No Opponent Team ID available for direct sync. Try pasting squad HTML below.');
      setShowManualPaste(true);
      return;
    }

    const targetId = fixture.opponentTeamId || (fixture.venue === 'Home' ? fixture.awayTeamId : fixture.homeTeamId);

    setIsSyncingOpponent(true);
    setSyncStatusMsg(`Connecting to Battrick to fetch ${opponentName} squad (Team ID: ${targetId})...`);

    try {
      const response = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: 'squad',
          teamId: targetId,
          username: battrickUser,
          password: battrickPass
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.html) {
        throw new Error('No HTML content returned from Battrick.');
      }

      // Parse opponent squad
      const parsedPlayers = parseOpponentSquad(data.html, opponentName, targetId);
      if (parsedPlayers.length === 0) {
        throw new Error('Could not parse any player records from squad HTML.');
      }

      // Convert BattrickPlayer[] to OpponentPlayer[]
      const converted: OpponentPlayer[] = parsedPlayers.map((p, idx) => ({
        id: p.id || `op_${idx}`,
        name: p.name,
        age: p.age,
        wage: p.wage,
        btRating: p.btRating,
        role: p.role as any,
        bowlingType: p.bowlingType,
        batting: p.skills?.batting || 5,
        bowling: p.skills?.bowling || 5,
        keeping: p.skills?.keeping || 0,
        stamina: p.skills?.stamina || 5,
        experience: p.skills?.experience || 5,
        order: idx + 1,
        estimatedSkillLabel: getSkillLabel('batting', p.skills?.batting || 5)
      }));

      setOpponentPlayers(converted);
      setSyncStatusMsg(`✅ Successfully synced ${converted.length} real opponent players from Battrick!`);

      // Save to scout target
      localStorage.setItem('bt_scout_target_team', JSON.stringify({
        teamName: opponentName,
        teamId: targetId,
        opponentPlayers: converted
      }));

    } catch (err: any) {
      console.error('Opponent sync error:', err);
      setSyncStatusMsg(`Sync error: ${err.message || 'Failed to fetch squad'}. You can paste HTML manually.`);
      setShowManualPaste(true);
    } finally {
      setIsSyncingOpponent(false);
    }
  };

  // Handle Manual HTML Paste for Opponent
  const handleParseManualHtml = () => {
    if (!manualHtml.trim()) return;
    try {
      const parsedPlayers = parseOpponentSquad(manualHtml, opponentName);
      if (parsedPlayers.length === 0) {
        alert('Could not find player records in the pasted HTML. Please paste the full squad.asp source code.');
        return;
      }
      const converted: OpponentPlayer[] = parsedPlayers.map((p, idx) => ({
        id: p.id || `op_man_${idx}`,
        name: p.name,
        age: p.age,
        wage: p.wage,
        btRating: p.btRating,
        role: p.role as any,
        bowlingType: p.bowlingType,
        batting: p.skills?.batting || 5,
        bowling: p.skills?.bowling || 5,
        keeping: p.skills?.keeping || 0,
        stamina: p.skills?.stamina || 5,
        experience: p.skills?.experience || 5,
        order: idx + 1,
        estimatedSkillLabel: getSkillLabel('batting', p.skills?.batting || 5)
      }));

      setOpponentPlayers(converted);
      setManualHtml('');
      setShowManualPaste(false);
      setSyncStatusMsg(`✅ Parsed ${converted.length} players from pasted HTML!`);
    } catch (e: any) {
      alert(`Error parsing HTML: ${e.message}`);
    }
  };

  // Compute Scout Dossier
  const scoutDossier = useMemo(() => {
    const myAvgBtr = myPlayers.length > 0 
      ? Math.round(myPlayers.reduce((acc, p) => acc + (p.btRating || 0), 0) / myPlayers.length) 
      : 45000;
    return generateOpponentScoutDossier(opponentPlayers, opponentName, pitch, weather, matchFormat, myAvgBtr);
  }, [opponentPlayers, opponentName, pitch, weather, matchFormat, myPlayers]);

  // Send Prompt to Jarvis AI
  const handleSendJarvisPrompt = async (promptText?: string) => {
    const query = (promptText || inputQuery).trim();
    if (!query || isJarvisThinking) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!promptText) setInputQuery('');
    setIsJarvisThinking(true);
    setActiveSubTab('jarvis');

    // Build comprehensive match context
    const mySquadSummary = myPlayers.slice(0, 11).map((p, i) => 
      `${i+1}. ${p.name} (${p.role}) - BTR: ${p.btRating?.toLocaleString() || 'N/A'}, Bat: ${getSkillLabel('batting', p.skills?.batting || 0)}, Bowl: ${getSkillLabel('bowling', p.skills?.bowling || 0)} (${p.bowlingType || 'N/A'}), Keep: ${p.skills?.keeping || 0}, Form: ${p.form}/10`
    ).join('\n');

    const opponentSummary = opponentPlayers.slice(0, 11).map((p, i) =>
      `${i+1}. ${p.name} (${p.role || 'Player'}) - BTR: ${p.btRating?.toLocaleString() || 'N/A'}, Bat: ${p.estimatedSkillLabel || getSkillLabel('batting', p.batting || 0)}, Bowl: ${getSkillLabel('bowling', p.bowling || 0)} (${p.bowlingType || 'N/A'})`
    ).join('\n');

    const fullContext = `
[MATCH METADATA]
Fixture: ${fixture.homeTeam || 'My Team'} vs ${fixture.awayTeam || opponentName}
Format: ${matchFormat}
Venue: ${fixture.venue} Match
Pitch Condition: ${pitch}
Weather: ${weather}
Result / Status: ${fixture.result || 'Upcoming'}

[MY ACTIVE SQUAD / LINEUP (Top 11)]:
${mySquadSummary || 'No squad loaded yet (using default squad)'}

[OPPONENT SQUAD (${opponentName}) - Scouted / Predicted Players]:
${opponentSummary || 'No opponent players available'}

[SCOUTING INTELLIGENCE & VULNERABILITIES]:
- 5th Bowler Vulnerability: ${scoutDossier.vulnerabilities.find(v => v.category === 'fifth_bowler')?.description || 'Moderate'}
- Tail Vulnerability: ${scoutDossier.vulnerabilities.find(v => v.category === 'batting_tail')?.description || 'Standard'}
- Key Opponent Batters: ${scoutDossier.keyThreats.batters.map(b => b.name).join(', ') || 'N/A'}
- Key Opponent Bowlers: ${scoutDossier.keyThreats.bowlers.map(b => b.name).join(', ') || 'N/A'}
`;

    try {
      const response = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          context: fullContext,
          provider: 'gemini'
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      const reply = data.reply || 'No tactical response was generated.';

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err: any) {
      console.error('Jarvis response error:', err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Unable to connect to Coach Jarvis server endpoint.**\n\n*Error details:* ${err.message}\n\n*Quick Tip:* Please check your GEMINI_API_KEY in Settings or try asking again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsJarvisThinking(false);
    }
  };

  // Render markdown text in Jarvis chat
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      if (trimmed.startsWith('### ')) {
        return <h4 key={idx} className="font-bold text-slate-900 text-sm mt-3 mb-1.5 flex items-center gap-1.5">{line.replace('### ', '')}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={idx} className="font-serif font-bold text-indigo-950 text-base mt-4 mb-2">{line.replace('## ', '')}</h3>;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleaned = trimmed.substring(2);
        const parts = cleaned.split('**');
        return (
          <li key={idx} className="list-disc ml-5 pl-1 text-slate-700 text-xs my-1 leading-relaxed">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-slate-900">{part}</strong> : part)}
          </li>
        );
      }

      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        const cleaned = numMatch[2];
        const parts = cleaned.split('**');
        return (
          <div key={idx} className="flex gap-2 text-xs text-slate-700 my-1 leading-relaxed pl-1">
            <span className="font-bold text-indigo-600 font-mono shrink-0">{numMatch[1]}.</span>
            <div>{parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-slate-900">{part}</strong> : part)}</div>
          </div>
        );
      }

      const parts = line.split('**');
      return (
        <p key={idx} className="text-xs text-slate-700 my-1 leading-relaxed">
          {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-slate-900">{part}</strong> : part)}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col gap-6" id="game-detail-view-container">
      
      {/* Top Action & Navigation Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Fixtures Draw</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('jarvis')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Bot className="w-4 h-4 text-indigo-200" />
            <span>Ask Jarvis AI Coach</span>
          </button>
        </div>
      </div>

      {/* Match Center Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6">
          
          {/* Match Badge Row */}
          <div className="flex items-center justify-between flex-wrap gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-bold uppercase tracking-wider">
                {matchFormat}
              </span>
              {fixture.league && (
                <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {fixture.league}
                </span>
              )}
              {fixture.matchId && (
                <span className="text-slate-400">
                  ID: {fixture.matchId}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-slate-300">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" />
                {fixture.date}
              </span>
              {fixture.time && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  {fixture.time}
                </span>
              )}
            </div>
          </div>

          {/* Teams Header Scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2 border-y border-slate-800/80">
            
            {/* Home Team */}
            <div className="md:col-span-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-inner shrink-0">
                {(fixture.homeTeam || 'H')[0]}
              </div>
              <div>
                <span className="text-xs uppercase font-mono tracking-widest text-indigo-400 font-bold block mb-0.5">
                  Home Team {fixture.venue === 'Home' ? '(My Club)' : ''}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-tight">
                  {fixture.homeTeam || (fixture.venue === 'Home' ? 'My Team' : opponentName)}
                </h2>
              </div>
            </div>

            {/* VS Badge / Result */}
            <div className="md:col-span-2 text-center py-2 md:py-0">
              {isPlayed ? (
                <div className="inline-flex flex-col items-center">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                    MATCH RESULT
                  </span>
                  <span className="text-xs text-slate-300 font-mono mt-1 font-bold">
                    {fixture.result}
                  </span>
                </div>
              ) : (
                <div className="inline-flex flex-col items-center">
                  <span className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono font-extrabold text-indigo-300 shadow-inner">
                    VS
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-bold mt-1">
                    {fixture.venue} Match
                  </span>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="md:col-span-5 flex items-center justify-start md:justify-end gap-4 text-left md:text-right">
              <div className="order-2 md:order-1">
                <span className="text-xs uppercase font-mono tracking-widest text-indigo-400 font-bold block mb-0.5">
                  Away Team {fixture.venue === 'Away' ? '(My Club)' : ''}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-tight">
                  {fixture.awayTeam || (fixture.venue === 'Away' ? 'My Team' : opponentName)}
                </h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 text-xl font-black shadow-inner shrink-0 order-1 md:order-2">
                {(fixture.awayTeam || opponentName || 'A')[0]}
              </div>
            </div>
          </div>

          {/* Conditions & Actions Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
            
            {/* Pitch & Weather Selectors */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-xs text-slate-400 font-mono font-medium">Pitch:</span>
                <select
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value as PitchType)}
                  className="bg-transparent text-xs font-bold font-mono text-indigo-300 outline-none cursor-pointer"
                >
                  <option value="Flat" className="bg-slate-900 text-white">Flat (Runs Galore)</option>
                  <option value="Green" className="bg-slate-900 text-white">Green (Seamers +15%)</option>
                  <option value="Dusty" className="bg-slate-900 text-white">Dusty (Spinners +20%)</option>
                  <option value="Hard" className="bg-slate-900 text-white">Hard (Pace &amp; Bounce)</option>
                  <option value="Cracked" className="bg-slate-900 text-white">Cracked (Variable Bounce)</option>
                  <option value="Uneven" className="bg-slate-900 text-white">Uneven (Low Bounce)</option>
                  <option value="Slow" className="bg-slate-900 text-white">Slow (Tricky Scoring)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-xs text-slate-400 font-mono font-medium">Weather:</span>
                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value as WeatherType)}
                  className="bg-transparent text-xs font-bold font-mono text-indigo-300 outline-none cursor-pointer"
                >
                  <option value="Sunny" className="bg-slate-900 text-white">Sunny</option>
                  <option value="Overcast" className="bg-slate-900 text-white">Overcast</option>
                  <option value="Humid" className="bg-slate-900 text-white">Humid</option>
                  <option value="Partially Cloudy" className="bg-slate-900 text-white">Partially Cloudy</option>
                  <option value="Windy" className="bg-slate-900 text-white">Windy</option>
                </select>
              </div>
            </div>

            {/* Sync Opponent Roster Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFetchOpponentSquadLive}
                disabled={isSyncingOpponent}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSyncingOpponent ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                    <span>Fetching Roster...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Sync Opponent Players Live</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {syncStatusMsg && (
            <div className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

        </div>
      </div>

      {/* Navigation Sub-tabs inside Game View */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Match Overview &amp; Tactical Dossier</span>
        </button>

        <button
          onClick={() => setActiveSubTab('lineups')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeTab === 'lineups'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-blue-300" />
          <span>Lineup Matchups ({myPlayers.length} vs {opponentPlayers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('opponent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeTab === 'opponent'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Swords className="w-4 h-4 text-purple-300" />
          <span>Opponent Players &amp; Ratings ({opponentPlayers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('jarvis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeTab === 'jarvis'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Bot className="w-4 h-4 text-indigo-300" />
          <span>Jarvis AI Assistant</span>
        </button>
      </div>

      {/* Manual HTML Paste Drawer (if opened) */}
      {showManualPaste && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-slate-800 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              Paste Opponent Roster HTML (`squad.asp`)
            </h4>
            <button
              onClick={() => setShowManualPaste(false)}
              className="text-xs font-mono font-bold text-amber-700 hover:underline cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            If you have copied the HTML source code from Battrick’s `squad.asp` page for {opponentName}, paste it below to extract their real player names and skills.
          </p>
          <textarea
            value={manualHtml}
            onChange={(e) => setManualHtml(e.target.value)}
            placeholder="Paste raw HTML here..."
            className="w-full h-32 p-3 text-xs font-mono bg-white border border-amber-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={handleParseManualHtml}
            className="mt-3 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-mono font-bold rounded-xl transition cursor-pointer"
          >
            Parse Roster HTML
          </button>
        </div>
      )}

      {/* TAB 1: MATCH OVERVIEW & TACTICAL DOSSIER */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Key Matchup Insights & 5th Bowler Vulnerability */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Quick Tactical Summary Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Target className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-serif font-bold text-slate-900 text-lg">
                      Tactical Scouting Dossier
                    </h3>
                    <p className="text-xs text-slate-500">
                      Key strengths, 5th bowler vulnerabilities &amp; recommended tactical posture
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-mono font-bold">
                  {scoutDossier.winProbability > 50 ? `Favored (${scoutDossier.winProbability}%)` : `Challenger (${scoutDossier.winProbability}%)`}
                </span>
              </div>

              {/* Pitch Matchup Banner */}
              <div className="bg-indigo-950 text-white p-4 rounded-xl mb-6">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-300 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Pitch &amp; Conditions Strategy: {pitch} Pitch
                </h4>
                <p className="text-xs text-indigo-100 leading-relaxed">
                  {pitch === 'Green' && 'Green pitch favors seam and fast bowlers (+15% movement). Consider bowling first if winning toss.'}
                  {pitch === 'Dusty' && 'Dusty pitch heavily favors spinners (+20% turn). Assign specialist spin attackers.'}
                  {pitch === 'Flat' && 'Flat pitch is a batsman paradise. High totals expected; bowl tightly and restrict 5th bowler leaks.'}
                  {pitch === 'Hard' && 'Hard pitch offers pace & true bounce. Fast seamers thrive in opening overs.'}
                  {pitch === 'Cracked' && 'Cracked pitch introduces uneven bounce variance. Spin and seamers both get assistance.'}
                  {pitch === 'Uneven' && 'Uneven pitch lowers bounce unpredictably. Keep bowling on stumps to force Lbws/Bowleds.'}
                  {pitch === 'Slow' && 'Slow pitch makes run-scoring difficult. Focus on stamina and disciplined line & length.'}
                </p>
              </div>

              {/* Vulnerabilities List */}
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-3">
                Identified Opponent Weaknesses ({scoutDossier.vulnerabilities.length})
              </h4>

              <div className="flex flex-col gap-3">
                {scoutDossier.vulnerabilities.map((vuln) => (
                  <div key={vuln.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {vuln.severity === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        ) : vuln.severity === 'moderate' ? (
                          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {vuln.title}
                        </span>
                      </div>
                      <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                        vuln.severity === 'critical' ? 'bg-rose-100 text-rose-800' :
                        vuln.severity === 'moderate' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {vuln.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                      {vuln.description}
                    </p>
                    <div className="text-[11px] font-mono text-indigo-700 font-semibold bg-indigo-50 border border-indigo-100 p-2 rounded-lg flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span><strong>Tactical Action:</strong> {vuln.tacticalAction}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* If Played Game: Actual Match Scorecard Summary */}
            {isPlayed && storedMatch && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-serif font-bold text-slate-900 text-lg mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Stored Match Scorecard &amp; Summary
                </h3>
                
                {storedMatch.summary && (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 leading-relaxed font-mono mb-4 whitespace-pre-line">
                    {storedMatch.summary}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {storedMatch.innings.map((inn, iIdx) => (
                    <div key={iIdx} className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                      <h4 className="font-bold text-indigo-950 text-xs mb-1 font-mono uppercase">
                        Innings {iIdx + 1}: {inn.teamName}
                      </h4>
                      <p className="text-sm font-bold text-slate-900 font-mono">
                        {inn.runs}/{inn.wickets} <span className="text-xs text-slate-500">({inn.overs} overs)</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Key Opponent Threats & Jarvis Launcher */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Key Opponent Threat Players */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-serif font-bold text-slate-900 text-lg mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                Key Opponent Threats
              </h3>

              <div className="flex flex-col gap-4">
                
                {/* Top Batters */}
                <div>
                  <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Top Batters to Dismiss
                  </h4>
                  <div className="flex flex-col gap-2">
                    {scoutDossier.keyThreats.batters.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">{b.name}</span>
                          <span className="text-[10.5px] text-slate-500 font-mono">
                            {b.role} • BTR: {b.btRating ? b.btRating.toLocaleString() : 'N/A'}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {b.estimatedSkillLabel || getSkillLabel('batting', b.batting || 8)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Bowlers */}
                <div>
                  <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Dangerous Opponent Bowlers
                  </h4>
                  <div className="flex flex-col gap-2">
                    {scoutDossier.keyThreats.bowlers.map((bw, bwIdx) => (
                      <div key={bwIdx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">{bw.name}</span>
                          <span className="text-[10.5px] text-slate-500 font-mono">
                            {bw.bowlingType || 'Seamer'} • BTR: {bw.btRating ? bw.btRating.toLocaleString() : 'N/A'}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                          {getSkillLabel('bowling', bw.bowling || 8)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Jarvis Launcher Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-indigo-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl">
                  <Bot className="w-6 h-6 text-indigo-100" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Ask Jarvis AI Coach</h3>
                  <p className="text-xs text-indigo-200">Tactical lineup analysis against {opponentName}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Coach Jarvis evaluates your squad skills against {opponentName}'s bowlers, pitch conditions ({pitch}), and weather to build winning match orders.
              </p>

              <button
                onClick={() => handleSendJarvisPrompt(`Provide optimal match orders and lineup recommendations for our upcoming ${matchFormat} game against ${opponentName} on a ${pitch} pitch.`)}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-mono text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Generate Full Lineup Strategy</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: LINEUP MATCHUPS */}
      {activeTab === 'lineups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* My Squad / Lineup */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-lg">My Squad &amp; Active XI</h3>
                  <p className="text-xs text-slate-500">{myPlayers.length} players loaded from local squad</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('squad')}
                className="text-xs font-mono font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Manage Squad →
              </button>
            </div>

            {myPlayers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-xs font-mono">No squad loaded yet. Import squad from Sync Hub.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {myPlayers.slice(0, 11).map((p, idx) => (
                  <div key={p.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">{p.name}</span>
                        <span className="text-[10.5px] text-slate-500 font-mono">
                          {p.role} • BTR: {p.btRating ? p.btRating.toLocaleString() : 'N/A'} {p.bowlingType ? `• ${p.bowlingType}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold" title="Batting Skill">
                        Bat: {getSkillLabel('batting', p.skills?.batting || 0)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold" title="Bowling Skill">
                        Bowl: {getSkillLabel('bowling', p.skills?.bowling || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opponent Roster */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Swords className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-lg">{opponentName} Roster</h3>
                  <p className="text-xs text-slate-500">{opponentPlayers.length} scouted / predicted players</p>
                </div>
              </div>
              <button
                onClick={handleFetchOpponentSquadLive}
                disabled={isSyncingOpponent}
                className="text-xs font-mono font-bold text-purple-600 hover:underline cursor-pointer"
              >
                Re-sync Live →
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {opponentPlayers.slice(0, 11).map((op, idx) => (
                <div key={op.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-purple-50/30 border border-purple-100">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{op.name}</span>
                      <span className="text-[10.5px] text-slate-500 font-mono">
                        {op.role || 'Player'} • BTR: {op.btRating ? op.btRating.toLocaleString() : 'N/A'} {op.bowlingType ? `• ${op.bowlingType}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                      {op.estimatedSkillLabel || getSkillLabel('batting', op.batting || 5)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: OPPONENT PLAYERS DETAILED TABLE */}
      {activeTab === 'opponent' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-serif font-bold text-slate-900 text-xl">
                {opponentName} — Full Player Details
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed skill ratings, BTR values, bowling styles &amp; historical averages
              </p>
            </div>
            
            <button
              onClick={handleFetchOpponentSquadLive}
              disabled={isSyncingOpponent}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSyncingOpponent ? 'animate-spin' : ''}`} />
              <span>Sync Live Squad</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Player Name</th>
                  <th className="py-3 px-4">Role / Type</th>
                  <th className="py-3 px-4">Age / BTR</th>
                  <th className="py-3 px-4">Batting</th>
                  <th className="py-3 px-4">Bowling</th>
                  <th className="py-3 px-4">Keeping / Stamina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {opponentPlayers.map((op, idx) => (
                  <tr key={op.id || idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{op.name}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">
                        {op.role || 'Player'} {op.bowlingType ? `(${op.bowlingType})` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {op.age ? `${op.age}yo` : ''} • {op.btRating ? op.btRating.toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {op.estimatedSkillLabel || getSkillLabel('batting', op.batting || 5)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {getSkillLabel('bowling', op.bowling || 5)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      Keep: {op.keeping || 0} • Stam: {op.stamina || 5}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: EMBEDDED JARVIS AI CHAT */}
      {activeTab === 'jarvis' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col h-[700px]">
          
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-inner">
                <Bot className="w-6 h-6 text-indigo-100" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-white tracking-tight flex items-center gap-2">
                  Coach Jarvis AI Assistant
                  <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold uppercase">
                    Tactical Match Analyst
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Contextualized for {fixture.homeTeam || 'My Team'} vs {opponentName} ({matchFormat})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMessages([])}
                className="text-xs font-mono text-slate-400 hover:text-white transition px-2 py-1 rounded bg-slate-800"
                title="Clear Chat History"
              >
                Clear History
              </button>
            </div>
          </div>

          {/* Prompt Chips Bar */}
          <div className="bg-slate-50 p-3 px-6 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0 uppercase tracking-wider">
              Quick Prompts:
            </span>

            <button
              onClick={() => handleSendJarvisPrompt(`Compare my XI against ${opponentName}'s key players and pinpoint our biggest advantages.`)}
              className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 transition shrink-0 cursor-pointer shadow-2xs"
            >
              🎯 Lineup Comparison
            </button>

            <button
              onClick={() => handleSendJarvisPrompt(`How should I order my top 6 batsmen against ${opponentName}'s opening pace attack on a ${pitch} pitch?`)}
              className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 transition shrink-0 cursor-pointer shadow-2xs"
            >
              🏏 Batting Order Strategy
            </button>

            <button
              onClick={() => handleSendJarvisPrompt(`Identify ${opponentName}'s 5th bowler vulnerability and how we should attack them.`)}
              className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 transition shrink-0 cursor-pointer shadow-2xs"
            >
              ⚡ 5th Bowler Attack
            </button>

            <button
              onClick={() => handleSendJarvisPrompt(`What bowling rotation and tactics should I assign on a ${pitch} pitch against ${opponentName}?`)}
              className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 transition shrink-0 cursor-pointer shadow-2xs"
            >
              🌀 Bowling Rotation
            </button>

            <button
              onClick={() => handleSendJarvisPrompt(`Provide optimal match orders (GFI/PAN/TIE), toss choice, and XI selection for this game.`)}
              className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold transition shrink-0 cursor-pointer shadow-2xs"
            >
              🏆 Full Match Orders
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
                }`}>
                  {msg.role === 'user' ? 'ME' : <Bot className="w-4 h-4 text-indigo-300" />}
                </div>

                <div className={`p-4 rounded-2xl text-xs sm:text-sm shadow-2xs ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white font-medium rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none leading-relaxed'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-line">{msg.content}</p>
                  ) : (
                    <div>{renderMarkdown(msg.content)}</div>
                  )}

                  <span className={`text-[10px] font-mono block mt-2 ${
                    msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                  }`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isJarvisThinking && (
              <div className="flex items-center gap-3 text-slate-500 font-mono text-xs p-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                  <RotateCw className="w-4 h-4 text-indigo-400 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-2xs">
                  <span>Coach Jarvis is evaluating match context and calculating optimal tactical orders...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendJarvisPrompt();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={`Ask Jarvis about your lineup vs ${opponentName}...`}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isJarvisThinking}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 px-4 rounded-xl transition flex items-center gap-1.5 font-mono text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Ask Jarvis</span>
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  );
}
