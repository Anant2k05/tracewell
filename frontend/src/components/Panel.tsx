import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { Icon } from './Icon';

/** Level-1 container from DESIGN.md: #121517, 1px #232A2F, 10px radius. */
export function Panel({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('bg-panel border border-line rounded-card', className)}>
      {children}
    </section>
  );
}

/** Uppercase label header row with a bottom divider, as on the dashboard cards. */
export function PanelHeader({
  icon,
  iconClassName = 'text-primary',
  title,
  right,
  className,
}: {
  icon?: string;
  iconClassName?: string;
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-space-sm pb-space-sm border-b border-line', className)}>
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <Icon name={icon} className={cn('text-[18px]', iconClassName)} />}
        <span className="font-label-md text-label-md text-on-surface tracking-wider uppercase">{title}</span>
      </div>
      {right}
    </div>
  );
}

/** Section heading used on the report page ("Recommended Actions", etc.). */
export function SectionHeading({
  icon,
  iconClassName = 'text-primary',
  title,
  count,
  right,
}: {
  icon: string;
  iconClassName?: string;
  title: string;
  count?: number;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-sm">
      <div className="flex items-center gap-space-xs">
        <Icon name={icon} className={cn('text-[20px]', iconClassName)} />
        <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
        {count !== undefined && (
          <span className="px-2 rounded bg-surface-container-high text-on-surface font-mono-sm text-[12px] ml-1">{count}</span>
        )}
      </div>
      {right}
    </div>
  );
}
