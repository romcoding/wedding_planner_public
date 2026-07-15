# Audit follow-ups

Tracked deferrals surfaced during security/launch audits. Each item names the
trigger, the gap, and the concrete remediation so it can be picked up later
without re-deriving context. See `AUDIT.md` for the full go-live audit.

## Seating chart has no way to list unassigned guest "members" (P5)

**Status:** open — found while fixing `SeatingChartPage.jsx`'s dead API calls
(part of the larger dead-API-call sweep). Not fixed here; needs backend work,
not a wiring fix.

**Gap:** the "Unassigned People" panel called `GET /seating/guests/unassigned`,
which doesn't exist. Fixing it isn't a simple rewiring like the invitation
"Resend" button was — each rendered "person" needs a synthetic member id
(`person-{id}`), a `guest_id`, an optional `attendee_name`, and a
`display_name`, meaning the intended endpoint enumerates one seatable member
per guest **plus** each of their named plus-ones (`guests.invitee_names`,
already a JSON column), then subtracts whoever's already in
`seat_assignments` (matched by `guest_id` + `attendee_name`). That logic
doesn't exist anywhere server-side today.

Also fixed in the same pass: `assignGuest` was POSTing to a flat
`/seating/assignments` that doesn't exist — repointed to the real
`POST /seating/tables/{table_id}/assign` (every call site already had
`table_id` in its payload, so this restores "move a guest between seats"
even though "drag from Unassigned" still can't populate its source list).
`unassignGuest` was already correct. "Auto-assign" was removed (no backend
equivalent, and was already permanently disabled in practice since it
required a non-empty unassigned-guests list that never populated). CSV
export was rewritten to generate client-side from the already-loaded table/
assignment data instead of calling a nonexistent `GET /seating/export.csv`.

**Remediation:** add a `GET /seating/guests/unassigned` route that expands
guests × invitee_names into member rows and filters out anyone present in
`seat_assignments`, matching the shape `assignGuest`/`GuestCard` already
expect (`id`, `guest_id`, `attendee_name`, `display_name`).

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

**Status:** partially done. `AIPanel.jsx` and `BillingPage.jsx` — both backed by
real, working `/ai/*` routes — are now Wedi-branded ("Wedi couldn't complete
that — please try again.", "unlock Wedi's planning tools", "Full Wedi planning
assistant"). `UpgradeModal.jsx`'s claimed "AI" strings were already gone (stale
note in a prior pass of this doc — no change needed).

**Two dead AI features found while doing this sweep — removed, not renamed
(decision: remove rather than build, matching the "Webpage Builder" precedent
below):**

- `wedding-planner-frontend/src/pages/admin/VenuesPage.jsx`'s "AI Venue
  Assistant" ("AI Search" box) posted to `/venues/search-ai`, which **did not
  exist** anywhere in `wedding-planner-backend/src/routes/venue_routes.py` —
  it 404'd unconditionally for every user, always had. Removed: the
  `searchVenuesAI` mutation, the `aiSearchQuery`/`aiResults` state, and the
  "AI Venue Assistant" panel.
- `wedding-planner-frontend/src/pages/admin/ImagesPage.jsx`'s "Generate site
  content (AI)" button posted to `/events/guest-portal-ai-draft`, which also
  **did not exist** anywhere in the backend — same unconditional 404.
  Removed: the `generateGuestPortalDraft` mutation and its button (the
  legitimate "Save guest portal items" button next to it is untouched).

**Also found, NOT removed (bigger, separate scope):** `VenuesPage.jsx`'s
"Scrape Venue from URL" tool (and its "Use AI (ChatGPT)" checkbox) posts to
`/venues/scrape`, which **also does not exist** in the backend — same
unconditional 404. Left alone because `scrapingUrl`/`isScraping`/`useLLM`/
`scrapeVenue` are threaded into `VenueSetupWizard.jsx` too (a separate
multi-step wizard component, which already has a `skipScrape` manual-entry
path, suggesting removal is viable but needs its own pass rather than being
folded into this cleanup).

No user-facing "LLM"/"chatbot"/"quota" remain (only code comments). "token"
appears only in legitimate non-LLM contexts (auth/invitation tokens) and internal
ledger/field names.

## Legacy "Webpage Builder" ("Clawed Bot") removed (go-live QA)

**Status:** done. Two website builders shipped side by side: the legacy
"Webpage Builder" (off-brand "Clawed Bot" copy, a user-facing "Tokens used"
counter, and an empty page) and the P2 "Wedding Website" structured-block
builder. The legacy surface was dead/confusing and leaked an off-brand assistant
name, so it was removed: its sidebar entry, its `/admin/webpage` route, the
`pages/admin/WebpageBuilderPage.jsx` component, and the orphaned
`assets/tutorials/webpage-builder.json` tour. "Wedding Website"
(`/admin/website`, premium-gated, server-enforced via
`require_feature("website_builder")`) is now the single website surface.

**Backend:** nothing was exclusive to the legacy builder, so no backend route was
removed. `/api/events/guest-portal-settings` is shared with `ImagesPage` and is
retained. The legacy page also POSTed to `/api/ai/webpage-command`, which has
**no** server-side route (it was already a dead call), so there was nothing to
delete there.

This closes the "Clawed Bot" off-brand name leak and its "Tokens used" string
noted in the brand sweep above.
