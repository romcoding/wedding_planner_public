# Audit follow-ups

Tracked deferrals surfaced during security/launch audits. Each item names the
trigger, the gap, and the concrete remediation so it can be picked up later
without re-deriving context. See `AUDIT.md` for the full go-live audit.

## Account / wedding deletion must cascade the website tables (P4)

**Status:** open — there is no account- or wedding-deletion flow in the product
today, so nothing currently orphans these rows. This is a forward requirement
for whenever a delete flow ships.

**Gap:** the public-hosting feature (P4) added tables keyed by `wedding_id`
(TEXT) that are NOT reachable from any existing cleanup path. If/when a
wedding or account can be deleted, deleting only `weddings`/`guests` would leave
orphaned site content, published snapshots, guest RSVP submissions (PII), and
the Wedi usage/audit ledgers behind.

**Remediation — a wedding deletion MUST cascade-delete, in this order
(children first; all are `wedding_id`-scoped except `site_revisions`, which is
`site_id`-scoped):**

1. `site_revisions`        — via the wedding's `wedding_sites.id` (site_id).
2. `site_rsvp_responses`   — `WHERE wedding_id = ?` (contains guest PII; must go).
3. `wedding_sites`         — `WHERE wedding_id = ?` (one row per wedding).
4. `wedi_site_usage`       — `WHERE wedding_id = ?` (monthly usage ledger).
5. `wedi_generation_log`   — `WHERE wedding_id = ?` (generation audit rows).

These tables use plain `wedding_id` columns without `ON DELETE CASCADE` (D1 /
SQLite foreign keys are not enforced by default in this codebase), so the delete
flow must remove them explicitly — do not rely on the database to cascade.

**Also purge edge cache on delete:** call
`services.site_cache.purge_site_cache(slug)` for the wedding's site slug as part
of deletion, so a deleted site stops serving from the Workers cache immediately
(same hook used by unpublish/downgrade).

## Brand sweep: user-facing "AI" remains on the legacy assistant surface (P5)

**Status:** open — deliberately deferred during the P5 go-live pass (scope:
"new surface only; flag the rest"). The NEW Wedi / website-builder / public-RSVP
surface is already brand-clean (no "AI"/"LLM"/"chatbot"/"token"/"quota"; it uses
"Wedi" and "design limit").

**Gap:** the pre-existing AI-assistant feature still shows user-facing **"AI"**:

- `wedding-planner-frontend/src/components/AIPanel.jsx` — "AI request failed",
  "Apply AI output", "unlock all AI features" (panel still mounted in
  `layouts/AdminLayout.jsx`).
- `wedding-planner-frontend/src/components/UpgradeModal.jsx` — "3 AI uses/day",
  "Unlimited AI".
- `wedding-planner-frontend/src/pages/admin/BillingPage.jsx` — "AI features",
  "Full AI planning assistant".
- `wedding-planner-frontend/src/pages/admin/VenuesPage.jsx` — "AI Search",
  "AI venue search failed".
- `wedding-planner-frontend/src/pages/admin/ImagesPage.jsx` — "Generate site
  content (AI)", "AI draft generated", etc.

No user-facing "LLM"/"chatbot"/"quota" remain (only code comments). "token"
appears only in legitimate non-LLM contexts (auth/invitation tokens) and internal
ledger/field names.

**Remediation:** when the brand sweep is taken up, replace these labels with the
agreed wording (neutral "Smart"/"assistant", or fold them under "Wedi"), refresh
any affected vitest snapshots, and re-run the final grep so the user-facing
surface is clean of "AI"/"LLM"/"chatbot"/"token"/"quota".
