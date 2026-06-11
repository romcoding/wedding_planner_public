# Wedding Planner — Go-Live Hardening Audit

**Scope:** `wedding-planner-backend/` (FastAPI on Cloudflare Python Workers / Pyodide, D1, pyjwt, PBKDF2, Resend, Stripe) and `wedding-planner-frontend/` (React 19 + Vite).
**Date:** 2026-06-11
**Type:** Read-only audit. No source files were modified — this report (`AUDIT.md`) is the only change.

### How to read this report
Each finding has a severity, a `file:line` reference, and a one-line fix. Severities:
- **[CRITICAL]** — exploitable now, cross-tenant data loss/takeover or auth bypass. Block launch.
- **[HIGH]** — serious data exposure / revenue loss / abuse. Fix before launch.
- **[MEDIUM]** — real weakness, constrained exploitability or correctness/robustness risk.
- **[LOW]** — hardening / hygiene.

### The single most important root cause
There is **no platform-admin vs. tenant-owner distinction**. Every couple is created with `role = 'admin'` (`auth_routes.py:296,332`), and the only "admin" gate, `require_admin_auth` (`auth.py:53`), merely rejects tokens whose `sub` starts with `guest_`. `ADMIN_EMAILS` is used *only* for plan override in `middleware._effective_plan` (`middleware.py:32`), never for authorization. Consequently, every route that relies on `require_admin_auth` **without an additional `wedding_id` scope** is callable by any logged-in couple against **all tenants' data**. This single fact drives the Phase 1 CRITICALs (F1–F5).

---

## PHASE 1 — Tenant Isolation

### 1.1 Tenant dependency model (`middleware.py`)
- **`get_wedding`** (`middleware.py:68`) is the *de-facto* tenant resolver: it reads `wedding_id` from the JWT, falls back to `users.current_wedding_id`, then to first owned wedding, and returns the wedding row (with plan + admin-override applied). This is the **correct, consistently-used** dependency for tenant routes. ✔
- **`get_current_user`** (`middleware.py:51`) and **`get_wedding_db`** (`middleware.py:63`) are an **abandoned parallel pattern — defined but referenced by no route** (verified). `get_wedding_db` would have trusted the JWT `wedding_id` with no `is_active`/ownership recheck. Dead code that invites future misuse.
- There **is** a single canonical `get_current_wedding`-style dependency (`get_wedding`); the problem is not its absence but that several routes use the weaker `require_admin_auth` *instead of* it (F1–F5).

> **F1.0 [MEDIUM]** `middleware.py:51,63` — Remove the unused `get_current_user`/`get_wedding_db` dependencies (or finish + standardize on one). They are a latent inconsistent-enforcement footgun.

### 1.2 Per-route inventory
Legend — **Tenant src:** how `wedding_id`/`user_id` is derived. **Scoped?** does every wedding-scoped query carry a `wedding_id`/owner predicate.

| Route module | Key endpoints | Tenant src | Scoped? | Flag |
|---|---|---|---|---|
| `auth_routes.py` | login, couple/register, verify-email, resend-verification, forgot/reset-password, profile | JWT `sub` (self) / public | self-only | OK (see F16–F18) |
| `guest_auth_routes.py` | GET /profile | guest JWT `sub` (own guest) | self-only | OK |
| `wedding_routes.py` | create, GET/PUT /current, GET /by-slug/{slug} | `get_wedding` / owner_id / public slug | ✅ | OK |
| `guest_routes.py` | CRUD, export/import, token/{token}, update-rsvp | `get_wedding`; by-id queries include `AND wedding_id` | ✅ | OK (CSV→F19) |
| `task_routes.py` | GET/POST/PUT/DELETE | `get_wedding`; by-id `AND wedding_id` | ✅ | OK |
| `cost_routes.py` | CRUD, /analytics | `get_wedding`; by-id `AND wedding_id` | ✅ | OK (no full_budget gate → F11) |
| `agenda_routes.py` | CRUD | `get_wedding`; by-id `AND wedding_id` | ✅ | OK |
| `gift_registry_routes.py` | CRUD | `get_wedding`; by-id `AND wedding_id` | ✅ | OK |
| `rsvp_reminder_routes.py` | list/create/delete | `get_wedding`; by-id `AND wedding_id` | ✅ | OK |
| `invitation_routes.py` | list/create/send, templates, track/open | `get_wedding`; verifies guest∈wedding & inv∈wedding | ✅ | OK (no plan gate → F11) |
| `seating_routes.py` | tables CRUD, assign, remove | `get_wedding`; table verified ∈ wedding | ⚠️ | **F7**: `assign` trusts `guest_id` |
| `message_routes.py` | list/create/read | `get_wedding`; mutations scoped | ⚠️ | **F8**: `create` trusts `guest_id` |
| `guest_photo_routes.py` | list/upload/approve/delete | `get_wedding`; upload uses JWT `wedding_id` | ⚠️ | **F9**: admin upload trusts `guest_id` |
| `analytics_routes.py` | /overview, /track (public), /security | `get_wedding`; **/security unscoped** | ⚠️ | **F5** on /security |
| `ai_routes.py` | /usage, /timeline, /vendor, /copy, /seating | `get_wedding` + `_ai_gate` | ✅ | OK (gated) |
| `venue_routes.py` | list/get (public), requests, offers, chat | `get_wedding` for tenant rows | ⚠️ | **F12**: AI chat ungated/unscoped-cost |
| `moodboard_routes.py` | list/create/get/save/delete | `payload.sub`; **get/save/delete unscoped** | ❌ | **F6** (IDOR) |
| `onboarding_routes.py` | status, complete, quick-setup | `payload.sub` + `get_wedding` | ✅ | OK |
| `subscription_routes.py` | /status, /token-usage | JWT `sub` (self) | ✅ | OK |
| `billing_routes.py` | checkout, webhook, portal, status | `get_wedding`; webhook by signature | ✅ | OK (events → F13) |
| `stripe_routes.py` | checkout, status, webhook | `get_wedding`; webhook by signature | ✅ | OK (events → F13/F14) |
| `event_routes.py` | list/create/update/delete | `require_admin_auth` only — **no wedding scope** | ❌ | **F2** (CRITICAL) |
| `user_routes.py` | list/get/update users | `require_admin_auth` only — **no scope** | ❌ | **F1** (CRITICAL) |
| `content_routes.py` | get/create/update/delete (global CMS) | `require_admin_auth` only | ❌ | **F3** (any couple edits public site) |
| `image_routes.py` | list/create/delete | `require_admin_auth` only — **no scope** | ❌ | **F4** |
| `demo_routes.py` | /overview | none (hardcoded, no DB) | n/a | OK |

### 1.3 Findings

> **F1 [CRITICAL]** `user_routes.py:8,21,37` — `GET /api/users`, `GET /api/users/{id}`, `PUT /api/users/{id}` are gated only by `require_admin_auth`. Any authenticated couple can **enumerate every user's email/PII**, read any account, and **update any user's `email`, `role`, or `is_active`** — i.e. cross-tenant account takeover and lock-out. **Fix:** restrict to a real platform-admin (e.g. `ADMIN_EMAILS` check) or remove these endpoints; never allow editing arbitrary `user_id`.

> **F2 [CRITICAL]** `event_routes.py:20,58,91` (and `:32`) — `list_events` runs `SELECT * FROM events` with **no `wedding_id` filter** (returns all tenants' events); `update_event`/`delete_event` match `WHERE id = ?` only. Any couple can read/modify/delete **any** wedding's timeline. `create_event` doesn't even set `wedding_id`. **Fix:** derive wedding via `get_wedding` and add `AND wedding_id = ?` to every query (mirror `onboarding.quick_setup`, which already sets `wedding_id`).

> **F3 [HIGH]** `content_routes.py:64,99,148` — The global CMS (`content` table, rendered on public marketing pages as HTML) is writable/deletable by **any** couple via `require_admin_auth`. Enables site defacement and **stored XSS to all visitors** (see F20). **Fix:** gate writes behind a platform-admin check.

> **F4 [HIGH]** `image_routes.py:20,30,49` — `list_images` returns all tenants' images (the `images.wedding_id` column is ignored), and `delete_image` deletes by `id` with no ownership check. **Fix:** scope by `wedding_id` from `get_wedding`.

> **F5 [HIGH]** `analytics_routes.py:83` — `GET /api/analytics/security` returns the global `security_events` table (other users' IPs, `user_id`s, event details) to any couple. **Fix:** platform-admin only.

> **F6 [HIGH]** `moodboard_routes.py:54,72,102` — `get`/`save`/`delete` moodboard operate on `moodboard_id` with **no `user_id` re-verification** (only `list`/`create` are scoped). IDOR: cross-user read, overwrite (`save_moodboard` deletes+reinserts elements), and delete. **Fix:** add `AND user_id = ?` (or wedding scope) when loading the moodboard.

> **F7 [MEDIUM]** `seating_routes.py:99` — `assign_seat` verifies the *table* belongs to the wedding but trusts `body.guest_id` unverified; `list_tables` (`:31`) then `LEFT JOIN guests` with no wedding scope, leaking a foreign guest's `first_name/last_name`. Exploit gated by guessing a v4 UUID. **Fix:** verify `guest_id ∈ wedding` before insert.

> **F8 [MEDIUM]** `message_routes.py:26` — `create_message` trusts `body.guest_id` unverified; `list_messages` (`:19`) JOIN then surfaces a foreign guest's name. **Fix:** verify `guest_id ∈ wedding`.

> **F9 [LOW]** `guest_photo_routes.py:40` — admin upload path accepts `body.guest_id` without verifying it belongs to the token's wedding. **Fix:** validate `guest_id ∈ wedding`.

---

## PHASE 2 — Billing & Entitlement

### 2.1 How plan gating works today
- **Plan storage:** `weddings.plan` (`free|starter|premium`) + `stripe_customer_id` / `stripe_subscription_id` / `plan_expires_at` (`schema.sql:57`, drift — see F26).
- **Backend gating helpers:** `middleware.py` — `PLAN_LIMITS`, `wedding_meets_plan`, `get_plan_limit`, `require_plan`. **Admin override:** `_effective_plan` (`middleware.py:32`) promotes emails in `ADMIN_EMAILS` to `premium`, surfaced as `is_admin_override`.
- **Where the backend ACTUALLY enforces plan** (exhaustive): `wedding_routes.py:158` (custom slug → starter) and `ai_routes.py` `_ai_gate` (AI endpoints → starter + daily cap). **That is the entire list.** `require_plan` is defined but used by **zero** routes.
- **Frontend gating:** `lib/planFeatures.js` `FEATURE_MIN_PLAN` + `hasFeature`, sidebar lock icons in `layouts/AdminLayout.jsx:165`, paywall cards in `components/PlanGate.jsx` / `FeaturePaywall.jsx`, plan read in `hooks/usePlan.js`. **All client-side only**, and locked sidebar links remain clickable (`AdminLayout.jsx:170` always sets `to`).
- **Stripe webhook:** `/api/billing/webhook` (`billing_routes.py:250`) and a second `/api/stripe/webhook` (`stripe_routes.py:207`). Plan is written by `_handle_checkout_completed` / `_handle_subscription_updated` / `_handle_subscription_deleted`.
- **Webhook events handled:**
  - `billing_routes`: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. ❌ **not** `invoice.payment_failed`.
  - `stripe_routes`: `checkout.session.completed`, `customer.subscription.deleted` only. ❌ **not** `customer.subscription.updated`, ❌ **not** `invoice.payment_failed`.

### 2.2 Webhook signature validation — ✔ VERIFIED
`/api/billing/webhook` (`billing_routes.py:264`) and `/api/stripe/webhook` (`stripe_routes.py:217`) both compute HMAC-SHA256 over `{t}.{payload}`, enforce a 300s timestamp tolerance, and use `hmac.compare_digest` (`billing_routes.py:95`, `stripe_routes.py:54`). Missing `STRIPE_WEBHOOK_SECRET` → 503. **No finding** — this is correct. (Phase 2 #6 satisfied.)

### 2.3 Findings

> **F11 [CRITICAL]** Paywall is **frontend-only for ~11 of 13 gated feature areas** — every premium/starter endpoint below is fully callable by a `free` account holding a valid JWT (no backend plan check):
> - invitations `invitation_routes.py` · events `event_routes.py` · moodboard `moodboard_routes.py` · guest photos `guest_photo_routes.py` · agenda `agenda_routes.py` · seating `seating_routes.py` · messages `message_routes.py` · gift registry `gift_registry_routes.py` · venue + venue AI chat `venue_routes.py` · rsvp reminders `rsvp_reminder_routes.py` · full budget `cost_routes.py`.
> Compare `lib/planFeatures.js:9-22` (claims these need starter/premium) vs. the route files (no gate). **Fix:** add a `require_plan(...)` dependency to each premium route matching `FEATURE_MIN_PLAN`.

> **F12 [HIGH]** `venue_routes.py:70-127` — `POST /api/venues/{id}/chat` calls Claude (`call_claude`) with **no plan gate and no usage cap/rate limit**, bypassing the `_ai_gate` paywall in `ai_routes`. Free accounts get unlimited LLM calls → direct cost/abuse. **Fix:** route venue chat through `_ai_gate` (plan + daily cap).

> **F13 [MEDIUM]** `billing_routes.py:283-290`, `stripe_routes.py:236-241` — **`invoice.payment_failed` is handled nowhere**, so a past-due/failed-renewal subscription is never downgraded and no dunning occurs. `stripe_routes` additionally ignores `customer.subscription.updated` (plan changes/cancellations-at-period-end won't sync). **Fix:** handle `invoice.payment_failed` (mark past_due / downgrade) and `customer.subscription.updated` in the canonical handler.

> **F14 [MEDIUM]** `billing_routes.py` + `stripe_routes.py` — **two divergent billing surfaces and two webhook endpoints** are both wired in `main.py:131,150`. They disagree (billing maps plan from `price_id` and handles `subscription.updated`; stripe hardcodes `'premium'` and ignores it). Drift risk + double-processing. **Fix:** consolidate to one webhook + one plan-sync code path.

> **F15 [MEDIUM]** `stripe_routes.py:88-95` / `schema.sql` — Webhook idempotency relies on the `stripe_events` table, which is **absent from `schema.sql`** (only in `migration_v2.sql`). `_seen_event` swallows the missing-table error and returns `False`, so if the migration wasn't applied, **idempotency silently disables** → duplicate event processing (double "welcome to premium" emails, repeated plan writes). **Fix:** fold `migration_v2.sql` into `schema.sql`; fail loudly if the table is missing.

---

## PHASE 3 — Security & Robustness

### 3.1 JWT
- **Algorithm pinning — ✔** `auth.py:25` decodes with `algorithms=["HS256"]`; `"none"` and asymmetric-confusion are rejected.
- **Expiry — ✔** `exp` set on every token (`auth.py:19,33`); `ExpiredSignatureError` handled (`auth.py:47`).

> **F16 [CRITICAL]** `auth.py:11` — `_get_secret()` falls back to the hard-coded literal `"dev-secret-change-in-production"` when `JWT_SECRET_KEY` is unset. If the Worker secret is ever missing/misconfigured (and `main.py:52` only mirrors it when present), **all tokens are signed/verified with a publicly known secret → trivial token forgery and full auth bypass** (forge any `sub`/`wedding_id`/`role`). **Fix:** raise on startup if `JWT_SECRET_KEY` is absent; never ship a default secret.

### 3.2 Rate limiting

> **F17 [HIGH]** `auth_routes.py:64-85` — The rate limiter is an **in-process dict (`_rate_buckets`)**. On Cloudflare Workers, isolates are ephemeral and numerous, so counters are not shared or durable — limits on login/register/forgot-password/resend reset per isolate and are **trivially bypassable**. **Fix:** back the limiter with D1, KV, or a Durable Object (or Cloudflare WAF rate rules).

> **F18 [MEDIUM]** No throttle at all on `reset-password` (`auth_routes.py:478`), `verify-email` (`auth_routes.py:346`), venue AI chat (`venue_routes.py:70`), or the public analytics ingest (`analytics_routes.py:17`). Reset/verify tokens are high-entropy (mitigating brute force), but combined with F17 there is effectively no abuse protection on sensitive/expensive endpoints. **Fix:** add durable per-IP + per-account limits; treat future AI endpoints as rate-limited by default.

### 3.3 Input validation

> **F19 [MEDIUM]** `guest_routes.py:286-328` — `export_guests_csv` writes guest-controlled fields (`first_name`, `notes`, `music_wish`, `special_requests`, names) straight into CSV cells with no neutralization of leading `= + - @`, enabling **CSV/formula injection** when the export is opened in Excel/Sheets. **Fix:** prefix risky cells with `'` or strip leading formula characters.

> **F20 [MEDIUM]** `content_routes.py` (global CMS) and `onboarding_routes.py` `quick_setup` (`wedding_content.message`, couple/partner names) store HTML/text with **no sanitization**; these render on public guest pages. Combined with F3 (any couple can write global content), this is **stored XSS to all visitors**. Outbound emails (`email_service.py`) likewise interpolate names/templates into HTML unescaped (lower risk: couple-controlled, transactional). **Fix:** sanitize/escape on render (or store sanitized); restrict global content writes (F3).

> **F21 [LOW]** `analytics_routes.py:17` — `/api/analytics/track` is unauthenticated, unthrottled, and stores attacker-controlled `path`/`referrer`/`user_agent` + client IP unbounded (and never sets `wedding_id`). DB-flooding + values surface in the admin analytics UI. **Fix:** validate/limit; consider auth or a size cap. (Operator precedence bug at `:22` — `... or request.client.host if request.client else None` — also misparses; tidy it.)

### 3.4 CORS — ✔ VERIFIED
`main.py:95-111` uses an **explicit allow-list** (`_allowed_origins` + `CORS_EXTRA_ORIGINS`), never `"*"`, with `allow_credentials=True`; the Worker-level OPTIONS/echo path (`main.py:56-90`) only reflects an origin that is in the allow-list. **No finding.** (Minor: `allow_methods/headers="*"` is acceptable given the explicit origin list.)

### 3.5 Pyodide correctness (D1 row access)
A full grep of `.first()` / `.all()` (`src/routes`, `middleware.py`) shows **every** row access is wrapped — either bare `dict(row)` or a `[dict(r) for r in result.results or []]` comprehension. **No unwrapped `JsProxy` subscript was found.** However:

> **F23 [MEDIUM]** Row conversion is inconsistent and fragile. Only `auth_routes.py:97` and `onboarding_routes.py:22` use the hardened `_row_to_dict()` (which tries `row.to_py()` before `dict(row)`) — the very existence of that helper indicates bare `dict(row)` raised on some D1 return shapes in production. The other 24 route modules rely on bare `dict(row)`, and several call it on a possibly-`None` post-INSERT `SELECT` with no guard (e.g. `task_routes.py:69` `return dict(task)`, `cost_routes.py:76`, `message_routes.py:43`, `seating_routes.py:53`, `image_routes.py:46`). Latent `TypeError` (`JsProxy not subscriptable` / `NoneType not iterable`). **Fix:** export one shared `row_to_dict()` helper and use it everywhere; None-guard post-write selects.

### 3.6 Error handling

> **F22 [LOW]** Internal detail leaks in explicit error responses: `invitation_routes.py:86` `f"Failed to send email: {str(e)}"`, `ai_routes.py:95/124/153/179` `HTTPException(502, str(e))`, `stripe_service.py:80` / `billing_routes.py:64` `f"Stripe API error: {msg}"`. The Worker-level catch (`main.py:73`) returns a generic 500 (good), but these explicit messages still reach clients. **Fix:** log details server-side; return generic messages.

> **F24 [MEDIUM]** `main.py:44-54` mirrors a fixed allow-list of secrets into `os.environ` but **omits `ANTHROPIC_API_KEY`**, while `ai_service.py:11` reads it **at import time** into a module constant. Net effect: the key is empty at runtime, so AI features (and venue chat) fail with `"ANTHROPIC_API_KEY is not configured"`. **Fix:** add `ANTHROPIC_API_KEY` to the mirror list and read it per-call, not at import.

---

## PHASE 4 — Schema & Dead Code

### 4.1 Schema summary (`schema.sql`)
**Tables (29):** users, email_verifications, password_reset_tokens, weddings, guests, tasks, costs, content, wedding_content, ai_usage, events, invitations, invitation_templates, messages, gift_registry, guest_photos, images, venues, venue_requests, venue_offer_categories, venue_offers, venue_documents, venue_chat_history, seating_tables, seat_assignments, rsvp_reminders, reminder_sent, moodboards, moodboard_elements, agenda_items, user_subscriptions, token_usage, page_views, visits, security_events.
**Indexed FKs present (✔):** guests/tasks/costs/ai_usage/events/invitations/messages/gift_registry/guest_photos/images/seating_tables/agenda_items/page_views `wedding_id`; weddings `slug`/`owner_id`/`stripe_customer_id`; guests `token`/`email`; verification/reset `token`+`user`.

> **F25 [MEDIUM]** Missing indexes on foreign keys used in hot queries:
> - `seat_assignments(table_id)` (per-table seat lookup `seating_routes.py:33`), `seat_assignments(wedding_id)`, `seat_assignments(guest_id)`.
> - `venue_chat_history(venue_id, wedding_id)` (queried every chat turn `venue_routes.py:92`), `venue_requests(wedding_id)`, `venue_offer_categories(venue_id)`, `venue_offers(category_id)`, `venue_documents(venue_id)`.
> - `invitation_templates(wedding_id)`, `moodboards(user_id)`, `moodboard_elements(moodboard_id)`, `token_usage(user_id)`, `reminder_sent(reminder_id)`.
> **Fix:** add the above indexes. (Also: `page_views(wedding_id)` is indexed but `/track` never writes `wedding_id`, so the index is dead until tracking is scoped — see F21.)

> **F26 [MEDIUM]** Schema drift — `schema.sql` is **missing** `weddings.plan_expires_at` and the `stripe_events` table; both live only in `migration_v2.sql` and are referenced by billing code (`billing_routes.py:314`, `stripe_routes.py:92`). Several `users` updates are wrapped in `try/except "no such column: email_verified"` (`auth_routes.py:381,515`), implying further drift between `schema.sql` and deployed DBs. **Fix:** make `schema.sql` the single source of truth (fold in `migration_v2.sql`); drop the defensive column-exists `try/except`.

### 4.2 Legacy / dead code (delete in a later cleanup pass)

> **F27 [LOW]** Flask/SQLAlchemy-era files that import `create_app` / `src.models` — **neither exists** in the current FastAPI+D1 app (`Glob src/models* → none`), so these cannot run/import:
> - `conftest.py` (`from src.main import create_app`, `from src.models import db, ...`), `create_admin.py`, `create_guest.py`.
> - `tests/test_saas_upgrade.py` and the other `tests/*` fixtures depend on the Flask `app`/`db` — currently broken.
> - ~24 `migrate_*.py` Python scripts (real D1 migrations are `.sql`), plus `migration_v2.sql` should be merged into `schema.sql` (F26).
> - Deploy leftovers from the pre-Workers stack: `render.yaml`, `runtime.txt`, and likely one of the overlapping `DEPLOY.md` / `DEPLOYMENT.md`.
> Also dead within live code: `middleware.get_current_user`/`get_wedding_db` (F1.0) and `email_service.send_rsvp_notification_email` / `send_guest_confirmation_email` (defined, never called).
> **Fix:** delete in a dedicated cleanup PR after the schema is consolidated.

---

## Fix order — P1 must-fix BEFORE any new features

These are launch-blockers. Fix in this order (auth/secret first, then cross-tenant access, then revenue, then abuse hardening):

1. **F16 [CRITICAL]** `auth.py:11` — remove the hard-coded JWT secret fallback; fail closed if `JWT_SECRET_KEY` is unset. *(Auth bypass — everything else depends on token integrity.)*
2. **F1 [CRITICAL]** `user_routes.py:8,21,37` — lock `/api/users` to a real platform-admin; stop allowing edits to arbitrary `user_id`. *(Account takeover.)*
3. **F2 [CRITICAL]** `event_routes.py:20,32,58,91` — scope all event queries by `wedding_id`.
4. **F3 [HIGH]** `content_routes.py:64,99,148` — restrict global CMS writes to platform-admin (also closes the public-page XSS vector with F20).
5. **F4 [HIGH]** `image_routes.py:20,30,49` — scope images by `wedding_id`.
6. **F5 [HIGH]** `analytics_routes.py:83` — platform-admin only for `security_events`.
7. **F6 [HIGH]** `moodboard_routes.py:54,72,102` — re-verify owner on get/save/delete.
8. **F11 [CRITICAL-revenue]** add backend `require_plan(...)` to every premium route (invitations, events, moodboard, guest photos, agenda, seating, messages, gift registry, venue, rsvp reminders, full budget). *(Paywall is currently frontend-only.)*
9. **F12 [HIGH]** `venue_routes.py:70` — gate venue AI chat through `_ai_gate`. *(Unbounded LLM cost on free tier.)*
10. **F7 / F8 [MEDIUM]** `seating_routes.py:99`, `message_routes.py:26` — validate `guest_id ∈ wedding`.
11. **F17 [HIGH]** `auth_routes.py:64` — move rate limiting to a durable store (in-memory limiter is a no-op on Workers).
12. **F24 [MEDIUM]** `main.py:44` / `ai_service.py:11` — mirror `ANTHROPIC_API_KEY` and read per-call (AI is otherwise non-functional).

**Strongly recommended before launch (same hardening pass):** F13/F15 (webhook `invoice.payment_failed` + idempotency/schema), F19 (CSV injection), F23 (shared row helper), F26 (schema consolidation). **Later cleanup:** F14, F18, F20, F21, F22, F25, F27, F1.0.
