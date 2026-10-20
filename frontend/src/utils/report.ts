/**
 * Read-only derivations over a FullScanResult for display. Nothing here
 * re-scores findings: severity scores and labels always come from the
 * backend. These helpers only regroup what the API already returned.
 */
import type { CorrelatedFindingOut, FullScanResult, RawFindingOut } from '../types/api';
import type { Severity } from './severity';
import { toSeverity } from './severity';

/** finding_types the backend treats as system noise (correlation/engine.py SYSTEM_TYPES). */
const SYSTEM_TYPES = new Set(['collector_error', 'collector_skipped']);

export function isSystemFinding(f: RawFindingOut): boolean {
  return SYSTEM_TYPES.has(f.finding_type);
}

/**
 * Collectors registered in backend/app/collectors/orchestrator.py. `id` is the
 * collector's `name`, which is what appears as `source` in findings.
 */
export interface SourceInfo {
  id: string;
  label: string;
  checks: string;
  scope: 'email' | 'domain' | 'username';
  description: string;
  icon: string;
}

export const KNOWN_SOURCES: SourceInfo[] = [
  {
    id: 'XposedOrNot',
    label: 'XposedOrNot',
    checks: 'Breach index',
    scope: 'email',
    description: 'Data breaches the free XposedOrNot index has recorded for this email, with exposed data types where available.',
    icon: 'lock_reset',
  },
  {
    id: 'Gravatar',
    label: 'Gravatar',
    checks: 'MD5 profile lookup',
    scope: 'email',
    description: 'Public avatar and profile fields (display name, location, linked accounts) tied to the email hash.',
    icon: 'account_box',
  },
  {
    id: 'GitHubCodeSearch',
    label: 'GitHub',
    checks: 'Code & commit search',
    scope: 'email',
    description: 'The email appearing in public code, and commit author metadata in public repositories.',
    icon: 'terminal',
  },
  {
    id: 'RDAP',
    label: 'RDAP',
    checks: 'Domain registration',
    scope: 'domain',
    description: "Whether the email's domain lists this address as a registrant, admin or tech contact.",
    icon: 'dns',
  },
  {
    id: 'CertTransparency',
    label: 'crt.sh CT',
    checks: 'Certificate logs',
    scope: 'domain',
    description: "Subdomains revealed by publicly issued TLS certificates for the email's domain.",
    icon: 'security',
  },
  {
    id: 'UsernameEnumeration',
    label: 'Username check',
    checks: '5 public platforms',
    scope: 'username',
    description: "Profiles matching the email's local part on GitHub, Instagram, Reddit, X and Medium. Low-confidence signal.",
    icon: 'groups',
  },
];

export function sourceLabel(id: string): string {
  return KNOWN_SOURCES.find((s) => s.id === id)?.label ?? id;
}

export type SourceState = 'findings' | 'clear' | 'error';

export interface SourceCoverage {
  id: string;
  label: string;
  scope: SourceInfo['scope'] | 'unknown';
  state: SourceState;
  findingCount: number;
  errors: string[];
}

/**
 * Per-source outcome, derived from raw findings: a `collector_error` row means
 * the source failed or timed out; any other row means it returned findings;
 * no rows means it responded with nothing.
 */
export function sourceCoverage(raw: RawFindingOut[]): SourceCoverage[] {
  const ids = [...KNOWN_SOURCES.map((s) => s.id)];
  for (const f of raw) if (!ids.includes(f.source)) ids.push(f.source);

  return ids.map((id) => {
    const rows = raw.filter((f) => f.source === id);
    const errors = rows.filter(isSystemFinding).map((f) => f.value);
    const findingCount = rows.filter((f) => !isSystemFinding(f)).length;
    const info = KNOWN_SOURCES.find((s) => s.id === id);
    return {
      id,
      label: info?.label ?? id,
      scope: info?.scope ?? 'unknown',
      state: errors.length > 0 ? 'error' : findingCount > 0 ? 'findings' : 'clear',
      findingCount,
      errors,
    };
  });
}

// ---------- Correlated finding enrichment ----------

export interface Evidence {
  text: string;
  source: string | null;
  confidence: string | null;
  occurredAt: string | null;
  dataClasses: string[];
}

export interface EnrichedFinding extends CorrelatedFindingOut {
  key: string;
  severityKey: Severity;
  evidence: Evidence[];
  dataClasses: string[];
  /** Highest confidence among matched raw evidence (same rule the backend uses). */
  confidence: string | null;
  /** Every matched piece of evidence is low-confidence (e.g. username-only matches). */
  possibleMatch: boolean;
  occurredAt: string | null;
}

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function confidenceRank(c: string | null | undefined): number {
  return CONFIDENCE_RANK[(c ?? '').toLowerCase()] ?? 0;
}

/**
 * The API doesn't link correlated findings to their raw findings. The
 * correlation engine builds `description` by joining each contributing raw
 * finding's `value` with " | ", so evidence is matched on (value, source).
 */
export function enrichFindings(result: FullScanResult): EnrichedFinding[] {
  const raw = result.raw_findings.filter((f) => !isSystemFinding(f));

  const enriched = result.correlated_findings.map((cf, index) => {
    const lines = Array.from(new Set(cf.description.split(' | ').map((l) => l.trim()).filter(Boolean)));
    const evidence: Evidence[] = lines.map((line) => {
      const match = raw.find((r) => r.value === line && cf.contributing_sources.includes(r.source));
      return {
        text: line,
        source: match?.source ?? null,
        confidence: match?.confidence ?? null,
        occurredAt: match?.occurred_at ?? null,
        dataClasses: match?.data_classes ?? [],
      };
    });

    const matched = evidence.filter((e) => e.confidence !== null);
    const confidence = matched.reduce<string | null>(
      (best, e) => (confidenceRank(e.confidence) > confidenceRank(best) ? e.confidence : best),
      null,
    );
    const dataClasses = Array.from(new Set(evidence.flatMap((e) => e.dataClasses)));
    const occurredAt = evidence.find((e) => e.occurredAt)?.occurredAt ?? null;

    return {
      ...cf,
      key: `finding-${index}`,
      severityKey: toSeverity(cf.severity),
      evidence,
      dataClasses,
      confidence,
      possibleMatch: matched.length > 0 && matched.every((e) => (e.confidence ?? '').toLowerCase() === 'low'),
      occurredAt,
    };
  });

  return enriched.sort((a, b) => b.severity_score - a.severity_score);
}

export function severityCounts(findings: EnrichedFinding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, neutral: 0 };
  for (const f of findings) counts[f.severityKey] += 1;
  return counts;
}

// ---------- Recommendations ----------

export interface ActionGroup {
  recommendation: string;
  findings: EnrichedFinding[];
  top: EnrichedFinding;
}

/**
 * The backend attaches one recommendation template per finding type, so
 * findings that share text are grouped into a single action.
 */
export function groupActions(findings: EnrichedFinding[]): ActionGroup[] {
  const map = new Map<string, EnrichedFinding[]>();
  for (const f of findings) {
    const text = f.recommendation.trim();
    if (!text) continue;
    map.set(text, [...(map.get(text) ?? []), f]);
  }
  return Array.from(map.entries())
    .map(([recommendation, fs]) => ({ recommendation, findings: fs, top: fs[0] }))
    .sort((a, b) => b.top.severity_score - a.top.severity_score);
}

// ---------- Categories ----------

export const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  credential_exposure: { label: 'Credential exposure', icon: 'password' },
  identity_exposure: { label: 'Identity exposure', icon: 'badge' },
  infrastructure_exposure: { label: 'Infrastructure exposure', icon: 'dns' },
  other: { label: 'Other exposure', icon: 'category' },
};

export function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? category.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export interface CategoryRow {
  category: string;
  label: string;
  icon: string;
  count: number;
  maxScore: number;
  severityKey: Severity;
  severityLabel: string;
  titles: string[];
}

export function categoryRows(result: FullScanResult, findings: EnrichedFinding[]): CategoryRow[] {
  const breakdown = result.report?.category_breakdown ?? {};
  return Object.entries(breakdown)
    .map(([category, entry]) => {
      const inCategory = findings.filter((f) => f.category === category);
      // Label the bar with the backend's label for the finding that sets the peak.
      const peak = inCategory.find((f) => f.severity_score === entry.max_severity_score) ?? inCategory[0];
      return {
        category,
        label: categoryLabel(category),
        icon: CATEGORY_META[category]?.icon ?? 'category',
        count: entry.count,
        maxScore: entry.max_severity_score,
        severityKey: toSeverity(peak?.severity),
        severityLabel: peak?.severity ?? '',
        titles: inCategory.map((f) => f.title),
      };
    })
    .sort((a, b) => b.maxScore - a.maxScore);
}

/**
 * Values behind the backend's overall-score formula (70% worst + 30% mean),
 * shown only to explain the score the backend returned.
 */
export function scoreInputs(findings: CorrelatedFindingOut[]): { worst: number; mean: number } | null {
  if (findings.length === 0) return null;
  const scores = findings.map((f) => f.severity_score);
  return { worst: Math.max(...scores), mean: scores.reduce((a, b) => a + b, 0) / scores.length };
}

/**
 * Mirrors HIGH_IMPACT_DATA_CLASSES in backend/app/correlation/normalizer.py,
 * used only to highlight these data types visually.
 */
const HIGH_IMPACT = new Set(
  [
    'Passwords',
    'password_hash',
    'Credit cards',
    'Social security numbers',
    'Bank account numbers',
    'Security questions and answers',
    'Government issued IDs',
  ].map((s) => s.toLowerCase()),
);

export function isHighImpactDataClass(dc: string): boolean {
  return HIGH_IMPACT.has(dc.toLowerCase());
}
