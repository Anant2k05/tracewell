import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { formatScore } from '../utils/format';
import { SEVERITY_STYLES, toSeverity } from '../utils/severity';
import { Icon } from './Icon';

/** "▲ CRITICAL 8.5" style pill used in the overview's finding rows and tables. */
export function SeverityPill({
  label,
  score,
  uppercase = true,
  digits = 1,
  className,
}: {
  label: string;
  score?: number | null;
  uppercase?: boolean;
  digits?: number;
  className?: string;
}) {
  const sev = SEVERITY_STYLES[toSeverity(label)];
  const text = sev === SEVERITY_STYLES.neutral ? label || 'Unrated' : sev.label;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 whitespace-nowrap',
        sev.pill,
        className,
      )}
    >
      <Icon name="arrow_drop_up" className="text-[12px]" />
      {uppercase ? text.toUpperCase() : text}
      {score !== undefined && score !== null && ` ${formatScore(score, digits)}`}
    </span>
  );
}

/** Plain label chip: "HIGH RISK", "CRITICAL SEVERITY". */
export function SeverityChip({ label, suffix, className }: { label: string; suffix?: string; className?: string }) {
  const sev = SEVERITY_STYLES[toSeverity(label)];
  return (
    <span className={cn('px-2 py-0.5 rounded font-mono-sm text-mono-sm font-semibold uppercase whitespace-nowrap', sev.pill, className)}>
      {(label || 'Unrated').toUpperCase()}
      {suffix && ` ${suffix}`}
    </span>
  );
}

const STATUS_STYLES: Record<string, { text: string; dot: string; label: string; pulse?: boolean }> = {
  completed: { text: 'text-lime', dot: 'bg-lime', label: 'Completed' },
  running: { text: 'text-lime', dot: 'bg-lime', label: 'Running', pulse: true },
  pending: { text: 'text-sev-medium', dot: 'bg-sev-medium', label: 'Pending', pulse: true },
  failed: { text: 'text-sev-critical', dot: 'bg-sev-critical', label: 'Failed' },
};

/** Scan status as plain dot + text (tables). */
export function StatusText({ status, className }: { status: string; className?: string }) {
  const s = STATUS_STYLES[status] ?? { text: 'text-sev-neutral', dot: 'bg-sev-neutral', label: status || 'Unknown' };
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono-sm text-mono-sm whitespace-nowrap', s.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-[9999px]', s.dot, s.pulse && 'animate-pulse')} />
      {s.label}
    </span>
  );
}

/** Scan status as a boxed badge (report / progress headers). */
export function StatusBadge({ status, extra }: { status: string; extra?: string }) {
  const s = STATUS_STYLES[status] ?? { text: 'text-sev-neutral', dot: 'bg-sev-neutral', label: status || 'Unknown' };
  const box =
    status === 'completed' || status === 'running'
      ? 'bg-[#1F2E23] border-[#2D452B] text-lime-active'
      : status === 'failed'
        ? 'bg-sev-critical/10 border-sev-critical/30 text-sev-critical'
        : 'bg-sev-medium/10 border-sev-medium/30 text-sev-medium';
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-mono-sm font-medium border', box)}>
      <span className={cn('w-1.5 h-1.5 rounded-[9999px]', s.dot, s.pulse && 'animate-pulse')} />
      {s.label}
      {extra && ` (${extra})`}
    </span>
  );
}

/** Small neutral mono tag (data classes, sources). */
export function Tag({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn('px-1.5 py-0.5 rounded bg-panel border border-line font-mono-sm text-mono-sm text-on-surface-variant whitespace-nowrap', className)}
    >
      {children}
    </span>
  );
}
