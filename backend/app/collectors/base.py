"""
Shared interface for all OSINT data-source collectors.

Every collector implements `collect(email, domain) -> list[NormalizedFinding]`
and must not raise on ordinary "no data" or upstream errors — it should catch
its own exceptions and return an empty list (or a low-confidence error entry),
so one failing source never breaks the whole scan. The orchestrator applies
a hard timeout around each collector regardless.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class NormalizedFinding:
    source: str                     # e.g. "HIBP", "Gravatar", "GitHubCodeSearch"
    finding_type: str                # e.g. "breach_exposure", "account_exposure"
    value: str                       # human-readable description
    data_classes: list[str] = field(default_factory=list)
    confidence: str = "medium"       # low | medium | high
    raw_metadata: dict = field(default_factory=dict)
    occurred_at: datetime | None = None


class BaseCollector(ABC):
    name: str = "base"

    @abstractmethod
    async def collect(self, email: str, domain: str | None) -> list[NormalizedFinding]:
        """Fetch and normalize findings for the given email/domain. Never raises."""
        raise NotImplementedError
