/**
 * The backend stores timestamps in UTC. With SQLite, `server_default=now()`
 * values come back without an offset, so a naive ISO string is treated as UTC
 * rather than as the browser's local time.
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const d = new Date(hasZone ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "Oct 17, 2026 14:32 UTC" */
export function formatDateTimeUtc(value: string | null | undefined): string {
  const d = parseServerDate(value);
  if (!d) return '—';
  return `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}, ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "Oct 17, 2026" */
export function formatDateUtc(value: string | null | undefined): string {
  const d = parseServerDate(value);
  if (!d) return '—';
  return `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}, ${d.getUTCFullYear()}`;
}

/** Compact table cell: "14:32" for today (UTC), otherwise "Oct 12". */
export function formatShortUtc(value: string | null | undefined, now = new Date()): string {
  const d = parseServerDate(value);
  if (!d) return '—';
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  return sameDay ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}`;
}

export function formatClockUtc(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** "0:34", "12:05", "1:02:09" */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatScore(score: number | null | undefined, digits = 2): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '—';
  return score.toFixed(digits);
}

/** First 8 characters of a UUID, for compact display. */
export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

/** "password_hash" -> "Password hash", "displayName" -> "Display name" */
export function humanize(value: string): string {
  const spaced = value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
