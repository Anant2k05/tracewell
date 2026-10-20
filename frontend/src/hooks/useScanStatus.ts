import { useEffect, useState } from 'react';
import { config } from '../config';
import { ApiError, isAbortError } from '../services/apiClient';
import { api, isTerminalStatus } from '../services/api';
import { getCachedResults } from '../services/resultsCache';
import type { ScanOut } from '../types/api';

export interface ScanStatusState {
  scan: ScanOut | null;
  /** Unrecoverable: scan not found, not owned, or session ended. Polling stops. */
  fatalError: ApiError | null;
  /** Consecutive failed polls (network blips, 5xx, 429). Polling continues with backoff. */
  failures: number;
  lastError: string | null;
  /** HTTP status of the last failed poll (0 = network, 429 = rate limited). */
  lastErrorStatus: number | null;
  lastCheckedAt: Date | null;
}

const INITIAL: ScanStatusState = {
  scan: null,
  fatalError: null,
  failures: 0,
  lastError: null,
  lastErrorStatus: null,
  lastCheckedAt: null,
};

/**
 * Polls GET /scans/{id} until the scan reaches a terminal status
 * (completed/failed). One request at a time: the next poll is scheduled only
 * after the previous one settles. Backs off on errors and slows down while
 * the tab is hidden. Stops and aborts on unmount or when the id changes.
 */
export function useScanStatus(scanId: string | undefined): ScanStatusState {
  const [state, setState] = useState<ScanStatusState>(INITIAL);

  useEffect(() => {
    if (!scanId) return;

    // Completed results never change: if they're cached, the scan is known to
    // be completed and no status request is needed (saves rate-limit budget).
    const cached = getCachedResults(scanId);
    if (cached) {
      setState({ ...INITIAL, scan: cached.scan, lastCheckedAt: new Date() });
      return;
    }

    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let failures = 0;

    setState(INITIAL);

    const schedule = (delay: number) => {
      if (stopped) return;
      timer = window.setTimeout(tick, document.hidden ? Math.max(delay, 15000) : delay);
    };

    async function tick() {
      controller = new AbortController();
      try {
        const scan = await api.getScan(scanId!, controller.signal);
        if (stopped) return;
        failures = 0;
        setState({ ...INITIAL, scan, lastCheckedAt: new Date() });
        if (!isTerminalStatus(scan.status)) schedule(config.pollIntervalMs);
      } catch (err) {
        if (stopped || isAbortError(err)) return;
        const apiErr = err instanceof ApiError ? err : new ApiError('Unexpected error while checking scan status.', -1);
        if (apiErr.status === 404 || apiErr.status === 401 || apiErr.status === 403) {
          setState((s) => ({ ...s, fatalError: apiErr }));
          return;
        }
        failures += 1;
        setState((s) => ({ ...s, failures, lastError: apiErr.message, lastErrorStatus: apiErr.status, lastCheckedAt: new Date() }));
        schedule(Math.min(config.pollIntervalMs * 2 ** failures, config.maxPollBackoffMs));
      }
    }

    // When the tab becomes visible again, check promptly instead of waiting out a slow timer.
    const onVisible = () => {
      if (!document.hidden && timer !== undefined && !stopped) {
        window.clearTimeout(timer);
        timer = undefined;
        void tick();
      }
    };

    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [scanId]);

  return state;
}
