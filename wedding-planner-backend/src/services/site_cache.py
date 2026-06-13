"""Published-site cache invalidation — a documented NO-OP placeholder for now.

When the public website renderer ships (product phase P4: ``GET /w/{slug}``
served from the edge), publishing a site or changing its slug must invalidate
any cached HTML for the affected slug(s). Until that renderer exists there is
nothing to purge, so this is an intentional, explicit no-op.

The publish / unpublish / slug-change paths already call this seam, so P4 only
has to fill in the body (e.g. delete the relevant Cache API / KV entries)
without touching the call sites. It is async for exactly that reason.
"""
import logging

logger = logging.getLogger(__name__)


async def purge_site_cache(slug: str) -> None:
    """Invalidate cached HTML for *slug*.

    NO-OP until the P4 public renderer ships. Kept async + slug-scoped so the
    real implementation can drop in without changing any caller.
    """
    if not slug:
        return None
    logger.debug("purge_site_cache(%s): no-op (public renderer not yet live)", slug)
    return None
