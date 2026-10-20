"""
Centralized application configuration.

All secrets/keys are read from environment variables (see .env.example).
Never hardcode API keys here.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "Personal OSINT Exposure Assessment System"
    ENV: str = "development"
    DEBUG: bool = True

    # --- Database ---
    # Default: local SQLite (async via aiosqlite). Swap to Postgres in prod:
    # postgresql+asyncpg://user:pass@host:5432/dbname
    DATABASE_URL: str = "sqlite+aiosqlite:///./osint_exposure.db"

    # --- Auth / JWT ---
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_use_a_long_random_value"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Rate limiting ---
    RATE_LIMIT_ENABLED: bool = True
    REDIS_URL: str | None = "redis://redis:6379/0"  # None -> falls back to in-memory limiter
    RATE_LIMIT_DEFAULT_PER_MINUTE: int = 30
    RATE_LIMIT_SCAN_PER_HOUR: int = 5  # scans are expensive (many external API calls)

    # --- Email OTP / consent verification ---
    # A scan may only run against an email once ownership has been confirmed via OTP.
    OTP_EXPIRY_MINUTES: int = 10
    OTP_LENGTH: int = 6
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "no-reply@osint-exposure.local"
    # When no SMTP is configured, OTPs are logged server-side instead of emailed
    # (development / demo mode only — never do this in production).
    OTP_DEV_MODE: bool = True

    # --- External OSINT data source API keys ---
    # Every collector in this project uses a free, keyless public API
    # (XposedOrNot for breaches, RDAP for domain data, crt.sh, Gravatar).
    # GITHUB_TOKEN is the only optional one, and GitHub's API is free either
    # way — a token just raises the search rate limit from 10/min to 30/min.
    GITHUB_TOKEN: str | None = None

    # --- Collector behavior ---
    COLLECTOR_TIMEOUT_SECONDS: float = 10.0
    COLLECTOR_MAX_RETRIES: int = 2


@lru_cache
def get_settings() -> Settings:
    return Settings()
