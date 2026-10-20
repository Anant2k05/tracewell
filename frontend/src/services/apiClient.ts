/**
 * Centralized HTTP client for the FastAPI backend. Every request goes through
 * `apiRequest`, which:
 *  - prefixes the configured base URL and sends/accepts JSON,
 *  - attaches the Bearer access token for authenticated calls,
 *  - on 401, refreshes the token pair once via POST /auth/refresh (requests
 *    share a single in-flight refresh) and retries,
 *  - turns FastAPI error bodies ({detail: string | ValidationError[]}) and
 *    network failures into an ApiError with a readable message.
 */
import { config } from '../config';
import type { Token } from '../types/api';
import { tokenStore } from './tokenStore';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** 0 = the request never reached the server (network/CORS/offline). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Attach the access token and handle 401 as session expiry. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
}

function apiOrigin(): string {
  return config.apiBaseUrl || window.location.origin;
}

interface ValidationIssue {
  loc?: Array<string | number>;
  msg?: string;
}

function describeError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic validation errors (HTTP 422).
    return (detail as ValidationIssue[])
      .map((issue) => {
        const field = issue.loc?.filter((p) => p !== 'body').join('.') ?? '';
        const msg = (issue.msg ?? 'Invalid value').replace(/^Value error,\s*/i, '');
        return field ? `${field}: ${msg}` : msg;
      })
      .join(' · ');
  }

  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return `The server hit an error (${status}). Try again shortly.`;
  if (status === 404) return 'Not found.';
  return `Request failed (${status}).`;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function send<T>(path: string, opts: RequestOptions, allowRefresh: boolean): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let sentToken: string | null = null;
  if (auth) {
    const session = tokenStore.get();
    if (!session) throw new ApiError('You are not signed in.', 401);
    sentToken = session.accessToken;
    headers.Authorization = `Bearer ${sentToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(
      `Can't reach the API at ${apiOrigin()}. Check that the backend is running and reachable.`,
      0,
    );
  }

  if (res.status === 401 && auth) {
    if (allowRefresh) {
      // Another request may already have rotated the token: just retry.
      const latest = tokenStore.get()?.accessToken;
      if (latest && latest !== sentToken) return send<T>(path, opts, false);
      if (await refreshSession()) return send<T>(path, opts, false);
    }
    tokenStore.clear('expired');
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const data = await parseBody(res);
  if (!res.ok) throw new ApiError(describeError(res.status, data), res.status, data);
  return data as T;
}

export function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return send<T>(path, opts, true);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Statuses meaning the backend rejected the refresh token itself. */
const REFRESH_REJECTED = new Set([400, 401, 403, 422]);

/**
 * Exchanges the refresh token for a new pair. Resolves false only when the
 * backend rejects the token (expired/invalid → caller ends the session).
 * Anything else (network failure, 429 rate limit, 5xx) is rethrown, so a
 * transient problem surfaces as an error without signing the user out.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const session = tokenStore.get();
      if (!session) return false;
      try {
        const tokens = await send<Token>(
          '/auth/refresh',
          { method: 'POST', body: { refresh_token: session.refreshToken }, auth: false },
          false,
        );
        tokenStore.set({ ...session, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
        return true;
      } catch (err) {
        if (err instanceof ApiError && REFRESH_REJECTED.has(err.status)) return false;
        throw err;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
