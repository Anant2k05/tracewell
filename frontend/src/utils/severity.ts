/**
 * Presentation styles for the severity labels the backend assigns
 * (backend/app/correlation/risk_scoring.py `severity_label`). The frontend
 * never derives a label from a score itself; it only styles the label it
 * receives. Class strings are written out in full so Tailwind can see them.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'neutral';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export function toSeverity(label: string | null | undefined): Severity {
  const l = (label ?? '').toLowerCase();
  return l === 'critical' || l === 'high' || l === 'medium' || l === 'low' ? l : 'neutral';
}

interface SeverityStyle {
  label: string;
  text: string;
  dot: string;
  bar: string;
  pill: string; // soft background + border, used for badges
  strong: string; // stronger variant used for finding score badges
  border20: string;
  hex: string;
  icon: string;
}

export const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  critical: {
    label: 'Critical',
    text: 'text-sev-critical',
    dot: 'bg-sev-critical',
    bar: 'bg-sev-critical',
    pill: 'bg-sev-critical/15 text-sev-critical border border-sev-critical/30',
    strong: 'bg-sev-critical/20 text-sev-critical border border-sev-critical/40',
    border20: 'border-sev-critical/20',
    hex: '#FF5D5D',
    icon: 'emergency_home',
  },
  high: {
    label: 'High',
    text: 'text-sev-high',
    dot: 'bg-sev-high',
    bar: 'bg-sev-high',
    pill: 'bg-sev-high/15 text-sev-high border border-sev-high/30',
    strong: 'bg-sev-high/20 text-sev-high border border-sev-high/40',
    border20: 'border-sev-high/20',
    hex: '#FF9F43',
    icon: 'warning',
  },
  medium: {
    label: 'Medium',
    text: 'text-sev-medium',
    dot: 'bg-sev-medium',
    bar: 'bg-sev-medium',
    pill: 'bg-sev-medium/15 text-sev-medium border border-sev-medium/30',
    strong: 'bg-sev-medium/20 text-sev-medium border border-sev-medium/40',
    border20: 'border-sev-medium/20',
    hex: '#F2C94C',
    icon: 'error',
  },
  low: {
    label: 'Low',
    text: 'text-sev-low',
    dot: 'bg-sev-low',
    bar: 'bg-sev-low',
    pill: 'bg-sev-low/15 text-sev-low border border-sev-low/30',
    strong: 'bg-sev-low/20 text-sev-low border border-sev-low/40',
    border20: 'border-sev-low/20',
    hex: '#7FA7C9',
    icon: 'info',
  },
  neutral: {
    label: 'Unrated',
    text: 'text-sev-neutral',
    dot: 'bg-sev-neutral',
    bar: 'bg-sev-neutral',
    pill: 'bg-sev-neutral/15 text-sev-neutral border border-sev-neutral/30',
    strong: 'bg-sev-neutral/20 text-sev-neutral border border-sev-neutral/40',
    border20: 'border-sev-neutral/20',
    hex: '#8A949B',
    icon: 'help',
  },
};
