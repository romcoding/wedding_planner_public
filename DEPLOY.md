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
uv run pywrangler deploy
```

Note the deployed URL, e.g. `https://wedding-planner-api.romcoding.workers.dev`

---

## Deploy Frontend Worker

```bash
# The .env.production file is already committed with the correct API URL:
#   VITE_API_URL=https://wedding-planner-api.romanhess1994.workers.dev/api
#
# If you ever need to override it (e.g. a different subdomain):
echo "VITE_API_URL=https://wedding-planner-api.<subdomain>.workers.dev/api" > wedding-planner-frontend/.env.production

cd wedding-planner-frontend
npm install         # or pnpm install
npm run deploy      # builds + wrangler deploy
```

> **Note:** The build will fail immediately with a descriptive error if
> `VITE_API_URL` is missing from the production environment — see
> `vite.config.js` for details.

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
allow_origins=["https://wedding-planner-frontend.romanhess1994.workers.dev"],
```

Redeploy the backend:

```bash
cd wedding-planner-backend && uv run pywrangler deploy
```

---

## Registration Flow

1. Couple visits `/auth?tab=register` (or the hero form on the landing page).
2. They enter partner names, email, optional wedding date, and a password.
3. The backend (`POST /api/auth/couple/register`) creates the user + wedding record
   and inserts a 128-character verification token into `email_verifications`
   (expires 24 hours from registration).
4. A verification email is sent via Resend (`RESEND_API_KEY` secret).
5. Until the email is verified, login returns **403**.
6. The user clicks the link in the email, which calls
   `POST /api/auth/verify-email` with the token.
7. The user is marked as verified and can now log in.

### Password requirements (OWASP-aligned)

- Minimum **8 characters** (12+ recommended).
- Must not be one of the ~25 most common passwords.
- All Unicode characters are accepted.
- The front-end shows a live **4-bar strength meter** (Weak / Fair / Good / Strong).

### Rate limiting

- Registration: max **5 attempts per IP** per 15-minute window.
- Login: max **10 attempts per IP** and **10 per account** per 15-minute window.
- Excess attempts return **HTTP 429** with a "try again in N minutes" message.

---

## Schema Migrations

The `schema.sql` file uses `CREATE TABLE IF NOT EXISTS` so it is safe to re-run.

If you are upgrading an existing D1 database (rather than creating fresh), run
the migration statements below **once**:

```sql
-- Add email verification columns to users (if upgrading from earlier schema)
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- Create email verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
```

```bash
npx wrangler d1 execute wedding-planner-db --command="ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"
npx wrangler d1 execute wedding-planner-db --command="ALTER TABLE users ADD COLUMN email_verified_at TEXT"
npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/schema.sql
```
