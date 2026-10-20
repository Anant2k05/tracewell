/**
 * In-memory cache of scan results. A completed scan's results never change,
 * so caching them avoids re-fetching (and spending the backend's per-IP rate
 * limit) when moving between the dashboard, history and report pages.
 * Cleared on sign-out.
 */
import type { FullScanResult } from '../types/api';
import { api } from './api';

const cache = new Map<string, FullScanResult>();
const inflight = new Map<string, Promise<FullScanResult>>();

export function getCachedResults(scanId: string): FullScanResult | undefined {
  return cache.get(scanId);
}

export function fetchResults(scanId: string): Promise<FullScanResult> {
  const hit = cache.get(scanId);
  if (hit) return Promise.resolve(hit);

  let pending = inflight.get(scanId);
  if (!pending) {
    pending = api
      .getScanResults(scanId)
      .then((result) => {
        if (result.scan.status === 'completed') cache.set(scanId, result);
        return result;
      })
      .finally(() => inflight.delete(scanId));
    inflight.set(scanId, pending);
  }
  return pending;
}

export function clearResultsCache() {
  cache.clear();
  inflight.clear();
}
