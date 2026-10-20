"""
Orchestrates a full scan run end-to-end. Designed to be invoked from a
FastAPI BackgroundTask, so it opens its own DB session rather than reusing
the request-scoped one (which closes as soon as the HTTP response is sent).
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.collectors.orchestrator import run_collection_pipeline
from app.correlation.engine import build_scan_report, correlate_findings
from app.database import AsyncSessionLocal
from app.models import CorrelatedFinding, RawFinding, ScanReport, ScanRequest, ScanStatus

logger = logging.getLogger("osint.scan_service")


async def execute_scan(scan_id: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ScanRequest).where(ScanRequest.id == scan_id))
        scan = result.scalar_one_or_none()
        if scan is None:
            logger.error("Scan %s not found when attempting to execute", scan_id)
            return

        scan.status = ScanStatus.RUNNING
        await db.commit()

        try:
            # 1. Data collection pipeline (fan-out across all OSINT sources)
            normalized_findings = await run_collection_pipeline(scan.target_email)

            # 2. Persist raw findings
            raw_rows: list[RawFinding] = []
            for f in normalized_findings:
                row = RawFinding(
                    scan_id=scan.id,
                    source=f.source,
                    finding_type=f.finding_type,
                    value=f.value,
                    data_classes=f.data_classes,
                    confidence=f.confidence,
                    raw_metadata=f.raw_metadata,
                    occurred_at=f.occurred_at,
                )
                db.add(row)
                raw_rows.append(row)
            await db.commit()
            for row in raw_rows:
                await db.refresh(row)

            # 3. Correlation engine
            correlated = correlate_findings(raw_rows)
            for c in correlated:
                db.add(
                    CorrelatedFinding(
                        scan_id=scan.id,
                        category=c["category"],
                        title=c["title"],
                        description=c["description"],
                        severity=c["severity"],
                        severity_score=c["severity_score"],
                        linked_source_count=c["linked_source_count"],
                        contributing_sources=c["contributing_sources"],
                        recommendation=c["recommendation"],
                    )
                )

            # 4. Final report roll-up
            report_data = build_scan_report(correlated)
            db.add(
                ScanReport(
                    scan_id=scan.id,
                    overall_risk_score=report_data["overall_risk_score"],
                    overall_risk_label=report_data["overall_risk_label"],
                    summary=report_data["summary"],
                    category_breakdown=report_data["category_breakdown"],
                )
            )

            scan.status = ScanStatus.COMPLETED
            scan.completed_at = datetime.now(timezone.utc)
            await db.commit()

        except Exception as exc:  # noqa: BLE001
            logger.exception("Scan %s failed", scan_id)
            scan.status = ScanStatus.FAILED
            scan.error_message = str(exc)
            await db.commit()
