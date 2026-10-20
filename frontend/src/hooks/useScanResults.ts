import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { fetchResults, getCachedResults } from '../services/resultsCache';
import type { FullScanResult } from '../types/api';

interface ResultsState {
  data: FullScanResult | null;
  loading: boolean;
  error: string | null;
}

/** GET /scans/{id}/results for one scan (cached once completed). */
export function useScanResults(scanId: string | undefined, enabled = true) {
  const [state, setState] = useState<ResultsState>(() => {
    const cached = scanId ? getCachedResults(scanId) : undefined;
    return { data: cached ?? null, loading: !cached && enabled, error: null };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scanId || !enabled) return;
    let active = true;
    const cached = getCachedResults(scanId);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchResults(scanId)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        if (!active) return;
        setState({ data: null, loading: false, error: err instanceof ApiError ? err.message : 'Could not load results.' });
      });
    return () => {
      active = false;
    };
  }, [scanId, enabled, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}

type ResultsMap = Record<string, { data?: FullScanResult; error?: string }>;

/**
 * Results for several completed scans (dashboard risk-score column). Each
 * fetch is cached, so revisiting the dashboard doesn't re-request them.
 */
export function useResultsForScans(scanIds: string[]): ResultsMap {
  const key = scanIds.join(',');
  const [map, setMap] = useState<ResultsMap>({});

  useEffect(() => {
    let active = true;
    const ids = key ? key.split(',') : [];
    setMap(() => {
      const initial: ResultsMap = {};
      for (const id of ids) {
        const cached = getCachedResults(id);
        if (cached) initial[id] = { data: cached };
      }
      return initial;
    });
    for (const id of ids) {
      if (getCachedResults(id)) continue;
      fetchResults(id)
        .then((data) => active && setMap((m) => ({ ...m, [id]: { data } })))
        .catch(
          (err: unknown) =>
            active && setMap((m) => ({ ...m, [id]: { error: err instanceof ApiError ? err.message : 'Failed' } })),
        );
    }
    return () => {
      active = false;
    };
  }, [key]);

  return map;
}
