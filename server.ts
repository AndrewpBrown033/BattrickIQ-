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
      if (now - s.timestamp > 15 * 60 * 1000) sessions.delete(k);
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
    // Battrick's transfer form takes up to four skill filters as numbered slots:
    // SkillType{n} (id) + SkillMin{n} (level 1-20) + SkillMax{n}. Ids from the real form:
    const SKILL_IDS: Record<string, number> = {
      stamina: 1, batting: 2, bowling: 3, seam: 3, spin: 3, consistency: 4,
      concentration: 5, fielding: 6, keeping: 7, wicketkeeping: 7, experience: 8,
    };
    let slot = 1;
    const usedIds = new Set<number>();
    for (const [skill, min] of Object.entries(skillMins || {})) {
      const id = SKILL_IDS[String(skill).toLowerCase().replace(/[\s_-]/g, "")];
      const level = Math.max(0, Math.min(20, Math.round(Number(min))));
      if (!id || usedIds.has(id) || !level || slot > 4) continue;
      usedIds.add(id);
      params.set(`SkillType${slot}`, String(id));
      params.set(`SkillMin${slot}`, String(level));
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
        // Battrick's real transfer market page is transfers.asp (menu: Global > Transfer Market).
        // "transferlist" names are kept as aliases for older clients.
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
          const countHits = (h: string) => ({
            playerLinks: (h.match(/playerdetails\.asp/gi) || []).length,
            markers:
              (h.match(/asking\s*price/gi) || []).length +
              (h.match(/current\s*bid/gi) || []).length +
              (h.match(/time\s*left/gi) || []).length,
          });
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

          // Results are paginated (25 per page, "Next" -> transferlist.asp?startP=25). Pull the
          // remaining pages so the scan sees the whole market, not just the first 25 players.
          const maxPages = Math.min(10, Math.max(1, Number(req.body.maxPages) || 8));
          let pagesFetched = 1;
          let current = pageResult.html || "";
          const found = (current.match(/(\d[\d,]*)\s+Players?\s+found/i) || [])[1];
          const extra: string[] = [];
          while (pagesFetched < maxPages) {
            const nextHref = (current.match(/href=["'](transferlist\.asp\?startP=\d+[^"']*)["'][^>]*class=["']next["']/i) ||
              current.match(/class=["']next["'][^>]*href=["'](transferlist\.asp\?startP=\d+[^"']*)["']/i) || [])[1];
            if (!nextHref) break;
            const nextPage = await fetchPage(active.cookieMap, new URL(nextHref.replace(/&amp;/g, "&"), targetUrl).toString());
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
