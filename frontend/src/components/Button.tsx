import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';
import { Icon } from './Icon';
import { Spinner } from './States';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

// Button specs from DESIGN.md "Components > Buttons".
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-lime hover:bg-lime-hover active:bg-lime-active text-ink font-headline-sm disabled:bg-surface-container-highest disabled:text-on-surface-variant',
  secondary:
    'bg-panel-2 hover:bg-panel-hover text-on-surface border border-line-strong hover:border-[#A4AEB5] disabled:hover:border-line-strong',
  ghost: 'bg-transparent hover:bg-panel-2 text-[#A4AEB5] hover:text-on-surface',
  destructive: 'bg-panel-2 text-sev-critical border border-sev-critical/30 hover:bg-sev-critical/10',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-body-sm',
  md: 'h-9 px-space-md text-body-sm',
  lg: 'py-2.5 px-space-lg text-headline-sm',
};

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-control transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:cursor-not-allowed disabled:opacity-70';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon && <Icon name={icon} className="text-[17px]" />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} className="text-[16px]" />}
    </button>
  );
}

interface ButtonLinkProps {
  to: string;
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ to, variant = 'secondary', size = 'md', icon, iconRight, className, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={cn(BASE, VARIANTS[variant], SIZES[size], className)}>
      {icon && <Icon name={icon} className="text-[17px]" />}
      {children}
      {iconRight && <Icon name={iconRight} className="text-[16px]" />}
    </Link>
  );
}
