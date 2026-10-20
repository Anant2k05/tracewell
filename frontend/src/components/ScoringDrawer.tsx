import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { formatScore } from '../utils/format';
import { Icon } from './Icon';

/**
 * "How scoring works" side sheet. The content documents the rules actually
 * implemented in backend/app/correlation/risk_scoring.py and normalizer.py
 * (the Stitch mock-up described different, invented weights). Keep it in
 * sync if the backend's scoring changes.
 */
const BASE_SEVERITY: Array<[string, string]> = [
  ['Public code/config leak (GitHub code search)', '7.0'],
  ['Data breach (one item per breach)', '6.0'],
  ['Real identity linkable via public profiles', '5.0'],
  ['Domain / infrastructure exposure', '4.0'],
  ['Public account / profile exposure', '3.0'],
  ['Any other finding type', '2.0'],
];

const BANDS: Array<[string, string, string]> = [
  ['Critical', '8.0 – 10.0', 'text-sev-critical'],
  ['High', '5.5 – 7.99', 'text-sev-high'],
  ['Medium', '3.0 – 5.49', 'text-sev-medium'],
  ['Low', '0.0 – 2.99', 'text-sev-low'],
];

export interface ScoringInstance {
  worst: number;
  mean: number;
  score: number;
}

export function ScoringDrawer({ open, onClose, instance }: { open: boolean; onClose: () => void; instance?: ScoringInstance | null }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="scoring-title">
      <div className="absolute inset-0 bg-canvas/80" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[440px] bg-panel-2 border-l border-line-strong flex flex-col">
        <div className="h-14 px-space-md flex items-center justify-between border-b border-line shrink-0">
          <div className="flex items-center gap-space-xs">
            <Icon name="tune" className="text-[18px] text-primary" />
            <h2 id="scoring-title" className="font-headline-sm text-headline-sm text-on-surface">
              How scoring works
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-panel-hover">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-lg font-body-sm text-body-sm text-secondary">
          <p>
            Scoring is rule-based and transparent: every number traces back to the rules below. Each correlated finding gets a
            severity from 0 to 10, and the overall score blends those findings.
          </p>

          <div className="flex flex-col gap-space-sm">
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">1 · Base severity by finding type</h3>
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-line">
                {BASE_SEVERITY.map(([type, base]) => (
                  <tr key={type}>
                    <td className="py-1.5 pr-2 text-on-surface">{type}</td>
                    <td className="py-1.5 text-right font-mono-md text-mono-md text-on-surface">{base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-space-sm">
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">2 · Adjustments, in order</h3>
            <ul className="flex flex-col gap-1.5">
              <Rule icon="add">
                <b className="text-on-surface">+2.5</b> if high-impact data was exposed: passwords or password hashes, credit cards,
                bank accounts, SSNs, government IDs, security questions.
              </Rule>
              <Rule icon="close">
                <b className="text-on-surface">× confidence</b>: high 1.0, medium 0.85, low 0.6. Username-only matches are low
                confidence, so they score lower.
              </Rule>
              <Rule icon="hub">
                <b className="text-on-surface">Corroboration</b>: +0.5 when 2 independent sources agree, +1.0 for 3 or more.
              </Rule>
              <Rule icon="vertical_align_top">Capped at 10.0.</Rule>
            </ul>
          </div>

          <div className="flex flex-col gap-space-sm">
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">3 · Overall score</h3>
            <div className="p-space-sm rounded bg-panel border border-line font-mono-md text-mono-md text-on-surface">
              Score = (Worst × 0.70) + (Average × 0.30)
            </div>
            <p>
              Weighting the single worst finding keeps one serious breach from being averaged away by many minor items, while the
              volume of exposure still moves the score.
            </p>
            {instance && (
              <div className="p-space-sm rounded bg-panel border border-line font-mono-sm text-mono-sm text-on-surface-variant">
                This scan: ({formatScore(instance.worst)} × 0.70) + ({formatScore(instance.mean)} × 0.30) ≈{' '}
                <span className="text-on-surface font-semibold">{formatScore(instance.score)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-space-sm">
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Severity bands</h3>
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-line">
                {BANDS.map(([name, range, color]) => (
                  <tr key={name}>
                    <td className={cn('py-1.5 font-semibold', color)}>{name}</td>
                    <td className="py-1.5 text-right font-mono-md text-mono-md text-on-surface">{range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-on-surface-variant">
            A clean result only means nothing was found in the sources this assessment checks. It is not proof that the email has
            never been exposed anywhere.
          </p>
        </div>

        <div className="p-space-md border-t border-line shrink-0">
          <button type="button" onClick={onClose} className="w-full h-9 rounded-control bg-panel border border-line-strong hover:bg-panel-hover text-on-surface font-body-sm text-body-sm">
            Dismiss
          </button>
        </div>
      </aside>
    </div>
  );
}

function Rule({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <Icon name={icon} className="text-[15px] text-lime mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
