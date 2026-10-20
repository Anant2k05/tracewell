import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { Icon } from './Icon';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-[9999px] border-2 border-current border-r-transparent', className ?? 'h-4 w-4')}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingBlock({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-space-sm py-space-xl text-on-surface-variant', className)}>
      <Spinner className="h-4 w-4 text-lime" />
      <span className="font-mono-sm text-mono-sm uppercase tracking-wider">{label}</span>
    </div>
  );
}

/** Placeholder bars while a panel's data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-panel-2', className)} />;
}

export function ErrorNotice({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex items-start gap-space-sm p-space-md rounded bg-surface-container-high', className)}>
      <div className="w-6 h-6 rounded bg-error-container text-on-error-container flex items-center justify-center shrink-0 mt-0.5">
        <Icon name="error" className="text-[16px]" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-headline-sm text-headline-sm text-error">{title}</span>
        <span className="font-body-sm text-body-sm text-on-surface-variant break-words">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-control border border-line-strong bg-panel-2 hover:bg-panel-hover text-on-surface font-body-sm text-body-sm"
        >
          <Icon name="refresh" className="text-[14px]" />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center gap-space-sm py-space-xl px-space-md', className)}>
      <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center text-primary">
        <Icon name={icon} className="text-[20px]" />
      </div>
      <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
      {children && <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">{children}</p>}
      {action && <div className="pt-space-xs">{action}</div>}
    </div>
  );
}

/** Inline banner for non-fatal notices (info / warning). */
export function Notice({
  tone = 'info',
  icon,
  children,
  onDismiss,
  className,
}: {
  tone?: 'info' | 'warning' | 'success';
  icon?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const tones = {
    info: { box: 'bg-panel-2 border-line', icon: 'info', color: 'text-secondary' },
    warning: { box: 'bg-sev-high/10 border-sev-high/30', icon: 'warning', color: 'text-sev-high' },
    success: { box: 'bg-[#1F221B] border-[#3F5222]', icon: 'check_circle', color: 'text-lime' },
  }[tone];
  return (
    <div className={cn('flex items-start gap-space-sm px-space-md py-space-sm rounded-lg border', tones.box, className)}>
      <Icon name={icon ?? tones.icon} className={cn('text-[18px] mt-px', tones.color)} />
      <div className="flex-1 font-body-sm text-body-sm text-on-surface">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-on-surface-variant hover:text-on-surface p-0.5">
          <Icon name="close" className="text-[16px]" />
        </button>
      )}
    </div>
  );
}
