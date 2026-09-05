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
  TEST_MATCHES,
  parseBattrickPlayerDetails,
  estimatePlayerSkills
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
  Clipboard,
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
  RefreshCw,
  Lock,
  ShieldCheck,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Gauge
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
  // Navigation Sub-tab: match_analyzer | fixtures_scout | dossier | player_scout
  const [activeSubTab, setActiveSubTab] = useState<'match_analyzer' | 'fixtures_scout' | 'dossier' | 'player_scout'>('match_analyzer');

  // 1. My Squad Context
  const [mySquad, setMySquad] = useState<BattrickPlayer[]>(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bt_squad') : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [myTeamName, setMyTeamName] = useState<string>(() => {
    try {
      const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('bt_team_name') : null;
      if (savedName && savedName.trim() && savedName !== 'My Battrick IQ Club' && savedName !== 'My Club') {
        return savedName.trim();
      }
    } catch {}
    return 'HairyBeanBags';
  });

  // 2. Selected Opponent & Match Settings
  const [opponentName, setOpponentName] = useState<string>('Steve');
  const [opponentTeamId, setOpponentTeamId] = useState<string>('');
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('One Day');
  const [pitch, setPitch] = useState<PitchType>('Green');
  const [weather, setWeather] = useState<WeatherType>('Overcast');
  const [venue, setVenue] = useState<'Home' | 'Away'>('Home');
  const [dossierMatchEffort, setDossierMatchEffort] = useState<'take it easy' | 'normal' | 'go for it!'>('go for it!');

  // 3. Opponent Squad Data
  const [opponentPlayers, setOpponentPlayers] = useState<OpponentPlayer[]>(() => generateRealisticOpponentRoster('Steve', false, 'One Day'));
  
  // Sorting States for Tables
  const [lineupSortField, setLineupSortField] = useState<string>('order');
  const [lineupSortDirection, setLineupSortDirection] = useState<'asc' | 'desc'>('asc');

  const [batterSortField, setBatterSortField] = useState<string>('order');
  const [batterSortDirection, setBatterSortDirection] = useState<'asc' | 'desc'>('asc');

  const [bowlerSortField, setBowlerSortField] = useState<string>('index');
  const [bowlerSortDirection, setBowlerSortDirection] = useState<'asc' | 'desc'>('asc');

  const [fixturesSortField, setFixturesSortField] = useState<string>('index');
  const [fixturesSortDirection, setFixturesSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleLineupSort = (field: string) => {
    if (lineupSortField === field) {
      setLineupSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLineupSortField(field);
      setLineupSortDirection(field === 'name' || field === 'order' ? 'asc' : 'desc');
    }
  };

  const handleBatterSort = (field: string) => {
    if (batterSortField === field) {
      setBatterSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBatterSortField(field);
      setBatterSortDirection(field === 'name' || field === 'order' ? 'asc' : 'desc');
    }
  };

  const handleBowlerSort = (field: string) => {
    if (bowlerSortField === field) {
      setBowlerSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBowlerSortField(field);
      setBowlerSortDirection(field === 'name' || field === 'index' ? 'asc' : 'desc');
    }
  };

  const handleFixturesSort = (field: string) => {
    if (fixturesSortField === field) {
      setFixturesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setFixturesSortField(field);
      setFixturesSortDirection('asc');
    }
  };

  const renderSortableTh = (label: string, field: string, currentField: string, direction: 'asc' | 'desc', onSort: (field: string) => void, className = "") => {
    const isSorted = currentField === field;
    const isRight = className.includes('text-right');
    const isLeft = className.includes('text-left') || className === '';
    return (
      <th 
        onClick={() => onSort(field)}
        className={`py-2.5 px-3 cursor-pointer select-none hover:bg-slate-150 hover:text-slate-900 transition-colors group font-mono font-bold ${className}`}
      >
        <div className={`inline-flex items-center gap-1 ${isRight ? 'justify-end w-full' : isLeft ? 'justify-start' : 'justify-center'}`}>
          <span>{label}</span>
          <span className={`shrink-0 transition-opacity ${isSorted ? 'text-blue-600 opacity-100' : 'opacity-40 group-hover:opacity-100 text-slate-400'}`}>
            {isSorted ? (
              direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </span>
        </div>
      </th>
    );
  };

  const [pastedText, setPastedText] = useState<string>('');
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // 4. Fixtures Parsing Drawer
  const [isFixturesPasteOpen, setIsFixturesPasteOpen] = useState<boolean>(false);
  const [pastedFixturesText, setPastedFixturesText] = useState<string>('');

  // 5. Match & Summary Intelligence State
  const [matchIdInput, setMatchIdInput] = useState<string>('32554717');
  const [pastedMatchText, setPastedMatchText] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [modalUsername, setModalUsername] = useState<string>(() => {
    try {
      return localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
    } catch {
      return '';
    }
  });
  const [modalPassword, setModalPassword] = useState<string>('');
  const [activeParsedMatch, setActiveParsedMatch] = useState<ParsedBattrickMatch>(() => {
    const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('bt_team_name') : null;
    const name = savedName && savedName.trim() ? savedName.trim() : 'HairyBeanBags';
    const savedSquadStr = typeof localStorage !== 'undefined' ? localStorage.getItem('bt_squad') : null;
    const squad = savedSquadStr ? JSON.parse(savedSquadStr) : [];
    return getExampleMatchDataById('32554717', name, squad);
  });
  const [selectedTeamTab, setSelectedTeamTab] = useState<'home' | 'away'>('away');
  const [isFetchingMatch, setIsFetchingMatch] = useState<boolean>(false);
  const [fetchingMatchId, setFetchingMatchId] = useState<string | null>(null);
  const [fetchStatusMessage, setFetchStatusMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Live Squad Sync State
  const [isSyncingSquad, setIsSyncingSquad] = useState<boolean>(false);
  const [squadSyncStatus, setSquadSyncStatus] = useState<string | null>(null);
  const [squadSyncError, setSquadSyncError] = useState<string | null>(null);

  // Live Player Sync State
  const [scoutedPlayer, setScoutedPlayer] = useState<BattrickPlayer | null>(null);
  const [scoutPlayerId, setScoutPlayerId] = useState<string>('');
  const [isSyncingPlayer, setIsSyncingPlayer] = useState<boolean>(false);
  const [playerSyncStatus, setPlayerSyncStatus] = useState<string | null>(null);
  const [playerSyncError, setPlayerSyncError] = useState<string | null>(null);
  const [pastedPlayerText, setPastedPlayerText] = useState<string>('');
  const [isPlayerPasteOpen, setIsPlayerPasteOpen] = useState<boolean>(false);


  const handleSyncPlayerLive = async () => {
    if (!scoutPlayerId.trim()) {
      setPlayerSyncError('Please enter a valid Battrick Player ID.');
      return;
    }
    setScoutedPlayer(null);
    setIsSyncingPlayer(true);
    setPlayerSyncError(null);
    setPlayerSyncStatus(`Syncing Player ID #${scoutPlayerId} from Battrick servers...`);

    try {
      const username = localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
      const password = sessionStorage.getItem('bt_direct_pass') || localStorage.getItem('bt_direct_pass') || '';
      const sessionToken = localStorage.getItem('bt_sync_session') || '';

      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: 'playerdetails.asp',
          pageUrl: `https://www.battrick.org/nl/playerdetails.asp?playerID=${scoutPlayerId.trim()}`,
          username,
          password,
          sessionToken
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to sync player page.`);
      }

      const data = await res.json();
      if (data.sessionToken) {
        localStorage.setItem('bt_sync_session', data.sessionToken);
      }
      if (data.success && data.html) {
        const parsed = parseBattrickPlayerDetails(data.html);
        if (parsed) {
          setScoutedPlayer(parsed);
          setPlayerSyncStatus(`Successfully scouted player ${parsed.name} live!`);
        } else {
          throw new Error('Failed to parse player details from HTML.');
        }
      } else {
        throw new Error(data.error || 'Battrick server returned empty details page.');
      }
    } catch (err: any) {
      console.warn('Live player sync failed, using mock demo player:', err);
      setPlayerSyncError(`${err.message || 'Error connecting.'} Displaying interactive demo player.`);
      
      const fallback: BattrickPlayer = {
        id: scoutPlayerId,
        name: 'Gary Sobers',
        age: 22,
        btRating: 28450,
        wage: 3450,
        bowlingType: 'Fast Medium',
        role: 'All-rounder',
        form: 8,
        fitness: 8,
        battingFormLabel: 'superb',
        fitnessLabel: 'fit',
        skills: {
          batting: 11, // superb
          bowling: 3,  // woeful
          keeping: 2,  // abysmal
          concentration: 10, // strong
          consistency: 9, // proficient
          fielding: 8,  // proficient
          stamina: 7,   // respectable
          leadership: 5,
          experience: 4
        },
        nets: {
          batting: 0,
          bowling: 0,
          keeping: 0,
          fielding: 0,
          stamina: 0
        }
      };
      setScoutedPlayer(fallback);
    } finally {
      setIsSyncingPlayer(false);
      setTimeout(() => setPlayerSyncStatus(null), 5000);
    }
  };

  const handleParsePastedPlayer = () => {
    if (!pastedPlayerText.trim()) {
      setPlayerSyncError('Please paste player details HTML content.');
      return;
    }
    try {
      const parsed = parseBattrickPlayerDetails(pastedPlayerText);
      if (parsed) {
        setScoutedPlayer(parsed);
        setPastedPlayerText('');
        setIsPlayerPasteOpen(false);
        setPlayerSyncStatus(`Successfully updated scouted player: ${parsed.name}!`);
        setTimeout(() => setPlayerSyncStatus(null), 4000);
      } else {
        setPlayerSyncError('Could not parse player details. Ensure you copied the entire page source.');
      }
    } catch (err: any) {
      setPlayerSyncError(`Parsing failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Load user data on mount and listen to storage synchronization events
  const loadLocalData = () => {
    try {
      const savedSquadStr = localStorage.getItem('bt_squad');
      const loadedSquad = savedSquadStr ? JSON.parse(savedSquadStr) : [];
      if (loadedSquad.length > 0) setMySquad(loadedSquad);

      const savedName = localStorage.getItem('bt_team_name');
      const loadedTeamName = savedName && savedName.trim() ? savedName.trim() : myTeamName;
      if (savedName) setMyTeamName(loadedTeamName);

      const savedFixtures = localStorage.getItem('bt_fixtures');
      let loadedFixtures: BattrickGame[] = [];
      if (savedFixtures) {
        try {
          loadedFixtures = JSON.parse(savedFixtures);
          setFixtures(loadedFixtures);
        } catch {
          loadedFixtures = parseFixtures('');
          setFixtures(loadedFixtures);
        }
      } else {
        // Populate default user fixtures from real schedule
        loadedFixtures = parseFixtures('');
        setFixtures(loadedFixtures);
      }

      let activeMatchId = '32554717';
      const savedScoutTarget = localStorage.getItem('bt_scout_target_team');
      let targetTeamName = '';
      let targetTeamId = '';
      let targetMatchId = '';
      let targetType = '';
      
      if (savedScoutTarget) {
        try {
          const target = JSON.parse(savedScoutTarget);
          if (target.teamName) {
            targetTeamName = target.teamName;
            targetTeamId = target.teamId || '';
            targetMatchId = target.matchId || '';
            targetType = target.type || '';
          }
        } catch (e) {
          console.error('Error parsing scout target team:', e);
        }
      }

      if (targetTeamName) {
        setOpponentName(targetTeamName);
        setOpponentTeamId(targetTeamId);
        if (targetType) {
          setMatchFormat(normalizeMatchFormat(targetType));
        }
        if (targetMatchId) {
          activeMatchId = targetMatchId;
          setMatchIdInput(targetMatchId);
        }
        setActiveSubTab('dossier');
        setOpponentPlayers(generateRealisticOpponentRoster(targetTeamName, false, normalizeMatchFormat(targetType || 'One Day'), targetTeamId));
      } else if (loadedFixtures.length > 0) {
        const firstGame = loadedFixtures[0];
        setOpponentName(firstGame.opponent);
        setOpponentTeamId('');
        setMatchFormat(normalizeMatchFormat(firstGame.type));
        setVenue(firstGame.venue);
        if (firstGame.matchId) {
          activeMatchId = firstGame.matchId;
          setMatchIdInput(firstGame.matchId);
        }
        setOpponentPlayers(generateRealisticOpponentRoster(firstGame.opponent, firstGame.isBot, normalizeMatchFormat(firstGame.type)));
      }

      // Ensure activeParsedMatch is loaded with the user's team name and squad
      setActiveParsedMatch(getExampleMatchDataById(activeMatchId, loadedTeamName, loadedSquad));

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
  };

  useEffect(() => {
    loadLocalData();
    window.addEventListener('storage', loadLocalData);
    return () => window.removeEventListener('storage', loadLocalData);
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
      localStorage.setItem('bt_fixtures', JSON.stringify(parsed));
      window.dispatchEvent(new Event('storage'));
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
      const example = getExampleMatchDataById(matchIdInput || '32554717', myTeamName, mySquad);
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
    const matchData = getExampleMatchDataById(mId, myTeamName, mySquad);
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
    setOpponentTeamId(game.opponentTeamId || '');
    setMatchFormat(normalizeMatchFormat(game.type));
    setVenue(game.venue);

    if (game.matchId) {
      setMatchIdInput(game.matchId);
    }
    setOpponentPlayers(generateRealisticOpponentRoster(game.opponent, game.isBot, normalizeMatchFormat(game.type), game.opponentTeamId));
    localStorage.setItem('bt_scout_target_team', JSON.stringify({
      teamName: game.opponent,
      teamId: game.opponentTeamId || '',
      matchId: game.matchId,
      type: game.type,
      venue: game.venue
    }));
    setActiveSubTab('dossier');
  };

  const handleScoutLineupPlayer = (p: OpponentPlayer) => {
    const batVal = p.batting || 0;
    const bowlVal = p.bowling || 0;
    const effectiveId = p.playerId ? String(p.playerId) : (p.id ? String(p.id) : '0');
    const converted: BattrickPlayer = {
      id: effectiveId,
      name: p.name,
      age: p.age,
      wage: p.wage,
      btRating: p.btRating,
      role: p.role,
      bowlingType: p.bowlingType,
      battingFormLabel: p.battingFormLabel || 'respectable',
      fitnessLabel: p.fitnessLabel || 'fit',
      form: 6,
      fitness: 6,
      skills: {
        batting: batVal,
        bowling: bowlVal,
        keeping: p.keeping || 1,
        concentration: p.concentration || 6,
        consistency: p.consistency || 6,
        fielding: p.fielding || 6,
        stamina: p.stamina || 6,
        leadership: 5,
        experience: p.experience || 5
      },
      nets: {
        batting: 0,
        bowling: 0,
        keeping: 0,
        fielding: 0,
        stamina: 0
      }
    };
    setScoutedPlayer(converted);
    setScoutPlayerId(effectiveId);
    setActiveSubTab('player_scout');
  };

  const handleAnalyzeFixtureMatch = (game: BattrickGame) => {
    if (game.matchId) {
      setMatchIdInput(game.matchId);
      const matchData = getExampleMatchDataById(game.matchId, myTeamName, mySquad);
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
      const username = localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
      const password = sessionStorage.getItem('bt_direct_pass') || localStorage.getItem('bt_direct_pass') || '';
      const sessionToken = localStorage.getItem('bt_sync_session') || '';

      // If no session token or password stored, prompt immediately for quick authentication
      if (!password && !sessionToken) {
        setIsFetchingMatch(false);
        setModalUsername(username);
        setModalPassword('');
        setFetchError(`Authentication required to fetch Match #${targetMatchId} live from Battrick.`);
        setIsAuthModalOpen(true);
        return;
      }

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
        const isAuthFailure = response.status === 401 || data.isAuthFailure || data.message?.toLowerCase().includes('credentials') || data.message?.toLowerCase().includes('login') || data.message?.toLowerCase().includes('session') || data.error?.toLowerCase().includes('login') || data.error?.toLowerCase().includes('session');
        if (isAuthFailure) {
          sessionStorage.removeItem('bt_direct_pass');
          localStorage.removeItem('bt_direct_pass');
          localStorage.removeItem('bt_sync_session');
          setModalUsername(username);
          setModalPassword('');
          setIsAuthModalOpen(true);
        }
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
      const fallbackData = getExampleMatchDataById(targetMatchId, myTeamName, mySquad);
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

  const handleSyncOpponentSquadLive = async () => {
    const targetTeamId = opponentTeamId.trim();
    if (!targetTeamId) {
      setSquadSyncError('Opponent Team ID is required for live sync. Please manually enter the Team ID (e.g. 14112) in the input field above.');
      return;
    }
    
    setOpponentPlayers([]);
    setIsSyncingSquad(true);
    setSquadSyncStatus(`Connecting to Battrick server and fetching Squad ID ${targetTeamId}...`);
    setSquadSyncError(null);

    // Notify app-wide sync indicator
    try {
      window.dispatchEvent(new Event('bt_datasync_start'));
    } catch {}

    try {
      const username = localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
      const password = sessionStorage.getItem('bt_direct_pass') || localStorage.getItem('bt_direct_pass') || '';
      const sessionToken = localStorage.getItem('bt_sync_session') || '';

      // If no credentials and no session, open the credentials modal
      if (!password && !sessionToken) {
        setIsSyncingSquad(false);
        setModalUsername(username);
        setModalPassword('');
        setSquadSyncError(`Authentication required to fetch squad live from Battrick.`);
        setIsAuthModalOpen(true);
        return;
      }

      const response = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: 'squad',
          teamId: targetTeamId,
          username,
          password,
          sessionToken
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const isAuthFailure = response.status === 401 || data.isAuthFailure || data.message?.toLowerCase().includes('credentials') || data.message?.toLowerCase().includes('login') || data.message?.toLowerCase().includes('session') || data.error?.toLowerCase().includes('login') || data.error?.toLowerCase().includes('session');
        if (isAuthFailure) {
          sessionStorage.removeItem('bt_direct_pass');
          localStorage.removeItem('bt_direct_pass');
          localStorage.removeItem('bt_sync_session');
          setModalUsername(username);
          setModalPassword('');
          setIsAuthModalOpen(true);
        }
        throw new Error(data.message || data.error || `HTTP ${response.status}: Failed to fetch squad from Battrick.`);
      }

      if (data.sessionToken) {
        localStorage.setItem('bt_sync_session', data.sessionToken);
      }

      if (!data.html) {
        throw new Error("Battrick returned empty response for squad list.");
      }

      // Parse the HTML content using our parseOpponentSquad parser!
      const parsedPlayers = parseOpponentSquad(data.html, opponentName, targetTeamId);
      if (parsedPlayers.length === 0) {
        throw new Error("Failed to extract any player statistics. Please verify the Opponent Team ID is correct.");
      }

      // Map parsed BattrickPlayer[] to OpponentPlayer[]
      const mappedPlayers: OpponentPlayer[] = parsedPlayers.map((p, idx) => {
        const batVal = p.skills.batting;
        const bowlVal = p.skills.bowling;
        const isKeeper = p.primaryRoleClassifier === 'Wicketkeeper';
        
        // Use realistic averages or fallback averages
        const batAvg = (p as any).battingAverage !== undefined ? (p as any).battingAverage : (p.role === 'Batter' || p.role === 'Keeper' ? 52.4 : 12.4);
        const bowlAvg = (p as any).bowlingAverage !== undefined ? (p as any).bowlingAverage : (p.role === 'Bowler' ? 24.8 : 0);

        return {
          id: p.id,
          name: p.name,
          age: p.age,
          wage: p.wage,
          btRating: p.btRating,
          role: p.role as any,
          bowlingType: p.bowlingType || 'None',
          batting: batVal,
          bowling: bowlVal,
          keeping: p.skills.keeping,
          stamina: p.skills.stamina,
          experience: p.skills.experience,
          concentration: p.skills.concentration,
          consistency: p.skills.consistency,
          fielding: p.skills.fielding,
          order: idx + 1,
          battingHand: p.battingHand,
          battingStyle: p.battingStyle,
          bowlingHand: p.bowlingHand,
          bowlingStyle: p.bowlingStyle,
          bowlingAggression: p.bowlingAggression,
          battingFormLabel: p.battingFormLabel,
          bowlingFormLabel: p.bowlingFormLabel,
          fitnessLabel: p.fitnessLabel,
          estimatedSkillLabel: p.estimatedSkillLabel,
          estimatedSkillLevel: p.estimatedSkillLevel,
          primaryRoleClassifier: p.primaryRoleClassifier,
          battingAverage: batAvg,
          bowlingAverage: bowlAvg
        };
      });

      setOpponentPlayers(mappedPlayers);
      setSquadSyncStatus(`✓ Successfully fetched & analyzed ${mappedPlayers.length} players for ${opponentName} (ID: ${targetTeamId}) live from Battrick!`);
    } catch (err: any) {
      console.warn('Squad live fetch error:', err);
      setSquadSyncError(
        err.message?.includes('credentials') || err.message?.includes('Login')
          ? `${err.message} Setup credentials in Sync Hub for automatic live connection.`
          : `${err.message}`
      );
    } finally {
      setIsSyncingSquad(false);
      try {
        window.dispatchEvent(new Event('bt_datasync_complete'));
      } catch {}
      // Clear status after 5s
      setTimeout(() => setSquadSyncStatus(null), 5000);
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
            <span>Summary Intelligence</span>
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
            <span>Fixtures & Opponents ({fixtures.length})</span>
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
            <span>Scout a Team</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('player_scout')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'player_scout'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Scout a Player</span>
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
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-mono flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{fetchError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setModalUsername(localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '');
                      setModalPassword('');
                      setIsAuthModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Enter Password & Fetch Match #{matchIdInput}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sync')}
                    className="underline font-bold text-rose-700 hover:text-rose-900 cursor-pointer text-[11px]"
                  >
                    Sync Hub Settings →
                  </button>
                </div>
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
                    {renderSortableTh('#', 'order', batterSortField, batterSortDirection, handleBatterSort, "w-12")}
                    {renderSortableTh('Batter', 'name', batterSortField, batterSortDirection, handleBatterSort, "text-left font-sans")}
                    {renderSortableTh('Battrick Grouping', 'group', batterSortField, batterSortDirection, handleBatterSort, "text-left")}
                    {renderSortableTh('Dismissal', 'dismissal', batterSortField, batterSortDirection, handleBatterSort, "text-left font-sans")}
                    {renderSortableTh('Runs', 'runs', batterSortField, batterSortDirection, handleBatterSort, "text-right")}
                    {renderSortableTh('Balls', 'balls', batterSortField, batterSortDirection, handleBatterSort, "text-right")}
                    {renderSortableTh('4s', 'fours', batterSortField, batterSortDirection, handleBatterSort, "text-right")}
                    {renderSortableTh('6s', 'sixes', batterSortField, batterSortDirection, handleBatterSort, "text-right")}
                    {renderSortableTh('SR', 'strikeRate', batterSortField, batterSortDirection, handleBatterSort, "text-right")}
                    {renderSortableTh('Estimated Grade', 'grade', batterSortField, batterSortDirection, handleBatterSort, "text-left font-sans")}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {[...activeInnings.batters]
                    .sort((a, b) => {
                      let valA: any = a[batterSortField as keyof typeof a];
                      let valB: any = b[batterSortField as keyof typeof b];

                      if (batterSortField === 'grade') {
                        valA = a.estimatedSkillGrade || '';
                        valB = b.estimatedSkillGrade || '';
                      }

                      if (typeof valA === 'string' && typeof valB === 'string') {
                        return batterSortDirection === 'asc' 
                          ? valA.localeCompare(valB) 
                          : valB.localeCompare(valA);
                      } else {
                        const numA = Number(valA) || 0;
                        const numB = Number(valB) || 0;
                        return batterSortDirection === 'asc' ? numA - numB : numB - numA;
                      }
                    })
                    .map((b) => {
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
                      {renderSortableTh('#', 'index', bowlerSortField, bowlerSortDirection, handleBowlerSort, "w-12")}
                      {renderSortableTh('Bowler', 'name', bowlerSortField, bowlerSortDirection, handleBowlerSort, "text-left font-sans")}
                      {renderSortableTh('Overs', 'overs', bowlerSortField, bowlerSortDirection, handleBowlerSort, "text-left")}
                      {renderSortableTh('Maidens', 'maidens', bowlerSortField, bowlerSortDirection, handleBowlerSort, "text-left")}
                      {renderSortableTh('Runs', 'runs', bowlerSortField, bowlerSortDirection, handleBowlerSort, "text-left")}
                      {renderSortableTh('Wickets', 'wickets', bowlerSortField, bowlerSortDirection, handleBowlerSort, "text-left")}
                      {renderSortableTh('Economy', 'economy', bowlerSortField, bowlerSortDirection, handleBowlerSort, "text-left")}
                      <th className="py-2.5 px-3 font-mono font-bold">Attack Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {[...activeInnings.bowlers]
                      .map((bw, idx) => ({ ...bw, originalIndex: idx }))
                      .sort((a, b) => {
                        let valA: any = a[bowlerSortField as keyof typeof a];
                        let valB: any = b[bowlerSortField as keyof typeof b];

                        if (bowlerSortField === 'index') {
                          valA = a.originalIndex;
                          valB = b.originalIndex;
                        }

                        if (typeof valA === 'string' && typeof valB === 'string') {
                          return bowlerSortDirection === 'asc' 
                            ? valA.localeCompare(valB) 
                            : valB.localeCompare(valA);
                        } else {
                          const numA = Number(valA) || 0;
                          const numB = Number(valB) || 0;
                          return bowlerSortDirection === 'asc' ? numA - numB : numB - numA;
                        }
                      })
                      .map((bw) => {
                        const cleanBowlerName = bw.name
                          .replace(/\(5th Bowler - /gi, '(')
                          .replace(/5th Bowler \/ /gi, '')
                          .replace(/\(5th Bowler\)/gi, '')
                          .trim();
                        const isFifthBowler = bw.originalIndex === 4;
                        const isPartTimer = bw.originalIndex >= 5;
                        const isHighEcon = bw.economy >= 6.5;

                        return (
                          <tr key={bw.originalIndex} className={isFifthBowler || isPartTimer || isHighEcon ? 'bg-amber-50/40 font-bold' : ''}>
                            <td className="py-2 px-3 text-slate-400">{bw.originalIndex + 1}</td>
                            <td className="py-2 px-3 font-sans text-slate-900">{cleanBowlerName}</td>
                            <td className="py-2 px-3 text-slate-700">{bw.overs}</td>
                            <td className="py-2 px-3 text-slate-600">{bw.maidens}</td>
                            <td className="py-2 px-3 text-slate-900">{bw.runs}</td>
                            <td className="py-2 px-3 font-bold text-blue-700">{bw.wickets}</td>
                            <td className="py-2 px-3">{bw.economy.toFixed(2)}</td>
                            <td className="py-2 px-3">
                              {isFifthBowler ? (
                                <span className="text-[10px] text-amber-900 bg-amber-100 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                  5th Bowler Target
                                </span>
                              ) : isPartTimer ? (
                                <span className="text-[10px] text-purple-800 bg-purple-100 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                  Part-Timer / 6th+
                                </span>
                              ) : bw.originalIndex <= 1 ? (
                                <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Frontline Opener</span>
                              ) : (
                                <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Frontline Change</span>
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
                    {renderSortableTh('Date & Time', 'date', fixturesSortField, fixturesSortDirection, handleFixturesSort, "text-left")}
                    {renderSortableTh('Format', 'type', fixturesSortField, fixturesSortDirection, handleFixturesSort, "text-left")}
                    {renderSortableTh('Opponent', 'opponent', fixturesSortField, fixturesSortDirection, handleFixturesSort, "text-left font-sans")}
                    {renderSortableTh('Venue', 'venue', fixturesSortField, fixturesSortDirection, handleFixturesSort, "text-left")}
                    {renderSortableTh('Match ID', 'matchId', fixturesSortField, fixturesSortDirection, handleFixturesSort, "text-left")}
                    <th className="py-2.5 px-3 text-right">Scout & Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...fixtures]
                    .map((f, idx) => ({ ...f, originalIndex: idx }))
                    .sort((a, b) => {
                      let valA: any = a[fixturesSortField as keyof typeof a];
                      let valB: any = b[fixturesSortField as keyof typeof b];

                      if (fixturesSortField === 'index') {
                        valA = a.originalIndex;
                        valB = b.originalIndex;
                      }

                      if (typeof valA === 'string' && typeof valB === 'string') {
                        return fixturesSortDirection === 'asc' 
                          ? valA.localeCompare(valB) 
                          : valB.localeCompare(valA);
                      } else {
                        const numA = Number(valA) || 0;
                        const numB = Number(valB) || 0;
                        return fixturesSortDirection === 'asc' ? numA - numB : numB - numA;
                      }
                    })
                    .map((f) => {
                      const isCup = f.type === 'Cup';
                      const isFC = f.type === 'First Class';
                      const isOD = f.type === 'One Day';
                      const isBT20 = f.type === 'Twenty20';

                      return (
                        <tr key={f.originalIndex} className="hover:bg-slate-50/80 transition">
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
          
          {/* Scout any team helpful card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Scout External Teams & Opponents</span>
              </h4>
              <p className="text-xs text-slate-500">
                You can scout <strong>any Battrick team</strong> (even if they are in different leagues or not on your current fixture ladder). Simply enter their <strong>Battrick Team ID</strong> below to sync their squad, or use the paste button to copy-paste their roster source code.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsInputOpen(!isInputOpen)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold font-mono flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Clipboard className="w-3.5 h-3.5 text-slate-600" />
              <span>{isInputOpen ? 'Hide Paste Area' : 'Paste Squad HTML'}</span>
            </button>
          </div>

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

          {/* Team Search Input Bar - Matches the style of the Player Scout input bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1.5">
                  Battrick Team ID
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={opponentTeamId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOpponentTeamId(val);
                      setOpponentPlayers(generateRealisticOpponentRoster(opponentName, false, matchFormat, val));
                    }}
                    placeholder="Enter Battrick Team ID (e.g. 24514)"
                    className="w-full pl-10 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncOpponentSquadLive}
                disabled={isSyncingSquad}
                className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-mono font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSquad ? 'animate-spin' : ''}`} />
                <span>{isSyncingSquad ? 'Syncing...' : '⚡ Sync Live Squad'}</span>
              </button>
            </div>

            {squadSyncStatus && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{squadSyncStatus}</span>
              </div>
            )}
            {squadSyncError && (
              <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono font-bold px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{squadSyncError}</span>
              </div>
            )}
          </div>

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
                        setOpponentPlayers(generateRealisticOpponentRoster(name, false, matchFormat, opponentTeamId));
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

          {/* Live Team Rating & Batstats Predictor */}
          {dossier.players.length > 0 && (() => {
            const ratingData = calculateBattrickMatchRatings(dossier.players, dossierMatchEffort);
            return (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="space-y-1">
                    <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-indigo-600 animate-pulse" />
                      <span>Live Squad Rating & Batstats Predictor</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Calculate predicted team sector ratings and Batstats for the scouted XI.
                    </p>
                  </div>

                  {/* Match Effort Selector Option */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setDossierMatchEffort('take it easy')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                        dossierMatchEffort === 'take it easy'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Take It Easy
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierMatchEffort('normal')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                        dossierMatchEffort === 'normal'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierMatchEffort('go for it!')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                        dossierMatchEffort === 'go for it!'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Go For It!
                    </button>
                  </div>
                </div>

                {/* Grid of predicted sectors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  <div className="bg-white border border-slate-200/50 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Top Order</span>
                    <strong className="text-slate-950 text-sm font-serif block capitalize">{ratingData.topOrder}</strong>
                  </div>
                  <div className="bg-white border border-slate-200/50 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Middle Order</span>
                    <strong className="text-slate-950 text-sm font-serif block capitalize">{ratingData.middleOrder}</strong>
                  </div>
                  <div className="bg-white border border-slate-200/50 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Lower Order</span>
                    <strong className="text-slate-950 text-sm font-serif block capitalize">{ratingData.lowerOrder}</strong>
                  </div>
                  <div className="bg-white border border-slate-200/50 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Seam Bowling</span>
                    <strong className="text-slate-950 text-sm font-serif block capitalize">{ratingData.seamBowling}</strong>
                  </div>
                  <div className="bg-white border border-slate-200/50 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Spin Bowling</span>
                    <strong className="text-slate-950 text-sm font-serif block capitalize">{ratingData.spinBowling}</strong>
                  </div>
                  <div className="bg-white border border-slate-200/50 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Fielding</span>
                    <strong className="text-slate-950 text-sm font-serif block capitalize">{ratingData.fielding}</strong>
                  </div>
                  <div className="bg-indigo-600 p-3.5 rounded-xl text-center space-y-1 shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-indigo-200 block">Batstats</span>
                    <strong className="text-white text-base font-mono font-black block">{ratingData.batStats}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Opponent Scouted 11 Players Roster Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Scouted Lineup:</span>
                  {(() => {
                    const effectiveTeamId = opponentTeamId || 
                      fixtures.find(f => f.opponent.toLowerCase().trim() === dossier.clubName.toLowerCase().trim())?.opponentTeamId || 
                      fixtures.find(f => f.opponent.toLowerCase().includes(dossier.clubName.toLowerCase()) || dossier.clubName.toLowerCase().includes(f.opponent.toLowerCase()))?.opponentTeamId ||
                      dossier.players.find(p => p.teamId)?.teamId;
                    const squadUrl = effectiveTeamId 
                      ? `https://www.battrick.org/nl/squad.asp?teamID=${effectiveTeamId}`
                      : `https://www.battrick.org/nl/search.asp?searchtype=team&searchtext=${encodeURIComponent(dossier.clubName)}`;
                    return (
                      <a 
                        href={squadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-sans font-bold bg-blue-50/50 border border-blue-100 px-2.5 py-0.5 rounded-lg transition"
                        title={`View ${dossier.clubName} squad on Battrick`}
                      >
                        <span>{dossier.clubName}</span>
                        {effectiveTeamId && <span className="text-xs font-mono font-normal text-slate-500">(ID: {effectiveTeamId})</span>}
                        <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                      </a>
                    );
                  })()}
                  <span className="text-sm font-sans font-normal text-slate-500">({dossier.players.length} Players)</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Click on the Team link or any Player name to open their live Battrick record.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                  Avg Wage: £{Math.round(dossier.players.reduce((acc, p) => acc + p.wage, 0) / (dossier.players.length || 1)).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono">
                    {renderSortableTh('#', 'order', lineupSortField, lineupSortDirection, handleLineupSort, "w-12")}
                    {renderSortableTh('Player Card / Link', 'name', lineupSortField, lineupSortDirection, handleLineupSort, "text-left font-sans")}
                    {renderSortableTh('Battrick Grouping', 'grouping', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('Avg - Batting', 'battingAverage', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('Avg - Bowling', 'bowlingAverage', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('Keeping', 'keeping', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('Estimated Grade', 'grade', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('BTR', 'btr', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('Wage', 'wage', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('Skills (Bat/Bowl)', 'batting', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    {renderSortableTh('Stamina', 'stamina', lineupSortField, lineupSortDirection, handleLineupSort, "text-left")}
                    <th className="py-2.5 px-3">Vulnerability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...dossier.players]
                    .map((p, idx) => ({ ...p, originalIndex: idx }))
                    .sort((a, b) => {
                      let valA: any = a[lineupSortField as keyof typeof a];
                      let valB: any = b[lineupSortField as keyof typeof b];

                      if (lineupSortField === 'order') {
                        valA = a.originalIndex;
                        valB = b.originalIndex;
                      } else if (lineupSortField === 'name') {
                        valA = a.name;
                        valB = b.name;
                      } else if (lineupSortField === 'grouping') {
                        const getGrp = (p: typeof a) => {
                          const batAvg = p.battingAverage !== undefined ? p.battingAverage : (p.role === 'Batter' || p.role === 'Keeper' ? 52.4 : 12.4);
                          const bowlAvg = p.bowlingAverage !== undefined ? p.bowlingAverage : (p.role === 'Bowler' ? 24.8 : 0);
                          const isBowler = bowlAvg < 30 && bowlAvg > 0;
                          const isBatter = batAvg > 40;
                          if (isBowler && isBatter) return 'All-rounder';
                          if (isBowler) return 'Bowler';
                          if (isBatter) return 'Batter';
                          return p.role;
                        };
                        valA = getGrp(a);
                        valB = getGrp(b);
                      } else if (lineupSortField === 'battingAverage') {
                        valA = a.battingAverage || 0;
                        valB = b.battingAverage || 0;
                      } else if (lineupSortField === 'bowlingAverage') {
                        valA = a.bowlingAverage || 0;
                        valB = b.bowlingAverage || 0;
                      } else if (lineupSortField === 'keeping') {
                        valA = a.keeping || 0;
                        valB = b.keeping || 0;
                      } else if (lineupSortField === 'grade') {
                        valA = a.estimatedSkillLabel || '';
                        valB = b.estimatedSkillLabel || '';
                      } else if (lineupSortField === 'btr') {
                        valA = a.btRating;
                        valB = b.btRating;
                      } else if (lineupSortField === 'wage') {
                        valA = a.wage;
                        valB = b.wage;
                      } else if (lineupSortField === 'batting') {
                        valA = a.batting;
                        valB = b.batting;
                      } else if (lineupSortField === 'bowling') {
                        valA = a.bowling;
                        valB = b.bowling;
                      } else if (lineupSortField === 'stamina') {
                        valA = a.stamina;
                        valB = b.stamina;
                      }

                      if (typeof valA === 'string' && typeof valB === 'string') {
                        return lineupSortDirection === 'asc' 
                          ? valA.localeCompare(valB) 
                          : valB.localeCompare(valA);
                      } else {
                        const numA = Number(valA) || 0;
                        const numB = Number(valB) || 0;
                        return lineupSortDirection === 'asc' ? numA - numB : numB - numA;
                      }
                    })
                    .map((p, displayIdx) => {
                      const isTail = p.originalIndex >= 6 && p.batting <= 5;
                      const isPartTimer = p.originalIndex >= 6 && p.bowling >= 5 && p.bowling <= 7;
                      
                      // Determine Averages & Custom Grouping logic
                      const batAvg = p.battingAverage !== undefined ? p.battingAverage : (p.role === 'Batter' || p.role === 'Keeper' ? 52.4 : 12.4);
                      const bowlAvg = p.bowlingAverage !== undefined ? p.bowlingAverage : (p.role === 'Bowler' ? 24.8 : 0);
                      
                      // Classification logic based on user's definition: 
                      // "Grady is a bowler as his batting average is below 50 and his bowling average is below 30"
                      const hasHiddenSkills = p.batting === 0 && p.bowling === 0;
                      const est = hasHiddenSkills ? estimatePlayerSkills(
                        p.wage,
                        p.btRating,
                        p.careerStats?.runs ?? (p.role === 'Batter' ? 1200 : 80),
                        p.careerStats?.overs ?? (p.role === 'Bowler' ? 140 : 0),
                        p.careerStats?.matches ?? 32
                      ) : null;

                      // Classification logic based on user's definition: 
                      // If bowlingAverage < 30 (and > 0), they are a 'Bowler'.
                      // If battingAverage >= 40, they are a 'Batter'.
                      // If both (bowlingAverage < 30 AND battingAverage >= 40), they are an 'All-rounder'.
                      const isBowler = bowlAvg < 30 && bowlAvg > 0;
                      const isBatter = batAvg >= 40;
                      let computedGrouping: string = p.primaryRoleClassifier || p.role;
                      if (isBowler && isBatter) {
                        computedGrouping = 'All-rounder';
                      } else if (isBowler) {
                        computedGrouping = 'Bowler';
                      } else if (isBatter) {
                        computedGrouping = 'Batter';
                      } else if (p.keeping >= 5 || (p.role as string) === 'Keeper' || (p.role as string) === 'Wicketkeeper') {
                        computedGrouping = 'Keeper';
                      } else if (hasHiddenSkills && est?.discipline) {
                        computedGrouping = est.discipline;
                      }

                      // Badge Styling
                      let groupBadgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                      if (computedGrouping === 'Bowler') {
                        groupBadgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
                      } else if (computedGrouping === 'Batter') {
                        groupBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      } else if (computedGrouping === 'All-rounder' || computedGrouping === 'All-Rounder') {
                        groupBadgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
                      } else if (computedGrouping === 'Keeper') {
                        groupBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                      }

                      const effectivePlayerId = p.playerId || (/^\d+$/.test(p.id) ? p.id : undefined);
                      const playerLink = effectivePlayerId
                        ? `https://www.battrick.org/nl/playerdetails.asp?playerID=${effectivePlayerId}`
                        : `https://www.battrick.org/nl/search.asp?searchtype=player&searchtext=${encodeURIComponent(p.name)}`;

                      return (
                        <React.Fragment key={p.id}>
                          {displayIdx === 11 && lineupSortField === 'order' && (
                            <tr className="bg-slate-200/50 text-slate-500 uppercase text-[10px] font-bold font-sans">
                              <td colSpan={12} className="py-1.5 px-3 tracking-widest text-center border-t border-b border-slate-300/50">
                                — Bench / Reserves —
                              </td>
                            </tr>
                          )}
                          <tr className={`hover:bg-slate-50/80 transition ${isTail ? 'bg-rose-50/20' : ''}`}>
                          <td className="py-3 px-3 font-mono font-bold text-slate-400">{p.originalIndex + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col gap-0.5">
                              <a 
                                href={playerLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                                title={`Open ${p.name} profile on Battrick`}
                              >
                                <span>{p.name}</span>
                                <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                              </a>
                              <span className="text-[10px] text-slate-500 font-mono font-medium">
                                {p.age} yo • {effectivePlayerId ? `ID: ${effectivePlayerId}` : 'Roster Player'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleScoutLineupPlayer(p)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                              title="Open in Skills Estimator & Tactical Coach"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-500" />
                              <span>Scout</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${groupBadgeStyle}`}>
                              {computedGrouping} {hasHiddenSkills ? '⭐' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs font-semibold">{batAvg > 0 ? batAvg.toFixed(1) : '-'}</td>
                        <td className="py-3 px-3 font-mono text-xs font-semibold">{bowlAvg > 0 ? bowlAvg.toFixed(1) : '-'}</td>
                        <td className="py-3 px-3 font-mono text-xs font-semibold">{p.keeping || '-'}</td>
                        <td className="py-3 px-3">
                          <span className="font-serif font-semibold text-xs text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            {hasHiddenSkills ? est!.primarySkill : (p.estimatedSkillLabel || 'Strong')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                          {p.btRating.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">
                          £{p.wage.toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          {hasHiddenSkills ? (
                            <div className="flex flex-col gap-0.5 font-mono text-[9px] leading-tight">
                              <div className="text-emerald-700 font-extrabold">{est!.primarySkill}</div>
                              <div className="text-amber-700 font-semibold">{est!.secondaries}</div>
                              <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-wider">(Estimated)</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5 font-mono">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">Bat:</span>
                                <span className={`font-bold ${p.batting >= 10 ? 'text-emerald-600' : p.batting <= 4 ? 'text-rose-600' : 'text-slate-800'}`}>
                                  {getSkillLabel('batting', p.batting)} ({p.batting})
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">Bowl:</span>
                                <span className={`font-bold ${p.bowling >= 10 ? 'text-blue-600' : 'text-slate-500'}`}>
                                  {p.bowling >= 3 ? `${getSkillLabel('bowling', p.bowling)} (${p.bowling})` : '—'}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {hasHiddenSkills ? (
                            <span className="text-[10px] text-slate-400 italic font-bold">Estimated</span>
                          ) : (
                            getSkillLabel('stamina', p.stamina)
                          )}
                        </td>
                        <td className="py-3 px-3">
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
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: SCOUT A PLAYER                                    */}
      {/* ========================================================= */}
      {activeSubTab === 'player_scout' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Scout External Player Profiles</span>
              </h4>
              <p className="text-xs text-slate-500">
                Type any Battrick Player ID to fetch their live skills, ratings, and form, or copy-paste their player page source code below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPlayerPasteOpen(!isPlayerPasteOpen)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold font-mono flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Clipboard className="w-3.5 h-3.5 text-slate-600" />
              <span>{isPlayerPasteOpen ? 'Hide Paste Area' : 'Paste Player HTML'}</span>
            </button>
          </div>

          {/* Paste Player Drawer */}
          {isPlayerPasteOpen && (
            <div className="p-5 rounded-2xl bg-white border border-blue-200 space-y-3 animate-fadeIn shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Paste Player Details Source Code (playerdetails.asp)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsPlayerPasteOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Close ✕
                </button>
              </div>
              <textarea
                rows={5}
                value={pastedPlayerText}
                onChange={(e) => setPastedPlayerText(e.target.value)}
                placeholder="Paste the player details HTML page source code here..."
                className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleParsePastedPlayer}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition shadow cursor-pointer font-mono"
                >
                  Parse Pasted Player
                </button>
              </div>
            </div>
          )}

          {/* Player Search Input Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1.5">
                  Battrick Player ID
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scoutPlayerId}
                    onChange={(e) => setScoutPlayerId(e.target.value)}
                    placeholder="Enter Battrick Player ID (e.g. 5634292)"
                    className="w-full pl-10 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncPlayerLive}
                disabled={isSyncingPlayer}
                className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-mono font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPlayer ? 'animate-spin' : ''}`} />
                <span>{isSyncingPlayer ? 'Syncing...' : '⚡ Sync Live Player'}</span>
              </button>
            </div>

            {playerSyncStatus && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{playerSyncStatus}</span>
              </div>
            )}
            {playerSyncError && (
              <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono font-bold px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{playerSyncError}</span>
              </div>
            )}
          </div>

          {/* Scouted Player Dossier Summary Card */}
          {scoutedPlayer ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
              
              {/* Column 1: Core Details Card (4 cols) */}
              <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Scouted External Profile
                      </span>
                      <a
                        href={`https://www.battrick.org/nl/playerdetails.asp?playerID=${scoutedPlayer.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>Live BT</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <h3 className="font-serif font-bold text-xl text-slate-900 mt-2">
                      {scoutedPlayer.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      ID: {scoutedPlayer.id} • Age: {scoutedPlayer.age}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">BTR (Rating)</span>
                      <strong className="text-slate-800 text-sm">{(scoutedPlayer.btRating || 0).toLocaleString()}</strong>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Wage</span>
                      <strong className="text-slate-800 text-sm">£{(scoutedPlayer.wage || 0).toLocaleString()}</strong>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Form</span>
                      <strong className="text-emerald-600 text-xs font-bold uppercase">{scoutedPlayer.battingFormLabel || 'respectable'}</strong>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Fatigue</span>
                      <strong className="text-slate-700 text-xs font-bold uppercase">{scoutedPlayer.fitnessLabel || 'fit'}</strong>
                    </div>
                  </div>

                  {/* Classification Badge */}
                  <div className="pt-2">
                    <span className="text-xs font-bold block text-slate-500 mb-1.5 font-mono">Computed Class:</span>
                    {(() => {
                      const hasHidden = scoutedPlayer.skills.batting === 0 && scoutedPlayer.skills.bowling === 0;
                      if (hasHidden) {
                        const estimation = estimatePlayerSkills(
                          scoutedPlayer.wage,
                          scoutedPlayer.btRating,
                          500,
                          20,
                          30
                        );
                        return (
                          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                              {estimation.discipline} (Estimated)
                            </span>
                            <p className="text-[11px] text-slate-500 leading-relaxed pt-1 font-medium">
                              Based on salary (£{scoutedPlayer.wage.toLocaleString()}) calibrated for {estimation.discipline} discipline.
                            </p>
                          </div>
                        );
                      }

                      const isBowler = scoutedPlayer.skills.bowling > scoutedPlayer.skills.batting && scoutedPlayer.skills.bowling >= 6;
                      const isBatter = scoutedPlayer.skills.batting > scoutedPlayer.skills.bowling && scoutedPlayer.skills.batting >= 6;
                      const isKeeper = scoutedPlayer.skills.keeping >= 5;
                      const isAllRounder = !isKeeper && scoutedPlayer.skills.batting >= 6 && scoutedPlayer.skills.bowling >= 6;

                      let label = 'Tail-ender';
                      let desc = 'Minimal tactical threat; easy bowling target.';
                      let badgeBg = 'bg-slate-50 text-slate-700 border-slate-200';

                      if (isKeeper) {
                        label = 'Wicket-Keeper / Batsman';
                        desc = 'Specialist glover. Focus on testing their concentration.';
                        badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                      } else if (isAllRounder) {
                        label = 'All-Rounder';
                        desc = 'High versatility. Key wicket target in any format.';
                        badgeBg = 'bg-purple-50 text-purple-700 border-purple-200';
                      } else if (isBowler) {
                        label = 'Bowler';
                        desc = 'Specialist bowler. Advise caution during their spell.';
                        badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
                      } else if (isBatter) {
                        label = 'Specialist Batsman';
                        desc = 'Elite run-getter. Deploy strike bowlers & tight fielding.';
                        badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      }

                      return (
                        <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-1">
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                            {label}
                          </span>
                          <p className="text-[11px] text-slate-500 leading-relaxed pt-1 font-medium">
                            {desc}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl font-mono text-[10px] text-slate-400 text-center font-bold">
                  Battrick skill ranges are 0 to 20+.
                </div>
              </div>

              {/* Unified Panel: Skills Estimator & Tactical Coach Intelligence (8 cols) */}
              <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
                
                {/* Panel Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <h3 className="font-serif font-bold text-xl text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      <span>Skills Estimator & Tactical Coach Intelligence</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Unified capability model & tactical scouting report for {scoutedPlayer.name}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-indigo-50 border border-indigo-200/80 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto">
                    {scoutedPlayer.skills.batting === 0 && scoutedPlayer.skills.bowling === 0 ? 'Skills Estimator Active' : 'Confirmed Skills Active'}
                  </span>
                </div>

                {/* Section A: Skills Estimator prominent metrics */}
                {(() => {
                  const estimation = estimatePlayerSkills(
                    scoutedPlayer.wage,
                    scoutedPlayer.btRating,
                    500,
                    20,
                    30
                  );

                  return (
                    <div className="space-y-4">
                      {/* Prominent High-Impact Blocks */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Estimated Class */}
                        <div className="bg-gradient-to-br from-indigo-50/70 via-indigo-50/30 to-slate-50 border border-indigo-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono font-extrabold uppercase text-indigo-900/70 tracking-wider">
                              Estimated Class:
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">
                              Discipline
                            </span>
                          </div>
                          <div>
                            <div className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight">
                              {estimation.discipline}
                            </div>
                            <p className="text-[11px] font-sans text-indigo-800/80 mt-1 font-medium">
                              Derived from salary (£{scoutedPlayer.wage.toLocaleString()}) & BTR ({scoutedPlayer.btRating.toLocaleString()})
                            </p>
                          </div>
                        </div>

                        {/* Estimated Primary */}
                        <div className="bg-gradient-to-br from-emerald-50/70 via-emerald-50/30 to-slate-50 border border-emerald-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono font-extrabold uppercase text-emerald-900/70 tracking-wider">
                              Estimated Primary:
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                              Benchmark
                            </span>
                          </div>
                          <div>
                            <div className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tight">
                              {estimation.primarySkill}
                            </div>
                            <p className="text-[11px] font-sans text-emerald-800/80 mt-1 font-medium">
                              Skill bracket calibrated to Battrick economy curve
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Secondaries */}
                      <div className="bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-slate-50 border border-amber-200/90 rounded-2xl p-5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-extrabold uppercase text-amber-900/80 tracking-wider block">
                              Secondaries:
                            </span>
                            <p className="text-xs font-sans text-slate-600 font-medium">
                              Support attributes including stamina, consistency, and fielding capabilities
                            </p>
                          </div>
                          <span className="text-base sm:text-xl font-black text-amber-950 bg-amber-100/90 border border-amber-300/80 px-4 py-2.5 rounded-xl font-mono text-left sm:text-right shadow-2xs shrink-0">
                            {estimation.secondaries}
                          </span>
                        </div>
                      </div>

                      {/* Detailed Skill Matrix if visible */}
                      {(scoutedPlayer.skills.batting > 0 || scoutedPlayer.skills.bowling > 0) && (
                        <div className="pt-2">
                          <span className="text-xs font-mono font-bold uppercase text-slate-500 tracking-wider block mb-2.5">
                            Confirmed Skill Ratings:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {[
                              { key: 'batting', label: 'Batting', val: scoutedPlayer.skills.batting },
                              { key: 'bowling', label: 'Bowling', val: scoutedPlayer.skills.bowling },
                              { key: 'keeping', label: 'Keeping', val: scoutedPlayer.skills.keeping },
                              { key: 'concentration', label: 'Concentration', val: scoutedPlayer.skills.concentration },
                              { key: 'consistency', label: 'Consistency', val: scoutedPlayer.skills.consistency },
                              { key: 'fielding', label: 'Fielding', val: scoutedPlayer.skills.fielding },
                              { key: 'stamina', label: 'Stamina', val: scoutedPlayer.skills.stamina, isStamina: true },
                              { key: 'experience', label: 'Experience', val: scoutedPlayer.skills.experience || 4 },
                            ].map((s) => {
                              const levelName = getSkillLabel(s.isStamina ? 'stamina' : 'batting', s.val);
                              return (
                                <div key={s.key} className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl flex flex-col justify-between">
                                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{s.label}</span>
                                  <div className="mt-1 flex items-baseline justify-between">
                                    <span className={`text-xs font-bold font-mono ${s.val >= 10 ? 'text-emerald-700' : s.val <= 3 ? 'text-rose-600' : 'text-slate-800'}`}>
                                      {levelName}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                      ({s.val})
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Section B: Tactical Coach Insights */}
                <div className="pt-4 border-t border-slate-100 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    <h4 className="font-serif font-bold text-base text-slate-900">
                      Tactical Coach Insights & Matchup Playbook
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs font-medium">
                    {/* Core Threat Vector */}
                    <div className="bg-emerald-50/40 border border-emerald-200/80 p-4 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                            ✓
                          </div>
                          <strong className="text-emerald-950 font-bold uppercase tracking-wider text-[11px]">Core Threat Vector</strong>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-sans text-xs">
                          {(() => {
                            if (scoutedPlayer.skills.batting >= 10) return `${scoutedPlayer.name} has elite batting skill (${scoutedPlayer.skills.batting}). They can anchor large partnerships and score heavily on flat pitches.`;
                            if (scoutedPlayer.skills.bowling >= 10) return `Highly dangerous bowling threat with ${scoutedPlayer.skills.bowling} skill level. They will generate high dot ball pressure and pick up top-order wickets easily.`;
                            const isAllRounder = scoutedPlayer.skills.batting >= 6 && scoutedPlayer.skills.bowling >= 6;
                            if (isAllRounder) return `Strong all-rounder. Contributes in both departments, representing a dual tactical threat.`;
                            return `Standard ratings. A useful squad option, but does not present a severe dominant threat vector.`;
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Tactical Vulnerability */}
                    <div className="bg-rose-50/40 border border-rose-200/80 p-4 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                            !
                          </div>
                          <strong className="text-rose-950 font-bold uppercase tracking-wider text-[11px]">Tactical Vulnerability</strong>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-sans text-xs">
                          {(() => {
                            const weaknesses: string[] = [];
                            if (scoutedPlayer.skills.stamina <= 5) weaknesses.push(`Low Stamina (${scoutedPlayer.skills.stamina}) ensures performance decays rapidly in deep match sessions.`);
                            if (scoutedPlayer.skills.concentration <= 5 && scoutedPlayer.skills.batting >= 5) weaknesses.push(`Low Concentration (${scoutedPlayer.skills.concentration}) makes them prone to throwing away wickets against patient bowling.`);
                            if (scoutedPlayer.skills.consistency <= 5 && scoutedPlayer.skills.bowling >= 5) weaknesses.push(`Low Consistency (${scoutedPlayer.skills.consistency}) leads to frequent boundary-conceding bad balls.`);
                            if (weaknesses.length === 0) {
                              return `${scoutedPlayer.name} is a balanced, consistent player. No severe skill deficiencies detected.`;
                            }
                            return weaknesses.join(' • ');
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Matchup Strategy */}
                    <div className="bg-indigo-50/40 border border-indigo-200/80 p-4 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            ★
                          </div>
                          <strong className="text-indigo-950 font-bold uppercase tracking-wider text-[11px]">Matchup Strategy</strong>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-sans text-xs">
                          {(() => {
                            const isBowler = scoutedPlayer.skills.bowling > scoutedPlayer.skills.batting && scoutedPlayer.skills.bowling >= 6;
                            const isBatter = scoutedPlayer.skills.batting > scoutedPlayer.skills.bowling && scoutedPlayer.skills.batting >= 6;
                            
                            if (isBatter) {
                              return `When bowling to ${scoutedPlayer.name}, prioritize bowler consistency. Set defensive fields on flat decks or select high-spin bowlers if on dusty wickets.`;
                            }
                            if (isBowler) {
                              return `Against ${scoutedPlayer.name}'s bowling spell, advise your batsmen to play defensively or target other bowlers in the line-up.`;
                            }
                            return `Standard approach recommended. Exploit stamina decay in secondary spell or play aggressively against their part-time bowlers.`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400 font-serif">
              <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <span>No player scouted yet. Enter a Battrick Player ID above and click sync, or paste page HTML to generate a live dossier!</span>
            </div>
          )}

        </div>
      )}

      {/* Inline Quick Authentication Modal for Live Match Fetching */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-slate-900">Authenticate Battrick Session</h3>
                  <p className="text-[11px] font-mono text-slate-500">Live fetch for Match #{matchIdInput}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Your Battrick session has expired or requires a password. Enter your credentials below to authenticate directly with Battrick and fetch Match #{matchIdInput}.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!modalUsername.trim() || !modalPassword) return;
                localStorage.setItem('bt_battrick_username', modalUsername.trim());
                sessionStorage.setItem('bt_direct_pass', modalPassword);
                setIsAuthModalOpen(false);
                await handleDirectFetchMatch(matchIdInput);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-slate-600 block mb-1">
                  Battrick Username
                </label>
                <input
                  type="text"
                  value={modalUsername}
                  onChange={(e) => setModalUsername(e.target.value)}
                  placeholder="Your Battrick username"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-slate-600 block mb-1">
                  Battrick Password
                </label>
                <input
                  type="password"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="Your Battrick password"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] font-mono text-slate-500 flex items-start gap-1.5 mt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Password is held securely in tab session memory (`sessionStorage`) for your current use and automatically removed on log out or timeout.</span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-mono font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Use Simulated Model
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Authenticate & Fetch Match</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// =========================================================
// BATTRICK MATCH ENGINE RATING & BATSTATS CALCULATOR
// =========================================================

const CALC_SKILL_MAP: Record<string, number> = {
  "worthless": 1, "abysmal": 2, "woeful": 3, "feeble": 4, "mediocre": 5,
  "competent": 6, "respectable": 7, "proficient": 8, "strong": 9, "superb": 10,
  "quality": 11, "remarkable": 12, "wonderful": 13, "exquisite": 14,
  "masterful": 15, "sensational": 16, "elite": 17, "miraculous": 18
};

const CALC_MULTIPLIERS = {
  form: {
    "worthless": 0.50, "abysmal": 0.65, "woeful": 0.75, "feeble": 0.85,
    "mediocre": 0.95, "competent": 1.00, "respectable": 1.05, "proficient": 1.10,
    "strong": 1.15, "superb": 1.25
  } as Record<string, number>,
  fitness: {
    "sublime": 1.10, "invigorated": 1.05, "energetic": 1.00,
    "fresh": 0.95, "lively": 0.90, "fair": 0.80
  } as Record<string, number>,
  effort: {
    "take it easy": 0.85,
    "normal": 1.00,
    "go for it!": 1.20
  } as Record<string, number>
};

function getCalcRatingLabel(score: number): string {
  if (score >= 17.0) return "elite";
  if (score >= 15.0) return "sensational";
  if (score >= 13.5) return "masterful";
  if (score >= 12.0) return "remarkable";
  if (score >= 10.5) return "wonderful";
  if (score >= 9.5)  return "superb";
  if (score >= 8.5)  return "strong";
  if (score >= 7.0)  return "respectable";
  if (score >= 5.5)  return "proficient";
  if (score >= 4.0)  return "competent";
  if (score >= 3.0)  return "feeble";
  if (score >= 2.0)  return "woeful";
  return "abysmal";
}

function getCalcPlayerBattingWeight(player: any, matchEffort: string): number {
  let bat = player.skills?.batting || player.batting || 0;
  if (bat === 0 && player.estimatedSkillLevel) bat = player.estimatedSkillLevel;
  else if (bat === 0) bat = 1;
  
  let conc = player.skills?.concentration || player.concentration || 0;
  if (conc === 0 && player.estimatedSkillLevel) conc = Math.max(1, player.estimatedSkillLevel - 1);
  else if (conc === 0) conc = 1;

  const formStr = (player.battingFormLabel || player.skills?.battingForm || "respectable").toLowerCase().trim();
  const form = CALC_MULTIPLIERS.form[formStr] || 1.0;
  const fitStr = (player.fitnessLabel || player.skills?.fitness || "energetic").toLowerCase().trim();
  const fit = CALC_MULTIPLIERS.fitness[fitStr] || 1.0;
  const effort = CALC_MULTIPLIERS.effort[matchEffort] || 1.0;

  const baseRating = (bat * 0.70) + (conc * 0.30);
  return baseRating * form * fit * effort;
}

function getCalcPlayerBowlingWeight(player: any, matchEffort: string): number {
  let bowl = player.skills?.bowling || player.bowling || 0;
  if (bowl === 0 && player.estimatedSkillLevel) bowl = player.estimatedSkillLevel;
  else if (bowl === 0) bowl = 1;

  let cons = player.skills?.consistency || player.consistency || 0;
  if (cons === 0 && player.estimatedSkillLevel) cons = Math.max(1, player.estimatedSkillLevel - 1);
  else if (cons === 0) cons = 1;

  const formStr = (player.bowlingFormLabel || player.skills?.bowlingForm || "respectable").toLowerCase().trim();
  const form = CALC_MULTIPLIERS.form[formStr] || 1.0;
  const fitStr = (player.fitnessLabel || player.skills?.fitness || "energetic").toLowerCase().trim();
  const fit = CALC_MULTIPLIERS.fitness[fitStr] || 1.0;
  const effort = CALC_MULTIPLIERS.effort[matchEffort] || 1.0;

  const baseRating = (bowl * 0.70) + (cons * 0.30);
  return baseRating * form * fit * effort;
}

export function calculateBattrickMatchRatings(squadLineup: any[], matchEffort: string = "go for it!") {
  const isSpin = (type: string) => {
    const t = (type || '').toLowerCase();
    return t.includes('spin') || t.includes('break') || t.includes('orthodox') || t.includes('spinner');
  };
  const isSeam = (type: string) => {
    const t = (type || '').toLowerCase();
    return t.includes('fast') || t.includes('medium') || t.includes('seam') || t.includes('rf') || t.includes('fm') || t.includes('lf') || t.includes('lm') || t.includes('rm');
  };

  // We should only assess the top 11 players for the predictor
  const startingXI = squadLineup.slice(0, 11);

  const topOrderPlayers = startingXI.slice(0, 3);
  const midOrderPlayers = startingXI.slice(3, 7);
  const lowOrderPlayers = startingXI.slice(7, 11);

  const topAvg = topOrderPlayers.length ? topOrderPlayers.reduce((a, p) => a + getCalcPlayerBattingWeight(p, matchEffort), 0) / topOrderPlayers.length : 1;
  const midAvg = midOrderPlayers.length ? midOrderPlayers.reduce((a, p) => a + getCalcPlayerBattingWeight(p, matchEffort), 0) / midOrderPlayers.length : 1;
  const lowAvg = lowOrderPlayers.length ? lowOrderPlayers.reduce((a, p) => a + getCalcPlayerBattingWeight(p, matchEffort), 0) / lowOrderPlayers.length : 1;

  // We should ONLY count players assigned to bowl (if this information is missing, we check roles, but for now we look at the whole XI and grab bowlers)
  const seamBowlers = startingXI.filter(p => isSeam(p.bowlingType) && (p.role === 'Bowler' || p.role === 'All-rounder' || p.primaryRoleClassifier === 'Bowler' || p.primaryRoleClassifier === 'All-Rounder' || startingXI.indexOf(p) >= 6));
  const spinBowlers = startingXI.filter(p => isSpin(p.bowlingType) && (p.role === 'Bowler' || p.role === 'All-rounder' || p.primaryRoleClassifier === 'Bowler' || p.primaryRoleClassifier === 'All-Rounder' || startingXI.indexOf(p) >= 6));

  const seamAvg = seamBowlers.length ? seamBowlers.reduce((a, p) => a + getCalcPlayerBowlingWeight(p, matchEffort), 0) / seamBowlers.length : 1;
  const spinAvg = spinBowlers.length ? spinBowlers.reduce((a, p) => a + getCalcPlayerBowlingWeight(p, matchEffort), 0) / spinBowlers.length : 1;

  const avgFielding = startingXI.length ? startingXI.reduce((a, p) => {
    let f = p.skills?.fielding || p.fielding || 0;
    if (f === 0 && p.estimatedSkillLevel) f = Math.max(1, p.estimatedSkillLevel - 2);
    else if (f === 0) f = 1;
    return a + f;
  }, 0) / startingXI.length : 1;
  
  const avgExperience = startingXI.length ? startingXI.reduce((a, p) => {
    let e = p.skills?.experience || p.experience || 0;
    if (e === 0) e = 5; // decent baseline for unknown experience
    return a + e;
  }, 0) / startingXI.length : 1;

  const effortMultiplier = CALC_MULTIPLIERS.effort[matchEffort] || 1.0;
  
  // Batstats formula adjustment for more realistic 100k-250k ratings
  // Battrick batstats are roughly (sum of ratings) * some huge multiplier
  const rawBatstats = ((topAvg * 11) + (midAvg * 11) + (lowAvg * 5) + (seamAvg * 8) + (spinAvg * 8) + (avgFielding * 4) + (avgExperience * 2)) * 1250 * effortMultiplier;

  return {
    matchEffortUsed: matchEffort,
    topOrder: getCalcRatingLabel(topAvg),
    middleOrder: getCalcRatingLabel(midAvg),
    lowerOrder: getCalcRatingLabel(lowAvg),
    seamBowling: getCalcRatingLabel(seamAvg),
    spinBowling: getCalcRatingLabel(spinAvg),
    fielding: getCalcRatingLabel(avgFielding),
    batStats: Math.round(rawBatstats)
  };
}
