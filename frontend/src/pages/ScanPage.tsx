import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/Badges';
import { Button, ButtonLink } from '../components/Button';
import { Icon } from '../components/Icon';
import { CategoryBreakdown } from '../components/report/CategoryBreakdown';
import { CollectionNotes } from '../components/report/CollectionNotes';
import { FindingsList } from '../components/report/FindingsList';
import { RecommendedActions } from '../components/report/RecommendedActions';
import { ScoreOverview } from '../components/report/ScoreOverview';
import { ScoringDrawer } from '../components/ScoringDrawer';
import { EmptyState, ErrorNotice, LoadingBlock, Notice } from '../components/States';
import { useNow } from '../hooks/useCountdown';
import { useRunScan } from '../hooks/useRunScan';
import { useScanResults } from '../hooks/useScanResults';
import { useScanStatus } from '../hooks/useScanStatus';
import type { ScanOut } from '../types/api';
import { formatClockUtc, formatDateTimeUtc, formatElapsed, parseServerDate } from '../utils/format';
import { KNOWN_SOURCES, categoryRows, enrichFindings, groupActions, scoreInputs, sourceCoverage } from '../utils/report';

/**
 * /scans/:scanId: polls the scan's status and shows the progress view while
 * it is pending/running, the failure view, or the full report once completed.
 */
export function ScanPage() {
  const { scanId } = useParams();
  const status = useScanStatus(scanId);
  const scan = status.scan;

  if (status.fatalError) {
    return (
      <div className="max-w-[960px] mx-auto flex flex-col gap-space-md">
        <Breadcrumb />
        <div className="bg-panel border border-line rounded-card">
          <EmptyState
            icon={status.fatalError.status === 404 ? 'search_off' : 'error'}
            title={status.fatalError.status === 404 ? 'Scan not found' : "Couldn't load this scan"}
            action={<ButtonLink to="/history" icon="history_toggle_off">Back to history</ButtonLink>}
          >
            {status.fatalError.status === 404
              ? "This scan doesn't exist or belongs to another account."
              : status.fatalError.message}
          </EmptyState>
        </div>
      </div>
    );
  }

  if (!scan) {
    return status.lastError ? (
      <div className="max-w-[960px] mx-auto flex flex-col gap-space-md">
        <Breadcrumb />
        {status.lastErrorStatus === 429 ? (
          <Notice tone="warning" icon="hourglass_top">
            <span className="font-semibold">Rate limit reached.</span> {status.lastError} Retrying automatically…
          </Notice>
        ) : (
          <ErrorNotice
            title={status.lastErrorStatus === 0 ? "Couldn't reach the server" : "Couldn't load this scan yet"}
            message={`${status.lastError} Retrying automatically…`}
          />
        )}
      </div>
    ) : (
      <LoadingBlock label="Loading scan" />
    );
  }

  if (scan.status === 'completed') return <ScanReport scan={scan} />;
  if (scan.status === 'failed') return <ScanFailed scan={scan} />;
  if (scan.status === 'pending' || scan.status === 'running') {
    return (
      <ScanProgress
        scan={scan}
        lastCheckedAt={status.lastCheckedAt}
        failures={status.failures}
        lastError={status.lastError}
        lastErrorStatus={status.lastErrorStatus}
      />
    );
  }
  return (
    <div className="max-w-[960px] mx-auto">
      <ErrorNotice title="Unrecognised scan status" message={`The server reported status "${scan.status}".`} />
    </div>
  );
}

function Breadcrumb({ email }: { email?: string }) {
  return (
    <div className="flex items-center gap-space-xs text-on-surface-variant font-mono-sm text-mono-sm min-w-0">
      <Link className="hover:text-on-surface transition-colors" to="/history">
        History
      </Link>
      <span>/</span>
      <span className="text-on-surface font-medium truncate">{email ?? 'Scan'}</span>
    </div>
  );
}

function ScanProgress({
  scan,
  lastCheckedAt,
  failures,
  lastError,
  lastErrorStatus,
}: {
  scan: ScanOut;
  lastCheckedAt: Date | null;
  failures: number;
  lastError: string | null;
  lastErrorStatus: number | null;
}) {
  const now = useNow();
  const started = parseServerDate(scan.created_at)?.getTime() ?? now;
  const steps = [
    { key: 'pending', label: 'Queued', detail: 'Scan request accepted by the server.' },
    { key: 'running', label: 'Collecting & correlating', detail: `Querying ${KNOWN_SOURCES.length} sources in parallel, then scoring.` },
    { key: 'completed', label: 'Report ready', detail: 'Results load automatically.' },
  ];
  const activeIndex = scan.status === 'pending' ? 0 : 1;

  return (
    <div className="max-w-[960px] mx-auto flex flex-col gap-space-lg">
      <Breadcrumb email={scan.target_email} />

      <div className="bg-panel border border-line rounded-card p-space-lg flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs min-w-0">
            <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[9999px] bg-lime animate-pulse" />
              Assessment in progress
            </span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight break-all">{scan.target_email}</h1>
            <span className="font-mono-sm text-mono-sm text-on-surface-variant">
              Started {formatDateTimeUtc(scan.created_at)} · Scan ID: <code className="text-on-surface">{scan.id}</code>
            </span>
          </div>
          <StatusBadge status={scan.status} extra={formatElapsed(now - started)} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center font-mono-sm text-mono-sm text-on-surface-variant">
            <span>Server-reported status</span>
            <span className="text-primary capitalize">{scan.status}</span>
          </div>
          <div className="w-full bg-panel-2 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-label="Scan in progress" aria-busy="true">
            <div className="bg-lime h-1.5 w-2/5 rounded-full animate-indeterminate" />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            The server reports only the overall status, not per-source progress, so this bar shows activity rather than a
            percentage.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
          {steps.map((s, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <li key={s.key} className={`p-space-sm rounded-lg border ${active ? 'bg-panel-2 border-lime/30' : 'bg-panel-2 border-line'} ${!done && !active ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-space-xs">
                  <span className={`w-6 h-6 rounded flex items-center justify-center font-mono-sm text-mono-sm ${done ? 'bg-primary-container text-on-primary-container' : active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                    {done ? <Icon name="check" className="text-[14px]" /> : i + 1}
                  </span>
                  <span className="font-headline-sm text-body-md text-on-surface">{s.label}</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{s.detail}</p>
              </li>
            );
          })}
        </ol>

        <div className="p-space-sm rounded bg-panel-2 border border-line">
          <span className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-space-xs">Sources being queried</span>
          <div className="flex flex-wrap gap-space-xs">
            {KNOWN_SOURCES.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-panel border border-line font-mono-sm text-mono-sm text-secondary">
                <Icon name={s.icon} className="text-[13px] text-primary" />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {failures > 0 && lastError && (
          <Notice tone="warning" icon={lastErrorStatus === 429 ? 'hourglass_top' : 'wifi_off'}>
            Status check failed ({lastError}). Retrying automatically{failures > 1 ? ` (attempt ${failures + 1})` : ''}.
          </Notice>
        )}

        <div className="pt-space-md border-t border-line flex flex-wrap items-center justify-between gap-space-sm">
          <span className="font-mono-sm text-mono-sm text-on-surface-variant">
            {lastCheckedAt ? `Last checked ${formatClockUtc(lastCheckedAt)}` : 'Checking…'}
          </span>
          <div className="flex items-center gap-space-sm">
            <ButtonLink to="/history" icon="history_toggle_off">
              History
            </ButtonLink>
            <ButtonLink to="/" icon="shield_with_heart">
              Overview
            </ButtonLink>
          </div>
        </div>
      </div>
      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        You can leave this page. The scan keeps running on the server and will appear in History when it finishes.
      </p>
    </div>
  );
}

function ScanFailed({ scan }: { scan: ScanOut }) {
  const runScan = useRunScan();
  return (
    <div className="max-w-[960px] mx-auto flex flex-col gap-space-lg">
      <Breadcrumb email={scan.target_email} />
      <div className="bg-panel border border-line rounded-card p-space-lg flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center gap-space-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight break-all">{scan.target_email}</h1>
          <StatusBadge status="failed" />
        </div>
        <span className="font-mono-sm text-mono-sm text-on-surface-variant">
          Started {formatDateTimeUtc(scan.created_at)} · Scan ID: <code className="text-on-surface">{scan.id}</code>
        </span>
        <ErrorNotice
          title="This assessment failed"
          message={scan.error_message || 'The server did not record a reason for the failure.'}
        />
        {runScan.error && <ErrorNotice title="Couldn't start a new scan" message={runScan.error} />}
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button variant="primary" icon="sync" loading={runScan.pendingEmail !== null} onClick={() => void runScan.run(scan.target_email)}>
            Run again
          </Button>
          <ButtonLink to="/history" icon="history_toggle_off">
            Back to history
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function ScanReport({ scan }: { scan: ScanOut }) {
  const { data, loading, error, retry } = useScanResults(scan.id);
  const runScan = useRunScan();
  const location = useLocation();
  const [scoringOpen, setScoringOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const findings = useMemo(() => (data ? enrichFindings(data) : []), [data]);
  const coverage = useMemo(() => (data ? sourceCoverage(data.raw_findings) : []), [data]);
  const actions = useMemo(() => groupActions(findings), [findings]);
  const categories = useMemo(() => (data ? categoryRows(data, findings) : []), [data, findings]);

  // Expand the top finding by default, plus any finding linked via #hash.
  useEffect(() => {
    if (findings.length === 0) return;
    const hash = location.hash.replace('#', '');
    const initial = new Set([findings[0].key]);
    if (hash && findings.some((f) => f.key === hash)) initial.add(hash);
    setExpanded(initial);
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [findings, location.hash]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const jumpTo = useCallback((key: string) => {
    setExpanded((prev) => new Set(prev).add(key));
    window.setTimeout(() => document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }, []);

  const inputs = data ? scoreInputs(data.correlated_findings) : null;
  const scoringInstance = data?.report && inputs ? { ...inputs, score: data.report.overall_risk_score } : null;

  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs min-w-0">
          <Breadcrumb email={scan.target_email} />
          <div className="flex flex-wrap items-center gap-space-sm pt-1">
            <span className="font-headline-lg text-headline-lg tracking-tight text-on-surface break-all">{scan.target_email}</span>
            <StatusBadge status="completed" />
          </div>
          <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 text-on-surface-variant font-mono-sm text-mono-sm pt-0.5">
            <span>Completed {formatDateTimeUtc(scan.completed_at)}</span>
            <span className="text-secondary/40">•</span>
            <span>
              Scan ID: <code className="text-on-surface">{scan.id}</code>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm self-start lg:self-center">
          <Button icon="tune" onClick={() => setScoringOpen(true)}>
            How scoring works
          </Button>
          <Button variant="primary" icon="sync" loading={runScan.pendingEmail !== null} onClick={() => void runScan.run(scan.target_email)}>
            Run again
          </Button>
        </div>
      </div>

      {runScan.error && <ErrorNotice title="Couldn't start a new scan" message={runScan.error} />}

      {loading && !data ? (
        <LoadingBlock label="Loading report" />
      ) : error ? (
        <ErrorNotice title="Couldn't load the report" message={error} onRetry={retry} />
      ) : (
        data && (
          <>
            {!data.report && (
              <Notice tone="warning">
                The scan completed but no report summary was stored. Findings below are shown as returned by the API.
              </Notice>
            )}
            <ScoreOverview result={data} findings={findings} coverage={coverage} />
            <RecommendedActions groups={actions} onJump={jumpTo} />
            <CategoryBreakdown rows={categories} />
            <FindingsList findings={findings} expanded={expanded} onToggle={toggle} />
            <CollectionNotes result={data} coverage={coverage} />
          </>
        )
      )}

      <ScoringDrawer open={scoringOpen} onClose={() => setScoringOpen(false)} instance={scoringInstance} />
    </div>
  );
}
