# Manual QA — pre-launch checklist

Runtime-dependent end-to-end flows that the automated suite can't cover (Stripe
checkout, real email, the browser, edge cache). Run these **against the preview
deploy** before tagging `v1.0.0-golive`. Tick every box.

**You need:** the preview backend URL `API` (e.g.
`https://wedding-planner-api.<sub>.workers.dev`) and frontend URL `APP`; Stripe in
**test mode** with a **test clock**; the test card `4242 4242 4242 4242`; a mailbox
you can read (or the Resend dashboard); a terminal for the direct-API checks.

Brand check while you click: nowhere in the **new** website/Wedi/RSVP surface
should the words "AI", "LLM", "chatbot", "token", or "quota" appear (it's "Wedi" /
"design limit"). The legacy assistant panel still says "AI" — that's the tracked
follow-up, out of scope here.

---

## Scenario A — free → premium → build → publish → RSVP → cancel → republish

### A1. Free signup + email verification
- [ ] Open `APP/auth?tab=register`, enter partner names, a **real** email, a strong
      password, submit → see "check your email" (no auto-login).
- [ ] Try `APP/auth?tab=login` with the new account → login **blocked** with a
      "verify your email" message (HTTP 403).
- [ ] Open the verification email → click the link → lands on `APP/verify-email`
      → "email verified". Now log in → land on `/admin`.

### A2. Use the free features
- [ ] `/admin/guests` — add a couple of guests; they save and list.
- [ ] `/admin/tasks` — add a task; it saves.
- [ ] `/admin/costs` — add a basic budget line; it saves.
      *(Seating, invitations, the website builder, etc. are premium — next step.)*

### A3. Hit the website paywall (UI **and** API)
- [ ] Sidebar → **Website** (`/admin/website`) → a **paywall** appears (not the
      builder). The locked sidebar items show a lock badge.
- [ ] Direct API call is **also** blocked (paywall isn't just client-side). With
      the free account's bearer token:
      ```bash
      curl -i -H "Authorization: Bearer <FREE_JWT>" "$API/api/website/site"
      ```
      → **HTTP 403** with body `{"code":"upgrade_required","feature":"website_builder"}`.

### A4. Upgrade via Stripe checkout (Premium, CHF 9/mo)
- [ ] `/admin/billing` → choose **Premium** → Stripe Checkout opens for **CHF 9/mo**
      (confirm the amount + the premium price id).
- [ ] Pay with `4242 4242 4242 4242` (any future expiry/CVC) → redirected back with
      success.
- [ ] Within a few seconds the plan flips to **premium** (sidebar badge; or
      `GET $API/api/billing/status`). In `wrangler tail`: a `stripe_webhook`
      (`checkout.session.completed`) line **and** a `plan_transition`
      (`to_plan:"premium"`) line.

### A5. Build the site + let Wedi draft
- [ ] `/admin/website` now opens the **builder** (no paywall).
- [ ] Set a slug; the field shows the `/s/` prefix and the live `/s/{slug}` URL.
- [ ] **"Let Wedi draft it"** → describe the day in a sentence → a draft of blocks
      appears in the editor (drafts only; nothing is published yet).
- [ ] `wrangler tail`: a `wedi_generation` line with `status:"ok"` and
      `input_tokens`/`output_tokens` — and **no** prompt text or names in any log.

### A6. Publish
- [ ] Click **Publish** in the publish bar → status becomes **Published**; the
      `/s/{slug}` link is shown.

### A7. Logged-out guest opens `/s/{slug}` and RSVPs
- [ ] Open `API_or_PUBLIC_SITE_BASE_URL/s/{slug}` in an **incognito** window (no
      cookies/session) → the published site renders (server-rendered HTML, the
      "Made with Wedi" footer, the RSVP form).
- [ ] Open **DevTools → Network**, submit the RSVP form. Confirm:
  - [ ] an `OPTIONS` preflight to `/api/public/rsvp/{slug}` → **204** with
        `access-control-allow-origin: *` and **no** `allow-credentials`;
  - [ ] the `POST` → **200**, a thank-you message;
  - [ ] **no CORS error** in the Console.
- [ ] (Honeypot sanity, optional) a bot filling the hidden `website` field still
      gets a 200 but writes no row.

### A8. Response shows in the inbox + add to guest list
- [ ] Back in the admin: `/admin/website` → **Responses** tab → the new RSVP is
      listed with name/attending/party size.
- [ ] Click **Add to guest list** → the responder appears in `/admin/guests`.

### A9. Cancel the subscription (Stripe test clock)
- [ ] In Stripe (test) advance the **test clock** past the period / cancel the
      subscription so `customer.subscription.deleted` fires.
- [ ] Plan flips to **free** (`GET $API/api/billing/status`); `wrangler tail` shows
      `plan_transition` `to_plan:"free"`.
- [ ] `GET $API/s/{slug}` (or reload incognito) → **404** friendly page
      (`Cache-Control: no-store`); the edge cache was purged (no stale 200).
- [ ] `wrangler tail`: a `public_site_404` line for the slug.

### A10. Re-subscribe + one-click Republish
- [ ] `/admin/billing` → Premium checkout again → plan back to **premium**.
- [ ] `/admin/website` → the **Republish** affordance restores the site from its
      last snapshot in one click → `/s/{slug}` serves **200** again.

---

## Scenario B — lifetime is never downgraded

- [ ] Fresh (or reset) account → `/admin/billing` → **Lifetime** → Stripe Checkout
      shows a **one-time CHF 149** charge → pay.
- [ ] Plan flips to **lifetime** (`plan_transition` `to_plan:"lifetime"`).
- [ ] In Stripe (test) fire/advance a `customer.subscription.deleted` for that
      customer (or use a test clock) →
  - [ ] plan stays **lifetime** (UNCHANGED);
  - [ ] `/s/{slug}` still serves **200** (no unpublish);
  - [ ] `wrangler tail` shows the webhook processed but **no** downgrade
        `plan_transition`.

---

## Cross-cutting launch checks

- [ ] **CORS on RSVP** — verified in A7 (preflight `*`, no credentials, no console
      error). On any **authenticated** XHR (e.g. loading `/admin/guests`), the
      response reflects the specific app origin with `allow-credentials: true` —
      **never** `*`.
- [ ] **Incognito `/s/{slug}` load** — verified in A7 (renders with no session).
- [ ] **OG link-preview** — paste the `/s/{slug}` URL into a chat/social composer
      (e.g. Slack/WhatsApp/Twitter) → a link-preview card renders with the couple's
      title/description (the `og:` tags, `og:url` = `PUBLIC_SITE_BASE_URL/s/{slug}`).
- [ ] **Lighthouse (mobile) ≥ 90** — Chrome DevTools → Lighthouse → Mobile →
      Performance on a published `/s/{slug}`: **Performance ≥ 90** (and ideally
      Best-Practices/SEO ≥ 90).
- [ ] **Health** — `curl $API/api/health` → `{"status":"ok","version":"<git-sha>"}`
      with the sha of the deployed commit.
- [ ] **500s are generic** — no error response anywhere leaks a traceback; bodies
      are `{"code","detail"}`.

---

> When every box is ticked on the preview deploy, promote/deploy to production and
> tag `v1.0.0-golive`.
