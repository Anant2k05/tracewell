/**
 * Types mirroring the FastAPI backend's Pydantic schemas
 * (backend/app/schemas.py). Datetimes arrive as ISO strings; when the backend
 * uses SQLite they may lack a timezone suffix and are UTC (see utils/format).
 */

// ---------- Auth ----------

export interface UserOut {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ---------- Email ownership verification ----------

export interface OTPRequestOut {
  message: string;
  expires_in_minutes: number;
  /** Only populated when the backend runs with OTP_DEV_MODE=true. */
  dev_otp: string | null;
}

/** POST /verification/confirm-otp returns a plain dict, not a schema. */
export interface ConfirmOtpOut {
  message: string;
}

// ---------- Scans ----------

/** backend/app/models.py ScanStatus */
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ScanOut {
  id: string;
  target_email: string;
  status: ScanStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface RawFindingOut {
  source: string;
  finding_type: string;
  value: string;
  data_classes: string[];
  confidence: Confidence | string;
  occurred_at: string | null;
}

export interface CorrelatedFindingOut {
  category: string;
  title: string;
  description: string;
  severity: string;
  severity_score: number;
  linked_source_count: number;
  contributing_sources: string[];
  recommendation: string;
}

export interface CategoryBreakdownEntry {
  count: number;
  max_severity_score: number;
}

export interface ScanReportOut {
  overall_risk_score: number;
  overall_risk_label: string;
  summary: string;
  category_breakdown: Record<string, CategoryBreakdownEntry>;
  generated_at: string;
}

export interface FullScanResult {
  scan: ScanOut;
  raw_findings: RawFindingOut[];
  correlated_findings: CorrelatedFindingOut[];
  report: ScanReportOut | null;
}

export interface HealthOut {
  status: string;
  app: string;
  env: string;
}
