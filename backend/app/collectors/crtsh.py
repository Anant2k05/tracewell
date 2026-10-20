"""
Certificate Transparency collector (crt.sh).

crt.sh mirrors public Certificate Transparency logs. Old SSL certificates
sometimes had the requester's email embedded (rare in modern certs, but
still surfaces for legacy domains), and — more usefully here — reveals every
subdomain ever issued a cert for a personal domain, which can expose internal
tools, staging environments, or services the user forgot were public
(e.g. mail.mydomain.com, vpn.mydomain.com, old-blog.mydomain.com).

No API key required; this is a free public data source.
"""
import httpx

from app.collectors.base import BaseCollector, NormalizedFinding
from app.config import get_settings

settings = get_settings()

FREE_EMAIL_PROVIDERS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
    "protonmail.com", "aol.com", "live.com", "msn.com",
}


class CertTransparencyCollector(BaseCollector):
    name = "CertTransparency"

    async def collect(self, email: str, domain: str | None) -> list[NormalizedFinding]:
        if not domain or domain.lower() in FREE_EMAIL_PROVIDERS:
            return []

        try:
            async with httpx.AsyncClient(timeout=settings.COLLECTOR_TIMEOUT_SECONDS) as client:
                resp = await client.get(
                    "https://crt.sh/", params={"q": f"%.{domain}", "output": "json"}
                )
                if resp.status_code != 200:
                    return []
                entries = resp.json()
        except (httpx.HTTPError, ValueError):
            return [
                NormalizedFinding(
                    source=self.name,
                    finding_type="collector_error",
                    value=f"Certificate transparency lookup failed for {domain}.",
                    confidence="low",
                )
            ]

        subdomains = set()
        for entry in entries:
            name_value = entry.get("name_value", "")
            for line in name_value.split("\n"):
                line = line.strip().lstrip("*.")
                if line.endswith(domain) and line != domain:
                    subdomains.add(line)

        if not subdomains:
            return []

        # Cap the list shown but report the true count
        sample = sorted(subdomains)[:15]
        return [
            NormalizedFinding(
                source=self.name,
                finding_type="infrastructure_exposure",
                value=(
                    f"{len(subdomains)} publicly-issued subdomain certificate(s) found for "
                    f"'{domain}', potentially revealing internal or forgotten services."
                ),
                data_classes=["subdomain_enumeration"],
                confidence="medium",
                raw_metadata={"sample_subdomains": sample, "total_count": len(subdomains)},
            )
        ]
