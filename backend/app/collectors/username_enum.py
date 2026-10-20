"""
Username enumeration collector.

Derives a candidate username from the email's local-part (the part before
the @) and checks whether a public profile exists under that handle on a
small, curated list of major platforms — the same technique tools like
Sherlock/Maigret use, but deliberately scoped down to:
  (a) a short list of major, well-behaved platforms (to avoid ToS/anti-bot
      issues at scale), and
  (b) simple existence checks (HTTP status), not deep scraping of profile
      content.

This is a *signal*, not proof: many people don't reuse their email
local-part as a username elsewhere, and some do but for an unrelated person
(false positive risk) — so results are marked "low confidence" and framed
as "possible username match" in the correlation layer.
"""
import re

import httpx

from app.collectors.base import BaseCollector, NormalizedFinding
from app.config import get_settings

settings = get_settings()

# Each entry: (platform name, profile URL template, status code(s) that mean "exists")
PLATFORMS = [
    ("GitHub", "https://github.com/{u}", {200}),
    ("Instagram", "https://www.instagram.com/{u}/", {200}),
    ("Reddit", "https://www.reddit.com/user/{u}/about.json", {200}),
    ("X (Twitter)", "https://x.com/{u}", {200}),
    ("Medium", "https://medium.com/@{u}", {200}),
]


def _derive_username(email: str) -> str:
    local_part = email.split("@")[0]
    # Strip common "+tag" aliasing and non-alphanumeric separators for the check
    local_part = local_part.split("+")[0]
    return re.sub(r"[^a-zA-Z0-9_.\-]", "", local_part)


class UsernameEnumerationCollector(BaseCollector):
    name = "UsernameEnumeration"

    async def collect(self, email: str, domain: str | None) -> list[NormalizedFinding]:
        username = _derive_username(email)
        if len(username) < 3:
            return []  # too short/generic to be a meaningful signal

        findings: list[NormalizedFinding] = []
        headers = {"User-Agent": "Mozilla/5.0 (compatible; OSINT-Exposure-Assessment/1.0)"}

        async with httpx.AsyncClient(
            timeout=settings.COLLECTOR_TIMEOUT_SECONDS, headers=headers, follow_redirects=True
        ) as client:
            for platform_name, url_template, ok_statuses in PLATFORMS:
                url = url_template.format(u=username)
                try:
                    resp = await client.get(url)
                    if resp.status_code in ok_statuses:
                        findings.append(
                            NormalizedFinding(
                                source=self.name,
                                finding_type="account_exposure",
                                value=(
                                    f"Possible public {platform_name} profile matching username "
                                    f"'{username}' (derived from email local-part)."
                                ),
                                data_classes=["username", "possible_platform_presence"],
                                confidence="low",  # username reuse is not proof of identity
                                raw_metadata={"platform": platform_name, "checked_url": url},
                            )
                        )
                except httpx.HTTPError:
                    continue  # skip a platform on network error; don't fail the whole scan

        return findings
