# Tracewell: frontend

React + TypeScript frontend for the Personal OSINT Exposure Assessment backend
(`../backend`). It implements the three Google Stitch screens in `../export`
(overview dashboard, new assessment, exposure report), plus the screens the
export didn't include: sign-in, registration, scan progress and history.

- **Stack:** Vite 5, React 18, TypeScript (strict), React Router 6, Tailwind CSS 3 (built locally, no CDN).
- **Fonts and icons:** IBM Plex Sans/Mono and Material Symbols are bundled from npm (`@fontsource/*`, `material-symbols`), so the app makes no requests to Google Fonts at runtime.
- **Design tokens:** `tailwind.config.js` contains the export's Tailwind config verbatim, plus named aliases (`panel`, `line`, `lime`, `sev-*`) for the hex values the export used inline and `DESIGN.md` defines.

## Requirements

- Node.js 18 or later. Developed with Node 24 LTS.
- The FastAPI backend running and reachable. See `../backend/README.md`.

## Running locally

Run each app in its own terminal.

**Backend** (from `backend/`):

```bash
cp .env.example .env
# For local runs without Docker, set REDIS_URL= (empty) in .env to use the in-memory rate limiter.
python -m venv venv
source venv/bin/activate          # Windows PowerShell: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload     # http://localhost:8000, docs at /docs
```

**Frontend** (from `frontend/`):

```bash
cp .env.example .env              # Windows: copy .env.example .env
npm install
npm run dev                       # http://localhost:5173
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Type-checks, then writes a production bundle to `dist/` |
| `npm run preview` | Serves `dist/` at http://localhost:4173 |

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` in dev; same origin in production builds | Backend base URL, with no trailing slash. |
| `VITE_SHOW_DEV_OTP` | `false` | Dev only. When the backend runs with `OTP_DEV_MODE=true`, shows the returned `dev_otp` in a `[DEV]` banner. Ignored by `npm run build`. |
| `VITE_OTP_LENGTH` | `6` | Must match the backend's `OTP_LENGTH`. |

Vite inlines these at build time, so rebuild after changing them. Never put
secrets in `VITE_*` variables: they end up in the public bundle.

## How it maps to the backend

All HTTP goes through `src/services/apiClient.ts` (`apiRequest`). Typed endpoint
wrappers live in `src/services/api.ts`, and response types in
`src/types/api.ts` mirror `backend/app/schemas.py`.

| UI | Endpoint |
|---|---|
| Register | `POST /auth/register`, then `POST /auth/login` (register returns no tokens) |
| Sign in | `POST /auth/login` |
| Silent token refresh after a 401 | `POST /auth/refresh` |
| New assessment, step 1 → 2 | `POST /verification/request-otp` |
| New assessment, step 2 → 3 | `POST /verification/confirm-otp` |
| Start assessment / Run again | `POST /scans` |
| Overview, History | `GET /scans` |
| Scan progress (polling) | `GET /scans/{id}` |
| Report, overview risk scores | `GET /scans/{id}/results` |
| Header "API ONLINE" indicator | `GET /health` |

### Auth and token storage

- The backend returns the access token (60 min) and refresh token (7 days) in the JSON body. It doesn't use cookies, so the browser must hold them. They are kept in **`sessionStorage`**: a page reload keeps you signed in, and closing the tab signs you out. Passwords are never stored.
- **Tradeoff:** `sessionStorage` is readable by any script running on the page. An XSS bug could steal the tokens, which an HttpOnly cookie would prevent. It is **not** equivalent to an HttpOnly, Secure, SameSite cookie. Moving to cookies would need backend changes: issuing `Set-Cookie` on login and refresh, reading the token from the cookie, adding CSRF protection, and replacing `allow_origins=["*"]` with explicit origins. Until then, keep the page free of third-party scripts.
- On a 401 the client calls `/auth/refresh` once, with concurrent requests sharing that refresh, then retries. If the refresh token is rejected, the session ends and you are sent to sign-in with an "expired" notice. A network failure during refresh does not sign you out.
- **Sign out** discards the tokens client-side. The backend has no logout or revocation endpoint, so a token that leaked earlier stays valid until it expires.
- The backend has no "current user" endpoint, so the operator email shown in the sidebar is the address you signed in with.

### Email ownership verification

1. Enter the target email, then **Send verification code** (`request-otp`).
2. Enter the code (`confirm-otp`). The **Start assessment** button is only shown after the backend confirms the code.
3. `POST /scans` is still checked by the backend, which returns 403 if the email isn't verified for your account.

The backend never expires a verification. So **Run again** on an email you've
scanned before calls `POST /scans` directly. If that returns 403, you are taken
to the verification step with the email filled in.

**Dev OTP:** with `OTP_DEV_MODE=true` the backend also returns the code in
`dev_otp` and prints it in the uvicorn console. The frontend only displays it
when the build is a dev build **and** `VITE_SHOW_DEV_OTP=true`. Otherwise it is
discarded immediately. A production build that receives a `dev_otp` shows a
warning that the backend is in dev mode, without showing the code.

### Scan progress

`POST /scans` returns `202` with `status: "pending"`, and the scan then runs as
a FastAPI background task. The scan page polls `GET /scans/{id}` every 4
seconds with one request at a time. It backs off up to 30 seconds after errors,
slows to 15 seconds while the tab is hidden, and stops when the status is
`completed` or `failed` or when you leave the page. The backend reports no
per-source progress, so the UI shows an activity bar instead of a percentage.

The backend's general limiter allows **30 requests per minute per IP across
`/auth` and `/scans`**, and the polling interval is chosen to stay well under it.
Completed results are cached in memory to avoid refetching. The cache is
cleared on sign-out.

### Report

Everything shown comes from `GET /scans/{id}/results`. The overall score and
every severity label come from the backend; the frontend never re-scores
anything. Some views are derived on the client:

- **Source coverage.** A `collector_error` raw finding marks a source as unavailable. Other raw findings count as results. No rows means "no findings".
- **Evidence, confidence and data types per correlated finding.** The API doesn't link correlated findings to raw findings. The correlation engine builds `description` by joining raw `value`s with `" | "`, so raw findings are matched on value and source. A finding where *every* piece of evidence is low-confidence is labelled **Possible match** and can be hidden.
- **Recommended actions** groups findings that share recommendation text.
- **"How scoring works"** documents the rules in `backend/app/correlation/risk_scoring.py`. Update it if those rules change.

## Differences from the Stitch export

The export contained sample data and controls the backend doesn't support.
These were removed or replaced so the UI never shows invented information:

- **Removed**: risk percentile, "4/6 resolved" per-source progress, *Cancel process*, *Mark resolved*, *Inspect dump details*, quota "N remaining", the "4/10 pool" count, and "Live ledger" IDs. The backend has no data or endpoint for any of these.
- **Copy corrected**: "RFC 6238 TOTP" is an emailed random code. "HIBP" is XposedOrNot. Gravatar uses an MD5 hash, not SHA-256. The username check covers 5 platforms, not "300+". "Zero-knowledge" and "TLS 1.3 certified" claims were dropped. The scoring drawer's invented weights were replaced with the real rules.
- **Replaced**: "ACTIVE SCANNER v2.4" became a real `/health` indicator. The hot-linked logo image became a local SVG. "Your verified emails" now lists addresses you've scanned: scanning requires verification, and verification doesn't expire. There is no endpoint that lists verified-but-never-scanned emails.
- **Added**: sign-in, registration, step 1 (target entry), the scan progress view, the history page with filters and pagination, and the failed-scan view.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Can't reach the API at …" / header shows **API UNREACHABLE** | Backend not running, or `VITE_API_BASE_URL` is wrong. Check `http://localhost:8000/health` in a browser. Restart `npm run dev` after editing `.env`. |
| CORS error in the console | The backend currently allows all origins (`allow_origins=["*"]`), which works for Bearer-token requests. If you've restricted origins, add `http://localhost:5173` (dev) and your production origin. |
| "Too many requests" | The backend rate limits: 30 requests per minute per IP on `/auth` and `/scans`, 5 OTP requests per hour per IP, and 5 scans per hour per user. Wait and retry. |
| No verification email arrives | With `OTP_DEV_MODE=true` (the default) no email is sent; the code is printed in the backend console. For real email, set `OTP_DEV_MODE=false` and the `SMTP_*` variables. |
| "Code not accepted" | The code is wrong, has expired (10 minutes by default), or is locked after 5 wrong attempts. The backend returns the same error for all three. Request a new code. |
| Scan stuck in **running** | The backend runs scans as in-process background tasks. If uvicorn restarted mid-scan, that scan stays `running` forever. Start a new one. |
| Backend fails to start with a Redis error | For local runs without Docker, set `REDIS_URL=` (empty) in `backend/.env`. |
| A deep link like `/scans/…` returns 404 in production | Configure the web server to serve `index.html` for unknown paths (SPA fallback). `npm run dev` and `npm run preview` already do this. |

## Project structure

```
src/
  components/        shared UI (buttons, badges, gauges, drawer, OTP input, states)
    report/          report sections (score overview, actions, categories, findings, collection notes)
  context/           AuthContext: session state, login/register/logout
  hooks/             data hooks (scans list, status polling, results, health, countdown)
  layouts/           AppLayout (sidebar/header/bottom nav), AuthLayout, route guards
  pages/             Overview, NewAssessment, Scan (progress/report/failed), History, Login, Register
  services/          apiClient (HTTP + refresh), api (endpoints), tokenStore, resultsCache
  types/             API response types
  utils/             formatting, severity styles, report derivations
```
