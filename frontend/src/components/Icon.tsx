import { cn } from '../utils/cn';

/** Material Symbols Outlined glyph (self-hosted via the material-symbols package). */
export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('material-symbols-outlined select-none leading-none', className)} aria-hidden="true">
      {name}
    </span>
  );
}
