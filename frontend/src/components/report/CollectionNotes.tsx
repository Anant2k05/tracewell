import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FullScanResult } from '../../types/api';
import { cn } from '../../utils/cn';
import { formatDateUtc, humanize } from '../../utils/format';
import type { SourceCoverage } from '../../utils/report';
import { isSystemFinding, sourceLabel } from '../../utils/report';
import { Icon } from '../Icon';
import { SectionHeading } from '../Panel';

function scopeText(scope: SourceCoverage['scope'], email: string): string {
  const [local, domain] = email.split('@');
  if (scope === 'domain') return domain ?? '—';
  if (scope === 'username') return `"${local}"`;
  if (scope === 'email') return email;
  return '—';
}

const CLEAR_NOTES: Record<string, string> = {
  RDAP: 'Nothing returned. Most registrars redact contact emails in RDAP since GDPR, so an empty result is expected.',
  XposedOrNot: 'No breaches indexed for this email. Breaches XposedOrNot does not track would not appear.',
};

/** Per-source outcome table plus the raw findings and raw API response. */
export function CollectionNotes({ result, coverage }: { result: FullScanResult; coverage: SourceCoverage[] }) {
  const email = result.scan.target_email;
  return (
    <section>
      <SectionHeading
        icon="fact_check"
        title="Collection notes"
        right={<span className="font-mono-sm text-mono-sm text-on-surface-variant">Per-source outcome</span>}
      />
      <div className="bg-panel border border-line rounded-card overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-canvas border-b border-line">
                {['Source', 'Checked', 'Status', 'Notes'].map((h) => (
                  <th key={h} className="py-2.5 px-space-md font-label-md text-label-md text-[#6E7980] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coverage.map((c) => (
                <tr key={c.id} className="hover:bg-panel-2 transition-colors align-top">
                  <td className="py-3 px-space-md font-mono-md text-mono-md text-on-surface whitespace-nowrap">{c.label}</td>
                  <td className="py-3 px-space-md font-mono-sm text-mono-sm text-secondary break-all">{scopeText(c.scope, email)}</td>
                  <td className="py-3 px-space-md whitespace-nowrap">
                    {c.state === 'error' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-sm bg-sev-high/10 text-sev-high border border-sev-high/30">
                        <Icon name="warning" className="text-[12px]" /> Error
                      </span>
                    ) : c.state === 'findings' ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-sm bg-lime/10 text-lime border border-lime/30">
                        {c.findingCount} finding{c.findingCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-sm bg-sev-neutral/10 text-sev-neutral border border-sev-neutral/30">No findings</span>
                    )}
                  </td>
                  <td className="py-3 px-space-md font-body-sm text-body-sm text-on-surface-variant">
                    {c.state === 'error'
                      ? c.errors.join(' ')
                      : c.state === 'clear'
                        ? CLEAR_NOTES[c.id] ?? 'Nothing returned for this target.'
                        : 'See correlated findings and raw findings.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RawFindings result={result} />
      <RawJson result={result} />
    </section>
  );
}

function Collapsible({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-space-md bg-panel border border-line rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-space-sm p-space-md hover:bg-panel-2 transition-colors text-left"
      >
        <span className="flex items-center gap-space-xs min-w-0">
          <Icon name={icon} className="text-[18px] text-secondary" />
          <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
          <span className="font-mono-sm text-mono-sm text-on-surface-variant truncate">{subtitle}</span>
        </span>
        <span className="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm shrink-0">
          {open ? 'Collapse' : 'Expand'}
          <Icon name="expand_more" className={cn('text-[18px] transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && <div className="border-t border-line">{children}</div>}
    </div>
  );
}

/** Every raw finding exactly as collected, including collector errors. */
function RawFindings({ result }: { result: FullScanResult }) {
  const rows = result.raw_findings;
  return (
    <Collapsible title="Raw findings" subtitle={`(${rows.length}, before correlation)`} icon="list_alt">
      {rows.length === 0 ? (
        <p className="p-space-md font-body-sm text-body-sm text-on-surface-variant">No raw findings were recorded.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-canvas border-b border-line">
                {['Source', 'Type', 'Finding', 'Data types', 'Confidence', 'Date'].map((h) => (
                  <th key={h} className="py-2.5 px-space-md font-label-md text-label-md text-[#6E7980] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => {
                const system = isSystemFinding(r);
                return (
                  <tr key={i} className={cn('align-top hover:bg-panel-2', system && 'bg-sev-high/5')}>
                    <td className="py-2.5 px-space-md font-mono-sm text-mono-sm text-on-surface whitespace-nowrap">{sourceLabel(r.source)}</td>
                    <td className={cn('py-2.5 px-space-md font-mono-sm text-mono-sm whitespace-nowrap', system ? 'text-sev-high' : 'text-secondary')}>
                      {r.finding_type}
                    </td>
                    <td className="py-2.5 px-space-md font-body-sm text-body-sm text-on-surface break-words">{r.value}</td>
                    <td className="py-2.5 px-space-md font-mono-sm text-mono-sm text-on-surface-variant">
                      {r.data_classes.length ? r.data_classes.map(humanize).join(', ') : '—'}
                    </td>
                    <td className="py-2.5 px-space-md font-mono-sm text-mono-sm text-on-surface-variant whitespace-nowrap">{humanize(r.confidence)}</td>
                    <td className="py-2.5 px-space-md font-mono-sm text-mono-sm text-on-surface-variant whitespace-nowrap">{formatDateUtc(r.occurred_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Collapsible>
  );
}

function RawJson({ result }: { result: FullScanResult }) {
  return (
    <Collapsible title="Raw API response" subtitle="(GET /scans/{id}/results)" icon="terminal">
      <pre className="p-space-md overflow-x-auto max-h-[480px] font-mono-sm text-mono-sm text-secondary bg-canvas">
        {JSON.stringify(result, null, 2)}
      </pre>
    </Collapsible>
  );
}
