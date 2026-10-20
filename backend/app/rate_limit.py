"""
Rate limiting.

Two limiter backends:
- RedisRateLimiter: sliding-window counter using Redis sorted sets. Used in
  production / multi-instance deployments so limits are shared across workers.
- InMemoryRateLimiter: simple per-process fallback for local development when
  no REDIS_URL is configured. NOT safe across multiple workers/processes.

Applied as a FastAPI dependency, e.g.:

    @router.post("/scans", dependencies=[Depends(scan_rate_limiter)])

Two limits matter for this system:
- A general per-minute limit on all authenticated endpoints (abuse prevention).
- A stricter per-hour limit specifically on scan creation, since each scan
  fans out to several external OSINT APIs that have their own rate limits
  and, in some cases, costs money per call (e.g. HIBP).
"""
import time
from abc import ABC, abstractmethod

from fastapi import Depends, HTTPException, Request, status

from app.auth import get_current_user
from app.config import get_settings
from app.models import User

settings = get_settings()


class BaseRateLimiter(ABC):
    @abstractmethod
    async def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Record a hit for `key`. Returns (allowed, remaining)."""
        raise NotImplementedError


class InMemoryRateLimiter(BaseRateLimiter):
    def __init__(self):
        self._buckets: dict[str, list[float]] = {}

    async def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        window_start = now - window_seconds
        timestamps = self._buckets.setdefault(key, [])
        # drop expired entries
        timestamps[:] = [t for t in timestamps if t > window_start]
        if len(timestamps) >= limit:
            return False, 0
        timestamps.append(now)
        return True, max(0, limit - len(timestamps))


class RedisRateLimiter(BaseRateLimiter):
    def __init__(self, redis_url: str):
        import redis.asyncio as redis  # imported lazily so redis is optional at import time

        self._redis = redis.from_url(redis_url, decode_responses=True)

    async def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        window_start = now - window_seconds
        pipe = self._redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, window_seconds)
        _, count, _, _ = await pipe.execute()
        if count >= limit:
            # remove the entry we just optimistically added, since it's rejected
            await self._redis.zrem(key, str(now))
            return False, 0
        return True, max(0, limit - count - 1)


_limiter: BaseRateLimiter | None = None


def get_limiter() -> BaseRateLimiter:
    global _limiter
    if _limiter is not None:
        return _limiter
    if settings.REDIS_URL:
        try:
            _limiter = RedisRateLimiter(settings.REDIS_URL)
        except Exception:
            _limiter = InMemoryRateLimiter()
    else:
        _limiter = InMemoryRateLimiter()
    return _limiter


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def general_rate_limiter(request: Request):
    """Applied broadly: N requests/minute per client IP."""
    if not settings.RATE_LIMIT_ENABLED:
        return
    limiter = get_limiter()
    key = f"rl:general:{_client_ip(request)}"
    allowed, remaining = await limiter.hit(key, settings.RATE_LIMIT_DEFAULT_PER_MINUTE, 60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down and try again shortly.",
        )


async def scan_rate_limiter(user: User = Depends(get_current_user)):
    """Applied to scan creation: N scans/hour per authenticated user."""
    if not settings.RATE_LIMIT_ENABLED:
        return
    limiter = get_limiter()
    key = f"rl:scan:{user.id}"
    allowed, remaining = await limiter.hit(key, settings.RATE_LIMIT_SCAN_PER_HOUR, 3600)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Scan limit reached ({settings.RATE_LIMIT_SCAN_PER_HOUR}/hour). "
                "This protects both your account and the external OSINT APIs we query."
            ),
        )


async def otp_rate_limiter(request: Request):
    """Stricter limiter for OTP request endpoint to prevent email-bombing abuse."""
    if not settings.RATE_LIMIT_ENABLED:
        return
    limiter = get_limiter()
    key = f"rl:otp:{_client_ip(request)}"
    allowed, remaining = await limiter.hit(key, 5, 3600)  # 5 OTP requests/hour/IP
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification requests from this address. Try again later.",
        )
