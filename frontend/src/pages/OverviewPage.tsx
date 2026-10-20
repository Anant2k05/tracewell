import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SeverityChip, SeverityPill, StatusText, Tag } from '../components/Badges';
import { Button, ButtonLink } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { Icon } from '../components/Icon';
import { Panel, PanelHeader } from '../components/Panel';
import { DialGauge } from '../components/RiskGauge';
import { EmptyState, ErrorNotice, Skeleton } from '../components/States';
import { useNow } from '../hooks/useCountdown';
import { useResultsForScans } from '../hooks/useScanResults';
import { useRunScan } from '../hooks/useRunScan';
import { useScans } from '../hooks/useScans';
import { isActiveStatus } from '../services/api';
import type { FullScanResult, ScanOut } from '../types/api';
import { formatClockUtc, formatDateTimeUtc, formatDateUtc, formatElapsed, formatShortUtc, humanize, parseServerDate } from '../utils/format';
import { KNOWN_SOURCES, enrichFindings, sourceCoverage, sourceLabel } from '../utils/report';

const RECENT_LIMIT = 5;
const ACTIVE_REFRESH_MS = 10000;

export function OverviewPage() {
  const { scans, loading, error, reload, loadedAt } = useScans();
  const runScan = useRunScan();

  const latestCompleted = scans?.find((s) => s.status === 'completed') ?? null;
  const activeScan = scans?.find((s) => isActiveStatus(s.status)) ?? null;
  const recent = scans?.slice(0, RECENT_LIMIT) ?? [];
  // Risk scores come from each scan's report; fetch only completed rows on screen.
  const scoreIds = recent.filter((s) => s.status === 'completed').map((s) => s.id);
  const results = useResultsForScans(scoreIds);

  // While a scan is active, refresh the list occasionally so the dashboard
  // picks up its completion (well inside the backend's per-IP rate limit).
  useEffect(() => {
    if (!activeScan || loading) return;
    const id = window.setTimeout(() => void reload(), ACTIVE_REFRESH_MS);
    return () => window.clearTimeout(id);
  }, [activeScan, loading, reload]);

  const targets = useMemo(() => {
    const seen = new Map<string, ScanOut>();
    for (const s of scans ?? []) if (!seen.has(s.target_email)) seen.set(s.target_email, s);
    return Array.from(seen.values());
  }, [scans]);

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Utility bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-xs">
        <div className="flex items-center gap-space-sm">
          <div className="flex items-center gap-1.5 px-space-xs py-0.5 rounded bg-surface-container border border-line">
            <span className="w-1.5 h-1.5 rounded-[9999px] bg-primary" />
            <span className="font-mono-sm text-mono-sm text-on-surface-variant uppercase tracking-wider">Assessment ledger</span>
          </div>
          {loadedAt && <span className="font-mono-sm text-mono-sm text-on-surface-variant/60">Updated {formatClockUtc(loadedAt)}</span>}
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-mono-sm text-mono-sm uppercase disabled:opacity-60"
        >
          <Icon name="sync" className={loading ? 'text-[14px] animate-spin' : 'text-[14px]'} />
          Refresh
        </button>
      </div>

      {error && <ErrorNotice title="Couldn't load your assessments" message={error} onRetry={() => void reload()} />}
      {runScan.error && <ErrorNotice title="Couldn't start the scan" message={runScan.error} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <div className="lg:col-span-8">
          <LatestDossier
            loading={loading && !scans}
            scan={latestCompleted}
            result={latestCompleted ? results[latestCompleted.id] : undefined}
            hasAnyScans={(scans?.length ?? 0) > 0}
            onRunAgain={runScan.run}
            runPending={runScan.pendingEmail !== null}
          />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-space-lg">
          <NewAssessmentCard />
          <ActiveScanCard scan={activeScan} loading={loading && !scans} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg mt-space-sm">
        <div className="lg:col-span-8">
          <RecentAssessments scans={recent} total={scans?.length ?? 0} loading={loading && !scans} results={results} />
        </div>
        <div className="lg:col-span-4">
          <VerifiedEmails targets={targets} loading={loading && !scans} onRun={runScan.run} pendingEmail={runScan.pendingEmail} />
        </div>
      </div>
    </div>
  );
}

function LatestDossier({
  loading,
  scan,
  result,
  hasAnyScans,
  onRunAgain,
  runPending,
}: {
  loading: boolean;
  scan: ScanOut | null;
  result?: { data?: FullScanResult; error?: string };
  hasAnyScans: boolean;
  onRunAgain: (email: string) => void;
  runPending: boolean;
}) {
  const data = result?.data;
  const findings = useMemo(() => (data ? enrichFindings(data) : []), [data]);
  const coverage = useMemo(() => (data ? sourceCoverage(data.raw_findings) : []), [data]);
  const responded = coverage.filter((c) => c.state !== 'error' && KNOWN_SOURCES.some((k) => k.id === c.id)).length;

  return (
    <Panel className="p-space-md sm:p-space-lg flex flex-col justify-between h-full">
      <div>
        <PanelHeader
          icon="verified_user"
          title="Latest assessment"
          right={
            scan && (
              <div className="flex items-center gap-2">
                <span className="font-mono-sm text-mono-sm text-on-surface-variant">COMPLETED</span>
                <span className="font-mono-sm text-mono-sm text-on-surface font-medium">{formatDateTimeUtc(scan.completed_at ?? scan.created_at)}</span>
              </div>
            )
          }
        />

        {loading || (scan && !data && !result?.error) ? (
          <div className="mt-space-md flex flex-col gap-space-md">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-40" />
            <Skeleton className="h-24" />
          </div>
        ) : !scan ? (
          <EmptyState
            icon="radar"
            title={hasAnyScans ? 'No completed assessment yet' : 'Run your first assessment'}
            action={<ButtonLink to="/assess" variant="primary" icon="radar">Start new assessment</ButtonLink>}
            className="py-space-xl"
          >
            {hasAnyScans
              ? 'Your scans are still running or did not complete. Results appear here once a scan finishes.'
              : 'Verify an email address you own and Tracewell will check public breach, code, profile and domain sources for exposure.'}
          </EmptyState>
        ) : result?.error ? (
          <ErrorNotice className="mt-space-md" title="Couldn't load the latest report" message={result.error} />
        ) : (
          data && (
            <>
              <div className="mt-space-md flex flex-col sm:flex-row sm:items-baseline justify-between gap-space-xs">
                <div className="min-w-0">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest block">Target email</span>
                  <div className="font-mono-lg text-[17px] text-on-surface font-semibold tracking-tight mt-0.5 flex items-center gap-2 min-w-0">
                    <span className="text-primary-container truncate">{scan.target_email}</span>
                    <CopyButton value={scan.target_email} label="Copy email" />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-on-surface-variant font-mono-sm text-mono-sm shrink-0">
                  <Icon name="hub" className="text-[14px] text-primary" />
                  <span>
                    {responded}/{KNOWN_SOURCES.length} SOURCES RESPONDED
                  </span>
                </div>
              </div>

              {data.report ? (
                <div className="mt-space-lg grid grid-cols-1 md:grid-cols-12 gap-space-md items-center bg-panel-2 border border-line rounded-lg p-space-md">
                  <div className="md:col-span-5">
                    <DialGauge score={data.report.overall_risk_score} />
                  </div>
                  <div className="md:col-span-7 flex flex-col justify-center border-t md:border-t-0 md:border-l border-line pt-space-sm md:pt-0 md:pl-space-md">
                    <div className="flex items-center gap-space-sm mb-1.5">
                      <span className="font-mono-lg font-semibold tracking-tight text-[52px] leading-none text-on-surface">
                        {data.report.overall_risk_score.toFixed(2)}
                      </span>
                      <SeverityChip label={data.report.overall_risk_label} suffix="risk" className="text-[11px]" />
                    </div>
                    <p className="font-body-sm text-body-sm text-secondary leading-relaxed bg-panel p-2.5 rounded border border-line">
                      {data.report.summary}
                    </p>
                  </div>
                </div>
              ) : (
                <ErrorNotice className="mt-space-lg" title="Report not available" message="This scan completed but no report was stored for it." />
              )}

              <div className="mt-space-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Top priority findings</span>
                  <span className="font-mono-sm text-mono-sm text-on-surface-variant">Sorted by severity</span>
                </div>
                {findings.length === 0 ? (
                  <p className="p-2.5 rounded bg-panel-2 border border-line font-body-sm text-body-sm text-on-surface-variant">
                    No notable exposure was found in the sources checked.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {findings.slice(0, 3).map((f) => (
                      <Link
                        key={f.key}
                        to={`/scans/${scan.id}#${f.key}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded bg-panel-2 border border-line hover:bg-panel-hover transition-colors"
                      >
                        <div className="flex items-center gap-space-sm min-w-0">
                          <SeverityPill label={f.severity} score={f.severity_score} />
                          <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">{f.title}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-space-xs shrink-0">
                          {f.dataClasses.length > 0
                            ? f.dataClasses.slice(0, 2).map((dc) => <Tag key={dc}>{humanize(dc)}</Tag>)
                            : <Tag>{f.contributing_sources.map(sourceLabel).join(' + ')}</Tag>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>

      {scan && data && (
        <div className="mt-space-lg pt-space-md border-t border-line flex flex-wrap items-center gap-space-sm justify-between">
          <div className="flex items-center gap-2">
            <ButtonLink to={`/scans/${scan.id}`} variant="primary" iconRight="arrow_forward" className="h-auto py-2 px-4 text-headline-sm">
              View full report
            </ButtonLink>
            <Button icon="refresh" onClick={() => onRunAgain(scan.target_email)} disabled={runPending} className="h-auto py-2 px-4 text-body-md">
              Run again
            </Button>
          </div>
          <div className="flex items-center gap-1.5 font-mono-sm text-mono-sm text-on-surface-variant">
            <Icon name="lock" className="text-[14px]" />
            <span>Ownership-verified target</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function NewAssessmentCard() {
  return (
    <Panel className="p-space-md flex flex-col justify-between">
      <div>
        <PanelHeader
          icon="add_moderator"
          title="New assessment"
          className="pb-space-xs"
          right={<span className="font-mono-sm text-[10px] px-1.5 py-0.5 rounded bg-panel-2 border border-line-strong text-secondary">ON-DEMAND</span>}
        />
        <h3 className="font-headline-sm text-headline-sm text-on-surface mt-space-sm">Assess an email you control</h3>
        <p className="font-body-sm text-body-sm text-secondary mt-1 leading-relaxed">
          Verify ownership with a one-time code, then check {KNOWN_SOURCES.length} public sources for exposure.
        </p>
        <div className="mt-space-md p-space-sm rounded bg-panel-2 border border-line flex flex-col gap-1">
          {['XposedOrNot breach index', 'GitHub code & commit search', 'Gravatar, RDAP, crt.sh, username check'].map((line) => (
            <div key={line} className="flex items-center gap-2 text-on-surface-variant font-mono-sm text-mono-sm">
              <span className="w-1.5 h-1.5 rounded-[9999px] bg-primary shrink-0" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
      <ButtonLink to="/assess" variant="primary" icon="radar" className="mt-space-md w-full h-auto py-2.5 text-headline-sm">
        Start new assessment
      </ButtonLink>
    </Panel>
  );
}

function ActiveScanCard({ scan, loading }: { scan: ScanOut | null; loading: boolean }) {
  const now = useNow(Boolean(scan));
  const started = parseServerDate(scan?.created_at)?.getTime();
  const navigate = useNavigate();

  return (
    <Panel className="p-space-md flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-space-xs border-b border-line">
          <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <span className={scan ? 'w-2 h-2 rounded-[9999px] bg-lime animate-pulse' : 'w-2 h-2 rounded-[9999px] bg-sev-neutral'} />
            Active scan
          </span>
          {scan && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-lime/15 text-lime border border-lime/30 capitalize">
              {scan.status}
              {started && ` (${formatElapsed(now - started)})`}
            </span>
          )}
        </div>
        {loading ? (
          <Skeleton className="h-16 mt-space-md" />
        ) : scan ? (
          <>
            <div className="mt-space-md">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">Target</span>
              <div className="font-mono-md text-mono-md text-on-surface font-semibold truncate mt-0.5">{scan.target_email}</div>
              <span className="font-body-sm text-body-sm text-secondary mt-1 block">
                Checking {KNOWN_SOURCES.length} public sources in parallel
              </span>
            </div>
            <div className="mt-space-md flex flex-col gap-2">
              <div className="flex justify-between items-center font-mono-sm text-mono-sm text-on-surface-variant">
                <span>Server status</span>
                <span className="text-primary capitalize">{scan.status}</span>
              </div>
              <div className="w-full bg-panel-2 rounded-full h-1.5 overflow-hidden" aria-hidden="true">
                <div className="bg-lime h-1.5 w-2/5 rounded-full animate-indeterminate" />
              </div>
            </div>
          </>
        ) : (
          <p className="mt-space-md font-body-sm text-body-sm text-on-surface-variant">No scan is running right now.</p>
        )}
      </div>
      {scan && (
        <div className="mt-space-md pt-space-xs border-t border-line flex items-center justify-between">
          <span className="font-mono-sm text-mono-sm text-on-surface-variant">ID: {scan.id.slice(0, 8)}</span>
          <button type="button" onClick={() => navigate(`/scans/${scan.id}`)} className="text-primary hover:underline font-mono-sm text-mono-sm">
            View progress
          </button>
        </div>
      )}
    </Panel>
  );
}

function RecentAssessments({
  scans,
  total,
  loading,
  results,
}: {
  scans: ScanOut[];
  total: number;
  loading: boolean;
  results: Record<string, { data?: FullScanResult; error?: string }>;
}) {
  const navigate = useNavigate();
  return (
    <Panel className="overflow-hidden flex flex-col justify-between h-full">
      <div>
        <div className="p-space-md border-b border-line flex flex-wrap items-center justify-between gap-space-sm">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Recent assessments</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Your last {RECENT_LIMIT} scans</p>
          </div>
          <span className="font-mono-sm text-mono-sm px-2 py-0.5 rounded bg-panel-2 border border-line text-secondary">TOTAL: {total}</span>
        </div>
        {loading ? (
          <div className="p-space-md flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : scans.length === 0 ? (
          <EmptyState icon="history_toggle_off" title="No assessments yet">
            Scans you start will be listed here with their status and risk score.
          </EmptyState>
        ) : (
          <div className="relative overflow-x-auto">
            {/* relative: keeps the absolutely positioned sr-only header inside the scroll box on narrow screens */}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-canvas border-b border-line">
                  {['Target', 'Status', 'Started', 'Completed', 'Risk score'].map((h) => (
                    <th key={h} className="py-2.5 px-3 first:px-space-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="py-2.5 px-space-md text-right font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {scans.map((s) => {
                  const report = results[s.id]?.data?.report;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/scans/${s.id}`)}
                      className="hover:bg-panel-2 transition-colors group cursor-pointer"
                    >
                      <td className="py-3 px-space-md font-mono-md text-mono-md text-on-surface font-medium truncate max-w-[200px]">
                        <Link to={`/scans/${s.id}`} onClick={(e) => e.stopPropagation()} className="focus-visible:underline outline-none" title={s.target_email}>
                          {s.target_email}
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        <StatusText status={s.status} />
                      </td>
                      <td className="py-3 px-3 font-mono-sm text-mono-sm text-on-surface-variant whitespace-nowrap">{formatShortUtc(s.created_at)}</td>
                      <td className="py-3 px-3 font-mono-sm text-mono-sm text-secondary whitespace-nowrap">{formatShortUtc(s.completed_at)}</td>
                      <td className="py-3 px-3">
                        {report ? (
                          <SeverityPill label={report.overall_risk_label} score={report.overall_risk_score} uppercase={false} digits={2} />
                        ) : s.status === 'completed' && !results[s.id]?.error ? (
                          <Skeleton className="h-5 w-16" />
                        ) : (
                          <span className="font-mono-sm text-mono-sm text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="py-3 px-space-md text-right">
                        <Icon name="chevron_right" className="text-on-surface-variant group-hover:text-on-surface group-hover:translate-x-0.5 transition-all text-[18px]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="px-space-md py-space-sm border-t border-line bg-canvas flex items-center justify-between">
          <span className="font-mono-sm text-mono-sm text-on-surface-variant">
            Showing {Math.min(RECENT_LIMIT, total)} of {total}
          </span>
          <Link to="/history" className="text-primary hover:underline font-body-sm text-body-sm flex items-center gap-1">
            View all history <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
        </div>
      )}
    </Panel>
  );
}

/**
 * Emails that have been scanned. A scan can only be created after OTP
 * verification and the backend never expires a verification, so each of
 * these can be rescanned directly. There is no endpoint listing verified
 * emails that were never scanned.
 */
function VerifiedEmails({
  targets,
  loading,
  onRun,
  pendingEmail,
}: {
  targets: ScanOut[];
  loading: boolean;
  onRun: (email: string) => void;
  pendingEmail: string | null;
}) {
  return (
    <Panel className="p-space-md flex flex-col justify-between h-full">
      <div>
        <PanelHeader
          icon="verified"
          title="Your verified emails"
          className="pb-space-xs"
          right={<span className="font-mono-sm text-mono-sm text-on-surface-variant">{targets.length} SCANNED</span>}
        />
        <p className="font-body-sm text-body-sm text-secondary mt-space-sm">
          Addresses you've verified and scanned. Verification doesn't expire, so you can rescan without a new code.
        </p>
        <div className="mt-space-md flex flex-col gap-space-xs">
          {loading ? (
            <Skeleton className="h-14" />
          ) : targets.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">None yet.</p>
          ) : (
            targets.map((s) => (
              <div key={s.target_email} className="p-space-sm rounded bg-panel-2 border border-line flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono-sm text-mono-sm text-on-surface font-medium truncate" title={s.target_email}>
                    {s.target_email}
                  </div>
                  <span className="font-mono-sm text-[11px] text-on-surface-variant">Last: {formatDateUtc(s.created_at)}</span>
                </div>
                <Button
                  size="sm"
                  icon="refresh"
                  className="rounded-[4px] bg-panel h-7"
                  loading={pendingEmail === s.target_email}
                  disabled={pendingEmail !== null}
                  onClick={() => onRun(s.target_email)}
                >
                  Run
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="mt-space-md pt-space-xs border-t border-line">
        <Link
          to="/assess"
          className="w-full py-1.5 px-space-sm rounded bg-transparent hover:bg-panel-2 text-on-surface-variant hover:text-on-surface border border-dashed border-line-strong font-body-sm text-body-sm flex items-center justify-center gap-1 transition-colors"
        >
          <Icon name="add" className="text-[16px]" />
          Verify a new email
        </Link>
      </div>
    </Panel>
  );
}
