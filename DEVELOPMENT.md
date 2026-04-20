# Local Development Guide

## Prerequisites

- Python 3.11+
- Node.js 18+ / npm
- Wrangler CLI (`npm install -g wrangler` or `pnpm add -g wrangler`)

---

## Backend (FastAPI local dev)

```bash
cd wedding-planner-backend

# Install dependencies
pip install fastapi pyjwt bcrypt resend httpx uvicorn

# Set local env vars
cp .env.example .env.local  # (if exists)
export JWT_SECRET_KEY=dev-secret
export ANTHROPIC_API_KEY=your_key_here
export RESEND_API_KEY=your_key_here
export STRIPE_SECRET_KEY=your_key_here

# Run with uvicorn (local FastAPI dev server)
uvicorn src.main:app --reload --port 8000
```

API available at: `http://localhost:8000`

### Local D1 via Wrangler

Alternatively, run with Wrangler to use a local SQLite D1 emulation:

```bash
cd wedding-planner-backend

# Apply schema locally first
npx wrangler d1 execute wedding-planner-db --local --file=schema.sql

# Run local worker
uv run pywrangler dev
```

API available at: `http://localhost:8787`

---

## Frontend

```bash
cd wedding-planner-frontend

# Install dependencies
npm install

# Set API URL for local dev
echo "VITE_API_URL=http://localhost:8000/api" > .env.local

# Start dev server
npm run dev
```

Frontend available at: `http://localhost:5173`

---

## Environment Variables

### Backend (set via `wrangler secret put` in production, or shell exports locally)

| Variable | Description |
|---|---|
| `JWT_SECRET_KEY` | Secret for signing JWTs |
| `ANTHROPIC_API_KEY` | Claude API key |
| `RESEND_API_KEY` | Resend email API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_STARTER_PRICE_ID` | Stripe Price ID for Starter plan |
| `STRIPE_PREMIUM_PRICE_ID` | Stripe Price ID for Premium plan |
| `FRONTEND_URL` | Frontend URL for email links + Stripe redirects |
| `FROM_EMAIL` | Sender email address for Resend |

### Frontend (set in `.env.local` for dev, `.env.production` for prod)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (must end with `/api`) |
| `VITE_FRONTEND_URL` | Frontend URL (for display purposes) |

---

## Common Tasks

### Reset local D1 database

```bash
cd wedding-planner-backend
rm -f .wrangler/state/v3/d1/*.sqlite
npx wrangler d1 execute wedding-planner-db --local --file=schema.sql
```

### Run schema migration on production D1

```bash
npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/schema.sql
```

### Check deployed Worker logs

```bash
npx wrangler tail wedding-planner-api
```
