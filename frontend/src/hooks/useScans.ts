import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError } from '../services/apiClient';
import { api } from '../services/api';
import type { ScanOut } from '../types/api';

interface ScansState {
  scans: ScanOut[] | null;
  loading: boolean;
  error: string | null;
  loadedAt: Date | null;
}

/** GET /scans: the signed-in user's scans, newest first. */
export function useScans() {
  const [state, setState] = useState<ScansState>({ scans: null, loading: true, error: null, loadedAt: null });
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const scans = await api.listScans(controller.signal);
      setState({ scans, loading: false, error: null, loadedAt: new Date() });
    } catch (err) {
      if (isAbortError(err)) return;
      setState((s) => ({ ...s, loading: false, error: err instanceof ApiError ? err.message : 'Could not load scans.' }));
    }
  }, []);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
