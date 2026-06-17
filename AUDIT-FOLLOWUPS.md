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
