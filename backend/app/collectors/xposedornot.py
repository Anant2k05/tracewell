"""
XposedOrNot collector — breach & exposure lookup.

Replaces the paid HIBP API. XposedOrNot (https://xposedornot.com) is a free,
open-source breach-monitoring service with no API key required for its
standard email-check and breach-analytics endpoints.

Docs / SDKs: https://github.com/XposedOrNot
Endpoints used:
  - GET https://api.xposedornot.com/v1/check-email/{email}
        -> quick yes/no + breach name list
  - GET https://api.xposedornot.com/v1/breach-analytics?email={email}
        -> richer per-breach detail (date, exposed data classes) when available

Both are free and unauthenticated. We call the simple check first, and only
call breach-analytics if breaches were found, to minimize unnecessary requests.
"""
import httpx

from app.collectors.base import BaseCollector, NormalizedFinding
from app.config import get_settings

settings = get_settings()

CHECK_EMAIL_URL = "https://api.xposedornot.com/v1/check-email/{email}"
BREACH_ANALYTICS_URL = "https://api.xposedornot.com/v1/breach-analytics"


def _flatten_breach_names(raw) -> list[str]:
    """The free endpoint sometimes nests breach names as a list of lists."""
    names: list[str] = []
    if not raw:
        return names
    for item in raw:
        if isinstance(item, list):
            names.extend(str(x) for x in item)
        else:
            names.append(str(item))
    return names


class XposedOrNotCollector(BaseCollector):
    name = "XposedOrNot"

    async def collect(self, email: str, domain: str | None) -> list[NormalizedFinding]:
        headers = {"Accept": "application/json", "User-Agent": "Personal-OSINT-Exposure-Assessment/1.0"}

        try:
            async with httpx.AsyncClient(timeout=settings.COLLECTOR_TIMEOUT_SECONDS, headers=headers) as client:
                resp = await client.get(CHECK_EMAIL_URL.format(email=email))

                if resp.status_code == 404:
                    return []  # no breaches found for this email

                if resp.status_code != 200:
                    return [
                        NormalizedFinding(
                            source=self.name,
                            finding_type="collector_error",
                            value=f"XposedOrNot lookup returned unexpected status {resp.status_code}.",
                            confidence="low",
                        )
                    ]

                data = resp.json()

                # The API returns something like {"Error": "Not found"} when clean
                if isinstance(data, dict) and data.get("Error"):
                    return []

                breach_names = _flatten_breach_names(data.get("breaches") if isinstance(data, dict) else None)
                if not breach_names:
                    return []

                # Pull richer per-breach detail (exposed data classes, dates) if available.
                details_by_name: dict[str, dict] = {}
                try:
                    analytics_resp = await client.get(BREACH_ANALYTICS_URL, params={"email": email})
                    if analytics_resp.status_code == 200:
                        analytics = analytics_resp.json()
                        for entry in analytics.get("ExposedBreaches", {}).get("breaches_details", []):
                            bname = entry.get("breach") or entry.get("Breach")
                            if bname:
                                details_by_name[bname] = entry
                except (httpx.HTTPError, ValueError):
                    pass  # analytics is a bonus; the basic breach list is still useful without it

        except httpx.HTTPError:
            return [
                NormalizedFinding(
                    source=self.name,
                    finding_type="collector_error",
                    value="XposedOrNot lookup failed (network/upstream error).",
                    confidence="low",
                )
            ]
        except ValueError:
            return [
                NormalizedFinding(
                    source=self.name,
                    finding_type="collector_error",
                    value="XposedOrNot returned an unparseable response.",
                    confidence="low",
                )
            ]

        findings: list[NormalizedFinding] = []
        for bname in breach_names:
            detail = details_by_name.get(bname, {})
            xposed_data = detail.get("xposed_data") or detail.get("XposedData") or ""
            data_classes = [d.strip() for d in str(xposed_data).split(";") if d.strip()] if xposed_data else []

            findings.append(
                NormalizedFinding(
                    source=self.name,
                    finding_type="breach_exposure",
                    value=f"Account exposed in breach: {bname}",
                    data_classes=data_classes,
                    confidence="high",
                    raw_metadata={
                        "industry": detail.get("industry"),
                        "password_risk": detail.get("password_risk"),
                        "references": detail.get("references"),
                    },
                    occurred_at=_parse_date(detail.get("breached_date") or detail.get("xposed_date")),
                )
            )
        return findings


def _parse_date(value: str | None):
    if not value:
        return None
    from datetime import datetime

    for fmt in ("%Y-%m-%d", "%Y"):
        try:
            return datetime.strptime(str(value), fmt)
        except ValueError:
            continue
    return None
