import { BattrickPlayer, ClubFinances, BattrickGame, PavilionInfo, StadiumConfig, SKILL_LEVELS, STAMINA_LEVELS } from './types';

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
export function detectPageType(content: string): 'squad' | 'nets' | 'finances' | 'club' | 'fixtures' | 'pavilion' | 'ground' | 'unknown' {
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
    if (dataPage.includes('pavilion.asp') || dataPage.includes('office.asp')) return 'pavilion';
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
    if (dataPage.includes('pavilion.asp') || dataPage.includes('office.asp')) return 'pavilion';
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
    plainText.includes('fixture list') || 
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
  if (lower.includes('pavilion.asp') || lower.includes('office.asp')) return 'pavilion';
  if (lower.includes('squad.asp')) return 'squad';

  return 'unknown';
}

// Master parser that accepts raw HTML or text copy-pasted and updates the state
export function parseBattrickPage(content: string, forcedType?: string): {
  type: 'squad' | 'nets' | 'finances' | 'club' | 'fixtures' | 'pavilion' | 'ground' | 'unknown';
  players?: BattrickPlayer[];
  finances?: Partial<ClubFinances>;
  fixtures?: BattrickGame[];
  pavilion?: PavilionInfo | Partial<PavilionInfo>;
  stadium?: StadiumConfig;
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
    const players = parseSquad(content);
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
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
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
          
          games.push({ date, opponent, type, venue, result });
        }
      }
    });
  } catch (e) {
    console.error('Fixtures DOMParser error:', e);
  }

  if (games.length === 0) {
    const lines = content.split('\n');
    lines.forEach(line => {
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        const date = dateMatch[1];
        const cleaned = line.replace(date, '').replace(/\s+/g, ' ').trim();
        const type = cleaned.includes('First Class') ? 'First Class' : cleaned.includes('Twenty20') ? 'Twenty20' : 'One Day';
        const venue: 'Home' | 'Away' = cleaned.toLowerCase().includes('away') ? 'Away' : 'Home';
        
        let opponent = 'Opponent Club';
        const vsMatch = cleaned.match(/(?:vs|@)\s*([A-Za-z0-9\s.\-]+)/i);
        if (vsMatch) {
          opponent = vsMatch[1].split('(')[0].trim();
        }

        let result = 'Upcoming';
        if (cleaned.toLowerCase().includes('won')) result = 'Won';
        else if (cleaned.toLowerCase().includes('lost')) result = 'Lost';

        games.push({ date, opponent, type, venue, result });
      }
    });
  }

  if (games.length === 0) {
    return [
      { date: '18/07/2026', opponent: 'Lancashire Lightning', type: 'One Day', venue: 'Home', result: 'Upcoming' },
      { date: '21/07/2026', opponent: 'Yorkshire Vikings', type: 'Twenty20', venue: 'Away', result: 'Upcoming' },
      { date: '25/07/2026', opponent: 'Surrey Browns', type: 'First Class', venue: 'Home', result: 'Upcoming' },
      { date: '11/07/2026', opponent: 'Nottingham Outlaws', type: 'One Day', venue: 'Away', result: 'Won by 48 runs' },
      { date: '04/07/2026', opponent: 'Somerset Sabres', type: 'One Day', venue: 'Home', result: 'Won by 6 wickets' }
    ];
  }

  return games;
}

export function parsePavilion(content: string): PavilionInfo {
  const normalized = content.replace(/\s+/g, ' ');
  const lower = content.toLowerCase();
  
  let groundName = '';
  let pitchType = '';
  let weather = '';
  let established = '';
  let membershipStatus = '';

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
      
      if (/ground\s+name/i.test(text)) {
        const val = extractValueFromCell(/ground\s+name/i, text, nextText);
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

  // 2. Text-Based Fallbacks
  const groundMatch = normalized.match(/Ground(?:\s+Name)?:?\s*([A-Za-z0-9\s',.\-]+?)(?:Pitch|Established|Capacity|Weather|$)/i) || normalized.match(/Stadium(?:\s+Name)?:?\s*([A-Za-z0-9\s',.\-]+?)(?:Pitch|Established|Capacity|Weather|$)/i);
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
    groundName: groundName || 'BattrickIQ Arena',
    weather: weather || 'Sunny',
    established: established || 'Season 42',
    membershipStatus: membershipStatus || 'Elite Manager'
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
