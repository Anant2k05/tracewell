import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

/** Input spec from DESIGN.md "Inputs & Selectors". */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const fieldId = id ?? rest.name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-9 px-3 rounded-control bg-panel border text-on-surface font-body-md text-body-md placeholder:text-[#6E7980]',
          'outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-colors',
          error ? 'border-sev-critical/60' : 'border-line-strong',
          className,
        )}
        {...rest}
      />
      {error ? (
        <span id={`${fieldId}-error`} className="font-body-sm text-body-sm text-sev-critical">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${fieldId}-hint`} className="font-body-sm text-body-sm text-[#6E7980]">
            {hint}
          </span>
        )
      )}
    </div>
  );
});

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Enter an email address.';
  if (!EMAIL_PATTERN.test(value.trim())) return 'Enter a valid email address.';
  return null;
}

/** Mirrors the backend's UserCreate rules (8–128 chars, a letter and a digit). */
export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Use at least 8 characters.';
  if (value.length > 128) return 'Use at most 128 characters.';
  if (!/[0-9]/.test(value)) return 'Include at least one digit.';
  if (!/[A-Za-z]/.test(value)) return 'Include at least one letter.';
  return null;
}
