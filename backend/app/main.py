"""
Personal OSINT Exposure Assessment System — FastAPI application entrypoint.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import auth_routes, scan_routes, verification_routes

settings = get_settings()

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist yet.
    # In production, prefer Alembic migrations over this.
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Self-service digital footprint / OSINT exposure assessment API. "
        "Scans may only be run against emails the requesting user has verified "
        "ownership of via OTP."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your frontend's origin(s) in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(verification_routes.router)
app.include_router(scan_routes.router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENV}
