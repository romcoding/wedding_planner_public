# Deployment Guide — Cloudflare Workers

## Architecture

```
Browser
  ↓
Cloudflare Edge
  ├── wedding-planner-frontend.workers.dev  → Workers Static Assets (React SPA)
  └── wedding-planner-api.workers.dev       → Python Worker (FastAPI + D1)
                                                └── D1 Database (SQLite, edge)
```

---

## One-Time Setup

### 1. Create D1 Database

```bash
npx wrangler d1 create wedding-planner-db
```

Copy the `database_id` from the output and update `wedding-planner-backend/wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "wedding-planner-db",
      "database_id": "YOUR_DATABASE_ID_HERE"   // ← paste here
    }
  ]
}
```

### 2. Apply Schema

```bash
npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/schema.sql
```

### 3. Set Secrets (Backend Worker)

```bash
npx wrangler secret put JWT_SECRET_KEY --name wedding-planner-api
npx wrangler secret put ANTHROPIC_API_KEY --name wedding-planner-api
npx wrangler secret put RESEND_API_KEY --name wedding-planner-api
npx wrangler secret put STRIPE_SECRET_KEY --name wedding-planner-api
npx wrangler secret put STRIPE_WEBHOOK_SECRET --name wedding-planner-api
npx wrangler secret put STRIPE_STARTER_PRICE_ID --name wedding-planner-api
npx wrangler secret put STRIPE_PREMIUM_PRICE_ID --name wedding-planner-api
npx wrangler secret put FRONTEND_URL --name wedding-planner-api
npx wrangler secret put FROM_EMAIL --name wedding-planner-api
```

---

## Deploy Backend API Worker

```bash
cd wedding-planner-backend
npx wrangler deploy
```

Note the deployed URL, e.g. `https://wedding-planner-api.romcoding.workers.dev`

---

## Deploy Frontend Worker

```bash
# Set the API URL in .env.production
echo "VITE_API_URL=https://wedding-planner-api.romcoding.workers.dev/api" > wedding-planner-frontend/.env.production

cd wedding-planner-frontend
npm install         # or pnpm install
npm run deploy      # builds + wrangler deploy
```

---

## Register Stripe Webhook

In Stripe Dashboard → Developers → Webhooks, add endpoint:

```
https://wedding-planner-api.romcoding.workers.dev/api/billing/webhook
```

Events to listen for:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.created`
- `customer.subscription.deleted`

Copy the webhook signing secret and run:

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET --name wedding-planner-api
```

---

## Custom Domains (optional)

In Cloudflare Dashboard → Workers & Pages → your Worker → Settings → Custom Domains, add:
- API: `api.yourdomain.com` → `wedding-planner-api`
- Frontend: `app.yourdomain.com` or `yourdomain.com` → `wedding-planner-frontend`

Then update `VITE_API_URL` and `FRONTEND_URL` accordingly.

---

## Tighten CORS After Deploy

Once both Workers are deployed, update `allow_origins` in `wedding-planner-backend/src/main.py`:

```python
allow_origins=["https://wedding-planner-frontend.romcoding.workers.dev"],
```

Redeploy the backend:

```bash
cd wedding-planner-backend && npx wrangler deploy
```
