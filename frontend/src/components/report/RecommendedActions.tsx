import type { ActionGroup } from '../../utils/report';
import { cn } from '../../utils/cn';
import { formatScore } from '../../utils/format';
import { SEVERITY_STYLES } from '../../utils/severity';
import { Icon } from '../Icon';
import { SectionHeading } from '../Panel';

export function RecommendedActions({ groups, onJump }: { groups: ActionGroup[]; onJump: (key: string) => void }) {
  if (groups.length === 0) return null;
  return (
    <section>
      <SectionHeading
        icon="assignment_turned_in"
        title="Recommended actions"
        right={<span className="font-mono-sm text-mono-sm text-on-surface-variant">Sorted by severity</span>}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        {groups.map((g, i) => {
          const sev = SEVERITY_STYLES[g.top.severityKey];
          const names = g.findings.map((f) => f.title.replace(/^Data breach:\s*/, ''));
          return (
            <div key={g.recommendation} className="bg-panel border border-line rounded-card p-space-md flex flex-col justify-between hover:border-line-strong transition-colors">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center justify-between">
                  <span className={cn('px-2 py-0.5 rounded text-[11px] font-mono-sm font-semibold flex items-center gap-1', sev.pill)}>
                    <Icon name={sev.icon} className="text-[13px]" />
                    {g.top.severity ? `${sev.label} ${formatScore(g.top.severity_score, 1)}` : formatScore(g.top.severity_score, 1)}
                  </span>
                  <span className="font-mono-sm text-mono-sm text-on-surface-variant">Action #{i + 1}</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface mt-1 font-medium">{g.recommendation}</p>
              </div>
              <div className="mt-space-md pt-space-xs border-t border-line">
                <button
                  type="button"
                  onClick={() => onJump(g.findings[0].key)}
                  className="text-primary hover:underline font-mono-sm text-mono-sm inline-flex items-start gap-1 text-left"
                >
                  <span>
                    Applies to {g.findings.length} finding{g.findings.length === 1 ? '' : 's'} ({names.slice(0, 3).join(', ')}
                    {names.length > 3 ? `, +${names.length - 3} more` : ''})
                  </span>
                  <Icon name="arrow_downward" className="text-[14px] mt-px" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
