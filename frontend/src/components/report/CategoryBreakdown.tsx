import type { CategoryRow } from '../../utils/report';
import { cn } from '../../utils/cn';
import { formatScore } from '../../utils/format';
import { SEVERITY_STYLES } from '../../utils/severity';
import { Icon } from '../Icon';
import { SectionHeading } from '../Panel';

/** report.category_breakdown: item count and peak severity per category. */
export function CategoryBreakdown({ rows }: { rows: CategoryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionHeading
        icon="donut_large"
        iconClassName="text-secondary"
        title="Exposure by category"
        right={<span className="font-mono-sm text-mono-sm text-on-surface-variant">Peak severity, scale 0.0–10.0</span>}
      />
      <div className="bg-panel border border-line rounded-card p-space-lg flex flex-col gap-space-md">
        {rows.map((row, i) => {
          const sev = SEVERITY_STYLES[row.severityKey];
          return (
            <div key={row.category} className={cn('flex flex-col gap-1.5', i > 0 && 'pt-space-sm border-t border-line')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-space-xs">
                  <Icon name={row.icon} className={cn('text-[16px]', sev.text)} />
                  <span className="font-headline-sm text-body-md text-on-surface font-semibold">{row.label}</span>
                  <span className="text-on-surface-variant font-mono-sm text-mono-sm">
                    ({row.count} item{row.count === 1 ? '' : 's'})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-on-surface-variant font-body-sm text-body-sm">Peak severity:</span>
                  <span className={cn('font-mono-md text-mono-md font-bold', sev.text)}>
                    {formatScore(row.maxScore, 1)} {row.severityLabel && sev.label}
                  </span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-panel-2 rounded-full overflow-hidden flex" aria-hidden="true">
                <div className={cn('h-full', sev.bar)} style={{ width: `${Math.min(100, Math.max(0, row.maxScore * 10))}%` }} />
              </div>
              <div className="flex justify-between gap-space-sm font-mono-sm text-[11px] text-on-surface-variant">
                <span className="truncate" title={row.titles.join(', ')}>
                  Items: {row.titles.join(', ') || '—'}
                </span>
                <span className="shrink-0">{formatScore(row.maxScore, 1)} / 10.0</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
