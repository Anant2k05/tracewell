"""
Pydantic schemas for request/response validation (separate from ORM models).
"""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Auth ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    refresh_token: str


# ---------- Email ownership verification (consent gate) ----------

class RequestOTP(BaseModel):
    target_email: EmailStr


class VerifyOTP(BaseModel):
    target_email: EmailStr
    otp_code: str = Field(min_length=4, max_length=10)


class OTPRequestOut(BaseModel):
    message: str
    expires_in_minutes: int
    dev_otp: str | None = None  # only populated in OTP_DEV_MODE for local testing


# ---------- Scans ----------

class ScanCreate(BaseModel):
    target_email: EmailStr


class ScanOut(BaseModel):
    id: str
    target_email: str
    status: str
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class RawFindingOut(BaseModel):
    source: str
    finding_type: str
    value: str
    data_classes: list[str]
    confidence: str
    occurred_at: datetime | None

    model_config = {"from_attributes": True}


class CorrelatedFindingOut(BaseModel):
    category: str
    title: str
    description: str
    severity: str
    severity_score: float
    linked_source_count: int
    contributing_sources: list[str]
    recommendation: str

    model_config = {"from_attributes": True}


class ScanReportOut(BaseModel):
    overall_risk_score: float
    overall_risk_label: str
    summary: str
    category_breakdown: dict
    generated_at: datetime

    model_config = {"from_attributes": True}


class FullScanResult(BaseModel):
    scan: ScanOut
    raw_findings: list[RawFindingOut]
    correlated_findings: list[CorrelatedFindingOut]
    report: ScanReportOut | None
