"""
Correlation engine.

Takes the flat list of RawFinding rows produced by the collection pipeline
for a single scan and:
  1. Groups related findings together (e.g. all "identity_exposure" signals
     across Gravatar and GitHub become one correlated finding, while each
     distinct data breach stays its own item since they're separate
     incidents).
  2. Assigns a category, severity score/label, and recommendation to each
     group.
  3. Rolls everything up into an overall risk score + category breakdown
     for the scan's report.

This is deliberately rule-based (not ML) so the reasoning behind every
score is transparent and explainable to the end user — a core requirement
of this being a *defensive* tool, not a black box.
"""
import re
from collections import defaultdict

from app.correlation.normalizer import categorize
from app.correlation.recommendations import get_recommendation
from app.correlation.risk_scoring import overall_risk_score, score_correlated_finding, severity_label
from app.models import RawFinding

# finding_types where each occurrence represents a distinct incident and
# should NOT be merged with others of the same type (e.g. two different
# breaches are two different problems, not one).
DO_NOT_MERGE = {"breach_exposure"}

# finding_types that are internal/system noise, not user-facing exposure
SYSTEM_TYPES = {"collector_error", "collector_skipped"}


def _extract_breach_name(value: str) -> str:
    match = re.search(r"breach:\s*(.+)$", value)
    return match.group(1).strip() if match else value


class CorrelatedGroup:
    """Intermediate representation before persisting as a CorrelatedFinding row."""

    def __init__(self, finding_type: str, title: str):
        self.finding_type = finding_type
        self.title = title
        self.sources: set[str] = set()
        self.data_classes: set[str] = set()
        self.confidences: list[str] = []
        self.value_lines: list[str] = []
        self.metadata_notes: list[str] = []

    def add(self, finding: RawFinding):
        self.sources.add(finding.source)
        self.data_classes.update(finding.data_classes or [])
        self.confidences.append(finding.confidence)
        self.value_lines.append(finding.value)

    @property
    def dominant_confidence(self) -> str:
        # Use the highest confidence observed among contributing findings
        order = {"high": 3, "medium": 2, "low": 1}
        return max(self.confidences, key=lambda c: order.get(c, 0)) if self.confidences else "low"

    @property
    def description(self) -> str:
        return " | ".join(dict.fromkeys(self.value_lines))  # dedupe, preserve order


def correlate_findings(raw_findings: list[RawFinding]) -> list[dict]:
    """
    Returns a list of dicts, one per correlated finding, ready to be
    persisted as CorrelatedFinding rows:

    {category, title, description, severity, severity_score,
     linked_source_count, contributing_sources, recommendation}
    """
    user_facing = [f for f in raw_findings if f.finding_type not in SYSTEM_TYPES]

    groups: list[CorrelatedGroup] = []
    merge_buckets: dict[str, CorrelatedGroup] = {}

    for finding in user_facing:
        if finding.finding_type in DO_NOT_MERGE:
            # Each distinct breach becomes its own group, keyed by breach name
            breach_name = _extract_breach_name(finding.value)
            group = CorrelatedGroup(finding.finding_type, title=f"Data breach: {breach_name}")
            group.add(finding)
            groups.append(group)
        else:
            key = finding.finding_type
            if key not in merge_buckets:
                title_map = {
                    "credential_or_pii_leak": "Public code/config leak referencing this email",
                    "account_exposure": "Public account/profile exposure",
                    "identity_exposure": "Real identity linkable via public profiles",
                    "infrastructure_exposure": "Domain/infrastructure exposure",
                }
                merge_buckets[key] = CorrelatedGroup(
                    key, title=title_map.get(key, key.replace("_", " ").title())
                )
            merge_buckets[key].add(finding)

    groups.extend(merge_buckets.values())

    results = []
    for group in groups:
        category = categorize(group.finding_type)
        linked_source_count = len(group.sources)
        severity_score = score_correlated_finding(
            finding_type=group.finding_type,
            data_classes=list(group.data_classes),
            confidence=group.dominant_confidence,
            linked_source_count=linked_source_count,
        )
        results.append(
            {
                "category": category,
                "title": group.title,
                "description": group.description,
                "severity": severity_label(severity_score),
                "severity_score": severity_score,
                "linked_source_count": linked_source_count,
                "contributing_sources": sorted(group.sources),
                "recommendation": get_recommendation(group.finding_type),
            }
        )

    # Surface the highest-severity findings first
    results.sort(key=lambda r: r["severity_score"], reverse=True)
    return results


def build_scan_report(correlated: list[dict]) -> dict:
    """Rolls up correlated findings into the top-level scan report fields."""
    scores = [c["severity_score"] for c in correlated]
    risk_score = overall_risk_score(scores)
    risk_label = severity_label(risk_score)

    breakdown: dict[str, dict] = defaultdict(lambda: {"count": 0, "max_severity_score": 0.0})
    for c in correlated:
        entry = breakdown[c["category"]]
        entry["count"] += 1
        entry["max_severity_score"] = max(entry["max_severity_score"], c["severity_score"])

    if not correlated:
        summary = (
            "No significant public exposure was identified across the sources checked. "
            "This does not guarantee zero exposure — only that nothing was found in the "
            "sources this assessment queries."
        )
    else:
        top = correlated[0]
        summary = (
            f"Found {len(correlated)} notable exposure item(s) across "
            f"{len({s for c in correlated for s in c['contributing_sources']})} source(s). "
            f"Highest-priority issue: \"{top['title']}\" ({top['severity']} severity). "
            "See individual findings below for source-by-source detail and recommended actions."
        )

    return {
        "overall_risk_score": risk_score,
        "overall_risk_label": risk_label,
        "summary": summary,
        "category_breakdown": dict(breakdown),
    }
