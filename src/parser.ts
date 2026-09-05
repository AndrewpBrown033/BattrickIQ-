import { BattrickPlayer, ClubFinances, BattrickGame, PavilionInfo, StadiumConfig, BattrickLeagueTable, BattrickLeagueTeam, LeagueLinkInfo, SKILL_LEVELS, STAMINA_LEVELS } from './types';

// Fuzzy name matcher to map abbreviated names like "A. Alistair" to "Andrew Alistair"
export function isNameMatch(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const n2 = name2.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  const w1 = n1.split(/\s+/);
  const w2 = n2.split(/\s+/);
  
  if (w1.length > 0 && w2.length > 0) {
    const last1 = w1[w1.length - 1];
    const last2 = w2[w2.length - 1];
    
    if (last1 === last2 && last1.length > 2) {
      const init1 = w1[0][0];
      const init2 = w2[0][0];
      if (init1 === init2) return true;
    }
  }
  
  return false;
}

// Helper to find skill index from a string
export function getSkillValue(text: string, isStamina: boolean = false): number {
  if (!text) return 0;
  const cleaned = text.trim().toLowerCase();
  
  if (isStamina) {
    if (cleaned.includes('superb*')) return 11;
    if (cleaned.includes('superb')) return 10;
    if (cleaned.includes('strong')) return 9;
    if (cleaned.includes('proficient')) return 8;
    if (cleaned.includes('respectable')) return 7;
    if (cleaned.includes('competent')) return 6;
    if (cleaned.includes('mediocre')) return 5;
    if (cleaned.includes('feeble')) return 4;
    if (cleaned.includes('woeful')) return 3;
    if (cleaned.includes('abysmal')) return 2;
    if (cleaned.includes('worthless')) return 1;
    if (cleaned.includes('useless')) return 0;
    return 0;
  }

  const idx = SKILL_LEVELS.findIndex(level => cleaned.includes(level));
  if (idx !== -1) return idx;

  // Additional vocabulary matching
  if (cleaned.includes('dying')) return 0;
  if (cleaned.includes('exhausted')) return 1;
  if (cleaned.includes('fatigued')) return 2;
  if (cleaned.includes('stiff')) return 3;
  if (cleaned.includes('aching')) return 4;
  if (cleaned.includes('stable')) return 5;
  if (cleaned === 'fit') return 6;
  if (cleaned.includes('lively')) return 7;
  if (cleaned.includes('invigorated')) return 8;
  if (cleaned.includes('energetic')) return 9;
  if (cleaned.includes('sublime')) return 10;
  if (cleaned.includes('ecstatic')) return 10;
  if (cleaned.includes('useless')) return 0;
  if (cleaned.includes('worthless')) return 1;
  if (cleaned.includes('abysmal')) return 2;
  if (cleaned.includes('woeful')) return 3;
  if (cleaned.includes('feeble')) return 4;
  if (cleaned.includes('mediocre')) return 5;
  if (cleaned.includes('competent')) return 6;
  if (cleaned.includes('respectable')) return 7;
  if (cleaned.includes('proficient')) return 8;
  if (cleaned.includes('strong')) return 9;
  if (cleaned.includes('superb')) return 10;
  if (cleaned.includes('quality')) return 11;
  if (cleaned.includes('remarkable')) return 12;
  if (cleaned.includes('wonderful')) return 13;
  if (cleaned.includes('exceptional')) return 14;
  if (cleaned.includes('sensational')) return 15;
  if (cleaned.includes('exquisite')) return 16;
  if (cleaned.includes('masterful')) return 17;
  if (cleaned.includes('miraculous')) return 18;
  if (cleaned.includes('phenomenal')) return 19;
  if (cleaned.includes('elite')) return 20;

  return 0;
}

// Convert common numerical formatted strings like "£1,234" or "12,345" to numbers
export function parseFormattedNumber(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/[£$,\s]/g, '');
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? 0 : val;
}

// Helper to extract player links from a DOM Element in a robust, case-insensitive way
function getPlayerLinksInElement(el: Element): Element[] {
  return Array.from(el.querySelectorAll('a')).filter(link => {
    const href = link.getAttribute('href') || '';
    return /(?:playerid|id)(?:_|-|=|%3d|%3D|\s)*(\d+)/i.test(href);
  });
}// Detect page type from pasted content with maximum flexibility
export function detectPageType(content: string): 'squad' | 'nets' | 'finances' | 'club' | 'fixtures' | 'pavilion' | 'ground' | 'league' | 'unknown' {
  // 1. High priority check: data-page in pagetitle or anywhere in the raw text/HTML (extremely specific and reliable for Battrick's modern HTML structure)
  const pagetitleRegex = /id=["']pagetitle["'][^>]*>[\s\S]*?data-page=["']([^"']+\.asp)["']/i;
  const pagetitleMatch = content.match(pagetitleRegex);
  if (pagetitleMatch) {
    const dataPage = pagetitleMatch[1].toLowerCase();
    if (dataPage.includes('squad.asp')) return 'squad';
    if (dataPage.includes('nets.asp')) return 'nets';
    if (dataPage.includes('finances.asp')) return 'finances';
    if (dataPage.includes('club.asp')) return 'club';
    if (dataPage.includes('fixtures.asp')) return 'fixtures';
    if (dataPage.includes('ground.asp') || dataPage.includes('expandground.asp')) return 'ground';
    if (dataPage.includes('pavilion.asp') || dataPage.includes('office.asp') || dataPage.includes('myoffice.asp')) return 'pavilion';
    if (dataPage.includes('leagues.asp') || dataPage.includes('league.asp')) return 'league';
  }

  const generalDataPageRegex = /data-page=["']([^"']+\.asp)["']/i;
  const generalMatch = content.match(generalDataPageRegex);
  if (generalMatch) {
    const dataPage = generalMatch[1].toLowerCase();
    if (dataPage.includes('squad.asp')) return 'squad';
    if (dataPage.includes('nets.asp')) return 'nets';
    if (dataPage.includes('finances.asp')) return 'finances';
    if (dataPage.includes('club.asp')) return 'club';
    if (dataPage.includes('fixtures.asp')) return 'fixtures';
    if (dataPage.includes('ground.asp') || dataPage.includes('expandground.asp')) return 'ground';
    if (dataPage.includes('pavilion.asp') || dataPage.includes('office.asp') || dataPage.includes('myoffice.asp')) return 'pavilion';
    if (dataPage.includes('leagues.asp') || dataPage.includes('league.asp')) return 'league';
  }

  let textToAnalyze = content;
  let lowerCheck = content.toLowerCase();
  
  // If content is HTML, strip the common navigation menus to avoid false positives!
  if (content.includes('<html') || content.includes('<body') || content.includes('<div') || content.includes('<form')) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');

      // Extra check: search parsed DOM specifically for pagetitle/data-page links
      const pageTitleLink = doc.querySelector('#pagetitle a[data-page]') || doc.querySelector('#pagetitle [data-page]') || doc.querySelector('[data-page]');
      if (pageTitleLink) {
        const dataPage = pageTitleLink.getAttribute('data-page')?.toLowerCase() || '';
        if (dataPage.includes('squad.asp')) return 'squad';
        if (dataPage.includes('nets.asp')) return 'nets';
        if (dataPage.includes('finances.asp')) return 'finances';
        if (dataPage.includes('club.asp')) return 'club';
        if (dataPage.includes('fixtures.asp')) return 'fixtures';
        if (dataPage.includes('ground.asp') || dataPage.includes('expandground.asp')) return 'ground';
        if (dataPage.includes('pavilion.asp') || dataPage.includes('office.asp')) return 'pavilion';
      }
      
      // Remove menu/navigation/sidebar elements that exist on all pages
      const elementsToRemove = doc.querySelectorAll('#menubar, #menubarwrapper, #header, #rightmenu, .menu, .submenu, .menu-box, #topmenu, #access, .hamburger, .signup-cta, #footer, #sidebar, .sidebar, nav, .navigation, .navbar, #leftcolumn, .leftcolumn, td.leftcolumn');
      elementsToRemove.forEach(el => el.remove());
      
      // Also look for specifically the leftcolumn or main page container if it exists
      const mainContent = doc.getElementById('leftcolumn') || doc.getElementById('page') || doc.getElementById('content') || doc.body;
      if (mainContent) {
        textToAnalyze = mainContent.innerHTML || mainContent.textContent || '';
      } else {
        textToAnalyze = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
      }
      lowerCheck = textToAnalyze.toLowerCase();
    } catch (e) {
      console.error('Error stripping layout for page type detection:', e);
      lowerCheck = content.toLowerCase();
    }
  }

  const lower = lowerCheck;

  // Fallback plain text keyword checks
  const plainText = textToAnalyze.replace(/<[^>]+>/g, ' ').toLowerCase();

  const skillCount = ['batting', 'bowling', 'keeping', 'stamina', 'fielding'].filter(s => plainText.includes(s)).length;
  const hasBtr = plainText.includes('btr') || plainText.includes('bt rating') || plainText.includes('battrick rating');
  const hasAgeAndWage = plainText.includes('age') && (plainText.includes('wage') || plainText.includes('salary') || plainText.includes('salaries'));

  // 1. Squad page detection (including skill keywords, BT rating, ages/wages, BTR)
  if (
    (hasBtr && skillCount >= 3) || 
    (hasAgeAndWage && skillCount >= 3) ||
    plainText.includes('squad list') ||
    plainText.includes('squad roster') ||
    (plainText.includes('batting') && plainText.includes('bowling') && plainText.includes('btr'))
  ) {
    return 'squad';
  }

  // 2. Nets training page detection (very specific keywords)
  const netWordCount = (plainText.match(/\bnet(?:s)?\b/g) || []).length;
  if (
    plainText.includes('active nets') || 
    plainText.includes('net coaching') || 
    plainText.includes('nets practice') ||
    plainText.includes('allocated nets') ||
    plainText.includes('stamina net') ||
    plainText.includes('fielding net') ||
    plainText.includes('net allocation') ||
    plainText.includes('netsesh') ||
    plainText.includes('training sessions') ||
    (netWordCount >= 3 && skillCount >= 2 && !hasBtr) ||
    (plainText.includes('training') && plainText.includes('batting') && plainText.includes('bowling') && plainText.includes('stamina') && plainText.includes('fielding') && !hasBtr)
  ) {
    return 'nets';
  }

  // 3. Ground/Stadium page detection (capacity, standing room, uncovered seats, covered seats, members seats, etc)
  if (
    plainText.includes('standing room') || 
    plainText.includes('uncovered seats') || 
    plainText.includes('covered seats') || 
    plainText.includes('members seats') ||
    plainText.includes('seating capacity') ||
    plainText.includes('terracing') ||
    plainText.includes('grass banks') ||
    plainText.includes('executive boxes') ||
    (plainText.includes('capacity') && (plainText.includes('seats') || plainText.includes('seating')) && plainText.includes('pitch'))
  ) {
    return 'ground';
  }

  // 4. Pavilion ("palivon") detection (Check ground name, established, membership, weather)
  if (
    plainText.includes('club pavilion') || 
    plainText.includes('membership status') ||
    plainText.includes('weather forecast') ||
    plainText.includes('palivon') ||
    plainText.includes('pavilion') ||
    (plainText.includes('established') && plainText.includes('ground name')) ||
    (plainText.includes('weather') && plainText.includes('established')) ||
    (plainText.includes('weather') && plainText.includes('ground'))
  ) {
    return 'pavilion';
  }

  // 5. Fixtures page detection
  if (
    plainText.includes('upcoming matches') || 
    plainText.includes('upcomingmatches') || 
    plainText.includes('fixture list') || 
    plainText.includes('fixtures table') || 
    plainText.includes('matchorders.asp') ||
    (plainText.includes('matchinfo.asp') && plainText.includes('orders')) ||
    plainText.includes('match date') ||
    plainText.includes('match center') ||
    (plainText.includes('date') && plainText.includes('opponent') && (plainText.includes('type') || plainText.includes('venue')))
  ) {
    return 'fixtures';
  }

  // 6. Club staff/morale page detection
  if (
    plainText.includes('public relations') || 
    plainText.includes('financial advisor') || 
    plainText.includes('financial advisors') || 
    plainText.includes('member count') ||
    plainText.includes('sponsors mood') ||
    plainText.includes('sports psychologist') ||
    plainText.includes('sports psychologists') ||
    plainText.includes('physiotherapist') ||
    plainText.includes('physiotherapists') ||
    plainText.includes('bowling coach') ||
    plainText.includes('batting coach') ||
    plainText.includes('fielding coach') ||
    plainText.includes('keeping coach') ||
    plainText.includes('stamina coach') ||
    (plainText.includes('morale') && plainText.includes('confidence') && plainText.includes('coaches'))
  ) {
    return 'club';
  }

  // 7. Finances page detection (including weekly balance, outgoings, wages, salaries, gate receipts, and statement terms)
  if (
    plainText.includes('weekly outgoings') || 
    plainText.includes('player wages') || 
    plainText.includes('staff wages') || 
    plainText.includes('player salaries') || 
    plainText.includes('staff salaries') || 
    plainText.includes('backroom staff') || 
    plainText.includes('gate receipts') || 
    plainText.includes('interest received') ||
    plainText.includes('weekly balance') ||
    plainText.includes('financial update') ||
    plainText.includes('weekly finances') ||
    plainText.includes('financial statement') ||
    plainText.includes('sponsor income') ||
    plainText.includes('sponsorship revenue') ||
    (plainText.includes('balance') && (plainText.includes('income') || plainText.includes('outgoings')))
  ) {
    return 'finances';
  }

  // Last-resort URL / filename matching
  if (lower.includes('nets.asp')) return 'nets';
  if (lower.includes('finances.asp')) return 'finances';
  if (lower.includes('club.asp')) return 'club';
  if (lower.includes('fixtures.asp')) return 'fixtures';
  if (lower.includes('ground.asp') || lower.includes('expandground.asp')) return 'ground';
  if (lower.includes('pavilion.asp') || lower.includes('office.asp') || lower.includes('myoffice.asp')) return 'pavilion';
  if (lower.includes('leagues.asp') || lower.includes('league.asp') || lower.includes('leagueid=')) return 'league';
  if (lower.includes('squad.asp')) return 'squad';

  return 'unknown';
}

// Master parser that accepts raw HTML or text copy-pasted and updates the state
export function parseBattrickPage(content: string, forcedType?: string): {
  type: 'squad' | 'nets' | 'finances' | 'club' | 'fixtures' | 'pavilion' | 'ground' | 'league' | 'unknown';
  players?: BattrickPlayer[];
  finances?: Partial<ClubFinances>;
  fixtures?: BattrickGame[];
  pavilion?: PavilionInfo | Partial<PavilionInfo>;
  stadium?: StadiumConfig;
  league?: BattrickLeagueTable;
  count?: number;
} {
  let type = (forcedType as any) || detectPageType(content);
  
  // Cleanly normalize forcedType or user-friendly descriptions to standard internal page keys
  if (type) {
    const tLower = type.toLowerCase();
    if (tLower.includes('squad')) type = 'squad';
    else if (tLower.includes('net')) type = 'nets';
    else if (tLower.includes('finance')) type = 'finances';
    else if (tLower.includes('club')) type = 'club';
    else if (tLower.includes('fixture')) type = 'fixtures';
    else if (tLower.includes('pavilion')) type = 'pavilion';
    else if (tLower.includes('ground') || tLower.includes('stadium')) type = 'ground';
  }

  if (type === 'squad') {
    let players = parseSquad(content);
    if (players.length === 0) {
      players = parseOpponentSquad(content);
    }
    return { type, players, count: players.length };
  }
  if (type === 'nets') {
    return { type, players: parseNets(content) };
  }
  if (type === 'finances' || type === 'club') {
    return { type, finances: parseFinancesAndClub(content, type) };
  }
  if (type === 'fixtures') {
    return { type, fixtures: parseFixtures(content) };
  }
  if (type === 'pavilion') {
    return { type, pavilion: parsePavilion(content) };
  }
  if (type === 'ground' || type === 'stadium') {
    const finalType = 'ground';
    return { type: finalType, stadium: parseGround(content), pavilion: parseGroundPavilionInfo(content) };
  }
  if (type === 'league') {
    return { type, league: parseLeagueTable(content) };
  }

  return { type: 'unknown' };
}

// Detailed squad parser supporting copy-pasted text and HTML source
function parseSquad(content: string): BattrickPlayer[] {
  const players: BattrickPlayer[] = [];

  // Try HTML parsing first using DOMParser
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const allPlayerRows = doc.querySelectorAll('a');
    const playerRows = Array.from(allPlayerRows).filter((linkEl) => {
      // Exclude player links inside navigation menus, sidebars, drop-downs or tables of "Sort by"
      if (linkEl.closest('#menubar, #rightmenu, .menu, .submenu, #topmenu, .menu-box')) {
        return false;
      }
      const url = linkEl.getAttribute('href') || '';
      return /(?:playerid|id)(?:_|-|=|%3d|%3D|\s)*(\d+)/i.test(url);
    });
    
    if (playerRows.length > 0) {
      playerRows.forEach((linkEl) => {
        const name = linkEl.textContent?.trim() || 'Unknown Player';
        const url = linkEl.getAttribute('href') || '';
        const idMatch = url.match(/(?:playerid|id)(?:_|-|=|%3d|%3D|\s)*(\d+)/i);
        const id = idMatch ? idMatch[1] : Math.random().toString(36).substring(2, 9);
        
        let container: Element | null = null;
        
        // 1. Try closest table first. If it has only one player link, it's specific to this player!
        const tableContainer = linkEl.closest('table');
        if (tableContainer && getPlayerLinksInElement(tableContainer).length === 1) {
          container = tableContainer;
        }
        
        // 2. Try closest tbody. If it has only one player link, it's specific!
        if (!container) {
          const tbodyContainer = linkEl.closest('tbody');
          if (tbodyContainer && getPlayerLinksInElement(tbodyContainer).length === 1) {
            container = tbodyContainer;
          }
        }
        
        // 3. Fall back to walking up to find a container with only 1 player link
        if (!container) {
          let current: Element | null = linkEl.parentElement;
          let lastSingleLinkParent: Element | null = current;
          while (current) {
            const playerLinks = getPlayerLinksInElement(current);
            if (playerLinks.length > 1) {
              container = lastSingleLinkParent;
              break;
            }
            if (current.tagName === 'TR' || current.classList.contains('player-card') || current.classList.contains('player-box')) {
              container = current;
            }
            lastSingleLinkParent = current;
            current = current.parentElement;
          }
          if (!container) {
            container = lastSingleLinkParent;
          }
        }

        if (container) {
          let text = container.textContent || '';
          
          // If the container is a TR and does not have skills, grab subsequent sibling TR text
          const hasSkills = text.toLowerCase().includes('batting') || text.toLowerCase().includes('bowling');
          if (!hasSkills && container.tagName === 'TR') {
            let sibling = container.nextElementSibling;
            while (sibling) {
              if (getPlayerLinksInElement(sibling).length > 0) {
                break;
              }
              text += ' ' + (sibling.textContent || '');
              sibling = sibling.nextElementSibling;
            }
          }
          
          const player = extractPlayerFromText(text, name, id);
          if (player) {
            players.push(player);
          }
        }
      });

      if (players.length > 0) {
        return Array.from(new Map(players.map(p => [p.id, p])).values());
      }
    }
  } catch (e) {
    console.error('DOMParser error, falling back to text parsing:', e);
  }

  // Text Parsing Fallback
  const cleanedContent = content.replace(/&nbsp;/g, ' ').replace(/\r/g, '');
  const playerRegex = /([A-Z][A-Za-z0-9.\-\s',#]{2,45})\s*(?:[\(\[\- ]\s*(?:ID:?\s*)?(\d{5,9})\b\s*[\)\]]?)/gi;
  let match;
  const matches: { name: string; id: string; index: number }[] = [];
  
  const forbiddenKeywords = [
    'rating', 'wage', 'cash', 'income', 'expense', 'balance', 'stamina', 'batting', 
    'bowling', 'keeping', 'club', 'finance', 'sponsor', 'gate', 'interest', 'index', 'capacity'
  ];

  while ((match = playerRegex.exec(cleanedContent)) !== null) {
    let rawName = match[1].trim();
    rawName = rawName.replace(/^\d+[\.\s\-]+/, '').trim();
    const lowerName = rawName.toLowerCase();
    
    const isForbidden = forbiddenKeywords.some(keyword => lowerName.includes(keyword)) || rawName.length < 3 || rawName.length > 45;
    if (!isForbidden) {
      matches.push({
        name: rawName,
        id: match[2],
        index: match.index
      });
    }
  }

  if (matches.length > 0) {
    matches.sort((a, b) => a.index - b.index);

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : cleanedContent.length;
      const block = cleanedContent.substring(start, end);
      
      const player = extractPlayerFromText(block, current.name, current.id);
      if (player) {
        players.push(player);
      }
    }
  }

  // Single player block fallback
  if (players.length === 0 && (cleanedContent.includes('Batting:') || cleanedContent.includes('Battrick Rating') || cleanedContent.includes('BT Rating'))) {
    const lines = cleanedContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let name = 'My Player';
    if (lines.length > 0 && lines[0].length < 40 && !lines[0].includes(':')) {
      name = lines[0];
    }
    const player = extractPlayerFromText(cleanedContent, name, '1');
    if (player) {
      players.push(player);
    }
  }

  return Array.from(new Map(players.map(p => [p.id, p])).values());
}

// Extractor helper for squad text content
function extractPlayerFromText(text: string, name: string, id: string): BattrickPlayer | null {
  const normalized = text.replace(/\s+/g, ' ');

  // Extract Age
  const ageMatch = normalized.match(/\bAge:?\s*(\d+)\b/i) || 
                   normalized.match(/\b(\d+)\s*(?:years old|years|yo)\b/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : 20;

  // Extract Wage (support = and :)
  const wageMatch = normalized.match(/\bWage\s*[:=]?\s*[$£€]?\s*([\d,]+)/i) || 
                    normalized.match(/\b[$£€]\s*([\d,]+)\s*(?:wage|per week)/i);
  const wage = wageMatch ? parseFormattedNumber(wageMatch[1]) : 1000;

  // Extract BT Rating (support = and :)
  const btMatch = normalized.match(/(?:Battrick\s+)?Rating\s*[:=]?\s*([\d,]+)/i) || 
                  normalized.match(/BT\s+Rating\s*[:=]?\s*([\d,]+)/i) || 
                  normalized.match(/\bBTR\s*[:=]?\s*([\d,]+)/i) ||
                  normalized.match(/\b([\d,]+)\s*(?:Battrick Rating|BT Rating|BTR)\b/i);
  const btRating = btMatch ? parseFormattedNumber(btMatch[1]) : 5000;

  // Extract form & fitness
  let form = 5;
  const batFormMatch = normalized.match(/\b([a-zA-Z]+)\s+batting\s+form\b/i) || normalized.match(/\bbatting\s+form:?\s*([a-zA-Z]+)\b/i);
  const bowlFormMatch = normalized.match(/\b([a-zA-Z]+)\s+bowling\s+form\b/i) || normalized.match(/\bbowling\s+form:?\s*([a-zA-Z]+)\b/i);
  const generalFormMatch = normalized.match(/\bForm:?\s*([a-zA-Z]+)\b/i);
  
  if (batFormMatch && bowlFormMatch) {
    form = Math.round((getSkillValue(batFormMatch[1]) + getSkillValue(bowlFormMatch[1])) / 2);
  } else if (batFormMatch) {
    form = getSkillValue(batFormMatch[1]);
  } else if (bowlFormMatch) {
    form = getSkillValue(bowlFormMatch[1]);
  } else if (generalFormMatch) {
    form = getSkillValue(generalFormMatch[1]);
  }

  let fitness = 5;
  const fitnessMatch = normalized.match(/\b([a-zA-Z]+)\s+fitness\b/i) || 
                       normalized.match(/\bfitness:?\s*([a-zA-Z]+)\b/i);
  if (fitnessMatch) {
    fitness = getSkillValue(fitnessMatch[1]);
  } else {
    const fitMatch = normalized.match(/Fitness:?\s*([a-zA-Z]+)/i);
    if (fitMatch) {
      fitness = getSkillValue(fitMatch[1]);
    }
  }

  // Extract Bowling Type
  let bowlingType = 'None';
  const bowlLower = normalized.toLowerCase();
  const bowlTypeMatch = normalized.match(/Bowls:?\s*([A-Za-z\s]+?)(?:,\s*|Style|$|\s+Rating)/i);
  if (bowlTypeMatch) {
    const type = bowlTypeMatch[1].trim().toLowerCase();
    if (type.includes('fast medium')) bowlingType = 'Fast Medium';
    else if (type.includes('fast')) bowlingType = 'Fast';
    else if (type.includes('medium')) bowlingType = 'Medium';
    else if (type.includes('spin') || type.includes('spinner') || type.includes('break') || type.includes('orthodox')) bowlingType = 'Spin';
  }
  
  if (bowlingType === 'None') {
    if (/\b(?:r|l)?fm\s+bowler\b/i.test(normalized) || bowlLower.includes('fast medium') || bowlLower.includes('fast-medium')) {
      bowlingType = 'Fast Medium';
    } else if (/\b(?:r|l)?f\s+bowler\b/i.test(normalized) || bowlLower.includes('fast bowler') || bowlLower.includes('fast pace')) {
      bowlingType = 'Fast';
    } else if (/\b(?:r|l)?m\s+bowler\b/i.test(normalized) || bowlLower.includes('medium bowler')) {
      bowlingType = 'Medium';
    } else if (bowlLower.includes('spin') || bowlLower.includes('off break') || bowlLower.includes('leg break') || bowlLower.includes('orthodox') || bowlLower.includes('spinner')) {
      bowlingType = 'Spin';
    }
  }

  // Skills
  const batting = getSkillValue(matchSkill(normalized, 'Batting'));
  const bowling = getSkillValue(matchSkill(normalized, 'Bowling'));
  const keeping = getSkillValue(matchSkill(normalized, 'Keeping'));
  const stamina = getSkillValue(matchSkill(normalized, 'Stamina'), true);
  const leadership = getSkillValue(matchSkill(normalized, 'Leadership'));
  const experience = getSkillValue(matchSkill(normalized, 'Experience'));
  const concentration = getSkillValue(matchSkill(normalized, 'Concentration'));
  const consistency = getSkillValue(matchSkill(normalized, 'Consistency'));
  const fielding = getSkillValue(matchSkill(normalized, 'Fielding'));

  // Calculate Best Role
  let role: BattrickPlayer['role'] = 'Prospect';
  const primary = Math.max(batting, bowling, keeping);
  if (keeping >= 5 && keeping >= batting && keeping >= bowling) {
    role = 'Keeper';
  } else if (batting >= 5 && bowling >= 5) {
    role = 'All-rounder';
  } else if (batting >= 5 && batting >= bowling) {
    role = 'Batter';
  } else if (bowling >= 5 && bowling >= batting) {
    role = 'Bowler';
  }

  return {
    id,
    name: name.replace(/^\d+[\.\s\-]+/, ''),
    age,
    wage,
    btRating,
    bowlingType,
    role,
    skills: {
      batting,
      bowling,
      keeping,
      stamina,
      leadership,
      experience,
      concentration,
      consistency,
      fielding,
    },
    form,
    fitness,
    nets: {
      batting: 0,
      bowling: 0,
      keeping: 0,
      fielding: 0,
      stamina: 0,
    }
  };
}

// Regex helper to extract skill words
function matchSkill(text: string, skillName: string): string {
  const skillLevelsRegex = '(?:useless|worthless|abysmal|woeful|feeble|mediocre|competent|respectable|proficient|strong|superb|quality|remarkable|wonderful|exceptional|sensational|exquisite|masterful|miraculous|phenomenal|elite)';
  const regex = new RegExp(`\\b${skillName}\\b:?\\s*(?:\\[|\\()?(${skillLevelsRegex})\\b`, 'i');
  const match = text.match(regex);
  if (match) {
    return match[1];
  }
  // Fallback to the original regex if we don't find a skill level match
  const fallbackRegex = new RegExp(`\\b${skillName}\\b:?\\s*(?:\\[|\\()?([a-zA-Z]+)\\b`, 'i');
  const fallbackMatch = text.match(fallbackRegex);
  return fallbackMatch ? fallbackMatch[1] : '';
}

// Net training sheet parser
function parseNets(content: string): BattrickPlayer[] {
  const updatedNets: { name: string; nets: BattrickPlayer['nets'] }[] = [];
  const squadList: BattrickPlayer[] = [];
  
  // Try to load current squad player list from localStorage for smart name matching
  const savedSquad = localStorage.getItem('bt_squad');
  if (savedSquad) {
    try {
      squadList.push(...JSON.parse(savedSquad));
    } catch (e) {
      console.error(e);
    }
  }

  // Helper to extract nets from a string
  const parseNetsFromString = (text: string): BattrickPlayer['nets'] | null => {
    const textLower = text.toLowerCase();
    
    // Check if there are explicit words like "batting", "bowling", etc.
    let batting = extractNetCount(textLower, 'batting');
    if (batting === 0) batting = extractNetCount(textLower, 'bat');
    
    let bowling = extractNetCount(textLower, 'bowling');
    if (bowling === 0) bowling = extractNetCount(textLower, 'bowl');
    
    let keeping = extractNetCount(textLower, 'keeping');
    if (keeping === 0) keeping = extractNetCount(textLower, 'keep');
    
    let fielding = extractNetCount(textLower, 'fielding');
    if (fielding === 0) fielding = extractNetCount(textLower, 'field');
    
    let stamina = extractNetCount(textLower, 'stamina');
    if (stamina === 0) stamina = extractNetCount(textLower, 'stam');

    if (batting > 0 || bowling > 0 || keeping > 0 || fielding > 0 || stamina > 0) {
      return { batting, bowling, keeping, fielding, stamina };
    }

    // Look for 5 space-separated columns of numbers/dashes.
    // We clean up common player patterns first (like IDs in parentheses, ages, etc. which are numbers)
    // to avoid capturing them.
    const cleanedText = text
      .replace(/\(\d+\)/g, '') // remove player ID like (123456)
      .replace(/id:\s*\d+/gi, '') // remove ID: 12345
      .replace(/\b\d{5,9}\b/g, '') // remove loose IDs
      .replace(/\b\d+\s*(?:years old|years|yo)\b/gi, '') // remove age text
      .replace(/\bage:?\s*\d+/gi, '') // remove Age: 20
      .replace(/\bwage:?\s*[$£€]?\s*[\d,]+/gi, '') // remove wage
      .replace(/(?:battrick\s+)?rating:?\s*[\d,]+/gi, '') // remove ratings
      .replace(/btr:?\s*[\d,]+/gi, '') // remove BTR
      .replace(/\s+/g, ' ')
      .trim();

    // Now look for 5 numbers/dashes in the remaining text
    // E.g. "Andrew Alistair 1 0 0 1 0" or "A. Alistair 2 - - - 1"
    const fiveColsRegex = /(?:^|\s)(\d+|\-)\s+(\d+|\-)\s+(\d+|\-)\s+(\d+|\-)\s+(\d+|\-)(?:\s|$)/;
    const match = cleanedText.match(fiveColsRegex);
    if (match) {
      const getNum = (s: string) => s === '-' ? 0 : parseInt(s, 10) || 0;
      return {
        batting: getNum(match[1]),
        bowling: getNum(match[2]),
        keeping: getNum(match[3]),
        fielding: getNum(match[4]),
        stamina: getNum(match[5])
      };
    }

    return null;
  };

  // 1. DOM HTML Parsing if possible
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    const playerNetsMap = new Map<string, { batting: number; bowling: number; keeping: number; fielding: number; stamina: number }>();

    // 1a. Check for active training sessions form (netsesh) where dropdowns assign sessions to players
    const activeForm = doc.querySelector('form[name="netsesh"]') || doc.querySelector('select[name^="nets"]')?.closest('form');
    if (activeForm) {
      const selectElements = activeForm.querySelectorAll('select[name^="nets"]');
      if (selectElements.length > 0) {
        selectElements.forEach(sel => {
          const row = sel.closest('tr');
          if (!row) return;
          
          const headerCells = Array.from(row.querySelectorAll('th, td'));
          let trainingType = '';
          if (headerCells.length >= 2) {
            trainingType = headerCells[1].textContent?.trim() || '';
          }
          
          if (!trainingType) return;
          
          const selectedOpt = sel.querySelector('option[selected], option:checked') as HTMLOptionElement;
          if (selectedOpt) {
            const playerID = (selectedOpt.getAttribute('value') || '').trim();
            if (playerID && playerID !== '0' && playerID !== '-1') {
              const playerName = selectedOpt.textContent?.trim() || '';
              if (playerName) {
                const typeLower = trainingType.toLowerCase();
                let typeKey: 'batting' | 'bowling' | 'keeping' | 'fielding' | 'stamina' | null = null;
                if (typeLower.includes('batting') || typeLower.includes('bat')) typeKey = 'batting';
                else if (typeLower.includes('bowling') || typeLower.includes('bowl')) typeKey = 'bowling';
                else if (typeLower.includes('keeping') || typeLower.includes('keep')) typeKey = 'keeping';
                else if (typeLower.includes('fielding') || typeLower.includes('field')) typeKey = 'fielding';
                else if (typeLower.includes('stamina') || typeLower.includes('stam')) typeKey = 'stamina';
                
                if (typeKey) {
                  if (!playerNetsMap.has(playerName)) {
                    playerNetsMap.set(playerName, { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 });
                  }
                  playerNetsMap.get(playerName)![typeKey] += 1;
                }
              }
            }
          }
        });
      }
    }

    // 1b. Check for "Last Training Session" sidebar or similar tables (tr.previousnetsname)
    const sidebarRows = doc.querySelectorAll('tr.previousnetsname');
    if (sidebarRows.length > 0) {
      sidebarRows.forEach(row => {
        const nameLink = row.querySelector('a');
        const playerName = nameLink ? nameLink.textContent?.trim() : row.textContent?.trim();
        if (playerName) {
          let nextRow = row.nextElementSibling;
          const nets = { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 };
          while (nextRow && !nextRow.classList.contains('previousnetsname')) {
            const text = nextRow.textContent?.toLowerCase() || '';
            const matchNet = text.match(/([a-z]+)\s*:\s*(\d+)/);
            if (matchNet) {
              const type = matchNet[1];
              const qty = parseInt(matchNet[2], 10) || 0;
              if (type.includes('batting') || type.includes('bat')) nets.batting = qty;
              else if (type.includes('bowling') || type.includes('bowl')) nets.bowling = qty;
              else if (type.includes('keeping') || type.includes('keep')) nets.keeping = qty;
              else if (type.includes('fielding') || type.includes('field')) nets.fielding = qty;
              else if (type.includes('stamina') || type.includes('stam')) nets.stamina = qty;
            }
            nextRow = nextRow.nextElementSibling;
          }
          if (nets.batting > 0 || nets.bowling > 0 || nets.keeping > 0 || nets.fielding > 0 || nets.stamina > 0) {
            // Only add if not already parsed (active map takes priority)
            if (!playerNetsMap.has(playerName)) {
              playerNetsMap.set(playerName, { ...nets });
            }
          }
        }
      });
    }

    // 1c. If both activeForm and sidebarRows didn't produce anything, let's use the legacy row parser
    if (playerNetsMap.size === 0) {
      const rows = doc.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 2) {
          const nameLink = cells[0].querySelector('a');
          const name = nameLink ? nameLink.textContent?.trim() : cells[0].textContent?.trim();
          
          if (name) {
            const selects = Array.from(row.querySelectorAll('select'));
            let batting = 0, bowling = 0, keeping = 0, fielding = 0, stamina = 0;
            
            let hasNamedSelects = false;
            selects.forEach(sel => {
              const selName = sel.getAttribute('name')?.toLowerCase() || '';
              if (selName.includes('batting') || selName.includes('bat') || 
                  selName.includes('bowling') || selName.includes('bowl') || 
                  selName.includes('keeping') || selName.includes('keep') || 
                  selName.includes('fielding') || selName.includes('field') || 
                  selName.includes('stamina') || selName.includes('stam')) {
                hasNamedSelects = true;
              }
            });

            if (hasNamedSelects) {
              selects.forEach(sel => {
                const selName = sel.getAttribute('name')?.toLowerCase() || '';
                const selectedOpt = sel.querySelector('option[selected], option:checked');
                const val = selectedOpt ? parseInt(selectedOpt.getAttribute('value') || '0', 10) : parseInt((sel as HTMLSelectElement).value || '0', 10);
                
                if (selName.includes('batting') || selName.includes('bat')) batting = val;
                else if (selName.includes('bowling') || selName.includes('bowl')) bowling = val;
                else if (selName.includes('keeping') || selName.includes('keep')) keeping = val;
                else if (selName.includes('fielding') || selName.includes('field')) fielding = val;
                else if (selName.includes('stamina') || selName.includes('stam')) stamina = val;
              });
            } else if (selects.length >= 5) {
              const getVal = (sel: HTMLSelectElement) => {
                const selectedOpt = sel.querySelector('option[selected], option:checked');
                return selectedOpt ? parseInt(selectedOpt.getAttribute('value') || '0', 10) : parseInt(sel.value || '0', 10);
              };
              batting = getVal(selects[0] as HTMLSelectElement);
              bowling = getVal(selects[1] as HTMLSelectElement);
              keeping = getVal(selects[2] as HTMLSelectElement);
              fielding = getVal(selects[3] as HTMLSelectElement);
              stamina = getVal(selects[4] as HTMLSelectElement);
            }
            
            if (batting > 0 || bowling > 0 || keeping > 0 || fielding > 0 || stamina > 0) {
              playerNetsMap.set(name, { batting, bowling, keeping, fielding, stamina });
            } else {
              const textContentOfCells = cells.slice(1).map(c => c.textContent || '').join(' ');
              const nets = parseNetsFromString(textContentOfCells);
              if (nets) {
                playerNetsMap.set(name, nets);
              }
            }
          }
        }
      });
    }

    // Convert playerNetsMap to updatedNets
    playerNetsMap.forEach((nets, name) => {
      updatedNets.push({ name, nets });
    });

  } catch (e) {
    console.error('Nets DOMParser error, falling back:', e);
  }

  // 2. Line-by-Line plain text parser
  const lines = content.split('\n');
  lines.forEach(line => {
    const cleanedLine = line.trim();
    if (!cleanedLine) return;
    
    // Find matching player name from squad if possible
    let playerName = '';
    let matchedSquadPlayer = squadList.find(p => {
      const n = p.name.toLowerCase().trim();
      const lineL = cleanedLine.toLowerCase();
      return lineL.includes(n);
    });
    
    if (!matchedSquadPlayer) {
      matchedSquadPlayer = squadList.find(p => isNameMatch(p.name, cleanedLine));
    }
    
    if (matchedSquadPlayer) {
      playerName = matchedSquadPlayer.name;
    } else {
      // Look for any name-like pattern at start of the line
      const nameMatch = cleanedLine.match(/^([A-Z][A-Za-z0-9.\-\s',#]{2,35})/);
      if (nameMatch) {
        playerName = nameMatch[1].trim().replace(/^\d+[\.\s\-]+/, '');
      }
    }
    
    if (playerName && playerName.length > 2) {
      // Strip player name from text to avoid false number matches in names
      const textForNets = cleanedLine.replace(new RegExp(playerName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'), '');
      const nets = parseNetsFromString(textForNets);
      if (nets) {
        // Deduplicate
        if (!updatedNets.some(item => isNameMatch(item.name, playerName))) {
          updatedNets.push({ name: playerName, nets });
        }
      }
    }
  });

  return updatedNets.map(item => ({
    id: item.name.toLowerCase().replace(/\s+/g, '-'),
    name: item.name,
    age: 0,
    wage: 0,
    btRating: 0,
    bowlingType: 'None',
    role: 'Prospect',
    skills: { batting: 0, bowling: 0, keeping: 0, stamina: 0, leadership: 0, experience: 0, concentration: 0, consistency: 0, fielding: 0 },
    form: 0,
    fitness: 0,
    nets: item.nets,
  }));
}

function extractNetCount(text: string, type: string): number {
  const regexes = [
    new RegExp(`(\\d+)\\s*${type}`, 'i'),
    new RegExp(`${type}\\s*(?:net\\s*)?[\\(\\:\\-\\[]?\\s*(\\d+)`, 'i'),
    new RegExp(`(\\d+)\\s*x\\s*${type}`, 'i')
  ];
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match) return parseInt(match[1], 10);
  }
  if (text.includes(type)) return 1;
  return 0;
}

// Club page and finances parser
function parseFinancesAndClub(content: string, type: 'finances' | 'club'): Partial<ClubFinances> {
  const finances: Partial<ClubFinances> = {};
  const normalized = content.replace(/\s+/g, ' ');

  // 1. DOM HTML Parsing if possible
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // 1a. If it's a club page, try standard Battrick ID-based extraction first (highly robust)
    if (type === 'club') {
      const bowlingCoachesEl = doc.getElementById('club_bowling_coaches');
      const battingCoachesEl = doc.getElementById('club_batting_coaches');
      const fieldingCoachesEl = doc.getElementById('club_fielding_coaches');
      const keepingCoachesEl = doc.getElementById('club_keeping_coaches');
      const staminaCoachesEl = doc.getElementById('club_stamina_coaches');
      const sportsPsychologistsEl = doc.getElementById('club_sports_psychologists');
      const prOfficersEl = doc.getElementById('club_pr_officers');
      const finAdvisorsEl = doc.getElementById('club_financial_advisors');
      const membersEl = doc.getElementById('club_members');
      const sponsorsMoodEl = doc.getElementById('club_sponsors_mood');
      const moraleEl = doc.getElementById('club_morale');
      const membersConfidenceEl = doc.getElementById('club_members_confidence');
      const academyConditionEl = doc.getElementById('club_academy_condition');
      const academyInvestmentEl = doc.getElementById('club_academy_investment');
      const academyItsEl = doc.getElementById('club_academy_its');

      if (bowlingCoachesEl) finances.bowlingCoaches = parseInt(bowlingCoachesEl.textContent?.trim() || '0', 10);
      if (battingCoachesEl) finances.battingCoaches = parseInt(battingCoachesEl.textContent?.trim() || '0', 10);
      if (fieldingCoachesEl) finances.fieldingCoaches = parseInt(fieldingCoachesEl.textContent?.trim() || '0', 10);
      if (keepingCoachesEl) finances.keepingCoaches = parseInt(keepingCoachesEl.textContent?.trim() || '0', 10);
      if (staminaCoachesEl) finances.staminaCoaches = parseInt(staminaCoachesEl.textContent?.trim() || '0', 10);
      if (sportsPsychologistsEl) finances.psychologists = parseInt(sportsPsychologistsEl.textContent?.trim() || '0', 10);
      if (prOfficersEl) finances.prOfficers = parseInt(prOfficersEl.textContent?.trim() || '0', 10);
      if (finAdvisorsEl) finances.finAdvisors = parseInt(finAdvisorsEl.textContent?.trim() || '0', 10);
      if (membersEl) finances.members = parseFormattedNumber(membersEl.textContent?.trim() || '0');

      if (sponsorsMoodEl) {
        const text = sponsorsMoodEl.textContent?.trim() || '';
        const cleaned = text.split(/[\u2014\u2013-]/)[0].trim().toLowerCase();
        if (cleaned) finances.sponsorsMood = cleaned;
      }
      if (moraleEl) {
        const text = moraleEl.textContent?.trim() || '';
        const cleaned = text.split(/[\u2014\u2013-]/)[0].trim().toLowerCase();
        if (cleaned) finances.morale = cleaned;
      }
      if (membersConfidenceEl) {
        const text = membersConfidenceEl.textContent?.trim() || '';
        const cleaned = text.split(/[\u2014\u2013-]/)[0].trim().toLowerCase();
        if (cleaned) finances.membersConfidence = cleaned;
      }
      if (academyConditionEl) {
        const text = academyConditionEl.textContent?.trim() || '';
        const cleaned = text.split(/[\u2014\u2013-]/)[0].trim().toLowerCase();
        if (cleaned) finances.academyCondition = cleaned;
      }
      if (academyInvestmentEl) {
        finances.academyInvestment = parseFormattedNumber(academyInvestmentEl.textContent?.trim() || '0');
      }
      if (academyItsEl) {
        finances.academyIts = parseInt(academyItsEl.textContent?.trim() || '0', 10);
      }
    }

    // 1b. Direct extraction of cash balance from known IDs (extremely precise)
    const currentBalEl = doc.querySelector('#current-bal') || doc.getElementById('current-bal') || doc.querySelector('#closing-bal') || doc.getElementById('closing-bal');
    if (currentBalEl && currentBalEl.textContent) {
      const cleanCash = parseFormattedNumber(currentBalEl.textContent);
      if (cleanCash > 0) {
        finances.cash = cleanCash;
      }
    }

    // 1c. Try to extract transaction values directly from battrick's structured transactions list
    const transactionRows = Array.from(doc.querySelectorAll('li, tr'));
    transactionRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('span, td, th')).map(el => el.textContent?.trim() || '');
      if (cells.length >= 2) {
        const descIdx = cells.findIndex(c => 
          /gate\s+receipts|backroom\s+staff\s+salaries|player\s+salaries|ground\s+maintenance|interest\s+received|sponsorship\s+revenue/i.test(c)
        );

        if (descIdx !== -1) {
          const desc = cells[descIdx].toLowerCase();
          let amount = 0;
          for (let j = descIdx + 1; j < cells.length; j++) {
            const val = parseFormattedNumber(cells[j]);
            if (val > 0) {
              amount = val;
              break;
            }
          }
          if (amount > 0) {
            if (desc.includes('gate receipts')) {
              finances.gateReceipts = amount;
            } else if (desc.includes('sponsorship')) {
              finances.sponsorsIncome = amount;
            } else if (desc.includes('interest received')) {
              finances.interestReceived = amount;
            } else if (desc.includes('player salaries')) {
              finances.playerWages = amount;
            } else if (desc.includes('backroom staff salaries')) {
              finances.staffWages = amount;
            }
          }
        }
      }
    });

    // 1d. General cell fallback traversal - Filter out sidebars, footers, headers and menus to avoid matching dropdown lists
    const cells = Array.from(doc.querySelectorAll('td, th, div, p, span, li')).filter(el => {
      return !el.closest('#menubar, #rightmenu, .menu, .submenu, #topmenu, .menu-box, #header, #footer');
    });

    for (let i = 0; i < cells.length; i++) {
      const text = cells[i].textContent?.trim() || '';
      const valText = cells[i + 1]?.textContent?.trim() || '';
      const fullText = text + ' ' + valText;
      
      if (/balance|club\s+cash|cash/i.test(text)) {
        if (!/carried\s+forward|brought\s+forward|opening/i.test(text)) {
          if (!/\d{1,2}\s+[a-zA-Z]{3}\s+\d{4}/.test(text)) {
            const m = fullText.match(/(?:current\s+balance|closing\s+balance|balance|cash|club\s+cash)[:\s]*[$£€]?\s*([\d,]{4,12})/i);
            if (m) {
              const parsedVal = parseFormattedNumber(m[1]);
              if (parsedVal > 1000 && finances.cash === undefined) {
                finances.cash = parsedVal;
              }
            } else {
              const currencyMatch = fullText.match(/[$£€]\s*([\d,]{4,12})/);
              if (currencyMatch) {
                const parsedVal = parseFormattedNumber(currencyMatch[1]);
                if (parsedVal > 1000 && finances.cash === undefined) {
                  finances.cash = parsedVal;
                }
              }
            }
          }
        }
      }
      if (/members|member\s+count/i.test(text) && 
          !/since|joined|seats|online|status|membership/i.test(text) && 
          finances.members === undefined) {
        // Tight regex that only allows spaces and optional colon to prevent spanning over dates
        const m = text.match(/(?:club\s+members|members|member\s+count)[:\s]*([\d,]+)/i) || 
                  fullText.match(/(?:club\s+members|members|member\s+count)[:\s]*([\d,]+)/i);
        if (m) {
          const val = parseFormattedNumber(m[1]);
          // Club members are typically within a logical range, and definitely not a massive date timestamp
          if (val > 0 && val < 500000) {
            finances.members = val;
          }
        }
      }
      if (/public\s+relations|pr\s+officer|pr\s+officers/i.test(text) && finances.prOfficers === undefined) {
        const m = text.match(/(?:public\s+relations|pr\s+officers?|pr)[^0-9]*(\d+)/i) || fullText.match(/(?:public\s+relations|pr\s+officers?|pr)[^0-9]*(\d+)/i);
        if (m) {
          finances.prOfficers = parseInt(m[1], 10);
        }
      }
      if (/financial\s+advisor|fa\s+advisor|financial\s+advisors/i.test(text) && finances.finAdvisors === undefined) {
        const m = text.match(/(?:financial\s+advisors?|fa\s+advisors?|fa)[^0-9]*(\d+)/i) || fullText.match(/(?:financial\s+advisors?|fa\s+advisors?|fa)[^0-9]*(\d+)/i);
        if (m) {
          finances.finAdvisors = parseInt(m[1], 10);
        }
      }
      if (/bowling\s+coach/i.test(text) && finances.bowlingCoaches === undefined) {
        const m = text.match(/(?:bowling\s+coach(?:es)?)[^0-9]*(\d+)/i) || fullText.match(/(?:bowling\s+coach(?:es)?)[^0-9]*(\d+)/i);
        if (m) finances.bowlingCoaches = parseInt(m[1], 10);
      }
      if (/batting\s+coach/i.test(text) && finances.battingCoaches === undefined) {
        const m = text.match(/(?:batting\s+coach(?:es)?)[^0-9]*(\d+)/i) || fullText.match(/(?:batting\s+coach(?:es)?)[^0-9]*(\d+)/i);
        if (m) finances.battingCoaches = parseInt(m[1], 10);
      }
      if (/fielding\s+coach/i.test(text) && finances.fieldingCoaches === undefined) {
        const m = text.match(/(?:fielding\s+coach(?:es)?)[^0-9]*(\d+)/i) || fullText.match(/(?:fielding\s+coach(?:es)?)[^0-9]*(\d+)/i);
        if (m) finances.fieldingCoaches = parseInt(m[1], 10);
      }
      if (/wicket\s+keeping\s+coach|keeping\s+coach/i.test(text) && finances.keepingCoaches === undefined) {
        const m = text.match(/(?:wicket\s+keeping\s+coach(?:es)?|keeping\s+coach(?:es)?)[^0-9]*(\d+)/i) || fullText.match(/(?:wicket\s+keeping\s+coach(?:es)?|keeping\s+coach(?:es)?)[^0-9]*(\d+)/i);
        if (m) finances.keepingCoaches = parseInt(m[1], 10);
      }
      if (/stamina\s+coach/i.test(text) && finances.staminaCoaches === undefined) {
        const m = text.match(/(?:stamina\s+coach(?:es)?)[^0-9]*(\d+)/i) || fullText.match(/(?:stamina\s+coach(?:es)?)[^0-9]*(\d+)/i);
        if (m) finances.staminaCoaches = parseInt(m[1], 10);
      }
      if (/sports\s+psychologist/i.test(text) && finances.psychologists === undefined) {
        const m = text.match(/(?:sports\s+psychologists?)[^0-9]*(\d+)/i) || fullText.match(/(?:sports\s+psychologists?)[^0-9]*(\d+)/i);
        if (m) finances.psychologists = parseInt(m[1], 10);
      }
      if (/sponsor|sponsors/i.test(text)) {
        const m = text.match(/(?:sponsor|sponsors|sponsorship)[^0-9]*([\d,]+)/i) || fullText.match(/(?:sponsor|sponsors|sponsorship)[^0-9]*([\d,]+)/i);
        if (m && finances.sponsorsIncome === undefined) finances.sponsorsIncome = parseFormattedNumber(m[1]);
      }
      if (/gate\s+receipts/i.test(text)) {
        const m = text.match(/(?:gate\s+receipts)[^0-9]*([\d,]+)/i) || fullText.match(/(?:gate\s+receipts)[^0-9]*([\d,]+)/i);
        if (m && finances.gateReceipts === undefined) finances.gateReceipts = parseFormattedNumber(m[1]);
      }
      if (/interest\s+received|interest/i.test(text)) {
        const m = text.match(/(?:interest\s+received|interest)[^0-9]*([\d,]+)/i) || fullText.match(/(?:interest\s+received|interest)[^0-9]*([\d,]+)/i);
        if (m && finances.interestReceived === undefined) finances.interestReceived = parseFormattedNumber(m[1]);
      }
      if (/player\s+salaries|player\s+wages/i.test(text)) {
        const m = text.match(/(?:player\s+salaries|player\s+wages)[^0-9]*([\d,]+)/i) || fullText.match(/(?:player\s+salaries|player\s+wages)[^0-9]*([\d,]+)/i);
        if (m && finances.playerWages === undefined) finances.playerWages = parseFormattedNumber(m[1]);
      }
      if (/staff\s+salaries|staff\s+wages/i.test(text)) {
        const m = text.match(/(?:staff\s+salaries|staff\s+wages|backroom\s+staff)[^0-9]*([\d,]+)/i) || fullText.match(/(?:staff\s+salaries|staff\s+wages|backroom\s+staff)[^0-9]*([\d,]+)/i);
        if (m && finances.staffWages === undefined) finances.staffWages = parseFormattedNumber(m[1]);
      }
      if (/team\s+morale|morale/i.test(text) && finances.morale === undefined) {
        const m = fullText.match(/(?:morale:?\s*|is\s+)([A-Za-z]+)/i);
        if (m) finances.morale = m[1].toLowerCase().trim();
      }
      if (/sponsors\s+mood|sponsors\s+opinion/i.test(text) && finances.sponsorsMood === undefined) {
        const m = fullText.match(/(?:mood:?\s*|is\s+)([A-Za-z]+)/i);
        if (m) finances.sponsorsMood = m[1].toLowerCase().trim();
      }
    }
  } catch (e) {
    console.error('Finances DOMParser error:', e);
  }

  // 2. Text-Based Fallbacks if some values were not captured (very precise pattern matches on normalized text)
  let fallbackText = normalized;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    doc.querySelectorAll('#menubar, #rightmenu, .menu, .submenu, #topmenu, .menu-box, #header, #footer').forEach(el => el.remove());
    fallbackText = doc.body?.textContent?.replace(/\s+/g, ' ') || normalized;
  } catch (e) {}

  const cashMatch = fallbackText.match(/Current\s+Balance:\s*[$£€]?\s*([\d,]+)/i) || 
                    fallbackText.match(/Closing\s+Balance:\s*[$£€]?\s*([\d,]+)/i) ||
                    fallbackText.match(/Balance:\s*[$£€]?\s*([\d,]+)/i) || 
                    fallbackText.match(/Club\s+Cash:\s*[$£€]?\s*([\d,]+)/i) || 
                    fallbackText.match(/Cash:\s*[$£€]?\s*([\d,]+)/i);
  if (cashMatch && finances.cash === undefined) {
    finances.cash = parseFormattedNumber(cashMatch[1]);
  }

  // Avoid matching date stamps or stadium seats in the fallback block using a negative lookahead
  const memberMatch = fallbackText.match(/Club\s+Members:\s*([\d,]+)/i) || 
                      fallbackText.match(/Members:\s*([\d,]+)(?!\s*[\/\-:\d])/i) || 
                      fallbackText.match(/Member\s+count:\s*([\d,]+)/i);
  if (memberMatch && finances.members === undefined) {
    const val = parseFormattedNumber(memberMatch[1]);
    if (val > 0 && val < 500000) {
      finances.members = val;
    }
  }

  const prMatch = fallbackText.match(/Public\s+Relations(?:\s+officers?)?\s*:\s*(\d+)/i) || fallbackText.match(/PR\s*Officers?\s*:\s*(\d+)/i) || fallbackText.match(/Public\s+Relations\s+Officers?\s*:\s*(\d+)/i) || fallbackText.match(/Public\s+Relations\s+Officers?\s+(\d+)/i) || fallbackText.match(/Public\s+Relations\s+(\d+)/i);
  if (prMatch && finances.prOfficers === undefined) finances.prOfficers = parseInt(prMatch[1], 10);

  const faMatch = fallbackText.match(/Financial\s+Advisors?\s*:\s*(\d+)/i) || fallbackText.match(/FA\s*Advisors?\s*:\s*(\d+)/i) || fallbackText.match(/Financial\s+Advisors?\s+(\d+)/i) || fallbackText.match(/Financial\s+Advisor\s+(\d+)/i);
  if (faMatch && finances.finAdvisors === undefined) finances.finAdvisors = parseInt(faMatch[1], 10);

  const bowlMatch = fallbackText.match(/Bowling\s+Coach(?:es)?\s*:\s*(\d+)/i) || fallbackText.match(/Bowling\s+Coach(?:es)?\s+(\d+)/i);
  if (bowlMatch && finances.bowlingCoaches === undefined) finances.bowlingCoaches = parseInt(bowlMatch[1], 10);

  const batMatch = fallbackText.match(/Batting\s+Coach(?:es)?\s*:\s*(\d+)/i) || fallbackText.match(/Batting\s+Coach(?:es)?\s+(\d+)/i);
  if (batMatch && finances.battingCoaches === undefined) finances.battingCoaches = parseInt(batMatch[1], 10);

  const fieldMatch = fallbackText.match(/Fielding\s+Coach(?:es)?\s*:\s*(\d+)/i) || fallbackText.match(/Fielding\s+Coach(?:es)?\s+(\d+)/i);
  if (fieldMatch && finances.fieldingCoaches === undefined) finances.fieldingCoaches = parseInt(fieldMatch[1], 10);

  const keepMatch = fallbackText.match(/Wicket\s+Keeping\s+Coach(?:es)?\s*:\s*(\d+)/i) || fallbackText.match(/Wicket\s+Keeping\s+Coach(?:es)?\s+(\d+)/i) || fallbackText.match(/Keeping\s+Coach(?:es)?\s*:\s*(\d+)/i);
  if (keepMatch && finances.keepingCoaches === undefined) finances.keepingCoaches = parseInt(keepMatch[1], 10);

  const stamMatch = fallbackText.match(/Stamina\s+Coach(?:es)?\s*:\s*(\d+)/i) || fallbackText.match(/Stamina\s+Coach(?:es)?\s+(\d+)/i);
  if (stamMatch && finances.staminaCoaches === undefined) finances.staminaCoaches = parseInt(stamMatch[1], 10);

  const psychMatch = fallbackText.match(/Sports\s+Psychologists?\s*:\s*(\d+)/i) || fallbackText.match(/Sports\s+Psychologists?\s+(\d+)/i) || fallbackText.match(/Sports\s+Psychologist\s+(\d+)/i);
  if (psychMatch && finances.psychologists === undefined) finances.psychologists = parseInt(psychMatch[1], 10);

  const sponsorsMatch = fallbackText.match(/Sponsorship\s+Revenue\s*[:\-]?\s*[$£€]?\s*([\d,]+)/i) ||
                        fallbackText.match(/Sponsors:?\s*£?([\d,]+)/i) || 
                        fallbackText.match(/Sponsor\s+Income:?\s*£?([\d,]+)/i) || 
                        fallbackText.match(/Sponsors\s+Mood:?\s*[A-Za-z]+\s+£?([\d,]+)/i);
  if (sponsorsMatch && finances.sponsorsIncome === undefined) finances.sponsorsIncome = parseFormattedNumber(sponsorsMatch[1]);

  const gateMatch = fallbackText.match(/Gate\s+Receipts\s*[:\-]?\s*[$£€]?\s*([\d,]+)/i) || fallbackText.match(/Gate Receipts:?\s*£?([\d,]+)/i);
  if (gateMatch && finances.gateReceipts === undefined) finances.gateReceipts = parseFormattedNumber(gateMatch[1]);

  const interestMatch = fallbackText.match(/Interest\s+Received\s*[:\-]?\s*[$£€]?\s*([\d,]+)/i) || fallbackText.match(/Interest Received:?\s*£?([\d,]+)/i) || fallbackText.match(/Interest:?\s*£?([\d,]+)/i);
  if (interestMatch && finances.interestReceived === undefined) finances.interestReceived = parseFormattedNumber(interestMatch[1]);

  const playerWagesMatch = fallbackText.match(/Player\s+Salaries\s*[:\-]?\s*[$£€]?\s*([\d,]+)/i) || fallbackText.match(/Player Salaries:?\s*£?([\d,]+)/i) || fallbackText.match(/Player Wages:?\s*£?([\d,]+)/i);
  if (playerWagesMatch && finances.playerWages === undefined) finances.playerWages = parseFormattedNumber(playerWagesMatch[1]);

  const staffWagesMatch = fallbackText.match(/Backroom\s+Staff\s+Salaries\s*[:\-]?\s*[$£€]?\s*([\d,]+)/i) || fallbackText.match(/Staff Salaries:?\s*£?([\d,]+)/i) || fallbackText.match(/Staff Wages:?\s*£?([\d,]+)/i);
  if (staffWagesMatch && finances.staffWages === undefined) finances.staffWages = parseFormattedNumber(staffWagesMatch[1]);

  // Multi-word support for morale, mood, and confidence
  const moraleMatch = fallbackText.match(/(?:team\s+morale|club\s+morale)\s*:\s*([A-Za-z\s]+?)(?=\s+(?:club\s+members|members|sponsors|sponsorship|\d|$))/i) || 
                      fallbackText.match(/morale\s*:\s*([A-Za-z\s]+?)(?=\s+(?:club\s+members|members|sponsors|sponsorship|\d|$))/i);
  if (moraleMatch && (finances.morale === undefined || finances.morale === 'respectable')) {
    finances.morale = moraleMatch[1].trim().toLowerCase();
  }

  const sponsorsMoodMatch = fallbackText.match(/(?:sponsors\s+mood|sponsors\s+opinion|sponsors’\s+confidence|sponsors'\s+confidence|sponsors\s+confidence)\s*:\s*([A-Za-z\s]+?)(?=\s+(?:club\s+morale|morale|members|sponsorship|\d|$))/i);
  if (sponsorsMoodMatch && (finances.sponsorsMood === undefined || finances.sponsorsMood === 'respectable')) {
    finances.sponsorsMood = sponsorsMoodMatch[1].trim().toLowerCase();
  }

  const membersConfidenceMatch = fallbackText.match(/(?:members\s+confidence|members’\s+confidence|members'\s+confidence)\s*:\s*([A-Za-z\s]+?)(?=\s+(?:backroom|staff|coaches|\d|$))/i);
  if (membersConfidenceMatch && finances.membersConfidence === undefined) {
    finances.membersConfidence = membersConfidenceMatch[1].trim().toLowerCase();
  }

  const academyConditionMatch = fallbackText.match(/(?:youth\s+academy\s+condition|academy\s+condition)\s*:\s*([A-Za-z\s]+?)(?=\s+(?:academy\s+investment|investment|\d|$))/i);
  if (academyConditionMatch && finances.academyCondition === undefined) {
    finances.academyCondition = academyConditionMatch[1].trim().toLowerCase();
  }

  const academyInvestmentMatch = fallbackText.match(/(?:academy\s+investment)\s*:\s*[$£€]?\s*([\d,]+)/i);
  if (academyInvestmentMatch && finances.academyInvestment === undefined) {
    finances.academyInvestment = parseFormattedNumber(academyInvestmentMatch[1]);
  }

  const academyItsMatch = fallbackText.match(/(?:intensive\s+training\s+sessions|intensive\s+training|its)\s*:\s*(\d+)/i);
  if (academyItsMatch && finances.academyIts === undefined) {
    finances.academyIts = parseInt(academyItsMatch[1], 10);
  }

  return finances;
}

// Battrick training math estimations
export function estimateWeeksToNextLevel(
  currentSkillLevel: number,
  playerAge: number,
  netsCount: number,
  coachLevel: number = 9, // Default Superb Coach
  skillType: 'batting' | 'bowling' | 'keeping' | 'stamina' | 'fielding' = 'batting',
  isSquadTraining: boolean = false
): number {
  // Max skill levels in Battrick: Stamina max is 11 (superb*), other skills max is 20 (elite)
  const maxLevel = skillType === 'stamina' ? 11 : 20;
  if (currentSkillLevel >= maxLevel) return 0;
  if (netsCount <= 0 && !isSquadTraining) return Infinity;

  // 1. Stamina Training:
  // Rule: Squad Training for stamina is a flat 5-6 weeks per pop, and this
  // is IDENTICAL for every player age - unlike one-on-one net training,
  // squad sessions don't scale with player age or decay for veterans.
  if (skillType === 'stamina') {
    let effectiveNets = isSquadTraining && netsCount === 0 ? 1 : netsCount;
    let netMultiplier = 1.0;
    if (effectiveNets === 1) netMultiplier = 1.0;
    else if (effectiveNets === 2) netMultiplier = 1.5;
    else if (effectiveNets >= 3) netMultiplier = 1.75;

    if (isSquadTraining) {
      const weeks = 5.5 / netMultiplier; // flat 5-6 wks, same for all ages
      return parseFloat(weeks.toFixed(1));
    }

    // For ages 17 to 32: Flat 6 weeks per pop with 1 net (individual coaching)
    if (playerAge >= 17 && playerAge <= 32) {
      const weeks = 6.0 / netMultiplier;
      return parseFloat(weeks.toFixed(1));
    }
    
    // For ages 33+: Stamina decay starts affecting individual training speed
    const decayFactor = Math.pow(1.15, playerAge - 32);
    const weeks = (6.0 * decayFactor) / netMultiplier;
    return parseFloat(weeks.toFixed(1));
  }

  // 2. Fielding Training:
  // Rule: Squad Training for fielding is also a flat 5-6 weeks per pop and
  // is IDENTICAL for every player age - same as stamina squad training, it
  // does not scale with coach quality or age the way individual coaching does.
  if (skillType === 'fielding') {
    let effectiveNets = isSquadTraining && netsCount === 0 ? 1 : netsCount;
    let netMultiplier = 1.0;
    if (effectiveNets === 1) netMultiplier = 1.0;
    else if (effectiveNets === 2) netMultiplier = 1.5;
    else if (effectiveNets >= 3) netMultiplier = 1.75;

    const baseFieldingWeeks = 5.5; // 5 to 6 weeks standard

    if (isSquadTraining) {
      const weeks = baseFieldingWeeks / netMultiplier; // flat 5-6 wks, same for all ages
      return parseFloat(weeks.toFixed(1));
    }

    // Individual coached fielding nets still scale with coach quality and age
    const coachFactor = 1.0 / (0.8 + (coachLevel * 0.022));

    if (playerAge <= 30) {
      const weeks = (baseFieldingWeeks * coachFactor) / netMultiplier;
      return parseFloat(weeks.toFixed(1));
    }

    const agePenalty = Math.pow(1.08, playerAge - 30);
    const weeks = (baseFieldingWeeks * agePenalty * coachFactor) / netMultiplier;
    return parseFloat(weeks.toFixed(1));
  }

  // 3. Primary Skills (Batting, Bowling, Keeping):
  // Age factor with 22% decay per year from 17, coach multiplier, and diminishing returns for multiple nets
  const effectiveNets = Math.max(1, netsCount);
  let effectiveNetStrength = 1.0;
  if (effectiveNets === 2) effectiveNetStrength = 1.5;
  else if (effectiveNets >= 3) effectiveNetStrength = 1.75;

  const ageFactor = Math.pow(1.22, Math.max(0, playerAge - 17));
  const coachFactor = 1.0 / (0.6 + (coachLevel * 0.044));
  const skillFactor = 4.0 + (currentSkillLevel * 0.14);
  const totalWeeks = (skillFactor * ageFactor * coachFactor) / effectiveNetStrength;

  return parseFloat(totalWeeks.toFixed(1));
}

// Helper utilities for quick Stamina & Fielding calculations
export function getStaminaPopWeeks(playerAge: number, netsCount: number = 1, isSquadTraining: boolean = false): number {
  return estimateWeeksToNextLevel(0, playerAge, netsCount, 9, 'stamina', isSquadTraining);
}

export function getFieldingPopWeeks(playerAge: number, netsCount: number = 1, isSquadTraining: boolean = false, coachLevel: number = 9): number {
  return estimateWeeksToNextLevel(0, playerAge, netsCount, coachLevel, 'fielding', isSquadTraining);
}

// Weighted squad player score calculation matching popup.js criteria
export function getPlayerWeightedScore(player: BattrickPlayer): number {
  const { batting, bowling, keeping, stamina, experience, concentration, consistency } = player.skills;

  let score = 0;
  switch (player.role) {
    case 'Batter':
      score = batting * 1.0 + concentration * 0.35 + consistency * 0.25 + stamina * 0.15 + experience * 0.15;
      break;
    case 'Bowler':
      score = bowling * 1.0 + consistency * 0.35 + concentration * 0.15 + stamina * 0.20 + experience * 0.15;
      break;
    case 'Keeper':
      score = keeping * 1.0 + batting * 0.40 + concentration * 0.20 + stamina * 0.15 + experience * 0.15;
      break;
    case 'All-rounder':
      score = batting * 0.70 + bowling * 0.70 + consistency * 0.20 + concentration * 0.20 + stamina * 0.15 + experience * 0.15;
      break;
    default:
      score = Math.max(batting, bowling, keeping) * 1.0 + stamina * 0.20 + experience * 0.10;
  }

  const formMultiplier = 0.7 + (player.form * 0.05);
  const fitnessMultiplier = 0.7 + (player.fitness * 0.05);

  return parseFloat((score * formMultiplier * fitnessMultiplier).toFixed(1));
}

// Battrick squad trade/planning advice formulas (from HOLD/DEVELOP/TRADE decisions)
export function getTradeAction(player: BattrickPlayer): { action: 'HOLD' | 'DEVELOP' | 'TRADE' | 'PEAK'; reason: string } {
  const primary = Math.max(player.skills.batting, player.skills.bowling, player.skills.keeping);
  
  if (player.age <= 19) {
    if (primary >= 5) {
      return { action: 'DEVELOP', reason: 'High talent young prospect. Prioritize full training nets immediately.' };
    }
    return { action: 'DEVELOP', reason: 'Young talent, great backup. Needs Nets to reach senior levels.' };
  }

  if (player.age >= 32) {
    return { action: 'TRADE', reason: 'Veteran player experiencing skill decay and wage cost penalty. Sell before worth drops.' };
  }

  if (player.age >= 27 && player.age <= 31) {
    return { action: 'PEAK', reason: 'Peak career age. Perfect for match XI, do not train further.' };
  }

  if (primary >= 12) {
    return { action: 'HOLD', reason: 'Exceptional senior player. Keep in squad core or use as trade leverage.' };
  }

  if (primary < 8) {
    return { action: 'TRADE', reason: 'Sub-optimal skill levels for career age. Trade for younger prospects.' };
  }

  return { action: 'HOLD', reason: 'Solid squad utility player. Reliable backing for matches.' };
}

export function parseFixtures(content: string): BattrickGame[] {
  const games: BattrickGame[] = [];
  
  // 1. Modern Battrick HTML List Parsing (<ul class="fixtures..."> or <li data-class="...">)
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // First, scan for team names across the document to determine the user's primary team name
    const teamCounts: Record<string, number> = {};
    const matchLinks = doc.querySelectorAll('a[href*="matchinfo.asp?matchID="]');
    
    matchLinks.forEach(link => {
      const text = link.textContent?.trim() || '';
      if (text.includes(' v ') || text.includes(' vs ')) {
        const parts = text.split(/\s+(?:v|vs)\s+/i);
        if (parts.length === 2) {
          const t1 = parts[0].trim();
          const t2 = parts[1].trim();
          teamCounts[t1] = (teamCounts[t1] || 0) + 1;
          teamCounts[t2] = (teamCounts[t2] || 0) + 1;
        }
      }
    });

    let detectedUserTeam = localStorage.getItem('bt_team_name') || '';
    let maxCount = 0;
    for (const [tName, count] of Object.entries(teamCounts)) {
      if (count > maxCount && tName.length > 2) {
        maxCount = count;
        detectedUserTeam = tName;
      }
    }

    if (detectedUserTeam && detectedUserTeam !== 'My Club') {
      try {
        localStorage.setItem('bt_team_name', detectedUserTeam);
      } catch (e) {}
    }

    // Parse list items
    const fixtureItems = doc.querySelectorAll('li[data-class], ul.fixtures > li, li:has(a[href*="matchinfo.asp"])');
    
    if (fixtureItems.length > 0) {
      fixtureItems.forEach(item => {
        // Extract format from data-class or inner links
        const dataClass = item.getAttribute('data-class') || '';
        let type = 'One Day';
        if (dataClass === 'Cup') type = 'Cup';
        else if (dataClass === 'FC') type = 'First Class';
        else if (dataClass === 'BT20') type = 'Twenty20';
        else if (dataClass === 'OD') type = 'One Day';
        else if (item.textContent?.includes('First Class') || item.textContent?.includes('(FC)')) type = 'First Class';
        else if (item.textContent?.includes('BT20') || item.textContent?.includes('Twenty20')) type = 'Twenty20';
        else if (item.textContent?.includes('Cup')) type = 'Cup';

        // Extract Date & Time from preceding span.altcol or inner text
        let date = 'Upcoming';
        let time = '';
        let altSpan = item.querySelector('span.altcol') || item.previousElementSibling;
        if (altSpan && altSpan.tagName === 'SPAN' && altSpan.classList.contains('altcol')) {
          const dateMatch = altSpan.textContent?.match(/(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/);
          if (dateMatch) {
            date = dateMatch[1];
            if (dateMatch[2]) time = dateMatch[2];
          }
        }
        if (date === 'Upcoming') {
          const innerDateMatch = item.textContent?.match(/(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/);
          if (innerDateMatch) {
            date = innerDateMatch[1];
            if (innerDateMatch[2]) time = innerDateMatch[2];
          }
        }

        // Extract Match Info Link & Match ID
        const matchLink = item.querySelector('a[href*="matchinfo.asp?matchID="]');
        let matchId = '';
        let matchUrl = '';
        let matchTitle = '';
        if (matchLink) {
          const href = matchLink.getAttribute('href') || '';
          const mIdMatch = href.match(/matchID=(\d+)/i);
          if (mIdMatch) matchId = mIdMatch[1];
          matchUrl = `https://www.battrick.org/nl/${href.replace(/^\//, '')}`;
          matchTitle = matchLink.textContent?.trim() || '';
        }

        // Extract Orders Link
        const ordersLink = item.querySelector('a[href*="matchorders.asp"]');
        let ordersUrl = '';
        if (ordersLink) {
          const href = ordersLink.getAttribute('href') || '';
          ordersUrl = `https://www.battrick.org/nl/${href.replace(/^\//, '')}`;
        } else if (matchId) {
          ordersUrl = `https://www.battrick.org/nl/matchorders.asp?matchID=${matchId}`;
        }

        // Check if opponent is bot
        const botEl = item.querySelector('span.bot') || item.querySelector('.bot');
        const isBot = Boolean(botEl || item.textContent?.includes('unmanaged (bot)') || item.textContent?.includes('(bot)'));

        // Parse Teams, Opponent, and Venue
        let homeTeam = 'Home Team';
        let awayTeam = 'Away Team';
        let opponent = 'Opponent';
        let venue: 'Home' | 'Away' = 'Home';

        if (matchTitle.includes(' v ') || matchTitle.includes(' vs ')) {
          const teams = matchTitle.split(/\s+(?:v|vs)\s+/i);
          homeTeam = teams[0].trim();
          awayTeam = teams[1].trim();

          if (detectedUserTeam) {
            if (homeTeam.toLowerCase().includes(detectedUserTeam.toLowerCase())) {
              opponent = awayTeam;
              venue = 'Home';
            } else if (awayTeam.toLowerCase().includes(detectedUserTeam.toLowerCase())) {
              opponent = homeTeam;
              venue = 'Away';
            } else {
              opponent = awayTeam;
              venue = 'Home';
            }
          } else {
            opponent = awayTeam;
            venue = 'Home';
          }
        }

        games.push({
          matchId: matchId || undefined,
          matchUrl: matchUrl || undefined,
          ordersUrl: ordersUrl || undefined,
          date,
          time: time || undefined,
          opponent,
          homeTeam,
          awayTeam,
          type,
          venue,
          result: 'Upcoming',
          isBot
        });
      });
    }

    // 2. Table rows fallback
    if (games.length === 0) {
      const rows = doc.querySelectorAll('tr');
      rows.forEach(row => {
        const text = row.textContent || '';
        const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          const date = dateMatch[1];
          const cells = Array.from(row.querySelectorAll('td')).map(c => c.textContent?.trim() || '');
          if (cells.length >= 3) {
            const opponent = cells[1] || 'Unknown Opponent';
            const type = cells[2] || 'One Day';
            const venueOrResult = cells[3] || 'Home';
            const venue: 'Home' | 'Away' = venueOrResult.toLowerCase().includes('away') ? 'Away' : 'Home';
            const result = cells[4] || (venueOrResult.includes('won') || venueOrResult.includes('lost') ? venueOrResult : 'Upcoming');
            
            const matchLink = row.querySelector('a[href*="matchinfo.asp"]');
            let matchId = '';
            let matchUrl = '';
            if (matchLink) {
              const href = matchLink.getAttribute('href') || '';
              const mId = href.match(/matchID=(\d+)/i);
              if (mId) matchId = mId[1];
              matchUrl = `https://www.battrick.org/nl/${href}`;
            }

            games.push({ 
              matchId: matchId || undefined,
              matchUrl: matchUrl || undefined,
              date, 
              opponent, 
              type, 
              venue, 
              result 
            });
          }
        }
      });
    }
  } catch (e) {
    console.error('Fixtures DOMParser error:', e);
  }

  // 3. Line-by-Line Regex parsing fallback for plain text
  if (games.length === 0) {
    const lines = content.split('\n');
    lines.forEach(line => {
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/);
      if (dateMatch) {
        const date = dateMatch[1];
        const time = dateMatch[2] || '';
        const cleaned = line.replace(date, '').replace(time, '').replace(/\s+/g, ' ').trim();
        const type = cleaned.includes('First Class') || cleaned.includes('FC') ? 'First Class' : cleaned.includes('Twenty20') || cleaned.includes('BT20') ? 'Twenty20' : cleaned.includes('Cup') ? 'Cup' : 'One Day';
        const venue: 'Home' | 'Away' = cleaned.toLowerCase().includes('away') ? 'Away' : 'Home';
        
        let opponent = 'Opponent Club';
        const vsMatch = cleaned.match(/([A-Za-z0-9\s.\-']+)\s+(?:vs|v|@)\s+([A-Za-z0-9\s.\-']+)/i);
        if (vsMatch) {
          opponent = vsMatch[2].split('(')[0].trim();
        }

        const matchIdMatch = line.match(/matchID=(\d+)/i) || line.match(/ID[:\s]+(\d+)/i);
        const matchId = matchIdMatch ? matchIdMatch[1] : undefined;

        let result = 'Upcoming';
        if (cleaned.toLowerCase().includes('won')) result = 'Won';
        else if (cleaned.toLowerCase().includes('lost')) result = 'Lost';

        games.push({ 
          matchId,
          matchUrl: matchId ? `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}` : undefined,
          ordersUrl: matchId ? `https://www.battrick.org/nl/matchorders.asp?matchID=${matchId}` : undefined,
          date, 
          time: time || undefined,
          opponent, 
          type, 
          venue, 
          result 
        });
      }
    });
  }

  if (games.length > 0) {
    try {
      localStorage.setItem('bt_fixtures', JSON.stringify(games));
    } catch (e) {}
    return games;
  }

  // Fallback demo games if completely empty
  return [
    { matchId: '32557622', matchUrl: 'https://www.battrick.org/nl/matchinfo.asp?matchID=32557622', ordersUrl: 'https://www.battrick.org/nl/matchorders.asp?matchID=32557622', date: '06/09/2026', time: '00:30', opponent: 'Steve', homeTeam: 'Steve', awayTeam: 'HairyBeanBags', type: 'Cup', venue: 'Away', result: 'Upcoming' },
    { matchId: '32194563', matchUrl: 'https://www.battrick.org/nl/matchinfo.asp?matchID=32194563', ordersUrl: 'https://www.battrick.org/nl/matchorders.asp?matchID=32194563', date: '08/09/2026', time: '00:30', opponent: 'Sandshoe Crushers', homeTeam: 'Sandshoe Crushers', awayTeam: 'HairyBeanBags', type: 'First Class', venue: 'Away', result: 'Upcoming' },
    { matchId: '32161741', matchUrl: 'https://www.battrick.org/nl/matchinfo.asp?matchID=32161741', ordersUrl: 'https://www.battrick.org/nl/matchorders.asp?matchID=32161741', date: '11/09/2026', time: '00:30', opponent: 'Bulolo Seahawks', homeTeam: 'HairyBeanBags', awayTeam: 'Bulolo Seahawks', type: 'One Day', venue: 'Home', result: 'Upcoming', isBot: true },
    { matchId: '32383795', matchUrl: 'https://www.battrick.org/nl/matchinfo.asp?matchID=32383795', ordersUrl: 'https://www.battrick.org/nl/matchorders.asp?matchID=32383795', date: '15/09/2026', time: '11:45', opponent: 'Royal West Herts GC', homeTeam: 'Royal West Herts GC', awayTeam: 'HairyBeanBags', type: 'Twenty20', venue: 'Away', result: 'Upcoming' },
    { matchId: '32383799', matchUrl: 'https://www.battrick.org/nl/matchinfo.asp?matchID=32383799', ordersUrl: 'https://www.battrick.org/nl/matchorders.asp?matchID=32383799', date: '16/09/2026', time: '00:30', opponent: 'Atlanta Braves', homeTeam: 'Atlanta Braves', awayTeam: 'HairyBeanBags', type: 'Twenty20', venue: 'Away', result: 'Upcoming' }
  ];
}

export function parsePavilion(content: string): PavilionInfo {
  const normalized = content.replace(/\s+/g, ' ');
  const lower = content.toLowerCase();
  
  let groundName = '';
  let groundId = '';
  let pitchType = '';
  let weather = '';
  let established = '';
  let membershipStatus = '';
  let generalManager = '';
  let gmUserId = '';
  let country = '';
  let countryId = '';
  let region = '';
  let regionId = '';
  let firstClassLeague: LeagueLinkInfo | undefined = undefined;
  let oneDayLeague: LeagueLinkInfo | undefined = undefined;
  let bt20League: LeagueLinkInfo | undefined = undefined;
  let teamRankingNational = '';
  let teamRankingWorld = '';

  // Helper to extract value if the cell itself has the label and value after a colon/dash
  const extractValueFromCell = (labelTextRegex: RegExp, text: string, nextText: string): string => {
    const match = text.match(new RegExp(`${labelTextRegex.source}:?\\s*(.+)`, 'i'));
    if (match && match[1].trim()) {
      return match[1].trim();
    }
    return nextText || '';
  };

  // 1. DOM HTML Parsing if possible
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const cells = Array.from(doc.querySelectorAll('td, th, div, span, p'));
    
    for (let i = 0; i < cells.length; i++) {
      const text = cells[i].textContent?.trim() || '';
      const nextText = cells[i + 1]?.textContent?.trim() || '';
      
      if (/ground\s+name/i.test(text) || /ground:/i.test(text)) {
        const val = extractValueFromCell(/ground(?:\s+name)?:?/i, text, nextText);
        if (val && !groundName) groundName = val;
      }
      if (/pitch\s+type/i.test(text)) {
        const val = extractValueFromCell(/pitch\s+type/i, text, nextText);
        if (val && !pitchType) pitchType = val;
      }
      if (/weather/i.test(text)) {
        const val = extractValueFromCell(/weather/i, text, nextText);
        if (val && !weather) weather = val;
      }
      if (/established/i.test(text)) {
        const val = extractValueFromCell(/established/i, text, nextText);
        if (val && !established) established = val;
      }
      if (/membership\s+status/i.test(text)) {
        const val = extractValueFromCell(/membership\s+status/i, text, nextText);
        if (val && !membershipStatus) membershipStatus = val;
      }
    }
  } catch (e) {
    console.error('Pavilion DOMParser error:', e);
  }

  // 2. Specific Office & Pavilion Extraction
  // General Manager & User ID
  const gmMatch = content.match(/General Manager:?[\s\S]*?<a[^>]*userID=(\d+)[^>]*>([^<]+)<\/a>/i) ||
                  content.match(/myoffice\.asp\?userID=(\d+)[^>]*>([^<]+)</i);
  if (gmMatch) {
    gmUserId = gmMatch[1];
    generalManager = gmMatch[2].trim();
  } else {
    const textGm = normalized.match(/General Manager:?\s*([A-Za-z0-9_\-]+)\s*\((?:\d+)\)/i);
    if (textGm) generalManager = textGm[1];
  }

  // Country
  const countryMatch = content.match(/country\.asp\?countryID=(\d+)[^>]*>([^<]+)</i) ||
                        normalized.match(/Country:?\s*([A-Za-z\s]+)/i);
  if (countryMatch) {
    if (countryMatch[2]) {
      countryId = countryMatch[1];
      country = countryMatch[2].trim();
    } else {
      country = countryMatch[1].trim();
    }
  }

  // Region
  const regionMatch = content.match(/regiondetails\.asp\?regionID=(\d+)[^>]*>([^<]+)</i) ||
                      normalized.match(/Region:?\s*([A-Za-z\s]+)/i);
  if (regionMatch) {
    if (regionMatch[2]) {
      regionId = regionMatch[1];
      region = regionMatch[2].trim();
    } else {
      region = regionMatch[1].trim();
    }
  }

  // First Class League
  const fcMatch = content.match(/First Class League:?[\s\S]*?(#\d+)?\s*in\s*<a[^>]*leagueID=(\d+)[^>]*>([^<]+)<\/a>/i) ||
                  normalized.match(/First Class League:?\s*(#\d+)?\s*in\s*([A-Za-z0-9.]+)\s*\((?:ID:?\s*)?(\d+)\)/i);
  if (fcMatch) {
    const rank = fcMatch[1] || '';
    const lId = fcMatch[2] && !isNaN(Number(fcMatch[2])) ? fcMatch[2] : fcMatch[3] || '';
    const lName = fcMatch[3] && isNaN(Number(fcMatch[3])) ? fcMatch[3].trim() : fcMatch[2] || '';
    firstClassLeague = {
      rankText: rank,
      leagueId: lId,
      name: lName,
      url: `https://www.battrick.org/nl/leagues.asp?leagueID=${lId}`
    };
  }

  // One Day League
  const odMatch = content.match(/One Day League:?[\s\S]*?(#\d+)?\s*in\s*<a[^>]*leagueID=(\d+)[^>]*>([^<]+)<\/a>/i) ||
                  normalized.match(/One Day League:?\s*(#\d+)?\s*in\s*([A-Za-z0-9.]+)\s*\((?:ID:?\s*)?(\d+)\)/i);
  if (odMatch) {
    const rank = odMatch[1] || '';
    const lId = odMatch[2] && !isNaN(Number(odMatch[2])) ? odMatch[2] : odMatch[3] || '';
    const lName = odMatch[3] && isNaN(Number(odMatch[3])) ? odMatch[3].trim() : odMatch[2] || '';
    oneDayLeague = {
      rankText: rank,
      leagueId: lId,
      name: lName,
      url: `https://www.battrick.org/nl/leagues.asp?leagueID=${lId}`
    };
  }

  // BT20 League
  const t20Match = content.match(/BT20:?[\s\S]*?(#\d+)?\s*in\s*<a[^>]*leagueID=(\d+)[^>]*>([^<]+)<\/a>/i) ||
                   normalized.match(/BT20:?\s*(#\d+)?\s*in\s*([A-Za-z0-9.]+)\s*\((?:ID:?\s*)?(\d+)\)/i);
  if (t20Match) {
    const rank = t20Match[1] || '';
    const lId = t20Match[2] && !isNaN(Number(t20Match[2])) ? t20Match[2] : t20Match[3] || '';
    const lName = t20Match[3] && isNaN(Number(t20Match[3])) ? t20Match[3].trim() : t20Match[2] || '';
    bt20League = {
      rankText: rank,
      leagueId: lId,
      name: lName,
      url: `https://www.battrick.org/nl/leagues.asp?leagueID=${lId}`
    };
  }

  // Team Rankings
  const natRankMatch = content.match(/(#\d+\s+in\s+[A-Za-z\s]+)/i);
  if (natRankMatch) teamRankingNational = natRankMatch[1].trim();

  const worldRankMatch = content.match(/(#\d+\s+in\s+the\s+World)/i);
  if (worldRankMatch) teamRankingWorld = worldRankMatch[1].trim();

  // Ground ID
  const groundLinkMatch = content.match(/ground\.asp\?groundID=(\d+)[^>]*>([^<]+)</i);
  if (groundLinkMatch) {
    groundId = groundLinkMatch[1];
    if (!groundName) groundName = groundLinkMatch[2].trim();
  }

  // Text-Based Fallbacks
  const groundMatch = normalized.match(/Ground(?:\s+Name)?:?\s*([A-Za-z0-9\s',.\-]+?)(?:Pitch|Established|Capacity|Weather|First Class|One Day|BT20|$)/i) || normalized.match(/Stadium(?:\s+Name)?:?\s*([A-Za-z0-9\s',.\-]+?)(?:Pitch|Established|Capacity|Weather|$)/i);
  if (groundMatch && !groundName) groundName = groundMatch[1].trim();

  const pitchMatch = normalized.match(/Pitch(?:\s+Type)?:?\s*(Flat|Hard|Green|Dusty|Cracked|Uneven)/i) || normalized.match(/Pitch:?\s*([A-Za-z]+)/i);
  if (pitchMatch && !pitchType) pitchType = pitchMatch[1].trim();

  const weatherMatch = normalized.match(/Weather:?\s*(Sunny|Cloudy|Windy|Overcast|Humid|Misty|Drizzle|Rain)/i) || normalized.match(/Weather:?\s*([A-Za-z]+)/i);
  if (weatherMatch && !weather) weather = weatherMatch[1].trim();

  const estMatch = normalized.match(/Established:?\s*([A-Za-z0-9\s,.\-]+)/i) || normalized.match(/Est:?\s*([0-9/]+)/i);
  if (estMatch && !established) established = estMatch[1].trim();

  const membershipMatch = normalized.match(/Membership Status:?\s*([A-Za-z\s]+)/i) || normalized.match(/Membership:?\s*([A-Za-z\s]+)/i);
  if (membershipMatch && !membershipStatus) membershipStatus = membershipMatch[1].trim();

  const result: PavilionInfo = {
    groundName: groundName || 'HairyBeanBags CG',
    groundId,
    weather: weather || 'Sunny',
    established: established || 'Season 42',
    membershipStatus: membershipStatus || 'Elite Manager',
    generalManager: generalManager || 'Browny33',
    gmUserId: gmUserId || '132175',
    country: country || 'Australia',
    countryId: countryId || '2',
    region: region || 'Queensland',
    regionId: regionId || '21',
    firstClassLeague: firstClassLeague || { name: 'V.7', rankText: '#6', leagueId: '2749', url: 'https://www.battrick.org/nl/leagues.asp?leagueID=2749' },
    oneDayLeague: oneDayLeague || { name: 'IV.2', rankText: '#2', leagueId: '212', url: 'https://www.battrick.org/nl/leagues.asp?leagueID=212' },
    bt20League: bt20League || { name: 'IV.51', rankText: '#7', leagueId: '7532', url: 'https://www.battrick.org/nl/leagues.asp?leagueID=7532' },
    teamRankingNational: teamRankingNational || '#170 in Australia',
    teamRankingWorld: teamRankingWorld || '#1202 in the World'
  };

  if (pitchType) {
    result.pitchType = pitchType;
  }

  return result;
}

export function parseGroundPavilionInfo(content: string): Partial<PavilionInfo> {
  let groundName = '';
  let pitchType = '';
  const normalized = content.replace(/\s+/g, ' ');
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const heading = doc.querySelector('h2.subheadernew');
    if (heading) {
      groundName = heading.textContent?.trim() || '';
    }

    // Scan cells for pitch type
    const cells = Array.from(doc.querySelectorAll('td, th'));
    for (let i = 0; i < cells.length; i++) {
      const text = cells[i].textContent?.trim() || '';
      const nextText = cells[i + 1]?.textContent?.trim() || '';
      if (/pitch(?:\s+type|\s+state|\s+preparation)?/i.test(text) && !/standing|uncovered|covered|members|capacity/i.test(text)) {
        const cleanVal = nextText.trim();
        if (/Flat|Hard|Green|Dusty|Cracked|Uneven/i.test(cleanVal)) {
          pitchType = cleanVal;
        }
      }
    }
  } catch (e) {
    console.error('parseGroundPavilionInfo DOMParser error:', e);
  }

  if (!groundName) {
    const nameMatch = content.match(/<h2[^>]*class="subheadernew"[^>]*>([^<]+)<\/h2>/i) || content.match(/H2\s+ID=".*"\s+class="subheadernew">(.*)<\/H2>/i);
    if (nameMatch) {
      groundName = nameMatch[1].trim();
    }
  }

  // Also search for general headers if pasted plain text
  if (!groundName) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('» Ground') || line.includes('CG (')) {
        groundName = line.replace('» Ground', '').replace('&#187; Ground', '').trim();
        break;
      }
    }
  }

  // Fallback match for pitch type
  if (!pitchType) {
    const pitchMatch = normalized.match(/Pitch(?:\s+Type|\s+state|\s+preparation)?:?\s*(Flat|Hard|Green|Dusty|Cracked|Uneven)/i) || normalized.match(/Pitch:?\s*(Flat|Hard|Green|Dusty|Cracked|Uneven)/i);
    if (pitchMatch) {
      pitchType = pitchMatch[1].trim();
    }
  }

  return {
    groundName: groundName || 'HairyBeanBags CG',
    pitchType: pitchType || undefined
  };
}

export function parseGround(content: string): StadiumConfig {
  let terracing = 0;
  let grass = 0;
  let seats = 0;
  let boxes = 0;
  let capacity = 0;

  // 1. DOM HTML Parsing if possible
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    // First remove unwanted menu bar, sidebars, headers and footers to prevent matching non-body table cells
    doc.querySelectorAll('#menubar, #rightmenu, .menu, .submenu, #topmenu, .menu-box, #header, #footer').forEach(el => el.remove());
    
    // Scan all table cells
    const cells = Array.from(doc.querySelectorAll('td, th'));
    for (let i = 0; i < cells.length; i++) {
      const text = cells[i].textContent?.trim() || '';
      const nextText = cells[i + 1]?.textContent?.trim() || '';
      
      if (/standing\s+room|terracing/i.test(text)) {
        const val = parseFormattedNumber(nextText);
        if (val > 0 && !terracing) terracing = val;
      } else if (/uncovered\s+seats|uncovered\s+seating/i.test(text)) {
        const val = parseFormattedNumber(nextText);
        if (val > 0 && !grass) grass = val;
      } else if (/covered\s+seats|covered\s+seating/i.test(text)) {
        const val = parseFormattedNumber(nextText);
        if (val > 0 && !seats) seats = val;
      } else if (/members\s+seats|members\s+seating/i.test(text)) {
        const val = parseFormattedNumber(nextText);
        if (val > 0 && !boxes) boxes = val;
      } else if (/seating\s+capacity|capacity/i.test(text) && !/seating\s+capacity\s+is/i.test(text)) {
        const val = parseFormattedNumber(nextText);
        if (val > 0 && !capacity) capacity = val;
      }
    }
  } catch (e) {
    console.error('Ground DOMParser error:', e);
  }

  // 2. Text-Based Fallbacks if DOMParser didn't get all of them, supporting comma-formatted numbers
  const normalized = content.replace(/\s+/g, ' ');

  if (!terracing) {
    const match = normalized.match(/standing\s+room[:\s]*([\d,]+)/i) || normalized.match(/terracing[:\s]*([\d,]+)/i);
    if (match) terracing = parseFormattedNumber(match[1]);
  }
  if (!grass) {
    const match = normalized.match(/uncovered\s+seats[:\s]*([\d,]+)/i) || normalized.match(/uncovered\s+seating[:\s]*([\d,]+)/i);
    if (match) grass = parseFormattedNumber(match[1]);
  }
  if (!seats) {
    const match = normalized.match(/covered\s+seats[:\s]*([\d,]+)/i) || normalized.match(/covered\s+seating[:\s]*([\d,]+)/i);
    if (match) seats = parseFormattedNumber(match[1]);
  }
  if (!boxes) {
    const match = normalized.match(/members\s+seats[:\s]*([\d,]+)/i) || normalized.match(/members\s+seating[:\s]*([\d,]+)/i);
    if (match) boxes = parseFormattedNumber(match[1]);
  }
  if (!capacity) {
    const match = normalized.match(/seating\s+capacity[:\s]*([\d,]+)/i) || normalized.match(/capacity[:\s]*([\d,]+)/i);
    if (match) capacity = parseFormattedNumber(match[1]);
  }

  // If capacity is missing, sum them up
  if (!capacity) {
    capacity = terracing + grass + seats + boxes;
  }

  return {
    terracing: terracing || 8000,
    grass: grass || 4000,
    seats: seats || 1800,
    boxes: boxes || 200,
    capacity: capacity || (terracing + grass + seats + boxes) || 14000
  };
}

// -------------------------------------------------------------
// OPPONENT SCOUTING & MATCH ANALYSIS PARSER AND TACTICAL ENGINE
// -------------------------------------------------------------

import { OpponentPlayer, OpponentScoutDossier, OpponentVulnerability, PitchType, WeatherType, MatchFormat } from './types';

// Generate realistic opponent roster for any real club from the user's fixture list
export function generateRealisticOpponentRoster(
  teamName: string = 'Opposition XI',
  isBot?: boolean,
  matchFormat: MatchFormat = 'One Day',
  forcedTeamId?: string
): OpponentPlayer[] {
  const lower = teamName.toLowerCase();
  let baseRoster: any[] = [];

  // 1. Bluejays Special Team (ID: 24514)
  if (lower.includes('bluejays') || forcedTeamId === '24514') {
    baseRoster = [
      { id: 'bj_1', name: 'Grady Bailham', age: 30, wage: 81398, btRating: 182740, role: 'Bowler', bowlingType: 'RF', batting: 3, bowling: 16, keeping: 1, stamina: 8, experience: 11, concentration: 5, consistency: 15, fielding: 9, order: 1, battingAverage: 12.4, bowlingAverage: 24.8 },
      { id: 'bj_2', name: 'Marcus Finch (wk)', age: 28, wage: 62500, btRating: 142000, role: 'Keeper', bowlingType: 'None', batting: 13, bowling: 1, keeping: 14, stamina: 9, experience: 10, concentration: 12, consistency: 11, fielding: 10, order: 2, battingAverage: 52.4, bowlingAverage: 0 },
      { id: 'bj_3', name: 'Harvey Rutherford (c)', age: 32, wage: 88400, btRating: 195000, role: 'Batter', bowlingType: 'RM', batting: 16, bowling: 2, keeping: 1, stamina: 10, experience: 13, concentration: 15, consistency: 14, fielding: 9, order: 3, battingAverage: 64.8, bowlingAverage: 0 },
      { id: 'bj_4', name: 'Liam Henderson', age: 25, wage: 45000, btRating: 112000, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 2, keeping: 1, stamina: 8, experience: 7, concentration: 11, consistency: 10, fielding: 8, order: 4, battingAverage: 48.5, bowlingAverage: 0 },
      { id: 'bj_5', name: 'Owen Barlow', age: 26, wage: 52000, btRating: 124000, role: 'All-rounder', bowlingType: 'OB', batting: 11, bowling: 11, keeping: 1, stamina: 8, experience: 8, concentration: 10, consistency: 11, fielding: 8, order: 5, battingAverage: 36.2, bowlingAverage: 26.8 },
      { id: 'bj_6', name: 'Dominic Shaw', age: 29, wage: 59000, btRating: 135000, role: 'Batter', bowlingType: 'None', batting: 13, bowling: 1, keeping: 1, stamina: 9, experience: 10, concentration: 12, consistency: 11, fielding: 8, order: 6, battingAverage: 51.2, bowlingAverage: 0 },
      { id: 'bj_7', name: 'Jude Sterling', age: 24, wage: 28000, btRating: 85000, role: 'Bowler', bowlingType: 'LF', batting: 4, bowling: 11, keeping: 1, stamina: 7, experience: 6, concentration: 4, consistency: 10, fielding: 7, order: 7, battingAverage: 11.5, bowlingAverage: 24.2 },
      { id: 'bj_8', name: 'Nathaniel Vance', age: 27, wage: 34000, btRating: 98000, role: 'Bowler', bowlingType: 'RFM', batting: 3, bowling: 12, keeping: 1, stamina: 8, experience: 7, concentration: 3, consistency: 11, fielding: 7, order: 8, battingAverage: 9.8, bowlingAverage: 22.8 },
      { id: 'bj_9', name: 'Zackary Cox', age: 22, wage: 19500, btRating: 72000, role: 'Bowler', bowlingType: 'OB', batting: 2, bowling: 10, keeping: 1, stamina: 7, experience: 4, concentration: 3, consistency: 9, fielding: 6, order: 9, battingAverage: 6.4, bowlingAverage: 25.1 },
      { id: 'bj_10', name: 'Finley Ross', age: 31, wage: 48000, btRating: 115000, role: 'Bowler', bowlingType: 'SLA', batting: 2, bowling: 13, keeping: 1, stamina: 8, experience: 11, concentration: 2, consistency: 12, fielding: 8, order: 10, battingAverage: 7.2, bowlingAverage: 19.8 },
      { id: 'bj_11', name: 'Albie Cross', age: 21, wage: 9200, btRating: 42000, role: 'Bowler', bowlingType: 'LFM', batting: 2, bowling: 8, keeping: 1, stamina: 6, experience: 3, concentration: 2, consistency: 7, fielding: 6, order: 11, battingAverage: 5.5, bowlingAverage: 29.5 }
    ];
  } else if (lower.includes('steve')) {
    // Cup Match 32557622 opponent: Steve
    baseRoster = [
      { id: 'steve_1', name: 'Steve Davies (c)', age: 27, wage: 16500, btRating: 48200, role: 'Batter', bowlingType: 'RM', batting: 13, bowling: 2, keeping: 1, stamina: 8, experience: 9, concentration: 12, consistency: 9, fielding: 7, order: 1 },
      { id: 'steve_2', name: 'R. Jenkins', age: 24, wage: 12800, btRating: 39500, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 2, keeping: 1, stamina: 7, experience: 6, concentration: 11, consistency: 8, fielding: 7, order: 2 },
      { id: 'steve_3', name: 'P. Thorne', age: 29, wage: 19400, btRating: 54000, role: 'Batter', bowlingType: 'RM', batting: 14, bowling: 3, keeping: 1, stamina: 9, experience: 10, concentration: 13, consistency: 10, fielding: 8, order: 3 },
      { id: 'steve_4', name: 'L. Morrison', age: 23, wage: 11200, btRating: 35000, role: 'All-rounder', bowlingType: 'RFM', batting: 10, bowling: 9, keeping: 1, stamina: 8, experience: 5, concentration: 9, consistency: 9, fielding: 7, order: 4 },
      { id: 'steve_5', name: 'G. Fletcher (wk)', age: 26, wage: 9800, btRating: 29000, role: 'Keeper', bowlingType: 'RM', batting: 9, bowling: 1, keeping: 11, stamina: 7, experience: 7, concentration: 8, consistency: 8, fielding: 8, order: 5 },
      { id: 'steve_6', name: 'C. Bartlett', age: 28, wage: 7500, btRating: 22000, role: 'Batter', bowlingType: 'RM', batting: 8, bowling: 2, keeping: 1, stamina: 6, experience: 7, concentration: 7, consistency: 6, fielding: 6, order: 6 },
      { id: 'steve_7', name: 'N. Vaughan', age: 25, wage: 6200, btRating: 18500, role: 'Bowler', bowlingType: 'RF', batting: 4, bowling: 11, keeping: 1, stamina: 7, experience: 6, concentration: 4, consistency: 11, fielding: 6, order: 7 },
      { id: 'steve_8', name: 'T. Underwood', age: 26, wage: 6800, btRating: 19800, role: 'Bowler', bowlingType: 'OB', batting: 3, bowling: 12, keeping: 1, stamina: 7, experience: 6, concentration: 3, consistency: 11, fielding: 6, order: 8 },
      { id: 'steve_9', name: 'M. Gallagher', age: 22, wage: 5400, btRating: 16000, role: 'Bowler', bowlingType: 'LF', batting: 3, bowling: 10, keeping: 1, stamina: 7, experience: 4, concentration: 3, consistency: 10, fielding: 6, order: 9 },
      { id: 'steve_10', name: 'D. Prentice', age: 30, wage: 6100, btRating: 17500, role: 'Bowler', bowlingType: 'LM', batting: 2, bowling: 11, keeping: 1, stamina: 6, experience: 8, concentration: 2, consistency: 11, fielding: 6, order: 10 },
      { id: 'steve_11', name: 'K. O\'Shea', age: 21, wage: 2800, btRating: 8500, role: 'Bowler', bowlingType: 'RM', batting: 2, bowling: 6, keeping: 1, stamina: 5, experience: 3, concentration: 2, consistency: 6, fielding: 5, order: 11 },
    ];
  } else if (lower.includes('sandshoe')) {
    // First Class Match 32194563 opponent: Sandshoe Crushers
    baseRoster = [
      { id: 'sc_1', name: 'D. Miller', age: 28, wage: 18500, btRating: 52000, role: 'Batter', bowlingType: 'RM', batting: 13, bowling: 2, keeping: 1, stamina: 9, experience: 9, concentration: 13, consistency: 9, fielding: 8, order: 1 },
      { id: 'sc_2', name: 'T. Latham', age: 27, wage: 16200, btRating: 46000, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 2, keeping: 1, stamina: 9, experience: 8, concentration: 12, consistency: 9, fielding: 7, order: 2 },
      { id: 'sc_3', name: 'K. Williamson (c)', age: 31, wage: 26000, btRating: 78000, role: 'Batter', bowlingType: 'OB', batting: 15, bowling: 5, keeping: 1, stamina: 10, experience: 12, concentration: 15, consistency: 11, fielding: 9, order: 3 },
      { id: 'sc_4', name: 'R. Taylor', age: 30, wage: 19500, btRating: 58000, role: 'Batter', bowlingType: 'RM', batting: 13, bowling: 2, keeping: 1, stamina: 8, experience: 11, concentration: 12, consistency: 9, fielding: 8, order: 4 },
      { id: 'sc_5', name: 'H. Nicholls', age: 25, wage: 13500, btRating: 38000, role: 'Batter', bowlingType: 'RM', batting: 11, bowling: 2, keeping: 1, stamina: 8, experience: 6, concentration: 10, consistency: 8, fielding: 7, order: 5 },
      { id: 'sc_6', name: 'B. Watling (wk)', age: 29, wage: 14000, btRating: 41000, role: 'Keeper', bowlingType: 'RM', batting: 10, bowling: 1, keeping: 12, stamina: 9, experience: 9, concentration: 11, consistency: 8, fielding: 9, order: 6 },
      { id: 'sc_7', name: 'C. de Grandhomme', age: 28, wage: 11500, btRating: 34000, role: 'All-rounder', bowlingType: 'RM', batting: 8, bowling: 9, keeping: 1, stamina: 8, experience: 8, concentration: 7, consistency: 8, fielding: 7, order: 7 },
      { id: 'sc_8', name: 'M. Santner', age: 26, wage: 12800, btRating: 37000, role: 'Bowler', bowlingType: 'SLA', batting: 6, bowling: 12, keeping: 1, stamina: 8, experience: 7, concentration: 5, consistency: 11, fielding: 8, order: 8 },
      { id: 'sc_9', name: 'T. Southee', age: 30, wage: 15500, btRating: 45000, role: 'Bowler', bowlingType: 'RFM', batting: 4, bowling: 13, keeping: 1, stamina: 9, experience: 11, concentration: 4, consistency: 12, fielding: 7, order: 9 },
      { id: 'sc_10', name: 'N. Wagner', age: 29, wage: 16000, btRating: 48000, role: 'Bowler', bowlingType: 'LFM', batting: 3, bowling: 13, keeping: 1, stamina: 10, experience: 10, concentration: 3, consistency: 12, fielding: 7, order: 10 },
      { id: 'sc_11', name: 'T. Boult', age: 28, wage: 17500, btRating: 51000, role: 'Bowler', bowlingType: 'LF', batting: 2, bowling: 14, keeping: 1, stamina: 9, experience: 9, concentration: 2, consistency: 13, fielding: 8, order: 11 },
    ];
  } else if (lower.includes('bulolo') || isBot) {
    // OD League Match 32161741 opponent: Bulolo Seahawks (Bot)
    baseRoster = [
      { id: 'bs_1', name: 'K. Rawlinson', age: 22, wage: 3200, btRating: 11500, role: 'Batter', bowlingType: 'RM', batting: 7, bowling: 2, keeping: 1, stamina: 6, experience: 3, concentration: 6, consistency: 6, fielding: 5, order: 1 },
      { id: 'bs_2', name: 'B. Hargreaves', age: 21, wage: 2800, btRating: 9800, role: 'Batter', bowlingType: 'RM', batting: 6, bowling: 2, keeping: 1, stamina: 5, experience: 3, concentration: 5, consistency: 6, fielding: 5, order: 2 },
      { id: 'bs_3', name: 'T. Butterworth', age: 24, wage: 3900, btRating: 13200, role: 'Batter', bowlingType: 'RM', batting: 7, bowling: 3, keeping: 1, stamina: 6, experience: 4, concentration: 6, consistency: 6, fielding: 5, order: 3 },
      { id: 'bs_4', name: 'J. Oldfield', age: 20, wage: 2400, btRating: 8400, role: 'Batter', bowlingType: 'RM', batting: 6, bowling: 2, keeping: 1, stamina: 5, experience: 2, concentration: 5, consistency: 5, fielding: 4, order: 4 },
      { id: 'bs_5', name: 'L. Greenwood (wk)', age: 23, wage: 2900, btRating: 10200, role: 'Keeper', bowlingType: 'RM', batting: 5, bowling: 1, keeping: 7, stamina: 6, experience: 4, concentration: 5, consistency: 5, fielding: 6, order: 5 },
      { id: 'bs_6', name: 'S. Pickles', age: 21, wage: 1900, btRating: 6200, role: 'Batter', bowlingType: 'RM', batting: 4, bowling: 2, keeping: 1, stamina: 5, experience: 2, concentration: 4, consistency: 4, fielding: 4, order: 6 },
      { id: 'bs_7', name: 'A. Ramsbottom', age: 22, wage: 2700, btRating: 9100, role: 'Bowler', bowlingType: 'RFM', batting: 3, bowling: 7, keeping: 1, stamina: 6, experience: 3, concentration: 3, consistency: 6, fielding: 5, order: 7 },
      { id: 'bs_8', name: 'C. Heaton', age: 25, wage: 3100, btRating: 10800, role: 'Bowler', bowlingType: 'LM', batting: 2, bowling: 7, keeping: 1, stamina: 6, experience: 4, concentration: 2, consistency: 7, fielding: 5, order: 8 },
      { id: 'bs_9', name: 'W. Clough', age: 20, wage: 2100, btRating: 7200, role: 'Bowler', bowlingType: 'RM', batting: 2, bowling: 6, keeping: 1, stamina: 5, experience: 2, concentration: 2, consistency: 5, fielding: 4, order: 9 },
      { id: 'bs_10', name: 'E. Bottomley', age: 19, wage: 1800, btRating: 5800, role: 'Bowler', bowlingType: 'OB', batting: 1, bowling: 5, keeping: 1, stamina: 4, experience: 1, concentration: 1, consistency: 4, fielding: 4, order: 10 },
      { id: 'bs_11', name: 'P. Sidebottom', age: 21, wage: 1400, btRating: 4500, role: 'Bowler', bowlingType: 'RF', batting: 1, bowling: 4, keeping: 1, stamina: 4, experience: 2, concentration: 1, consistency: 4, fielding: 4, order: 11 },
    ];
  } else if (lower.includes('royal west herts') || lower.includes('herts')) {
    // Twenty20 Match 32383795 opponent: Royal West Herts GC
    baseRoster = [
      { id: 'rwh_1', name: 'Archie Finch', age: 25, wage: 14500, btRating: 42000, role: 'Batter', bowlingType: 'RM', batting: 13, bowling: 2, keeping: 1, stamina: 7, experience: 7, concentration: 11, consistency: 9, fielding: 8, order: 1 },
      { id: 'rwh_2', name: 'Callum Thorne', age: 24, wage: 12000, btRating: 36000, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 2, keeping: 1, stamina: 7, experience: 6, concentration: 10, consistency: 8, fielding: 7, order: 2 },
      { id: 'rwh_3', name: 'Bradley Vance', age: 27, wage: 15800, btRating: 46000, role: 'Batter', bowlingType: 'RM', batting: 13, bowling: 3, keeping: 1, stamina: 8, experience: 8, concentration: 12, consistency: 9, fielding: 8, order: 3 },
      { id: 'rwh_4', name: 'Dominic Sterling', age: 23, wage: 11500, btRating: 34000, role: 'All-rounder', bowlingType: 'RFM', batting: 10, bowling: 9, keeping: 1, stamina: 7, experience: 5, concentration: 9, consistency: 8, fielding: 7, order: 4 },
      { id: 'rwh_5', name: 'Tariq Al-Mansoor (wk)', age: 26, wage: 9500, btRating: 28000, role: 'Keeper', bowlingType: 'RM', batting: 9, bowling: 1, keeping: 11, stamina: 7, experience: 6, concentration: 8, consistency: 8, fielding: 8, order: 5 },
      { id: 'rwh_6', name: 'Ewan MacIntyre', age: 28, wage: 7800, btRating: 23000, role: 'Batter', bowlingType: 'RM', batting: 8, bowling: 2, keeping: 1, stamina: 6, experience: 7, concentration: 7, consistency: 7, fielding: 6, order: 6 },
      { id: 'rwh_7', name: 'Lewis O\'Connor', age: 25, wage: 7200, btRating: 21500, role: 'Bowler', bowlingType: 'LF', batting: 4, bowling: 11, keeping: 1, stamina: 7, experience: 6, concentration: 4, consistency: 11, fielding: 7, order: 7 },
      { id: 'rwh_8', name: 'Zubair Qureshi', age: 26, wage: 8100, btRating: 24000, role: 'Bowler', bowlingType: 'OB', batting: 3, bowling: 12, keeping: 1, stamina: 7, experience: 6, concentration: 3, consistency: 11, fielding: 6, order: 8 },
      { id: 'rwh_9', name: 'Gareth North', age: 22, wage: 5900, btRating: 17500, role: 'Bowler', bowlingType: 'RFM', batting: 3, bowling: 10, keeping: 1, stamina: 6, experience: 4, concentration: 3, consistency: 10, fielding: 6, order: 9 },
      { id: 'rwh_10', name: 'Finlay Stewart', age: 29, wage: 6800, btRating: 19500, role: 'Bowler', bowlingType: 'LM', batting: 2, bowling: 11, keeping: 1, stamina: 6, experience: 8, concentration: 2, consistency: 11, fielding: 6, order: 10 },
      { id: 'rwh_11', name: 'Nathaniel Cox', age: 21, wage: 3100, btRating: 9200, role: 'Bowler', bowlingType: 'RM', batting: 2, bowling: 6, keeping: 1, stamina: 5, experience: 3, concentration: 2, consistency: 6, fielding: 5, order: 11 },
    ];
  } else if (lower.includes('atlanta') || lower.includes('braves')) {
    // Twenty20 Match 32383799 opponent: Atlanta Braves
    baseRoster = [
      { id: 'ab_1', name: 'Chase Freeman', age: 26, wage: 13800, btRating: 41000, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 2, keeping: 1, stamina: 7, experience: 7, concentration: 11, consistency: 9, fielding: 8, order: 1 },
      { id: 'ab_2', name: 'Tyler Swanson', age: 25, wage: 12400, btRating: 37500, role: 'Batter', bowlingType: 'RM', batting: 12, bowling: 2, keeping: 1, stamina: 7, experience: 6, concentration: 10, consistency: 8, fielding: 7, order: 2 },
      { id: 'ab_3', name: 'Marcus Riley (c)', age: 28, wage: 16500, btRating: 49000, role: 'Batter', bowlingType: 'RM', batting: 13, bowling: 3, keeping: 1, stamina: 8, experience: 9, concentration: 12, consistency: 9, fielding: 8, order: 3 },
      { id: 'ab_4', name: 'DeAndre Washington', age: 24, wage: 11800, btRating: 35000, role: 'All-rounder', bowlingType: 'RF', batting: 10, bowling: 9, keeping: 1, stamina: 8, experience: 5, concentration: 9, consistency: 8, fielding: 7, order: 4 },
      { id: 'ab_5', name: 'Jordan Hayes (wk)', age: 26, wage: 9800, btRating: 29500, role: 'Keeper', bowlingType: 'RM', batting: 9, bowling: 1, keeping: 11, stamina: 7, experience: 6, concentration: 8, consistency: 8, fielding: 8, order: 5 },
      { id: 'ab_6', name: 'Preston Vance', age: 27, wage: 8200, btRating: 24500, role: 'Batter', bowlingType: 'RM', batting: 8, bowling: 2, keeping: 1, stamina: 6, experience: 7, concentration: 7, consistency: 7, fielding: 6, order: 6 },
      { id: 'ab_7', name: 'Xavier Cole', age: 25, wage: 7500, btRating: 22500, role: 'Bowler', bowlingType: 'RF', batting: 4, bowling: 11, keeping: 1, stamina: 7, experience: 6, concentration: 4, consistency: 11, fielding: 7, order: 7 },
      { id: 'ab_8', name: 'Wyatt Hudson', age: 26, wage: 8500, btRating: 25000, role: 'Bowler', bowlingType: 'LB', batting: 3, bowling: 12, keeping: 1, stamina: 7, experience: 6, concentration: 3, consistency: 11, fielding: 6, order: 8 },
      { id: 'ab_9', name: 'Brody Gallagher', age: 23, wage: 6400, btRating: 19000, role: 'Bowler', bowlingType: 'RFM', batting: 3, bowling: 10, keeping: 1, stamina: 7, experience: 4, concentration: 3, consistency: 10, fielding: 6, order: 9 },
      { id: 'ab_10', name: 'Mason Brooks', age: 29, wage: 7100, btRating: 21000, role: 'Bowler', bowlingType: 'LM', batting: 2, bowling: 11, keeping: 1, stamina: 6, experience: 8, concentration: 2, consistency: 11, fielding: 6, order: 10 },
      { id: 'ab_11', name: 'Camden Ortiz', age: 21, wage: 3200, btRating: 9800, role: 'Bowler', bowlingType: 'RM', batting: 2, bowling: 6, keeping: 1, stamina: 5, experience: 3, concentration: 2, consistency: 6, fielding: 5, order: 11 },
    ];
  } else {
    // Generic dynamic club roster generator for any custom team name
    const cleanTeamName = teamName.replace(/\s*\(.*?\)/g, '').trim() || 'Opposition XI';
    const basePower = isBot ? 9000 : 28000;
    
    for (let i = 1; i <= 11; i++) {
      const isBat = i <= 5;
      const isKeeper = i === 5;
      const isAllRounder = i === 4 || i === 6;
      const isBowl = i >= 7;

      const batVal = isBat ? (isBot ? 6 + (i % 3) : 10 + (i % 4)) : (isAllRounder ? (isBot ? 5 : 8) : (isBot ? 2 : 3));
      const bowlVal = isBowl ? (isBot ? 6 + (i % 3) : 10 + (i % 4)) : (isAllRounder ? (isBot ? 5 : 8) : (isBot ? 2 : 2));
      const btr = Math.round(basePower * (isBat ? 1.2 : isBowl ? 0.9 : 0.6) + (11 - i) * 800);

      baseRoster.push({
        id: `opp_gen_${i}`,
        name: `${cleanTeamName} Player ${i}`,
        age: 21 + (i % 10),
        wage: Math.round(btr * 0.35),
        btRating: btr,
        role: isKeeper ? 'Keeper' : isAllRounder ? 'All-rounder' : isBowl ? 'Bowler' : 'Batter',
        bowlingType: isBowl ? (i % 2 === 0 ? 'OB' : 'RFM') : 'RM',
        batting: batVal,
        bowling: bowlVal,
        keeping: isKeeper ? (isBot ? 7 : 11) : 1,
        stamina: isBot ? 5 : 7,
        experience: isBot ? 3 : 6,
        concentration: isBot ? 4 : 8,
        consistency: isBot ? 4 : 8,
        fielding: isBot ? 5 : 7,
        order: i,
      });
    }
  }

  // Enhance the generated roster to have full averages, stable numeric playerIds/teamIds and labels
  const cleanTeamName = teamName.replace(/\s*\(.*?\)/g, '').trim() || 'Opposition XI';
  
  const hashString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };
  
  const teamIdNum = forcedTeamId || String(hashString(cleanTeamName) % 90000 + 10000);
  
  return baseRoster.map((p, idx) => {
    const pIdNum = p.playerId 
      ? String(p.playerId) 
      : String(hashString(p.name || p.id) % 8000000 + 1000000);
    
    let batAvg = p.battingAverage;
    let bowlAvg = p.bowlingAverage;
    
    if (batAvg === undefined) {
      if (p.role === 'Batter' || p.role === 'Keeper') {
        batAvg = Math.round((28 + (p.batting || 5) * 2.2 + (idx % 7) * 1.5) * 10) / 10;
        bowlAvg = 0;
      } else if (p.role === 'All-rounder') {
        batAvg = Math.round((22 + (p.batting || 5) * 1.8 + (idx % 5) * 1.2) * 10) / 10;
        bowlAvg = Math.round((28 + (15 - (p.bowling || 5)) * 1.4 + (idx % 6) * 1.1) * 10) / 10;
      } else {
        // Bowler: batting average below 50, bowling average below 30
        batAvg = Math.round((8 + (p.batting || 2) * 1.2 + (idx % 6) * 0.8) * 10) / 10;
        bowlAvg = Math.round((18 + (15 - (p.bowling || 5)) * 1.1 + (idx % 4) * 0.9) * 10) / 10;
      }
    }
    
    const batVal = p.batting || 3;
    const bowlVal = p.bowling || 3;
    const isKeeper = p.role === 'Keeper';
    
    const skillLabel = p.estimatedSkillLabel || SKILL_LEVELS[Math.min(Math.max(batVal, bowlVal), SKILL_LEVELS.length - 1)] || 'mediocre';
    const capSkillLabel = skillLabel.charAt(0).toUpperCase() + skillLabel.slice(1);
    
    return {
      ...p,
      playerId: pIdNum,
      teamId: teamIdNum,
      teamName: cleanTeamName,
      battingAverage: batAvg,
      bowlingAverage: bowlAvg,
      estimatedSkillLabel: capSkillLabel,
      estimatedSkillLevel: Math.max(batVal, bowlVal),
      primaryRoleClassifier: isKeeper ? 'Wicketkeeper' : p.role === 'Bowler' ? 'Bowler' : p.role === 'All-rounder' ? 'All-Rounder' : 'Batter'
    };
  });
}

export function generateOpponentScoutDossier(
  players: OpponentPlayer[],
  clubName: string = 'Opposition XI',
  pitch: PitchType = 'Flat',
  weather: WeatherType = 'Sunny',
  format: MatchFormat = 'One Day',
  mySquadAvgBtr: number = 25000
): OpponentScoutDossier {
  const top11 = players.length >= 11 ? players.slice(0, 11) : players;
  const topOrder = top11.slice(0, 3);
  const middleOrder = top11.slice(3, 6);
  const lowerOrder = top11.slice(6, 11);

  // 1. Calculate section ratings
  const topOrderRating = topOrder.length > 0 
    ? topOrder.reduce((acc, p) => acc + (p.batting * 0.7 + (p.concentration || p.batting) * 0.3), 0) / topOrder.length 
    : 8;

  const middleOrderRating = middleOrder.length > 0
    ? middleOrder.reduce((acc, p) => acc + (p.batting * 0.7 + (p.concentration || p.batting) * 0.3), 0) / middleOrder.length
    : 7;

  // Tail vulnerability index (higher = more vulnerable)
  const weakTailCount = lowerOrder.filter(p => p.batting <= 5).length;
  const tailVulnerabilityRating = Math.min(10, weakTailCount * 2.2);

  // Bowling ratings
  const paceBowlers = top11.filter(p => ['RF', 'RMF', 'RFM', 'RM', 'LF', 'LMF', 'LFM', 'LM'].includes(p.bowlingType) && p.bowling >= 6);
  const spinBowlers = top11.filter(p => ['OB', 'LB', 'SLC', 'SLW', 'RH', 'LH'].includes(p.bowlingType) && p.bowling >= 6);

  const paceAttackRating = paceBowlers.length > 0
    ? paceBowlers.reduce((acc, p) => acc + (p.bowling * 0.7 + (p.consistency || p.bowling) * 0.3), 0) / paceBowlers.length
    : 4;

  const spinAttackRating = spinBowlers.length > 0
    ? spinBowlers.reduce((acc, p) => acc + (p.bowling * 0.7 + (p.consistency || p.bowling) * 0.3), 0) / spinBowlers.length
    : 4;

  const overallSquadPower = top11.length > 0
    ? Math.round(top11.reduce((acc, p) => acc + p.btRating, 0) / top11.length)
    : 22000;

  // 2. Identify Tactical Vulnerabilities & Threat Opportunities
  const vulnerabilities: OpponentVulnerability[] = [];

  // V1. Batting Tail Collapse
  if (weakTailCount >= 3) {
    vulnerabilities.push({
      id: 'vuln_tail',
      severity: 'critical',
      category: 'batting_tail',
      title: 'Severe Lower-Order Batting Collapse Risk (Slots 7–11)',
      description: `${weakTailCount} out of 5 lower order players have feeble/mediocre batting ratings (≤ Lv 5). Once their top 5 are dismissed, their scoring rate will plummet.`,
      tacticalAction: 'Instruct your bowlers to attack aggressively with attacking field placements once the 5th wicket falls to rapidly trigger a multi-wicket collapse.',
    });
  }

  // V2. 5th Bowler Vulnerability
  const sortedBowlers = [...top11].sort((a, b) => b.bowling - a.bowling);
  const fifthBowler = sortedBowlers[4];
  if (fifthBowler && fifthBowler.bowling <= 6) {
    vulnerabilities.push({
      id: 'vuln_5th_bowler',
      severity: 'critical',
      category: 'fifth_bowler',
      title: `Weak 5th Bowler Target (${fifthBowler.name}: Lv ${fifthBowler.bowling})`,
      description: `The opposition has only 4 frontline bowling options. Their 5th bowler (${fifthBowler.name}) is a part-timer who will leak runs across their quota.`,
      tacticalAction: 'Instruct top & middle order batters to play cautiously against opening strike bowlers, then accelerate aggression when the 5th bowler is introduced (overs 20–40).',
    });
  }

  // V3. Pitch & Attack Mismatch
  if (pitch === 'Green' && spinBowlers.length >= 2) {
    vulnerabilities.push({
      id: 'vuln_green_spin',
      severity: 'moderate',
      category: 'pitch_mismatch',
      title: 'Opposition Spin Over-Reliance on Green Seam Pitch',
      description: `Opponent relies on ${spinBowlers.length} spin bowlers. Green pitches penalize spin turn by -15% while heavily aiding seam and swing movement.`,
      tacticalAction: 'Your batters can comfortably dominate their spinners without fear of sudden turn. Bowl your own pace attack aggressively with the new ball.',
    });
  } else if (pitch === 'Dusty' && paceBowlers.length >= 3 && spinBowlers.length <= 1) {
    vulnerabilities.push({
      id: 'vuln_dusty_pace',
      severity: 'moderate',
      category: 'pitch_mismatch',
      title: 'Lack of Spin Attack on Dusty Turning Pitch',
      description: 'The opponent has only 1 specialist spinner on a Dusty track that heavily rewards spin bowling (+15% turn and wicket probability).',
      tacticalAction: 'Pick at least 2 specialist spinners in your Match XI to exploit the dry surface and strangle their run chase in middle overs.',
    });
  }

  // V4. Low Stamina / Fatigue Alert
  const lowStaminaPlayers = top11.filter(p => p.stamina <= 4);
  if (lowStaminaPlayers.length >= 2) {
    vulnerabilities.push({
      id: 'vuln_stamina',
      severity: 'moderate',
      category: 'stamina_fatigue',
      title: 'Stamina Depletion Vulnerability in Late Overs',
      description: `${lowStaminaPlayers.length} opponent key players have feeble stamina (≤ Lv 4) and will suffer performance degradation as match overs progress.`,
      tacticalAction: 'In First Class or long One Day chases, drag the match deep. Their bowlers will tire significantly in spells after over 30.',
    });
  }

  // If no critical vulnerabilities, add tactical strength note
  if (vulnerabilities.length === 0) {
    vulnerabilities.push({
      id: 'vuln_balanced',
      severity: 'minor',
      category: 'pitch_mismatch',
      title: 'Balanced Opponent Setup',
      description: 'Opponent features balanced skill distributions across top order and bowling options.',
      tacticalAction: 'Stick to standard Match Orders with balanced aggression and rely on pitch conditions.',
    });
  }

  // 3. Recommended Match Intensity
  let recommendedMatchIntensity: 'Take It Easy' | 'Play As Normal' | 'Go For It' = 'Play As Normal';
  const powerDiff = mySquadAvgBtr - overallSquadPower;
  if (powerDiff > 8000) {
    recommendedMatchIntensity = 'Take It Easy';
  } else if (powerDiff < -6000) {
    recommendedMatchIntensity = 'Go For It';
  }

  // 4. Strategic Advice Strings
  const battingAggressionAdvice = fifthBowler && fifthBowler.bowling <= 6
    ? 'Moderate early overs (1-15) -> Attacking middle overs (16-40 vs 5th bowler) -> Aggressive death overs (41-50).'
    : 'Balanced aggression matching individual batter concentration levels.';

  const bowlingRotationAdvice = pitch === 'Green'
    ? 'Lead with 2 opening Fast/Medium seamers for 8-over initial spells. Rest spinners for middle containment.'
    : pitch === 'Dusty'
      ? 'Introduce spin in over 10. Keep spinners bowling in tandem through overs 15–40.'
      : 'Standard 4-bowler rotation with 10-over spells split into 5-over bursts.';

  const fieldingPressureAdvice = weakTailCount >= 3
    ? 'Set Attacking / Ring fields with 2 slips when batting positions 7–11 arrive at the crease.'
    : 'Standard defensive boundary cover with 1 slip.';

  return {
    clubName,
    scoutedDate: new Date().toLocaleDateString(),
    players: top11,
    topOrderRating: parseFloat(topOrderRating.toFixed(1)),
    middleOrderRating: parseFloat(middleOrderRating.toFixed(1)),
    tailVulnerabilityRating: parseFloat(tailVulnerabilityRating.toFixed(1)),
    paceAttackRating: parseFloat(paceAttackRating.toFixed(1)),
    spinAttackRating: parseFloat(spinAttackRating.toFixed(1)),
    overallSquadPower,
    vulnerabilities,
    recommendedMatchIntensity,
    battingAggressionAdvice,
    bowlingRotationAdvice,
    fieldingPressureAdvice,
  };
}

// -------------------------------------------------------------
// BATTRICK MATCH & SUMMARY PARSER (Scorecards, Reporter Ratings, Batstats)
// -------------------------------------------------------------

import { 
  ParsedBattrickMatch, 
  MatchSummaryRatings, 
  MatchInnings, 
  MatchBatterStat, 
  MatchBowlerStat, 
  MatchFallOfWicket,
  BatstatDecomposition 
} from './types';

// Convert a Battrick qualitative rating text like "wonderful (high)" to a numeric score (0 to 20)
export function parseRatingTextToScore(ratingText: string): number {
  if (!ratingText) return 0;
  const lower = ratingText.toLowerCase().trim();
  
  let baseScore = 0;
  for (let i = 0; i < SKILL_LEVELS.length; i++) {
    if (lower.includes(SKILL_LEVELS[i])) {
      baseScore = i;
      break;
    }
  }

  // Handle modifiers: (low), (high), (superb), etc.
  if (lower.includes('(low)')) {
    baseScore = Math.max(0, baseScore - 0.3);
  } else if (lower.includes('(high)')) {
    baseScore = Math.min(20, baseScore + 0.3);
  } else if (lower.includes('(superb)')) {
    baseScore = Math.min(20, baseScore + 0.6);
  } else if (lower.includes('(abysmal)')) {
    baseScore = Math.max(0, baseScore - 0.6);
  }

  if (baseScore === 0 && lower.includes('non-existent')) return 0;
  return parseFloat(baseScore.toFixed(1));
}

// Parse Reporter's Summary ratings block
export function parseBattrickMatchSummaryText(rawText: string): {
  homeRatings?: MatchSummaryRatings;
  awayRatings?: MatchSummaryRatings;
  pitch?: PitchType;
  weather?: WeatherType;
  crowd?: string;
  toss?: string;
  result?: string;
} {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  let homeRatings: Partial<MatchSummaryRatings> = {};
  let awayRatings: Partial<MatchSummaryRatings> = {};
  let pitch: PitchType = 'Flat';
  let weather: WeatherType = 'Sunny';
  let crowd = '';
  let toss = '';
  let result = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Pitch detection
    if (lower.includes('pitch:') || lower.includes('pitch condition')) {
      if (lower.includes('green')) pitch = 'Green';
      else if (lower.includes('hard')) pitch = 'Hard';
      else if (lower.includes('dusty')) pitch = 'Dusty';
      else if (lower.includes('slow')) pitch = 'Slow';
      else if (lower.includes('uneven')) pitch = 'Uneven';
      else pitch = 'Flat';
    }

    // Weather detection
    if (lower.includes('weather:')) {
      if (lower.includes('overcast') || lower.includes('cloudy')) weather = 'Overcast';
      else if (lower.includes('humid')) weather = 'Humid';
      else if (lower.includes('windy') || lower.includes('breezy')) weather = 'Windy';
      else weather = 'Sunny';
    }

    // Crowd
    if (lower.includes('crowd:') || lower.includes('attendance:')) {
      const match = line.match(/(?:crowd|attendance):\s*([\d,]+)/i);
      if (match) crowd = match[1];
    }

    // Toss
    if (lower.includes('toss:') || lower.includes('won the toss')) {
      toss = line;
    }

    // Result
    if (lower.includes('won by') || lower.includes('match tied') || lower.includes('drawn')) {
      result = line;
    }

    // Parse ratings lines: "Top Order: sensational (high)     Top Order: wonderful (low)" or single team lines
    const parseRatingLine = (label: string) => {
      if (lower.startsWith(label.toLowerCase() + ':') || lower.includes(label.toLowerCase() + ':')) {
        const parts = line.split(new RegExp(label + ':', 'i')).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          // Both teams on same line
          return [parts[0], parts[1]];
        } else if (parts.length === 1) {
          // Single team or colon-separated tabbed line
          const subParts = parts[0].split(/\t+|\s{3,}/);
          if (subParts.length >= 2) {
            return [subParts[0].trim(), subParts[1].trim()];
          }
          return [parts[0], ''];
        }
      }
      return null;
    };

    // Top Order
    const topOrderParts = parseRatingLine('Top Order');
    if (topOrderParts) {
      if (topOrderParts[0]) homeRatings.topOrder = topOrderParts[0];
      if (topOrderParts[1]) awayRatings.topOrder = topOrderParts[1];
    }

    // Middle Order
    const middleOrderParts = parseRatingLine('Middle Order');
    if (middleOrderParts) {
      if (middleOrderParts[0]) homeRatings.middleOrder = middleOrderParts[0];
      if (middleOrderParts[1]) awayRatings.middleOrder = middleOrderParts[1];
    }

    // Lower Order
    const lowerOrderParts = parseRatingLine('Lower Order');
    if (lowerOrderParts) {
      if (lowerOrderParts[0]) homeRatings.lowerOrder = lowerOrderParts[0];
      if (lowerOrderParts[1]) awayRatings.lowerOrder = lowerOrderParts[1];
    }

    // Seam Bowling
    const seamParts = parseRatingLine('Seam Bowling');
    if (seamParts) {
      if (seamParts[0]) homeRatings.seamBowling = seamParts[0];
      if (seamParts[1]) awayRatings.seamBowling = seamParts[1];
    }

    // Spin Bowling
    const spinParts = parseRatingLine('Spin Bowling');
    if (spinParts) {
      if (spinParts[0]) homeRatings.spinBowling = spinParts[0];
      if (spinParts[1]) awayRatings.spinBowling = spinParts[1];
    }

    // Fielding
    const fieldingParts = parseRatingLine('Fielding');
    if (fieldingParts) {
      if (fieldingParts[0]) homeRatings.fielding = fieldingParts[0];
      if (fieldingParts[1]) awayRatings.fielding = fieldingParts[1];
    }

    // Batstats
    if (lower.includes('batstat') || lower.includes('bat stats') || lower.includes('batstats:')) {
      const nums = line.match(/[\d,]{4,}/g);
      if (nums && nums.length >= 2) {
        homeRatings.batstat = parseInt(nums[0].replace(/,/g, ''), 10);
        awayRatings.batstat = parseInt(nums[1].replace(/,/g, ''), 10);
      } else if (nums && nums.length === 1) {
        homeRatings.batstat = parseInt(nums[0].replace(/,/g, ''), 10);
      }
    }
  }

  // Construct complete home and away ratings
  const buildSummary = (r: Partial<MatchSummaryRatings>): MatchSummaryRatings | undefined => {
    if (!r.topOrder && !r.middleOrder && !r.seamBowling && !r.batstat) return undefined;
    return {
      topOrder: r.topOrder || 'competent',
      topOrderScore: parseRatingTextToScore(r.topOrder || 'competent'),
      middleOrder: r.middleOrder || 'competent',
      middleOrderScore: parseRatingTextToScore(r.middleOrder || 'competent'),
      lowerOrder: r.lowerOrder || 'abysmal',
      lowerOrderScore: parseRatingTextToScore(r.lowerOrder || 'abysmal'),
      seamBowling: r.seamBowling || 'competent',
      seamBowlingScore: parseRatingTextToScore(r.seamBowling || 'competent'),
      spinBowling: r.spinBowling || 'abysmal',
      spinBowlingScore: parseRatingTextToScore(r.spinBowling || 'abysmal'),
      fielding: r.fielding || 'competent',
      fieldingScore: parseRatingTextToScore(r.fielding || 'competent'),
      batstat: r.batstat || 120000,
    };
  };

  return {
    homeRatings: buildSummary(homeRatings),
    awayRatings: buildSummary(awayRatings),
    pitch,
    weather,
    crowd,
    toss,
    result
  };
}

// Parse full Battrick Match Scorecard and Match Summary combined
export function parseBattrickFullMatch(rawContent: string, matchIdOverride?: string): ParsedBattrickMatch {
  const matchIdMatch = rawContent.match(/matchID=(\d+)/i) || rawContent.match(/Match\s*(?:ID)?\s*[:#-]?\s*(\d+)/i);
  const matchId = matchIdOverride || (matchIdMatch ? matchIdMatch[1] : '32554717');

  const summaryParsed = parseBattrickMatchSummaryText(rawContent);

  // Extract Teams
  let homeTeam = 'Home XI';
  let awayTeam = 'Away XI';
  const teamMatch = rawContent.match(/([A-Za-z0-9\s.'&-]+)\s+(?:v|vs|versus)\s+([A-Za-z0-9\s.'&-]+)/i);
  if (teamMatch) {
    homeTeam = teamMatch[1].trim().replace(/Scorecard|Match/gi, '').trim();
    awayTeam = teamMatch[2].trim().replace(/Summary/gi, '').trim();
  }

  // Extract Innings & Batters
  const innings: MatchInnings[] = [];
  const lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);

  let currentBatters: MatchBatterStat[] = [];
  let currentBowlers: MatchBowlerStat[] = [];
  let currentFow: MatchFallOfWicket[] = [];
  let currentTeamName = homeTeam;
  let currentTotalRuns = 250;
  let currentWickets = 7;
  let currentOvers = '50.0';

  let parsingBatting = false;
  let parsingBowling = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Detect Innings boundary or Team name
    if (lower.includes('innings') || (lower.includes('batting') && !lower.includes('average'))) {
      if (currentBatters.length > 0) {
        innings.push({
          teamName: currentTeamName,
          inningsNumber: innings.length + 1,
          totalRuns: currentTotalRuns,
          wickets: currentWickets,
          overs: currentOvers,
          batters: [...currentBatters],
          bowlers: [...currentBowlers],
          fallOfWickets: [...currentFow]
        });
        currentBatters = [];
        currentBowlers = [];
        currentFow = [];
        currentTeamName = awayTeam;
      }
      parsingBatting = true;
      parsingBowling = false;
      continue;
    }

    if (lower.includes('bowling') && !lower.includes('type') && !lower.includes('style')) {
      parsingBatting = false;
      parsingBowling = true;
      continue;
    }

    if (lower.includes('fall of wickets') || lower.includes('fow:')) {
      parsingBatting = false;
      parsingBowling = false;
      // Parse FOW in this line
      const fowMatches = line.matchAll(/(\d+)-(\d+)\s*\(([^,]+),\s*([\d.]+)\s*ov\)/gi);
      for (const m of fowMatches) {
        currentFow.push({
          wicket: parseInt(m[1], 10),
          score: parseInt(m[2], 10),
          player: m[3].trim(),
          over: m[4]
        });
      }
      continue;
    }

    // Parse Batting Row
    // Format: PlayerName [c Keeper b Bowler / not out / etc] Runs Balls 4s 6s SR
    if (parsingBatting && currentBatters.length < 11) {
      // Check if line contains numbers for R B 4s 6s SR
      const parts = line.split(/\t+|\s{2,}/);
      if (parts.length >= 5) {
        const nameAndDismissal = parts[0];
        const runs = parseInt(parts[1], 10);
        const balls = parseInt(parts[2], 10);
        const fours = parseInt(parts[3], 10);
        const sixes = parseInt(parts[4], 10);
        const sr = parts[5] ? parseFloat(parts[5]) : (balls > 0 ? parseFloat(((runs / balls) * 100).toFixed(1)) : 0);

        if (!isNaN(runs) && !isNaN(balls)) {
          const orderNum = currentBatters.length + 1;
          const group: 'Top Order' | 'Middle Order' | 'Lower Order' = 
            orderNum <= 3 ? 'Top Order' : (orderNum <= 6 ? 'Middle Order' : 'Lower Order');

          currentBatters.push({
            order: orderNum,
            name: nameAndDismissal.replace(/\(.*?\)/g, '').trim(),
            dismissal: nameAndDismissal.includes('not out') ? 'not out' : 'out',
            runs,
            balls,
            fours: isNaN(fours) ? 0 : fours,
            sixes: isNaN(sixes) ? 0 : sixes,
            strikeRate: isNaN(sr) ? 0 : sr,
            group,
            estimatedSkillGrade: orderNum <= 3 ? 'Sensational' : (orderNum <= 6 ? 'Strong' : 'Mediocre')
          });
        }
      }
    }

    // Parse Bowling Row
    // Format: BowlerName Overs Maidens Runs Wickets Econ
    if (parsingBowling && currentBowlers.length < 7) {
      const parts = line.split(/\t+|\s{2,}/);
      if (parts.length >= 4) {
        const bowlerName = parts[0];
        const overs = parseFloat(parts[1]);
        const maidens = parseInt(parts[2], 10);
        const runs = parseInt(parts[3], 10);
        const wickets = parseInt(parts[4], 10);
        const econ = parts[5] ? parseFloat(parts[5]) : (overs > 0 ? parseFloat((runs / overs).toFixed(2)) : 0);

        if (!isNaN(overs) && !isNaN(runs) && !isNaN(wickets)) {
          const isSpin = /spin|spinner|sla|os|lbg|ob/i.test(line);
          currentBowlers.push({
            order: currentBowlers.length + 1,
            name: bowlerName.trim(),
            overs,
            maidens: isNaN(maidens) ? 0 : maidens,
            runs,
            wickets,
            economy: isNaN(econ) ? 0 : econ,
            isSpin,
            isSeam: !isSpin
          });
        }
      }
    }
  }

  // Push final innings if not yet pushed
  if (currentBatters.length > 0) {
    innings.push({
      teamName: currentTeamName,
      inningsNumber: innings.length + 1,
      totalRuns: currentTotalRuns,
      wickets: currentWickets,
      overs: currentOvers,
      batters: currentBatters,
      bowlers: currentBowlers,
      fallOfWickets: currentFow
    });
  }

  // If no innings could be parsed from raw text, construct realistic match innings structure
  if (innings.length === 0) {
    const example = getExampleMatchData();
    innings.push(...example.innings);
    if (!summaryParsed.homeRatings) summaryParsed.homeRatings = example.homeRatings;
    if (!summaryParsed.awayRatings) summaryParsed.awayRatings = example.awayRatings;
  }

  const parsedMatch: ParsedBattrickMatch = {
    matchId,
    matchUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}`,
    summaryUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}&action=summary`,
    matchDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    matchType: 'One Day',
    homeTeam,
    awayTeam,
    venue: 'Home Ground Arena',
    pitch: summaryParsed.pitch || 'Green',
    weather: summaryParsed.weather || 'Overcast',
    result: summaryParsed.result || 'Match Completed',
    crowd: summaryParsed.crowd || '22,450',
    toss: summaryParsed.toss || `${homeTeam} won the toss and elected to bat`,
    homeRatings: summaryParsed.homeRatings,
    awayRatings: summaryParsed.awayRatings,
    innings
  };

  parsedMatch.batstatAnalysis = analyzeBatstatAndLineup(parsedMatch);
  return parsedMatch;
}

// Analyze Batstat and reverse-engineer Battrick's lineup grouping and grading
export function analyzeBatstatAndLineup(match: ParsedBattrickMatch): BatstatDecomposition[] {
  const decompositions: BatstatDecomposition[] = [];

  const teams = [
    { name: match.homeTeam, ratings: match.homeRatings, inningsIdx: 0 },
    { name: match.awayTeam, ratings: match.awayRatings, inningsIdx: 1 }
  ];

  for (const t of teams) {
    const r = t.ratings || {
      topOrder: 'wonderful (high)',
      topOrderScore: 14.3,
      middleOrder: 'strong',
      middleOrderScore: 9.0,
      lowerOrder: 'feeble',
      lowerOrderScore: 4.0,
      seamBowling: 'proficient',
      seamBowlingScore: 8.0,
      spinBowling: 'respectable',
      spinBowlingScore: 7.0,
      fielding: 'competent',
      fieldingScore: 6.0,
      batstat: 142850
    };

    const topScore = r.topOrderScore || 14;
    const midScore = r.middleOrderScore || 9;
    const lowScore = r.lowerOrderScore || 4;

    // Tail Dropoff: drop from Top Order to Lower Order
    const tailDropoffPercent = parseFloat((((topScore - lowScore) / Math.max(1, topScore)) * 100).toFixed(1));

    // Top order score share
    const totalOrderSum = topScore + midScore + lowScore;
    const topOrderContributionPct = parseFloat(((topScore / Math.max(1, totalOrderSum)) * 100).toFixed(1));

    // 5th bowler analysis from innings if available
    let fifthBowlerName = '5th Bowler (Part-timer)';
    let fifthBowlerConceded = 48;
    let fifthBowlerEcon = 6.8;

    const innings = match.innings[t.inningsIdx === 0 ? 1 : 0]; // Opposition bowling
    if (innings && innings.bowlers && innings.bowlers.length >= 1) {
      // 5th bowler is bowler #5 (index 4) if present, or the change bowler with highest economy among change bowlers (idx >= 4)
      const fifthBowler = innings.bowlers[4] || (innings.bowlers.length >= 5 ? innings.bowlers[innings.bowlers.length - 1] : innings.bowlers[Math.min(3, innings.bowlers.length - 1)]);
      fifthBowlerName = fifthBowler.name;
      fifthBowlerConceded = fifthBowler.runs;
      fifthBowlerEcon = fifthBowler.economy;
    }

    const keyInsights: string[] = [];
    const tacticalExploits: string[] = [];

    // 1. Lineup Grouping Insight
    keyInsights.push(
      `Lineup Grouping: Battrick Reporter grades Positions 1–3 as Top Order (${r.topOrder}), Positions 4–6 as Middle Order (${r.middleOrder}), and Positions 7–11 as Lower Order/Tail (${r.lowerOrder}).`
    );

    // 2. Batstat Insight
    keyInsights.push(
      `Batstat Number (${r.batstat.toLocaleString()}): Represents the cumulative team batting index. The Top Order generates ${topOrderContributionPct}% of this output, meaning early wickets severely cripple their projected score.`
    );

    // 3. Tail dropoff severity
    if (tailDropoffPercent > 55) {
      keyInsights.push(
        `Critical Tail Dropoff (${tailDropoffPercent}% drop): Batters #7–11 have low skill resistance (${r.lowerOrder}). Once through the top 5, a multi-wicket collapse is highly probable.`
      );
      tacticalExploits.push(
        `Declare Attacking Bowling Orders: Instruct opening seamers and strike spinners to use 'Attacking' or 'Super-Attacking' orders early to expose positions 7–11 quickly.`
      );
    } else {
      keyInsights.push(
        `Deep Batting Lineup (${tailDropoffPercent}% tail drop): Solid batting depth through #8. Do not rely solely on waiting for tail collapses.`
      );
      tacticalExploits.push(
        `Containment Bowling: Rotate bowlers conservatively with defensive fields to build dot-ball pressure.`
      );
    }

    // 4. 5th Bowler Exploit
    tacticalExploits.push(
      `Target ${fifthBowlerName}: Average economy of ${fifthBowlerEcon} RPO indicates vulnerable middle overs (overs 20–38). Shift middle-order batsmen to 'Very Attacking' when this bowler operates.`
    );

    // 5. Bowling Attack Profile
    if (r.spinBowlingScore > r.seamBowlingScore + 2) {
      keyInsights.push(`Spin Dominant Attack: Spin rating (${r.spinBowling}) substantially exceeds seam (${r.seamBowling}).`);
      tacticalExploits.push(`Prepare Green or Hard home pitches to neutralize their frontline spin attack.`);
    } else if (r.seamBowlingScore > r.spinBowlingScore + 2) {
      keyInsights.push(`Seam Dominant Attack: Pace attack (${r.seamBowling}) is their primary weapon with weak spin backup (${r.spinBowling}).`);
      tacticalExploits.push(`Prepare Dusty or Slow pitches to deaden pace and exploit their lack of quality spinners.`);
    }

    decompositions.push({
      teamName: t.name,
      batstatValue: r.batstat,
      topOrderRatingText: r.topOrder,
      topOrderRatingValue: topScore,
      middleOrderRatingText: r.middleOrder,
      middleOrderRatingValue: midScore,
      lowerOrderRatingText: r.lowerOrder,
      lowerOrderRatingValue: lowScore,
      seamBowlingText: r.seamBowling,
      spinBowlingText: r.spinBowling,
      fieldingText: r.fielding,
      tailDropoffPercent,
      topOrderContributionPct,
      fifthBowlerConceded,
      fifthBowlerEcon,
      fifthBowlerName,
      keyInsights,
      tacticalExploits
    });
  }

  return decompositions;
}

// Helper to get current user team name and squad
export function getUserTeamAndSquad(): { teamName: string; squad: BattrickPlayer[] } {
  let teamName = 'HairyBeanBags';
  let squad: BattrickPlayer[] = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const savedName = localStorage.getItem('bt_team_name');
      if (savedName && savedName.trim() && savedName !== 'My Battrick IQ Club' && savedName !== 'My Club') {
        teamName = savedName.trim();
      }
      const savedSquad = localStorage.getItem('bt_squad');
      if (savedSquad) {
        squad = JSON.parse(savedSquad);
      }
    }
  } catch (e) {
    // ignore
  }
  return { teamName, squad };
}

// Built-in realistic dataset for the user's upcoming Cup/League fixtures
export function getExampleMatchData(userTeamName?: string, userSquad?: BattrickPlayer[]): ParsedBattrickMatch {
  return getExampleMatchDataById('32554717', userTeamName, userSquad);
}

export const TEST_MATCHES: Record<string, { name: string; type: string; description: string }> = {
  '32554717': {
    name: 'Steve v HairyBeanBags (Cup Match 32554717)',
    type: 'Cup / OD',
    description: 'Cup knockout match testing top-order dominance vs severe lower-order tail dropoff (85.7% drop).'
  },
  '32550500': {
    name: 'Sandshoe Crushers v HairyBeanBags (Match 32550500)',
    type: 'First Class',
    description: 'First Class 3-day fixture on Hard pitch with high-stamina middle order and 5th bowler rotation.'
  },
  '32161738': {
    name: 'Bulolo Seahawks v HairyBeanBags (Match 32161738)',
    type: 'One Day',
    description: 'OD League match against an unmanaged Bot team showing massive Batstat gap (192k vs 89k).'
  }
};

export function getExampleMatchDataById(
  id: string = '32554717',
  customUserTeam?: string,
  customSquad?: BattrickPlayer[]
): ParsedBattrickMatch {
  const { teamName: defaultUserTeam, squad: defaultSquad } = getUserTeamAndSquad();
  const userTeam = customUserTeam || defaultUserTeam;
  const mySquad = (customSquad && customSquad.length > 0) ? customSquad : defaultSquad;

  // Build realistic batting scorecard for the user's squad
  const sortedBatters = [...mySquad].sort((a, b) => {
    const aScore = a.skills.batting * 2 + a.skills.concentration;
    const bScore = b.skills.batting * 2 + b.skills.concentration;
    return bScore - aScore;
  });

  const buildUserBatters = (targetTotal: number = 288): MatchBatterStat[] => {
    if (sortedBatters.length >= 7) {
      return sortedBatters.slice(0, 11).map((p, idx) => {
        const order = idx + 1;
        const group: 'Top Order' | 'Middle Order' | 'Lower Order' = order <= 3 ? 'Top Order' : (order <= 6 ? 'Middle Order' : 'Lower Order');
        const runs = order === 1 ? 84 : order === 2 ? 62 : order === 3 ? 48 : order === 4 ? 38 : order === 5 ? 24 : order === 6 ? 16 : order === 7 ? 8 : order === 8 ? 4 : 1;
        const balls = Math.max(1, Math.round(runs * (order <= 3 ? 1.05 : order <= 6 ? 1.15 : 1.3)));
        const fours = Math.floor(runs / 8);
        const sixes = order <= 4 ? Math.floor(runs / 25) : 0;
        const dismissal = order === 1 ? 'not out' : order === 2 ? 'c Keeper b Bowler' : order === 3 ? 'lbw b Spinner' : order <= 6 ? 'b Seamer' : order === 11 ? 'not out' : 'c Slip b Seamer';
        return {
          order,
          name: p.name,
          dismissal,
          runs,
          balls,
          fours,
          sixes,
          strikeRate: parseFloat(((runs / balls) * 100).toFixed(1)),
          group,
          estimatedSkillGrade: SKILL_LEVELS[p.skills.batting] || 'respectable'
        };
      });
    }

    // Default player names if squad is not yet loaded
    const defaultNames = ['A. Brown', 'J. Hobbs', 'D. Bradman', 'S. Tendulkar', 'B. Lara', 'I. Botham', 'A. Gilchrist (wk)', 'W. Akram', 'M. Muralitharan', 'C. Ambrose', 'M. Holding'];
    return defaultNames.map((name, idx) => {
      const order = idx + 1;
      const group: 'Top Order' | 'Middle Order' | 'Lower Order' = order <= 3 ? 'Top Order' : (order <= 6 ? 'Middle Order' : 'Lower Order');
      const runs = order === 1 ? 84 : order === 2 ? 62 : order === 3 ? 48 : order === 4 ? 38 : order === 5 ? 24 : order === 6 ? 16 : 4;
      const balls = Math.max(1, Math.round(runs * 1.1));
      return {
        order,
        name,
        dismissal: order === 1 ? 'not out' : 'out',
        runs,
        balls,
        fours: Math.floor(runs / 8),
        sixes: order <= 3 ? 1 : 0,
        strikeRate: parseFloat(((runs / balls) * 100).toFixed(1)),
        group,
        estimatedSkillGrade: order <= 3 ? 'Masterful' : order <= 6 ? 'Strong' : 'Feeble'
      };
    });
  };

  const buildUserBowlers = (): MatchBowlerStat[] => {
    const sortedBowlers = [...mySquad].sort((a, b) => b.skills.bowling - a.skills.bowling);
    if (sortedBowlers.length >= 5) {
      return sortedBowlers.slice(0, 5).map((p, idx) => {
        const isSpin = p.bowlingType?.includes('SLA') || p.bowlingType?.includes('LBG') || p.bowlingType?.includes('OB') || p.bowlingType?.includes('Spin');
        return {
          order: idx + 1,
          name: `${p.name} (${p.bowlingType || (isSpin ? 'SLA' : 'RFM')})`,
          overs: 10,
          maidens: idx === 0 ? 2 : 1,
          runs: 38 + idx * 6,
          wickets: idx === 0 ? 3 : idx === 1 ? 2 : idx === 2 ? 2 : 1,
          economy: parseFloat(((38 + idx * 6) / 10).toFixed(2)),
          isSpin: Boolean(isSpin),
          isSeam: !isSpin
        };
      });
    }

    return [
      { order: 1, name: 'Lead Strike Bowler (RFM)', overs: 10, maidens: 2, runs: 38, wickets: 3, economy: 3.8, isSeam: true },
      { order: 2, name: 'Frontline Seamer (RF)', overs: 10, maidens: 1, runs: 44, wickets: 2, economy: 4.4, isSeam: true },
      { order: 3, name: 'Strike Spinner (LBG)', overs: 10, maidens: 1, runs: 42, wickets: 2, economy: 4.2, isSpin: true },
      { order: 4, name: 'Second Spinner (SLA)', overs: 10, maidens: 0, runs: 48, wickets: 1, economy: 4.8, isSpin: true },
      { order: 5, name: 'M. Stoinis (RM)', overs: 10, maidens: 0, runs: 58, wickets: 1, economy: 5.8, isSeam: true }
    ];
  };

  if (id === '32550500' || id === '32194563') {
    return {
      matchId: id,
      matchUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${id}`,
      summaryUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${id}&action=summary`,
      matchDate: '08 Sep 2026',
      matchType: 'First Class',
      homeTeam: 'Sandshoe Crushers',
      awayTeam: userTeam,
      venue: 'Crushers Stadium Arena',
      crowd: '18,400',
      toss: `${userTeam} won the toss and elected to field`,
      pitch: 'Hard',
      weather: 'Sunny',
      result: `${userTeam} won by 7 wickets`,
      homeRatings: {
        topOrder: 'exceptional (low)',
        topOrderScore: 14.7,
        middleOrder: 'superb (high)',
        middleOrderScore: 11.3,
        lowerOrder: 'mediocre',
        lowerOrderScore: 5.0,
        seamBowling: 'quality',
        seamBowlingScore: 12.0,
        spinBowling: 'strong',
        spinBowlingScore: 9.0,
        fielding: 'superb',
        fieldingScore: 10.0,
        batstat: 154200
      },
      awayRatings: {
        topOrder: 'masterful',
        topOrderScore: 18.0,
        middleOrder: 'sensational',
        middleOrderScore: 16.0,
        lowerOrder: 'respectable',
        lowerOrderScore: 7.0,
        seamBowling: 'sensational',
        seamBowlingScore: 16.0,
        spinBowling: 'quality',
        spinBowlingScore: 12.0,
        fielding: 'remarkable',
        fieldingScore: 13.0,
        batstat: 182900
      },
      innings: [
        {
          teamName: 'Sandshoe Crushers',
          inningsNumber: 1,
          totalRuns: 312,
          wickets: 10,
          overs: '94.2',
          batters: [
            { order: 1, name: 'D. Miller', dismissal: 'c Keeper b Strike Bowler', runs: 74, balls: 142, fours: 9, sixes: 0, strikeRate: 52.1, group: 'Top Order', estimatedSkillGrade: 'Exceptional' },
            { order: 2, name: 'T. Latham', dismissal: 'lbw b Seamer', runs: 65, balls: 128, fours: 7, sixes: 0, strikeRate: 50.8, group: 'Top Order', estimatedSkillGrade: 'Exceptional' },
            { order: 3, name: 'K. Williamson', dismissal: 'c Slip b Spinner', runs: 88, balls: 164, fours: 11, sixes: 1, strikeRate: 53.7, group: 'Top Order', estimatedSkillGrade: 'Masterful' },
            { order: 4, name: 'R. Taylor', dismissal: 'c Midwicket b Seamer', runs: 34, balls: 68, fours: 4, sixes: 0, strikeRate: 50.0, group: 'Middle Order', estimatedSkillGrade: 'Superb' },
            { order: 5, name: 'H. Nicholls', dismissal: 'b Spinner', runs: 22, balls: 45, fours: 2, sixes: 0, strikeRate: 48.9, group: 'Middle Order', estimatedSkillGrade: 'Superb' },
            { order: 6, name: 'B. Watling (wk)', dismissal: 'c Keeper b Strike Bowler', runs: 14, balls: 31, fours: 1, sixes: 0, strikeRate: 45.2, group: 'Middle Order', estimatedSkillGrade: 'Quality' },
            { order: 7, name: 'C. de Grandhomme', dismissal: 'c Cover b Seamer', runs: 8, balls: 14, fours: 1, sixes: 0, strikeRate: 57.1, group: 'Lower Order', estimatedSkillGrade: 'Competent' },
            { order: 8, name: 'M. Santner', dismissal: 'b Spinner', runs: 4, balls: 12, fours: 0, sixes: 0, strikeRate: 33.3, group: 'Lower Order', estimatedSkillGrade: 'Mediocre' },
            { order: 9, name: 'T. Southee', dismissal: 'b Strike Bowler', runs: 2, balls: 6, fours: 0, sixes: 0, strikeRate: 33.3, group: 'Lower Order', estimatedSkillGrade: 'Feeble' },
            { order: 10, name: 'N. Wagner', dismissal: 'lbw b Seamer', runs: 1, balls: 8, fours: 0, sixes: 0, strikeRate: 12.5, group: 'Lower Order', estimatedSkillGrade: 'Woeful' },
            { order: 11, name: 'T. Boult', dismissal: 'not out', runs: 0, balls: 4, fours: 0, sixes: 0, strikeRate: 0.0, group: 'Lower Order', estimatedSkillGrade: 'Abysmal' }
          ],
          bowlers: buildUserBowlers(),
          fallOfWickets: [
            { wicket: 1, score: 128, player: 'Miller', over: '40.2' },
            { wicket: 2, score: 172, player: 'Latham', over: '52.1' },
            { wicket: 3, score: 260, player: 'Taylor', over: '76.4' },
            { wicket: 4, score: 279, player: 'Williamson', over: '82.3' },
            { wicket: 5, score: 295, player: 'Nicholls', over: '87.1' }
          ]
        },
        {
          teamName: userTeam,
          inningsNumber: 2,
          totalRuns: 388,
          wickets: 10,
          overs: '106.1',
          batters: buildUserBatters(388),
          bowlers: [
            { order: 1, name: 'T. Boult (LF)', overs: 26, maidens: 5, runs: 88, wickets: 3, economy: 3.38, isSeam: true },
            { order: 2, name: 'T. Southee (RFM)', overs: 24, maidens: 4, runs: 82, wickets: 3, economy: 3.42, isSeam: true },
            { order: 3, name: 'N. Wagner (LFM)', overs: 22.1, maidens: 3, runs: 79, wickets: 3, economy: 3.56, isSeam: true },
            { order: 4, name: 'M. Santner (SLA)', overs: 20, maidens: 4, runs: 68, wickets: 1, economy: 3.40, isSpin: true },
            { order: 5, name: 'C. de Grandhomme (RM)', overs: 14, maidens: 1, runs: 71, wickets: 0, economy: 5.07, isSeam: true }
          ],
          fallOfWickets: [
            { wicket: 1, score: 144, player: 'Opener 1', over: '38.2' },
            { wicket: 2, score: 212, player: 'Opener 2', over: '54.4' },
            { wicket: 3, score: 310, player: 'Top Batter', over: '82.1' }
          ]
        }
      ]
    };
  }

  if (id === '32161738' || id === '32161741') {
    return {
      matchId: id,
      matchUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${id}`,
      summaryUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${id}&action=summary`,
      matchDate: '11 Sep 2026',
      matchType: 'One Day League',
      homeTeam: 'Bulolo Seahawks (Bot)',
      awayTeam: userTeam,
      venue: 'Bulolo Oval',
      crowd: '8,250',
      toss: `${userTeam} won the toss and elected to bat`,
      pitch: 'Dusty',
      weather: 'Overcast',
      result: `${userTeam} won by 168 runs`,
      homeRatings: {
        topOrder: 'proficient (low)',
        topOrderScore: 7.7,
        middleOrder: 'competent',
        middleOrderScore: 6.0,
        lowerOrder: 'abysmal',
        lowerOrderScore: 2.0,
        seamBowling: 'competent',
        seamBowlingScore: 6.0,
        spinBowling: 'woeful',
        spinBowlingScore: 3.0,
        fielding: 'feeble',
        fieldingScore: 4.0,
        batstat: 89400
      },
      awayRatings: {
        topOrder: 'masterful (high)',
        topOrderScore: 18.3,
        middleOrder: 'wonderful',
        middleOrderScore: 14.0,
        lowerOrder: 'strong',
        lowerOrderScore: 9.0,
        seamBowling: 'superb',
        seamBowlingScore: 10.0,
        spinBowling: 'exceptional',
        spinBowlingScore: 15.0,
        fielding: 'quality',
        fieldingScore: 12.0,
        batstat: 192400
      },
      innings: [
        {
          teamName: userTeam,
          inningsNumber: 1,
          totalRuns: 342,
          wickets: 3,
          overs: '50.0',
          batters: buildUserBatters(342),
          bowlers: [
            { order: 1, name: 'Bot Seamer 1 (RM)', overs: 10, maidens: 0, runs: 62, wickets: 1, economy: 6.2, isSeam: true },
            { order: 2, name: 'Bot Seamer 2 (LM)', overs: 10, maidens: 0, runs: 68, wickets: 1, economy: 6.8, isSeam: true },
            { order: 3, name: 'Bot Spinner 1 (OB)', overs: 10, maidens: 0, runs: 74, wickets: 0, economy: 7.4, isSpin: true },
            { order: 4, name: 'Bot Spinner 2 (LB)', overs: 10, maidens: 0, runs: 65, wickets: 0, economy: 6.5, isSpin: true },
            { order: 5, name: 'Bot All-rounder (RM)', overs: 10, maidens: 0, runs: 73, wickets: 0, economy: 7.3, isSeam: true }
          ],
          fallOfWickets: [
            { wicket: 1, score: 112, player: 'Opener 1', over: '18.4' },
            { wicket: 2, score: 268, player: 'Opener 2', over: '41.2' }
          ]
        },
        {
          teamName: 'Bulolo Seahawks (Bot)',
          inningsNumber: 2,
          totalRuns: 174,
          wickets: 10,
          overs: '38.2',
          batters: [
            { order: 1, name: 'Bot Batter 1', dismissal: 'b Strike Bowler', runs: 24, balls: 32, fours: 3, sixes: 0, strikeRate: 75.0, group: 'Top Order', estimatedSkillGrade: 'Proficient' },
            { order: 2, name: 'Bot Batter 2', dismissal: 'c Keeper b Seamer', runs: 38, balls: 46, fours: 5, sixes: 0, strikeRate: 82.6, group: 'Top Order', estimatedSkillGrade: 'Proficient' },
            { order: 3, name: 'Bot Batter 3', dismissal: 'lbw b Spinner', runs: 41, balls: 54, fours: 4, sixes: 0, strikeRate: 75.9, group: 'Top Order', estimatedSkillGrade: 'Competent' },
            { order: 4, name: 'Bot Batter 4', dismissal: 'c Slip b Spinner', runs: 22, balls: 30, fours: 2, sixes: 0, strikeRate: 73.3, group: 'Middle Order', estimatedSkillGrade: 'Competent' },
            { order: 5, name: 'Bot Batter 5', dismissal: 'b Spinner', runs: 16, balls: 24, fours: 1, sixes: 0, strikeRate: 66.7, group: 'Middle Order', estimatedSkillGrade: 'Competent' },
            { order: 6, name: 'Bot Batter 6', dismissal: 'c Slip b Seamer', runs: 9, balls: 16, fours: 0, sixes: 0, strikeRate: 56.3, group: 'Middle Order', estimatedSkillGrade: 'Mediocre' },
            { order: 7, name: 'Bot Keeper', dismissal: 'b Seamer', runs: 8, balls: 11, fours: 1, sixes: 0, strikeRate: 72.7, group: 'Lower Order', estimatedSkillGrade: 'Feeble' },
            { order: 8, name: 'Bot Bowler 1', dismissal: 'lbw b Strike Bowler', runs: 5, balls: 7, fours: 0, sixes: 0, strikeRate: 71.4, group: 'Lower Order', estimatedSkillGrade: 'Woeful' },
            { order: 9, name: 'Bot Bowler 2', dismissal: 'b Seamer', runs: 4, balls: 5, fours: 0, sixes: 0, strikeRate: 80.0, group: 'Lower Order', estimatedSkillGrade: 'Abysmal' },
            { order: 10, name: 'Bot Bowler 3', dismissal: 'c Keeper b Spinner', runs: 2, balls: 4, fours: 0, sixes: 0, strikeRate: 50.0, group: 'Lower Order', estimatedSkillGrade: 'Abysmal' },
            { order: 11, name: 'Bot Bowler 4', dismissal: 'not out', runs: 0, balls: 1, fours: 0, sixes: 0, strikeRate: 0.0, group: 'Lower Order', estimatedSkillGrade: 'Worthless' }
          ],
          bowlers: buildUserBowlers(),
          fallOfWickets: [
            { wicket: 1, score: 54, player: 'Bot Batter 1', over: '9.2' },
            { wicket: 2, score: 86, player: 'Bot Batter 2', over: '16.4' },
            { wicket: 3, score: 128, player: 'Bot Batter 3', over: '25.1' }
          ]
        }
      ]
    };
  }

  // Default / Cup Match (e.g. 32554717 or 32557622 vs Steve)
  const matchId = id || '32554717';
  const opponent = 'Steve';
  return {
    matchId,
    matchUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}`,
    summaryUrl: `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}&action=summary`,
    matchDate: '06 Sep 2026',
    matchType: 'Cup Knockout',
    homeTeam: opponent,
    awayTeam: userTeam,
    venue: `${opponent} Arena`,
    crowd: '22,450',
    toss: `${opponent} won the toss and elected to bat`,
    pitch: 'Green',
    weather: 'Overcast',
    result: `${userTeam} won by 42 runs`,
    homeRatings: {
      topOrder: 'sensational (high)',
      topOrderScore: 16.3,
      middleOrder: 'wonderful (low)',
      middleOrderScore: 13.7,
      lowerOrder: 'feeble',
      lowerOrderScore: 4.0,
      seamBowling: 'superb',
      seamBowlingScore: 10.0,
      spinBowling: 'respectable',
      spinBowlingScore: 7.0,
      fielding: 'strong',
      fieldingScore: 9.0,
      batstat: 168450
    },
    awayRatings: {
      topOrder: 'masterful',
      topOrderScore: 17.5,
      middleOrder: 'sensational',
      middleOrderScore: 15.0,
      lowerOrder: 'proficient',
      lowerOrderScore: 8.0,
      seamBowling: 'sensational',
      seamBowlingScore: 15.5,
      spinBowling: 'quality',
      spinBowlingScore: 12.0,
      fielding: 'quality',
      fieldingScore: 12.0,
      batstat: 184500
    },
    innings: [
      {
        teamName: opponent,
        inningsNumber: 1,
        totalRuns: 242,
        wickets: 10,
        overs: '48.2',
        batters: [
          { order: 1, name: 'S. Cook', dismissal: 'c Keeper b Strike Bowler', runs: 78, balls: 84, fours: 8, sixes: 0, strikeRate: 92.8, group: 'Top Order', estimatedSkillGrade: 'Wonderful' },
          { order: 2, name: 'T. Strauss', dismissal: 'b Seamer', runs: 52, balls: 60, fours: 5, sixes: 1, strikeRate: 86.7, group: 'Top Order', estimatedSkillGrade: 'Wonderful' },
          { order: 3, name: 'J. Root', dismissal: 'lbw b Spinner', runs: 41, balls: 45, fours: 3, sixes: 0, strikeRate: 91.1, group: 'Top Order', estimatedSkillGrade: 'Wonderful' },
          { order: 4, name: 'K. Pietersen', dismissal: 'c Cover b Seamer', runs: 28, balls: 24, fours: 3, sixes: 1, strikeRate: 116.7, group: 'Middle Order', estimatedSkillGrade: 'Proficient' },
          { order: 5, name: 'I. Bell', dismissal: 'c Slip b Spinner', runs: 19, balls: 26, fours: 1, sixes: 0, strikeRate: 73.1, group: 'Middle Order', estimatedSkillGrade: 'Proficient' },
          { order: 6, name: 'P. Collingwood', dismissal: 'b Seamer', runs: 8, balls: 14, fours: 0, sixes: 0, strikeRate: 57.1, group: 'Middle Order', estimatedSkillGrade: 'Competent' },
          { order: 7, name: 'M. Prior (wk)', dismissal: 'c Keeper b Strike Bowler', runs: 5, balls: 9, fours: 0, sixes: 0, strikeRate: 55.6, group: 'Lower Order', estimatedSkillGrade: 'Feeble' },
          { order: 8, name: 'C. Woakes', dismissal: 'b Seamer', runs: 4, balls: 8, fours: 0, sixes: 0, strikeRate: 50.0, group: 'Lower Order', estimatedSkillGrade: 'Woeful' },
          { order: 9, name: 'S. Broad', dismissal: 'lbw b Seamer', runs: 2, balls: 5, fours: 0, sixes: 0, strikeRate: 40.0, group: 'Lower Order', estimatedSkillGrade: 'Abysmal' },
          { order: 10, name: 'A. Rashid', dismissal: 'b Seamer', runs: 1, balls: 3, fours: 0, sixes: 0, strikeRate: 33.3, group: 'Lower Order', estimatedSkillGrade: 'Abysmal' },
          { order: 11, name: 'J. Anderson', dismissal: 'not out', runs: 0, balls: 2, fours: 0, sixes: 0, strikeRate: 0.0, group: 'Lower Order', estimatedSkillGrade: 'Worthless' }
        ],
        bowlers: buildUserBowlers(),
        fallOfWickets: [
          { wicket: 1, score: 118, player: 'T. Strauss', over: '19.2' },
          { wicket: 2, score: 154, player: 'S. Cook', over: '26.4' },
          { wicket: 3, score: 185, player: 'J. Root', over: '32.1' },
          { wicket: 4, score: 215, player: 'K. Pietersen', over: '37.3' },
          { wicket: 5, score: 226, player: 'I. Bell', over: '40.2' },
          { wicket: 6, score: 231, player: 'P. Collingwood', over: '41.5' },
          { wicket: 7, score: 237, player: 'M. Prior', over: '43.2' },
          { wicket: 8, score: 240, player: 'C. Woakes', over: '44.4' },
          { wicket: 9, score: 242, player: 'S. Broad', over: '45.5' },
          { wicket: 10, score: 242, player: 'A. Rashid', over: '48.2' }
        ]
      },
      {
        teamName: userTeam,
        inningsNumber: 2,
        totalRuns: 284,
        wickets: 6,
        overs: '50.0',
        batters: buildUserBatters(284),
        bowlers: [
          { order: 1, name: 'J. Anderson (LF)', overs: 10, maidens: 1, runs: 44, wickets: 2, economy: 4.4, isSeam: true },
          { order: 2, name: 'S. Broad (RFM)', overs: 10, maidens: 0, runs: 58, wickets: 1, economy: 5.8, isSeam: true },
          { order: 3, name: 'A. Rashid (LBG)', overs: 10, maidens: 0, runs: 49, wickets: 2, economy: 4.9, isSpin: true },
          { order: 4, name: 'C. Woakes (RFM)', overs: 10, maidens: 0, runs: 56, wickets: 0, economy: 5.6, isSeam: true },
          { order: 5, name: 'P. Collingwood (RM)', overs: 10, maidens: 0, runs: 72, wickets: 0, economy: 7.2, isSeam: true }
        ],
        fallOfWickets: [
          { wicket: 1, score: 142, player: 'Opener 1', over: '24.2' },
          { wicket: 2, score: 168, player: 'Opener 2', over: '29.4' },
          { wicket: 3, score: 215, player: 'Top Batter', over: '38.1' }
        ]
      }
    ]
  };
}

export function estimateSkillFromWageAndBTR(wage: number, btr: number, role?: 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper'): {
  estimatedSkillLabel: string;
  estimatedSkillLevel: number;
} {
  // Weekly wage scales exponentially with primary skill level in Battrick:
  let level = 5;
  if (wage >= 220000) level = 18; // elite
  else if (wage >= 150000) level = 17; // masterful / exquisite
  else if (wage >= 95000) level = 16; // exquisite
  else if (wage >= 55000) level = 15; // sensational
  else if (wage >= 30000) level = 14; // exceptional
  else if (wage >= 18000) level = 13; // wonderful
  else if (wage >= 11000) level = 12; // remarkable
  else if (wage >= 6500) level = 11; // quality
  else if (wage >= 4000) level = 10; // superb
  else if (wage >= 2400) level = 9; // strong
  else if (wage >= 1500) level = 8; // proficient
  else if (wage >= 900) level = 7; // respectable
  else if (wage >= 500) level = 6; // competent
  else if (wage >= 300) level = 5; // mediocre
  else if (wage >= 150) level = 4; // feeble
  else level = 3; // woeful / abysmal

  const label = SKILL_LEVELS[level] || 'mediocre';
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  return {
    estimatedSkillLabel: capitalizedLabel,
    estimatedSkillLevel: level
  };
}

export function parseOpponentSquad(content: string, overrideTeamName?: string, overrideTeamId?: string): BattrickPlayer[] {
  const players: BattrickPlayer[] = [];

  const parser = new DOMParser();
  let doc: Document | null = null;
  try {
    doc = parser.parseFromString(content, 'text/html');
  } catch {
    // ignore
  }

  // 1. Try parsing <div class="player" id="player_..."> blocks
  if (doc) {
    const playerDivs = Array.from(doc.querySelectorAll('.player, div[id^="player_"]'));
    if (playerDivs.length > 0) {
      for (const pDiv of playerDivs) {
        const fullText = pDiv.textContent || '';
        const html = pDiv.innerHTML || '';

        // Player ID
        let id = pDiv.getAttribute('id')?.replace('player_', '') || '';
        if (!id) {
          const idMatch = html.match(/playerID=(\d+)/i) || html.match(/id=(\d+)/i);
          if (idMatch) id = idMatch[1];
        }

        // Name
        const nameLink = pDiv.querySelector('.player_name a, .player_name') || pDiv.querySelector('a[href*="playerdetails"]');
        const name = nameLink?.textContent?.trim() || 'Rival Player';

        // Age
        const ageEl = pDiv.querySelector('.player_age');
        const ageMatch = ageEl?.textContent?.match(/(\d+)/) || fullText.match(/(\d+)\s*yo/i);
        const age = ageMatch ? parseInt(ageMatch[1], 10) : 25;

        // BTR
        const btrEl = pDiv.querySelector('.player_btr');
        const btrMatch = btrEl?.textContent?.replace(/,/g, '') || fullText.match(/BT\s*Rating\s*=\s*([0-9,]+)/i)?.[1].replace(/,/g, '');
        const btRating = btrMatch ? parseInt(btrMatch, 10) : 5000;

        // Wage
        const wageEl = pDiv.querySelector('.player_wage');
        const rawWageText = wageEl?.textContent || '';
        const wageMatch = rawWageText.replace(/[^0-9]/g, '') ||
                          fullText.match(/Wage\s*=\s*&#163;?([0-9,]+)/i)?.[1].replace(/,/g, '') ||
                          fullText.match(/Wage\s*=\s*£?([0-9,]+)/i)?.[1].replace(/,/g, '');
        const wage = wageMatch ? parseInt(wageMatch, 10) : 1000;

        // Batting Hand & Style
        const batHandEl = pDiv.querySelector('.player_bathand');
        const batStyleEl = pDiv.querySelector('.player_aggression');
        const batHand = batHandEl?.textContent?.trim() || (fullText.includes('LH batter') ? 'LH' : 'RH');
        const batStyle = batStyleEl?.textContent?.trim() || 'cautious';

        // Bowling Hand & Type & Aggression
        const bowlHandEl = pDiv.querySelector('.player_bowlhand');
        const bowlTypeEl = pDiv.querySelector('.player_bowltype');
        const bowlAggEl = pDiv.querySelector('.player_aggressionbowl');

        const bowlHand = bowlHandEl?.textContent?.trim() || 'R';
        const bowlStyle = bowlTypeEl?.textContent?.trim() || '';
        const bowlingType = bowlStyle ? `${bowlHand}${bowlStyle}` : (fullText.match(/\b(RFM|LF|LBG|OB|RM|F|M)\b/i)?.[1] || 'None');
        const bowlingAggression = bowlAggEl?.textContent?.trim() || '';

        // Form & Fitness
        const batformEl = pDiv.querySelector('.player_batform');
        const bowlformEl = pDiv.querySelector('.player_bowlform');
        const fitnessEl = pDiv.querySelector('.player_fitness');

        const battingFormLabel = batformEl?.textContent?.trim() || 'proficient';
        const bowlingFormLabel = bowlformEl?.textContent?.trim() || 'respectable';
        const fitnessLabel = fitnessEl?.textContent?.trim() || 'invigorated';

        // Role Classifier
        let role: 'Batter' | 'Bowler' | 'Keeper' | 'All-rounder' | 'Prospect' = 'Batter';
        let primaryRoleClassifier: 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper' = 'Batter';

        const isBowler = bowlingType && bowlingType !== 'None' && !bowlingType.toLowerCase().includes('non-bowler');
        const isKeeper = fullText.toLowerCase().includes('wicketkeeper') || fullText.toLowerCase().includes('keeper');

        if (isKeeper) {
          role = 'Keeper';
          primaryRoleClassifier = 'Wicketkeeper';
        } else if (isBowler) {
          if (wage > 15000 && btRating > 30000) {
            role = 'All-rounder';
            primaryRoleClassifier = 'All-Rounder';
          } else {
            role = 'Bowler';
            primaryRoleClassifier = 'Bowler';
          }
        } else {
          role = 'Batter';
          primaryRoleClassifier = 'Batter';
        }

        const { estimatedSkillLabel, estimatedSkillLevel } = estimateSkillFromWageAndBTR(wage, btRating, primaryRoleClassifier);

        players.push({
          id: id || `rival_${Math.random().toString(36).substring(2, 9)}`,
          name,
          age,
          wage,
          btRating,
          bowlingType,
          role,
          battingHand: batHand,
          battingStyle: batStyle,
          bowlingHand: bowlHand,
          bowlingStyle: bowlStyle,
          bowlingAggression,
          battingFormLabel,
          bowlingFormLabel,
          fitnessLabel,
          estimatedSkillLabel,
          estimatedSkillLevel,
          primaryRoleClassifier,
          teamName: overrideTeamName || 'Rival Club',
          teamId: overrideTeamId || '',
          form: 8,
          fitness: 8,
          skills: {
            batting: primaryRoleClassifier === 'Batter' || primaryRoleClassifier === 'All-Rounder' ? estimatedSkillLevel : Math.max(1, estimatedSkillLevel - 4),
            bowling: primaryRoleClassifier === 'Bowler' || primaryRoleClassifier === 'All-Rounder' ? estimatedSkillLevel : Math.max(1, estimatedSkillLevel - 4),
            keeping: primaryRoleClassifier === 'Wicketkeeper' ? estimatedSkillLevel : 1,
            stamina: 7,
            leadership: 2,
            experience: 10,
            concentration: estimatedSkillLevel,
            consistency: estimatedSkillLevel,
            fielding: 6
          },
          nets: { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 }
        });
      }
    }
  }

  // Fallback if regex parsing is needed
  if (players.length === 0) {
    const playerRegex = /<a[^>]*playerID=(\d+)[^>]*>(.*?)<\/a>.*?(\d+)\s*yo.*?BT\s*Rating\s*=\s*([0-9,]+).*?Wage\s*=\s*&#163;?([0-9,]+)/gis;
    let match;
    while ((match = playerRegex.exec(content)) !== null) {
      const id = match[1];
      const name = match[2].replace(/<[^>]+>/g, '').trim();
      const age = parseInt(match[3], 10);
      const btRating = parseInt(match[4].replace(/,/g, ''), 10);
      const wage = parseInt(match[5].replace(/,/g, ''), 10);

      const { estimatedSkillLabel, estimatedSkillLevel } = estimateSkillFromWageAndBTR(wage, btRating, 'Batter');

      players.push({
        id,
        name,
        age,
        wage,
        btRating,
        bowlingType: 'RFM',
        role: 'Batter',
        estimatedSkillLabel,
        estimatedSkillLevel,
        primaryRoleClassifier: 'Batter',
        teamName: overrideTeamName || 'Rival Club',
        teamId: overrideTeamId || '',
        form: 8,
        fitness: 8,
        skills: {
          batting: estimatedSkillLevel,
          bowling: 3,
          keeping: 1,
          stamina: 7,
          leadership: 2,
          experience: 8,
          concentration: estimatedSkillLevel,
          consistency: estimatedSkillLevel,
          fielding: 6
        },
        nets: { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 }
      });
    }
  }

  return players;
}

export function parseLeagueTable(content: string, defaultType?: 'First Class' | 'One Day' | 'BT20', forcedLeagueId?: string): BattrickLeagueTable {
  const parser = new DOMParser();
  let doc: Document | null = null;
  try {
    doc = parser.parseFromString(content, 'text/html');
  } catch {
    // fallback
  }

  // 1. Detect League ID
  let leagueId = forcedLeagueId || '';
  if (!leagueId) {
    const idMatch = content.match(/leagueID=(\d+)/i) || content.match(/league\.asp\?id=(\d+)/i);
    if (idMatch) leagueId = idMatch[1];
  }

  // 2. Detect League Title and Type
  let leagueName = '';
  let leagueType: 'First Class' | 'One Day' | 'BT20' = defaultType || 'One Day';

  const headingText = doc?.querySelector('h1, h2, h3, .pagetitle, .title')?.textContent?.trim() || '';
  if (headingText) {
    leagueName = headingText.replace(/league/i, '').replace(/standings/i, '').trim();
  }

  if (!leagueName) {
    const titleMatch = content.match(/<h[123][^>]*>(.*?)<\/h[123]>/i) || content.match(/class="title"[^>]*>(.*?)<\/td>/i);
    if (titleMatch) {
      leagueName = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }
  }

  const combinedText = (headingText + ' ' + content.slice(0, 2000)).toLowerCase();
  if (combinedText.includes('first class') || combinedText.includes('fc league')) {
    leagueType = 'First Class';
  } else if (combinedText.includes('bt20') || combinedText.includes('20/20') || combinedText.includes('t20')) {
    leagueType = 'BT20';
  } else if (combinedText.includes('one day') || combinedText.includes('od league')) {
    leagueType = 'One Day';
  }

  if (!leagueName) {
    leagueName = leagueId ? `League #${leagueId}` : 'Battrick League';
  }

  // 3. Extract User Team Name from Local Storage if available
  let userTeamName = 'HairyBeanBags';
  try {
    const savedSquad = localStorage.getItem('bt_squad');
    if (savedSquad) {
      const parsed = JSON.parse(savedSquad);
      if (parsed.length > 0 && parsed[0].team) userTeamName = parsed[0].team;
    }
  } catch {
    // ignore
  }

  // 4. Parse Standings Table
  const teams: BattrickLeagueTeam[] = [];

  if (doc) {
    const rows = Array.from(doc.querySelectorAll('tr'));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, th')).map(c => ({
        text: c.textContent?.trim() || '',
        link: c.querySelector('a')?.getAttribute('href') || '',
        html: c.innerHTML || ''
      }));

      // Check if this row is a standings row: pos 1..8 and has team link or name
      if (cells.length >= 6) {
        const firstCol = cells[0].text;
        const pos = parseInt(firstCol.replace('#', ''), 10);
        if (!isNaN(pos) && pos >= 1 && pos <= 20) {
          // Team Name column is usually index 1
          const teamCell = cells[1];
          const teamName = teamCell.text || 'Unknown Team';
          let teamId = '';
          const teamIdMatch = teamCell.link.match(/teamID=(\d+)/i) || teamCell.html.match(/teamID=(\d+)/i);
          if (teamIdMatch) teamId = teamIdMatch[1];

          // Played, Won, Tied, Lost, Points, NRR
          const played = parseInt(cells[2]?.text || '0', 10) || 0;
          const won = parseInt(cells[3]?.text || '0', 10) || 0;
          const tied = parseInt(cells[4]?.text || '0', 10) || 0;
          const lost = parseInt(cells[5]?.text || '0', 10) || 0;
          
          let points = 0;
          let netRunRate = '';

          // Look for points in cells 6 or 7
          for (let c = 6; c < cells.length; c++) {
            const val = cells[c].text;
            if (/^[+-]?\d+\.\d+$/.test(val)) {
              netRunRate = val;
            } else if (!isNaN(parseInt(val, 10)) && points === 0) {
              points = parseInt(val, 10);
            }
          }

          const isMyTeam = teamName.toLowerCase().includes(userTeamName.toLowerCase()) || userTeamName.toLowerCase().includes(teamName.toLowerCase());

          teams.push({
            position: pos,
            teamName,
            teamId,
            played,
            won,
            tied,
            lost,
            points,
            netRunRate: netRunRate || '+0.00',
            isMyTeam
          });
        }
      }
    }
  }

  // Fallback if parsing returned 0 teams
  if (teams.length === 0) {
    return getExampleLeagueTable(leagueId || '2749', leagueName, leagueType);
  }

  return {
    leagueId: leagueId || '2749',
    leagueName,
    leagueType,
    teams,
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

export function getExampleLeagueTable(leagueId: string, leagueName?: string, leagueType?: 'First Class' | 'One Day' | 'BT20'): BattrickLeagueTable {
  const type = leagueType || (leagueId === '2749' ? 'First Class' : leagueId === '7532' ? 'BT20' : 'One Day');
  const name = leagueName || (leagueId === '2749' ? 'V.7' : leagueId === '212' ? 'IV.2' : leagueId === '7532' ? 'IV.51' : `Division ${leagueId}`);

  let teams: BattrickLeagueTeam[] = [];

  if (type === 'First Class') {
    teams = [
      { position: 1, teamName: "Steve's XI", teamId: '101', played: 10, won: 8, tied: 1, lost: 1, points: 142, netRunRate: '+2.14', isMyTeam: false },
      { position: 2, teamName: "Sandshoe CC", teamId: '102', played: 10, won: 7, tied: 0, lost: 3, points: 124, netRunRate: '+1.48', isMyTeam: false },
      { position: 3, teamName: "Bulolo Strikers", teamId: '103', played: 10, won: 6, tied: 1, lost: 3, points: 108, netRunRate: '+0.92', isMyTeam: false },
      { position: 4, teamName: "Brisbane Blasters", teamId: '104', played: 10, won: 5, tied: 0, lost: 5, points: 92, netRunRate: '+0.15', isMyTeam: false },
      { position: 5, teamName: "Outback Express", teamId: '105', played: 10, won: 4, tied: 1, lost: 5, points: 80, netRunRate: '-0.38', isMyTeam: false },
      { position: 6, teamName: "HairyBeanBags", teamId: '132175', played: 10, won: 4, tied: 0, lost: 6, points: 74, netRunRate: '-0.24', isMyTeam: true },
      { position: 7, teamName: "Kangaroo All-Stars", teamId: '107', played: 10, won: 2, tied: 1, lost: 7, points: 46, netRunRate: '-1.25', isMyTeam: false },
      { position: 8, teamName: "Bushrangers", teamId: '108', played: 10, won: 1, tied: 0, lost: 9, points: 28, netRunRate: '-2.10', isMyTeam: false }
    ];
  } else if (type === 'BT20') {
    teams = [
      { position: 1, teamName: "Cyclone Strikers", teamId: '201', played: 12, won: 10, tied: 0, lost: 2, points: 40, netRunRate: '+2.45', isMyTeam: false },
      { position: 2, teamName: "Gold Coast Titans", teamId: '202', played: 12, won: 9, tied: 0, lost: 3, points: 36, netRunRate: '+1.82', isMyTeam: false },
      { position: 3, teamName: "Sandshoe CC", teamId: '102', played: 12, won: 8, tied: 0, lost: 4, points: 32, netRunRate: '+1.10', isMyTeam: false },
      { position: 4, teamName: "Steve's XI", teamId: '101', played: 12, won: 7, tied: 0, lost: 5, points: 28, netRunRate: '+0.42', isMyTeam: false },
      { position: 5, teamName: "Outback Express", teamId: '105', played: 12, won: 5, tied: 0, lost: 7, points: 20, netRunRate: '-0.55', isMyTeam: false },
      { position: 6, teamName: "Bulolo Strikers", teamId: '103', played: 12, won: 4, tied: 0, lost: 8, points: 16, netRunRate: '-0.98', isMyTeam: false },
      { position: 7, teamName: "HairyBeanBags", teamId: '132175', played: 12, won: 3, tied: 0, lost: 9, points: 12, netRunRate: '-1.45', isMyTeam: true },
      { position: 8, teamName: "Cobar Colts", teamId: '208', played: 12, won: 2, tied: 0, lost: 10, points: 8, netRunRate: '-2.80', isMyTeam: false }
    ];
  } else {
    // One Day
    teams = [
      { position: 1, teamName: "Brisbane Blasters", teamId: '104', played: 10, won: 9, tied: 0, lost: 1, points: 36, netRunRate: '+1.92', isMyTeam: false },
      { position: 2, teamName: "HairyBeanBags", teamId: '132175', played: 10, won: 8, tied: 0, lost: 2, points: 32, netRunRate: '+1.35', isMyTeam: true },
      { position: 3, teamName: "Steve's XI", teamId: '101', played: 10, won: 7, tied: 0, lost: 3, points: 28, netRunRate: '+0.88', isMyTeam: false },
      { position: 4, teamName: "Sandshoe CC", teamId: '102', played: 10, won: 5, tied: 0, lost: 5, points: 20, netRunRate: '+0.12', isMyTeam: false },
      { position: 5, teamName: "Gold Coast Titans", teamId: '202', played: 10, won: 4, tied: 0, lost: 6, points: 16, netRunRate: '-0.42', isMyTeam: false },
      { position: 6, teamName: "Outback Express", teamId: '105', played: 10, won: 4, tied: 0, lost: 6, points: 16, netRunRate: '-0.75', isMyTeam: false },
      { position: 7, teamName: "Bulolo Strikers", teamId: '103', played: 10, won: 2, tied: 0, lost: 8, points: 8, netRunRate: '-1.15', isMyTeam: false },
      { position: 8, teamName: "Cobar Colts", teamId: '208', played: 10, won: 1, tied: 0, lost: 9, points: 4, netRunRate: '-2.05', isMyTeam: false }
    ];
  }

  return {
    leagueId,
    leagueName: name,
    leagueType: type,
    teams,
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

export function parseBattrickPlayerDetails(content: string): BattrickPlayer | null {
  if (!content) return null;

  try {
    let text = content;
    let title = '';
    let doc: Document | null = null;

    if (content.includes('<') && content.includes('>')) {
      const parser = new DOMParser();
      doc = parser.parseFromString(content, 'text/html');
      text = doc.body?.textContent || content;
      title = doc.querySelector('title')?.textContent || doc.querySelector('h1')?.textContent || '';
    }

    // Attempt to extract name and ID
    let name = 'Scouted Player';
    let id = '';

    if (doc) {
      const h1El = doc.querySelector('h1, h2, h3, .player-name');
      if (h1El) {
        const textH1 = h1El.textContent || '';
        const match = textH1.match(/([^\(\-\d]+)(?:\s+[\(\-]\s*(\d+))?/i);
        if (match) {
          name = match[1].trim();
          if (match[2]) id = match[2].trim();
        }
      }
    }

    if (!id || id === '') {
      const idMatch = content.match(/(?:playerid|id)(?:_|-|=|%3d|%3D|\s)*(\d+)/i) || content.match(/\((\d{5,8})\)/);
      if (idMatch) id = idMatch[1];
      
      const nameMatch = content.match(/([A-Za-z\s]+)\s+\((\d{5,8})\)/);
      if (nameMatch) {
        name = nameMatch[1].trim();
        id = nameMatch[2].trim();
      }
    }

    if (!id) {
      id = Math.floor(1000000 + Math.random() * 9000000).toString();
    }

    name = name.replace(/Player Details/i, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

    const getMatchValue = (regex: RegExp, fallback: number = 0): number => {
      const m = text.match(regex);
      if (m && m[1]) {
        const cleaned = m[1].replace(/,/g, '');
        return parseInt(cleaned, 10) || fallback;
      }
      return fallback;
    };

    const age = getMatchValue(/Age:\s*(\d+)/i, 20);

    // Robust BTR extraction
    let btr = 5000;
    const btrMatch = text.match(/(?:Battrick\s+)?Rating\s*[:=]?\s*([\d,]+)/i) || 
                     text.match(/BT\s+Rating\s*[:=]?\s*([\d,]+)/i) || 
                     text.match(/\bBTR\s*[:=]?\s*([\d,]+)/i) ||
                     text.match(/\b([\d,]+)\s*(?:Battrick Rating|BT Rating|BTR)\b/i);
    if (btrMatch) {
      btr = parseInt(btrMatch[1].replace(/,/g, ''), 10) || 5000;
    }

    // Robust Wage extraction
    let wage = 1000;
    const wageMatch = text.match(/\b(?:Wage|Wages|Salary)\s*[:=]?\s*[$£€]?\s*([\d,]+)/i) || 
                      text.match(/\b[$£€]\s*([\d,]+)\s*(?:wage|wages|salary|per week)/i);
    if (wageMatch) {
      wage = parseInt(wageMatch[1].replace(/,/g, ''), 10) || 1000;
    }

    // Robust Form extraction
    let formText = 'respectable';
    const batFormMatch = text.match(/\b([a-zA-Z]+)\s+batting\s+form\b/i) || text.match(/\bbatting\s+form:?\s*([a-zA-Z]+)\b/i);
    const bowlFormMatch = text.match(/\b([a-zA-Z]+)\s+bowling\s+form\b/i) || text.match(/\bbowling\s+form:?\s*([a-zA-Z]+)\b/i);
    const generalFormMatch = text.match(/\bForm\s*[:=]?\s*([a-zA-Z\*]+)\b/i);

    if (batFormMatch) {
      formText = batFormMatch[1].trim();
    } else if (bowlFormMatch) {
      formText = bowlFormMatch[1].trim();
    } else if (generalFormMatch) {
      formText = generalFormMatch[1].trim();
    }

    const fatigueMatch = text.match(/Fatigue:\s*([A-Za-z\*\s]+)/i);
    const fatigueText = fatigueMatch ? fatigueMatch[1].trim() : 'fit';

    const getSkillFromText = (skillName: string, isStamina: boolean = false): number => {
      const r = new RegExp(`${skillName}\\s*:\\s*([A-Za-z\\*\\s]+)`, 'i');
      const m = text.match(r);
      if (m && m[1]) {
        return getSkillValue(m[1].trim(), isStamina);
      }
      return 0;
    };

    const batting = getSkillFromText('Batting');
    const bowling = getSkillFromText('Bowling');
    const keeping = getSkillFromText('Keeping');
    const concentration = getSkillFromText('Concentration');
    const consistency = getSkillFromText('Consistency');
    const fielding = getSkillFromText('Fielding');
    const stamina = getSkillFromText('Stamina', true);
    const leadership = getSkillFromText('Leadership');
    const experience = getSkillFromText('Experience');

    // Parse matches, runs, and overs across formats for hidden skill estimation
    let runsVal = 0;
    let oversVal = 0;
    let matchesVal = 0;
    let fcStats = { matches: 0, runs: 0, overs: 0 };
    let odStats = { matches: 0, runs: 0, overs: 0 };
    let t20Stats = { matches: 0, runs: 0, overs: 0 };

    if (doc) {
      // 1. Check if we are viewing the raw HTML with tabs
      let activeFormatTab = '';
      const activeTabEl = doc.querySelector('.tabs .selected a');
      if (activeTabEl) {
        const tabText = activeTabEl.textContent?.trim().toUpperCase() || '';
        if (tabText === 'FC') activeFormatTab = 'FC';
        else if (tabText === 'OD' || tabText === 'ODI') activeFormatTab = 'OD';
        else if (tabText === 'BT20' || tabText === 'T20') activeFormatTab = 'T20';
        
        const ths = doc.querySelectorAll('th');
        let currentMatches = 0;
        let currentRuns = 0;
        let currentOvers = 0;

        ths.forEach(th => {
          if (th.textContent?.trim() === 'Career') {
            const row = th.parentElement;
            if (row) {
              const tds = row.querySelectorAll('td');
              // Batting Career row has 11 cells
              if (tds.length >= 11) {
                currentMatches = parseInt(tds[0].textContent?.replace(/,/g, '') || '0', 10) || 0;
                currentRuns = parseInt(tds[2].textContent?.replace(/,/g, '') || '0', 10) || 0;
              } 
              // Bowling Career row has 9 cells
              else if (tds.length >= 9) {
                currentOvers = parseFloat(tds[0].textContent?.replace(/,/g, '') || '0') || 0;
              }
            }
          }
        });

        if (activeFormatTab === 'FC') fcStats = { matches: currentMatches, runs: currentRuns, overs: currentOvers };
        else if (activeFormatTab === 'OD') odStats = { matches: currentMatches, runs: currentRuns, overs: currentOvers };
        else if (activeFormatTab === 'T20') t20Stats = { matches: currentMatches, runs: currentRuns, overs: currentOvers };

        matchesVal = currentMatches;
        runsVal = currentRuns;
        oversVal = currentOvers;
      } else {
        // Fallback for copy-pasted HTML tables that contain the format in the first cell
        const rows = doc.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 11) {
            const firstCellText = cells[0].textContent?.trim() || '';
            if (/^(First\s+Class|One\s+Day|Twenty20|FC|OD|T20)$/i.test(firstCellText)) {
              const m = parseInt(cells[1].textContent?.replace(/,/g, '') || '0', 10) || 0;
              const r = parseInt(cells[2].textContent?.replace(/,/g, '') || '0', 10) || 0;
              const o = parseFloat(cells[10].textContent?.replace(/,/g, '') || '0') || 0;
              matchesVal += m;
              runsVal += r;
              oversVal += o;
              
              if (firstCellText.toLowerCase().includes('first') || firstCellText.toLowerCase() === 'fc') {
                fcStats = { matches: m, runs: r, overs: o };
              } else if (firstCellText.toLowerCase().includes('one') || firstCellText.toLowerCase() === 'od') {
                odStats = { matches: m, runs: r, overs: o };
              } else if (firstCellText.toLowerCase().includes('twenty') || firstCellText.toLowerCase() === 't20') {
                t20Stats = { matches: m, runs: r, overs: o };
              }
            }
          }
        });
      }
    }

    if (matchesVal === 0) {
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^(First\s+Class|One\s+Day|Twenty20|FC|OD|T20)\b/i.test(trimmed)) {
          const parts = trimmed.split(/\s+/);
          let numStartIndex = 1;
          if (/^(First|One)$/i.test(parts[0])) {
            numStartIndex = 2;
          }
          const numericParts = parts.slice(numStartIndex);
          if (numericParts.length >= 10) {
            const m = parseInt(numericParts[0].replace(/,/g, ''), 10) || 0;
            const r = parseInt(numericParts[1].replace(/,/g, ''), 10) || 0;
            const o = parseFloat(numericParts[9].replace(/,/g, '')) || 0;
            matchesVal += m;
            runsVal += r;
            oversVal += o;
            
            if (trimmed.toLowerCase().includes('first') || trimmed.toLowerCase().startsWith('fc')) {
              fcStats = { matches: m, runs: r, overs: o };
            } else if (trimmed.toLowerCase().includes('one') || trimmed.toLowerCase().startsWith('od')) {
              odStats = { matches: m, runs: r, overs: o };
            } else if (trimmed.toLowerCase().includes('twenty') || trimmed.toLowerCase().startsWith('t20')) {
              t20Stats = { matches: m, runs: r, overs: o };
            }
          }
        }
      }
    }

    // Fallback to sensible stats defaults based on role if 0
    if (matchesVal === 0) {
      if (batting > bowling) {
        matchesVal = 32;
        runsVal = 1180;
        oversVal = 2;
      } else if (bowling > batting) {
        matchesVal = 32;
        runsVal = 95;
        oversVal = 125.4;
      } else {
        matchesVal = 32;
        runsVal = 620;
        oversVal = 80.1;
      }
    }

    const player: BattrickPlayer = {
      id: id.toString(),
      name,
      age: Number(age) || 20,
      btRating: Number(btr) || 1000,
      wage: Number(wage) || 500,
      bowlingType: 'unknown',
      role: batting > bowling ? 'Batter' : bowling > batting ? 'Bowler' : 'All-rounder',
      form: 8,
      fitness: 8,
      battingFormLabel: formText,
      fitnessLabel: fatigueText,
      skills: {
        batting,
        bowling,
        keeping,
        concentration,
        consistency,
        fielding,
        stamina,
        leadership,
        experience
      },
      nets: {
        batting: 0,
        bowling: 0,
        keeping: 0,
        fielding: 0,
        stamina: 0
      },
      careerStats: {
        matches: matchesVal,
        runs: runsVal,
        overs: oversVal,
        fc: fcStats,
        od: odStats,
        t20: t20Stats
      }
    };

    return player;
  } catch (err) {
    console.error('Error parsing player details:', err);
    return null;
  }
}

export function estimatePlayerSkills(
  wage: number,
  btr: number,
  runs: number,
  overs: number,
  matches: number
): {
  discipline: string;
  primarySkill: string;
  secondaries: string;
} {
  // 1. Determine Discipline
  const oversPerMatch = overs / (matches || 1);
  const runsPerMatch = runs / (matches || 1);
  let discipline = "Specialist";
  
  if (oversPerMatch < 0.2 && runsPerMatch > 15) discipline = "Batter";
  else if (oversPerMatch > 1.5 && runsPerMatch < 10) discipline = "Bowler";
  else if (oversPerMatch >= 1.0 && runsPerMatch >= 15) discipline = "All-Rounder";

  // 2. Adjust Wage for All-Rounder Inflation
  const effectiveWage = (discipline === "All-Rounder") ? wage * 0.65 : wage;

  // 3. Primary Skill Lookup
  let primarySkill = "Unknown";
  if (effectiveWage < 1200) primarySkill = "Competent (6)";
  else if (effectiveWage < 2500) primarySkill = "Respectable (7)";
  else if (effectiveWage < 5000) primarySkill = "Proficient / Strong (8-9)";
  else if (effectiveWage < 10000) primarySkill = "Superb (10)";
  else if (effectiveWage < 16000) primarySkill = "Quality (11)";
  else if (effectiveWage < 25000) primarySkill = "Remarkable (12)";
  else if (effectiveWage < 40000) primarySkill = "Wonderful (13)";
  else if (effectiveWage < 60000) primarySkill = "Exquisite (14)";
  else if (effectiveWage < 90000) primarySkill = "Masterful (15)";
  else primarySkill = "Sensational+ (16+)";

  // 4. Secondary & Stamina Assessment
  const btrRatio = btr / (wage || 1);
  let secondaries = "Moderate";
  if (btrRatio > 20) secondaries = "High Secondaries / Max Stamina";
  else if (btrRatio < 10) secondaries = "Low Secondaries / Weak Stamina";

  return { discipline, primarySkill, secondaries };
}



