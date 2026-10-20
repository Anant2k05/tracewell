"""
Orchestrates the data collection pipeline: runs every registered collector
concurrently against the target email, enforces a hard timeout per collector
(so one slow/hanging source can't stall the whole scan), and returns the
combined list of normalized findings for persistence.
"""
import asyncio
import logging

from app.collectors.base import NormalizedFinding
from app.collectors.crtsh import CertTransparencyCollector
from app.collectors.github_leak import GitHubLeakCollector
from app.collectors.gravatar import GravatarCollector
from app.collectors.rdap import RDAPCollector
from app.collectors.username_enum import UsernameEnumerationCollector
from app.collectors.xposedornot import XposedOrNotCollector
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("osint.collectors")

# Every collector here uses a free, keyless (or free-tier-with-key) public
# API — there is no paid dependency anywhere in this pipeline.
COLLECTORS = [
    XposedOrNotCollector(),      # breach exposure — free, no key (replaces paid HIBP)
    GravatarCollector(),          # public profile — free, no key
    GitHubLeakCollector(),        # code/commit leaks — free, no key (optional token raises limits)
    RDAPCollector(),               # domain registrant exposure — free, no key (replaces paid WhoisXML)
    CertTransparencyCollector(),  # subdomain exposure via crt.sh — free, no key
    UsernameEnumerationCollector(),  # cross-platform handle check — free, no key
]


async def _run_with_timeout(collector, email: str, domain: str | None) -> list[NormalizedFinding]:
    try:
        return await asyncio.wait_for(
            collector.collect(email, domain),
            timeout=settings.COLLECTOR_TIMEOUT_SECONDS * 2,  # allow for multi-request collectors
        )
    except asyncio.TimeoutError:
        logger.warning("Collector %s timed out for target", collector.name)
        return [
            NormalizedFinding(
                source=collector.name,
                finding_type="collector_error",
                value=f"{collector.name} timed out and was skipped for this scan.",
                confidence="low",
            )
        ]
    except Exception as exc:  # noqa: BLE001 — a collector must never crash the whole scan
        logger.exception("Collector %s raised an unexpected error", collector.name)
        return [
            NormalizedFinding(
                source=collector.name,
                finding_type="collector_error",
                value=f"{collector.name} failed unexpectedly: {exc.__class__.__name__}",
                confidence="low",
            )
        ]


async def run_collection_pipeline(email: str) -> list[NormalizedFinding]:
    """Fan out to every collector concurrently and flatten the results."""
    domain = email.split("@")[-1].lower() if "@" in email else None

    tasks = [_run_with_timeout(collector, email, domain) for collector in COLLECTORS]
    results = await asyncio.gather(*tasks)

    all_findings: list[NormalizedFinding] = []
    for result in results:
        all_findings.extend(result)
    return all_findings
