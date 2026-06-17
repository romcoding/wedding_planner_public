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

### 2b. Create the Rate-Limit KV Namespace

The durable rate limiter (login/register/password-reset/etc.) stores TTL'd
counters in a KV namespace bound as `RATE_LIMIT`. Create it and paste the id
into `wedding-planner-backend/wrangler.jsonc`:

```bash
npx wrangler kv namespace create RATE_LIMIT
```

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "RATE_LIMIT",
      "id": "YOUR_KV_NAMESPACE_ID_HERE"   // ← paste here
    }
  ]
}
```

> If the binding is missing the limiter fails open (allows traffic) and logs a
> warning — so configure it before launch.

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

### 4. Wedi website generation — budget & kill switch

"Wedi designs your website" calls the model with HARD server-side cost controls
(monthly generation/token budgets in `entitlements.py`, per-minute velocity on
the `RATE_LIMIT` KV namespace, and a 4000-token-per-request ceiling). No extra
secret is required beyond `ANTHROPIC_API_KEY` above.

Apply the usage-ledger migration once (fresh databases get it from `schema.sql`):

```bash
npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/migrations/005_wedi_usage.sql
```

**Operator kill switch.** To pause all Wedi generation instantly (incidents,
cost spikes) set the `WEDI_GENERATION_DISABLED` var to `"1"` — the generate
endpoint then returns `503 wedi_paused` before any model call. Unset it (or set
anything other than `"1"`) to resume.

```bash
# Pause:
npx wrangler secret put WEDI_GENERATION_DISABLED --name wedding-planner-api   # enter: 1
# Resume:
npx wrangler secret delete WEDI_GENERATION_DISABLED --name wedding-planner-api
```

> It can also be set as a plain `[vars]` entry in `wrangler.jsonc` if you prefer
> a non-secret toggle; a secret is recommended so flipping it needs no redeploy.

### 5. Public wedding sites — `/s/{slug}`

Published couple websites are **server-rendered static HTML by the backend
worker** from `wedding_sites.published_snapshot` (never the SPA, never the
draft). They are served, unauthenticated, at:

- `GET  /s/{slug}` — the published site (optional guest-password gate).
- `POST /s/{slug}` — guest-password verification (sets a signed, 7-day cookie).
- `POST /api/public/rsvp/{slug}` — the open RSVP form's submit endpoint.

> The guest portal `/w/:slug` is a **different** feature (the existing
> WeddingPortal SPA route) — public couple sites intentionally live under `/s/`.

**Apply the website-tables migration once** (fresh databases get these from
`schema.sql`):

```bash
npx wrangler d1 execute wedding-planner-db --remote --file=wedding-planner-backend/migrations/004_website.sql
```

**Set the public-site origin.** `PUBLIC_SITE_BASE_URL` is the absolute origin
`/s/{slug}` links are built from (shareable URL, OpenGraph `og:url`, the RSVP
endpoint, and the edge-cache key). For launch, point it at the **backend API
worker origin** so links resolve with zero extra DNS:

```bash
# e.g. https://wedding-planner-api.<subdomain>.workers.dev  (NO trailing slash, NO /api)
npx wrangler secret put PUBLIC_SITE_BASE_URL --name wedding-planner-api
```

The frontend editor builds the same link from `VITE_PUBLIC_SITE_BASE_URL`
(optional — it defaults to the `VITE_API_URL` origin, which is this same worker).
Keep the two values in agreement when you set them explicitly.

**RSVP cookie secret (optional).** The guest-password cookie is HMAC-signed. It
reuses `JWT_SECRET_KEY` by default (already fail-closed); set a dedicated secret
only if you want to rotate it independently:

```bash
npx wrangler secret put RSVP_COOKIE_SECRET --name wedding-planner-api   # optional
```

**Caching behavior.**

- Password-less published sites respond with `Cache-Control: public, max-age=300`
  and are stored in the Workers Cache API (`caches.default`) keyed on
  `{PUBLIC_SITE_BASE_URL}/s/{slug}`.
- The cache is **purged** automatically on publish, unpublish, slug change, and a
  premium→free downgrade (the same `purge_site_cache(slug)` seam in all paths).
- Password-protected sites and the password form are served `no-store` and are
  **never** cached.
- Manual caching/purge are active only when `PUBLIC_SITE_BASE_URL` is set (store
  and purge derive the key from it, so they stay symmetric). With it unset, sites
  still render — just uncached.

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

### Point `/s/*` at a pretty domain (no code change)

`/s/{slug}` is served by the **backend** worker, so a nicer public-site URL is
just a routing + config change:

1. Add a custom domain (or route) for the path to `wedding-planner-api`, e.g.
   `sites.yourdomain.com` → `wedding-planner-api`. Couple sites are then reachable
   at `https://sites.yourdomain.com/s/{slug}`.
2. Set `PUBLIC_SITE_BASE_URL=https://sites.yourdomain.com` (and, if set
   explicitly, `VITE_PUBLIC_SITE_BASE_URL` to match). Links, OpenGraph, the RSVP
   endpoint and the cache key all follow automatically. No redeploy of code is
   needed — just the secret update + the route.

### Per-couple subdomains / wildcard domains (future)

The `wedding_sites.custom_host` column already exists (unused today) and
`resolve_site()` checks the `Host` header against it **before** the `/s/{slug}`
path. To activate true `name.weddings.yourdomain.com` per-couple hosting later:

1. **DNS:** add a wildcard record `*.weddings.yourdomain.com` (Cloudflare proxied).
2. **Route:** add a Worker route `*.weddings.yourdomain.com/*` → `wedding-planner-api`
   (a wildcard custom domain / route; SSL for SaaS / a wildcard cert is required).
3. **Data:** populate `wedding_sites.custom_host` for the couples opting in (the
   column is `UNIQUE`), and serve their published site at the host root.

No schema change is required for steps 1–3; only the wildcard route + cert and a
small root-path handler (`GET /`) need wiring when that phase is scheduled.

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
