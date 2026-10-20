import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { ScoringDrawer } from '../components/ScoringDrawer';
import { useAuth } from '../context/AuthContext';
import { useApiHealth } from '../hooks/useApiHealth';
import { cn } from '../utils/cn';

const NAV = [
  { to: '/', label: 'Overview', short: 'Overview', icon: 'shield_with_heart', end: true },
  { to: '/assess', label: 'New assessment', short: 'New', icon: 'radar', end: false },
  { to: '/history', label: 'History', short: 'History', icon: 'history_toggle_off', end: false },
];

/** Scan detail pages belong to History in the nav. */
function useIsActive() {
  const { pathname } = useLocation();
  return (to: string, end: boolean) =>
    to === '/history' ? pathname.startsWith('/history') || pathname.startsWith('/scans/') : end ? pathname === to : pathname.startsWith(to);
}

/**
 * Authenticated shell from the Stitch screens: fixed 232px sidebar (≥1024px),
 * top header, and a bottom dock on smaller screens.
 */
export function AppLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const isActive = useIsActive();
  const [scoringOpen, setScoringOpen] = useState(false);
  const email = session?.email ?? '';

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[232px] bg-surface-container-low border-r border-line z-50 flex-col justify-between select-none">
        <div className="flex flex-col">
          <div className="h-14 px-margin-md flex items-center border-b border-line">
            <Logo />
          </div>
          <div className="px-margin-md pt-space-md pb-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Risk ledger</span>
          </div>
          <nav className="flex flex-col gap-space-xs px-space-xs" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(item.to, item.end);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-space-sm px-space-sm py-space-xs rounded transition-colors font-body-md text-body-md',
                    active
                      ? 'bg-surface-container-high text-primary border-l-2 border-primary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  )}
                >
                  <Icon name={item.icon} className="text-[18px]" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-line p-space-sm bg-surface-container-lowest/60">
          <div className="p-space-xs mb-space-xs">
            <span className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Operator</span>
            <span className="block font-mono-sm text-mono-sm text-secondary truncate mt-0.5" title={email}>
              {email}
            </span>
          </div>
          <div className="flex flex-col gap-space-xs">
            <button
              type="button"
              onClick={() => setScoringOpen(true)}
              className="w-full flex items-center justify-between px-space-xs py-1 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-left font-body-sm text-body-sm"
            >
              <span className="flex items-center gap-1.5">
                <Icon name="tune" className="text-[15px]" />
                How scoring works
              </span>
              <Icon name="help_outline" className="text-[14px]" />
            </button>
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-1.5 px-space-xs py-1 rounded text-error hover:bg-surface-container transition-colors font-body-sm text-body-sm"
            >
              <Icon name="logout" className="text-[15px]" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[232px] flex flex-col min-h-screen">
        <header className="fixed top-0 left-0 right-0 lg:left-[232px] h-14 bg-surface-container-low/95 border-b border-line z-40 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="lg:hidden">
              <Logo />
            </div>
            <nav className="hidden md:flex lg:hidden items-center gap-space-lg ml-space-md" aria-label="Primary">
              {NAV.map((item) => {
                const active = isActive(item.to, item.end);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={cn(
                      'transition-colors',
                      active ? 'text-primary font-headline-sm text-body-md' : 'font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface',
                    )}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-space-md">
            <ApiStatus />
            <AccountMenu email={email} onScoring={() => setScoringOpen(true)} onSignOut={signOut} />
          </div>
        </header>

        <main className="flex-1 pt-14 pb-20 lg:pb-space-xl bg-surface-container-lowest w-full">
          <div className="max-w-[1200px] mx-auto px-margin md:px-margin-md lg:px-margin-lg pt-space-lg">
            <Outlet />
          </div>
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-low border-t border-line z-40 flex items-center justify-around px-margin" aria-label="Primary">
          {NAV.map((item) => {
            const active = isActive(item.to, item.end);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[64px]',
                  active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                <Icon name={item.icon} className="text-[20px]" />
                <span className="font-label-sm text-label-sm">{item.short}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <ScoringDrawer open={scoringOpen} onClose={() => setScoringOpen(false)} />
    </div>
  );
}

/** Real API reachability (GET /health) in place of the mock "ACTIVE SCANNER v2.4" chip. */
function ApiStatus() {
  const health = useApiHealth();
  const meta = {
    checking: { dot: 'bg-sev-neutral', label: 'CHECKING API' },
    online: { dot: 'bg-primary-container animate-pulse', label: 'API ONLINE' },
    offline: { dot: 'bg-sev-critical', label: 'API UNREACHABLE' },
  }[health];
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-space-sm py-0.5 rounded bg-surface-container border border-line" title="Backend /health check">
      <span className={cn('w-1.5 h-1.5 rounded-[9999px]', meta.dot)} />
      <span className="font-mono-sm text-mono-sm text-on-surface-variant">{meta.label}</span>
    </div>
  );
}

function AccountMenu({ email, onScoring, onSignOut }: { email: string; onScoring: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
      >
        <Icon name="person" className="text-on-primary text-[18px]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 w-64 bg-panel-2 border border-line-strong rounded-lg p-space-xs z-50">
          <div className="px-space-sm py-space-xs border-b border-line mb-space-xs">
            <span className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Operator</span>
            <span className="block font-mono-sm text-mono-sm text-secondary truncate" title={email}>
              {email}
            </span>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onScoring();
            }}
            className="w-full flex items-center gap-1.5 px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-panel-hover hover:text-on-surface font-body-sm text-body-sm"
          >
            <Icon name="tune" className="text-[15px]" />
            How scoring works
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-1.5 px-space-sm py-1.5 rounded text-error hover:bg-panel-hover font-body-sm text-body-sm"
          >
            <Icon name="logout" className="text-[15px]" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
