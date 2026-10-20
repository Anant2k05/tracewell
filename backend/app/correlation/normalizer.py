"""
Maps a raw finding_type (as produced by collectors) to a top-level exposure
category used throughout the correlation and reporting layer.
"""

CATEGORY_MAP = {
    "breach_exposure": "credential_exposure",
    "credential_or_pii_leak": "credential_exposure",
    "account_exposure": "identity_exposure",
    "identity_exposure": "identity_exposure",
    "infrastructure_exposure": "infrastructure_exposure",
    "collector_error": "system",
    "collector_skipped": "system",
}

# Base severity weight (0-10) per finding_type, before data-class and
# confidence adjustments are applied in risk_scoring.py
BASE_SEVERITY = {
    "breach_exposure": 6.0,
    "credential_or_pii_leak": 7.0,
    "account_exposure": 3.0,
    "identity_exposure": 5.0,
    "infrastructure_exposure": 4.0,
    "collector_error": 0.0,
    "collector_skipped": 0.0,
}

# Data classes that materially raise severity when present (credential/financial/
# government-ID style exposure is worse than, say, a display name)
HIGH_IMPACT_DATA_CLASSES = {
    "Passwords", "password_hash", "Credit cards", "Social security numbers",
    "Bank account numbers", "Security questions and answers", "Government issued IDs",
}


def categorize(finding_type: str) -> str:
    return CATEGORY_MAP.get(finding_type, "other")


def base_severity(finding_type: str) -> float:
    return BASE_SEVERITY.get(finding_type, 2.0)
