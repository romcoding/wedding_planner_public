# Wedding Planner (Cloudflare Workers Edition)

A full-stack wedding planning platform built for Cloudflare’s edge stack:
- **Backend:** FastAPI running on **Cloudflare Python Workers**
- **Database:** **Cloudflare D1** (SQLite)
- **Frontend:** React + Vite served via **Workers Static Assets**

## Current Architecture

```text
Browser
  ↓
Cloudflare Edge
  ├── wedding-planner-frontend.workers.dev   (React SPA static assets)
  └── wedding-planner-api.workers.dev        (Python Worker / FastAPI)
          └── D1 database binding: DB
```

## Repository Layout

```text
.
├── wedding-planner-backend/
│   ├── src/
│   │   ├── main.py              # FastAPI app + WorkerEntrypoint
│   │   ├── auth.py              # JWT auth helpers
│   │   ├── middleware.py        # D1/env/wedding dependencies
│   │   ├── routes/              # API routers
│   │   └── services/            # AI, email, and feature services
│   ├── schema.sql               # D1 schema
│   ├── pyproject.toml           # Python deps for Workers runtime
│   └── wrangler.jsonc           # Worker config + D1 binding
├── wedding-planner-frontend/
│   ├── src/
│   ├── public/_redirects        # SPA fallback routing
│   ├── package.json
│   └── wrangler.jsonc           # Static assets worker config
├── DEPLOY.md                    # Cloudflare deploy steps
└── DEVELOPMENT.md               # Local workflow
```

## Registration Flow

New couples self-register at `/auth?tab=register` or via the hero quick-form:

1. Enter partner names, email, password, and an **optional** wedding date.
2. Backend validates fields + password strength, creates a `users` + `weddings` row,
   and issues a 128-character email-verification token (valid 24 h).
3. A verification email is sent (Resend). Login is blocked until the email is verified.
4. Clicking the link POSTs to `POST /api/auth/verify-email` → account unlocked.

### Password Requirements (OWASP-aligned)

| Rule | Detail |
|------|--------|
| Minimum length | 8 characters (12+ recommended) |
| Common passwords | ~25 most-breached passwords blocked |
| Character set | All Unicode characters allowed |
| Strength meter | Live 4-bar indicator in the register form |

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/couple/register` | 5 per IP / 15 min |
| `POST /api/auth/login` | 10 per IP + 10 per account / 15 min |

Excess attempts → **HTTP 429** with retry-after guidance.

---

## Backend Runtime Notes

- Worker entrypoint uses `WorkerEntrypoint` + `asgi.fetch(...)`.
- D1 is consumed from request scope (`request.scope["env"].DB`) in dependencies.
- JWT implementation uses `pyjwt`.
- Password hashing uses PBKDF2-SHA256 (pure Python, Workers-compatible; no bcrypt).

## Local Development

### Backend

```bash
cd wedding-planner-backend
uv sync
uv run pywrangler dev
```

### Frontend

```bash
cd wedding-planner-frontend
npm install
npm run dev
```

### Run checks

```bash
cd wedding-planner-backend
python -m compileall src
```

### Run backend unit tests

The suite runs the FastAPI handlers directly (a real in-memory SQLite stands in
for D1), so no Cloudflare Workers runtime is needed. `conftest.py` puts `src/` on
the path and stubs the Pyodide-only `workers`/`asgi`/`js` modules.

```bash
cd wedding-planner-backend
uv sync --all-groups
uv run pytest             # entitlements, billing webhook, tenant isolation,
                          # website + Wedi, public site + RSVP CORS, XSS escaping,
                          # error envelope, abuse matrix, observability, health
```

Without `uv`, install the same dependencies manually instead:

```bash
pip install pytest fastapi passlib pyjwt httpx
python -m pytest
```

## Deployment

Use `DEPLOY.md` for production deploy instructions (D1 setup, secrets, deploy
commands, Stripe live-mode setup, migration order, `wrangler tail`). `MANUAL-QA.md`
holds the pre-launch end-to-end click-paths.

## Plans & Website Hosting

### Plans (`free | premium | lifetime`)

`src/entitlements.py` is the single source of truth; the **backend** enforces
every gate via `require_feature(...)`, and frontend gating is UX only. Legacy
`starter` rows normalize to `premium`.

| Plan | Price | What you get |
|------|-------|--------------|
| **free** | — | Guest list, tasks, basic budget, basic agenda. Caps: 30 guests, 10 tasks. No website. |
| **premium** | CHF 9 / month (subscription) | Everything: invitations, events, seating, messaging, gift registry, venue tools, RSVP reminders, full budget, planning assistant, **website builder + Wedi generation + public `/s/` hosting**. |
| **lifetime** | CHF 149 (one-time) | Same as premium, forever. **Never downgraded** by any subscription webhook. |

Plan changes are driven by the single Stripe webhook (`/api/billing/webhook`);
price-id → plan is read from env vars (sandbox ids as defaults), so sandbox and
live differ by config, not code.

### Public website hosting at `/s/{slug}`

Published couple sites are **server-rendered** (`services/site_renderer.py`) from
`wedding_sites.published_snapshot` and served by the API Worker at **`GET /s/{slug}`**
— never the SPA, and never `/w/` (that path is the existing guest portal,
`WeddingPortal`). Notes:

- Password-protected sites sit behind a signed, site-scoped cookie and are never cached.
- Password-less published sites are edge-cached (`public, max-age=300`) and the
  cache is purged on publish / unpublish / downgrade / delete.
- The `custom_host` column + `resolve_site` already support the future
  wildcard-domain phase (see DEPLOY.md appendix).

### Wedi generation limits

Wedi turns a couple's note into the same validated block document the manual
editor produces (drafts only — it never auto-publishes). Limits (premium/lifetime;
free = 0), all in `entitlements.py` / `services/usage.py`:

- **30 generations per month** and a **monthly token budget** (checked before any
  model call, so an over-limit account makes zero requests),
- **5 generations per minute** velocity guard,
- a hard **4000 output-token** ceiling per request,
- a global **kill switch** (`WEDI_GENERATION_DISABLED=1` → `503`).

### Two RSVP channels

RSVPs arrive through two **separate** paths that never cross tenants:

1. **Guest-token channel** — an invited guest opens `/rsvp/{token}` (guest portal,
   authenticated by their unique token) and updates their own row in the `guests`
   table.
2. **Public-site form channel** — anyone visiting `/s/{slug}` submits the open RSVP
   form, which POSTs to **`/api/public/rsvp/{slug}`** (unauthenticated; tenancy is
   derived from the slug, never the body). Submissions land in
   `site_rsvp_responses`, are best-effort matched to a guest, and surface in the
   website **RSVP inbox** with an **"Add to guest list"** action.

## License

MIT
