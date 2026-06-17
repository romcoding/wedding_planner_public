# Deployment Guide — Cloudflare Workers

## Architecture

```
Browser
  ↓
Cloudflare Edge
  ├── wedding-planner-frontend.workers.dev  → Workers Static Assets (React SPA)
  └── wedding-planner-api.workers.dev       → Python Worker (FastAPI + D1)
                                                └── D1 Database (SQLite, edge)
                                                └── RATE_LIMIT KV namespace
```

`/s/*` (public couple sites) and `/api/public/*` (the open RSVP form) are served
by the **backend** worker. `/w/:slug` is the **separate** guest portal (the React
SPA). See "Routing & caching" below.

---

## Secrets & vars checklist

Set on the **backend** worker (`--name wedding-planner-api`). Secrets are set with
`npx wrangler secret put <NAME>`; plain vars can go in `wrangler.jsonc` `[vars]` or
be passed at deploy with `--var NAME:VALUE`.

| Name | Kind | Required | Purpose / notes |
|------|------|----------|-----------------|
| `JWT_SECRET_KEY` | secret | **yes — fail-closed** | Signs/verifies all auth tokens. If missing, the worker raises on the first request (`main.py`) and `auth.py` refuses to sign — there is **no** default secret. `openssl rand -hex 32`. |
| `STRIPE_SECRET_KEY` | secret | yes (billing) | Stripe API calls (checkout/customer/portal). Live key for production. |
| `STRIPE_WEBHOOK_SECRET` | secret | yes (billing) | HMAC-verifies the webhook. **Must be the signing secret of the endpoint that carries all five events** (sandbox: the `charismatic-harmony-snapshot` endpoint). Wrong secret → every event is rejected `400`. |
| `STRIPE_PREMIUM_PRICE_ID` | secret/var | yes (billing) | Price id mapped to `premium`. Defaults to the sandbox id baked in `billing_routes.py` if unset. |
| `STRIPE_LIFETIME_PRICE_ID` | secret/var | yes (billing) | Price id mapped to `lifetime`. Defaults to the sandbox id if unset. |
| `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_STARTER_PRICE_ID` | secret/var | optional | Extra ids that also map to `premium` (legacy/aliases). |
| `ANTHROPIC_API_KEY` | secret | yes (Wedi) | Wedi generation + planning assistant. Mirrored into env per-request and read per-call. |
| `RESEND_API_KEY` | secret | yes (email) | Transactional email (verification, welcome, billing, RSVP). |
| `FROM_EMAIL` / `RESEND_SENDER_DOMAIN` | secret/var | recommended | Sender address / domain for Resend. |
| `FRONTEND_URL` | secret/var | yes | Absolute SPA origin (links in emails, checkout return URLs). |
| `PUBLIC_SITE_BASE_URL` | secret/var | yes (hosting) | Absolute origin `/s/{slug}` links, OG `og:url`, the RSVP endpoint, and the **edge-cache key** are built from. No trailing slash, no `/api`. Point at the API worker origin for launch. |
| `WEDI_GENERATION_DISABLED` | secret/var | optional | Kill switch — `"1"` pauses all Wedi generation (`503 wedi_paused`) before any model call. |
| `RSVP_COOKIE_SECRET` | secret | optional | HMAC secret for the guest-password cookie; defaults to `JWT_SECRET_KEY`. |
| `CORS_EXTRA_ORIGINS` | var | optional | Comma-separated extra **credentialed** allow-list origins (in addition to the built-in list). Never includes `*`. |
| `GIT_SHA` | var (deploy) | auto | Injected by the deploy workflow (`--var GIT_SHA:<sha>`); surfaced at `GET /api/health`. |
| `RATE_LIMIT` | **KV binding** | yes | KV namespace id in `wrangler.jsonc`. Backs the durable rate limiter (auth, `/track`, public RSVP, Wedi velocity). If missing, the limiter fails **open** and logs — configure before launch. |

> The frontend worker needs only `VITE_API_URL` (build-time, in `.env.production`)
> and optionally `VITE_PUBLIC_SITE_BASE_URL` (defaults to the `VITE_API_URL` origin).

---

## Migrations — run order 003 → 004 → 005

A **fresh** database gets everything from `schema.sql` (it is the single source of
truth and includes the plans, website, Wedi-usage, and `stripe_events` tables).
When **upgrading an existing** database, apply the migrations **in order**, against
the **remote** D1:

```bash
npx wrangler d1 execute wedding-planner-db --remote --file=wedding-planner-backend/migrations/003_plans.sql
npx wrangler d1 execute wedding-planner-db --remote --file=wedding-planner-backend/migrations/004_website.sql
npx wrangler d1 execute wedding-planner-db --remote --file=wedding-planner-backend/migrations/005_wedi_usage.sql
```

- `003_plans.sql` — `weddings.plan` / `plan_expires_at` / `plan_updated_at`, `stripe_events` idempotency table.
- `004_website.sql` — `wedding_sites`, `site_revisions`, `site_rsvp_responses` (+ `custom_host`).
- `005_wedi_usage.sql` — `wedi_site_usage`, `wedi_generation_log` (the budget ledger).

> ⚠️ **The deploy workflow (`.github/workflows/deploy.yml`) does NOT run
> migrations.** It only deploys code. Run the commands above by hand (once) when
> the schema changes, before/after the relevant deploy. Re-running is safe
> (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN` guarded).

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
npx wrangler secret put STRIPE_PREMIUM_PRICE_ID --name wedding-planner-api
npx wrangler secret put STRIPE_LIFETIME_PRICE_ID --name wedding-planner-api
npx wrangler secret put PUBLIC_SITE_BASE_URL --name wedding-planner-api
npx wrangler secret put FRONTEND_URL --name wedding-planner-api
npx wrangler secret put FROM_EMAIL --name wedding-planner-api
```

See the **Secrets & vars checklist** above for the full list and what each one
does (and for the fail-closed `JWT_SECRET_KEY` and the `RATE_LIMIT` KV binding).

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

## Stripe — webhook & billing

There is **one** webhook endpoint and **one** plan-sync code path
(`/api/billing/webhook` in `billing_routes.py`). Price-id → plan is resolved from
env vars (sandbox ids as defaults), so **sandbox and live differ by config, not
code** (locked by a test in `tests/test_entitlements.py`).

### Webhook endpoint + the five events

In Stripe Dashboard → Developers → Webhooks, add the endpoint:

```
https://wedding-planner-api.<subdomain>.workers.dev/api/billing/webhook
```

Subscribe it to **all five** events (the sandbox endpoint is
`charismatic-harmony-snapshot`):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`:

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET --name wedding-planner-api
```

> The secret is **per endpoint**. If `STRIPE_WEBHOOK_SECRET` is not the secret of
> the endpoint carrying these five events, every delivery fails signature
> verification (`400`) and no plan ever changes.

### Going LIVE (mirror the sandbox by config)

1. **Create live products/prices** mirroring the sandbox:
   - **Premium** — recurring **CHF 9 / month**.
   - **Lifetime** — one-time **CHF 149**.
2. **Create the live webhook** at `/api/billing/webhook` subscribed to the same
   five events; copy its signing secret to `STRIPE_WEBHOOK_SECRET` (live).
3. **Set the live price-id → plan mapping via env** (no code change):
   ```bash
   npx wrangler secret put STRIPE_PREMIUM_PRICE_ID  --name wedding-planner-api   # live premium price id
   npx wrangler secret put STRIPE_LIFETIME_PRICE_ID --name wedding-planner-api   # live lifetime price id
   ```
   `_price_plan_map()` resolves these first; an unknown price id maps to `None`
   and is **never guessed**. Lifetime is **never** downgraded by a
   `subscription.deleted`/`updated`/`payment_failed` event.
4. Set `STRIPE_SECRET_KEY` to the live key and redeploy.

---

## Observability, health & cost backstop

### Structured logs — `wrangler tail`

The worker emits one **compact JSON line per notable event** to the console
(`observability.enabled` is on in `wrangler.jsonc`). Lines carry only ids, types,
counts, and statuses — **never** prompt text, couple PII, or secrets. Stream them:

```bash
# all events, human format
npx wrangler tail wedding-planner-api --format pretty

# JSON, filtered to a specific event with jq
npx wrangler tail wedding-planner-api --format json \
  | jq 'select(.event=="wedi_generation")'
```

Events you can filter on (the `event` field):

| `event` | Fields | When |
|---------|--------|------|
| `stripe_webhook` | `event_id`, `type`, `duplicate?` | every webhook delivery processed (incl. dedup hits) |
| `plan_transition` | `wedding_id`, `to_plan`, `reason` | every plan write (checkout / subscription / downgrade) |
| `wedi_generation` | `wedding_id`, `status`, `mode`, `input_tokens?`, `output_tokens?` | each generation — `ok` / `paused` / `rate_limited` / `over_limit` / `error` |
| `public_site_404` | `slug`, `host`, `reason` | a `/s/{slug}` miss (no site / no snapshot) |

### Health check & version

```bash
curl -s https://wedding-planner-api.<subdomain>.workers.dev/api/health
# → {"status":"ok","version":"<git-sha>"}
```

`version` is the commit sha, injected at deploy time as the `GIT_SHA` Worker var
by the deploy workflow (`uv run pywrangler deploy --var GIT_SHA:${{ github.sha }}`).
Off-platform it reports `"dev"`. The deploy workflow's smoke step asserts
`"status":"ok"`.

### Anthropic spend cap (financial backstop)

The app already caps Wedi cost in several layers (monthly generation + token
budgets, per-minute velocity, a 4000-token/request ceiling, and the
`WEDI_GENERATION_DISABLED` kill switch). As a final backstop **set a monthly spend
limit in the Anthropic Console** (Billing → usage limits) on the key used for
`ANTHROPIC_API_KEY`, so a logic error or abuse spike can never exceed a hard
dollar ceiling regardless of the app-level controls.

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

## CORS model

- **Credentialed routes** (everything authenticated) use a strict, explicit
  allow-list: the built-in origins in `main.py` plus any `CORS_EXTRA_ORIGINS`
  (comma-separated). Never `*`, always `allow-credentials: true`. To add a new
  frontend origin, set `CORS_EXTRA_ORIGINS` rather than editing code:
  ```bash
  npx wrangler secret put CORS_EXTRA_ORIGINS --name wedding-planner-api   # https://app.example.com,https://...
  ```
- **The one public endpoint** `POST /api/public/rsvp/{slug}` (and its OPTIONS
  preflight) is served `Access-Control-Allow-Origin: *` with **no** credentials,
  because the rendered couple site POSTs to it cross-origin from the `/s/` origin.
  This is scoped to that path only (`public_cors.py` + the worker fetch) and never
  widens CORS on any authenticated route.

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

## Schema migrations

See **"Migrations — run order 003 → 004 → 005"** at the top of this guide. Fresh
databases get everything from `schema.sql` (idempotent — `CREATE TABLE IF NOT
EXISTS`); existing databases apply the ordered `--remote` migrations. The deploy
workflow does **not** run migrations.
