import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export interface LoginRedirectState {
  from?: string;
  notice?: string;
}

/** Requires a session; otherwise redirects to /login and remembers where the user was going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    const state: LoginRedirectState = { from: `${location.pathname}${location.search}` };
    return <Navigate to="/login" replace state={state} />;
  }
  return <>{children}</>;
}

/**
 * Login/register: once signed in, continue to the page that required auth
 * (only same-app paths), or the dashboard.
 */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (session) {
    const from = (location.state as LoginRedirectState | null)?.from;
    const target = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
