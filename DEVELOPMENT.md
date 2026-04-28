# Local Development Guide

## Prerequisites

- Python 3.12+
- Node.js 18+ / npm
- `uv` (recommended for Python dependency management)
- Wrangler CLI (`npm install -g wrangler`)

---

## Backend (Cloudflare Python Worker)

```bash
cd wedding-planner-backend
uv sync
```

### Run Worker locally (D1-compatible)

```bash
cd wedding-planner-backend
npx wrangler d1 execute wedding-planner-db --local --file=schema.sql
uv run pywrangler dev
```

Default local Worker URL: `http://localhost:8787`

### Optional: run FastAPI directly (without Worker env)

```bash
cd wedding-planner-backend
uv run uvicorn src.main:app --reload --port 8000
```

---

## Frontend

```bash
cd wedding-planner-frontend
npm install
echo "VITE_API_URL=http://localhost:8787/api" > .env.local
npm run dev
```

Frontend URL: `http://localhost:5173`

---

## Environment Variables

### Backend secrets (production via `wrangler secret put`)

| Variable | Description |
|---|---|
| `JWT_SECRET_KEY` | Secret for signing JWTs |
| `ANTHROPIC_API_KEY` | Claude API key |
| `RESEND_API_KEY` | Resend email API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_STARTER_PRICE_ID` | Stripe Starter Price ID |
| `STRIPE_PREMIUM_PRICE_ID` | Stripe Premium Price ID |
| `FRONTEND_URL` | Frontend URL used for redirects/emails |
| `FROM_EMAIL` | Sender email for transactional emails |

### Frontend env

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL ending in `/api` |
| `VITE_FRONTEND_URL` | Optional frontend public URL |

---

## Validation Commands

### Backend syntax smoke check

```bash
cd wedding-planner-backend
python -m compileall src
```

### Frontend production build

```bash
cd wedding-planner-frontend
npm run build
```

---

## Notes

- Use `passlib` for password hashing in the Worker-compatible stack.
- Avoid `bcrypt` in Workers runtime because binary dependencies are not portable to Pyodide.
- For deployment flow, see `DEPLOY.md`.
