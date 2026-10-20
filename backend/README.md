# Personal OSINT Exposure Assessment System — Backend

A FastAPI backend that lets an individual assess their own publicly
discoverable digital footprint using their email address: it collects
findings from permitted public sources/APIs, correlates them, categorizes
the type of exposure, scores risk, and returns actionable recommendations.

**Design principle:** this is a *defensive self-assessment* tool, not a
recon tool. A scan can only be run against an email address after the
requesting user proves ownership of it via a one-time code (OTP) sent to
that address. There is no lookup-any-email capability.

## Architecture

```
Client
  │
  ▼
FastAPI (app/main.py)
  │
  ├── /auth            → register / login / refresh (JWT)
  ├── /verification     → OTP request + confirm (consent gate)
  └── /scans            → create scan (rate-limited, consent-checked)
                              │
                              ▼
                     BackgroundTask: scan_service.execute_scan()
                              │
              ┌───────────────┼────────────────────┐
              ▼               ▼                    ▼
     Collection pipeline   Persist raw       Correlation engine
     (app/collectors/*)    findings (DB)     (app/correlation/*)
     - HIBP (breaches)                              │
     - Gravatar                                     ▼
     - GitHub code/commit search           Correlated findings +
     - WHOIS                               overall risk score
     - crt.sh (cert transparency)                    │
     - Username enumeration                          ▼
                                              Persisted ScanReport
```

Each collector implements a common interface (`app/collectors/base.py`) and
runs concurrently via `asyncio.gather`, with a hard per-collector timeout so
one slow/unreachable source never stalls the whole scan or takes down the
request. A collector that fails returns a low-confidence `collector_error`
finding instead of raising, so the pipeline is fault-isolated by design.

## Data sources implemented

**Every source below is free and requires no paid API key.** The whole
pipeline runs out-of-the-box with zero keys configured.

| Source | What it checks | Auth required |
|---|---|---|
| [XposedOrNot](https://xposedornot.com) | Breach exposure (breach names, exposed data classes) | No — free, open-source, keyless API |
| Gravatar | Public avatar/profile linked to the email | No |
| GitHub Code/Commit Search | Email hardcoded in public repos; commit author metadata | No (optional `GITHUB_TOKEN` just raises the rate limit from 10/min to 30/min — GitHub's API is free either way) |
| RDAP (via rdap.org) | Domain registrant/admin/tech contact matches this email | No — RDAP is the free, IETF-standard successor to WHOIS |
| crt.sh (Certificate Transparency) | Subdomains publicly issued certs for the email's domain | No |
| Username enumeration | Public profiles under the email's local-part on major platforms | No (low-confidence signal) |

Note: most registrars have redacted registrant contact emails from RDAP/WHOIS
output since GDPR (2018), so an empty result from RDAP is expected and is
good news, not a broken collector. Similarly, XposedOrNot only knows about
breaches it has indexed — a clean result there doesn't guarantee an email
has never appeared in any breach anywhere, only in the ones this free
service tracks.

Collectors still degrade gracefully on network failures or upstream rate
limits: a source that errors out returns a low-confidence `collector_error`
finding instead of breaking the whole scan.

## Correlation & risk scoring

`app/correlation/engine.py` groups raw findings into correlated findings:
- Each distinct data breach stays a separate item (they're independent incidents).
- Other finding types (identity, account, infrastructure exposure) are merged
  across sources into one item, tracking how many independent sources
  corroborate it (`linked_source_count`).

`app/correlation/risk_scoring.py` assigns each correlated finding a 0–10
severity score based on: finding type base severity → presence of
high-impact data classes (passwords, financial data, gov IDs) → confidence
level → corroboration across sources. The overall scan score is a weighted
blend (70% worst finding / 30% mean) so one severe issue isn't diluted by
many minor ones.

All scoring is rule-based and transparent — every score can be traced back
to an explainable rule, which matters for a tool whose job is to explain
exposure to a non-expert user.

## Auth, consent & rate limiting

- **JWT auth** (`app/auth.py`): bcrypt-hashed passwords, short-lived access
  tokens + longer-lived refresh tokens.
- **OTP consent gate** (`app/verification.py`): `POST /verification/request-otp`
  sends a 6-digit code to the target email (logged to console in
  `OTP_DEV_MODE`, sent via SMTP otherwise); `POST /verification/confirm-otp`
  validates it. `POST /scans` checks a verified record exists before
  allowing a scan to start.
- **Rate limiting** (`app/rate_limit.py`): sliding-window limiter, Redis-backed
  in production (shared across workers) with an in-memory fallback for local
  dev. Applied at three levels: general per-IP limit, stricter per-user
  scan-creation limit (protects both the account and the external OSINT
  APIs' own rate limits), and an OTP-request limit (prevents email-bombing).

## Running locally

### Option A — Docker Compose (recommended, includes Postgres + Redis)

```bash
cp .env.example .env
docker compose up --build
```

API available at `http://localhost:8000`, interactive docs at
`http://localhost:8000/docs`.

### Option B — Local Python (SQLite, in-memory rate limiter)

```bash
cp .env.example .env
# In .env, set REDIS_URL= (empty) to use the in-memory rate limiter fallback
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Example flow

```bash
# 1. Register
curl -X POST localhost:8000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"correcthorse1"}'

# 2. Login
curl -X POST localhost:8000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"correcthorse1"}'
# -> {"access_token": "...", "refresh_token": "..."}

# 3. Request OTP for the email you want to scan (must be one you control)
curl -X POST localhost:8000/verification/request-otp -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"target_email":"me@example.com"}'
# In OTP_DEV_MODE, the code is returned in the response AND logged server-side.

# 4. Confirm OTP
curl -X POST localhost:8000/verification/confirm-otp -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"target_email":"me@example.com","otp_code":"123456"}'

# 5. Start a scan
curl -X POST localhost:8000/scans -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"target_email":"me@example.com"}'
# -> {"id": "<scan_id>", "status": "pending", ...}

# 6. Poll status, then fetch full results
curl localhost:8000/scans/<scan_id> -H "Authorization: Bearer <token>"
curl localhost:8000/scans/<scan_id>/results -H "Authorization: Bearer <token>"
```

## Production hardening checklist

This is a functional reference implementation; before real deployment:

- Replace `init_db()` (create-all) with **Alembic migrations**.
- Set a strong, random `JWT_SECRET_KEY` and rotate it via a secrets manager.
- Set `OTP_DEV_MODE=false` and configure real SMTP credentials.
- Restrict CORS `allow_origins` to your actual frontend domain(s).
- Put the API behind HTTPS (e.g. via a reverse proxy / load balancer with TLS).
- Review each external source's Terms of Service and rate limits for
  higher-volume/commercial use — all sources here are free, but
  XposedOrNot, GitHub, and rdap.org each still apply their own rate limits
  and may ask you to self-host or use a "Plus" tier at scale.
- Consider adding a data-retention/delete policy for scan results, since
  they contain sensitive PII about the user.
- Add structured audit logging of scan creation (who/when/what email) for
  accountability, given the sensitivity of the data being processed.

## Extending with new collectors

1. Add a new file in `app/collectors/`, subclassing `BaseCollector` and
   implementing `async def collect(self, email, domain) -> list[NormalizedFinding]`.
2. Register the instance in `COLLECTORS` in `app/collectors/orchestrator.py`.
3. Optionally add a category mapping / base severity / recommendation text
   in `app/correlation/normalizer.py` and `recommendations.py` for any new
   `finding_type` values you introduce.
