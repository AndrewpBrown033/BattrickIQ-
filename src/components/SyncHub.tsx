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
  ArrowRight, Trophy, Calculator, 
  Calendar, Landmark as StadiumIcon, ShieldCheck,
  FileText, Check, Download, Cpu, Wifi, Globe
} from 'lucide-react';
import * as JSZipModule from 'jszip';

// Handle both standard default import (with esModuleInterop) and namespace import (without esModuleInterop)
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
  const [importTab, setImportTab] = useState<'upload' | 'paste' | 'extension' | 'bookmarklet'>('bookmarklet');
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [selectedGuide, setSelectedGuide] = useState<'desktop' | 'ipad'>(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent.toLowerCase();
      const isIOS = /ipad|iphone|ipod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
      return isIOS ? 'ipad' : 'desktop';
    }
    return 'desktop';
  });

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
      i.style.background='#4f46e5';i.style.color='#fff';i.style.padding='12px 20px';i.style.borderRadius='10px';
      i.style.fontFamily='system-ui,-apple-system,BlinkMacSystemFont,sans-serif';i.style.fontSize='13px';i.style.fontWeight='bold';
      i.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05)';
      i.style.border='1px solid rgba(255,255,255,0.1)';
      i.textContent='⚡ Syncing with BattrickIQ...';
      document.body.appendChild(i);

      let receivedMessage=false;
      const onMsg=function(event){
        if(event.data&&event.data.type==='BT_SYNC_SUCCESS'){
          receivedMessage=true;
          i.style.background='#10b981';
          i.textContent='⚡ Synced '+event.data.detected+' successfully!';
          setTimeout(function(){try{i.remove();}catch(e){}},3000);
        }
      };
      window.addEventListener('message',onMsg);

      const sendViaFetch=async function(){
        try{
          const response=await fetch(s+'/api/sync-bookmarklet?code='+c,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({url:u,html:h})
          });
          const resJson=await response.json();
          if(resJson&&resJson.success){
            receivedMessage=true;
            i.style.background='#10b981';
            i.textContent='⚡ Synced '+resJson.type+' successfully!';
            setTimeout(function(){try{i.remove();}catch(e){}},3000);
            return true;
          }
        }catch(err){
          console.warn('CORS fetch failed, trying form fallback:',err);
        }
        return false;
      };

      const sendViaForm=function(){
        const frameName='bt_sync_iframe_'+Date.now();
        const iframe=document.createElement('iframe');
        iframe.name=frameName;
        iframe.style.display='none';
        document.body.appendChild(iframe);

        const f=document.createElement('form');
        f.method='POST';
        f.action=s+'/api/sync-bookmarklet-form?code='+c;
        f.target=frameName;

        const iUrl=document.createElement('input');
        iUrl.type='hidden';iUrl.name='url';iUrl.value=u;
        f.appendChild(iUrl);

        const iHtml=document.createElement('input');
        iHtml.type='hidden';iHtml.name='html';iHtml.value=h;
        f.appendChild(iHtml);

        document.body.appendChild(f);
        f.submit();
        document.body.removeChild(f);

        setTimeout(function(){
          if(!receivedMessage){
            i.style.background='#f59e0b';
            i.textContent='⚡ Sync requested! Check BattrickIQ!';
            setTimeout(function(){
              try{i.remove();iframe.remove();}catch(e){}
              window.removeEventListener('message',onMsg);
            },4000);
          }
        },5000);
      };

      sendViaFetch().then(function(ok){
        if(!ok){
          sendViaForm();
        }else{
          window.removeEventListener('message',onMsg);
        }
      });
    })();`;
    
    // Minify a bit by removing excess whitespace/newlines for URI encoding safety
    const minified = jsCode.replace(/\s+/g, ' ');
    return `javascript:${encodeURIComponent(minified)}`;
  };

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const success = document.execCommand('copy');
    document.body.removeChild(el);
    if (success) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } else {
      alert("Manual selection required. Please copy the code displayed below.");
    }
  };

  const handleCopyBookmarklet = () => {
    const code = getBookmarkletCode();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code)
          .then(() => {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 3000);
          })
          .catch(() => {
            fallbackCopy(code);
          });
      } else {
        fallbackCopy(code);
      }
    } catch (err) {
      fallbackCopy(code);
    }
  };

  const bookmarkletRef = (el: HTMLAnchorElement | null) => {
    if (el) {
      el.setAttribute('href', getBookmarkletCode());
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const [selectedMapping, setSelectedMapping] = useState<string>('auto');

  const handleFile = (file: File) => {
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        handleImport(text, selectedMapping === 'auto' ? undefined : selectedMapping);
      }
    };
    reader.readAsText(file);
  };
  const [importMessage, setImportMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);
  const [wipeConfirmText, setWipeConfirmText] = useState<string>('');
  const [showSyncControls, setShowSyncControls] = useState<boolean>(true);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    type: 'squad' | 'nets' | 'finances' | 'club' | 'fixtures' | 'pavilion' | 'ground' | 'demo' | 'unknown';
    title: string;
    message: string;
    stats?: { label: string; value: string | number }[];
  } | null>(null);

  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Add a helper to push to the sync logs array
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
    
    const updated = [newLog, ...currentLogs].slice(0, 50); // Keep last 50
    localStorage.setItem('bt_sync_logs', JSON.stringify(updated));
    setSyncLogs(updated);
  };

  // Load from LocalStorage on mount and listen to storage updates
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
      // Create starting history if none exists but squad data is present
      const initialLogs: SyncLog[] = [];
      if (savedSquad) {
        try {
          const parsed = JSON.parse(savedSquad);
          initialLogs.push({
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            type: 'squad',
            description: `Imported squad roster (${parsed.length} players)`,
            status: 'success'
          });
        } catch (e) {}
      }
      if (savedFin) {
        initialLogs.push({
          timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
          type: 'finances',
          description: 'Synchronized weekly finances & staff ledger',
          status: 'success'
        });
      }
      if (savedFixtures) {
        try {
          const parsed = JSON.parse(savedFixtures);
          initialLogs.push({
            timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
            type: 'fixtures',
            description: `Synchronized fixture list (${parsed.length} matches)`,
            status: 'success'
          });
        } catch (e) {}
      }
      if (savedPavilion) {
        initialLogs.push({
          timestamp: new Date(Date.now() - 3600000 * 1.1).toISOString(),
          type: 'pavilion',
          description: 'Synchronized stadium pitch & weather info',
          status: 'success'
        });
      }

      if (initialLogs.length > 0) {
        localStorage.setItem('bt_sync_logs', JSON.stringify(initialLogs));
        setSyncLogs(initialLogs);
      } else {
        setSyncLogs([]);
      }
    }
  };

  const handleImportRef = useRef(handleImport);
  useEffect(() => {
    handleImportRef.current = handleImport;
  }, [handleImport]);

  useEffect(() => {
    loadFromLocalStorage();
    window.addEventListener('storage', loadFromLocalStorage);

    // Listen for events from Chrome Extension Sync Helper
    const handleExtensionMessage = (event: MessageEvent) => {
      if (!event.data) return;
      
      if (event.data.type === 'BATTRICK_EXTENSION_SYNC') {
        const { html, pageUrl, detectedType } = event.data;
        console.log('[BattrickIQ SyncHub] Received sync data from Chrome Extension:', pageUrl, 'detectedType:', detectedType);
        handleImportRef.current(html, detectedType);
        setIsExtensionConnected(true);
      } else if (event.data.type === 'BATTRICK_EXTENSION_CONNECTED') {
        console.log('[BattrickIQ SyncHub] Chrome Extension handshake successful! Connected.');
        setIsExtensionConnected(true);
      }
    };

    window.addEventListener('message', handleExtensionMessage);

    // Initial ping to notify the content script we are here
    window.postMessage({ type: 'BATTRICK_IQ_PING' }, '*');

    // Also check every few seconds to ensure connection indicator stays alive if they reloaded extension
    const interval = setInterval(() => {
      window.postMessage({ type: 'BATTRICK_IQ_PING' }, '*');
    }, 5000);

    return () => {
      window.removeEventListener('storage', loadFromLocalStorage);
      window.removeEventListener('message', handleExtensionMessage);
      clearInterval(interval);
    };
  }, []);

  // Poll for bookmarklet sync data in the background with robust JSON & HTTP handling
  useEffect(() => {
    let active = true;
    let timerId: any = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/sync-poll?code=${syncCode}`);
        if (!active) return;
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Received non-JSON response from server");
        }
        const data = await res.json();
        if (data.hasData && data.html) {
          console.log('[BattrickIQ SyncHub] Received polling sync data from bookmarklet:', data.url);
          
          let forcedType: string | undefined = undefined;
          const urlLower = (data.url || '').toLowerCase();
          if (urlLower.includes('squad.asp')) {
            forcedType = 'squad';
          } else if (urlLower.includes('nets.asp')) {
            forcedType = 'nets';
          } else if (urlLower.includes('finances.asp')) {
            forcedType = 'finances';
          } else if (urlLower.includes('club.asp')) {
            forcedType = 'club';
          } else if (urlLower.includes('fixtures.asp')) {
            forcedType = 'fixtures';
          } else if (urlLower.includes('ground.asp')) {
            forcedType = 'ground';
          } else if (urlLower.includes('pavilion.asp') || urlLower.includes('office.asp')) {
            forcedType = 'pavilion';
          }

          handleImportRef.current(data.html, forcedType);
          setImportMessage({ text: 'Successfully synchronized data via BattrickIQ Bookmarklet!', success: true });
        }
      } catch (err) {
        // Log warnings as minor logs to keep the console clean during container restarts/reboots
        console.warn('Bookmarklet sync polling status (retrying):', err instanceof Error ? err.message : err);
      }

      if (active) {
        timerId = setTimeout(poll, 3000); // Poll every 3 seconds
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
    }
    if (newFixtures) {
      localStorage.setItem('bt_fixtures', JSON.stringify(newFixtures));
    }
    if (newPavilion) {
      localStorage.setItem('bt_pavilion', JSON.stringify(newPavilion));
    }
    // Dispatch storage event to let other tabs know about updates
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('bt_cloud_backup_request'));
  };

  const handleDownloadExtension = async () => {
    try {
      const zip = new JSZip();
      
      const manifest = {
        "manifest_version": 3,
        "name": "BattrickIQ Sync Helper",
        "version": "1.0.0",
        "description": "Automate syncing of squad, nets, finances, stadium, fixtures, and club pages from Battrick.org directly to BattrickIQ.",
        "permissions": [
          "activeTab",
          "tabs",
          "storage",
          "scripting"
        ],
        "host_permissions": [
          "*://*.battrick.org/*",
          "*://battrick.org/*",
          "*://*.run.app/*",
          "*://localhost/*",
          "*://localhost:*/*",
          "*://127.0.0.1/*",
          "*://127.0.0.1:*/*",
          "<all_urls>"
        ],
        "background": {
          "service_worker": "background.js"
        },
        "content_scripts": [
          {
            "matches": [
              "*://*.battrick.org/*",
              "*://battrick.org/*"
            ],
            "js": ["content-battrick.js"],
            "run_at": "document_idle",
            "all_frames": true
          },
          {
            "matches": [
              "*://localhost/*",
              "*://localhost:*/*",
              "*://127.0.0.1/*",
              "*://127.0.0.1:*/*",
              "*://*.run.app/*",
              "*://*.asia-southeast1.run.app/*",
              "*://*.us-central1.run.app/*",
              "*://*.europe-west1.run.app/*",
              "*://*.us-east1.run.app/*",
              "*://*.us-west1.run.app/*",
              "*://*.asia-east1.run.app/*",
              "*://*.asia-northeast1.run.app/*"
            ],
            "js": ["content-battrickiq.js"],
            "run_at": "document_idle",
            "all_frames": true
          }
        ],
        "action": {
          "default_title": "BattrickIQ Sync Helper",
          "default_popup": "popup.html"
        }
      };
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      const backgroundJs = `// Background service worker for BattrickIQ Sync Helper

// Keep track of tabs opened for automated syncing so we can auto-close them
let autoOpenedTabs = {};

// Keep track of active BattrickIQ tabs and their frames persistently across Service Worker suspends
async function getStoredFrames() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ battrickIqFrames: [] }, (data) => {
      resolve(data.battrickIqFrames || []);
    });
  });
}

async function setStoredFrames(frames) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ battrickIqFrames: frames }, () => {
      resolve();
    });
  });
}

// Auto-inject content scripts into existing tabs upon installation/reload
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      if (!tab.url || !tab.id) continue;
      const url = tab.url.toLowerCase();
      if (url.includes('battrick.org')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content-battrick.js']
        }).catch(err => console.log('Failed to auto-inject content-battrick.js:', err));
      } else if (url.includes('run.app') || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('battrickiq')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content-battrickiq.js']
        }).catch(err => console.log('Failed to auto-inject content-battrickiq.js:', err));
      }
    }
  });
});

// Dynamic content script injection on navigation or tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = tab.url.toLowerCase();
    if (url.includes('battrick.org')) {
      chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ['content-battrick.js']
      }).catch(err => console.log('Failed dynamic update inject content-battrick.js:', err));
    } else if (url.includes('run.app') || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('battrickiq')) {
      chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ['content-battrickiq.js']
      }).catch(err => console.log('Failed dynamic update inject content-battrickiq.js:', err));
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "REGISTER_BATTRICKIQ") {
    if (sender.tab && sender.tab.id !== undefined) {
      const frameId = sender.frameId || 0;
      getStoredFrames().then((frames) => {
        const exists = frames.some(f => f.tabId === sender.tab.id && f.frameId === frameId);
        if (!exists) {
          frames.push({ tabId: sender.tab.id, frameId: frameId });
          setStoredFrames(frames);
        }
      });
      sendResponse({ registered: true });
    }
    return true;
  }

  if (request.action === "START_AUTO_SYNC") {
    const pages = [
      { name: "Squad", url: "https://www.battrick.org/nl/squad.asp" },
      { name: "Club", url: "https://www.battrick.org/nl/club.asp" },
      { name: "Nets", url: "https://www.battrick.org/nl/nets.asp" },
      { name: "Pavilion", url: "https://www.battrick.org/nl/office.asp" },
      { name: "Finances", url: "https://www.battrick.org/nl/finances.asp" },
      { name: "Stadium", url: "https://www.battrick.org/nl/ground.asp" },
      { name: "Fixtures", url: "https://www.battrick.org/nl/fixtures.asp" }
    ];
    pages.forEach((p) => {
      chrome.tabs.create({ url: p.url, active: false }, (tab) => {
        if (tab && tab.id) {
          autoOpenedTabs[tab.id] = p.name;
        }
      });
    });
    sendResponse({ success: true, count: pages.length });
    return true;
  }

  if (request.action === "CHECK_AUTO_SYNC") {
    const isAuto = sender.tab && sender.tab.id && autoOpenedTabs[sender.tab.id];
    sendResponse({ autoSync: !!isAuto });
    return true;
  }

  if (request.action === "SYNC_DATA") {
    console.log("Received sync data from Battrick page, scanning for open BattrickIQ tabs...");
    
    // Check if this was an auto-opened tab, and delete/schedule removal
    const isAutoOpened = sender.tab && sender.tab.id && autoOpenedTabs[sender.tab.id];
    const targetTabId = sender.tab ? sender.tab.id : null;
    
    if (isAutoOpened && targetTabId) {
      delete autoOpenedTabs[targetTabId];
      setTimeout(() => {
        chrome.tabs.remove(targetTabId, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
        });
      }, 1500);
    }
    
    getStoredFrames().then((storedFrames) => {
      chrome.tabs.query({}, async (tabs) => {
        const activeTabIds = new Set((tabs || []).map(t => t.id));
        // Filter out frames from closed tabs
        let battrickIqFrames = storedFrames.filter(f => activeTabIds.has(f.tabId));
        await setStoredFrames(battrickIqFrames);
        
        const candidates = [...battrickIqFrames];
        if (tabs) {
          for (const tab of tabs) {
            if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
              continue;
            }
            const url = tab.url.toLowerCase();
            // Fallback detection of BattrickIQ tab url
            const isPotentialBiq = url.includes('run.app') || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('battrickiq');
            if (isPotentialBiq) {
              const hasFrame0 = candidates.some(c => c.tabId === tab.id && c.frameId === 0);
              if (!hasFrame0) {
                candidates.push({ tabId: tab.id, frameId: 0 });
              }
            }
          }
        }
        
        let successCount = 0;
        for (const candidate of candidates) {
          try {
            // Proactively ensure the content script is injected into BattrickIQ before sending PING
            await new Promise((resolve) => {
              chrome.scripting.executeScript({
                target: { tabId: candidate.tabId },
                files: ['content-battrickiq.js']
              }, () => {
                chrome.runtime.lastError; // silence errors if already injected
                resolve(null);
              });
            });

            const response = await new Promise((resolve) => {
              chrome.tabs.sendMessage(candidate.tabId, { action: "PING" }, { frameId: candidate.frameId }, (res) => {
                chrome.runtime.lastError; // silence errors
                resolve(res);
              });
            });
            
            if (response && response.isBattrickIq) {
              await new Promise((resolve) => {
                chrome.tabs.sendMessage(candidate.tabId, { 
                  action: "IMPORT_HTML", 
                  html: request.html, 
                  pageUrl: request.pageUrl,
                  detectedType: request.detectedType
                }, { frameId: candidate.frameId }, (res) => {
                  chrome.runtime.lastError;
                  if (res && res.success) {
                    successCount++;
                  }
                  resolve(null);
                });
              });
            }
          } catch (e) {
            // Frame not active or not BattrickIQ
          }
        }
        
        if (successCount > 0) {
          sendResponse({ success: true, count: successCount });
        } else {
          sendResponse({ 
            success: false, 
            error: "BattrickIQ dashboard not found or tab is closed/unloaded. Please open BattrickIQ tab first, reload it, and then try again!" 
          });
        }
      });
    });
    
    return true; // Keep message channel open
  }
});`;
      zip.file("background.js", backgroundJs);

      const contentBattrickIqJs = `// Content script injected into BattrickIQ page

// Notify the background script that we are a BattrickIQ page
chrome.runtime.sendMessage({ action: "REGISTER_BATTRICKIQ" });

// Establish initial connection
window.postMessage({ type: "BATTRICK_EXTENSION_CONNECTED" }, "*");

// Listen for pings from the page
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "BATTRICK_IQ_PING") {
    window.postMessage({ type: "BATTRICK_EXTENSION_CONNECTED" }, "*");
    // Auto re-register with background script in case background script reloaded
    chrome.runtime.sendMessage({ action: "REGISTER_BATTRICKIQ" });
  }
  if (event.data && event.data.type === "TRIGGER_AUTO_SYNC_PAGES") {
    chrome.runtime.sendMessage({ action: "START_AUTO_SYNC" });
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING") {
    const isBiq = !!document.querySelector('meta[name="application-name"][content="BattrickIQ"]') || 
                  document.title.includes("BattrickIQ") || 
                  !!document.getElementById("root");
                  
    sendResponse({ isBattrickIq: isBiq });
    return true;
  }
  
  if (message.action === "IMPORT_HTML") {
    window.postMessage({
      type: "BATTRICK_EXTENSION_SYNC",
      html: message.html,
      pageUrl: message.pageUrl,
      detectedType: message.detectedType
    }, "*");
    
    sendResponse({ success: true });
    return true;
  }
});`;
      zip.file("content-battrickiq.js", contentBattrickIqJs);

      const contentBattrickJs = `// Content script running on Battrick.org

function getBattrickPageType() {
  const pageTitleLink = document.querySelector('#pagetitle a[data-page]') || document.querySelector('#pagetitle [data-page]') || document.querySelector('[data-page]');
  if (pageTitleLink) {
    const dataPage = pageTitleLink.getAttribute('data-page')?.toLowerCase() || '';
    if (dataPage.includes('squad.asp')) return 'Squad';
    if (dataPage.includes('nets.asp')) return 'Nets';
    if (dataPage.includes('finances.asp')) return 'Finances';
    if (dataPage.includes('club.asp')) return 'Club';
    if (dataPage.includes('fixtures.asp')) return 'Fixtures';
    if (dataPage.includes('ground.asp') || dataPage.includes('expandground.asp')) return 'Stadium';
    if (dataPage.includes('pavilion.asp') || dataPage.includes('office.asp')) return 'Pavilion';
  }

  const url = window.location.href.toLowerCase();
  if (url.includes('squad.asp')) return 'Squad';
  if (url.includes('nets.asp')) return 'Nets';
  if (url.includes('finances.asp')) return 'Finances';
  if (url.includes('ground.asp')) return 'Stadium';
  if (url.includes('fixtures.asp')) return 'Fixtures';
  if (url.includes('club.asp')) return 'Club';
  if (url.includes('pavilion.asp') || url.includes('office.asp')) return 'Pavilion';
  return null;
}

function initSyncButton() {
  const pageType = getBattrickPageType();
  if (!pageType) return;

  // Auto sync if tab was opened automatically by BattrickIQ One-Click Auto-Sync
  chrome.runtime.sendMessage({ action: "CHECK_AUTO_SYNC" }, (response) => {
    if (response && response.autoSync) {
      let typeToSend = pageType.toLowerCase();
      if (typeToSend === "stadium") typeToSend = "ground";
      const html = document.documentElement.outerHTML;
      chrome.runtime.sendMessage({
        action: "SYNC_DATA",
        html: html,
        pageUrl: window.location.href,
        detectedType: typeToSend
      });
    }
  });

  const style = document.createElement('style');
  style.innerHTML = \`
    .biq-floating-sync {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 100000;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 50px;
      box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .biq-floating-sync:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.5);
      background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
    }
    .biq-floating-sync:active {
      transform: translateY(1px);
    }
    .biq-toast {
      position: fixed;
      bottom: 85px;
      right: 24px;
      z-index: 100001;
      background: #1e293b;
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 8px;
      font-family: sans-serif;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      border-left: 4px solid #10b981;
    }
    .biq-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .biq-toast.error {
      border-left-color: #ef4444;
    }
  \`;
  document.head.appendChild(style);

  const button = document.createElement('div');
  button.className = 'biq-floating-sync';
  button.innerHTML = \`
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
    </svg>
    <span>Sync \${pageType} to BattrickIQ</span>
  \`;
  
  const toast = document.createElement('div');
  toast.className = 'biq-toast';
  document.body.appendChild(toast);

  function showToast(message, isError = false) {
    toast.textContent = message;
    if (isError) {
      toast.classList.add('error');
    } else {
      toast.classList.remove('error');
    }
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  button.addEventListener('click', () => {
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.7';
    const span = button.querySelector('span');
    const originalText = span.textContent;
    span.textContent = 'Syncing...';

    const html = document.documentElement.outerHTML;

    let typeToSend = pageType.toLowerCase();
    if (typeToSend === 'stadium') typeToSend = 'ground';

    chrome.runtime.sendMessage({
      action: "SYNC_DATA",
      html: html,
      pageUrl: window.location.href,
      detectedType: typeToSend
    }, (response) => {
      button.style.pointerEvents = 'auto';
      button.style.opacity = '1';
      span.textContent = originalText;

      if (chrome.runtime.lastError) {
        showToast("Communication error. Please reload the page.", true);
        return;
      }

      if (response && response.success) {
        showToast(\`⚡ Successfully synced \${pageType} data!\`);
      } else {
        showToast(response?.error || "BattrickIQ dashboard not found.", true);
      }
    });
  });

  document.body.appendChild(button);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSyncButton);
} else {
  initSyncButton();
}
`;
      zip.file("content-battrick.js", contentBattrickJs);

      const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      background: #f8fafc;
      color: #0f172a;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      border-b: 1px solid #e2e8f0;
      padding-bottom: 12px;
    }
    .header h3 {
      margin: 0;
      color: #4f46e5;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #f1f5f9;
      color: #64748b;
      margin-bottom: 14px;
    }
    .status-badge.active {
      background: #ecfdf5;
      color: #059669;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #94a3b8;
    }
    .status-badge.active .status-dot {
      background: #10b981;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
      transition: all 0.2s ease;
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 12px -2px rgba(79, 70, 229, 0.3);
      background: linear-gradient(135deg, #5b51f7 0%, #4338ca 100%);
    }
    .btn:active {
      transform: translateY(0);
    }
    .btn:disabled {
      background: #cbd5e1;
      color: #94a3b8;
      box-shadow: none;
      cursor: not-allowed;
      border-color: transparent;
    }
    .btn.secondary {
      background: #ffffff;
      color: #475569;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .btn.secondary:hover {
      background: #f8fafc;
      color: #1e293b;
      border-color: #cbd5e1;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    .footer {
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
      margin-top: 14px;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }
    .toast-msg {
      font-size: 11px;
      font-weight: 600;
      color: #1e293b;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 8px;
      margin-top: 8px;
      text-align: center;
      display: none;
    }
    .toast-msg.error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }
    .debug-log {
      display: none;
      font-family: monospace;
      font-size: 9px;
      color: #ef4444;
      background: #fef2f2;
      border: 1px solid #fee2e2;
      padding: 8px;
      border-radius: 6px;
      margin-top: 10px;
      max-height: 80px;
      overflow-y: auto;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="header">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
    </svg>
    <h3>BattrickIQ Sync Helper</h3>
  </div>

  <div class="status-badge" id="page-status">
    <div class="status-dot"></div>
    <span id="status-text">Checking current tab...</span>
  </div>

  <button class="btn" id="sync-btn" disabled>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
    </svg>
    Sync Current Page
  </button>

  <button class="btn secondary" id="open-biq-btn">
    🌐 Open BattrickIQ
  </button>

  <button class="btn secondary" id="open-bt-btn">
    🏏 Open Battrick.org
  </button>

  <div class="toast-msg" id="toast"></div>
  <div class="debug-log" id="debug-log"></div>

  <div class="footer">
    BattrickIQ Sync Helper v1.0.0
  </div>

  <script src="popup.js"></script>
</body>
</html>`;
      zip.file("popup.html", popupHtml);

      const popupJs = `const syncBtn = document.getElementById('sync-btn');
const openBiqBtn = document.getElementById('open-biq-btn');
const openBtBtn = document.getElementById('open-bt-btn');
const statusBadge = document.getElementById('page-status');
const statusText = document.getElementById('status-text');
const toast = document.getElementById('toast');
const debugLog = document.getElementById('debug-log');

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.style.display = 'block';
  if (isError) {
    toast.className = 'toast-msg error';
  } else {
    toast.className = 'toast-msg';
  }
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4500);
}

function logDebugError(context, err) {
  console.error(context, err);
  if (debugLog) {
    debugLog.style.display = 'block';
    const msg = document.createElement('div');
    msg.textContent = "[" + context + "] " + (err.message || String(err));
    debugLog.appendChild(msg);
  }
}

// Robust helper to get active tab
function getActiveTab(callback) {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      callback(null);
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        logDebugError('QueryActiveTab', chrome.runtime.lastError);
      }
      if (tabs && tabs.length > 0) {
        callback(tabs[0]);
      } else {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs2) => {
          if (chrome.runtime.lastError) {
            logDebugError('QueryActiveTabLastFocused', chrome.runtime.lastError);
          }
          if (tabs2 && tabs2.length > 0) {
            callback(tabs2[0]);
          } else {
            chrome.tabs.query({ active: true }, (tabs3) => {
              if (chrome.runtime.lastError) {
                logDebugError('QueryActiveTabFallback', chrome.runtime.lastError);
              }
              if (tabs3 && tabs3.length > 0) {
                callback(tabs3[0]);
              } else {
                callback(null);
              }
            });
          }
        });
      }
    });
  } catch (err) {
    logDebugError('GetActiveTabFatal', err);
    callback(null);
  }
}

// Get active tab and detect page type
try {
  getActiveTab((tab) => {
    if (!tab) {
      statusBadge.classList.remove('active');
      statusText.textContent = 'Active tab not detected';
      return;
    }
    const url = tab.url || '';

    const isBattrick = url.toLowerCase().includes('battrick.org');
    
    if (isBattrick) {
      let pageType = 'Page';
      const lowercaseUrl = url.toLowerCase();
      if (lowercaseUrl.includes('squad.asp')) pageType = 'Squad';
      else if (lowercaseUrl.includes('nets.asp')) pageType = 'Nets';
      else if (lowercaseUrl.includes('finances.asp')) pageType = 'Finances';
      else if (lowercaseUrl.includes('ground.asp')) pageType = 'Stadium';
      else if (lowercaseUrl.includes('fixtures.asp')) pageType = 'Fixtures';
      else if (lowercaseUrl.includes('club.asp')) pageType = 'Club';

      statusBadge.classList.add('active');
      statusText.textContent = "On Battrick: " + pageType;
      syncBtn.removeAttribute('disabled');
      syncBtn.innerHTML = '⚡ Sync ' + pageType + ' to BattrickIQ';
    } else {
      statusBadge.classList.remove('active');
      statusText.textContent = 'Not on Battrick.org';
    }
  });
} catch (err) {
  logDebugError('TabDetectionInit', err);
}

// Handle Sync Button
syncBtn.addEventListener('click', () => {
  try {
    syncBtn.disabled = true;
    const originalText = syncBtn.innerHTML;
    syncBtn.textContent = 'Syncing...';

    getActiveTab((tab) => {
      if (!tab) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
        showToast('No active tab found.', true);
        return;
      }

      // We execute script on the tab to get its HTML content
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          const err = chrome.runtime.lastError || new Error('No results');
          logDebugError('ExecuteScript', err);
          syncBtn.disabled = false;
          syncBtn.innerHTML = originalText;
          showToast('Failed to read page content. Refresh the page and try again.', true);
          return;
        }

        const html = results[0].result;
        
        let typeToSend = 'unknown';
        
        // Use high-priority data-page check from HTML content
        const match = html.match(/data-page=["']([^"']+\.asp)["']/i);
        if (match) {
          const dp = match[1].toLowerCase();
          if (dp.includes('squad.asp')) typeToSend = 'squad';
          else if (dp.includes('nets.asp')) typeToSend = 'nets';
          else if (dp.includes('finances.asp')) typeToSend = 'finances';
          else if (dp.includes('club.asp')) typeToSend = 'club';
          else if (dp.includes('fixtures.asp')) typeToSend = 'fixtures';
          else if (dp.includes('ground.asp') || dp.includes('expandground.asp')) typeToSend = 'ground';
          else if (dp.includes('pavilion.asp') || dp.includes('office.asp')) typeToSend = 'pavilion';
        }
        
        if (typeToSend === 'unknown') {
          const urlLower = (tab.url || '').toLowerCase();
          if (urlLower.includes('squad.asp')) typeToSend = 'squad';
          else if (urlLower.includes('nets.asp')) typeToSend = 'nets';
          else if (urlLower.includes('finances.asp')) typeToSend = 'finances';
          else if (urlLower.includes('ground.asp')) typeToSend = 'ground';
          else if (urlLower.includes('fixtures.asp')) typeToSend = 'fixtures';
          else if (urlLower.includes('club.asp')) typeToSend = 'club';
          else if (urlLower.includes('pavilion.asp') || urlLower.includes('office.asp')) typeToSend = 'pavilion';
        }

        chrome.runtime.sendMessage({
          action: "SYNC_DATA",
          html: html,
          pageUrl: tab.url,
          detectedType: typeToSend
        }, (response) => {
          syncBtn.disabled = false;
          syncBtn.innerHTML = originalText;

          if (chrome.runtime.lastError) {
            logDebugError('SendMessageSync', chrome.runtime.lastError);
            showToast('Sync server communication failed.', true);
            return;
          }

          if (response && response.success) {
            showToast('⚡ Sync successful! Check your BattrickIQ tab.');
          } else {
            showToast(response?.error || 'Sync failed. Make sure BattrickIQ is open.', true);
          }
        });
      });
    });
  } catch (err) {
    logDebugError('SyncButtonFatal', err);
    syncBtn.disabled = false;
    showToast('Failed to start sync: ' + err.message, true);
  }
});

// Handle Open BattrickIQ
openBiqBtn.addEventListener('click', () => {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      window.open('${window.location.origin}', '_blank');
      return;
    }
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        logDebugError('OpenBiqQuery', chrome.runtime.lastError);
      }
      const safeTabs = tabs || [];
      const existingTab = safeTabs.find(t => t.url && (
        t.url.includes('run.app') || 
        t.url.includes('localhost') || 
        t.url.includes('127.0.0.1') || 
        t.url.includes('battrickiq')
      ));
      if (existingTab && existingTab.id !== undefined) {
        chrome.tabs.update(existingTab.id, { active: true });
      } else {
        chrome.tabs.create({ url: '${window.location.origin}' });
      }
    });
  } catch (err) {
    logDebugError('OpenBiqFatal', err);
    try {
      chrome.tabs.create({ url: '${window.location.origin}' });
    } catch (e) {
      window.open('${window.location.origin}', '_blank');
    }
  }
});

// Handle Open Battrick.org
openBtBtn.addEventListener('click', () => {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      window.open('https://www.battrick.org', '_blank');
      return;
    }
    chrome.tabs.create({ url: 'https://www.battrick.org' });
  } catch (err) {
    logDebugError('OpenBtFatal', err);
    window.open('https://www.battrick.org', '_blank');
  }
});`;
      zip.file("popup.js", popupJs);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "battrickiq-sync-helper.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      addSyncLog('club', 'Downloaded BattrickIQ Chrome Extension ZIP file', 'success');
    } catch (error) {
      console.error("Failed to generate ZIP file:", error);
    }
  };

  const hasFinData = finances && (finances.cash > 0 || finances.members > 0 || finances.prOfficers > 0 || finances.finAdvisors > 0);

  function handleImport(content: string, detectedType?: string) {
    if (!content.trim()) return;
    
    const result = parseBattrickPage(content, detectedType);
    
    const isValidType = result.type && result.type !== 'unknown';
    if (!isValidType) {
      setImportMessage({ text: 'Format not recognized. Please ensure you have copied the raw text or HTML of your Battrick squad, nets, finances, fixtures, or pavilion page.', success: false });
      addSyncLog('unknown', `Import failed: copied page data format not recognized`, 'failed');
      setPasteInput('');
      setTimeout(() => setImportMessage(null), 8000);
      return;
    }

    const isDemo = localStorage.getItem('bt_is_demo') === 'true';

    // Validate that the parsed result actually contains data before wiping or updating anything
    let isDataValid = false;
    let failReason = '';

    if (result.type === 'squad') {
      if (result.players && result.players.length > 0) {
        isDataValid = true;
      } else {
        failReason = 'No players could be parsed from the squad page content. Please ensure you have copied the full page content.';
      }
    } else if (result.type === 'nets') {
      if (result.players && result.players.length > 0) {
        // Need real squad first. Check if squad is currently empty or still in demo mode.
        const hasSquad = squad && squad.length > 0 && !isDemo;
        if (!hasSquad) {
          setImportMessage({ text: 'Please sync your main Squad first before importing Nets data.', success: false });
          addSyncLog('nets', 'Import skipped: squad must be imported before nets practice training schedules', 'failed');
          setPasteInput('');
          setTimeout(() => setImportMessage(null), 8000);
          return;
        }
        isDataValid = true;
      } else {
        failReason = 'No training nets or practice allocations could be parsed from the nets page content.';
      }
    } else if (result.type === 'finances' || result.type === 'club') {
      if (result.finances && Object.keys(result.finances).length > 0) {
        isDataValid = true;
      } else {
        failReason = 'No financial figures or club staff data could be parsed from the page content.';
      }
    } else if (result.type === 'fixtures') {
      if (result.fixtures && result.fixtures.length > 0) {
        isDataValid = true;
      } else {
        failReason = 'No match fixtures or upcoming games could be parsed from the fixtures page content.';
      }
    } else if (result.type === 'pavilion') {
      if (result.pavilion && Object.keys(result.pavilion).length > 0) {
        isDataValid = true;
      } else {
        failReason = 'No pavilion details or club information could be parsed from the page content.';
      }
    } else if (result.type === 'ground') {
      if (result.stadium && Object.keys(result.stadium).length > 0) {
        isDataValid = true;
      } else {
        failReason = 'No stadium seating details or pitch specifications could be parsed from the page content.';
      }
    }

    if (!isDataValid) {
      setImportMessage({ text: failReason || 'Format not recognized or no data could be extracted. Please ensure you have copied the full page content.', success: false });
      addSyncLog(result.type || 'unknown', `Import failed: ${failReason || 'unrecognized or empty data content'}`, 'failed');
      setPasteInput('');
      setTimeout(() => setImportMessage(null), 8000);
      return;
    }

    const hasEverSyncedLocal = localStorage.getItem('bt_has_ever_synced') === 'true';
    const shouldWipe = isDemo;

    if (shouldWipe) {
      // Complete clean wipe of local data before applying the new synced data
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
      setSyncLogs([]);
      
      // Ensure is_demo flag is set to false
      localStorage.setItem('bt_is_demo', 'false');
    }

    // Mark as having synced real data
    localStorage.setItem('bt_has_ever_synced', 'true');
    setHasEverSynced(true);

    const activeSquad = shouldWipe ? [] : squad;
    const activeFinances = shouldWipe ? {
      cash: 0, members: 0, prOfficers: 0, finAdvisors: 0, sponsorsIncome: 0, gateReceipts: 0, interestReceived: 0, playerWages: 0, staffWages: 0, morale: 'respectable' as const, sponsorsMood: 'respectable' as const, membersConfidence: 'respectable', academyCondition: 'feeble', academyInvestment: 0, academyIts: 0, bowlingCoaches: 0, battingCoaches: 0, fieldingCoaches: 0, keepingCoaches: 0, staminaCoaches: 0, psychologists: 0
    } : finances;
    const activeFixtures = shouldWipe ? [] : fixtures;
    const activePavilion = shouldWipe ? null : pavilion;

    if (result.type === 'squad' && result.players) {
      // For squad sync, if we wiped, we do not merge with existing
      const merged = result.players.map((newP) => {
        if (!shouldWipe) {
          const existing = activeSquad.find(oldP => isNameMatch(oldP.name, newP.name));
          if (existing) {
            return mergePlayerAndTrackHistory(existing, newP);
          }
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
        message: `We've successfully processed and synchronized ${result.count} players from your Battrick squad page. All player skill parameters, ratings, ages, and weekly wages have been updated.`,
        stats: [
          { label: 'Players Imported', value: result.count },
          { label: 'Average BTR Rating', value: `${avgBtr.toLocaleString()} BTR` },
          { label: 'Weekly Wage Bill', value: `£${weeklyWages.toLocaleString()}` }
        ]
      });
    } 
    else if (result.type === 'nets' && result.players) {
      const currentSquad = activeSquad;
      if (currentSquad.length === 0) {
        setImportMessage({ text: 'Please sync your main Squad first before importing Nets data.', success: false });
        addSyncLog('nets', 'Import skipped: squad must be imported before nets practice training schedules', 'failed');
        setPasteInput('');
        setTimeout(() => setImportMessage(null), 8000);
        return;
      }
      let updatedCount = 0;
      const merged = currentSquad.map(p => {
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
        message: `Training schedules extracted successfully! We have mapped individual batting, bowling, keeping, stamina, and fielding net slots to your squad.`,
        stats: [
          { label: 'Players Configured', value: updatedCount },
          { label: 'Total Active Nets', value: totalNets }
        ]
      });
    } 
    else if ((result.type === 'finances' || result.type === 'club') && result.finances) {
      const updatedFin = { ...activeFinances, ...result.finances } as ClubFinances;
      setFinances(updatedFin);
      saveToLocalStorage(activeSquad, updatedFin, activeFixtures.length > 0 ? activeFixtures : undefined, activePavilion || undefined);
      setImportMessage({ text: result.type === 'club' ? 'Successfully parsed and synced club staff, members, & morale levels!' : `Successfully parsed and synced club finances & staff ratios!`, success: true });
      addSyncLog(result.type, result.type === 'club' ? 'Synchronized club staff levels & morale' : `Synchronized weekly finances & staff ratios`, 'success');
      
      const isClub = result.type === 'club';
      const statsList = isClub ? [
        { label: 'Club Members', value: updatedFin.members ? updatedFin.members.toLocaleString() : 'N/A' },
        { label: 'PR Officers', value: updatedFin.prOfficers !== undefined ? updatedFin.prOfficers : 'N/A' },
        { label: 'Financial Advisors', value: updatedFin.finAdvisors !== undefined ? updatedFin.finAdvisors : 'N/A' },
        ...(updatedFin.battingCoaches !== undefined ? [{ label: 'Batting Coaches', value: updatedFin.battingCoaches }] : []),
        ...(updatedFin.bowlingCoaches !== undefined ? [{ label: 'Bowling Coaches', value: updatedFin.bowlingCoaches }] : []),
        ...(updatedFin.fieldingCoaches !== undefined ? [{ label: 'Fielding Coaches', value: updatedFin.fieldingCoaches }] : []),
        ...(updatedFin.keepingCoaches !== undefined ? [{ label: 'Wicket Keeping Coaches', value: updatedFin.keepingCoaches }] : []),
        ...(updatedFin.staminaCoaches !== undefined ? [{ label: 'Stamina Coaches', value: updatedFin.staminaCoaches }] : []),
        ...(updatedFin.psychologists !== undefined ? [{ label: 'Sports Psychologists', value: updatedFin.psychologists }] : []),
        { label: 'Team Morale', value: updatedFin.morale ? updatedFin.morale.charAt(0).toUpperCase() + updatedFin.morale.slice(1) : 'N/A' },
        ...(updatedFin.membersConfidence ? [{ label: 'Members Confidence', value: updatedFin.membersConfidence.charAt(0).toUpperCase() + updatedFin.membersConfidence.slice(1) }] : []),
        ...(updatedFin.academyCondition ? [{ label: 'Academy Condition', value: updatedFin.academyCondition.charAt(0).toUpperCase() + updatedFin.academyCondition.slice(1) }] : []),
        ...(updatedFin.academyIts !== undefined ? [{ label: 'Academy ITS Available', value: updatedFin.academyIts }] : []),
        ...(updatedFin.academyInvestment !== undefined && updatedFin.academyInvestment > 0 ? [{ label: 'Academy Weekly Investment', value: `£${updatedFin.academyInvestment.toLocaleString()}` }] : [])
      ] : [
        { label: 'Cash Reserves', value: `£${updatedFin.cash.toLocaleString()}` },
        { label: 'Club Members', value: updatedFin.members.toLocaleString() },
        { label: 'PR Officers', value: updatedFin.prOfficers },
        { label: 'Financial Advisors', value: updatedFin.finAdvisors }
      ];

      setSuccessModal({
        isOpen: true,
        type: isClub ? 'club' : 'finances',
        title: isClub ? 'Club & Staff Information Synced!' : 'Financial Ledger Updated!',
        message: isClub 
          ? `Your club's staff levels (including Public Relations Officers and Financial Advisors), member count, team morale, members' confidence, and youth academy condition have been successfully synchronized.`
          : `Your club's weekly finance ledger has been synced. Key metrics such as sponsors' mood, fan count, bank capital, and staff counts have been updated.`,
        stats: statsList
      });
    } 
    else if (result.type === 'fixtures' && result.fixtures) {
      setFixtures(result.fixtures);
      saveToLocalStorage(activeSquad, activeFinances, result.fixtures, activePavilion || undefined);
      setImportMessage({ text: `Successfully parsed and synced ${result.fixtures.length} club fixtures!`, success: true });
      addSyncLog('fixtures', `Synchronized ${result.fixtures.length} club fixtures`, 'success');
      
      const firstClassCount = result.fixtures.filter(f => f.type.toLowerCase().includes('first class')).length;
      const oneDayCount = result.fixtures.filter(f => f.type.toLowerCase().includes('one day') || f.type.toLowerCase().includes('cup')).length;
      const t20Count = result.fixtures.filter(f => f.type.toLowerCase().includes('twenty20') || f.type.toLowerCase().includes('t20')).length;
      setSuccessModal({
        isOpen: true,
        type: 'fixtures',
        title: 'Match Fixtures Synced!',
        message: `We've parsed and synchronized your upcoming match schedules, competition formats, and pitch ratings.`,
        stats: [
          { label: 'Fixtures Found', value: result.fixtures.length },
          { label: 'First Class Games', value: firstClassCount },
          { label: 'One Day / Cup Games', value: oneDayCount },
          { label: 'Twenty20 Games', value: t20Count }
        ]
      });
    }
    else if (result.type === 'pavilion' && result.pavilion) {
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
        message: `Club details, active weather, and ground name successfully loaded from your pavilion page!`,
        stats: [
          { label: 'Ground Name', value: mergedPavilion.groundName },
          { label: 'Active Weather', value: mergedPavilion.weather },
          { label: 'Established', value: mergedPavilion.established || 'Season 42' },
          { label: 'Membership Status', value: mergedPavilion.membershipStatus || 'Elite Manager' }
        ]
      });
    }
    else if (result.type === 'ground' && result.stadium) {
      const stadium = result.stadium || {
        capacity: 14000,
        terracing: 8000,
        grass: 4000,
        seats: 1800,
        boxes: 200,
        pitch: 'Flat'
      };
      localStorage.setItem('bt_stadium', JSON.stringify(stadium));
      
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

      saveToLocalStorage(
        activeSquad,
        activeFinances,
        activeFixtures.length > 0 ? activeFixtures : undefined,
        updatedPavilion || undefined
      );

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
          { label: 'Total Capacity', value: `${(stadium.capacity || 0).toLocaleString()} seats` },
          { label: 'Standing Room (Terracing)', value: (stadium.terracing || 0).toLocaleString() },
          { label: 'Uncovered Seats (Grass)', value: (stadium.grass || 0).toLocaleString() },
          { label: 'Covered Seats', value: (stadium.seats || 0).toLocaleString() },
          { label: 'Members Seats (Boxes)', value: (stadium.boxes || 0).toLocaleString() }
        ]
      });
    }

    setPasteInput('');
    setTimeout(() => setImportMessage(null), 8000);
  };

  const loadAllSamplesAtOnce = () => {
    const squadResult = parseBattrickPage(SAMPLE_SQUAD_HTML);
    const netsResult = parseBattrickPage(SAMPLE_NETS_HTML);
    const financesResult = parseBattrickPage(SAMPLE_FINANCES_HTML);
    const clubResult = parseBattrickPage(SAMPLE_CLUB_HTML);
    const fixturesResult = parseBattrickPage(SAMPLE_FIXTURES_HTML);
    const pavilionResult = parseBattrickPage(SAMPLE_PAVILION_HTML);

    let parsedSquad: BattrickPlayer[] = [];
    if (squadResult.type === 'squad' && squadResult.players) {
      parsedSquad = squadResult.players;
    }

    if (netsResult.type === 'nets' && netsResult.players && parsedSquad.length > 0) {
      parsedSquad = parsedSquad.map(p => {
        const netMatch = netsResult.players?.find(np => isNameMatch(p.name, np.name));
        if (netMatch) {
          return { ...p, nets: netMatch.nets };
        }
        return p;
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

    if (financesResult.finances) {
      parsedFinances = { ...parsedFinances, ...financesResult.finances };
    }
    if (clubResult.finances) {
      parsedFinances = { ...parsedFinances, ...clubResult.finances };
    }

    let parsedFixtures: BattrickGame[] = [];
    if (fixturesResult.type === 'fixtures' && fixturesResult.fixtures) {
      parsedFixtures = fixturesResult.fixtures;
    }

    let parsedPavilion: PavilionInfo | null = null;
    if (pavilionResult.type === 'pavilion' && pavilionResult.pavilion) {
      parsedPavilion = pavilionResult.pavilion as PavilionInfo;
    }

    // Set default mock stadium values too
    localStorage.setItem('bt_stadium', JSON.stringify({
      terracing: 8000,
      grass: 4000,
      seats: 1800,
      boxes: 200,
      capacity: 14000
    }));

    setSquad(parsedSquad);
    setFinances(parsedFinances);
    setFixtures(parsedFixtures);
    setPavilion(parsedPavilion);
    
    // Explicitly set bt_is_demo to true
    localStorage.setItem('bt_is_demo', 'true');
    
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
    localStorage.setItem('bt_wiping', 'true');
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
    setSyncLogs([]);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('bt_cloud_backup_request'));
    setImportMessage({ text: 'All local database records wiped clean.', success: true });
    setShowWipeConfirm(false);
    setWipeConfirmText('');
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

  // --- RENDERING OPTION 1: SQUAD ALREADY SYNCED ---
  return (
    <>
      {squad.length > 0 ? (
        <div className="flex flex-col gap-6 animate-fadeIn" id="synced-dashboard">
        
        {/* Elegant Roster Synced Status Banner */}
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

        {/* Dynamic Pavilion & Club Metadata Display */}
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
                {pavilion?.groundName || "BattrickIQ Lord's Arena"}
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

        {/* Club Performance At-A-Glance Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="metrics-dashboard">
          
          {/* Card 1: Roster Size */}
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between hover:border-slate-300 transition duration-150">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Squad Strength</span>
              <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">{squad.length} Players</span>
              <span className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeNetsCount} Assigned to Nets
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5.5 h-5.5" />
            </div>
          </div>

          {/* Card 2: Liquid Balance */}
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between hover:border-slate-300 transition duration-150">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Liquid Club Capital</span>
              <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">
                {finances.cash > 0 ? `£${finances.cash.toLocaleString()}` : "Sync finances"}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                {finances.members > 0 ? `${finances.members.toLocaleString()} Club Members` : "No financial ledger"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Coins className="w-5.5 h-5.5" />
            </div>
          </div>

          {/* Card 3: Average Squad Rating */}
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between hover:border-slate-300 transition duration-150">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Squad Rating Index</span>
              <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">{averageBtr.toLocaleString()} BTR</span>
              <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                Average Age: {averageAge} Years
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Trophy className="w-5.5 h-5.5" />
            </div>
          </div>

          {/* Card 4: Weekly Wages */}
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-xl shadow-sm flex items-center justify-between hover:border-slate-300 transition duration-150">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Weekly Player Wages</span>
              <span className="text-xl font-display font-black text-slate-800 tracking-tight mt-1">£{totalWages.toLocaleString()}</span>
              <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                Staff Wages: £{(finances.staffWages || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Calculator className="w-5.5 h-5.5" />
            </div>
          </div>

        </div>

        {/* Detailed Status Panels: Fixtures & Finances */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Upcoming Fixtures (Column 7) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-blue-600" />
                Synced Match Fixtures ({fixtures.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 font-mono font-bold text-slate-400 text-[10px] uppercase">
                     <th className="pb-2">Date</th>
                     <th className="pb-2">Opponent</th>
                     <th className="pb-2">Type</th>
                     <th className="pb-2">Venue</th>
                     <th className="pb-2 text-right">Result/Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fixtures.length > 0 ? (
                    fixtures.slice(0, 6).map((game, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="py-2.5 font-semibold font-mono text-slate-700">{game.date}</td>
                        <td className="py-2.5 font-bold text-slate-800 truncate max-w-[140px]">{game.opponent}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            game.type.includes('First Class') ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                            game.type.includes('Twenty20') ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                            'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                            {game.type}
                          </span>
                        </td>
                        <td className="py-2.5 font-semibold">{game.venue}</td>
                        <td className={`py-2.5 text-right font-bold ${
                          game.result?.toLowerCase().includes('won') ? 'text-emerald-600' :
                          game.result?.toLowerCase().includes('lost') ? 'text-rose-600' :
                          'text-slate-500'
                        }`}>
                          {game.result}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 font-semibold">
                        No fixtures synced yet. Go to sync tools to import fixtures.asp
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Financial Ledger & Backroom Staff (Column 5) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-4">
                <Coins className="w-4.5 h-4.5 text-emerald-600" />
                Weekly Financial Ledger
              </h3>

              <div className="flex flex-col gap-3 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-medium">Sponsor Income:</span>
                  <span className="font-extrabold text-emerald-600">+£{(finances.sponsorsIncome || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-medium">Gate Receipts:</span>
                  <span className="font-extrabold text-emerald-600">+£{(finances.gateReceipts || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-medium">Interest Received:</span>
                  <span className="font-extrabold text-emerald-600">+£{(finances.interestReceived || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-medium text-rose-600 font-semibold">Player Salary Budget:</span>
                  <span className="font-extrabold text-rose-600">-£{totalWages.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-medium text-rose-600 font-semibold">Coaching Staff Salaries:</span>
                  <span className="font-extrabold text-rose-600">-£{(finances.staffWages || 0).toLocaleString()}</span>
                </div>

                {/* Net Balance Calculator */}
                <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Net Weekly Balance</span>
                    <span className="text-xs text-slate-400 font-medium">Income vs Outgoings</span>
                  </div>
                  <span className={`text-base font-black ${
                    (finances.sponsorsIncome + finances.gateReceipts + finances.interestReceived - totalWages - finances.staffWages) >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {((finances.sponsorsIncome + finances.gateReceipts + finances.interestReceived - totalWages - finances.staffWages) >= 0 ? '+' : '')}
                    £{(finances.sponsorsIncome + finances.gateReceipts + finances.interestReceived - totalWages - finances.staffWages).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Backroom Staff Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-4">
                <Users className="w-4.5 h-4.5 text-indigo-600" />
                Club Backroom Staff & Coaches
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60">
                  <span className="font-medium">PR Officers:</span>
                  <span className="font-bold text-slate-800">{finances.prOfficers || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60">
                  <span className="font-medium">Financial Advisors:</span>
                  <span className="font-bold text-slate-800">{finances.finAdvisors || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60">
                  <span className="font-medium">Batting Coaches:</span>
                  <span className="font-bold text-slate-800">{finances.battingCoaches || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60">
                  <span className="font-medium">Bowling Coaches:</span>
                  <span className="font-bold text-slate-800">{finances.bowlingCoaches || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60">
                  <span className="font-medium">Fielding Coaches:</span>
                  <span className="font-bold text-slate-800">{finances.fieldingCoaches || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60">
                  <span className="font-medium">Keeping Coaches:</span>
                  <span className="font-bold text-slate-800">{finances.keepingCoaches || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60 sm:col-span-2">
                  <span className="font-medium">Stamina Coaches:</span>
                  <span className="font-bold text-slate-800">{finances.staminaCoaches || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100/60 sm:col-span-2">
                  <span className="font-medium">Sports Psychologists:</span>
                  <span className="font-bold text-slate-800">{finances.psychologists || 0}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Collapsible/Toggleable Sync Input Boxes */}
        {showSyncControls && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slideUp">
            
            {/* Sync Controls Left Side */}
            <div className="lg:col-span-7 flex flex-col gap-6">
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
                    onClick={() => setImportTab('bookmarklet')}
                    className={`flex-1 min-w-[120px] py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                      importTab === 'bookmarklet'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                    Bookmarklet Sync (Recommended)
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
                  <button
                    type="button"
                    onClick={() => setImportTab('extension')}
                    className={`flex-1 min-w-[120px] py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                      importTab === 'extension'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Chrome Extension
                  </button>
                </div>

                {(importTab === 'paste' || importTab === 'upload') && (
                  <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-indigo-600" />
                        Target Page Template
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight font-sans">
                        Help the parser map templates precisely, or use smart auto-detection.
                      </span>
                    </div>
                    <select
                      value={selectedMapping}
                      onChange={(e) => setSelectedMapping(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm min-w-[200px]"
                    >
                      <option value="auto">🔍 Auto-Detect (Default)</option>
                      <option value="squad">👥 Squad Roster (squad.asp)</option>
                      <option value="nets">🎯 Practice Nets (nets.asp)</option>
                      <option value="finances">💰 Weekly Finances (finances.asp)</option>
                      <option value="club">🏛️ Club & Staff Info (club.asp)</option>
                      <option value="fixtures">📅 Match Fixtures (fixtures.asp)</option>
                      <option value="pavilion">🏟️ Pavilion details (office.asp)</option>
                      <option value="ground">🏗️ Ground & Stadium (ground.asp)</option>
                    </select>
                  </div>
                )}

                <div>
                  {importTab === 'bookmarklet' && (
                    <div className="flex flex-col gap-4 animate-fadeIn text-xs">
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-indigo-950 font-sans text-sm flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                            ⚡ Bookmarklet Syncing (Highly Recommended)
                          </h4>
                          <p className="text-indigo-700 mt-1 leading-normal font-sans text-[11px]">
                            A 100% reliable, zero-install synchronization method that bypasses Cloudflare checks completely by running directly in your logged-in browser session!
                          </p>
                        </div>
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">YOUR SYNC CODE</span>
                          <span className="font-mono text-xl font-black text-indigo-900 tracking-wider bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 mt-1 shadow-sm">
                            {syncCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                              let code = '';
                              for (let i = 0; i < 6; i++) {
                                code += chars.charAt(Math.floor(Math.random() * chars.length));
                              }
                              localStorage.setItem('bt_sync_code', code);
                              setSyncCode(code);
                            }}
                            className="text-[10px] text-indigo-600 hover:underline mt-1 font-sans"
                          >
                            Regenerate Code
                          </button>
                        </div>
                      </div>

                      {/* Guide Selector Tabs for Desktop/iPad */}
                      <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-fit mb-2">
                        <button
                          type="button"
                          onClick={() => setSelectedGuide('desktop')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                            selectedGuide === 'desktop'
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          🖥️ Desktop / Laptop Setup
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedGuide('ipad')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                            selectedGuide === 'ipad'
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          📱 iPad & Mobile Setup
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                        {selectedGuide === 'desktop' ? (
                          <div>
                            <h5 className="font-bold text-slate-800 mb-1 font-sans">Step 1: Save the Bookmarklet</h5>
                            <p className="text-slate-500 mb-2.5 leading-relaxed">
                              Drag the purple button below to your browser's <strong className="text-slate-700">Bookmarks Bar</strong>.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
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
                                onClick={handleCopyBookmarklet}
                                className={`font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer font-sans ${
                                  copiedCode 
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {copiedCode ? '✅ Bookmarklet Copied!' : 'Copy Bookmarklet Code'}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5 leading-tight font-sans">
                              *Can't drag-and-drop?* Click "Copy Bookmarklet Code" to copy the raw link address directly.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <h5 className="font-bold text-indigo-950 mb-1 font-sans flex items-center gap-1.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono font-bold">1</span>
                                Copy the Bookmarklet Code
                              </h5>
                              <p className="text-slate-500 mb-2.5 leading-relaxed">
                                Tap the button below to copy the iPad-compatible script address to your clipboard:
                              </p>
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={handleCopyBookmarklet}
                                    className={`font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition flex items-center gap-2 cursor-pointer font-sans ${
                                      copiedCode 
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                                  >
                                    <Sparkles className="w-4 h-4 fill-white/10" />
                                    {copiedCode ? '✅ Copied to Clipboard!' : 'Copy iPad Bookmarklet Code'}
                                  </button>
                                </div>
                                
                                <div className="mt-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase font-mono">
                                    Manual Bookmarklet URL Code (iPad Manual Backup)
                                  </label>
                                  <input
                                    type="text"
                                    readOnly
                                    value={getBookmarkletCode()}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                    className="w-full bg-white border border-slate-200 text-[10px] font-mono px-3 py-1.5 rounded text-slate-500 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                              <h5 className="font-bold text-indigo-950 mb-1 font-sans flex items-center gap-1.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono font-bold">2</span>
                                Create a Bookmark in your iPad Browser
                              </h5>
                              <p className="text-slate-500 text-[11px] leading-relaxed">
                                Create a bookmark for <strong className="text-slate-700">this BattrickIQ page</strong> by tapping Safari's <strong className="text-slate-700">Share</strong> icon (or Chrome's <strong className="text-slate-700">... Menu</strong>) and selecting <strong className="text-indigo-600">Add Bookmark</strong>. Name it <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong>.
                              </p>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                              <h5 className="font-bold text-indigo-950 mb-1 font-sans flex items-center gap-1.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono font-bold">3</span>
                                Paste the Code as the Bookmark URL
                              </h5>
                              <p className="text-slate-500 text-[11px] leading-relaxed">
                                Open your Bookmarks menu, tap <strong className="text-slate-700">Edit</strong>, select the <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong> bookmark, delete the web address completely, and <strong className="text-indigo-600">Paste</strong> the code you copied in Step 1. Tap <strong className="text-slate-700">Done</strong>!
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-slate-150 pt-3">
                          <h5 className="font-bold text-slate-800 mb-1 font-sans">Step {selectedGuide === 'ipad' ? '4' : '2'}: Sync in One Click!</h5>
                          <ol className="list-decimal list-inside space-y-1.5 text-slate-500 font-sans text-[11px] mt-1.5">
                            <li>Open <a href="https://www.battrick.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold">Battrick.org</a> in a separate tab on your iPad and log in.</li>
                            <li>Go to any of your club pages (e.g. <strong className="text-slate-700">Squad</strong>, <strong className="text-slate-700">Nets</strong>, <strong className="text-slate-700">Finances</strong>, <strong className="text-slate-700">Fixtures</strong>, or <strong className="text-slate-700">Ground</strong>).</li>
                            <li>Open your browser's Bookmarks/Favorites menu, and tap your <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong> bookmark.</li>
                            <li>A success notification will flash on Battrick, and this dashboard will update automatically in real-time!</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}

                  {importTab === 'upload' && (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Drag & drop your downloaded Battrick `.html` or `.txt` pages (squad.asp, nets.asp, etc.) below to parse and sync.
                      </p>

                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('sync-file-input')?.click()}
                        className={`w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 ${
                          dragActive
                            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          id="sync-file-input"
                          type="file"
                          accept=".html,.htm,.txt"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <Upload
                          className={`w-10 h-10 mb-2.5 transition ${
                            dragActive ? 'text-indigo-600 animate-bounce' : 'text-slate-400'
                          }`}
                        />
                        <span className="text-xs font-bold text-slate-700">
                          {dragActive ? 'Drop file here!' : 'Drag & drop file here'}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1">
                          or click to browse your files
                        </span>
                      </div>

                      {selectedFileName && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] py-2 px-3 rounded-lg flex items-center justify-between">
                          <span className="font-mono flex items-center gap-1.5 truncate">
                            <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {selectedFileName}
                          </span>
                          <span className="font-bold flex items-center gap-1 text-emerald-700 text-[10px] shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            Parsed
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {importTab === 'paste' && (
                    <div>
                      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                        Paste the raw text (Ctrl+A / Ctrl+C) or HTML page source code from your Battrick club webpages to immediately parse and synchronize records.
                      </p>

                      <textarea
                        id="sync-textarea-pasted"
                        rows={5}
                        value={pasteInput}
                        onChange={(e) => setPasteInput(e.target.value)}
                        placeholder="Paste raw Battrick webpage contents here (from squad.asp, nets.asp, finances.asp, club.asp, fixtures.asp, office.asp, or ground.asp)..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 mb-3 shadow-inner"
                      />

                      <button
                        id="btn-import-submit"
                        type="button"
                        onClick={() => handleImport(pasteInput, selectedMapping === 'auto' ? undefined : selectedMapping)}
                        disabled={!pasteInput.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg text-xs font-bold shadow-sm transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Analyze & Sync Content
                      </button>
                    </div>
                  )}

                  {importTab === 'extension' && (
                    <div className="flex flex-col gap-4 animate-fadeIn">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-150">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-5 h-5 text-indigo-600 animate-pulse" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 font-sans">Sync Connection Status</h4>
                            <p className="text-[10px] text-slate-400 font-sans">Keeps track of local extension communication</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                          isExtensionConnected 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            isExtensionConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          }`} />
                          {isExtensionConnected ? 'Extension Active & Connected' : 'Awaiting Extension Connection...'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 leading-relaxed space-y-3">
                        <p className="text-slate-500">
                          Use our custom Chrome extension to synchronize your club statistics in one single click directly from the live Battrick.org interface, bypassing manual pasting.
                        </p>

                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-start gap-2.5">
                            <Download className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-bold text-xs text-indigo-950 font-sans">Download Sync Helper Extension</h5>
                              <p className="text-[11px] text-indigo-700 mt-0.5 leading-tight font-sans">
                                Bundles full installation script, manifest & assets into a single ZIP.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleDownloadExtension}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition shrink-0 flex items-center gap-1.5 cursor-pointer font-sans"
                          >
                            <Download className="w-4 h-4" />
                            Get Extension ZIP
                          </button>
                        </div>

                        <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/30">
                          <h5 className="font-bold text-xs text-slate-800 mb-2.5 font-sans">🔧 Quick Installation Guide</h5>
                          <ol className="space-y-2 text-[11px] text-slate-500 list-decimal pl-4 font-sans">
                            <li>Click the button above to download <strong className="text-slate-800">battrickiq-sync-helper.zip</strong>.</li>
                            <li>Extract the ZIP file content onto an easily accessible folder on your local drive.</li>
                            <li>Open Google Chrome and navigate to <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono font-bold">chrome://extensions/</code>.</li>
                            <li>Enable the <strong className="text-slate-800">Developer mode</strong> toggle switch at the top-right corner of the page.</li>
                            <li>Click the <strong className="text-slate-800">Load unpacked</strong> button on the top-left and select the folder containing extracted files.</li>
                            <li>Visit <strong className="text-slate-800">Battrick.org</strong>! A purple <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong> button will float in your game screen to instantly sync any page directly into this workspace!</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>

            {/* Sync Controls Right Side */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h4 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2 mb-3">
                  <BookOpen className="w-4.5 h-4.5 text-indigo-600" />
                  Battrick Source Reference URLs
                </h4>
                <div className="flex flex-col gap-3 text-xs text-slate-600 leading-relaxed">
                  <div className="border-l-2 border-indigo-200 pl-3 py-0.5">
                    <strong className="text-slate-800 block">1. My Squad (squad.asp)</strong>
                    <span>Go to <strong className="text-indigo-950 font-mono text-[11px]">Club -&gt; Squad</strong>. Copy all text and paste to update player skills and ages.</span>
                  </div>
                  <div className="border-l-2 border-indigo-200 pl-3 py-0.5">
                    <strong className="text-slate-800 block">2. Training Nets (nets.asp)</strong>
                    <span>Go to <strong className="text-indigo-950 font-mono text-[11px]">Club -&gt; Nets</strong>. Copy and paste to update player net counts.</span>
                  </div>
                  <div className="border-l-2 border-indigo-200 pl-3 py-0.5">
                    <strong className="text-slate-800 block">3. Fixtures (fixtures.asp)</strong>
                    <span>Go to <strong className="text-indigo-950 font-mono text-[11px]">Matches -&gt; Fixtures</strong>. Copy and paste to synchronize games list.</span>
                  </div>
                  <div className="border-l-2 border-indigo-200 pl-3 py-0.5">
                    <strong className="text-slate-800 block">4. Pavilion (office.asp)</strong>
                    <span>Go to <strong className="text-indigo-950 font-mono text-[11px]">Club -&gt; Pavilion</strong>. Copy and paste to update pitch and weather attributes.</span>
                  </div>
                  <div className="border-l-2 border-indigo-200 pl-3 py-0.5">
                    <strong className="text-slate-800 block">5. Stadium & Ground (ground.asp)</strong>
                    <span>Go to <strong className="text-indigo-950 font-mono text-[11px]">Club -&gt; Ground</strong>. Copy and paste to update seating capacities and your arena name.</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" id="sync-hub-empty">
      
      {/* Centered Premium Onboarding Welcome Panel */}
      <div className="lg:col-span-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 bg-blueprint-dots opacity-20 pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10.5px] font-bold font-mono tracking-wider uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Strategic Cricket Intelligence
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-slate-900 leading-tight">
              Model, Predict & Maximize Your Squad Strategy
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2.5 leading-relaxed max-w-2xl">
              Welcome to <strong>BattrickIQ</strong>! We process and forecast cricket parameters with professional accuracy. To begin, paste your club records securely.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded bg-indigo-50 text-indigo-600 mt-0.5 shrink-0 text-xs font-mono font-bold font-sans">01</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-sans">Paste Roster</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-sans">Copy page text and paste here</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded bg-indigo-50 text-indigo-600 mt-0.5 shrink-0 text-xs font-mono font-bold font-sans">02</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-sans">Analyze Skills</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-sans">Predict skill pops & season wages</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded bg-indigo-50 text-indigo-600 mt-0.5 shrink-0 text-xs font-mono font-bold font-sans">03</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-sans">Optimize Lineups</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-sans">Forecast team matchday ratings</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative shrink-0 flex flex-col items-center gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-inner flex flex-col items-center gap-1 text-center min-w-[200px]">
              <ShieldCheck className="w-8 h-8 text-indigo-600 mb-1" />
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Storage State</span>
              <span className="text-xs font-bold text-slate-800">Local Cache Active</span>
            </div>
            
            {!hasEverSynced ? (
              <button
                type="button"
                onClick={loadAllSamplesAtOnce}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer w-full font-sans"
              >
                <Sparkles className="w-4 h-4" />
                Explore with Demo Club
              </button>
            ) : (
              <div className="text-center p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-[11px] font-medium leading-relaxed max-w-[200px] font-sans">
                💡 Paste or upload your active Battrick page content below to populate your squad.
              </div>
            )}
          </div>
        </div>
      </div>

      {importMessage && (
        <div className="lg:col-span-12">
          <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 border animate-scaleUp ${
            importMessage.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <AlertCircle className="w-4.5 h-4.5 text-slate-600 shrink-0 mt-0.5" />
            <span>{importMessage.text}</span>
          </div>
        </div>
      )}

      {/* Entry Path: Multi-Method Connection Console */}
      <div className="lg:col-span-12 flex flex-col gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="font-display font-bold text-base text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Import Battrick Source Data
              </h3>
            </div>

            {/* Import Tabs */}
            <div className="flex border-b border-slate-150 mb-4 flex-wrap">
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
                Bookmarklet Sync (Recommended)
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
              <button
                type="button"
                onClick={() => setImportTab('extension')}
                className={`flex-1 min-w-[120px] py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                  importTab === 'extension'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Chrome Extension
              </button>
            </div>

            {(importTab === 'paste' || importTab === 'upload') && (
              <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-indigo-600" />
                    Target Page Template
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 leading-tight font-sans">
                    Help the parser map templates precisely, or use smart auto-detection.
                  </span>
                </div>
                <select
                  value={selectedMapping}
                  onChange={(e) => setSelectedMapping(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm min-w-[200px]"
                >
                  <option value="auto">🔍 Auto-Detect (Default)</option>
                  <option value="squad">👥 Squad Roster (squad.asp)</option>
                  <option value="nets">🎯 Practice Nets (nets.asp)</option>
                  <option value="finances">💰 Weekly Finances (finances.asp)</option>
                  <option value="club">🏛️ Club & Staff Info (club.asp)</option>
                  <option value="fixtures">📅 Match Fixtures (fixtures.asp)</option>
                  <option value="pavilion">🏟️ Pavilion details (office.asp)</option>
                  <option value="ground">🏗️ Ground & Stadium (ground.asp)</option>
                </select>
              </div>
            )}

            <div>
              {importTab === 'bookmarklet' && (
                <div className="flex flex-col gap-4 animate-fadeIn text-xs">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-indigo-950 font-sans text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                        ⚡ Bookmarklet Syncing (Highly Recommended)
                      </h4>
                      <p className="text-indigo-700 mt-1 leading-normal font-sans text-[11px]">
                        A 100% reliable, zero-install synchronization method that bypasses Cloudflare checks completely by running directly in your logged-in browser session!
                      </p>
                    </div>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">YOUR SYNC CODE</span>
                      <span className="font-mono text-xl font-black text-indigo-900 tracking-wider bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 mt-1 shadow-sm">
                        {syncCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                          let code = '';
                          for (let i = 0; i < 6; i++) {
                            code += chars.charAt(Math.floor(Math.random() * chars.length));
                          }
                          localStorage.setItem('bt_sync_code', code);
                          setSyncCode(code);
                        }}
                        className="text-[10px] text-indigo-600 hover:underline mt-1 font-sans"
                      >
                        Regenerate Code
                      </button>
                    </div>
                  </div>

                      {/* Guide Selector Tabs for Desktop/iPad */}
                      <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-fit mb-2">
                        <button
                          type="button"
                          onClick={() => setSelectedGuide('desktop')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                            selectedGuide === 'desktop'
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          🖥️ Desktop / Laptop Setup
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedGuide('ipad')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                            selectedGuide === 'ipad'
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          📱 iPad & Mobile Setup
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                        {selectedGuide === 'desktop' ? (
                          <div>
                            <h5 className="font-bold text-slate-800 mb-1 font-sans">Step 1: Save the Bookmarklet</h5>
                            <p className="text-slate-500 mb-2.5 leading-relaxed">
                              Drag the purple button below to your browser's <strong className="text-slate-700">Bookmarks Bar</strong>.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
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
                                onClick={handleCopyBookmarklet}
                                className={`font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer font-sans ${
                                  copiedCode 
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {copiedCode ? '✅ Bookmarklet Copied!' : 'Copy Bookmarklet Code'}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5 leading-tight font-sans">
                              *Can't drag-and-drop?* Click "Copy Bookmarklet Code" to copy the raw link address directly.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <h5 className="font-bold text-indigo-950 mb-1 font-sans flex items-center gap-1.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono font-bold">1</span>
                                Copy the Bookmarklet Code
                              </h5>
                              <p className="text-slate-500 mb-2.5 leading-relaxed">
                                Tap the button below to copy the iPad-compatible script address to your clipboard:
                              </p>
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={handleCopyBookmarklet}
                                    className={`font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition flex items-center gap-2 cursor-pointer font-sans ${
                                      copiedCode 
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                                  >
                                    <Sparkles className="w-4 h-4 fill-white/10" />
                                    {copiedCode ? '✅ Copied to Clipboard!' : 'Copy iPad Bookmarklet Code'}
                                  </button>
                                </div>
                                
                                <div className="mt-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase font-mono">
                                    Manual Bookmarklet URL Code (iPad Manual Backup)
                                  </label>
                                  <input
                                    type="text"
                                    readOnly
                                    value={getBookmarkletCode()}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                    className="w-full bg-white border border-slate-200 text-[10px] font-mono px-3 py-1.5 rounded text-slate-500 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                              <h5 className="font-bold text-indigo-950 mb-1 font-sans flex items-center gap-1.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono font-bold">2</span>
                                Create a Bookmark in your iPad Browser
                              </h5>
                              <p className="text-slate-500 text-[11px] leading-relaxed">
                                Create a bookmark for <strong className="text-slate-700">this BattrickIQ page</strong> by tapping Safari's <strong className="text-slate-700">Share</strong> icon (or Chrome's <strong className="text-slate-700">... Menu</strong>) and selecting <strong className="text-indigo-600">Add Bookmark</strong>. Name it <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong>.
                              </p>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                              <h5 className="font-bold text-indigo-950 mb-1 font-sans flex items-center gap-1.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono font-bold">3</span>
                                Paste the Code as the Bookmark URL
                              </h5>
                              <p className="text-slate-500 text-[11px] leading-relaxed">
                                Open your Bookmarks menu, tap <strong className="text-slate-700">Edit</strong>, select the <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong> bookmark, delete the web address completely, and <strong className="text-indigo-600">Paste</strong> the code you copied in Step 1. Tap <strong className="text-slate-700">Done</strong>!
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-slate-150 pt-3">
                          <h5 className="font-bold text-slate-800 mb-1 font-sans">Step {selectedGuide === 'ipad' ? '4' : '2'}: Sync in One Click!</h5>
                          <ol className="list-decimal list-inside space-y-1.5 text-slate-500 font-sans text-[11px] mt-1.5">
                            <li>Open <a href="https://www.battrick.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold">Battrick.org</a> in a separate tab on your iPad and log in.</li>
                            <li>Go to any of your club pages (e.g. <strong className="text-slate-700">Squad</strong>, <strong className="text-slate-700">Nets</strong>, <strong className="text-slate-700">Finances</strong>, <strong className="text-slate-700">Fixtures</strong>, or <strong className="text-slate-700">Ground</strong>).</li>
                            <li>Open your browser's Bookmarks/Favorites menu, and tap your <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong> bookmark.</li>
                            <li>A success notification will flash on Battrick, and this dashboard will update automatically in real-time!</li>
                          </ol>
                        </div>
                      </div>
                </div>
              )}

              {importTab === 'upload' && (
                <div className="flex flex-col gap-3 animate-fadeIn">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Drag & drop your downloaded Battrick `.html` or `.txt` pages (squad.asp, nets.asp, etc.) below to parse and sync.
                  </p>

                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('sync-file-input-empty')?.click()}
                    className={`w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 ${
                      dragActive
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <input
                      id="sync-file-input-empty"
                      type="file"
                      accept=".html,.htm,.txt"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Upload
                      className={`w-10 h-10 mb-2.5 transition ${
                        dragActive ? 'text-indigo-600 animate-bounce' : 'text-slate-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-700">
                      {dragActive ? 'Drop file here!' : 'Drag & drop file here'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      or click to browse your files
                    </span>
                  </div>

                  {selectedFileName && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] py-2 px-3 rounded-lg flex items-center justify-between">
                      <span className="font-mono flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {selectedFileName}
                      </span>
                      <span className="font-bold flex items-center gap-1 text-emerald-700 text-[10px] shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        Parsed
                      </span>
                    </div>
                  )}
                </div>
              )}

              {importTab === 'paste' && (
                <div className="flex flex-col gap-3 animate-fadeIn">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Paste the raw text (Ctrl+A / Ctrl+C) or HTML page source code from your Battrick club webpages to immediately parse and synchronize records.
                  </p>

                  <textarea
                    id="sync-textarea-pasted-empty"
                    rows={4}
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder="Paste raw Battrick webpage contents here (from squad.asp, nets.asp, finances.asp, club.asp, fixtures.asp, office.asp, or ground.asp)..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner mb-2"
                  />

                  <button
                    id="btn-import-submit-empty"
                    type="button"
                    onClick={() => handleImport(pasteInput, selectedMapping === 'auto' ? undefined : selectedMapping)}
                    disabled={!pasteInput.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Analyze & Parse Content
                  </button>
                </div>
              )}

              {importTab === 'extension' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-600 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 font-sans">Sync Connection Status</h4>
                        <p className="text-[10px] text-slate-400 font-sans">Keeps track of local extension communication</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                      isExtensionConnected 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        isExtensionConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`} />
                      {isExtensionConnected ? 'Extension Active & Connected' : 'Awaiting Extension Connection...'}
                    </span>
                  </div>

                  {isExtensionConnected && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
                      <div>
                        <h5 className="font-bold text-xs text-emerald-950 font-sans flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse animate-spin-slow" />
                          One-Click Full Club Auto-Sync
                        </h5>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-normal font-sans">
                          Automatically opens required Battrick.org pages in the background, parses the latest data, and immediately closes each tab safely to guarantee 100% accurate synchronization without manual copy-pasting.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          window.postMessage({ type: "TRIGGER_AUTO_SYNC_PAGES" }, "*");
                          setImportMessage({
                            text: "⚡ Automated sync triggered! Opening background tabs, importing fresh club rosters, and auto-closing each page safely...",
                            success: true
                          });
                          setTimeout(() => setImportMessage(null), 8000);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4.5 py-2.5 rounded-lg shadow-sm transition shrink-0 flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Run Auto-Sync (Open/Close Tabs)
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-slate-600 leading-relaxed space-y-3">
                    <p className="text-slate-500">
                      Use our custom Chrome extension to synchronize your club statistics in one single click directly from the live Battrick.org interface, bypassing manual pasting.
                    </p>

                    <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <Download className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-bold text-xs text-indigo-950 font-sans">Download Sync Helper Extension</h5>
                          <p className="text-[11px] text-indigo-700 mt-0.5 leading-tight font-sans">
                            Bundles full installation script, manifest & assets into a single ZIP.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadExtension}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition shrink-0 flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        <Download className="w-4 h-4" />
                        Get Extension ZIP
                      </button>
                    </div>

                    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/30">
                      <h5 className="font-bold text-xs text-slate-800 mb-2.5 font-sans">🔧 Quick Installation Guide</h5>
                      <ol className="space-y-2 text-[11px] text-slate-500 list-decimal pl-4 font-sans">
                        <li>Click the button above to download <strong className="text-slate-800">battrickiq-sync-helper.zip</strong>.</li>
                        <li>Extract the ZIP file content onto an easily accessible folder on your local drive.</li>
                        <li>Open Google Chrome and navigate to <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono font-bold">chrome://extensions/</code>.</li>
                        <li>Enable the <strong className="text-slate-800">Developer mode</strong> toggle switch at the top-right corner of the page.</li>
                        <li>Click the <strong className="text-slate-800">Load unpacked</strong> button on the top-left and select the folder containing extracted files.</li>
                        <li>Visit <strong className="text-slate-800">Battrick.org</strong>! A purple <strong className="text-indigo-600">⚡ Sync to BattrickIQ</strong> button will float in your game screen to instantly sync any page directly into this workspace!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* 4. Unified Sync History Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-6 animate-fadeIn">
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
                {syncLogs.map((log, index) => {
                  const getIcon = (type: string) => {
                    switch (type) {
                      case 'squad': return <Users className="w-3.5 h-3.5 text-blue-500" />;
                      case 'nets': return <RefreshCw className="w-3.5 h-3.5 text-amber-500" />;
                      case 'finances': return <Coins className="w-3.5 h-3.5 text-emerald-500" />;
                      case 'club': return <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />;
                      case 'fixtures': return <Calendar className="w-3.5 h-3.5 text-purple-500" />;
                      case 'pavilion':
                      case 'ground': return <StadiumIcon className="w-3.5 h-3.5 text-sky-500" />;
                      case 'demo': return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
                      default: return <FileText className="w-3.5 h-3.5 text-slate-400" />;
                    }
                  };

                  const getBadgeStyle = (type: string) => {
                    switch (type) {
                      case 'squad': return 'bg-blue-50 text-blue-700 border-blue-100';
                      case 'nets': return 'bg-amber-50 text-amber-700 border-amber-100';
                      case 'finances': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      case 'club': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
                      case 'fixtures': return 'bg-purple-50 text-purple-700 border-purple-100';
                      case 'pavilion':
                      case 'ground': return 'bg-sky-50 text-sky-700 border-sky-100';
                      case 'demo': return 'bg-teal-50 text-teal-700 border-teal-100';
                      default: return 'bg-slate-50 text-slate-700 border-slate-100';
                    }
                  };

                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition animate-fadeIn">
                      <td className="py-2.5 font-semibold font-mono text-slate-700">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${getBadgeStyle(log.type)}`}>
                          {getIcon(log.type)}
                          {log.type === 'demo' ? 'demo club' : log.type}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-slate-800">{log.description}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          log.status === 'success' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} />
                          {log.status === 'success' ? 'Synced' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <p className="text-xs font-semibold">No sync history logs recorded yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">Upload a Battrick page file or paste source content above to create your first sync log.</p>
          </div>
        )}
      </div>

      {showWipeConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-6 text-center flex flex-col items-center gap-4 animate-scaleUp">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-900 font-sans">Wipe Database & Reset Club?</h3>
              <p className="text-xs text-rose-600 font-bold mt-2 font-sans">
                ⚠️ WARNING: Destructive Action
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
                This will permanently clear your squad roster, training nets, financial ledger, match fixtures, stadium configurations, and club pavilion details. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 w-full mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowWipeConfirm(false);
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearAllData}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-md shadow-rose-500/10 cursor-pointer"
              >
                Yes, Wipe Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {successModal && successModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-6 text-center flex flex-col items-center gap-4 animate-scaleUp">
            {/* Dynamic Custom Header Icon */}
            {(() => {
              const getModalIconAndColor = (type: string) => {
                switch (type) {
                  case 'squad':
                    return {
                      bg: 'bg-blue-50 border border-blue-200',
                      text: 'text-blue-600',
                      icon: <Users className="w-7 h-7" />
                    };
                  case 'nets':
                    return {
                      bg: 'bg-amber-50 border border-amber-200',
                      text: 'text-amber-600',
                      icon: <RefreshCw className="w-7 h-7" />
                    };
                  case 'finances':
                    return {
                      bg: 'bg-emerald-50 border border-emerald-200',
                      text: 'text-emerald-600',
                      icon: <Coins className="w-7 h-7" />
                    };
                  case 'club':
                    return {
                      bg: 'bg-violet-50 border border-violet-200',
                      text: 'text-violet-600',
                      icon: <ShieldCheck className="w-7 h-7" />
                    };
                  case 'fixtures':
                    return {
                      bg: 'bg-purple-50 border border-purple-200',
                      text: 'text-purple-600',
                      icon: <Calendar className="w-7 h-7" />
                    };
                  case 'pavilion':
                    return {
                      bg: 'bg-sky-50 border border-sky-200',
                      text: 'text-sky-600',
                      icon: <StadiumIcon className="w-7 h-7" />
                    };
                  case 'ground':
                    return {
                      bg: 'bg-sky-50 border border-sky-200',
                      text: 'text-sky-600',
                      icon: <StadiumIcon className="w-7 h-7" />
                    };
                  case 'demo':
                    return {
                      bg: 'bg-emerald-500 border border-emerald-400 shadow-md shadow-emerald-500/15',
                      text: 'text-white',
                      icon: <Sparkles className="w-7 h-7" />
                    };
                  default:
                    return {
                      bg: 'bg-indigo-50 border border-indigo-200',
                      text: 'text-indigo-600',
                      icon: <CheckCircle className="w-7 h-7" />
                    };
                }
              };
              const style = getModalIconAndColor(successModal.type);
              return (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${style.bg} ${style.text}`}>
                  {style.icon}
                </div>
              );
            })()}

            {/* Success Title & Subtext */}
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-900 font-sans">{successModal.title}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed font-sans">
                {successModal.message}
              </p>
            </div>

            {/* Render Key Extracted Stats */}
            {successModal.stats && successModal.stats.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 w-full my-1.5">
                {successModal.stats.map((stat, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block leading-none mb-1">
                      {stat.label}
                    </span>
                    <span className="text-xs font-black text-slate-800 truncate block">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA Close Button */}
            <button
              type="button"
              onClick={() => setSuccessModal(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition shadow-md cursor-pointer font-sans"
            >
              Awesome, Got It!
            </button>
          </div>
        </div>
      )}

    </>
  );
}
