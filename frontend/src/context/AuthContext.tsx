import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import { clearResultsCache } from '../services/resultsCache';
import type { Session } from '../services/tokenStore';
import { tokenStore } from '../services/tokenStore';

interface AuthValue {
  session: Session | null;
  /** Set when the session ended because tokens were rejected (not a manual sign-out). */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  acknowledgeExpiry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => tokenStore.get());
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(
    () =>
      tokenStore.subscribe((next, reason) => {
        setSession(next);
        if (!next) clearResultsCache();
        if (reason === 'expired') setSessionExpired(true);
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await api.login(email, password);
    setSessionExpired(false);
    tokenStore.set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, email });
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      await api.register(email, password);
      // /auth/register returns the user but no tokens; sign in with the same credentials.
      await login(email, password);
    },
    [login],
  );

  // The backend has no logout endpoint: tokens stay valid until they expire,
  // so signing out means discarding them client-side.
  const logout = useCallback(() => tokenStore.clear('logout'), []);
  const acknowledgeExpiry = useCallback(() => setSessionExpired(false), []);

  const value = useMemo(
    () => ({ session, sessionExpired, login, register, logout, acknowledgeExpiry }),
    [session, sessionExpired, login, register, logout, acknowledgeExpiry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
