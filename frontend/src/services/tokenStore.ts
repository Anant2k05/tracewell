/**
 * Client-side session storage.
 *
 * The backend issues access/refresh tokens in the JSON body of /auth/login and
 * /auth/refresh (no cookies), so the browser has to hold them. They live in
 * sessionStorage: they survive a page reload but are scoped to the tab and
 * cleared when it closes. This is NOT equivalent to an HttpOnly cookie: any
 * script running on the page (e.g. via an XSS bug) can read them. See the
 * README's "Token storage" section for the tradeoffs.
 *
 * Passwords are never stored. The operator email is kept only because the
 * backend has no "current user" endpoint to look it up.
 */
import { readJwtExpiry } from '../utils/jwt';

const STORAGE_KEY = 'tracewell.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  email: string;
}

export type ClearReason = 'logout' | 'expired';
type Listener = (session: Session | null, reason?: ClearReason) => void;

function isSession(value: unknown): value is Session {
  const v = value as Partial<Session> | null;
  return !!v && typeof v.accessToken === 'string' && typeof v.refreshToken === 'string' && typeof v.email === 'string';
}

function load(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) return null;
    const refreshExp = readJwtExpiry(parsed.refreshToken);
    if (refreshExp !== null && refreshExp <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persist(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode / blocked): the session still works in memory.
  }
}

let current: Session | null = load();
const listeners = new Set<Listener>();

export const tokenStore = {
  get(): Session | null {
    return current;
  },
  set(session: Session) {
    current = session;
    persist(session);
    listeners.forEach((l) => l(current));
  },
  clear(reason: ClearReason) {
    if (!current) return;
    current = null;
    persist(null);
    listeners.forEach((l) => l(null, reason));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
