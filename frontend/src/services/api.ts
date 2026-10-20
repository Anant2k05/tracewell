/**
 * Typed wrappers for every backend endpoint (backend/app/routers/*.py).
 * Presentation code calls these instead of fetch.
 */
import type {
  ConfirmOtpOut,
  FullScanResult,
  HealthOut,
  OTPRequestOut,
  ScanOut,
  ScanStatus,
  Token,
  UserOut,
} from '../types/api';
import { apiRequest } from './apiClient';

/**
 * ScanOut.status is declared as `str` but populated from the ScanStatus enum.
 * Accept both "completed" and an enum repr like "ScanStatus.COMPLETED".
 * Unknown values pass through and are shown as-is by the UI.
 */
function normalizeStatus(value: unknown): ScanStatus {
  const s = String(value ?? '').toLowerCase();
  return (s.includes('.') ? s.slice(s.lastIndexOf('.') + 1) : s) as ScanStatus;
}

function normalizeScan(scan: ScanOut): ScanOut {
  return { ...scan, status: normalizeStatus(scan.status) };
}

const scanPath = (id: string) => `/scans/${encodeURIComponent(id)}`;

export const api = {
  health: (signal?: AbortSignal) => apiRequest<HealthOut>('/health', { auth: false, signal }),

  // --- /auth ---
  register: (email: string, password: string) =>
    apiRequest<UserOut>('/auth/register', { method: 'POST', body: { email, password }, auth: false }),
  login: (email: string, password: string) =>
    apiRequest<Token>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  // --- /verification ---
  requestOtp: (targetEmail: string) =>
    apiRequest<OTPRequestOut>('/verification/request-otp', {
      method: 'POST',
      body: { target_email: targetEmail },
    }),
  confirmOtp: (targetEmail: string, otpCode: string) =>
    apiRequest<ConfirmOtpOut>('/verification/confirm-otp', {
      method: 'POST',
      body: { target_email: targetEmail, otp_code: otpCode },
    }),

  // --- /scans ---
  createScan: async (targetEmail: string) =>
    normalizeScan(await apiRequest<ScanOut>('/scans', { method: 'POST', body: { target_email: targetEmail } })),
  listScans: async (signal?: AbortSignal) =>
    (await apiRequest<ScanOut[]>('/scans', { signal })).map(normalizeScan),
  getScan: async (id: string, signal?: AbortSignal) => normalizeScan(await apiRequest<ScanOut>(scanPath(id), { signal })),
  getScanResults: async (id: string, signal?: AbortSignal) => {
    const result = await apiRequest<FullScanResult>(`${scanPath(id)}/results`, { signal });
    return { ...result, scan: normalizeScan(result.scan) };
  },
};

export const isActiveStatus = (s: string) => s === 'pending' || s === 'running';
export const isTerminalStatus = (s: string) => s === 'completed' || s === 'failed';
