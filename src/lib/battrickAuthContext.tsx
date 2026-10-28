import React, { createContext, useContext, useState, useCallback } from 'react';

interface BattrickAuthContextValue {
  /** Battrick.org username for the current session */
  username: string;
  /** Battrick.org password, held in session; also localStorage when Stay signed in is on */
  password: string;
  /** True after verified login, or when stay-signed-in credentials were restored */
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  rememberUsername: boolean;
  setRememberUsername: (value: boolean) => void;
  /** Verifies credentials against Battrick once, then stores them for the session (and longer if remember) */
  authenticate: (username: string, password: string, remember: boolean) => Promise<boolean>;
  /** Clears the session password/token and any stay-signed-in password. */
  logout: () => void;
  /**
   * Guard for sync actions. Returns true if credentials are available.
   * Tries soft restore from stay-signed-in storage before prompting.
   */
  requireAuth: (actionLabel?: string) => boolean;
  /** Silent re-login using stay-signed-in credentials when the Battrick session token expires */
  ensureSession: () => Promise<boolean>;
  isPromptOpen: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
}

const BattrickAuthContext = createContext<BattrickAuthContextValue | null>(null);

function readStoredUsername(): string {
  try {
    return localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
  } catch {
    return '';
  }
}

function readStoredPassword(): string {
  try {
    // Session first, then stay-signed-in localStorage so the bot survives reloads
    return sessionStorage.getItem('bt_direct_pass') || localStorage.getItem('bt_direct_pass_persist') || '';
  } catch {
    return '';
  }
}

function readStaySignedIn(): boolean {
  try {
    return localStorage.getItem('bt_battrick_stay_signed_in') === 'true' || !!localStorage.getItem('bt_direct_pass_persist');
  } catch {
    return false;
  }
}

function readAuthenticatedFlag(): boolean {
  try {
    if (sessionStorage.getItem('bt_battrick_authenticated') === 'true' && !!readStoredPassword()) return true;
    // Stay signed in restores auth across tab closes so Transfer Watch bot can keep running
    if (readStaySignedIn() && !!readStoredPassword() && !!readStoredUsername()) return true;
    return false;
  } catch {
    return false;
  }
}

export function BattrickAuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string>(() => readStoredUsername());
  const [password, setPassword] = useState<string>(() => readStoredPassword());
  const [rememberUsername, setRememberUsername] = useState<boolean>(() => readStaySignedIn() || !!readStoredUsername());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => readAuthenticatedFlag());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false);

  const authenticate = useCallback(async (u: string, p: string, remember: boolean): Promise<boolean> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ step: 'login', username: u.trim(), password: p }),
      });

      let data: any = {};
      try {
        const text = await res.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = { error: `Server returned non-JSON response (HTTP ${res.status}).` };
          }
        }
      } catch {
        // Fall through to response status handling
      }

      if (!res.ok || !data.success) {
        setIsAuthenticated(false);
        setPassword('');
        try {
          sessionStorage.removeItem('bt_direct_pass');
          sessionStorage.removeItem('bt_battrick_authenticated');
        } catch {
          // ignore
        }
        const errorMessage =
          data.error ||
          (res.status === 401
            ? 'Invalid Battrick username or password. Please verify your login details.'
            : `Authentication failed (HTTP ${res.status}). Please check your connection and credentials.`);
        setError(errorMessage);
        return false;
      }

      setUsername(u.trim());
      setPassword(p);
      setIsAuthenticated(true);
      setRememberUsername(remember);

      try {
        sessionStorage.setItem('bt_direct_pass', p);
        sessionStorage.setItem('bt_battrick_authenticated', 'true');
        if (data.sessionToken) {
          localStorage.setItem('bt_sync_session', data.sessionToken);
        }
        if (remember) {
          localStorage.setItem('bt_battrick_username', u.trim());
          localStorage.setItem('bt_direct_pass_persist', p);
          localStorage.setItem('bt_battrick_stay_signed_in', 'true');
        } else {
          localStorage.removeItem('bt_direct_pass_persist');
          localStorage.removeItem('bt_battrick_stay_signed_in');
          if (!localStorage.getItem('bt_battrick_username')) {
            localStorage.setItem('bt_battrick_username', u.trim());
          }
        }
      } catch {
        // ignore storage failures (e.g. private browsing)
      }

      setIsPromptOpen(false);
      return true;
    } catch (e: any) {
      setIsAuthenticated(false);
      setError(e?.message || 'Could not reach the sync server. Please try again.');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setPassword('');
    setError(null);
    try {
      sessionStorage.removeItem('bt_direct_pass');
      sessionStorage.removeItem('bt_battrick_authenticated');
      localStorage.removeItem('bt_sync_session');
      localStorage.removeItem('bt_direct_pass_persist');
      localStorage.removeItem('bt_battrick_stay_signed_in');
    } catch {
      // ignore
    }
  }, []);

  const openPrompt = useCallback(() => setIsPromptOpen(true), []);
  const closePrompt = useCallback(() => setIsPromptOpen(false), []);

  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (isAuthenticated && password) return true;
    let u = username;
    let p = password;
    try {
      u = u || localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
      p = p || sessionStorage.getItem('bt_direct_pass') || localStorage.getItem('bt_direct_pass_persist') || '';
    } catch {}
    if (!u || !p) return false;
    setUsername(u);
    setPassword(p);
    try {
      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ step: 'login', username: u, password: p }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data?.success) {
        if (data.sessionToken) {
          try {
            localStorage.setItem('bt_sync_session', data.sessionToken);
          } catch {}
        }
        try {
          sessionStorage.setItem('bt_direct_pass', p);
          sessionStorage.setItem('bt_battrick_authenticated', 'true');
        } catch {}
        setIsAuthenticated(true);
        return true;
      }
    } catch {
      // Still return true if we have credentials — callBattrick will send password
    }
    setIsAuthenticated(true);
    return true;
  }, [isAuthenticated, password, username]);

  const requireAuth = useCallback(
    (actionLabel?: string): boolean => {
      if (isAuthenticated && password) return true;
      // Soft restore from stay-signed-in so the bot can run after a reload
      try {
        const u = localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
        const p = sessionStorage.getItem('bt_direct_pass') || localStorage.getItem('bt_direct_pass_persist') || '';
        if (u && p) {
          setUsername(u);
          setPassword(p);
          setIsAuthenticated(true);
          try {
            sessionStorage.setItem('bt_direct_pass', p);
            sessionStorage.setItem('bt_battrick_authenticated', 'true');
          } catch {}
          return true;
        }
      } catch {}
      window.alert(
        `Battrick authentication required${actionLabel ? ` to ${actionLabel}` : ''}.\n\nConnect your Battrick account at the top of the page and tick Stay signed in so the transfer bot can run without re-logging in.`
      );
      setIsPromptOpen(true);
      return false;
    },
    [isAuthenticated, password]
  );

  return (
    <BattrickAuthContext.Provider
      value={{
        username,
        password,
        isAuthenticated,
        isAuthenticating,
        error,
        rememberUsername,
        setRememberUsername,
        authenticate,
        logout,
        requireAuth,
        ensureSession,
        isPromptOpen,
        openPrompt,
        closePrompt,
      }}
    >
      {children}
    </BattrickAuthContext.Provider>
  );
}

export function useBattrickAuth(): BattrickAuthContextValue {
  const ctx = useContext(BattrickAuthContext);
  if (!ctx) {
    throw new Error('useBattrickAuth must be used within a BattrickAuthProvider');
  }
  return ctx;
}
