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

The `tests/test_auth_registration.py` suite tests registration, email-verification,
and rate-limiting logic without the Cloudflare Workers runtime:

```bash
cd wedding-planner-backend
pip install pytest fastapi pyjwt httpx
pytest tests/test_auth_registration.py -v
```

## Deployment

Use `DEPLOY.md` for production deploy instructions (D1 setup, secrets, deploy commands, Stripe webhook).

## Important Caveat about Legacy Files

This repository still includes some legacy Flask-era migration and test files that reference `create_app()` and SQLAlchemy models. Those are not part of the active Cloudflare Workers runtime path.

Primary Cloudflare runtime files are in:
- `wedding-planner-backend/src/main.py`
- `wedding-planner-backend/src/middleware.py`
- `wedding-planner-backend/schema.sql`
- `wedding-planner-backend/wrangler.jsonc`
- `wedding-planner-frontend/wrangler.jsonc`

## License

MIT
