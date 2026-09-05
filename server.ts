import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

function getAiClient(customKey?: string) {
  const key = customKey?.trim() || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured in the server environment. Please configure it in your Settings > Secrets panel.");
  }
  return new GoogleGenAI({ 
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Body parsers with increased payload limits for HTML source code syncs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // In-memory cache for bookmarklet syncs (expiring in 10 mins)
  const bookmarkletCache = new Map<string, { url: string; html: string; timestamp: number }>();

  // Universal CORS middleware for all API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization, Accept');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (req.method === 'OPTIONS' && req.path.startsWith('/api')) {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  // POST endpoint for form-based sync (works with hidden forms inside CSP-restricted pages)
  app.post('/api/sync-bookmarklet-form', (req, res) => {
    const code = (req.query.code || req.body.code) as string;
    const { url, html } = req.body;

    if (!code) {
      res.status(400).send('Error: Sync code is required.');
      return;
    }
    if (!html) {
      res.status(400).send('Error: HTML content is required.');
      return;
    }

    // Store in cache
    const upperCode = code.toUpperCase();
    bookmarkletCache.set(upperCode, {
      url: url || '',
      html,
      timestamp: Date.now()
    });

    console.log(`[Form Bookmarklet Sync] Received and cached data for code: ${upperCode}, URL: ${url}`);

    // Detect what type of page was synced
    let detectedType = "data";
    const lower = (html || "").toLowerCase();
    const urlLower = (url || "").toLowerCase();
    if (urlLower.includes("squad.asp") || lower.includes("squad.asp") || (lower.includes("age:") && lower.includes("wage:"))) {
      detectedType = "squad roster";
    } else if (urlLower.includes("nets.asp") || lower.includes("nets.asp") || lower.includes("nets details") || lower.includes("nets allocation")) {
      detectedType = "nets training";
    } else if (urlLower.includes("club.asp") || lower.includes("club.asp") || lower.includes("public relations") || lower.includes("sports psychologist") || lower.includes("financial advisor")) {
      detectedType = "club staff";
    } else if (urlLower.includes("finances.asp") || lower.includes("finances.asp") || lower.includes("weekly finances") || lower.includes("financial statement") || lower.includes("weekly outgoings") || lower.includes("player salaries") || lower.includes("backroom staff salaries")) {
      detectedType = "club finances";
    } else if (urlLower.includes("fixtures.asp") || lower.includes("fixtures.asp") || lower.includes("fixtures list") || lower.includes("match date")) {
      detectedType = "match fixtures";
    } else if (urlLower.includes("ground.asp") || lower.includes("ground.asp") || lower.includes("seating capacity") || lower.includes("terracing") || lower.includes("standing room")) {
      detectedType = "stadium details";
    } else if (urlLower.includes("pavilion.asp") || lower.includes("pavilion.asp") || lower.includes("pitch state") || lower.includes("weather forecast")) {
      detectedType = "pavilion pitch";
    }

    // Return a page that messages parent and cleans itself up
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sync Success</title>
        <script>
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ 
                type: 'BT_SYNC_SUCCESS', 
                detected: '${detectedType}' 
              }, '*');
            }
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'BT_SYNC_SUCCESS', 
                detected: '${detectedType}' 
              }, '*');
            }
          } catch (e) {
            console.error('Error posting message to parent/opener:', e);
          }
          // Close after short delay if opened in popup, or show success message
          setTimeout(function() {
            try {
              if (window.opener) window.close();
            } catch(err) {}
          }, 1500);
        </script>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; padding-top: 50px; color: #1e293b; background: #f8fafc; margin: 0;">
        <div style="max-width: 400px; margin: 0 auto; padding: 24px; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚡</div>
          <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #0f172a; font-weight: 700;">Sync Complete!</h2>
          <p style="margin: 0; font-size: 14px; color: #475569;">BattrickIQ parsed your <strong style="color: #4f46e5;">${detectedType}</strong>.</p>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8;">This tab will automatically close.</p>
        </div>
      </body>
      </html>
    `);
  });

  // POST endpoint for the bookmarklet to send HTML
  app.post('/api/sync-bookmarklet', (req, res) => {
    const code = req.query.code as string;
    const { url, html } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Sync code is required.' });
      return;
    }
    if (!html) {
      res.status(400).json({ error: 'HTML content is required.' });
      return;
    }

    // Store in cache
    const upperCode = code.toUpperCase();
    bookmarkletCache.set(upperCode, {
      url: url || '',
      html,
      timestamp: Date.now()
    });

    console.log(`[Bookmarklet Sync] Received and cached data for code: ${upperCode}, URL: ${url}`);
    
    // Detect what type of page was synced to return a helpful message to the bookmarklet alert
    let detectedType = "data";
    const lower = (html || "").toLowerCase();
    const urlLower = (url || "").toLowerCase();
    if (urlLower.includes("squad.asp") || lower.includes("squad.asp") || (lower.includes("age:") && lower.includes("wage:"))) {
      detectedType = "squad roster";
    } else if (urlLower.includes("nets.asp") || lower.includes("nets.asp") || lower.includes("nets details") || lower.includes("nets allocation")) {
      detectedType = "nets training";
    } else if (urlLower.includes("club.asp") || lower.includes("club.asp") || lower.includes("public relations") || lower.includes("sports psychologist") || lower.includes("financial advisor")) {
      detectedType = "club staff";
    } else if (urlLower.includes("finances.asp") || lower.includes("finances.asp") || lower.includes("weekly finances") || lower.includes("financial statement") || lower.includes("weekly outgoings") || lower.includes("player salaries") || lower.includes("backroom staff salaries")) {
      detectedType = "club finances";
    } else if (urlLower.includes("fixtures.asp") || lower.includes("fixtures.asp") || lower.includes("fixtures list") || lower.includes("match date")) {
      detectedType = "match fixtures";
    } else if (urlLower.includes("ground.asp") || lower.includes("ground.asp") || lower.includes("seating capacity") || lower.includes("terracing") || lower.includes("standing room")) {
      detectedType = "stadium details";
    } else if (urlLower.includes("pavilion.asp") || lower.includes("pavilion.asp") || lower.includes("pitch state") || lower.includes("weather forecast")) {
      detectedType = "pavilion pitch";
    }

    res.json({ success: true, type: detectedType });
  });

  // GET endpoint for the frontend to poll for new data
  app.get('/api/sync-poll', (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: 'Sync code is required.' });
      return;
    }

    const upperCode = code.toUpperCase();
    const cached = bookmarkletCache.get(upperCode);

    if (cached) {
      bookmarkletCache.delete(upperCode);
      res.json({ hasData: true, url: cached.url, html: cached.html });
    } else {
      res.json({ hasData: false });
    }
  });

  // Periodic cleaner for bookmarklet cache (older than 20 mins)
  setInterval(() => {
    const now = Date.now();
    for (const [code, item] of bookmarkletCache.entries()) {
      if (now - item.timestamp > 20 * 60 * 1000) {
        bookmarkletCache.delete(code);
      }
    }
  }, 60000);

  // In-memory active session cache for step-by-step sequential sync (expires in 15 mins)
  interface BattrickActiveSession {
    cookieHeader: string;
    cookieMap: Record<string, string>;
    username: string;
    timestamp: number;
  }
  const battrickSessionStore = new Map<string, BattrickActiveSession>();

  setInterval(() => {
    const now = Date.now();
    for (const [token, sess] of battrickSessionStore.entries()) {
      if (now - sess.timestamp > 15 * 60 * 1000) {
        battrickSessionStore.delete(token);
      }
    }
  }, 60000);

  // Helper to extract cookies from responses
  const parseCookieString = (c: string, cookieMap: Record<string, string>) => {
    const parts = c.split(';')[0].split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (name && !['path', 'domain', 'expires', 'secure', 'httponly', 'samesite'].includes(name.toLowerCase())) {
        cookieMap[name] = val;
      }
    }
  };

  const extractSetCookies = (res: Response): string[] => {
    if (typeof res.headers.getSetCookie === 'function') {
      return res.headers.getSetCookie();
    }
    const rawCookie = res.headers.get('set-cookie');
    return rawCookie ? rawCookie.split(/,(?=\s*[a-zA-Z0-9_]+\s*=)/) : [];
  };

  // Helper following redirects manually and accumulating Set-Cookie at every hop
  async function fetchFollowingRedirects(
    url: string,
    init: RequestInit,
    cookieMap: Record<string, string>,
    maxHops = 5
  ) {
    let currentUrl = url;
    for (let hop = 0; hop <= maxHops; hop++) {
      const cookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await fetch(currentUrl, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), 'Cookie': cookieHeader },
        redirect: 'manual',
        signal: init.signal || AbortSignal.timeout(12000)
      });
      extractSetCookies(res).forEach(c => parseCookieString(c, cookieMap));

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) return res;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return res;
    }
    throw new Error('redirect count exceeded (manual follow)');
  }

  // Helper to execute Battrick login and establish session using manual redirect loop
  async function authenticateBattrickUser(username: string, password: string): Promise<{
    success: boolean;
    cookieHeader: string;
    cookieMap: Record<string, string>;
    sessionToken?: string;
    error?: string;
    httpStatus?: number;
    blockedByUpstream?: boolean;
  }> {
    try {
      const initialUrl = 'https://www.battrick.org/nl/login.asp?private=1';
      console.log(`[Battrick Sync] 1. GET initial session from: ${initialUrl}`);
      
      const initialRes = await fetch(initialUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: AbortSignal.timeout(15000)
      });

      // Battrick (or a WAF/CDN in front of it) can reject the connection
      // outright - most commonly HTTP 403 (blocked/rate-limited) or 429
      // (too many requests) - before we ever get a real login page back.
      // Previously this fell through silently: no cookies got set, the
      // POST login attempt below was doomed to fail, and the resulting
      // error message said "invalid username or password" - which sent
      // people chasing their credentials for a problem that was actually
      // Battrick blocking this server's outbound connection. Surfacing it
      // here, immediately, with the real HTTP status makes that distinction
      // unambiguous.
      if (!initialRes.ok) {
        console.warn(`[Battrick Sync] Initial connection blocked: HTTP ${initialRes.status} ${initialRes.statusText}`);
        return {
          success: false,
          cookieHeader: '',
          cookieMap: {},
          error: `Battrick's server rejected the initial connection with HTTP ${initialRes.status} ${initialRes.statusText || ''}`.trim() +
            (initialRes.status === 403
              ? `. This is Battrick blocking/rate-limiting this server's outbound request - it happens before any credentials are checked, so it is NOT a username/password issue. It usually means Battrick's WAF has flagged this server's IP address or request pattern.`
              : initialRes.status === 429
              ? `. Battrick is rate-limiting this server - too many requests too quickly. Wait a bit and try again.`
              : `. This is an upstream connectivity issue with Battrick, unrelated to your credentials.`),
          httpStatus: initialRes.status,
          blockedByUpstream: true
        };
      }

      const cookieMap: Record<string, string> = {};
      extractSetCookies(initialRes).forEach(c => parseCookieString(c, cookieMap));
      let cookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      console.log(`[Battrick Sync] GET cookies: ${cookieHeader || 'None'}`);

      // 2. POST to Battrick Login with the initial session cookies following redirects
      const loginParams = new URLSearchParams();
      loginParams.append('username', username);
      loginParams.append('password', password);
      loginParams.append('referrer', '');

      console.log(`[Battrick Sync] 2. POST login credentials for ${username}...`);
      const loginRes = await fetchFollowingRedirects('https://www.battrick.org/nl/login.asp?private=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://www.battrick.org',
          'Referer': 'https://www.battrick.org/nl/login.asp?private=1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        body: loginParams.toString()
      }, cookieMap);

      // Same blocked-vs-bad-credentials distinction as the initial GET
      // above, but for the login POST itself.
      if (loginRes.status === 403 || loginRes.status === 429) {
        console.warn(`[Battrick Sync] Login POST blocked: HTTP ${loginRes.status} ${loginRes.statusText}`);
        return {
          success: false,
          cookieHeader: '',
          cookieMap: {},
          error: `Battrick rejected the login request with HTTP ${loginRes.status} ${loginRes.statusText || ''}`.trim() +
            `. This happened before credentials could be validated - Battrick is blocking/rate-limiting this server, this is not a username/password issue.`,
          httpStatus: loginRes.status,
          blockedByUpstream: true
        };
      }

      cookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      console.log(`[Battrick Sync] Merged active cookies: ${cookieHeader}`);

      const loginBodyHtml = await loginRes.text().catch(() => '');
      const hasValidAuthCookie = Boolean(cookieMap['BTUser'] && cookieMap['BTUser'].length > 0);
      const isExplicitLoginError = loginBodyHtml.includes('Invalid login details') || loginBodyHtml.includes('notification error') || loginBodyHtml.includes('Log In to Battrick');

      if (!hasValidAuthCookie && isExplicitLoginError) {
        console.warn(`[Battrick Auth] Authentication rejected for user ${username}: Invalid login details.`);
        return {
          success: false,
          cookieHeader: '',
          cookieMap: {},
          error: "Battrick returned: 'Invalid login details'. Please double-check your username & password, or switch to the Cut & Paste tab."
        };
      }

      if (!hasValidAuthCookie) {
        console.warn(`[Battrick Auth] Authentication rejected for user ${username}: BTUser auth cookie was not set.`);
        return {
          success: false,
          cookieHeader: '',
          cookieMap: {},
          error: "Battrick authentication failed: Invalid username or password, or session expired. Please verify your credentials or switch to the Cut & Paste tab."
        };
      }

      const sessionToken = `btsess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      battrickSessionStore.set(sessionToken, {
        cookieHeader,
        cookieMap,
        username,
        timestamp: Date.now()
      });

      return {
        success: true,
        cookieHeader,
        cookieMap,
        sessionToken
      };
    } catch (authErr: any) {
      console.error('[Battrick Auth Exception]:', authErr);
      return {
        success: false,
        cookieHeader: '',
        cookieMap: {},
        error: `Could not connect to Battrick server: ${authErr?.message || 'Network request failed'}. Please verify your credentials or use the Cut & Paste tab.`
      };
    }
  }

  // Helper to fetch a single Battrick page using manual redirect loop
  async function fetchBattrickPageWithSession(
    cookieHeader: string,
    cookieMap: Record<string, string>,
    pageUrl: string
  ): Promise<{ success: boolean; html: string; status: number; isRedirect?: boolean; error?: string; updatedCookieHeader?: string }> {
    try {
      const pageRes = await fetchFollowingRedirects(pageUrl, {
        headers: {
          'Referer': 'https://www.battrick.org/nl/login.asp?private=1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      }, cookieMap);

      const html = await pageRes.text();
      const updatedCookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      
      const isRedirected = pageRes.url && pageRes.url.includes('login.asp');
      const hasLoginForms = html.includes("Log In to Battrick") || html.includes("Username:") || html.includes("Password:") || html.includes("login.asp");

      if (isRedirected || hasLoginForms) {
        console.warn(`[Battrick Sync] Redirect/unauthenticated state detected on ${pageUrl}.`);
        return {
          success: false,
          html: '',
          status: pageRes.status,
          isRedirect: true,
          error: 'Authentication failed (redirected to login page)'
        };
      }

      return {
        success: true,
        html,
        status: pageRes.status,
        updatedCookieHeader
      };
    } catch (fetchErr: any) {
      console.error(`[Battrick Page Fetch Exception for ${pageUrl}]:`, fetchErr);
      return {
        success: false,
        html: '',
        status: 0,
        error: `Failed to connect to Battrick: ${fetchErr?.message || 'Network request error'}`
      };
    }
  }

  // API Route for step-by-step sequential sync (with live progression)
  app.post("/api/sync-battrick-step", async (req, res) => {
    // Everything below is wrapped in one try/catch so that no matter what
    // goes wrong (a network failure reaching battrick.org, a bad session,
    // anything), this route ALWAYS answers with JSON. Previously the login
    // and re-authentication branches called authenticateBattrickUser()
    // outside any try/catch - if that threw (e.g. battrick.org was
    // unreachable from the server), Express never sent a response for the
    // request, which left the client fetch() picking up an HTML fallback
    // page instead and failing with "Unexpected token '<' ... is not valid
    // JSON" when it tried to parse that as JSON.
    try {
      const { username, password, sessionToken, pageName, step } = req.body;

      // Step 1: Initial Login and Handshake
      if (step === 'login') {
        if (!username || !password) {
          res.status(400).json({ error: "Username and password are required for login." });
          return;
        }
        const authResult = await authenticateBattrickUser(username.trim(), password);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error || "Login failed.", isAuthFailure: true });
          return;
        }
        res.json({
          success: true,
          sessionToken: authResult.sessionToken,
          message: "Successfully authenticated with Battrick servers."
        });
        return;
      }

      // Step 2: Fetch single page using existing or auto-created session
      if (!pageName && !req.body.matchId && !req.body.pageUrl) {
        res.status(400).json({ error: "pageName, matchId, or pageUrl is required." });
        return;
      }

      const pageUrlMap: Record<string, string> = {
        squad: 'https://www.battrick.org/nl/squad.asp',
        nets: 'https://www.battrick.org/nl/nets.asp',
        finances: 'https://www.battrick.org/nl/finances.asp',
        club: 'https://www.battrick.org/nl/club.asp',
        fixtures: 'https://www.battrick.org/nl/fixtures.asp',
        pavilion: 'https://www.battrick.org/nl/ground.asp',
        ground: 'https://www.battrick.org/nl/ground.asp',
        matchinfo: req.body.matchId ? `https://www.battrick.org/nl/matchinfo.asp?matchID=${req.body.matchId}` : '',
        matchsummary: req.body.matchId ? `https://www.battrick.org/nl/matchinfo.asp?matchID=${req.body.matchId}&action=summary` : ''
      };

      let targetUrl = pageUrlMap[pageName || ''];
      if (req.body.pageUrl) {
        let customUrl = req.body.pageUrl.trim();
        if (customUrl.startsWith('/nl/')) {
          customUrl = `https://www.battrick.org${customUrl}`;
        } else if (customUrl.startsWith('matchinfo.asp') || customUrl.startsWith('fixtures.asp') || customUrl.startsWith('squad.asp')) {
          customUrl = `https://www.battrick.org/nl/${customUrl}`;
        }
        if (customUrl.startsWith('https://www.battrick.org/')) {
          targetUrl = customUrl;
        }
      }

      if (!targetUrl) {
        res.status(400).json({ error: `Unknown page name or invalid target URL: ${pageName}` });
        return;
      }

      let activeSession = sessionToken ? battrickSessionStore.get(sessionToken) : undefined;

      // If session expired or missing but credentials provided, re-authenticate seamlessly
      if (!activeSession && username && password) {
        console.log(`[Battrick Step Sync] Session token not found, re-authenticating user ${username}...`);
        const authResult = await authenticateBattrickUser(username.trim(), password);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error || "Authentication required.", isAuthFailure: true });
          return;
        }
        activeSession = authResult.sessionToken ? battrickSessionStore.get(authResult.sessionToken) : undefined;
      }

      if (!activeSession) {
        res.status(401).json({ error: "Session expired or invalid. Please re-authenticate.", isAuthFailure: true });
        return;
      }

      // Small spacing delay (400ms) to ensure Battrick ASP thread readiness
      await new Promise(resolve => setTimeout(resolve, 400));

      const pageResult = await fetchBattrickPageWithSession(
        activeSession.cookieHeader,
        activeSession.cookieMap,
        targetUrl
      );

      if (pageResult.updatedCookieHeader) {
        activeSession.cookieHeader = pageResult.updatedCookieHeader;
        activeSession.timestamp = Date.now();
      }

      if (!pageResult.success) {
        res.status(pageResult.status >= 400 ? pageResult.status : 502).json({
          error: pageResult.error || `Failed to fetch ${pageName}`,
          pageName,
          isRedirect: pageResult.isRedirect
        });
        return;
      }

      res.json({
        success: true,
        pageName,
        html: pageResult.html,
        sessionToken
      });
    } catch (err: any) {
      console.error(`[Battrick Step Sync] Unhandled error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Unexpected server error while syncing with Battrick.' });
      }
    }
  });

  // Dedicated endpoint for fetching both Match Scorecard and Match Summary in one step
  app.post("/api/sync-battrick-match", async (req, res) => {
    try {
      const { matchId, username, password, sessionToken } = req.body;

      if (!matchId) {
        res.status(400).json({ error: "matchId is required." });
        return;
      }

      let activeSession = sessionToken ? battrickSessionStore.get(sessionToken) : undefined;

      if (!activeSession && username && password) {
        console.log(`[Battrick Match Sync] Session token not found, authenticating user ${username}...`);
        const authResult = await authenticateBattrickUser(username.trim(), password);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error || "Authentication required.", isAuthFailure: true });
          return;
        }
        activeSession = authResult.sessionToken ? battrickSessionStore.get(authResult.sessionToken) : undefined;
      }

      if (!activeSession) {
        res.status(401).json({ error: "Session expired or invalid. Please re-authenticate.", isAuthFailure: true });
        return;
      }

      const matchUrl = `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}`;
      const summaryUrl = `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}&action=summary`;

      console.log(`[Battrick Match Sync] Fetching match scorecard: ${matchUrl}`);
      const matchResult = await fetchBattrickPageWithSession(
        activeSession.cookieHeader,
        activeSession.cookieMap,
        matchUrl
      );

      if (matchResult.updatedCookieHeader) {
        activeSession.cookieHeader = matchResult.updatedCookieHeader;
      }

      await new Promise(resolve => setTimeout(resolve, 350));

      console.log(`[Battrick Match Sync] Fetching match summary: ${summaryUrl}`);
      const summaryResult = await fetchBattrickPageWithSession(
        activeSession.cookieHeader,
        activeSession.cookieMap,
        summaryUrl
      );

      if (summaryResult.updatedCookieHeader) {
        activeSession.cookieHeader = summaryResult.updatedCookieHeader;
        activeSession.timestamp = Date.now();
      }

      res.json({
        success: true,
        matchId,
        matchHtml: matchResult.success ? matchResult.html : '',
        summaryHtml: summaryResult.success ? summaryResult.html : '',
        sessionToken: activeSession ? sessionToken : undefined
      });
    } catch (err: any) {
      console.error(`[Battrick Match Sync] Unhandled error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Unexpected server error while syncing match data.' });
      }
    }
  });

  // Diagnostic Endpoint to test and debug direct Battrick connectivity in real-time
  app.post("/api/debug-battrick-direct", async (req, res) => {
    const { username, password } = req.body;
    const diagLog: string[] = [];

    diagLog.push(`[1/4] Initiating direct diagnostic test at ${new Date().toISOString()}...`);
    
    if (!username || !password) {
      res.status(400).json({ success: false, log: diagLog, error: "Username and password are required for diagnostic test." });
      return;
    }

    try {
      // Step 1: Probe reachability of battrick.org
      diagLog.push(`[2/4] Probing connectivity to https://www.battrick.org/nl/login.asp?private=1 ...`);
      const probeStart = Date.now();
      const probeRes = await fetch('https://www.battrick.org/nl/login.asp?private=1', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(12000)
      });
      const probeDuration = Date.now() - probeStart;
      diagLog.push(`[2/4 Response] HTTP ${probeRes.status} in ${probeDuration}ms. Server: ${probeRes.headers.get('server') || 'Unknown'}`);

      // If Battrick blocked/rate-limited the connection outright, stop here
      // and say so plainly - continuing on to "attempt login" with a
      // connection that was already rejected just produces a misleading
      // "authentication failed" message that sends people chasing their
      // password for a problem that has nothing to do with credentials.
      if (probeRes.status === 403 || probeRes.status === 429) {
        diagLog.push(`[2/4 Blocked] Battrick rejected the connection before any credentials were sent - this is an upstream block/rate-limit, not a login problem.`);
        res.status(200).json({
          success: false,
          stage: 'connectivity',
          error: `Battrick's server blocked this connection with HTTP ${probeRes.status} before any login was attempted. ` +
            (probeRes.status === 403
              ? `This server's IP or request pattern has likely been flagged by Battrick's WAF/anti-bot protection.`
              : `Battrick is rate-limiting requests from this server - wait a bit and try again.`),
          httpStatus: probeRes.status,
          blockedByUpstream: true,
          log: diagLog
        });
        return;
      }

      // Step 2: Attempt full handshake and login
      diagLog.push(`[3/4] Sending login POST for user '${username}'...`);
      const authStart = Date.now();
      const authResult = await authenticateBattrickUser(username.trim(), password);
      const authDuration = Date.now() - authStart;
      
      if (!authResult.success) {
        diagLog.push(`[3/4 Failed] Login failed in ${authDuration}ms. Reason: ${authResult.error}`);
        res.status(200).json({
          success: false,
          stage: authResult.blockedByUpstream ? 'connectivity' : 'authentication',
          error: authResult.error,
          httpStatus: authResult.httpStatus,
          blockedByUpstream: authResult.blockedByUpstream || false,
          log: diagLog
        });
        return;
      }

      diagLog.push(`[3/4 Success] Authenticated in ${authDuration}ms! Acquired session token.`);

      // Step 3: Test squad page fetch with the authenticated session
      diagLog.push(`[4/4] Testing fetch of https://www.battrick.org/nl/squad.asp ...`);
      const pageResult = await fetchBattrickPageWithSession(
        authResult.cookieHeader,
        authResult.cookieMap,
        'https://www.battrick.org/nl/squad.asp'
      );

      if (!pageResult.success) {
        diagLog.push(`[4/4 Failed] Squad fetch failed with status ${pageResult.status}: ${pageResult.error}`);
        res.status(200).json({
          success: false,
          stage: 'page_fetch',
          error: pageResult.error,
          log: diagLog
        });
        return;
      }

      const htmlSnippet = pageResult.html.substring(0, 300).replace(/\s+/g, ' ');
      diagLog.push(`[4/4 Success] Squad page fetched successfully! HTML size: ${pageResult.html.length} bytes.`);
      diagLog.push(`[Preview]: ${htmlSnippet}...`);

      res.json({
        success: true,
        message: "Direct server-to-Battrick connection and authentication test passed with 100% success!",
        htmlLength: pageResult.html.length,
        log: diagLog
      });
    } catch (err: any) {
      diagLog.push(`[Exception]: ${err?.message || err}`);
      res.status(200).json({
        success: false,
        stage: 'exception',
        error: err?.message || 'Unexpected exception during diagnostic test',
        log: diagLog
      });
    }
  });

  // API Route for bulk sync (now executed with strict sequential pacing)
  app.post("/api/sync-battrick", async (req, res) => {
    const { username, password, requestedPages } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    try {
      console.log(`[Battrick Sync] Initializing sequential spaced sync for user ${username}...`);
      const authResult = await authenticateBattrickUser(username.trim(), password);

      if (!authResult.success) {
        res.status(401).json({
          error: authResult.error || "Authentication failed.",
          isAuthFailure: true
        });
        return;
      }

      const allPages = [
        { name: 'squad', url: 'https://www.battrick.org/nl/squad.asp' },
        { name: 'nets', url: 'https://www.battrick.org/nl/nets.asp' },
        { name: 'finances', url: 'https://www.battrick.org/nl/finances.asp' },
        { name: 'club', url: 'https://www.battrick.org/nl/club.asp' },
        { name: 'fixtures', url: 'https://www.battrick.org/nl/fixtures.asp' },
        { name: 'pavilion', url: 'https://www.battrick.org/nl/ground.asp' }
      ];

      const pagesToFetch = Array.isArray(requestedPages) && requestedPages.length > 0
        ? allPages.filter(p => requestedPages.includes(p.name))
        : allPages;

      if (pagesToFetch.length === 0) {
        res.status(400).json({ error: "Please select at least one page to synchronize." });
        return;
      }

      console.log(`[Battrick Sync] Fetching ${pagesToFetch.length} selected pages in sequential spaced order...`);
      const results: { name: string; html: string; success: boolean; status: number; isRedirect?: boolean; error?: string }[] = [];

      for (let i = 0; i < pagesToFetch.length; i++) {
        const page = pagesToFetch[i];
        if (i > 0) {
          // 800ms polite spacing between page requests to prevent Battrick server throttling
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        try {
          const pageResult = await fetchBattrickPageWithSession(
            authResult.cookieHeader,
            authResult.cookieMap,
            page.url
          );
          if (pageResult.updatedCookieHeader) {
            authResult.cookieHeader = pageResult.updatedCookieHeader;
          }

          console.log(`[Battrick Sync] Page ${page.name}: success=${pageResult.success}, status=${pageResult.status}, htmlLen=${pageResult.html.length}`);
          results.push({
            name: page.name,
            html: pageResult.html,
            success: pageResult.success,
            status: pageResult.status,
            isRedirect: pageResult.isRedirect,
            error: pageResult.error
          });
        } catch (e: any) {
          console.error(`[Battrick Sync] Error on ${page.name}:`, e);
          results.push({
            name: page.name,
            html: '',
            success: false,
            status: 0,
            error: e.cause?.message || e.message || String(e)
          });
        }
      }

      // Check if authentication succeeded across results
      let errorMessage = "";
      let isCloudflareBlock = false;

      const anyRedirect = results.find(r => (r as any).isRedirect);
      const anySuccess = results.some(r => r.success && r.html && r.html.length > 500);

      if (anyRedirect) {
        errorMessage = "Battrick authentication failed. Please double-check your username and password, and verify they match your active Battrick.org account.";
      } else if (!anySuccess && results.length > 0) {
        const firstError = results.find(r => !r.success)?.error;
        errorMessage = `Could not authenticate or reach Battrick servers (${firstError || 'Connection error'}). Please verify your credentials or use the 100% reliable Cut & Paste tab.`;
      } else {
        // Check for Cloudflare challenge or maintenance
        for (const resItem of results) {
          if (resItem.html) {
            const title = resItem.html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
            if (resItem.html.includes("cf-challenge") || resItem.html.includes("cloudflare") || resItem.html.includes("Access denied") || resItem.html.includes("attention_required") || title.includes("Cloudflare") || title.includes("Access Denied")) {
              isCloudflareBlock = true;
              errorMessage = "Battrick is currently protected by a Cloudflare security check that blocks automated server requests. Please use the 'Cut & Paste' tab instead—it is highly secure, runs locally, and works 100% of the time!";
              break;
            } else if (resItem.html.includes("Maintenance") || resItem.html.includes("maintenance") || title.includes("Maintenance")) {
              errorMessage = "Battrick.org is currently offline for scheduled maintenance. Please try again later.";
              break;
            }
          }
        }
      }

      if (errorMessage) {
        console.warn(`[Battrick Sync] Direct sync validation failed: ${errorMessage}`);
        res.status(401).json({ 
          error: errorMessage,
          isCloudflareBlock
        });
        return;
      }

      // Return raw HTML data for client-side parsing
      res.json({
        success: true,
        pageStatuses: results.map(r => ({ name: r.name, success: r.success, error: r.error || null })),
        data: {
          squad: results.find(r => r.name === 'squad')?.html || '',
          nets: results.find(r => r.name === 'nets')?.html || '',
          finances: results.find(r => r.name === 'finances')?.html || '',
          club: results.find(r => r.name === 'club')?.html || '',
          fixtures: results.find(r => r.name === 'fixtures')?.html || '',
          pavilion: results.find(r => r.name === 'pavilion')?.html || ''
        }
      });

    } catch (error: any) {
      console.error("Battrick sync proxy error:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred during direct synchronization." });
    }
  });

  // API Route to inspect available LLM providers
  app.get("/api/llm-config", (req, res) => {
    const hasOpenRouter = !!(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== "");
    const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
    res.json({
      hasOpenRouter,
      hasGemini,
      defaultProvider: hasOpenRouter ? "openrouter" : "gemini",
      supportedModels: [
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (Recommended)", provider: "openrouter" },
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", provider: "openrouter" },
        { id: "openai/gpt-4o", name: "GPT-4o", provider: "openrouter" },
        { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "openrouter" },
        { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (via OpenRouter)", provider: "openrouter" },
        { id: "mistralai/mistral-large-2407", name: "Mistral Large", provider: "openrouter" },
        { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Direct Google SDK)", provider: "gemini" }
      ]
    });
  });

  // API Route for AI Coach Assistance (supports OpenRouter & Gemini)
  app.post("/api/coach-chat", async (req, res) => {
    const { message, context, provider = "openrouter", model, customApiKey, openRouterApiKey } = req.body;

    if (!message) {
      res.status(400).json({ error: "A message is required." });
      return;
    }

    const systemInstruction = `You are 'Coach Jarvis', the premier AI Strategic Coach for Battrick, an online multiplayer cricket management game.
Your task is to analyze the user's questions or requests, evaluate their team context (if provided), and deliver highly professional, precise, and strategically sound advice.

Your expertise includes:
1. Trade Selections & Transfer Evaluation: Advise on whether a player should be kept (HOLD), sold (TRADE), trained (DEVELOP), or retired. Estimate their transfer values based on age premiums, skills, and wages.
2. Weekly Training Plans: Suggest the optimal distribution of coaching nets (Max 3 nets per player, up to 10 nets total across the squad). Primary nets (Batting, Bowling, Keeping) should match the player's core role, and secondary nets (Stamina, Fielding) should support overall rating.
3. Financial & Stadium Planning: Advise on weekly budget balances, staff salaries, optimal Financial Advisor (FA) and PR Officer counts, and stadium size expansion.
   - PR Staff ratio: Approx 1 PR Officer per 250 club members (up to 10 max).
   - FA Staff ratio: Approx 1 FA per £1,000,000 in bank balance (up to 10 max) to maximize compound interest. Since each FA costs £1,250/week, FAs are only profitable when your reserves exceed £2,500,000. Hold 0 FAs under £2.5M, and 10 FAs immediately upon crossing £2.5M.
   - Ideal Seating Distribution Ratios: Terracing (60%), Grass Banks (30%), Seats (8%), Executive Boxes (2%).
   - Expansion Capacity Recommendation: Weak/rebuilding (Members * 13), Mid-table (Members * 15), Top-3 (Members * 17), Championship (Members * 20).
4. Home Pitch Recommendation: Analyze their squad players (bowling types/styles and batting skills) and compare them with the current home ground pitch type (found under Current Ground & Pitch Condition). Recommend what the optimal pitch type should be (Flat, Hard, Green, Dusty, Cracked, Uneven) to maximize their home match ratings.
   - If they have strong spin bowlers (bowling styles like OS, SLA, LBG), recommend Dusty or Cracked pitches.
   - If they have strong fast/seam bowlers (bowling styles like RF, LF, RFM, LFM), recommend Green or Hard pitches.
   - If their batting ratings/skills are vastly superior to their weak bowling ratings, suggest Flat to pile on high batting totals.
   - If they have mostly medium-pace bowlers and moderate batsmen, suggest Uneven or Cracked to introduce low/high bounce variance.
5. Opponent Scouting & Match Analysis:
   - Analyze opposition match scorecards and reporter summaries (Top Order #1-3, Middle Order #4-6, Lower Order #7-11).
   - Evaluate Batstat ratings, tail vulnerability (large gap between top and bottom order), and 5th bowler weakness.
   - Propose tailored match orders (GFI, PAN, TIE) and pitch strategies to exploit opposition weaknesses.

Respond with supportive, highly specialized, yet easy-to-read formatting. Use Markdown lists, bold highlights, and clean spacing.`;

    // 1. OPENROUTER FLOW
    const effectiveOpenRouterKey = openRouterApiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    const effectiveProvider = provider === "openrouter" || (effectiveOpenRouterKey && provider !== "gemini") ? "openrouter" : "gemini";

    if (effectiveProvider === "openrouter") {
      if (!effectiveOpenRouterKey) {
        res.status(401).json({ 
          error: "OpenRouter API Key is missing. Please enter your OpenRouter key in the AI Coach settings or configure OPENROUTER_API_KEY in the environment secrets." 
        });
        return;
      }

      const targetModel = model || "anthropic/claude-3.5-sonnet";
      console.log(`[AI Coach] Generating response via OpenRouter with model ${targetModel}...`);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${effectiveOpenRouterKey}`,
            "HTTP-Referer": "https://ai.studio/build",
            "X-Title": "BattrickIQ AI Coach",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: `[TEAM CONTEXT]:\n${context || "No context provided yet."}\n\n[USER INQUIRY]:\n${message}` }
            ],
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error("OpenRouter API error response:", errData);
          const errorMsg = errData?.error?.message || `OpenRouter returned HTTP status ${response.status}`;
          res.status(response.status).json({ error: errorMsg });
          return;
        }

        const data = await response.json();
        const replyText = data.choices?.[0]?.message?.content || "No response generated from OpenRouter.";

        res.json({
          success: true,
          reply: replyText,
          provider: "openrouter",
          model: targetModel
        });
        return;

      } catch (orErr: any) {
        console.error("OpenRouter network error:", orErr);
        res.status(500).json({ error: orErr.message || "Failed to communicate with OpenRouter API." });
        return;
      }
    }

    // 2. GEMINI FLOW (Fallback / Alternative)
    try {
      const ai = getAiClient(customApiKey);
      console.log(`[AI Coach] Generating response via Google Gemini (gemini-3.8-flash)...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `[TEAM CONTEXT]:\n${context || "No context provided yet."}\n\n[USER INQUIRY]:\n${message}`,
        config: {
          systemInstruction: systemInstruction,
        },
      });

      res.json({
        success: true,
        reply: response.text,
        provider: "gemini",
        model: "gemini-3.8-flash"
      });

    } catch (error: any) {
      console.error("Gemini API error:", error);
      const isAuthErr = error?.status === 401 || error?.message?.includes("UNAUTHENTICATED") || error?.message?.includes("invalid authentication credentials") || error?.message?.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED");
      const errorDetail = isAuthErr 
        ? "Gemini API key is invalid or not yet configured. Please check your GEMINI_API_KEY in the Settings > Secrets panel or switch to OpenRouter." 
        : (error.message || "An error occurred while generating AI advice.");
      res.status(500).json({ error: errorDetail });
    }
  });

  // Catch-all 404 handler for API routes to guarantee they NEVER return HTML fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found.` });
  });

  // Determine if we should run in development mode with Vite middleware
  const isDev = process.env.NODE_ENV !== "production";

  // Vite middleware for development
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
