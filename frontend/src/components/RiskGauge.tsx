import { cn } from '../utils/cn';
import { formatScore } from '../utils/format';
import { SEVERITY_STYLES, toSeverity } from '../utils/severity';

/**
 * Semicircular 0–10 gauges from the Stitch screens. Band boundaries
 * (3.0 / 5.5 / 8.0) match the backend's severity_label thresholds. The value
 * and its label are always the backend's overall_risk_score / _label.
 */
const BANDS = [
  { color: '#7FA7C9', from: 0, to: 0.3 },
  { color: '#F2C94C', from: 0.3, to: 0.55 },
  { color: '#FF9F43', from: 0.55, to: 0.8 },
  { color: '#FF5D5D', from: 0.8, to: 1 },
];

const clamp = (score: number) => Math.min(10, Math.max(0, score));

/** Overview dashboard dial: banded arc with a needle. */
export function DialGauge({ score }: { score: number }) {
  const len = Math.PI * 80;
  const angle = 180 * (clamp(score) / 10);
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-48 h-24 flex items-end justify-center overflow-hidden">
        <svg className="w-48 h-24" viewBox="0 0 200 100" role="img" aria-label={`Risk score ${formatScore(score)} out of 10`}>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#232A2F" strokeWidth="14" />
          {BANDS.map((b) => (
            <path
              key={b.color}
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={b.color}
              strokeWidth="14"
              strokeDasharray={`${(b.to - b.from) * len} ${len}`}
              strokeDashoffset={-b.from * len}
            />
          ))}
          <g transform={`rotate(${angle} 100 100)`}>
            <line stroke="#E1E2E5" strokeLinecap="round" strokeWidth="3" x1="100" x2="30" y1="100" y2="100" />
            <circle cx="100" cy="100" fill="#B6E36A" r="5" />
          </g>
        </svg>
        <div className="absolute bottom-0 text-center flex flex-col items-center">
          <span className="font-mono-lg text-headline-sm text-on-surface font-semibold tracking-tighter">{formatScore(score)}</span>
          <span className="font-mono-sm text-[10px] text-on-surface-variant uppercase">Index scale / 10</span>
        </div>
      </div>
      <div className="w-full grid grid-cols-4 gap-1 text-center mt-3 pt-2 border-t border-line/60">
        {[
          ['bg-sev-low', '<3.0', 'LOW'],
          ['bg-sev-medium', '3-5.5', 'MED'],
          ['bg-sev-high', '5.5-8', 'HIGH'],
          ['bg-sev-critical', '8+', 'CRIT'],
        ].map(([dot, range, label]) => (
          <div key={label} className="flex flex-col items-center">
            <span className={cn('w-1.5 h-1.5 rounded-[9999px] mb-0.5', dot)} />
            <span className="font-mono-sm text-[10px] text-on-surface-variant">{range}</span>
            <span className="font-label-sm text-[9px] text-secondary">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Report page gauge: dimmed bands with the score filled in its severity colour. */
export function ArcGauge({ score, label }: { score: number; label: string }) {
  const len = Math.PI * 100;
  const sevKey = toSeverity(label);
  const sev = SEVERITY_STYLES[sevKey];
  const bands = [
    { key: 'low', range: '<3.0', name: 'Low', text: 'text-sev-low', border: 'border-sev-low/40' },
    { key: 'medium', range: '3.0–5.5', name: 'Medium', text: 'text-sev-medium', border: 'border-sev-medium/40' },
    { key: 'high', range: '5.5–8.0', name: 'High', text: 'text-sev-high', border: 'border-sev-high/40' },
    { key: 'critical', range: '8.0+', name: 'Critical', text: 'text-sev-critical', border: 'border-sev-critical/40' },
  ];
  return (
    <div className="py-space-md flex flex-col items-center">
      <div className="relative w-[240px] h-[130px] flex items-end justify-center">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 240 130" role="img" aria-label={`Risk score ${formatScore(score)} out of 10, ${label}`}>
          <path d="M 20 120 A 100 100 0 0 1 220 120" fill="none" stroke="#1D2022" strokeWidth="14" strokeLinecap="round" />
          {BANDS.map((b) => (
            <path
              key={b.color}
              d="M 20 120 A 100 100 0 0 1 220 120"
              fill="none"
              opacity="0.3"
              stroke={b.color}
              strokeWidth="14"
              strokeDasharray={`${(b.to - b.from) * len} ${len}`}
              strokeDashoffset={-b.from * len}
            />
          ))}
          {score > 0 && (
            <path
              d="M 20 120 A 100 100 0 0 1 220 120"
              fill="none"
              stroke={sev.hex}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${(clamp(score) / 10) * len} ${len}`}
            />
          )}
        </svg>
        <div className="absolute bottom-0 text-center flex flex-col items-center">
          <span className="font-mono-lg text-[52px] leading-none font-bold text-on-surface tracking-tighter">{formatScore(score)}</span>
          <span className={cn('font-label-md text-label-md font-semibold uppercase tracking-widest mt-1', sev.text)}>
            {label ? `${label} severity` : 'Unrated'}
          </span>
        </div>
      </div>
      <div className="w-full grid grid-cols-4 gap-1.5 mt-space-md pt-space-sm border-t border-line text-center">
        {bands.map((b) => {
          const active = b.key === sevKey;
          return (
            <div key={b.key} className={cn('flex flex-col items-center p-1 rounded bg-panel-2 border', active ? b.border : 'border-transparent')}>
              <span className={cn('font-mono-sm text-mono-sm', b.text, active ? 'font-bold' : 'font-medium')}>{b.range}</span>
              <span className={cn('font-label-sm text-[10px] uppercase', active ? b.text : 'text-on-surface-variant')}>{b.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
