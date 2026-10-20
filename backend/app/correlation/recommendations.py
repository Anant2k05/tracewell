"""
Actionable recommendation templates. Kept separate from scoring logic so
non-technical contributors can extend/edit the advice text without touching
the correlation engine.
"""

RECOMMENDATIONS = {
    "breach_exposure": (
        "Change the password used on the breached service immediately if you haven't "
        "already, and on any other site where you reused it. Enable multi-factor "
        "authentication (MFA) wherever available, and consider using a password manager "
        "to generate unique passwords per site going forward."
    ),
    "credential_or_pii_leak": (
        "Search the referenced repositories for hardcoded secrets (API keys, passwords, "
        "tokens) and rotate any that are found immediately, even in old commits — git "
        "history retains deleted content. Add a pre-commit secret scanner (e.g. "
        "gitleaks/truffleHog) and a .gitignore for config/.env files going forward."
    ),
    "account_exposure": (
        "Review the privacy settings of the linked profile(s) and consider whether the "
        "account needs to be publicly discoverable. If the account is unused, consider "
        "deleting it rather than leaving a dormant public profile."
    ),
    "identity_exposure": (
        "If linking your real name to this email/handle is unintentional, review "
        "public profile settings (Gravatar, GitHub commit email visibility, etc.) and "
        "use a 'noreply' commit email option where platforms support it."
    ),
    "infrastructure_exposure": (
        "Review DNS/subdomain records for services you no longer use and decommission "
        "them. For WHOIS exposure, enable registrar privacy/proxy protection so personal "
        "contact details aren't publicly listed."
    ),
    "other": (
        "Review this finding for relevance and consider whether the associated public "
        "information should remain accessible."
    ),
}


def get_recommendation(finding_type: str) -> str:
    return RECOMMENDATIONS.get(finding_type, RECOMMENDATIONS["other"])
