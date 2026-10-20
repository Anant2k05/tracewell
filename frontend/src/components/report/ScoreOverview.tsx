import type { FullScanResult } from '../../types/api';
import { cn } from '../../utils/cn';
import { formatScore } from '../../utils/format';
import type { EnrichedFinding, SourceCoverage } from '../../utils/report';
import { scoreInputs, severityCounts } from '../../utils/report';
import { SEVERITY_ORDER, SEVERITY_STYLES } from '../../utils/severity';
import { SeverityChip } from '../Badges';
import { Icon } from '../Icon';
import { ArcGauge } from '../RiskGauge';

/** Above-the-fold row of the report: score gauge, summary + severity counts, source coverage. */
export function ScoreOverview({
  result,
  findings,
  coverage,
}: {
  result: FullScanResult;
  findings: EnrichedFinding[];
  coverage: SourceCoverage[];
}) {
  const report = result.report;
  const inputs = scoreInputs(result.correlated_findings);
  const counts = severityCounts(findings);
  const failed = coverage.filter((c) => c.state === 'error').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
      <div className="lg:col-span-5 bg-panel border border-line rounded-card p-space-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-space-sm pb-space-md border-b border-line">
            <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Overall risk score</span>
            {report && <SeverityChip label={report.overall_risk_label} suffix="risk" />}
          </div>
          {report ? (
            <ArcGauge score={report.overall_risk_score} label={report.overall_risk_label} />
          ) : (
            <p className="py-space-xl text-center font-body-sm text-body-sm text-on-surface-variant">No report was stored for this scan.</p>
          )}
        </div>
        {report && inputs && (
          <div className="mt-space-md p-space-sm rounded bg-panel-2 border border-line">
            <div className="flex items-start gap-space-xs text-on-surface-variant">
              <Icon name="calculate" className="text-[16px] text-secondary mt-0.5" />
              <p className="font-body-sm text-body-sm">
                Score blends your worst finding (<strong className="text-on-surface font-mono-sm">70%</strong> weight ={' '}
                {formatScore(inputs.worst)}) with the average of all findings (<strong className="text-on-surface font-mono-sm">30%</strong>{' '}
                weight = {formatScore(inputs.mean)}).
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 flex flex-col gap-space-md">
        <div className="bg-panel border border-line rounded-card p-space-lg flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-line">
              <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Summary</span>
              <span className="font-mono-sm text-mono-sm text-on-surface-variant">{findings.length} correlated items</span>
            </div>
            <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
              {report?.summary ?? 'The backend did not return a summary for this scan.'}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm mt-space-md pt-space-md border-t border-line">
            {SEVERITY_ORDER.map((sev) => {
              const s = SEVERITY_STYLES[sev];
              return (
                <div key={sev} className={cn('bg-panel-2 p-space-sm rounded border flex items-center justify-between', s.border20)}>
                  <div>
                    <span className="block font-label-sm text-label-sm uppercase text-on-surface-variant">{s.label}</span>
                    <span className={cn('font-mono-lg text-headline-sm font-bold', s.text)}>{counts[sev]}</span>
                  </div>
                  <span className={cn('w-2.5 h-2.5 rounded-[9999px]', s.dot, counts[sev] === 0 && 'opacity-40')} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-panel border border-line rounded-card p-space-md">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Source coverage</span>
            <span className="font-mono-sm text-mono-sm text-secondary">
              {coverage.length - failed}/{coverage.length} responded
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-xs">
            {coverage.map((c) => (
              <div
                key={c.id}
                title={c.errors.join('\n') || undefined}
                className={cn(
                  'bg-panel-2 p-2 rounded border flex flex-col justify-between',
                  c.state === 'error' ? 'border-dashed border-sev-high/50' : 'border-line',
                )}
              >
                <span className="font-body-sm text-[12px] text-on-surface font-medium truncate">{c.label}</span>
                {c.state === 'findings' && (
                  <div className="flex items-center gap-1.5 mt-2 text-lime">
                    <span className="w-2 h-2 rounded-[9999px] bg-lime" />
                    <span className="font-mono-sm text-[11px]">{c.findingCount} found</span>
                  </div>
                )}
                {c.state === 'clear' && (
                  <div className="flex items-center gap-1 mt-2 text-sev-neutral">
                    <Icon name="check_circle" className="text-[13px]" />
                    <span className="font-mono-sm text-[10px] truncate">No findings</span>
                  </div>
                )}
                {c.state === 'error' && (
                  <div className="flex items-center gap-1 mt-2 text-sev-high">
                    <Icon name="build" className="text-[13px]" />
                    <span className="font-mono-sm text-[10px] truncate">Unavailable</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {failed > 0 && (
            <p className="mt-space-sm font-body-sm text-body-sm text-sev-high">
              {failed} source{failed === 1 ? '' : 's'} failed or timed out, so this report may be incomplete. See collection notes below.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
