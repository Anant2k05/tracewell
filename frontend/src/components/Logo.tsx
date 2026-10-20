import { cn } from '../utils/cn';

/**
 * Local brand mark. The Stitch export hot-linked a generated image from
 * lh3.googleusercontent.com, which isn't a stable asset, so it is replaced
 * with an inline SVG in the same position and size.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-space-sm', className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#181C1F" stroke="#232A2F" />
        <path d="M8 10h16M16 10v12" stroke="#B6E36A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="25" r="2.5" fill="#B6E36A" />
      </svg>
      <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight uppercase">Tracewell</span>
    </span>
  );
}
