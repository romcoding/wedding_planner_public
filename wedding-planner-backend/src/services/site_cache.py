"""Published-site cache invalidation for the public ``GET /s/{slug}`` renderer.

The public renderer (P4) caches password-less published sites at the edge via the
Workers Cache API (``caches.default``), keyed on the canonical site URL. Whenever
a site's published HTML can change — publish, unpublish, slug change, or a
premium->free downgrade — the cached entry for the affected slug(s) must be
deleted so guests never see a stale page.

``purge_site_cache(slug)`` deletes that entry. It is slug-scoped and async so the
existing call sites (website_routes publish/unpublish/settings, the billing
downgrade hook) don't change. Off-platform (pytest) or when PUBLIC_SITE_BASE_URL
is unconfigured, it is a safe no-op.
"""
import logging
import os

logger = logging.getLogger(__name__)


def cache_key_url(slug: str) -> str | None:
    """The canonical Cache API key for *slug* (``{PUBLIC_SITE_BASE_URL}/s/{slug}``).

    Returns None when the base origin isn't configured — manual caching and its
    purge are both keyed off this, so they stay symmetric: if there's no base
    there's nothing cached to purge.
    """
    base = (os.environ.get("PUBLIC_SITE_BASE_URL") or "").rstrip("/")
    if not base or not slug:
        return None
    return f"{base}/s/{slug}"


def _default_cache():
    """Return ``caches.default`` on the Workers runtime, or None off-platform."""
    try:  # Cloudflare Workers / Pyodide only
        from js import caches
        return caches.default
    except Exception:
        return None


async def purge_site_cache(slug: str) -> None:
    """Delete the cached HTML for *slug* from ``caches.default``.

    No-op (logged) off-platform or when PUBLIC_SITE_BASE_URL is unset. Never
    raises — a cache miss/error must not break publish/unpublish/downgrade.
    """
    if not slug:
        return None
    key = cache_key_url(slug)
    cache = _default_cache()
    if cache is None or not key:
        logger.debug("purge_site_cache(%s): no-op (off-platform or no base URL)", slug)
        return None
    try:
        await cache.delete(key)
        logger.info("purge_site_cache: purged %s", key)
    except Exception as exc:  # never fail a lifecycle action on a cache error
        logger.warning("purge_site_cache(%s) failed: %s", slug, exc)
    return None
