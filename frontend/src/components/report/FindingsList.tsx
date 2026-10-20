import { useMemo, useState } from 'react';
import type { EnrichedFinding } from '../../utils/report';
import { categoryLabel, confidenceRank, isHighImpactDataClass, severityCounts, sourceLabel } from '../../utils/report';
import { cn } from '../../utils/cn';
import { formatDateUtc, formatScore, humanize } from '../../utils/format';
import type { Severity } from '../../utils/severity';
import { SEVERITY_ORDER, SEVERITY_STYLES } from '../../utils/severity';
import { Icon } from '../Icon';
import { SectionHeading } from '../Panel';
import { EmptyState } from '../States';

type Filter = 'all' | Severity;

/** Correlated findings with severity filter and a toggle for low-confidence matches. */
export function FindingsList({
  findings,
  expanded,
  onToggle,
}: {
  findings: EnrichedFinding[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [hidePossible, setHidePossible] = useState(false);
  const counts = useMemo(() => severityCounts(findings), [findings]);
  const possibleCount = findings.filter((f) => f.possibleMatch).length;

  const visible = findings.filter((f) => (filter === 'all' || f.severityKey === filter) && !(hidePossible && f.possibleMatch));

  return (
    <section>
      <SectionHeading
        icon="travel_explore"
        title="Correlated findings"
        count={findings.length}
        right={
          findings.length > 0 && (
            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="flex flex-wrap items-center p-0.5 rounded bg-panel border border-line text-[12px] font-mono-sm" role="group" aria-label="Filter by severity">
                {(['all', ...SEVERITY_ORDER] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-2.5 py-1 rounded',
                      filter === f ? 'bg-surface-container-high text-on-surface font-medium' : 'text-on-surface-variant hover:text-on-surface',
                    )}
                  >
                    {f === 'all' ? `All (${findings.length})` : `${SEVERITY_STYLES[f].label} (${counts[f]})`}
                  </button>
                ))}
              </div>
              {possibleCount > 0 && (
                <label className="flex items-center gap-2 cursor-pointer select-none px-space-sm py-1 rounded bg-panel border border-line text-on-surface-variant hover:text-on-surface">
                  <input
                    type="checkbox"
                    checked={hidePossible}
                    onChange={(e) => setHidePossible(e.target.checked)}
                    className="w-4 h-4 accent-[#B6E36A]"
                  />
                  <span className="text-[12px]">Hide possible matches ({possibleCount})</span>
                </label>
              )}
            </div>
          )
        }
      />
      {findings.length === 0 ? (
        <div className="bg-panel border border-line rounded-card">
          <EmptyState icon="verified_user" title="No notable exposure found">
            None of the sources that responded returned findings for this email. That isn't proof of zero exposure: it only means
            nothing turned up in the sources this assessment checks.
          </EmptyState>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-panel border border-line rounded-card p-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
          No findings match the current filter.
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          {visible.map((f) => (
            <FindingCard key={f.key} finding={f} open={expanded.has(f.key)} onToggle={() => onToggle(f.key)} />
          ))}
        </div>
      )}
    </section>
  );
}

const CONFIDENCE_TEXT: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

function ConfidenceMeter({ confidence, className }: { confidence: string | null; className?: string }) {
  const rank = confidenceRank(confidence);
  if (!rank) return <span className={cn('font-mono-sm text-[11px] text-on-surface-variant', className)}>Not reported</span>;
  const color = rank === 3 ? 'bg-lime' : rank === 2 ? 'bg-sev-medium' : 'bg-sev-neutral';
  const text = rank === 3 ? 'text-lime' : rank === 2 ? 'text-sev-medium' : 'text-sev-neutral';
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn('w-3 h-1.5 rounded-sm', n <= rank ? color : 'bg-panel-hover')} />
        ))}
      </span>
      <span className={cn('font-mono-sm text-[11px] font-semibold', text)}>
        {CONFIDENCE_TEXT[(confidence ?? '').toLowerCase()] ?? confidence} ({rank}/3)
      </span>
    </span>
  );
}

function FindingCard({ finding: f, open, onToggle }: { finding: EnrichedFinding; open: boolean; onToggle: () => void }) {
  const sev = SEVERITY_STYLES[f.severityKey];
  const bodyId = `${f.key}-body`;
  return (
    <article id={f.key} className="bg-panel border border-line rounded-card overflow-hidden scroll-mt-20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          'w-full text-left p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-sm hover:bg-panel-head transition-colors',
          open && 'bg-panel-head border-b border-line',
        )}
      >
        <div className="flex items-start md:items-center gap-space-sm min-w-0">
          <span className={cn('px-2 py-1 rounded text-mono-sm font-mono-sm font-bold shrink-0', sev.strong)}>▲ {formatScore(f.severity_score, 1)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{f.title}</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono-sm bg-[#1F2428] text-on-surface-variant border border-[#2F373E]">
                {categoryLabel(f.category)}
              </span>
              {f.linked_source_count >= 2 && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono-sm bg-sev-low/10 text-sev-low border border-sev-low/30 inline-flex items-center gap-1">
                  <Icon name="hub" className="text-[12px]" />
                  Corroborated by {f.linked_source_count} sources
                </span>
              )}
              {f.possibleMatch && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono-sm bg-sev-medium/10 text-sev-medium border border-sev-medium/30">
                  Possible match
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-space-sm gap-y-0.5 text-on-surface-variant font-mono-sm text-mono-sm mt-0.5">
              <span>
                Source{f.contributing_sources.length === 1 ? '' : 's'}:{' '}
                <strong className="text-on-surface font-medium">{f.contributing_sources.map(sourceLabel).join(', ') || '—'}</strong>
              </span>
              {f.occurredAt && (
                <>
                  <span>•</span>
                  <span>Breached: {formatDateUtc(f.occurredAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-center shrink-0">
          <span className={cn('px-2.5 py-1 rounded text-[11px] font-mono-sm font-medium uppercase', sev.pill)}>
            {f.severity || 'Unrated'} severity
          </span>
          <Icon name="expand_more" className={cn('text-[20px] text-on-surface-variant transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div id={bodyId} className="p-space-md md:p-space-lg flex flex-col gap-space-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="p-space-sm rounded bg-panel-2 border border-line">
              <span className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-1">Evidence</span>
              <ul className="flex flex-col gap-1.5">
                {f.evidence.map((e) => (
                  <li key={e.text} className="flex items-start gap-1.5 font-mono-sm text-mono-sm text-on-surface break-words">
                    <span className={cn('w-1.5 h-1.5 rounded-[9999px] mt-[5px] shrink-0', (e.confidence ?? '') === 'low' ? 'bg-sev-neutral' : sev.dot)} />
                    <span className="min-w-0">
                      {e.text}
                      {(e.source || e.confidence) && (
                        <span className="block text-[11px] text-on-surface-variant">
                          {e.source && sourceLabel(e.source)}
                          {e.confidence && ` · ${humanize(e.confidence)} confidence`}
                          {e.confidence === 'low' && ' (unconfirmed)'}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line">
                <span className="font-mono-sm text-[11px] text-on-surface-variant">Confidence:</span>
                <ConfidenceMeter confidence={f.confidence} />
              </div>
            </div>
            <div className="p-space-sm rounded bg-panel-2 border border-line">
              <span className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-1">Exposed data types</span>
              {f.dataClasses.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant pt-1">No data types were reported for this finding.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {f.dataClasses.map((dc) =>
                    isHighImpactDataClass(dc) ? (
                      <span key={dc} className="px-2 py-0.5 rounded text-[11px] font-mono-sm bg-sev-critical/15 text-sev-critical border border-sev-critical/50 flex items-center gap-1 font-semibold">
                        <Icon name="lock" className="text-[12px]" />
                        {humanize(dc)}
                      </span>
                    ) : (
                      <span key={dc} className="px-2 py-0.5 rounded text-[11px] font-mono-sm bg-[#22272B] text-on-surface border border-line-strong">
                        {humanize(dc)}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          {f.possibleMatch && (
            <p className="font-body-sm text-body-sm text-sev-medium flex items-start gap-1.5">
              <Icon name="help" className="text-[16px] mt-px" />
              Every piece of evidence here is low-confidence (for example, a matching username on another platform). It may not be
              your account. Check it before acting on it.
            </p>
          )}

          {f.recommendation && (
            <div className="p-space-sm rounded bg-[#1F221B] border border-[#3F5222] flex items-start gap-space-sm">
              <Icon name="verified_user" className="text-[18px] text-lime mt-0.5" />
              <div>
                <span className="font-headline-sm text-body-md text-lime block font-semibold">What to do</span>
                <p className="font-body-sm text-body-sm text-on-surface mt-0.5 leading-relaxed">{f.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
