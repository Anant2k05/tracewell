"""
GitHub collector — searches public code and commit metadata for the target
email. Commonly surfaces:
  - Emails hardcoded in accidentally-committed config/.env files
  - Emails in git commit author metadata (linking a real identity to a
    GitHub username/handle, and often to employer/organization)

Uses GitHub's official REST Search API. An unauthenticated request is
allowed but heavily rate-limited (10 req/min); set GITHUB_TOKEN to raise
this to 30 req/min for search endpoints.
"""
import httpx

from app.collectors.base import BaseCollector, NormalizedFinding
from app.config import get_settings

settings = get_settings()


class GitHubLeakCollector(BaseCollector):
    name = "GitHubCodeSearch"

    async def collect(self, email: str, domain: str | None) -> list[NormalizedFinding]:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

        findings: list[NormalizedFinding] = []

        try:
            async with httpx.AsyncClient(timeout=settings.COLLECTOR_TIMEOUT_SECONDS) as client:
                # 1. Code search: email string appearing in public repo contents
                code_resp = await client.get(
                    "https://api.github.com/search/code",
                    headers=headers,
                    params={"q": f'"{email}"', "per_page": 10},
                )
                if code_resp.status_code == 200:
                    items = code_resp.json().get("items", [])
                    for item in items[:10]:
                        repo = item.get("repository", {})
                        findings.append(
                            NormalizedFinding(
                                source=self.name,
                                finding_type="credential_or_pii_leak",
                                value=(
                                    f"Email string found in public repo "
                                    f"'{repo.get('full_name', 'unknown')}' (file: {item.get('path')})"
                                ),
                                data_classes=["email_address", "possible_config_leak"],
                                confidence="medium",
                                raw_metadata={"repo_url": repo.get("html_url"), "file_path": item.get("path")},
                            )
                        )
                elif code_resp.status_code == 403:
                    findings.append(
                        NormalizedFinding(
                            source=self.name,
                            finding_type="collector_error",
                            value="GitHub code search rate-limited (consider adding GITHUB_TOKEN).",
                            confidence="low",
                        )
                    )

                # 2. Commit search: email appearing in commit author metadata
                commit_resp = await client.get(
                    "https://api.github.com/search/commits",
                    headers={**headers, "Accept": "application/vnd.github.cloak-preview+json"},
                    params={"q": f"author-email:{email}", "per_page": 10},
                )
                if commit_resp.status_code == 200:
                    commit_items = commit_resp.json().get("items", [])
                    seen_repos = set()
                    for item in commit_items[:10]:
                        repo = item.get("repository", {}).get("full_name", "unknown")
                        author = item.get("commit", {}).get("author", {}).get("name")
                        seen_repos.add(repo)
                    if seen_repos:
                        findings.append(
                            NormalizedFinding(
                                source=self.name,
                                finding_type="identity_exposure",
                                value=(
                                    f"Email linked to git commit history in {len(seen_repos)} "
                                    f"public repositor{'y' if len(seen_repos) == 1 else 'ies'}, "
                                    "potentially revealing real name and employer."
                                ),
                                data_classes=["real_name", "employer_or_affiliation", "commit_history"],
                                confidence="high",
                                raw_metadata={"repos": list(seen_repos)},
                            )
                        )

        except httpx.HTTPError:
            findings.append(
                NormalizedFinding(
                    source=self.name,
                    finding_type="collector_error",
                    value="GitHub search failed (network/upstream error).",
                    confidence="low",
                )
            )

        return findings
