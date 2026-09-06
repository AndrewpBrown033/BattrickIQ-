import React, { createContext, useContext, useState, useCallback } from 'react';

interface BattrickAuthContextValue {
  /** Battrick.org username for the current session */
  username: string;
  /** Battrick.org password, held only in memory + sessionStorage for this tab/session */
  password: string;
  /** True only after a verified login this session (not just "a password happens to be stored") */
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  rememberUsername: boolean;
  setRememberUsername: (value: boolean) => void;
  /** Verifies credentials against Battrick once, then stores them for the rest of the session */
  authenticate: (username: string, password: string, remember: boolean) => Promise<boolean>;
  /** Clears the session password/token. Does not clear a remembered username. */
  logout: () => void;
  /**
   * Guard to call at the top of any sync action. Returns true if already
   * authenticated. If not, raises an alert telling the user to authenticate
   * at the top of the page, opens the shared login prompt, and returns false
   * so the caller can bail out of the sync attempt.
   */
  requireAuth: (actionLabel?: string) => boolean;
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
    return sessionStorage.getItem('bt_direct_pass') || '';
  } catch {
    return '';
  }
}

function readAuthenticatedFlag(): boolean {
  try {
    return sessionStorage.getItem('bt_battrick_authenticated') === 'true';
  } catch {
    return false;
  }
}

export function BattrickAuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string>(() => readStoredUsername());
  const [password, setPassword] = useState<string>(() => readStoredPassword());
  const [rememberUsername, setRememberUsername] = useState<boolean>(() => !!readStoredUsername());
  // A leftover "authenticated" flag with no matching password (e.g. the tab's
  // sessionStorage was cleared but the flag wasn't) is stale - never trust it alone.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => readAuthenticatedFlag() && !!readStoredPassword()
  );
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false);

  const authenticate = useCallback(async (u: string, p: string, remember: boolean): Promise<boolean> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ step: 'login', username: u.trim(), password: p })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (e.g. an HTML error page) - fall through to the generic error below
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
        setError(data.error || 'Authentication failed. Please check your Battrick username and password.');
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
        } else {
          localStorage.removeItem('bt_battrick_username');
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
    } catch {
      // ignore
    }
  }, []);

  const openPrompt = useCallback(() => setIsPromptOpen(true), []);
  const closePrompt = useCallback(() => setIsPromptOpen(false), []);

  const requireAuth = useCallback((actionLabel?: string): boolean => {
    if (isAuthenticated && password) return true;
    window.alert(
      `Battrick authentication required${actionLabel ? ` to ${actionLabel}` : ''}.\n\nConnect your Battrick account at the top of the page, then try again.`
    );
    setIsPromptOpen(true);
    return false;
  }, [isAuthenticated, password]);

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
        isPromptOpen,
        openPrompt,
        closePrompt
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
