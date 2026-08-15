import React, { useState, useEffect, useRef } from 'react';
import { BattrickPlayer, ClubFinances, BattrickGame, PavilionInfo } from '../types';
import { parseBattrickPage, isNameMatch } from '../parser';
import { mergePlayerAndTrackHistory, generateRealisticHistory } from '../utils/history';
import { 
  SAMPLE_SQUAD_HTML, 
  SAMPLE_NETS_HTML, 
  SAMPLE_FINANCES_HTML, 
  SAMPLE_CLUB_HTML,
  SAMPLE_FIXTURES_HTML,
  SAMPLE_PAVILION_HTML
} from '../mockData';
import { 
  Upload, Trash2, CheckCircle, Sparkles, RefreshCw, 
  Users, Coins, AlertCircle,
  Trophy, Calculator, 
  Calendar, Landmark as StadiumIcon, ShieldCheck,
  Check, Wifi, Activity, CheckSquare, Square, Clipboard, ArrowRight,
  KeyRound, Play, CheckCircle2, XCircle, Clock, ArrowUpRight, Zap,
  Loader2
} from 'lucide-react';

export interface SequentialStepItem {
  id: string;
  label: string;
  subLabel: string;
  urlLabel: string;
  icon: any;
  color: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  message: string;
  statBadge?: string;
  error?: string;
}

export interface SequentialModalState {
  isOpen: boolean;
  isProcessing: boolean;
  isComplete: boolean;
  hasErrors: boolean;
  currentStepIndex: number;
  totalSteps: number;
  progressPercent: number;
  activeStepName: string;
  activeDetail: string;
  steps: SequentialStepItem[];
  completedStats: { label: string; value: string | number }[];
}

interface SyncLog {
  timestamp: string;
  type: string;
  description: string;
  status: 'success' | 'failed';
}

interface SyncHubProps {
  setActiveTab?: (tab: 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules') => void;
}

interface SyncOptionItem {
  id: string;
  label: string;
  url: string;
  description: string;
  icon: any;
  color: string;
}

const AVAILABLE_SYNC_OPTIONS: SyncOptionItem[] = [
  {
    id: 'squad',
    label: 'Squad Roster',
    url: 'squad.asp',
    description: 'Player attributes, skills, age, weekly wages, BTR ratings and records',
    icon: Users,
    color: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    id: 'nets',
    label: 'Training Nets',
    url: 'nets.asp',
    description: 'Current net training allocations, active youth slots & coach assignments',
    icon: Activity,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  {
    id: 'finances',
    label: 'Club Finances',
    url: 'finances.asp',
    description: 'Liquid cash reserves, sponsor weekly income, bank interest & wage ledger',
    icon: Coins,
    color: 'text-amber-600 bg-amber-50 border-amber-200'
  },
  {
    id: 'club',
    label: 'Club & Staff Details',
    url: 'club.asp',
    description: 'Staff specialists (PR, coaches, psychologists), member count & team morale',
    icon: ShieldCheck,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  },
  {
    id: 'fixtures',
    label: 'Match Fixtures',
    url: 'fixtures.asp',
    description: 'Upcoming league and cup fixtures, venue locations & scheduled rivals',
    icon: Calendar,
    color: 'text-purple-600 bg-purple-50 border-purple-200'
  },
  {
    id: 'pavilion',
    label: 'Pavilion & Stadium Ground',
    url: 'ground.asp',
    description: 'Arena seating capacity breakdown, pitch type preparation & weather conditions',
    icon: StadiumIcon,
    color: 'text-rose-600 bg-rose-50 border-rose-200'
  }
];

export default function SyncHub({ setActiveTab }: SyncHubProps) {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [pavilion, setPavilion] = useState<PavilionInfo | null>(null);
  const [hasEverSynced, setHasEverSynced] = useState<boolean>(() => {
    return localStorage.getItem('bt_has_ever_synced') === 'true';
  });
  
  const [finances, setFinances] = useState<ClubFinances>({
    cash: 0,
    members: 0,
    prOfficers: 0,
    finAdvisors: 0,
    sponsorsIncome: 0,
    gateReceipts: 0,
    interestReceived: 0,
    playerWages: 0,
    staffWages: 0,
    morale: 'respectable',
    sponsorsMood: 'respectable',
    membersConfidence: 'respectable',
    academyCondition: 'feeble',
    academyInvestment: 0,
    academyIts: 0,
    bowlingCoaches: 0,
    battingCoaches: 0,
    fieldingCoaches: 0,
    keepingCoaches: 0,
    staminaCoaches: 0,
    psychologists: 0
  });

  // Live mirrors of squad/finances/fixtures/pavilion, read by handleImport
  // instead of the state variables directly. Why: handleDirectSync runs all
  // of its steps (squad -> nets -> finances -> club -> ...) inside ONE
  // function call. React state set via setSquad()/setFinances() etc doesn't
  // become visible to that same running function - it only shows up on the
  // NEXT render, i.e. after handleDirectSync has already finished. So when
  // nets ran a moment after squad in the same sequential batch, its "has a
  // squad been synced yet?" check was still reading the squad state from
  // BEFORE the sync started (empty on a first-ever sync) and bailed out with
  // "please sync your squad first" - even though squad had just succeeded.
  // This is why pages synced individually worked but bulk/sequential sync
  // could fail partway through. Refs are mutable and read live, so updating
  // them the instant we call setX() keeps every step in the same batch
  // seeing the freshest data, regardless of React's render timing.
  const squadRef = useRef<BattrickPlayer[]>(squad);
  const financesRef = useRef<ClubFinances>(finances);
  const fixturesRef = useRef<BattrickGame[]>(fixtures);
  const pavilionRef = useRef<PavilionInfo | null>(pavilion);
  useEffect(() => { squadRef.current = squad; }, [squad]);
  useEffect(() => { financesRef.current = finances; }, [finances]);
  useEffect(() => { fixturesRef.current = fixtures; }, [fixtures]);
  useEffect(() => { pavilionRef.current = pavilion; }, [pavilion]);

  // Only 2 sync methods: Direct Sync & Cut/Paste
  const [importTab, setImportTab] = useState<'direct' | 'paste'>('direct');
  const [pasteInput, setPasteInput] = useState<string>('');
  const [selectedMapping, setSelectedMapping] = useState<string>('auto');

  // --- Direct Sync State ---
  const [directUsername, setDirectUsername] = useState<string>(() => localStorage.getItem('bt_battrick_username') || '');
  const [directPassword, setDirectPassword] = useState<string>('');
  const [rememberDirectUsername, setRememberDirectUsername] = useState<boolean>(() => !!localStorage.getItem('bt_battrick_username'));
  const [directSyncing, setDirectSyncing] = useState<boolean>(false);
  const [directSyncError, setDirectSyncError] = useState<string | null>(null);
  const [directPageStatuses, setDirectPageStatuses] = useState<{ name: string; success: boolean; error: string | null }[] | null>(null);

  // --- Sequential Sync Progression Modal State ---
  const [sequentialModal, setSequentialModal] = useState<SequentialModalState | null>(null);

  // Selected pages to sync (default: all)
  const [selectedSyncPages, setSelectedSyncPages] = useState<string[]>(() => {
    const saved = localStorage.getItem('bt_direct_sync_selected');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return ['squad', 'nets', 'finances', 'club', 'fixtures', 'pavilion'];
  });

  const [importMessage, setImportMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);
  const [showSyncControls, setShowSyncControls] = useState<boolean>(true);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    type: 'squad' | 'nets' | 'finances' | 'club' | 'fixtures' | 'pavilion' | 'ground' | 'demo' | 'unknown';
    title: string;
    message: string;
    stats?: { label: string; value: string | number }[];
  } | null>(null);

  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  const addSyncLog = (type: string, description: string, status: 'success' | 'failed') => {
    const newLog: SyncLog = {
      timestamp: new Date().toISOString(),
      type,
      description,
      status
    };
    
    const saved = localStorage.getItem('bt_sync_logs');
    let currentLogs: SyncLog[] = [];
    if (saved) {
      try {
        currentLogs = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    
    const updated = [newLog, ...currentLogs].slice(0, 50);
    localStorage.setItem('bt_sync_logs', JSON.stringify(updated));
    setSyncLogs(updated);
  };

  const toggleSyncPage = (pageId: string) => {
    let updated: string[];
    if (selectedSyncPages.includes(pageId)) {
      updated = selectedSyncPages.filter(id => id !== pageId);
    } else {
      updated = [...selectedSyncPages, pageId];
    }
    setSelectedSyncPages(updated);
    localStorage.setItem('bt_direct_sync_selected', JSON.stringify(updated));
  };

  const selectAllPages = () => {
    const all = AVAILABLE_SYNC_OPTIONS.map(o => o.id);
    setSelectedSyncPages(all);
    localStorage.setItem('bt_direct_sync_selected', JSON.stringify(all));
  };

  const deselectAllPages = () => {
    setSelectedSyncPages([]);
    localStorage.setItem('bt_direct_sync_selected', JSON.stringify([]));
  };

  const loadFromLocalStorage = () => {
    const savedSquad = localStorage.getItem('bt_squad');
    const savedFin = localStorage.getItem('bt_finances');
    const savedFixtures = localStorage.getItem('bt_fixtures');
    const savedPavilion = localStorage.getItem('bt_pavilion');
    const savedLogs = localStorage.getItem('bt_sync_logs');
    const savedHasEverSynced = localStorage.getItem('bt_has_ever_synced') === 'true';

    setHasEverSynced(savedHasEverSynced);

    if (savedSquad) {
      try {
        setSquad(JSON.parse(savedSquad));
      } catch (e) {
        console.error(e);
      }
    } else {
      setSquad([]);
    }

    if (savedFin) {
      try {
        setFinances(JSON.parse(savedFin));
      } catch (e) {
        console.error(e);
      }
    } else {
      setFinances({
        cash: 0,
        members: 0,
        prOfficers: 0,
        finAdvisors: 0,
        sponsorsIncome: 0,
        gateReceipts: 0,
        interestReceived: 0,
        playerWages: 0,
        staffWages: 0,
        morale: 'respectable',
        sponsorsMood: 'respectable',
        membersConfidence: 'respectable',
        academyCondition: 'feeble',
        academyInvestment: 0,
        academyIts: 0,
        bowlingCoaches: 0,
        battingCoaches: 0,
        fieldingCoaches: 0,
        keepingCoaches: 0,
        staminaCoaches: 0,
        psychologists: 0
      });
    }

    if (savedFixtures) {
      try {
        setFixtures(JSON.parse(savedFixtures));
      } catch (e) {
        console.error(e);
      }
    } else {
      setFixtures([]);
    }

    if (savedPavilion) {
      try {
        setPavilion(JSON.parse(savedPavilion));
      } catch (e) {
        console.error(e);
      }
    } else {
      setPavilion(null);
    }

    if (savedLogs) {
      try {
        setSyncLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error(e);
      }
    } else {
      setSyncLogs([]);
    }
  };

  useEffect(() => {
    loadFromLocalStorage();
    window.addEventListener('storage', loadFromLocalStorage);
    return () => {
      window.removeEventListener('storage', loadFromLocalStorage);
    };
  }, []);

  const saveToLocalStorage = (
    newSquad: BattrickPlayer[], 
    newFin?: ClubFinances, 
    newFixtures?: BattrickGame[], 
    newPavilion?: PavilionInfo
  ) => {
    localStorage.setItem('bt_squad', JSON.stringify(newSquad));
    if (newFin) {
      localStorage.setItem('bt_finances', JSON.stringify(newFin));
      localStorage.setItem('bt_finances_synced', 'true');
    }
    if (newFixtures) {
      localStorage.setItem('bt_fixtures', JSON.stringify(newFixtures));
    }
    if (newPavilion) {
      localStorage.setItem('bt_pavilion', JSON.stringify(newPavilion));
      localStorage.setItem('bt_pavilion_synced', 'true');
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('bt_cloud_backup_request'));
  };

  function handleImport(content: string, detectedType?: string, opts?: { silent?: boolean; progress?: { current: number; total: number } }) {
    if (!content.trim()) return;
    const silent = !!opts?.silent;
    
    const result = parseBattrickPage(content, detectedType);
    const isValidType = result.type && result.type !== 'unknown';
    if (!isValidType) {
      setImportMessage({ text: 'Format not recognized. Please copy the raw text or HTML of your Battrick squad, nets, finances, fixtures, or pavilion page.', success: false });
      addSyncLog('unknown', `Import failed: page format not recognized`, 'failed');
      setPasteInput('');
      setTimeout(() => setImportMessage(null), 8000);
      return;
    }

    const isDemo = localStorage.getItem('bt_is_demo') === 'true';
    let isDataValid = false;
    let failReason = '';

    if (result.type === 'squad') {
      if (result.players && result.players.length > 0) isDataValid = true;
      else failReason = 'No players could be parsed from the squad page content.';
    } else if (result.type === 'nets') {
      if (result.players && result.players.length > 0) {
        const hasSquad = squadRef.current && squadRef.current.length > 0 && !isDemo;
        if (!hasSquad) {
          setImportMessage({ text: 'Please sync your main Squad first before importing Nets data.', success: false });
          addSyncLog('nets', 'Import skipped: squad must be imported before nets schedules', 'failed');
          setPasteInput('');
          setTimeout(() => setImportMessage(null), 8000);
          return;
        }
        isDataValid = true;
      } else failReason = 'No training nets or practice allocations could be parsed.';
    } else if (result.type === 'finances' || result.type === 'club') {
      if (result.finances && Object.keys(result.finances).length > 0) isDataValid = true;
      else failReason = 'No financial figures or club staff data could be parsed.';
    } else if (result.type === 'fixtures') {
      if (result.fixtures && result.fixtures.length > 0) isDataValid = true;
      else failReason = 'No match fixtures could be parsed from page content.';
    } else if (result.type === 'pavilion') {
      if (result.pavilion && Object.keys(result.pavilion).length > 0) isDataValid = true;
      else failReason = 'No pavilion details could be parsed from page content.';
    } else if (result.type === 'ground') {
      if (result.stadium && Object.keys(result.stadium).length > 0) isDataValid = true;
      else failReason = 'No stadium seating details could be parsed.';
    }

    if (!isDataValid) {
      setImportMessage({ text: failReason || 'Format not recognized or no data could be extracted.', success: false });
      addSyncLog(result.type || 'unknown', `Import failed: ${failReason || 'unrecognized data'}`, 'failed');
      setPasteInput('');
      setTimeout(() => setImportMessage(null), 8000);
      return;
    }

    const shouldWipe = isDemo;
    if (shouldWipe) {
      setSquad([]);
      setFixtures([]);
      setPavilion(null);
      setFinances({
        cash: 0, members: 0, prOfficers: 0, finAdvisors: 0, sponsorsIncome: 0, gateReceipts: 0, interestReceived: 0, playerWages: 0, staffWages: 0, morale: 'respectable', sponsorsMood: 'respectable', membersConfidence: 'respectable', academyCondition: 'feeble', academyInvestment: 0, academyIts: 0, bowlingCoaches: 0, battingCoaches: 0, fieldingCoaches: 0, keepingCoaches: 0, staminaCoaches: 0, psychologists: 0
      });
      localStorage.removeItem('bt_squad');
      localStorage.removeItem('bt_finances');
      localStorage.removeItem('bt_stadium');
      localStorage.removeItem('bt_fixtures');
      localStorage.removeItem('bt_pavilion');
      localStorage.removeItem('bt_sync_logs');
      setSyncLogs([]);
      localStorage.setItem('bt_is_demo', 'false');
    }

    localStorage.setItem('bt_has_ever_synced', 'true');
    setHasEverSynced(true);

    const activeSquad = shouldWipe ? [] : squadRef.current;
    const activeFinances = shouldWipe ? {
      cash: 0, members: 0, prOfficers: 0, finAdvisors: 0, sponsorsIncome: 0, gateReceipts: 0, interestReceived: 0, playerWages: 0, staffWages: 0, morale: 'respectable' as const, sponsorsMood: 'respectable' as const, membersConfidence: 'respectable', academyCondition: 'feeble', academyInvestment: 0, academyIts: 0, bowlingCoaches: 0, battingCoaches: 0, fieldingCoaches: 0, keepingCoaches: 0, staminaCoaches: 0, psychologists: 0
    } : financesRef.current;
    const activeFixtures = shouldWipe ? [] : fixturesRef.current;
    const activePavilion = shouldWipe ? null : pavilionRef.current;

    if (result.type === 'squad' && result.players) {
      const merged = result.players.map((newP) => {
        if (!shouldWipe) {
          const existing = activeSquad.find(oldP => isNameMatch(oldP.name, newP.name));
          if (existing) return mergePlayerAndTrackHistory(existing, newP);
        }
        return {
          ...newP,
          history: generateRealisticHistory(newP)
        };
      });
      squadRef.current = merged;
      setSquad(merged);
      saveToLocalStorage(merged, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, activePavilion || undefined);
      setImportMessage({ text: `Successfully synced ${result.count} players into your squad!`, success: true });
      addSyncLog('squad', `Imported & updated squad roster (${result.count} players)`, 'success');
      
      const avgBtr = Math.round(merged.reduce((sum, p) => sum + p.btRating, 0) / merged.length);
      const weeklyWages = merged.reduce((sum, p) => sum + p.wage, 0);
      if (!silent) setSuccessModal({
        isOpen: true,
        type: 'squad',
        title: 'Squad Roster Synced!',
        message: `Processed and synchronized ${result.count} players from your Battrick squad. Skill parameters, ratings, ages, and weekly wages have been updated.`,
        stats: [
          { label: 'Players Imported', value: result.count },
          { label: 'Average BTR Rating', value: `${avgBtr.toLocaleString()} BTR` },
          { label: 'Weekly Wage Bill', value: `£${weeklyWages.toLocaleString()}` }
        ]
      });
    } else if (result.type === 'nets' && result.players) {
      let updatedCount = 0;
      const merged = activeSquad.map(p => {
        const netMatch = result.players?.find(np => isNameMatch(p.name, np.name));
        if (netMatch) {
          updatedCount++;
          return { ...p, nets: netMatch.nets };
        }
        return p;
      });
      squadRef.current = merged;
      setSquad(merged);
      saveToLocalStorage(merged, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, activePavilion || undefined);
      setImportMessage({ text: `Matched and synced net training schedules for ${updatedCount} squad players!`, success: true });
      addSyncLog('nets', `Updated training net allocation schedule for ${updatedCount} players`, 'success');
      
      const totalNets = merged.reduce((total, p) => total + (p.nets ? (p.nets.batting + p.nets.bowling + p.nets.keeping + p.nets.stamina + p.nets.fielding) : 0), 0);
      if (!silent) setSuccessModal({
        isOpen: true,
        type: 'nets',
        title: 'Training Nets Synced!',
        message: `Training schedules extracted successfully! Mapped individual net slots to your squad.`,
        stats: [
          { label: 'Players Configured', value: updatedCount },
          { label: 'Total Active Nets', value: totalNets }
        ]
      });
    } else if ((result.type === 'finances' || result.type === 'club') && result.finances) {
      const updatedFin = { ...activeFinances, ...result.finances } as ClubFinances;
      financesRef.current = updatedFin;
      setFinances(updatedFin);
      saveToLocalStorage(activeSquad, updatedFin, activeFixtures.length > 0 ? activeFixtures : undefined, activePavilion || undefined);
      setImportMessage({ text: result.type === 'club' ? 'Successfully parsed and synced club staff & morale levels!' : `Successfully parsed and synced club finances!`, success: true });
      addSyncLog(result.type, result.type === 'club' ? 'Synchronized club staff levels & morale' : `Synchronized weekly finances & staff ratios`, 'success');
      
      const isClub = result.type === 'club';
      if (!silent) setSuccessModal({
        isOpen: true,
        type: isClub ? 'club' : 'finances',
        title: isClub ? 'Club & Staff Information Synced!' : 'Financial Ledger Updated!',
        message: isClub 
          ? `Club staff levels, member count, team morale, and youth academy condition have been successfully synchronized.`
          : `Weekly finance ledger has been synced. Bank balance, sponsors mood, and staff counts have been updated.`,
        stats: isClub ? [
          { label: 'Club Members', value: updatedFin.members ? updatedFin.members.toLocaleString() : 'N/A' },
          { label: 'PR Officers', value: updatedFin.prOfficers !== undefined ? updatedFin.prOfficers : 'N/A' },
          { label: 'Financial Advisors', value: updatedFin.finAdvisors !== undefined ? updatedFin.finAdvisors : 'N/A' },
          { label: 'Team Morale', value: updatedFin.morale ? updatedFin.morale.charAt(0).toUpperCase() + updatedFin.morale.slice(1) : 'N/A' }
        ] : [
          { label: 'Cash Reserves', value: `£${updatedFin.cash.toLocaleString()}` },
          { label: 'Club Members', value: updatedFin.members.toLocaleString() },
          { label: 'PR Officers', value: updatedFin.prOfficers },
          { label: 'Financial Advisors', value: updatedFin.finAdvisors }
        ]
      });
    } else if (result.type === 'fixtures' && result.fixtures) {
      fixturesRef.current = result.fixtures;
      setFixtures(result.fixtures);
      saveToLocalStorage(activeSquad, activeFinances, result.fixtures, activePavilion || undefined);
      setImportMessage({ text: `Successfully parsed and synced ${result.fixtures.length} club fixtures!`, success: true });
      addSyncLog('fixtures', `Synchronized ${result.fixtures.length} club fixtures`, 'success');
      
      if (!silent) setSuccessModal({
        isOpen: true,
        type: 'fixtures',
        title: 'Match Fixtures Synced!',
        message: `Parsed and synchronized upcoming match schedules and pitch ratings.`,
        stats: [
          { label: 'Fixtures Found', value: result.fixtures.length }
        ]
      });
    } else if (result.type === 'pavilion' && result.pavilion) {
      const mergedPavilion: PavilionInfo = {
        ...(activePavilion || {
          groundName: 'HairyBeanBags CG',
          pitchType: 'Flat',
          weather: 'Sunny',
          established: 'Season 42',
          membershipStatus: 'Elite Manager'
        }),
        ...result.pavilion
      };
      pavilionRef.current = mergedPavilion;
      setPavilion(mergedPavilion);
      saveToLocalStorage(activeSquad, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, mergedPavilion);
      setImportMessage({ text: `Successfully parsed and synced pavilion details: ${mergedPavilion.groundName}!`, success: true });
      addSyncLog('pavilion', `Synchronized pavilion ground detail (${mergedPavilion.groundName})`, 'success');
      
      if (!silent) setSuccessModal({
        isOpen: true,
        type: 'pavilion',
        title: 'Pavilion Ground Synced!',
        message: `Club details, active weather, and ground name loaded from pavilion page!`,
        stats: [
          { label: 'Ground Name', value: mergedPavilion.groundName },
          { label: 'Active Weather', value: mergedPavilion.weather }
        ]
      });
    } else if (result.type === 'ground' && result.stadium) {
      const stadium = result.stadium || {
        capacity: 14000,
        terracing: 8000,
        grass: 4000,
        seats: 1800,
        boxes: 200,
        pitch: 'Flat'
      };
      localStorage.setItem('bt_stadium', JSON.stringify(stadium));
      localStorage.setItem('bt_stadium_synced', 'true');
      
      let updatedPavilion = activePavilion;
      if (result.pavilion?.groundName || result.pavilion?.pitchType) {
        updatedPavilion = {
          ...(updatedPavilion || {
            groundName: 'HairyBeanBags CG',
            pitchType: 'Flat',
            weather: 'Sunny',
            established: 'Season 42',
            membershipStatus: 'Elite Manager'
          }),
          ...(result.pavilion?.groundName ? { groundName: result.pavilion.groundName } : {}),
          ...(result.pavilion?.pitchType ? { pitchType: result.pavilion.pitchType } : {})
        };
        pavilionRef.current = updatedPavilion;
        setPavilion(updatedPavilion);
      }

      saveToLocalStorage(activeSquad, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, updatedPavilion || undefined);
      setImportMessage({ text: `Successfully parsed and synced stadium ground specs!`, success: true });
      addSyncLog('ground', `Updated stadium capacity to ${(stadium.capacity || 0).toLocaleString()} seats`, 'success');

      if (!silent) setSuccessModal({
        isOpen: true,
        type: 'ground',
        title: 'Stadium Ground Specs Synced!',
        message: `Your stadium's seating categories, ground name, pitch type, and maximum seating capacity have been updated.`,
        stats: [
          { label: 'Ground Name', value: result.pavilion?.groundName || (updatedPavilion?.groundName || 'My Ground') },
          { label: 'Pitch Preparation', value: result.pavilion?.pitchType || (updatedPavilion?.pitchType || 'Flat') },
          { label: 'Total Capacity', value: `${(stadium.capacity || 0).toLocaleString()} seats` }
        ]
      });
    }

    setPasteInput('');
    setTimeout(() => setImportMessage(null), 8000);
  }

  // --- Live Direct Sequential Sync Execution ---
  const handleDirectSync = async () => {
    if (!directUsername.trim() || !directPassword.trim()) {
      setDirectSyncError('Please enter your Battrick username and password.');
      return;
    }

    if (selectedSyncPages.length === 0) {
      setDirectSyncError('Please tick at least one section/page to synchronize below.');
      return;
    }

    setDirectSyncing(true);
    setDirectSyncError(null);
    setDirectPageStatuses(null);

    if (rememberDirectUsername) {
      localStorage.setItem('bt_battrick_username', directUsername.trim());
    } else {
      localStorage.removeItem('bt_battrick_username');
    }

    // Build step queue
    const stepDefinitions: Record<string, { label: string; subLabel: string; urlLabel: string; icon: any; color: string }> = {
      squad: {
        label: 'Squad Roster & Skills',
        subLabel: 'Player attributes, age, wages, BTR ratings and records',
        urlLabel: 'squad.asp',
        icon: Users,
        color: 'text-blue-600 bg-blue-50 border-blue-200'
      },
      nets: {
        label: 'Training Nets Allocation',
        subLabel: 'Net training allocations, youth slots & coach assignments',
        urlLabel: 'nets.asp',
        icon: Activity,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
      },
      finances: {
        label: 'Club Financial Accounts',
        subLabel: 'Cash reserves, sponsor weekly income & wage ledger',
        urlLabel: 'finances.asp',
        icon: Coins,
        color: 'text-amber-600 bg-amber-50 border-amber-200'
      },
      club: {
        label: 'Club Staff & Morale',
        subLabel: 'Staff specialists, member count & team morale',
        urlLabel: 'club.asp',
        icon: ShieldCheck,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
      },
      fixtures: {
        label: 'Match Fixtures & Calendar',
        subLabel: 'Upcoming league and cup fixtures & scheduled rivals',
        urlLabel: 'fixtures.asp',
        icon: Calendar,
        color: 'text-purple-600 bg-purple-50 border-purple-200'
      },
      pavilion: {
        label: 'Stadium Ground & Pavilion',
        subLabel: 'Arena seating capacity, pitch preparation & weather conditions',
        urlLabel: 'ground.asp',
        icon: StadiumIcon,
        color: 'text-rose-600 bg-rose-50 border-rose-200'
      }
    };

    const initialSteps: SequentialStepItem[] = [
      {
        id: 'auth',
        label: 'Authentication & Session Token',
        subLabel: 'Establishing authenticated ASP session with Battrick.org',
        urlLabel: 'login.asp',
        icon: KeyRound,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        status: 'pending',
        message: 'Waiting in queue...'
      }
    ];

    selectedSyncPages.forEach(pageId => {
      const def = stepDefinitions[pageId];
      if (def) {
        initialSteps.push({
          id: pageId,
          label: def.label,
          subLabel: def.subLabel,
          urlLabel: def.urlLabel,
          icon: def.icon,
          color: def.color,
          status: 'pending',
          message: 'Waiting in queue...'
        });
      }
    });

    const totalSteps = initialSteps.length;
    setSequentialModal({
      isOpen: true,
      isProcessing: true,
      isComplete: false,
      hasErrors: false,
      currentStepIndex: 0,
      totalSteps,
      progressPercent: 5,
      activeStepName: 'Step 1 of ' + totalSteps + ': Authentication Handshake',
      activeDetail: 'Authenticating with Battrick servers and generating session token...',
      steps: initialSteps,
      completedStats: []
    });

    const updateStep = (index: number, patch: Partial<SequentialStepItem>) => {
      setSequentialModal(prev => {
        if (!prev) return prev;
        const nextSteps = [...prev.steps];
        if (nextSteps[index]) {
          nextSteps[index] = { ...nextSteps[index], ...patch };
        }
        return { ...prev, steps: nextSteps };
      });
    };

    let activeSessionToken = '';
    let completedCount = 0;
    const collectedStats: { label: string; value: string | number }[] = [];
    const pageStatusRecords: { name: string; success: boolean; error: string | null }[] = [];

    // Safe JSON response reader to prevent "Unexpected token '<', <!doctype..." crashes
    const safeReadJson = async (res: Response): Promise<{ success: boolean; error?: string; [key: string]: any }> => {
      try {
        const text = await res.text();
        if (!text || text.trim().length === 0) {
          return { success: false, error: `Empty response from server (HTTP ${res.status})` };
        }
        try {
          const parsed = JSON.parse(text);
          return parsed;
        } catch {
          // If server returned an HTML error page or login redirect
          if (text.includes('<!DOCTYPE html>') || text.includes('<!doctype html') || text.includes('<html')) {
            if (text.includes('Log In to Battrick') || text.includes('login.asp')) {
              return { 
                success: false, 
                error: 'Battrick session expired. Please verify your username & password.' 
              };
            }
            return { 
              success: false, 
              error: `Server responded with HTML page (Status ${res.status}). Please verify login details or try again.` 
            };
          }
          return { success: false, error: text.slice(0, 120) || `Server HTTP ${res.status} error` };
        }
      } catch (readErr: any) {
        return { success: false, error: readErr.message || 'Failed to read server response' };
      }
    };

    try {
      // 1. STEP 1: AUTHENTICATION
      updateStep(0, {
        status: 'processing',
        message: 'Transmitting credentials to Battrick login gateway...'
      });

      setSequentialModal(prev => prev ? {
        ...prev,
        currentStepIndex: 0,
        activeStepName: `Step 1 of ${totalSteps}: Authenticating with Battrick`,
        activeDetail: `Sending credentials for ${directUsername.trim()}...`,
        progressPercent: Math.round((0.5 / totalSteps) * 100)
      } : null);

      const authRes = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'login',
          username: directUsername.trim(),
          password: directPassword
        })
      });
      const authData = await safeReadJson(authRes);

      if (!authRes.ok || !authData.success) {
        const errMsg = authData.error || 'Authentication failed. Please verify your credentials or use the Cut & Paste tab.';
        updateStep(0, {
          status: 'failed',
          message: errMsg,
          error: errMsg
        });
        setSequentialModal(prev => prev ? {
          ...prev,
          isProcessing: false,
          hasErrors: true,
          activeStepName: 'Authentication Failed',
          activeDetail: errMsg
        } : null);
        setDirectSyncError(errMsg);
        addSyncLog('auth', `Direct sync authentication failed for ${directUsername}`, 'failed');
        setDirectSyncing(false);
        return;
      }

      activeSessionToken = authData.sessionToken || '';
      updateStep(0, {
        status: 'completed',
        message: '✓ Authenticated successfully with Battrick servers',
        statBadge: 'Session Active'
      });
      addSyncLog('auth', `Authenticated with Battrick servers as ${directUsername}`, 'success');

      setSequentialModal(prev => prev ? {
        ...prev,
        progressPercent: Math.round((1 / totalSteps) * 100),
        activeStepName: '✓ Authentication Handshake Complete',
        activeDetail: 'Battrick session established. Spacing out requests and starting page fetch...'
      } : null);

      // Polite spacing delay (600ms) between login and first page fetch
      await new Promise(r => setTimeout(r, 600));

      // 2. PROCESS SELECTED PAGES SEQUENTIALLY
      for (let i = 1; i < initialSteps.length; i++) {
        const currentStep = initialSteps[i];
        const pageKey = currentStep.id;
        const stepNumber = i + 1;

        updateStep(i, {
          status: 'processing',
          message: `Processing step: Fetching ${currentStep.urlLabel} from Battrick...`
        });

        setSequentialModal(prev => prev ? {
          ...prev,
          currentStepIndex: i,
          activeStepName: `Step ${stepNumber} of ${totalSteps}: Syncing ${currentStep.label}`,
          activeDetail: `Currently downloading and processing ${currentStep.urlLabel}...`,
          progressPercent: Math.round(((i + 0.5) / totalSteps) * 100)
        } : null);

        try {
          const pageRes = await fetch('/api/sync-battrick-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              step: 'fetch',
              pageName: pageKey,
              sessionToken: activeSessionToken,
              username: directUsername.trim(),
              password: directPassword
            })
          });

          const pageData = await safeReadJson(pageRes);

          if (pageRes.ok && pageData.success && pageData.html) {
            const typeMapping: Record<string, string> = {
              squad: 'squad',
              nets: 'nets',
              finances: 'finances',
              club: 'club',
              fixtures: 'fixtures',
              pavilion: 'ground'
            };
            const importType = typeMapping[pageKey] || pageKey;

            // Import data into club state and localStorage
            handleImport(pageData.html, importType, { silent: true, progress: { current: stepNumber, total: totalSteps } });
            completedCount++;

            let statBadge = 'Synced';
            if (pageKey === 'squad') {
              const parsed = parseBattrickPage(pageData.html);
              const pCount = parsed.players?.length || 0;
              statBadge = `${pCount} Players`;
              collectedStats.push({ label: 'Squad Size', value: `${pCount} Active Players` });
            } else if (pageKey === 'nets') {
              const parsed = parseBattrickPage(pageData.html);
              const netCount = parsed.players?.filter(p => p.nets && (p.nets.batting + p.nets.bowling + p.nets.keeping + p.nets.fielding + p.nets.stamina) > 0).length || 0;
              statBadge = `${netCount} Nets Allocated`;
              collectedStats.push({ label: 'Training Nets', value: `${netCount} Assigned Slots` });
            } else if (pageKey === 'finances') {
              const parsed = parseBattrickPage(pageData.html);
              if (parsed.finances?.cash) {
                statBadge = `£${(parsed.finances.cash / 1000000).toFixed(2)}M Balance`;
                collectedStats.push({ label: 'Club Capital', value: `£${parsed.finances.cash.toLocaleString()}` });
              }
            } else if (pageKey === 'club') {
              statBadge = 'Staff & Morale';
              collectedStats.push({ label: 'Club Mood', value: 'Morale & Specialists Synced' });
            } else if (pageKey === 'fixtures') {
              const parsed = parseBattrickPage(pageData.html);
              const fCount = parsed.fixtures?.length || 0;
              statBadge = `${fCount} Matches`;
              collectedStats.push({ label: 'Upcoming Fixtures', value: `${fCount} Games Scheduled` });
            } else if (pageKey === 'pavilion') {
              statBadge = 'Ground Specs';
              collectedStats.push({ label: 'Stadium & Pitch', value: 'Capacity & Conditions Loaded' });
            }

            updateStep(i, {
              status: 'completed',
              message: `✓ Completed: ${currentStep.label} (${statBadge})`,
              statBadge
            });

            pageStatusRecords.push({ name: pageKey, success: true, error: null });
            addSyncLog(pageKey, `Direct sync synchronized ${currentStep.label} (${statBadge})`, 'success');

            // Alert banner transition: show completion status before pacing to next step
            setSequentialModal(prev => prev ? {
              ...prev,
              activeStepName: `✓ ${currentStep.label} Synced (${statBadge})`,
              activeDetail: i < initialSteps.length - 1 ? `Proceeding to step ${stepNumber + 1}: ${initialSteps[i + 1].label}...` : 'All selected pages finished!'
            } : null);

          } else {
            const errStr = pageData.error || `Failed to fetch ${currentStep.urlLabel}`;
            updateStep(i, {
              status: 'failed',
              message: `❌ ${errStr}`,
              error: errStr
            });
            pageStatusRecords.push({ name: pageKey, success: false, error: errStr });
            addSyncLog(pageKey, `Direct sync failed for ${currentStep.label}: ${errStr}`, 'failed');

            setSequentialModal(prev => prev ? {
              ...prev,
              activeStepName: `⚠ ${currentStep.label} Skipped`,
              activeDetail: `${errStr} ${i < initialSteps.length - 1 ? '- continuing with next step...' : ''}`
            } : null);
          }
        } catch (stepErr: any) {
          console.error(`[Sequential Sync] Error on ${pageKey}:`, stepErr);
          const errStr = stepErr.message || 'Network communication error';
          updateStep(i, {
            status: 'failed',
            message: `❌ ${errStr}`,
            error: errStr
          });
          pageStatusRecords.push({ name: pageKey, success: false, error: errStr });
          addSyncLog(pageKey, `Direct sync step error on ${currentStep.label}: ${errStr}`, 'failed');

          setSequentialModal(prev => prev ? {
            ...prev,
            activeStepName: `⚠ ${currentStep.label} Skipped`,
            activeDetail: `${errStr} ${i < initialSteps.length - 1 ? '- continuing with next step...' : ''}`
          } : null);
        }

        setSequentialModal(prev => prev ? {
          ...prev,
          progressPercent: Math.round(((i + 1) / totalSteps) * 100),
          completedStats: [...collectedStats]
        } : null);

        // Polite 700ms sequential spacing before moving to the next page
        if (i < initialSteps.length - 1) {
          await new Promise(r => setTimeout(r, 700));
        }
      }

      setDirectPageStatuses(pageStatusRecords);

      // 3. ALL STEPS FINISHED
      const anyStepFailed = pageStatusRecords.some(p => !p.success);

      setSequentialModal(prev => prev ? {
        ...prev,
        isProcessing: false,
        isComplete: true,
        hasErrors: anyStepFailed,
        progressPercent: 100,
        activeStepName: anyStepFailed ? 'Sequential Sync Finished with Warnings' : 'Sequential Sync Completed Successfully!',
        activeDetail: `Processed all ${totalSteps} sequential steps (${completedCount} of ${totalSteps - 1} club pages synchronized).`,
        completedStats: collectedStats
      } : null);

      if (completedCount > 0) {
        setImportMessage({
          text: `⚡ Sequential Direct Sync completed! Successfully synchronized ${completedCount} club modules.`,
          success: true
        });
      }
      setDirectPassword('');

    } catch (globalErr: any) {
      console.error('[Sequential Sync Global Error]', globalErr);
      setSequentialModal(prev => prev ? {
        ...prev,
        isProcessing: false,
        hasErrors: true,
        activeStepName: 'Sync Interrupted',
        activeDetail: globalErr.message || 'An unexpected error occurred during sequential processing.'
      } : null);
      setDirectSyncError(globalErr.message || 'Sync error occurred.');
    } finally {
      setDirectSyncing(false);
    }
  };

  const loadAllSamplesAtOnce = () => {
    const squadResult = parseBattrickPage(SAMPLE_SQUAD_HTML);
    const netsResult = parseBattrickPage(SAMPLE_NETS_HTML);
    const financesResult = parseBattrickPage(SAMPLE_FINANCES_HTML);
    const clubResult = parseBattrickPage(SAMPLE_CLUB_HTML);
    const fixturesResult = parseBattrickPage(SAMPLE_FIXTURES_HTML);
    const pavilionResult = parseBattrickPage(SAMPLE_PAVILION_HTML);

    let parsedSquad: BattrickPlayer[] = squadResult.type === 'squad' && squadResult.players ? squadResult.players : [];
    if (netsResult.type === 'nets' && netsResult.players && parsedSquad.length > 0) {
      parsedSquad = parsedSquad.map(p => {
        const netMatch = netsResult.players?.find(np => isNameMatch(p.name, np.name));
        return netMatch ? { ...p, nets: netMatch.nets } : p;
      });
    }

    let parsedFinances: ClubFinances = {
      cash: 4521850,
      members: 1450,
      prOfficers: 4,
      finAdvisors: 2,
      sponsorsIncome: 42500,
      gateReceipts: 65000,
      interestReceived: 1250,
      playerWages: 26850,
      staffWages: 7500,
      morale: 'superb',
      sponsorsMood: 'wonderful'
    };

    if (financesResult.finances) parsedFinances = { ...parsedFinances, ...financesResult.finances };
    if (clubResult.finances) parsedFinances = { ...parsedFinances, ...clubResult.finances };

    const parsedFixtures: BattrickGame[] = fixturesResult.type === 'fixtures' && fixturesResult.fixtures ? fixturesResult.fixtures : [];
    const parsedPavilion: PavilionInfo | null = pavilionResult.type === 'pavilion' && pavilionResult.pavilion ? pavilionResult.pavilion as PavilionInfo : null;

    localStorage.setItem('bt_stadium', JSON.stringify({
      terracing: 8000,
      grass: 4000,
      seats: 1800,
      boxes: 200,
      capacity: 14000
    }));
    localStorage.setItem('bt_stadium_synced', 'true');
    localStorage.setItem('bt_is_demo', 'true');

    setSquad(parsedSquad);
    setFinances(parsedFinances);
    setFixtures(parsedFixtures);
    setPavilion(parsedPavilion);
    
    saveToLocalStorage(parsedSquad, parsedFinances, parsedFixtures, parsedPavilion || undefined);

    setImportMessage({
      text: "⚡ Success! Loaded complete Demo Club: 11 active players, custom training nets, £4.5M bank cash, 1,450 club members, active fixtures & stadium specs.",
      success: true
    });
    addSyncLog('demo', 'Loaded complete BattrickIQ Demo Club playground', 'success');

    setSuccessModal({
      isOpen: true,
      type: 'demo',
      title: 'Demo Club Profile Loaded!',
      message: 'You have loaded the complete Battrick IQ demo playground! The local database has been pre-populated with a full club setup, including squad players, nets training schedules, financials, match fixtures, and pitch ground conditions.',
      stats: [
        { label: 'Roster Size', value: '11 Active Players' },
        { label: 'Weekly Finances', value: '£4.52M Capital' },
        { label: 'Fixture Games', value: 'Synchronized' },
        { label: 'Pitch Turf Type', value: 'Flat Pitch' }
      ]
    });

    setTimeout(() => setImportMessage(null), 8000);
  };

  const confirmClearAllData = () => {
    setSquad([]);
    setFixtures([]);
    setPavilion(null);
    setFinances({
      cash: 0,
      members: 0,
      prOfficers: 0,
      finAdvisors: 0,
      sponsorsIncome: 0,
      gateReceipts: 0,
      interestReceived: 0,
      playerWages: 0,
      staffWages: 0,
      morale: 'respectable',
      sponsorsMood: 'respectable',
      membersConfidence: 'respectable',
      academyCondition: 'feeble',
      academyInvestment: 0,
      academyIts: 0,
      bowlingCoaches: 0,
      battingCoaches: 0,
      fieldingCoaches: 0,
      keepingCoaches: 0,
      staminaCoaches: 0,
      psychologists: 0
    });
    localStorage.removeItem('bt_squad');
    localStorage.removeItem('bt_finances');
    localStorage.removeItem('bt_stadium');
    localStorage.removeItem('bt_fixtures');
    localStorage.removeItem('bt_pavilion');
    localStorage.removeItem('bt_sync_logs');
    localStorage.removeItem('bt_is_demo');
    localStorage.removeItem('bt_finances_synced');
    localStorage.removeItem('bt_stadium_synced');
    localStorage.removeItem('bt_pavilion_synced');
    setSyncLogs([]);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('bt_cloud_backup_request'));
    setImportMessage({ text: 'All local database records wiped clean.', success: true });
    setShowWipeConfirm(false);
    setTimeout(() => setImportMessage(null), 3000);
  };

  const activeNetsCount = squad.reduce((total, p) => {
    const pNets = p.nets ? (p.nets.batting + p.nets.bowling + p.nets.keeping + p.nets.stamina + p.nets.fielding) : 0;
    return total + (pNets > 0 ? 1 : 0);
  }, 0);

  const averageBtr = squad.length > 0 
    ? Math.round(squad.reduce((sum, p) => sum + p.btRating, 0) / squad.length)
    : 0;

  const totalWages = squad.reduce((sum, p) => sum + p.wage, 0);

  const averageAge = squad.length > 0 
    ? (squad.reduce((sum, p) => sum + p.age, 0) / squad.length).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col gap-6 animate-fadeIn" id="synced-dashboard">
      {squad.length > 0 ? (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100">
                <CheckCircle className="w-5.5 h-5.5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Your Battrick Club is Active & Synced</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Roster, net schedules, fixtures list, ground configuration, and weekly finances are parsed and active.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSyncControls(!showSyncControls)}
                className="px-3.5 py-1.5 text-xs font-bold bg-white text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {showSyncControls ? "Hide Import Box" : "Import / Resync Data"}
              </button>
              <button
                onClick={() => setShowWipeConfirm(true)}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                title="Delete stored club details"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {importMessage && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 border animate-scaleUp ${
              importMessage.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <AlertCircle className="w-4.5 h-4.5 text-slate-600 shrink-0 mt-0.5" />
              <span>{importMessage.text}</span>
            </div>
          )}

          {/* Pavilion status */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                Club Pavilion & Status Overview
              </h4>
              <span className="text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                {pavilion?.membershipStatus || "Elite Manager"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Ground Arena</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block truncate">
                  {pavilion?.groundName || "Battrick Arena"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Pitch Type</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block">
                  {pavilion?.pitchType || "Flat Pitch"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Weather</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block text-amber-600 font-bold">
                  ☀ {pavilion?.weather || "Sunny"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Sponsors Mood</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block capitalize text-emerald-600">
                  {finances.sponsorsMood || "ecstatic"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Club Morale</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block capitalize text-blue-600">
                  {finances.morale || "sublime"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Members Conf.</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block capitalize text-indigo-600">
                  {finances.membersConfidence || "sublime"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Youth Academy</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block capitalize text-violet-600">
                  {finances.academyCondition ? `${finances.academyCondition} (${finances.academyIts || 0} ITS)` : "feeble"}
                </span>
              </div>
            </div>
          </div>

          {/* Performance At-A-Glance Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="metrics-dashboard">
            <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Squad Strength</span>
                <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">{squad.length} Players</span>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {activeNetsCount} Assigned to Nets
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600"><Users className="w-5.5 h-5.5" /></div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Liquid Club Capital</span>
                <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">
                  {finances.cash > 0 ? `£${finances.cash.toLocaleString()}` : "Sync finances"}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                  {finances.members > 0 ? `${finances.members.toLocaleString()} Members` : "No financial ledger"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600"><Coins className="w-5.5 h-5.5" /></div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Squad Rating Index</span>
                <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">{averageBtr.toLocaleString()} BTR</span>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Average Age: {averageAge} Years</span>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600"><Trophy className="w-5.5 h-5.5" /></div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Weekly Wages</span>
                <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">£{totalWages.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Staff Wages: £{(finances.staffWages || 0).toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><Calculator className="w-5.5 h-5.5" /></div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10.5px] font-bold font-mono tracking-wider uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Strategic Cricket Intelligence
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-slate-900 leading-tight">
              Synchronize & Manage Your Battrick Club
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2.5 leading-relaxed max-w-2xl">
              Connect your active Battrick club using <strong>Direct Background Sync</strong> (1-click login) or <strong>Cut & Paste</strong> to instantly populate your player roster, net training schedules, finances, fixtures, and stadium capacity.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 shrink-0">
            {!hasEverSynced && (
              <button
                type="button"
                onClick={loadAllSamplesAtOnce}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
              >
                <Sparkles className="w-4 h-4" />
                Explore with Demo Club
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync Box (Available in both states) */}
      {(showSyncControls || squad.length === 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
            <h3 className="font-display font-bold text-base text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Club Synchronization Hub
            </h3>
          </div>

          {/* Clean 2-Tab Navigation */}
          <div className="flex border-b border-slate-200 mb-5">
            <button
              type="button"
              onClick={() => setImportTab('direct')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center justify-center gap-2 ${
                importTab === 'direct'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span>Direct Sync (1-Click Background)</span>
            </button>
            <button
              type="button"
              onClick={() => setImportTab('paste')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center justify-center gap-2 ${
                importTab === 'paste'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Clipboard className="w-4 h-4 text-slate-500" />
              <span>Cut & Paste (Manual Text / HTML)</span>
            </button>
          </div>

          {/* Tab 1: Direct Sync */}
          {importTab === 'direct' && (
            <div className="flex flex-col gap-5 animate-fadeIn text-xs">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl p-4">
                <h4 className="font-bold text-emerald-950 font-sans text-sm flex items-center gap-1.5">
                  <Wifi className="w-4.5 h-4.5 text-emerald-600" />
                  Direct 1-Click Background Synchronization
                </h4>
                <p className="text-emerald-800/90 mt-1 leading-relaxed font-sans text-xs">
                  Enter your Battrick.org login credentials. BattrickIQ logs in securely in the background and retrieves your chosen club pages simultaneously — no manual copy-pasting required!
                </p>
              </div>

              {/* Login Credentials Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                  1. Battrick Account Credentials
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-700 font-sans">Battrick Username</label>
                    <input
                      type="text"
                      value={directUsername}
                      onChange={(e) => setDirectUsername(e.target.value)}
                      placeholder="Your Battrick username"
                      autoComplete="username"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-700 font-sans">Battrick Password</label>
                    <input
                      type="password"
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      placeholder="Your Battrick password"
                      autoComplete="current-password"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDirectSync(); }}
                    />
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2">
                  <label className="flex items-center gap-2 text-[11px] text-slate-600 font-sans cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberDirectUsername}
                      onChange={(e) => setRememberDirectUsername(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Remember my username on this device (password is never saved)
                  </label>
                </div>
              </div>

              {/* Configurable Sync Sections Checklist */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                      2. Choose What to Synchronize
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tick each page you wish to fetch and update in your BattrickIQ manager database:
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllPages}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* 2-Column Grid of Toggle Checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {AVAILABLE_SYNC_OPTIONS.map((opt) => {
                    const isChecked = selectedSyncPages.includes(opt.id);
                    const IconComponent = opt.icon;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => toggleSyncPage(opt.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                          isChecked 
                            ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-300/40 shadow-xs' 
                            : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 opacity-75'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 text-indigo-600">
                          {isChecked ? (
                            <CheckSquare className="w-4.5 h-4.5 text-indigo-600 fill-indigo-100" />
                          ) : (
                            <Square className="w-4.5 h-4.5 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                              <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${opt.color}`}>
                                <IconComponent className="w-3 h-3" />
                              </span>
                              {opt.label}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                              {opt.url}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sync Trigger Button */}
              <button
                type="button"
                onClick={handleDirectSync}
                disabled={directSyncing || selectedSyncPages.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                {directSyncing ? (
                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Wifi className="w-4.5 h-4.5" />
                )}
                {directSyncing 
                  ? 'Connecting & fetching selected pages in background...' 
                  : `Run Direct Sync (${selectedSyncPages.length} pages selected)`}
              </button>

              {/* Error Box */}
              {directSyncError && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                    <div className="leading-relaxed">
                      <span className="font-bold block text-sm">Direct Sync Issue</span>
                      <span className="text-xs text-rose-700">{directSyncError}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportTab('paste')}
                    className="shrink-0 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    Switch to Cut & Paste Tab
                  </button>
                </div>
              )}

              {/* Page Results Feedback */}
              {directPageStatuses && (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white shadow-sm">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 font-mono font-bold text-[10px] uppercase text-slate-400">
                    Direct Background Sync Results
                  </div>
                  {directPageStatuses.map((p) => (
                    <div key={p.name} className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="font-bold text-slate-800 capitalize font-sans text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        {p.name}
                      </span>
                      {p.success ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          <Check className="w-3.5 h-3.5" /> Synchronized
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60" title={p.error || ''}>
                          <AlertCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Cut & Paste */}
          {importTab === 'paste' && (
            <div className="flex flex-col gap-4 animate-fadeIn text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-bold text-slate-800 font-sans text-sm flex items-center gap-1.5">
                  <Clipboard className="w-4 h-4 text-indigo-600" />
                  Cut & Paste Manual Data Importer
                </h4>
                <p className="text-slate-600 mt-1 leading-relaxed font-sans text-xs">
                  Simply open any Battrick page (Squad, Training Nets, Finances, Club, Fixtures, or Ground), select all (<kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Ctrl+A</kbd> / <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Cmd+A</kbd>), copy it (<kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Ctrl+C</kbd> / <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Cmd+C</kbd>), and paste it into the box below.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-700 font-sans">
                  Target Page Content Detection:
                </label>
                <select
                  value={selectedMapping}
                  onChange={(e) => setSelectedMapping(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  <option value="auto">Auto-Detect Page (Recommended)</option>
                  <option value="squad">Squad Roster (squad.asp)</option>
                  <option value="nets">Training Nets (nets.asp)</option>
                  <option value="finances">Club Finances (finances.asp)</option>
                  <option value="club">Club Staff & Morale (club.asp)</option>
                  <option value="fixtures">Match Fixtures (fixtures.asp)</option>
                  <option value="ground">Stadium & Pavilion (ground.asp)</option>
                </select>
              </div>

              <textarea
                id="sync-textarea-pasted"
                rows={7}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="Paste raw Battrick text or webpage HTML content here (e.g. copied from squad.asp, nets.asp, finances.asp)..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleImport(pasteInput, selectedMapping === 'auto' ? undefined : selectedMapping)}
                  disabled={!pasteInput.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer font-sans"
                >
                  <RefreshCw className="w-4 h-4" />
                  Analyze & Parse Content
                </button>
                {pasteInput && (
                  <button
                    type="button"
                    onClick={() => setPasteInput('')}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
            Last Synchronized Log Records
          </h3>
          <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
            {syncLogs.length} Records Stored
          </span>
        </div>

        {syncLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 font-mono font-bold text-slate-400 text-[10px] uppercase">
                  <th className="pb-2.5">Date & Time</th>
                  <th className="pb-2.5">Category</th>
                  <th className="pb-2.5">Sync Details</th>
                  <th className="pb-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {syncLogs.map((log, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 font-semibold font-mono text-slate-700">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 capitalize font-bold text-slate-800">{log.type}</td>
                    <td className="py-2.5 font-medium text-slate-700">{log.description}</td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {log.status === 'success' ? 'Synced' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            No sync history logs recorded yet. Use Direct Sync or Cut & Paste above to populate your club.
          </div>
        )}
      </div>

      {/* Wipe confirmation */}
      {showWipeConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-6 text-center flex flex-col items-center gap-4 animate-scaleUp">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-900">Reset Club Data?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                This will clear stored local club data so you can resynchronize clean data from scratch.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-4">
              <button
                type="button"
                onClick={() => setShowWipeConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearAllData}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-md cursor-pointer"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sequential Direct Sync Modal Dialog Pop */}
      {sequentialModal && sequentialModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 transition-all duration-300 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl max-w-lg w-full p-5 sm:p-6 flex flex-col gap-4.5 text-white animate-scaleUp max-h-[92vh] overflow-y-auto relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  {sequentialModal.isComplete ? (
                    sequentialModal.hasErrors ? (
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )
                  ) : (
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-extrabold text-base text-white">Direct Battrick Sync</h3>
                    {!sequentialModal.isComplete && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Sequential direct session sync</p>
                </div>
              </div>

              {/* Dismiss / Close Button */}
              {sequentialModal.isComplete && (
                <button
                  type="button"
                  onClick={() => setSequentialModal(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700"
                  aria-label="Close dialog"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Progress Bar & Percentage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">
                  {sequentialModal.isComplete
                    ? 'Synchronization Complete'
                    : `Processing Step ${sequentialModal.currentStepIndex + 1} of ${sequentialModal.totalSteps}`}
                </span>
                <span className="font-mono font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  {sequentialModal.progressPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sequentialModal.isComplete
                      ? (sequentialModal.hasErrors ? 'bg-gradient-to-r from-amber-500 to-emerald-500' : 'bg-emerald-500')
                      : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                  }`}
                  style={{ width: `${Math.max(5, sequentialModal.progressPercent)}%` }}
                />
              </div>
            </div>

            {/* Live Dynamic Status / Alert Banner */}
            <div className={`p-3.5 rounded-xl border transition-all duration-300 flex items-start gap-3 ${
              sequentialModal.isComplete
                ? (sequentialModal.hasErrors
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200')
                : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200'
            }`}>
              <div className="mt-0.5 flex-shrink-0">
                {sequentialModal.isComplete ? (
                  sequentialModal.hasErrors ? (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )
                ) : (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-tight">
                  {sequentialModal.activeStepName}
                </p>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  {sequentialModal.activeDetail}
                </p>
              </div>
            </div>

            {/* Step-by-Step Pipeline */}
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
              {sequentialModal.steps.map((step, idx) => {
                const Icon = step.icon;
                const isCurrent = sequentialModal.currentStepIndex === idx && step.status === 'processing';
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-200 ${
                      step.status === 'completed'
                        ? 'bg-emerald-950/30 border-emerald-500/20 text-slate-200'
                        : step.status === 'failed'
                        ? 'bg-rose-950/30 border-rose-500/20 text-rose-200'
                        : isCurrent
                        ? 'bg-indigo-950/50 border-indigo-500/40 text-white ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                        step.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : step.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-400'
                          : isCurrent
                          ? 'bg-indigo-500/30 text-indigo-300'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {step.status === 'processing' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      ) : step.status === 'completed' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : step.status === 'failed' ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold truncate ${isCurrent ? 'font-bold text-white' : ''}`}>
                        {step.label}
                      </span>
                      {step.statBadge && step.status === 'completed' ? (
                        <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
                          {step.statBadge}
                        </span>
                      ) : step.status === 'processing' ? (
                        <span className="text-[10px] font-mono text-indigo-300 animate-pulse flex-shrink-0">
                          syncing...
                        </span>
                      ) : step.status === 'failed' ? (
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          failed
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 flex-shrink-0">queued</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completion Summary Stats */}
            {sequentialModal.isComplete && sequentialModal.completedStats.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {sequentialModal.completedStats.map((stat, sIdx) => (
                  <div key={sIdx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider block truncate">
                      {stat.label}
                    </span>
                    <span className="text-xs font-black text-emerald-400 truncate block mt-0.5">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Dialog Footer Controls */}
            <div className="pt-2 border-t border-slate-800">
              {sequentialModal.isComplete ? (
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                  {setActiveTab && (
                    <button
                      type="button"
                      onClick={() => {
                        setSequentialModal(null);
                        setActiveTab('squad');
                      }}
                      className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      View Squad Roster
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSequentialModal(null)}
                    className="w-full sm:flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer border border-slate-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <p className="text-center text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Spacing requests sequentially to prevent rate limits...
                </p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModal && successModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-6 text-center flex flex-col items-center gap-4 animate-scaleUp">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-900">{successModal.title}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{successModal.message}</p>
            </div>
            {successModal.stats && (
              <div className="grid grid-cols-2 gap-2.5 w-full my-1.5">
                {successModal.stats.map((stat, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block leading-none mb-1">{stat.label}</span>
                    <span className="text-xs font-black text-slate-800 truncate block">{stat.value}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setSuccessModal(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition shadow-md cursor-pointer"
            >
              Awesome, Got It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
