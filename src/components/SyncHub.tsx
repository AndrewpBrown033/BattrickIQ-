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
  Users, Coins, BookOpen, AlertCircle,
  Trophy, Calculator, 
  Calendar, Landmark as StadiumIcon, ShieldCheck,
  FileText, Check, Download, Cpu, Wifi
} from 'lucide-react';
import * as JSZipModule from 'jszip';

const JSZip = ((JSZipModule as any).default || JSZipModule) as any;

interface SyncLog {
  timestamp: string;
  type: string;
  description: string;
  status: 'success' | 'failed';
}

interface SyncHubProps {
  setActiveTab?: (tab: 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules') => void;
}

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

  const [pasteInput, setPasteInput] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [importTab, setImportTab] = useState<'upload' | 'paste' | 'extension' | 'bookmarklet' | 'direct'>('direct');
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [syncCode, setSyncCode] = useState<string>(() => {
    const saved = localStorage.getItem('bt_sync_code');
    if (saved) return saved;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    localStorage.setItem('bt_sync_code', code);
    return code;
  });

  const [selectedMapping, setSelectedMapping] = useState<string>('auto');

  // --- Direct Sync State ---
  const [directUsername, setDirectUsername] = useState<string>(() => localStorage.getItem('bt_battrick_username') || '');
  const [directPassword, setDirectPassword] = useState<string>('');
  const [rememberDirectUsername, setRememberDirectUsername] = useState<boolean>(() => !!localStorage.getItem('bt_battrick_username'));
  const [directSyncing, setDirectSyncing] = useState<boolean>(false);
  const [directSyncError, setDirectSyncError] = useState<string | null>(null);
  const [directPageStatuses, setDirectPageStatuses] = useState<{ name: string; success: boolean; error: string | null }[] | null>(null);

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

  const getBookmarkletCode = () => {
    let serverUrl = window.location.origin;
    if (!serverUrl || serverUrl === 'null') {
      const match = window.location.href.match(/https?:\/\/[^\/]+/);
      if (match) serverUrl = match[0];
    }
    if (!serverUrl || serverUrl === 'null') {
      serverUrl = window.location.protocol + '//' + window.location.host;
    }

    const jsCode = `(function(){
      const h=document.documentElement.outerHTML,u=window.location.href,c='${syncCode}',s='${serverUrl}';
      const i=document.createElement('div');
      i.style.position='fixed';i.style.top='10px';i.style.right='10px';i.style.zIndex='10000';
      i.style.background='#4f46e5';i.style.color='#fff';i.style.padding='10px 18px';i.style.borderRadius='8px';
      i.style.fontFamily='sans-serif';i.style.fontSize='12px';i.style.fontWeight='bold';
      i.textContent='⚡ Syncing with BattrickIQ...';
      document.body.appendChild(i);

      const frameName='bt_sync_iframe_'+Date.now();
      const iframe=document.createElement('iframe');
      iframe.name=frameName;
      iframe.style.display='none';
      document.body.appendChild(iframe);

      let receivedMessage=false;
      const onMsg=function(event){
        if(event.data&&event.data.type==='BT_SYNC_SUCCESS'){
          receivedMessage=true;
          i.style.background='#10b981';
          i.textContent='⚡ Synced '+event.data.detected+' successfully!';
          setTimeout(function(){try{i.remove();iframe.remove();}catch(e){}window.removeEventListener('message',onMsg);},3000);
        }
      };
      window.addEventListener('message',onMsg);

      const f=document.createElement('form');
      f.method='POST';f.action=s+'/api/sync-bookmarklet-form?code='+c;f.target=frameName;
      const iUrl=document.createElement('input');iUrl.type='hidden';iUrl.name='url';iUrl.value=u;f.appendChild(iUrl);
      const iHtml=document.createElement('input');iHtml.type='hidden';iHtml.name='html';iHtml.value=h;f.appendChild(iHtml);
      document.body.appendChild(f);
      f.submit();
      document.body.removeChild(f);

      setTimeout(function(){
        if(!receivedMessage){
          i.style.background='#f59e0b';
          i.textContent='⚡ Sync requested! Check BattrickIQ!';
          setTimeout(function(){try{i.remove();iframe.remove();}catch(e){}window.removeEventListener('message',onMsg);},4000);
        }
      },5000);
    })();`;
    return `javascript:${encodeURIComponent(jsCode.replace(/\s+/g, ' '))}`;
  };

  const bookmarkletRef = (el: HTMLAnchorElement | null) => {
    if (el) el.setAttribute('href', getBookmarkletCode());
  };

  const handleImportRef = useRef(handleImport);
  useEffect(() => {
    handleImportRef.current = handleImport;
  }, [handleImport]);

  useEffect(() => {
    loadFromLocalStorage();
    window.addEventListener('storage', loadFromLocalStorage);

    const handleExtensionMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'BATTRICK_EXTENSION_SYNC') {
        const { html, pageUrl, detectedType } = event.data;
        handleImportRef.current(html, detectedType);
        setIsExtensionConnected(true);
      } else if (event.data.type === 'BATTRICK_EXTENSION_CONNECTED') {
        setIsExtensionConnected(true);
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    window.postMessage({ type: 'BATTRICK_IQ_PING' }, '*');

    const interval = setInterval(() => {
      window.postMessage({ type: 'BATTRICK_IQ_PING' }, '*');
    }, 5000);

    return () => {
      window.removeEventListener('storage', loadFromLocalStorage);
      window.removeEventListener('message', handleExtensionMessage);
      clearInterval(interval);
    };
  }, []);

  // Poll for bookmarklet sync data
  useEffect(() => {
    let active = true;
    let timerId: any = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/sync-poll?code=${syncCode}`);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          if (data.hasData && data.html) {
            let forcedType: string | undefined = undefined;
            const urlLower = (data.url || '').toLowerCase();
            if (urlLower.includes('squad.asp')) forcedType = 'squad';
            else if (urlLower.includes('nets.asp')) forcedType = 'nets';
            else if (urlLower.includes('finances.asp')) forcedType = 'finances';
            else if (urlLower.includes('club.asp')) forcedType = 'club';
            else if (urlLower.includes('fixtures.asp')) forcedType = 'fixtures';
            else if (urlLower.includes('ground.asp')) forcedType = 'ground';
            else if (urlLower.includes('pavilion.asp') || urlLower.includes('office.asp')) forcedType = 'pavilion';

            handleImportRef.current(data.html, forcedType);
            setImportMessage({ text: 'Successfully synchronized data via BattrickIQ Bookmarklet!', success: true });
          }
        }
      } catch (err) {
        console.warn('Bookmarklet poll warning:', err);
      }

      if (active) {
        timerId = setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [syncCode]);

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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (file: File) => {
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) handleImport(text, selectedMapping === 'auto' ? undefined : selectedMapping);
    };
    reader.readAsText(file);
  };

  function handleImport(content: string, detectedType?: string) {
    if (!content.trim()) return;
    
    const result = parseBattrickPage(content, detectedType);
    const isValidType = result.type && result.type !== 'unknown';
    if (!isValidType) {
      setImportMessage({ text: 'Format not recognized. Please ensure you have copied the raw text or HTML of your Battrick squad, nets, finances, fixtures, or pavilion page.', success: false });
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
        const hasSquad = squad && squad.length > 0 && !isDemo;
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

    const activeSquad = shouldWipe ? [] : squad;
    const activeFinances = shouldWipe ? {
      cash: 0, members: 0, prOfficers: 0, finAdvisors: 0, sponsorsIncome: 0, gateReceipts: 0, interestReceived: 0, playerWages: 0, staffWages: 0, morale: 'respectable' as const, sponsorsMood: 'respectable' as const, membersConfidence: 'respectable', academyCondition: 'feeble', academyInvestment: 0, academyIts: 0, bowlingCoaches: 0, battingCoaches: 0, fieldingCoaches: 0, keepingCoaches: 0, staminaCoaches: 0, psychologists: 0
    } : finances;
    const activeFixtures = shouldWipe ? [] : fixtures;
    const activePavilion = shouldWipe ? null : pavilion;

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
      setSquad(merged);
      saveToLocalStorage(merged, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, activePavilion || undefined);
      setImportMessage({ text: `Successfully synced ${result.count} players into your squad!`, success: true });
      addSyncLog('squad', `Imported & updated squad roster (${result.count} players)`, 'success');
      
      const avgBtr = Math.round(merged.reduce((sum, p) => sum + p.btRating, 0) / merged.length);
      const weeklyWages = merged.reduce((sum, p) => sum + p.wage, 0);
      setSuccessModal({
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
      setSquad(merged);
      saveToLocalStorage(merged, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, activePavilion || undefined);
      setImportMessage({ text: `Matched and synced net training schedules for ${updatedCount} squad players!`, success: true });
      addSyncLog('nets', `Updated training net allocation schedule for ${updatedCount} players`, 'success');
      
      const totalNets = merged.reduce((total, p) => total + (p.nets ? (p.nets.batting + p.nets.bowling + p.nets.keeping + p.nets.stamina + p.nets.fielding) : 0), 0);
      setSuccessModal({
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
      setFinances(updatedFin);
      saveToLocalStorage(activeSquad, updatedFin, activeFixtures.length > 0 ? activeFixtures : undefined, activePavilion || undefined);
      setImportMessage({ text: result.type === 'club' ? 'Successfully parsed and synced club staff & morale levels!' : `Successfully parsed and synced club finances!`, success: true });
      addSyncLog(result.type, result.type === 'club' ? 'Synchronized club staff levels & morale' : `Synchronized weekly finances & staff ratios`, 'success');
      
      const isClub = result.type === 'club';
      setSuccessModal({
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
      setFixtures(result.fixtures);
      saveToLocalStorage(activeSquad, activeFinances, result.fixtures, activePavilion || undefined);
      setImportMessage({ text: `Successfully parsed and synced ${result.fixtures.length} club fixtures!`, success: true });
      addSyncLog('fixtures', `Synchronized ${result.fixtures.length} club fixtures`, 'success');
      
      setSuccessModal({
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
        ...(pavilion || {
          groundName: 'HairyBeanBags CG',
          pitchType: 'Flat',
          weather: 'Sunny',
          established: 'Season 42',
          membershipStatus: 'Elite Manager'
        }),
        ...result.pavilion
      };
      setPavilion(mergedPavilion);
      saveToLocalStorage(activeSquad, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, mergedPavilion);
      setImportMessage({ text: `Successfully parsed and synced pavilion details: ${mergedPavilion.groundName}!`, success: true });
      addSyncLog('pavilion', `Synchronized pavilion ground detail (${mergedPavilion.groundName})`, 'success');
      
      setSuccessModal({
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
        setPavilion(updatedPavilion);
      }

      saveToLocalStorage(activeSquad, activeFinances, activeFixtures.length > 0 ? activeFixtures : undefined, updatedPavilion || undefined);
      setImportMessage({ text: `Successfully parsed and synced stadium ground specs!`, success: true });
      addSyncLog('ground', `Updated stadium capacity to ${(stadium.capacity || 0).toLocaleString()} seats`, 'success');

      setSuccessModal({
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

  // --- Live Direct Sync Execution ---
  const handleDirectSync = async () => {
    if (!directUsername.trim() || !directPassword.trim()) {
      setDirectSyncError('Please enter your Battrick username and password.');
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

    try {
      const res = await fetch('/api/sync-battrick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: directUsername.trim(), password: directPassword })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        setDirectSyncError(result.error || 'Direct sync failed. Please check credentials or try again.');
        if (result.pageStatuses) setDirectPageStatuses(result.pageStatuses);
        addSyncLog('unknown', `Direct sync failed: ${result.error || 'unknown error'}`, 'failed');
        return;
      }

      setDirectPageStatuses(result.pageStatuses || null);

      const pagesToImport: { serverName: string; type: string }[] = [
        { serverName: 'squad', type: 'squad' },
        { serverName: 'nets', type: 'nets' },
        { serverName: 'finances', type: 'finances' },
        { serverName: 'club', type: 'club' },
        { serverName: 'fixtures', type: 'fixtures' },
        { serverName: 'pavilion', type: 'ground' }
      ];

      let importedCount = 0;
      pagesToImport.forEach(({ serverName, type }) => {
        const html = result.data?.[serverName];
        const status = (result.pageStatuses || []).find((p: any) => p.name === serverName);
        if (html && (!status || status.success)) {
          handleImport(html, type);
          importedCount++;
        } else if (status && !status.success) {
          addSyncLog(serverName, `Direct sync skipped ${serverName}: ${status.error}`, 'failed');
        }
      });

      const failedPages = (result.pageStatuses || []).filter((p: any) => !p.success);
      if (failedPages.length > 0) {
        setImportMessage({
          text: `Synced ${importedCount} of ${pagesToImport.length} pages directly. ${failedPages.map((p: any) => p.name).join(', ')} did not sync. Try again, or use Manual Paste for those pages.`,
          success: importedCount > 0
        });
      } else if (importedCount > 0) {
        setImportMessage({ text: '⚡ All club pages successfully synchronized via Direct Sync!', success: true });
      }

      setDirectPassword('');
    } catch (e: any) {
      console.error('[Direct Sync] error:', e);
      setDirectSyncError(e.message || 'Network error while contacting the sync server.');
      addSyncLog('unknown', `Direct sync error: ${e.message || String(e)}`, 'failed');
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
      text: "⚡ Success! Loaded the complete demo club: 11 active players, custom training nets, £4.5M bank cash, 1,450 club members, active fixtures, ground specs, and stadium layouts.",
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
                {showSyncControls ? "Hide Import Box" : "Import More Data"}
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
              Model, Predict & Maximize Your Squad Strategy
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2.5 leading-relaxed max-w-2xl">
              Welcome to <strong>BattrickIQ</strong>! Use Direct Sync, Bookmarklet, or manual import to load your club data.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 shrink-0">
            {!hasEverSynced && (
              <button
                type="button"
                onClick={loadAllSamplesAtOnce}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
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
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-display font-bold text-base text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Import Battrick Source Data
            </h3>
          </div>

          {/* Import Tabs */}
          <div className="flex border-b border-slate-150 mb-4 flex-wrap">
            <button
              type="button"
              onClick={() => setImportTab('direct')}
              className={`flex-1 min-w-[120px] py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                importTab === 'direct'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              Direct Sync (1-Click Background)
            </button>
            <button
              type="button"
              onClick={() => setImportTab('bookmarklet')}
              className={`flex-1 min-w-[120px] py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                importTab === 'bookmarklet'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              Bookmarklet Sync
            </button>
            <button
              type="button"
              onClick={() => setImportTab('paste')}
              className={`flex-1 min-w-[120px] py-2 text-xs font-bold border-b-2 transition ${
                importTab === 'paste'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Paste Raw Text / HTML
            </button>
            <button
              type="button"
              onClick={() => setImportTab('upload')}
              className={`flex-1 min-w-[120px] py-2 text-xs font-bold border-b-2 transition ${
                importTab === 'upload'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Upload Source Files
            </button>
          </div>

          {/* Tab 1: Direct Sync */}
          {importTab === 'direct' && (
            <div className="flex flex-col gap-4 animate-fadeIn text-xs">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <h4 className="font-bold text-emerald-950 font-sans text-sm flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  Direct Background Sync from Battrick.org
                </h4>
                <p className="text-emerald-800/80 mt-1 leading-relaxed font-sans">
                  Enter your Battrick.org login. BattrickIQ logs in securely in the background and reads your squad, nets, finances, club, fixtures, and stadium pages directly — no copy-pasting required!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600 font-sans">Battrick Username</label>
                  <input
                    type="text"
                    value={directUsername}
                    onChange={(e) => setDirectUsername(e.target.value)}
                    placeholder="Your Battrick username"
                    autoComplete="username"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600 font-sans">Battrick Password</label>
                  <input
                    type="password"
                    value={directPassword}
                    onChange={(e) => setDirectPassword(e.target.value)}
                    placeholder="Your Battrick password"
                    autoComplete="current-password"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDirectSync(); }}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-500 font-sans cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberDirectUsername}
                  onChange={(e) => setRememberDirectUsername(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Remember my username on this device (password is never stored)
              </label>

              <button
                type="button"
                onClick={handleDirectSync}
                disabled={directSyncing}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
              >
                {directSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {directSyncing ? 'Syncing directly in background...' : 'Sync Now'}
              </button>

              {directSyncError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{directSyncError}</span>
                </div>
              )}

              {directPageStatuses && (
                <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {directPageStatuses.map((p) => (
                    <div key={p.name} className="flex items-center justify-between px-3 py-2 bg-white">
                      <span className="font-bold text-slate-700 capitalize font-sans">{p.name}</span>
                      {p.success ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold"><Check className="w-3.5 h-3.5" /> Synced</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 font-bold" title={p.error || ''}><AlertCircle className="w-3.5 h-3.5" /> Failed</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Bookmarklet */}
          {importTab === 'bookmarklet' && (
            <div className="flex flex-col gap-4 animate-fadeIn text-xs">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-indigo-950 font-sans text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                    Bookmarklet Syncing
                  </h4>
                  <p className="text-indigo-700 mt-1 leading-normal font-sans text-[11px]">
                    Drag the bookmark button to your browser bar, then click it on any Battrick page to sync immediately.
                  </p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">YOUR SYNC CODE</span>
                  <span className="font-mono text-xl font-black text-indigo-900 tracking-wider bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 mt-1 shadow-sm">
                    {syncCode}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex items-center gap-3">
                <a
                  ref={bookmarkletRef}
                  onClick={(e) => e.preventDefault()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition shrink-0 flex items-center gap-2 cursor-grab select-none font-sans"
                  title="Drag me to your Bookmarks Bar!"
                >
                  <Sparkles className="w-4 h-4 fill-white/10" />
                  ⚡ Sync to BattrickIQ
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getBookmarkletCode());
                    alert('Bookmarklet code copied to clipboard!');
                  }}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer font-sans"
                >
                  Copy Bookmarklet Code
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Paste */}
          {importTab === 'paste' && (
            <div className="flex flex-col gap-3 animate-fadeIn">
              <textarea
                id="sync-textarea-pasted"
                rows={5}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="Paste raw Battrick webpage contents here..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
              />
              <button
                type="button"
                onClick={() => handleImport(pasteInput, selectedMapping === 'auto' ? undefined : selectedMapping)}
                disabled={!pasteInput.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
              >
                <RefreshCw className="w-4 h-4" />
                Analyze & Sync Content
              </button>
            </div>
          )}

          {/* Tab 4: Upload */}
          {importTab === 'upload' && (
            <div className="flex flex-col gap-3 animate-fadeIn">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('sync-file-input')?.click()}
                className="w-full p-8 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50"
              >
                <input
                  id="sync-file-input"
                  type="file"
                  accept=".html,.htm,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="w-10 h-10 mb-2.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">Click to browse or drop file here</span>
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
            Last Imported Sync History Log
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
            No sync history logs recorded yet. Use Direct Sync or Bookmarklet above to start syncing.
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
                This will clear local club data so you can resync from scratch.
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
