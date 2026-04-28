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

## Backend Runtime Notes

- Worker entrypoint uses `WorkerEntrypoint` + `asgi.fetch(...)`.
- D1 is consumed from request scope (`request.scope["env"].DB`) in dependencies.
- JWT implementation uses `pyjwt`.
- Password hashing dependency is `passlib` (pure Python, Workers-compatible).

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
