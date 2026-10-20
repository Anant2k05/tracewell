from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import User
from app.rate_limit import otp_rate_limiter
from app.schemas import OTPRequestOut, RequestOTP, VerifyOTP
from app.verification import create_and_send_otp, verify_otp

router = APIRouter(prefix="/verification", tags=["email-verification"])
settings = get_settings()


@router.post("/request-otp", response_model=OTPRequestOut, dependencies=[Depends(otp_rate_limiter)])
async def request_otp(
    payload: RequestOTP,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sends a one-time code to `target_email` to prove the requesting user
    controls it. A scan cannot be started against an email until this flow
    is completed — this is the consent gate that distinguishes this tool
    from a general-purpose recon tool.
    """
    dev_otp = await create_and_send_otp(db, user.id, payload.target_email)
    return OTPRequestOut(
        message=f"Verification code sent to {payload.target_email}.",
        expires_in_minutes=settings.OTP_EXPIRY_MINUTES,
        dev_otp=dev_otp,
    )


@router.post("/confirm-otp")
async def confirm_otp(
    payload: VerifyOTP,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await verify_otp(db, user.id, payload.target_email, payload.otp_code)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )
    return {"message": "Email ownership verified. You may now run a scan against this address."}
