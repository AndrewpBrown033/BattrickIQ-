import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiClient: any = null;
function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured in the server environment. Please define it in your Secrets panel.");
    }
    aiClient = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers with increased payload limits for HTML source code syncs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // In-memory cache for bookmarklet syncs (expiring in 10 mins)
  const bookmarkletCache = new Map<string, { url: string; html: string; timestamp: number }>();

  // CORS middleware specifically for the bookmarklet endpoints
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/sync-')) {
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (req.method === 'OPTIONS' && req.path.startsWith('/api/sync-')) {
      res.sendStatus(200);
      return;
    }
    next();
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

  // API Route for live sync proxying
  app.post("/api/sync-battrick", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    try {
      console.log(`[Battrick Sync] Initializing sync for username: ${username}`);
      
      // 1. GET initial login page to get initial session cookies (ASPSESSIONID, etc.)
      const initialUrl = 'https://www.battrick.org/nl/login.asp?private=1';
      console.log(`[Battrick Sync] 1. GET initial session from: ${initialUrl}`);
      const initialRes = await fetch(initialUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });

      // Extract set-cookie headers from GET
      let initialCookies: string[] = [];
      if (typeof initialRes.headers.getSetCookie === 'function') {
        initialCookies = initialRes.headers.getSetCookie();
      } else {
        const rawCookie = initialRes.headers.get('set-cookie');
        if (rawCookie) {
          initialCookies = rawCookie.split(/,(?=\s*[a-zA-Z0-9_]+\s*=)/);
        }
      }
      
      const initialCookieMap: Record<string, string> = {};
      const parseCookie = (c: string) => {
        const parts = c.split(';')[0].split('=');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if (name && !['path', 'domain', 'expires', 'secure', 'httponly', 'samesite'].includes(name.toLowerCase())) {
            initialCookieMap[name] = val;
          }
        }
      };
      
      initialCookies.forEach(parseCookie);
      let cookieHeader = Object.entries(initialCookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      console.log(`[Battrick Sync] GET cookies: ${cookieHeader || 'None'}`);

      // 2. POST to Battrick Login with the initial session cookies
      const loginParams = new URLSearchParams();
      loginParams.append('username', username);
      loginParams.append('password', password);
      loginParams.append('referrer', '');

      console.log(`[Battrick Sync] 2. POST login credentials...`);
      const loginRes = await fetch('https://www.battrick.org/nl/login.asp?private=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Origin': 'https://www.battrick.org',
          'Referer': 'https://www.battrick.org/nl/login.asp?private=1'
        },
        body: loginParams.toString(),
        redirect: 'manual'
      });

      console.log(`[Battrick Sync] POST status: ${loginRes.status} ${loginRes.statusText}`);
      console.log(`[Battrick Sync] POST redirect location: ${loginRes.headers.get('location') || 'None'}`);

      // Extract set-cookie headers from POST
      let postCookies: string[] = [];
      if (typeof loginRes.headers.getSetCookie === 'function') {
        postCookies = loginRes.headers.getSetCookie();
      } else {
        const rawCookie = loginRes.headers.get('set-cookie');
        if (rawCookie) {
          postCookies = rawCookie.split(/,(?=\s*[a-zA-Z0-9_]+\s*=)/);
        }
      }

      // Merge POST cookies into our map
      postCookies.forEach(parseCookie);
      cookieHeader = Object.entries(initialCookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      console.log(`[Battrick Sync] Merged active cookies: ${cookieHeader}`);

      // 3. Fetch standard club pages in parallel
      const pages = [
        { name: 'squad', url: 'https://www.battrick.org/nl/squad.asp' },
        { name: 'nets', url: 'https://www.battrick.org/nl/nets.asp' },
        { name: 'finances', url: 'https://www.battrick.org/nl/finances.asp' },
        { name: 'club', url: 'https://www.battrick.org/nl/club.asp' },
        { name: 'fixtures', url: 'https://www.battrick.org/nl/fixtures.asp' },
        { name: 'pavilion', url: 'https://www.battrick.org/nl/ground.asp' }
      ];

      console.log(`[Battrick Sync] 3. Fetching Battrick pages in parallel...`);
      const results = await Promise.all(
        pages.map(async (page) => {
          try {
            const pageRes = await fetch(page.url, {
              headers: {
                'Cookie': cookieHeader,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://www.battrick.org/nl/login.asp?private=1'
              },
              redirect: 'follow'
            });

            const html = await pageRes.text();
            console.log(`[Battrick Sync] Fetched ${page.name}: status ${pageRes.status}, size: ${html.length}, url: ${pageRes.url}`);

            // Detect redirect to login page (either via url change or html containing login elements)
            const isRedirected = pageRes.url && (pageRes.url.includes('login.asp') || pageRes.url.includes('login.asp?private=1'));
            const hasLoginForms = html.includes("Log In to Battrick") || html.includes("Username:") || html.includes("Password:") || html.includes("login.asp");

            if (isRedirected || hasLoginForms) {
              console.warn(`[Battrick Sync] Redirect/unauthenticated state detected on page ${page.name}. Authentication rejected.`);
              return { 
                name: page.name, 
                html: '', 
                success: false, 
                status: 200, 
                isRedirect: true,
                error: 'Authentication failed (redirected to login page)' 
              };
            }

            return { name: page.name, html, success: true, status: pageRes.status };
          } catch (e: any) {
            console.error(`[Battrick Sync] Error fetching ${page.name}:`, e);
            return { name: page.name, html: '', success: false, status: 0, error: e.message || String(e) };
          }
        })
      );

      // Check if squad HTML looks valid or if we got redirected to the login page
      const squadResult = results.find(r => r.name === 'squad');
      let errorMessage = "";
      let isCloudflareBlock = false;

      if (!squadResult) {
        errorMessage = "Failed to connect to Battrick.org. Please try again later.";
      } else if (!squadResult.success) {
        if (squadResult.isRedirect) {
          errorMessage = "Battrick authentication failed. Please double-check your username and password, and verify they match your active Battrick.org account.";
        } else {
          errorMessage = `Could not reach Battrick servers: ${squadResult.error || 'Connection timed out'}.`;
        }
      } else {
        const html = squadResult.html || "";
        const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";

        if (html.includes("cf-challenge") || html.includes("cloudflare") || html.includes("Access denied") || html.includes("attention_required") || title.includes("Cloudflare") || title.includes("Access Denied")) {
          isCloudflareBlock = true;
          errorMessage = "Battrick is currently protected by a Cloudflare security check that blocks automated server requests. Please use the 'Manual Paste' tab instead—it is highly secure, runs locally, and works 100% of the time!";
        } else if (html.includes("Log In to Battrick") || html.includes("Username:") || html.includes("Password:") || title.includes("Log In")) {
          errorMessage = "Battrick authentication failed. Please double-check your username and password, and verify they match your active Battrick.org account.";
        } else if (html.includes("Maintenance") || html.includes("maintenance") || title.includes("Maintenance")) {
          errorMessage = "Battrick.org is currently offline for scheduled maintenance. Please try again later.";
        } else if (!html.includes("Age:")) {
          errorMessage = "Successfully connected to Battrick, but your squad roster page could not be parsed. Please verify you are logged into a valid active account or use the 'Manual Paste' option.";
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

  // API Route for AI Coach Assistance
  app.post("/api/coach-chat", async (req, res) => {
    const { message, context, customApiKey } = req.body;

    if (!message) {
      res.status(400).json({ error: "A message is required." });
      return;
    }

    try {
      let ai;
      if (customApiKey && customApiKey.trim() !== "") {
        console.log(`[AI Coach] Instantiating Gemini client with custom manager-provided key...`);
        ai = new GoogleGenAI({ 
          apiKey: customApiKey.trim(),
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      } else {
        ai = getAiClient();
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

Respond with supportive, highly specialized, yet easy-to-read formatting. Use Markdown lists, bold highlights, and clean spacing.`;

      const contents = [
        { role: "user", parts: [{ text: `${systemInstruction}\n\n[TEAM CONTEXT]:\n${context || "No context provided yet."}\n\n[USER INQUIRY]:\n${message}` }] }
      ];

      console.log(`[AI Coach] Generating response for message...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents
      });

      res.json({
        success: true,
        reply: response.text
      });

    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "An error occurred with Coach Jarvis's speech synthesizer." });
    }
  });

  // Determine if we should run in development mode with Vite middleware
  const isDev = process.env.NODE_ENV !== "production" || !process.argv[1]?.includes('dist/server.cjs');

  // Vite middleware for development
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Only serve index.html for navigation requests, not for missing assets/scripts
      if (req.headers.accept?.includes('text/html') || (!req.path.includes('.') && !req.path.startsWith('/api'))) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        res.status(404).set('Content-Type', 'text/plain').send('Not Found');
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
