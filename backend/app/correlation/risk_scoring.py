"""
Risk scoring logic.

Two levels of scoring:
1. Per-correlated-finding severity (0-10) — based on finding type, how many
   independent sources corroborate it, and whether high-impact data classes
   (passwords, financial data, government IDs) are involved.
2. Overall scan risk score (0-10) — a weighted roll-up across all correlated
   findings, biased toward the worst finding rather than a flat average, so
   one severe credential leak isn't diluted into "medium" by a pile of
   low-severity username matches.
"""
from app.correlation.normalizer import HIGH_IMPACT_DATA_CLASSES, base_severity

CONFIDENCE_MULTIPLIER = {"low": 0.6, "medium": 0.85, "high": 1.0}


def score_correlated_finding(
    finding_type: str,
    data_classes: list[str],
    confidence: str,
    linked_source_count: int,
) -> float:
    score = base_severity(finding_type)

    if any(dc in HIGH_IMPACT_DATA_CLASSES for dc in data_classes):
        score += 2.5

    score *= CONFIDENCE_MULTIPLIER.get(confidence, 0.8)

    # Corroboration across multiple independent sources raises confidence
    # in the finding being real and worth acting on.
    if linked_source_count >= 3:
        score += 1.0
    elif linked_source_count == 2:
        score += 0.5

    return round(min(score, 10.0), 2)


def severity_label(score: float) -> str:
    if score >= 8.0:
        return "critical"
    if score >= 5.5:
        return "high"
    if score >= 3.0:
        return "medium"
    return "low"


def overall_risk_score(finding_scores: list[float]) -> float:
    """
    Weighted roll-up: 70% weight on the single worst finding, 30% weight on
    the mean of all findings. This keeps one critical breach from being
    "averaged away" by a long tail of low-severity items, while still letting
    volume of exposure push the score up somewhat.
    """
    if not finding_scores:
        return 0.0
    worst = max(finding_scores)
    mean = sum(finding_scores) / len(finding_scores)
    combined = 0.7 * worst + 0.3 * mean
    return round(min(combined, 10.0), 2)
