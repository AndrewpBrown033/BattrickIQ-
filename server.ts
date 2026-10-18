import express from "express";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      const origin = req.headers.origin;
      if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
      else res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Authorization, Accept");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS" && req.path.startsWith("/api")) {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  interface Sess {
    cookieHeader: string;
    cookieMap: Record<string, string>;
    username: string;
    timestamp: number;
  }
  const sessions = new Map<string, Sess>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, s] of sessions.entries()) {
      if (now - s.timestamp > 60 * 60 * 1000) sessions.delete(k);
    }
  }, 60000);

  const parseCookie = (c: string, map: Record<string, string>) => {
    const parts = c.split(";")[0].split("=");
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      if (name && !["path", "domain", "expires", "secure", "httponly", "samesite"].includes(name.toLowerCase())) {
        map[name] = val;
      }
    }
  };
  const extractCookies = (res: Response): string[] => {
    if (typeof (res.headers as any).getSetCookie === "function") return (res.headers as any).getSetCookie();
    const raw = res.headers.get("set-cookie");
    return raw ? raw.split(/,(?=\s*[a-zA-Z0-9_]+\s*=)/) : [];
  };

  let lastReq = 0;
  async function spaceOut() {
    const elapsed = Date.now() - lastReq;
    if (elapsed < 3000) await new Promise((r) => setTimeout(r, 3000 - elapsed));
    lastReq = Date.now();
  }

  async function fetchBT(
    url: string,
    init: RequestInit,
    cookieMap: Record<string, string>,
    maxHops = 5,
    maxRetries = 3
  ): Promise<Response> {
    let last: Response | null = null;
    for (let retry = 0; retry <= maxRetries; retry++) {
      if (retry > 0) await new Promise((r) => setTimeout(r, 2500 * retry));
      await spaceOut();
      let currentUrl = url;
      for (let hop = 0; hop <= maxHops; hop++) {
        const cookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ");
        const response = await fetch(currentUrl, {
          ...init,
          headers: { ...(init.headers as Record<string, string>), Cookie: cookieHeader },
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });
        extractCookies(response).forEach((c) => parseCookie(c, cookieMap));
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location) { last = response; break; }
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        last = response;
        if (response.status === 429) break;
        return response;
      }
      if (last && last.status !== 429) return last;
    }
    if (last) return last;
    throw new Error("HTTP 429 from Battrick after retries");
  }

  async function authenticate(username: string, password: string) {
    const cookieMap: Record<string, string> = {};
    const loginUrl = "https://www.battrick.org/nl/login.asp?private=1";
    await fetchBT(loginUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }, cookieMap);
    const params = new URLSearchParams();
    params.set("username", username);
    params.set("password", password);
    params.set("login", "Log In");
    const loginRes = await fetchBT(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://www.battrick.org",
        Referer: loginUrl,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      body: params.toString(),
    }, cookieMap);
    const html = await loginRes.text().catch(() => "");
    const ok = Boolean(cookieMap["BTUser"] && cookieMap["BTUser"].length > 0);
    if (!ok) {
      return {
        success: false as const,
        error: html.includes("Invalid login") ? "Invalid login details" : "Auth failed — no BTUser cookie",
      };
    }
    const cookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ");
    const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessions.set(sessionToken, { cookieHeader, cookieMap, username, timestamp: Date.now() });
    return { success: true as const, sessionToken, cookieHeader, cookieMap };
  }

  async function fetchPage(cookieMap: Record<string, string>, pageUrl: string, postBody?: string) {
    const headers: Record<string, string> = {
      Referer: /transfer/i.test(pageUrl)
        ? "https://www.battrick.org/nl/transfers.asp"
        : "https://www.battrick.org/nl/myoffice.asp",
      Origin: "https://www.battrick.org",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    const init: RequestInit = { headers };
    if (postBody) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.method = "POST";
      init.body = postBody;
    }
    const res = await fetchBT(pageUrl, init, cookieMap);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      return { success: false, html: "", status: res.status, error: `Redirect ${res.status}` };
    }
    const html = await res.text();
    const cookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ");
    return { success: res.ok, html, status: res.status, updatedCookieHeader: cookieHeader };
  }

  function pickSearchForm(html: string) {
    const forms = [...html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/gi)].map((m) => {
      const attrs = m[1] || "";
      const inner = m[2] || "";
      const fieldCount = (inner.match(/<(?:input|select)\b/gi) || []).length;
      const isLogin = /type=["']?password/i.test(inner);
      const action = (attrs.match(/action=["']([^"']*)["']/i) || [])[1] || "";
      const method = ((attrs.match(/method=["']?(\w+)/i) || [])[1] || "post").toLowerCase();
      const looksTransfer = /transfer|skill|bat|bowl|age|price|bid/i.test(inner) ? 1 : 0;
      return { inner, action, method, score: isLogin ? -1 : fieldCount + looksTransfer * 50 };
    });
    forms.sort((a, b) => b.score - a.score);
    return forms[0] && forms[0].score >= 0 ? forms[0] : null;
  }

  function buildFormParams(html: string, skillMins: Record<string, number> = {}) {
    const params = new URLSearchParams();
    const picked = pickSearchForm(html);
    if (!picked) {
      params.set("search", "Search");
      return params;
    }
    const formInner = picked.inner;
    const inputRe = /<input([^>]+)>/gi;
    let im: RegExpExecArray | null;
    while ((im = inputRe.exec(formInner)) !== null) {
      const tag = im[1];
      const nameM = tag.match(/name=["']([^"']+)["']/i);
      if (!nameM) continue;
      const name = nameM[1];
      const typeM = tag.match(/type=["']([^"']+)["']/i);
      const type = (typeM ? typeM[1] : "text").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        if (!/\schecked\b/i.test(tag)) continue;
      }
      if (type === "submit" || type === "button" || type === "image") {
        const valM = tag.match(/value=["']([^"']*)["']/i);
        const val = valM ? valM[1] : "Search";
        if (/search|find|go|submit/i.test(val) || /search|find/i.test(name)) params.set(name, val);
        continue;
      }
      const valM = tag.match(/value=["']([^"']*)["']/i);
      params.set(name, valM ? valM[1] : "");
    }
    const selectRe = /<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = selectRe.exec(formInner)) !== null) {
      const selName = sm[1];
      const opt =
        sm[2].match(/<option[^>]*selected[^>]*value=["']([^"']*)["']/i) ||
        sm[2].match(/<option[^>]*value=["']([^"']*)["'][^>]*selected/i) ||
        sm[2].match(/<option[^>]*value=["']([^"']*)["']/i);
      params.set(selName, opt ? opt[1] : "");
    }
    for (let i = 1; i <= 4; i++) {
      params.delete(`SkillType${i}`);
      params.delete(`SkillMin${i}`);
      params.delete(`SkillMax${i}`);
    }
    const SKILL_IDS: Record<string, number> = {
      stamina: 1, batting: 2, bowling: 3, seam: 3, spin: 3, consistency: 4,
      concentration: 5, fielding: 6, keeping: 7, wicketkeeping: 7, experience: 8,
    };
    const ranked: { skill: string; id: number; level: number }[] = [];
    const usedIds = new Set<number>();
    for (const [skill, min] of Object.entries(skillMins || {})) {
      const id = SKILL_IDS[String(skill).toLowerCase().replace(/[\s_-]/g, "")];
      const level = Math.max(0, Math.min(16, Math.round(Number(min))));
      if (!id || usedIds.has(id) || !level) continue;
      usedIds.add(id);
      ranked.push({ skill, id, level });
    }
    ranked.sort((a, b) => b.level - a.level);
    let slot = 1;
    for (const r of ranked.slice(0, 2)) {
      params.set(`SkillType${slot}`, String(r.id));
      params.set(`SkillMin${slot}`, String(r.level));
      params.set(`SkillMax${slot}`, "20");
      slot++;
    }
    return params;
  }

  app.post("/api/sync-battrick-step", async (req, res) => {
    try {
      const { username, password, sessionToken, pageName, step } = req.body || {};
      if (step === "login") {
        if (!username || !password) {
          res.status(400).json({ error: "Username and password required" });
          return;
        }
        const auth = await authenticate(String(username).trim(), String(password));
        if (!auth.success) {
          res.status(401).json({ error: auth.error || "Login failed", isAuthFailure: true });
          return;
        }
        res.json({ success: true, sessionToken: auth.sessionToken, message: "Authenticated" });
        return;
      }

      if (!pageName && !req.body.pageUrl) {
        res.status(400).json({ error: "pageName or pageUrl required" });
        return;
      }

      const pageKey = String(pageName || "").toLowerCase().trim();
      const pageUrlMap: Record<string, string> = {
        squad: "https://www.battrick.org/nl/squad.asp",
        "squad.asp": "https://www.battrick.org/nl/squad.asp",
        nets: "https://www.battrick.org/nl/nets.asp",
        "nets.asp": "https://www.battrick.org/nl/nets.asp",
        finances: "https://www.battrick.org/nl/finances.asp",
        "finances.asp": "https://www.battrick.org/nl/finances.asp",
        diary: "https://www.battrick.org/nl/diary.asp",
        "diary.asp": "https://www.battrick.org/nl/diary.asp",
        fixtures: "https://www.battrick.org/nl/fixtures.asp",
        "fixtures.asp": "https://www.battrick.org/nl/fixtures.asp",
        club: "https://www.battrick.org/nl/club.asp",
        "club.asp": "https://www.battrick.org/nl/club.asp",
        myoffice: "https://www.battrick.org/nl/myoffice.asp",
        "myoffice.asp": "https://www.battrick.org/nl/myoffice.asp",
        transfers: "https://www.battrick.org/nl/transfers.asp",
        "transfers.asp": "https://www.battrick.org/nl/transfers.asp",
        transferlist: "https://www.battrick.org/nl/transfers.asp",
        transfer: "https://www.battrick.org/nl/transfers.asp",
        "transferlist.asp": "https://www.battrick.org/nl/transfers.asp",
        ground: "https://www.battrick.org/nl/ground.asp",
        "ground.asp": "https://www.battrick.org/nl/ground.asp",
      };

      let targetUrl = pageUrlMap[pageKey];
      if (req.body.pageUrl) {
        let custom = String(req.body.pageUrl).trim();
        if (custom.startsWith("/nl/")) custom = `https://www.battrick.org${custom}`;
        else if (/^[a-z0-9_.-]+\.asp(\?|$)/i.test(custom)) custom = `https://www.battrick.org/nl/${custom}`;
        if (custom.startsWith("https://www.battrick.org/")) targetUrl = custom;
      }
      if (!targetUrl && pageKey) {
        const asp = pageKey.endsWith(".asp") ? pageKey : `${pageKey}.asp`;
        if (/^[a-z0-9_.-]+\.asp$/i.test(asp)) targetUrl = `https://www.battrick.org/nl/${asp}`;
      }
      if (!targetUrl) {
        res.status(400).json({ error: `Unknown page: ${pageName}` });
        return;
      }

      let active = sessionToken ? sessions.get(sessionToken) : undefined;
      if (!active && username && password) {
        const auth = await authenticate(String(username).trim(), String(password));
        if (!auth.success) {
          res.status(401).json({ error: auth.error || "Re-auth failed", isAuthFailure: true });
          return;
        }
        active = sessions.get(auth.sessionToken!);
      }
      if (!active) {
        res.status(401).json({ error: "No session — login first", isAuthFailure: true });
        return;
      }

      let pageResult = await fetchPage(active.cookieMap, targetUrl);
      if (pageResult.updatedCookieHeader) {
        active.cookieHeader = pageResult.updatedCookieHeader;
        active.timestamp = Date.now();
      }
      if (!pageResult.success) {
        res.status(pageResult.status >= 400 ? pageResult.status : 502).json({
          error: pageResult.error || `Failed to fetch ${pageName}`,
          pageName,
        });
        return;
      }

      const transferDebug: Record<string, unknown> = {};
      if (/transfer/i.test(pageKey) || /transfers?(?:list)?\.asp/i.test(targetUrl)) {
        try {
          const html0 = pageResult.html || "";
          const clientPost = typeof req.body.postBody === "string" ? req.body.postBody : "";
          const skillMins: Record<string, number> =
            req.body.skillMins && typeof req.body.skillMins === "object" ? req.body.skillMins : {};
          const countHits = (h: string) => {
            const tables = h.match(/<table[^>]*class=["']rtable["'][\s\S]*?<\/table>/gi) || [];
            return {
              playerLinks: tables.filter((t) => /playerdetails\.asp/i.test(t)).length,
              markers: /\d[\d,]*\s+Players?\s+found/i.test(h) || /Transfer\s+Search\s+Results/i.test(h) ? 2 : 0,
            };
          };
          const first = countHits(html0);
          transferDebug.initial = { length: html0.length, ...first };
          if (clientPost || (first.playerLinks < 3 && first.markers < 2)) {
            const form = pickSearchForm(html0);
            const params = clientPost
              ? new URLSearchParams(clientPost)
              : buildFormParams(html0, skillMins);
            transferDebug.form = form ? { action: form.action, method: form.method } : null;
            transferDebug.params = Object.fromEntries(params.entries());
            let submitUrl = targetUrl;
            if (form?.action) {
              try { submitUrl = new URL(form.action, targetUrl).toString(); } catch {}
              if (!submitUrl.startsWith("https://www.battrick.org/")) submitUrl = targetUrl;
            }
            const useGet = !clientPost && form?.method === "get";
            const attempt = useGet
              ? await fetchPage(active.cookieMap, `${submitUrl}${submitUrl.includes("?") ? "&" : "?"}${params.toString()}`)
              : await fetchPage(active.cookieMap, submitUrl, params.toString());
            if (attempt.updatedCookieHeader) {
              active.cookieHeader = attempt.updatedCookieHeader;
              active.timestamp = Date.now();
            }
            const after = attempt.html ? countHits(attempt.html) : { playerLinks: 0, markers: 0 };
            transferDebug.search = { method: useGet ? "GET" : "POST", status: attempt.status, length: (attempt.html || "").length, ...after };
            if (attempt.success && attempt.html && attempt.html.length > 500) pageResult = attempt;
          }

          const maxPages = Math.min(10, Math.max(1, Number(req.body.maxPages) || 8));
          let pagesFetched = 1;
          let current = pageResult.html || "";
          const found = (current.match(/(\d[\d,]*)\s+Players?\s+found/i) || [])[1];
          const extra: string[] = [];
          while (pagesFetched < maxPages) {
            const nextHref = (current.match(/href=["'](transferlist\.asp\?startP=\d+[^"']*)["'][^>]*class=["']next["']/i) ||
              current.match(/class=["']next["'][^>]*href=["'](transferlist\.asp\?startP=\d+[^"']*)["']/i) || [])[1];
            if (!nextHref) break;
            const nextPage = await fetchPage(active.cookieMap, new URL(nextHref.replace(/&/g, "&"), targetUrl).toString());
            if (!nextPage.success || !nextPage.html) break;
            current = nextPage.html;
            pagesFetched++;
            (current.match(/<table[^>]*class=["']rtable["'][\s\S]*?<\/table>/gi) || []).forEach((t) => extra.push(t));
          }
          if (extra.length) pageResult = { ...pageResult, html: (pageResult.html || "") + "\n" + extra.join("\n") };
          transferDebug.paging = { found: found ? Number(found.replace(/,/g, "")) : null, pagesFetched };
        } catch (e: any) {
          transferDebug.error = String(e?.message || e);
          console.warn("Transfer auto-search failed", e?.message || e);
        }
      }

      res.json({
        success: true,
        html: pageResult.html,
        transferDebug: Object.keys(transferDebug).length ? transferDebug : undefined,
        pageName,
        sessionToken: sessionToken || undefined,
      });
    } catch (err: any) {
      console.error("sync-battrick-step error", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Server error" });
      }
    }
  });

  app.post("/api/sync-battrick-match", async (req, res) => {
    try {
      const { username, password, sessionToken } = req.body || {};
      const matchId = String(req.body?.matchId || "").replace(/\D/g, "");
      if (!matchId) {
        res.status(400).json({ error: "matchId required" });
        return;
      }
      let active = sessionToken ? sessions.get(sessionToken) : undefined;
      let newToken: string | undefined;
      if (!active && username && password) {
        const auth = await authenticate(String(username).trim(), String(password));
        if (!auth.success) {
          res.status(401).json({ error: auth.error || "Login failed", isAuthFailure: true });
          return;
        }
        newToken = auth.sessionToken;
        active = sessions.get(auth.sessionToken!);
      }
      if (!active) {
        res.status(401).json({ error: "No session — login first", isAuthFailure: true });
        return;
      }
      const base = `https://www.battrick.org/nl/matchinfo.asp?matchID=${matchId}`;
      const match = await fetchPage(active.cookieMap, base);
      if (!match.success) {
        res.status(match.status >= 400 ? match.status : 502).json({ error: match.error || `Failed to fetch match ${matchId}` });
        return;
      }
      await spaceOut();
      const summary = await fetchPage(active.cookieMap, `${base}&action=summary`);
      active.timestamp = Date.now();
      res.json({
        success: true,
        matchId,
        matchHtml: match.html,
        summaryHtml: summary.success ? summary.html : "",
        sessionToken: newToken || sessionToken || undefined,
      });
    } catch (err: any) {
      console.error("sync-battrick-match error", err);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Server error" });
    }
  });

  // Place a bid on a transfer-listed player. Battrick's player page has a `makeBid` form with a
  // `bidValue` field (see playerdetails.asp verifyForm). We load the page, copy that form exactly
  // (hidden fields included), set bidValue, and submit it; then confirm from the page that comes back.
  app.post("/api/battrick-place-bid", async (req, res) => {
    try {
      const { playerId, bidValue, username, password, sessionToken } = req.body || {};
      const pid = String(playerId || "");
      const bid = Math.round(Number(bidValue));
      if (!/^\d{3,12}$/.test(pid)) {
        res.status(400).json({ success: false, error: "Invalid playerId" });
        return;
      }
      if (!Number.isFinite(bid) || bid < 1000 || bid > 2_000_000_000) {
        res.status(400).json({ success: false, error: "Invalid bid value" });
        return;
      }

      let active = sessionToken ? sessions.get(String(sessionToken)) : undefined;
      if (!active && username && password) {
        const auth = await authenticate(String(username).trim(), String(password));
        if (!auth.success) {
          res.status(401).json({ success: false, error: auth.error || "Login failed", isAuthFailure: true });
          return;
        }
        active = sessions.get(auth.sessionToken!);
      }
      if (!active) {
        res.status(401).json({ success: false, error: "No session — login first", isAuthFailure: true });
        return;
      }

      const playerUrl = `https://www.battrick.org/nl/playerdetails.asp?playerID=${pid}`;
      const page = await fetchPage(active.cookieMap, playerUrl);
      if (!page.success || !page.html) {
        res.status(502).json({ success: false, error: "Could not load the player page" });
        return;
      }

      const forms = [...page.html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/gi)];
      const bidForm = forms.find((m) => /name=["']makeBid["']/i.test(m[1]) || /name=["']bidValue["']/i.test(m[2]));
      if (!bidForm) {
        res.status(409).json({
          success: false,
          error: "No bid form on this player's page — the listing has ended, or he is your own player.",
        });
        return;
      }

      const params = new URLSearchParams();
      for (const im of bidForm[2].matchAll(/<input([^>]*)>/gi)) {
        const tag = im[1];
        const name = (tag.match(/name=["']([^"']+)["']/i) || [])[1];
        if (!name) continue;
        const type = ((tag.match(/type=["']([^"']+)["']/i) || [])[1] || "text").toLowerCase();
        if ((type === "checkbox" || type === "radio") && !/\schecked\b/i.test(tag)) continue;
        params.set(name, (tag.match(/value=["']([^"']*)["']/i) || [])[1] ?? "");
      }
      params.set("bidValue", String(bid));

      const action = (bidForm[1].match(/action=["']([^"']*)["']/i) || [])[1] || `playerdetails.asp?playerID=${pid}`;
      let submitUrl = playerUrl;
      try { submitUrl = new URL(action.replace(/&amp;/g, "&"), playerUrl).toString(); } catch {}
      if (!submitUrl.startsWith("https://www.battrick.org/")) submitUrl = playerUrl;

      const posted = await fetchPage(active.cookieMap, submitUrl, params.toString());
      if (!posted.success || !posted.html) {
        res.status(502).json({ success: false, error: `Battrick rejected the bid request (HTTP ${posted.status})` });
        return;
      }

      // Confirm from the returned page rather than assuming success.
      const text = posted.html.replace(/&nbsp;/gi, " ").replace(/&#163;|&pound;/gi, "£").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const shown = Number(((text.match(/Current\s*Bid:\s*£?\s*([\d,]+)/i) || [])[1] || "").replace(/,/g, ""));
      if (shown === bid) {
        res.json({ success: true, currentBid: shown, playerId: pid, sessionToken: sessionToken || undefined });
        return;
      }
      const reason = (text.match(/(?:must|cannot|can't|unable|not enough|insufficient|too low|too late|already)[^.!]{0,140}[.!]?/i) || [])[0];
      res.status(409).json({
        success: false,
        error: reason
          ? `Battrick did not accept the bid: ${reason.trim()}`
          : `Battrick did not confirm the bid (current bid shown: ${shown ? "£" + shown.toLocaleString() : "unknown"})`,
      });
    } catch (err: any) {
      console.error("battrick-place-bid error", err);
      if (!res.headersSent) res.status(500).json({ success: false, error: err?.message || "Server error" });
    }
  });

  // Email report via Mailgun's HTTP API. Config comes from Cloud Run environment variables:
  //   MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM (optional), MAILGUN_REGION ("eu" for EU accounts),
  //   REPORT_RECIPIENTS (comma list of addresses allowed to receive reports; stops this open endpoint being used as a mail relay).
  const reportSends: number[] = [];
  app.post("/api/send-report-email", async (req, res) => {
    try {
      const apiKey = String(process.env.MAILGUN_API_KEY || "").trim();
      const domain = String(process.env.MAILGUN_DOMAIN || "").trim();
      if (!apiKey || !domain) {
        res.status(503).json({ success: false, error: "Mailgun is not configured on the server (set MAILGUN_API_KEY and MAILGUN_DOMAIN on the Cloud Run service)." });
        return;
      }
      const { to, subject, text, html } = req.body || {};
      const addr = String(to || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
        res.status(400).json({ success: false, error: "Invalid recipient address" });
        return;
      }
      const allowed = String(process.env.REPORT_RECIPIENTS || "andrewpbrown33@gmail.com")
        .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (!allowed.includes(addr)) {
        res.status(403).json({ success: false, error: `${addr} is not an allowed report recipient. Add it to REPORT_RECIPIENTS on the server.` });
        return;
      }
      const subj = String(subject || "").slice(0, 200);
      if (!/^BattrickIQ report/.test(subj) || !(text || html)) {
        res.status(400).json({ success: false, error: "Invalid report payload" });
        return;
      }
      const nowMs = Date.now();
      while (reportSends.length && nowMs - reportSends[0] > 3_600_000) reportSends.shift();
      if (reportSends.length >= 10) {
        res.status(429).json({ success: false, error: "Too many report emails this hour" });
        return;
      }
      reportSends.push(nowMs);

      const base = String(process.env.MAILGUN_REGION || "").toLowerCase() === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
      const form = new URLSearchParams();
      form.set("from", String(process.env.MAILGUN_FROM || `BattrickIQ <reports@${domain}>`));
      form.set("to", addr);
      form.set("subject", subj);
      if (text) form.set("text", String(text).slice(0, 100_000));
      if (html) form.set("html", String(html).slice(0, 200_000));
      const mg = await fetch(`${base}/v3/${encodeURIComponent(domain)}/messages`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`api:${apiKey}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(20000),
      });
      const body: any = await mg.json().catch(() => ({}));
      if (!mg.ok) {
        res.status(502).json({ success: false, error: `Mailgun said: ${body?.message || `HTTP ${mg.status}`}` });
        return;
      }
      res.json({ success: true, id: body?.id });
    } catch (err: any) {
      console.error("send-report-email error", err);
      if (!res.headersSent) res.status(500).json({ success: false, error: err?.message || "Server error" });
    }
  });

  const bookmarkletCache = new Map<string, { url: string; html: string; timestamp: number }>();
  app.post("/api/sync-bookmarklet", (req, res) => {
    const code = String(req.query.code || "").toUpperCase();
    const { url, html } = req.body || {};
    if (!code || !html) {
      res.status(400).json({ error: "code and html required" });
      return;
    }
    bookmarkletCache.set(code, { url: url || "", html, timestamp: Date.now() });
    res.json({ success: true });
  });
  app.get("/api/sync-poll", (req, res) => {
    const code = String(req.query.code || "").toUpperCase();
    const cached = bookmarkletCache.get(code);
    if (cached) {
      bookmarkletCache.delete(code);
      res.json({ hasData: true, url: cached.url, html: cached.html });
    } else res.json({ hasData: false });
  });

  // Coach Jarvis — OpenRouter proxy. Client sends key from Jarvis Settings.
  app.post("/api/coach-chat", async (req, res) => {
    try {
      const { message, context, model, openRouterApiKey } = req.body || {};
      const key = String(openRouterApiKey || process.env.OPENROUTER_API_KEY || "").trim();
      if (!key) {
        res.status(400).json({
          success: false,
          error: "OpenRouter API key required. Add it in Jarvis Settings.",
        });
        return;
      }
      if (!message || !String(message).trim()) {
        res.status(400).json({ success: false, error: "message required" });
        return;
      }
      const chosenModel = String(model || "").trim() || "anthropic/claude-3.5-sonnet";
      const system =
        "You are Coach Jarvis for Battrick cricket management. Give concrete advice on XI, effort (TIE/PAN/GFI), bowling plans, training, transfers, and money. Be concise and decisive.";
      const userContent = context
        ? `[CONTEXT]:\n${context}\n\n[MANAGER]:\n${message}`
        : String(message);

      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://battrickiq.app",
          "X-Title": "BattrickIQ Coach Jarvis",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: chosenModel,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!orRes.ok) {
        const errData = await orRes.json().catch(() => ({}));
        const msg =
          errData?.error?.message ||
          errData?.error ||
          `OpenRouter HTTP ${orRes.status}`;
        res.status(orRes.status >= 400 && orRes.status < 600 ? orRes.status : 502).json({
          success: false,
          error: String(msg),
        });
        return;
      }
      const orData = await orRes.json();
      const reply = orData.choices?.[0]?.message?.content || "";
      if (!reply) {
        res.status(502).json({ success: false, error: "Empty response from OpenRouter" });
        return;
      }
      res.json({ success: true, reply });
    } catch (err: any) {
      console.error("coach-chat error", err);
      res.status(500).json({ success: false, error: err?.message || "Server error" });
    }
  });

  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
