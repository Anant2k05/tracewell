import { useEffect, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { cn } from '../utils/cn';

interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Digit boxes from the Stitch ownership-challenge screen, as real inputs.
 * Supports typing, backspace navigation, arrow keys, paste and one-time-code
 * autofill.
 */
export function OtpInput({ length, value, onChange, onComplete, disabled, invalid, autoFocus }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const split = length % 2 === 0 ? length / 2 : -1;

  useEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, length - 1)]?.focus();
    // Deliberately not keyed on `value`: refocusing on every keystroke would fight the user.
  }, [autoFocus, disabled]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const setAt = (index: number, input: string) => {
    const incoming = input.replace(/\D/g, '');
    if (!incoming) return;
    // Multi-character input (autofill) fills forward from this box.
    const chars = digits.slice();
    for (let i = 0; i < incoming.length && index + i < length; i++) chars[index + i] = incoming[i];
    const clean = commit(chars.join(''));
    refs.current[Math.min(index + incoming.length, length - 1, clean.length)]?.focus();
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const chars = digits.slice();
      if (chars[index]) {
        chars[index] = '';
        commit(chars.join('').slice(0, index) + chars.slice(index + 1).join(''));
      } else if (index > 0) {
        commit(chars.slice(0, index - 1).join('') + chars.slice(index).join(''));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const clean = commit(e.clipboardData.getData('text'));
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  };

  return (
    <div className="flex items-center gap-2 sm:gap-space-sm justify-center flex-wrap" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <div key={i} className="contents">
          {i === split && <div className="font-mono-lg text-headline-lg px-1 text-secondary" aria-hidden="true">-</div>}
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            className={cn(
              'w-11 h-14 sm:w-14 sm:h-20 rounded-lg text-center font-mono text-[28px] sm:text-headline-xl font-semibold text-on-surface caret-lime',
              'bg-surface-container focus:bg-surface-container-high outline-none focus:ring-1 focus:ring-lime transition-colors',
              invalid && 'ring-1 ring-sev-critical/60',
              disabled && 'opacity-60',
            )}
          />
        </div>
      ))}
    </div>
  );
}
