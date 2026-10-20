"""
Email ownership verification (OTP).

Design intent: this system must only ever scan an email address that its
owner has actively proven control over. This module is the enforcement
point for that rule — a ScanRequest cannot be created against `target_email`
unless there is a matching, unexpired, verified EmailVerification row owned
by the requesting user.
"""
import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import pwd_context
from app.config import get_settings
from app.models import EmailVerification

settings = get_settings()


def _generate_otp(length: int) -> str:
    return "".join(random.choices(string.digits, k=length))


async def send_otp_email(to_email: str, otp_code: str) -> None:
    """
    Sends the OTP to the target email. Falls back to logging (dev mode) if
    SMTP is not configured, so the project runs out-of-the-box without mail
    credentials. In production, set SMTP_* env vars and disable OTP_DEV_MODE.
    """
    if settings.SMTP_HOST and not settings.OTP_DEV_MODE:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = "Your OSINT Exposure Assessment verification code"
        msg.set_content(
            f"Your verification code is: {otp_code}\n\n"
            f"This code expires in {settings.OTP_EXPIRY_MINUTES} minutes.\n"
            "If you did not request this, you can ignore this email."
        )
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
    else:
        # Dev/demo mode: no real email is sent. This should NEVER be reachable
        # in a production deployment (guard via settings.OTP_DEV_MODE).
        print(f"[DEV MODE] OTP for {to_email}: {otp_code}")


async def create_and_send_otp(db: AsyncSession, user_id: str, target_email: str) -> str | None:
    """Creates a new OTP record, sends it, and returns the raw code only if in dev mode."""
    otp_code = _generate_otp(settings.OTP_LENGTH)
    otp_hash = pwd_context.hash(otp_code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    record = EmailVerification(
        user_id=user_id,
        target_email=target_email,
        otp_hash=otp_hash,
        expires_at=expires_at,
    )
    db.add(record)
    await db.commit()

    await send_otp_email(target_email, otp_code)

    return otp_code if settings.OTP_DEV_MODE else None


async def verify_otp(db: AsyncSession, user_id: str, target_email: str, otp_code: str) -> bool:
    """Validates the most recent unverified OTP for this user+email pair."""
    result = await db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.user_id == user_id,
            EmailVerification.target_email == target_email,
            EmailVerification.verified == False,  # noqa: E712
        )
        .order_by(EmailVerification.created_at.desc())
    )
    record = result.scalars().first()
    if record is None:
        return False

    now = datetime.now(timezone.utc)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        return False

    if record.attempts >= 5:
        return False

    record.attempts += 1

    if not pwd_context.verify(otp_code, record.otp_hash):
        await db.commit()
        return False

    record.verified = True
    await db.commit()
    return True


async def has_verified_email(db: AsyncSession, user_id: str, target_email: str) -> bool:
    """Checks whether this user has a currently-valid verified ownership record.

    We treat verification as valid indefinitely once confirmed (re-verification
    is only required if you want to re-scan after a long time — adjust the
    policy here if you want verifications to expire, e.g. after 30 days).
    """
    result = await db.execute(
        select(EmailVerification).where(
            EmailVerification.user_id == user_id,
            EmailVerification.target_email == target_email,
            EmailVerification.verified == True,  # noqa: E712
        )
    )
    return result.scalars().first() is not None
