"""
Database models.

Core entities:
- User: an account holder using the platform.
- EmailVerification: proves the user controls the target email before a scan runs
  against it (consent gate — this is what keeps the tool "defensive", not recon).
- ScanRequest: one exposure-assessment run for a given email.
- RawFinding: a single normalized finding produced by one collector module.
- CorrelatedFinding: output of the correlation engine — findings linked/deduped
  across sources, with a category and severity.
- ScanReport: the final rolled-up report (risk score + summary) for a scan.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scans: Mapped[list["ScanRequest"]] = relationship(back_populates="owner")


class EmailVerification(Base):
    """OTP-based proof of ownership for a target email before scanning it."""

    __tablename__ = "email_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    target_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ScanStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ScanRequest(Base):
    __tablename__ = "scan_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    target_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    status: Mapped[ScanStatus] = mapped_column(Enum(ScanStatus), default=ScanStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped["User"] = relationship(back_populates="scans")
    raw_findings: Mapped[list["RawFinding"]] = relationship(back_populates="scan", cascade="all, delete-orphan")
    correlated_findings: Mapped[list["CorrelatedFinding"]] = relationship(
        back_populates="scan", cascade="all, delete-orphan"
    )
    report: Mapped["ScanReport"] = relationship(back_populates="scan", uselist=False, cascade="all, delete-orphan")


class RawFinding(Base):
    """One normalized finding as returned by a single collector module."""

    __tablename__ = "raw_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    scan_id: Mapped[str] = mapped_column(String(36), ForeignKey("scan_requests.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)          # e.g. "HIBP", "Gravatar"
    finding_type: Mapped[str] = mapped_column(String(64), nullable=False)     # e.g. "breach_exposure"
    value: Mapped[str] = mapped_column(Text, nullable=False)                 # human-readable finding
    data_classes: Mapped[list] = mapped_column(JSON, default=list)           # e.g. ["password_hash","address"]
    confidence: Mapped[str] = mapped_column(String(16), default="medium")    # low/medium/high
    raw_metadata: Mapped[dict] = mapped_column(JSON, default=dict)           # full source payload (trimmed)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scan: Mapped["ScanRequest"] = relationship(back_populates="raw_findings")


class CorrelatedFinding(Base):
    """Output of the correlation engine: one or more raw findings linked together."""

    __tablename__ = "correlated_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    scan_id: Mapped[str] = mapped_column(String(36), ForeignKey("scan_requests.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)   # identity/credential/behavioral/infra
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)   # low/medium/high/critical
    severity_score: Mapped[float] = mapped_column(Float, default=0.0)   # 0-10
    linked_source_count: Mapped[int] = mapped_column(Integer, default=1)
    contributing_sources: Mapped[list] = mapped_column(JSON, default=list)
    recommendation: Mapped[str] = mapped_column(Text, default="")

    scan: Mapped["ScanRequest"] = relationship(back_populates="correlated_findings")


class ScanReport(Base):
    __tablename__ = "scan_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    scan_id: Mapped[str] = mapped_column(String(36), ForeignKey("scan_requests.id"), unique=True, nullable=False)
    overall_risk_score: Mapped[float] = mapped_column(Float, default=0.0)     # 0-10
    overall_risk_label: Mapped[str] = mapped_column(String(16), default="low")
    summary: Mapped[str] = mapped_column(Text, default="")
    category_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scan: Mapped["ScanRequest"] = relationship(back_populates="report")
