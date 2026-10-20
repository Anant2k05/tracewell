"""
Gravatar collector.

Gravatar exposes a public profile (name, bio, linked accounts, photo) keyed
directly off an MD5 hash of the lowercased, trimmed email address — with no
authentication required. This makes it one of the simplest, most-overlooked
exposure vectors: if a user ever signed up for Gravatar/WordPress, their
profile may be silently public.
"""
import hashlib

import httpx

from app.collectors.base import BaseCollector, NormalizedFinding
from app.config import get_settings

settings = get_settings()


class GravatarCollector(BaseCollector):
    name = "Gravatar"

    async def collect(self, email: str, domain: str | None) -> list[NormalizedFinding]:
        email_hash = hashlib.md5(email.strip().lower().encode("utf-8")).hexdigest()
        profile_url = f"https://www.gravatar.com/{email_hash}.json"
        avatar_url = f"https://www.gravatar.com/avatar/{email_hash}?d=404"

        findings: list[NormalizedFinding] = []

        try:
            async with httpx.AsyncClient(timeout=settings.COLLECTOR_TIMEOUT_SECONDS) as client:
                avatar_resp = await client.get(avatar_url)
                has_avatar = avatar_resp.status_code == 200

                if not has_avatar:
                    return []  # no Gravatar account associated with this email

                profile_resp = await client.get(profile_url)

        except httpx.HTTPError:
            return [
                NormalizedFinding(
                    source=self.name,
                    finding_type="collector_error",
                    value="Gravatar lookup failed (network error).",
                    confidence="low",
                )
            ]

        findings.append(
            NormalizedFinding(
                source=self.name,
                finding_type="account_exposure",
                value="Public Gravatar profile/avatar exists for this email.",
                data_classes=["profile_photo"],
                confidence="high",
            )
        )

        if profile_resp.status_code == 200:
            try:
                data = profile_resp.json()
                entries = data.get("entries", [])
                if entries:
                    entry = entries[0]
                    exposed_fields = []
                    for field_name in ("displayName", "aboutMe", "currentLocation", "urls", "accounts"):
                        if entry.get(field_name):
                            exposed_fields.append(field_name)

                    if exposed_fields:
                        findings.append(
                            NormalizedFinding(
                                source=self.name,
                                finding_type="identity_exposure",
                                value=(
                                    "Gravatar profile publicly exposes: "
                                    + ", ".join(exposed_fields)
                                ),
                                data_classes=exposed_fields,
                                confidence="high",
                                raw_metadata={
                                    "linked_accounts": [
                                        a.get("shortname") for a in entry.get("accounts", [])
                                    ]
                                },
                            )
                        )
            except ValueError:
                pass  # non-JSON response, ignore silently

        return findings
