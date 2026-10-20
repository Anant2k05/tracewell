function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  // Unset: use the local backend during development, same-origin in production.
  return import.meta.env.DEV ? 'http://localhost:8000' : '';
}

function resolveOtpLength(): number {
  const n = Number.parseInt(import.meta.env.VITE_OTP_LENGTH ?? '', 10);
  // The backend's VerifyOTP schema accepts 4–10 characters.
  return Number.isFinite(n) && n >= 4 && n <= 10 ? n : 6;
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  /**
   * The dev OTP banner needs BOTH a development build and an explicit opt-in.
   * `import.meta.env.DEV` is statically false in `vite build`, so production
   * bundles can never show the code.
   */
  showDevOtp: import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_OTP === 'true',
  otpLength: resolveOtpLength(),
  /**
   * Status polling interval. The backend's general rate limiter allows 30
   * requests/minute per IP across /auth and /scans, so polling must stay
   * well under that.
   */
  pollIntervalMs: 4000,
  maxPollBackoffMs: 30000,
} as const;
