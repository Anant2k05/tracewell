from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import CorrelatedFinding, RawFinding, ScanReport, ScanRequest, User
from app.rate_limit import general_rate_limiter, scan_rate_limiter
from app.scan_service import execute_scan
from app.schemas import (
    CorrelatedFindingOut,
    FullScanResult,
    RawFindingOut,
    ScanCreate,
    ScanOut,
    ScanReportOut,
)
from app.verification import has_verified_email

router = APIRouter(prefix="/scans", tags=["scans"], dependencies=[Depends(general_rate_limiter)])


@router.post("", response_model=ScanOut, status_code=status.HTTP_202_ACCEPTED)
async def create_scan(
    payload: ScanCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    _: None = Depends(scan_rate_limiter),
    db: AsyncSession = Depends(get_db),
):
    """
    Starts a new exposure assessment scan. Requires that the target email has
    already been OTP-verified as owned by this user (see /verification).
    """
    verified = await has_verified_email(db, user.id, payload.target_email)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This email has not been verified yet. Complete email verification "
                "via /verification/request-otp and /verification/confirm-otp before scanning it."
            ),
        )

    scan = ScanRequest(user_id=user.id, target_email=payload.target_email)
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    background_tasks.add_task(execute_scan, scan.id)

    return scan


@router.get("", response_model=list[ScanOut])
async def list_scans(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScanRequest).where(ScanRequest.user_id == user.id).order_by(ScanRequest.created_at.desc())
    )
    return result.scalars().all()


async def _get_owned_scan(scan_id: str, user: User, db: AsyncSession) -> ScanRequest:
    result = await db.execute(
        select(ScanRequest)
        .where(ScanRequest.id == scan_id, ScanRequest.user_id == user.id)
        .options(
            selectinload(ScanRequest.raw_findings),
            selectinload(ScanRequest.correlated_findings),
            selectinload(ScanRequest.report),
        )
    )
    scan = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return scan


@router.get("/{scan_id}", response_model=ScanOut)
async def get_scan_status(scan_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    scan = await _get_owned_scan(scan_id, user, db)
    return scan


@router.get("/{scan_id}/results", response_model=FullScanResult)
async def get_scan_results(scan_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    scan = await _get_owned_scan(scan_id, user, db)

    report_out = ScanReportOut.model_validate(scan.report) if scan.report else None

    return FullScanResult(
        scan=ScanOut.model_validate(scan),
        raw_findings=[RawFindingOut.model_validate(f) for f in scan.raw_findings],
        correlated_findings=[CorrelatedFindingOut.model_validate(f) for f in scan.correlated_findings],
        report=report_out,
    )
