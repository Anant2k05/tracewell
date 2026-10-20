"""
RDAP collector — domain registrant contact exposure.

Replaces the paid WhoisXML API. RDAP (Registration Data Access Protocol) is
the IETF-standardized, free successor to WHOIS that all major registries are
required to support. rdap.org runs a free public bootstrap service that
redirects a lookup to the correct registry's RDAP server automatically, so
no registry-specific configuration or API key is needed.

Note: most registrars have redacted registrant emails from RDAP/WHOIS output
by default since GDPR (2018), so a "not found" result here is expected and
good news, not a sign the collector is broken. This mainly still surfaces
legacy records, administrative/technical contacts some registrars don't
redact, or domains registered without privacy protection.
"""
import httpx

from app.collectors.base import BaseCollector, NormalizedFinding
from app.config import get_settings

settings = get_settings()

RDAP_BOOTSTRAP_URL = "https://rdap.org/domain/{domain}"

FREE_EMAIL_PROVIDERS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
    "protonmail.com", "aol.com", "live.com", "msn.com",
}

ROLE_LABELS = {
    "registrant": "registrant",
    "administrative": "administrative contact",
    "technical": "technical contact",
    "billing": "billing contact",
}


def _extract_emails_from_vcard(vcard_array) -> list[str]:
    """RDAP contact info is embedded as jCard/vCard arrays: ['vcard', [[...], ...]]"""
    emails = []
    if not vcard_array or len(vcard_array) < 2:
        return emails
    for field in vcard_array[1]:
        if isinstance(field, list) and len(field) >= 4 and field[0] == "email":
            emails.append(str(field[3]).lower())
    return emails


class RDAPCollector(BaseCollector):
    name = "RDAP"

    async def collect(self, email: str, domain: str | None) -> list[NormalizedFinding]:
        if not domain or domain.lower() in FREE_EMAIL_PROVIDERS:
            return []  # nothing meaningful to check for free webmail providers

        try:
            async with httpx.AsyncClient(
                timeout=settings.COLLECTOR_TIMEOUT_SECONDS, follow_redirects=True
            ) as client:
                resp = await client.get(
                    RDAP_BOOTSTRAP_URL.format(domain=domain),
                    headers={"Accept": "application/rdap+json"},
                )

                if resp.status_code == 404:
                    return []  # domain not found / not registered
                if resp.status_code != 200:
                    return []  # registry didn't support RDAP or rate-limited us; fail quiet

                data = resp.json()

        except (httpx.HTTPError, ValueError):
            return [
                NormalizedFinding(
                    source=self.name,
                    finding_type="collector_error",
                    value=f"RDAP lookup failed for domain {domain}.",
                    confidence="low",
                )
            ]

        matched_roles: list[str] = []
        for entity in data.get("entities", []):
            roles = entity.get("roles", [])
            emails = _extract_emails_from_vcard(entity.get("vcardArray"))
            if any(e == email.lower() for e in emails):
                for role in roles:
                    matched_roles.append(ROLE_LABELS.get(role, role))

        if not matched_roles:
            return []

        return [
            NormalizedFinding(
                source=self.name,
                finding_type="infrastructure_exposure",
                value=(
                    f"Domain '{domain}' RDAP record publicly lists this email as "
                    + ", ".join(sorted(set(matched_roles)))
                ),
                data_classes=["domain_ownership", "registrant_contact"],
                confidence="high",
                raw_metadata={"domain": domain, "roles": sorted(set(matched_roles))},
            )
        ]
