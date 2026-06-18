"""
Wedding Planner API — FastAPI on Cloudflare Python Workers.
"""
import os
from workers import WorkerEntrypoint
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asgi

# Route imports
from routes.auth_routes import router as auth_router
from routes.guest_routes import router as guest_router
from routes.guest_auth_routes import router as guest_auth_router
from routes.wedding_routes import router as wedding_router
from routes.task_routes import router as task_router
from routes.cost_routes import router as cost_router
from routes.content_routes import router as content_router
from routes.analytics_routes import router as analytics_router
from routes.billing_routes import router as billing_router
from routes.ai_routes import router as ai_router
from routes.invitation_routes import router as invitation_router
from routes.event_routes import router as event_router
from routes.message_routes import router as message_router
from routes.gift_registry_routes import router as gift_registry_router
from routes.guest_photo_routes import router as guest_photo_router
from routes.venue_routes import router as venue_router
from routes.seating_routes import router as seating_router
from routes.rsvp_reminder_routes import router as rsvp_reminder_router
from routes.user_routes import router as user_router
from routes.moodboard_routes import router as moodboard_router
from routes.agenda_routes import router as agenda_router
from routes.onboarding_routes import router as onboarding_router
from routes.subscription_routes import router as subscription_router
from routes.image_routes import router as image_router
from routes.demo_routes import router as demo_router
from routes.website_routes import router as website_router
from routes.public_site_routes import router as public_site_router
from routes.geo_routes import router as geo_router

from errors import register_exception_handlers
from public_cors import PublicRsvpCORSMiddleware

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        from js import Response, Headers

        # Mirror Worker bindings into process env so modules using os.environ
        # can access Cloudflare secrets consistently at runtime.
        for key in (
            "JWT_SECRET_KEY", "RESEND_API_KEY", "FROM_EMAIL", "FRONTEND_URL", "CORS_EXTRA_ORIGINS",
            "RESEND_SENDER_DOMAIN",
            "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
            "STRIPE_STARTER_PRICE_ID", "STRIPE_PREMIUM_PRICE_ID",
            "STRIPE_MONTHLY_PRICE_ID", "STRIPE_LIFETIME_PRICE_ID",
            "ADMIN_EMAILS",
            "ANTHROPIC_API_KEY",
            # Public site hosting (P4): the shareable /s/{slug} origin, the
            # optional RSVP-cookie HMAC secret, and the "Made with Wedi" link.
            "PUBLIC_SITE_BASE_URL", "RSVP_COOKIE_SECRET", "WEDI_LANDING_URL",
            # Wedi kill switch + the git sha surfaced by /api/health.
            "WEDI_GENERATION_DISABLED", "GIT_SHA",
        ):
            value = getattr(self.env, key, None)
            if value is not None:
                os.environ[key] = str(value)

        # Fail closed on the first request if the signing secret is missing.
        # Tokens must never be signed/verified with an implicit default secret.
        if not os.environ.get("JWT_SECRET_KEY"):
            raise RuntimeError("JWT_SECRET_KEY not configured")

        origin = request.headers.get("origin") or ""
        cors_origin = origin if origin in _allowed_origins else ""

        # The public RSVP endpoint is uncredentialed and called cross-origin from
        # any couple-site origin, so it (and its preflight) get
        # Access-Control-Allow-Origin:* with NO credentials. This must never apply
        # to any authenticated route.
        req_path = ""
        try:
            from js import URL
            req_path = URL.new(request.url).pathname or ""
        except Exception:
            req_path = ""
        is_public_rsvp = req_path.startswith("/api/public/rsvp/")

        # Handle OPTIONS preflight at the worker level — always works regardless
        # of whether the ASGI bridge passes the Origin header through correctly.
        if request.method == "OPTIONS":
            h = Headers.new()
            if is_public_rsvp:
                h.set("access-control-allow-origin", "*")
                h.set("access-control-allow-methods", "POST, OPTIONS")
                h.set("access-control-allow-headers", "content-type")
                h.set("access-control-max-age", "86400")
                # NB: no access-control-allow-credentials — wildcard is uncredentialed.
            elif cors_origin:
                h.set("access-control-allow-origin", cors_origin)
                h.set("access-control-allow-methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
                h.set("access-control-allow-headers", "content-type, authorization")
                h.set("access-control-allow-credentials", "true")
                h.set("access-control-max-age", "86400")
            return Response.new("", status=204, headers=h)

        # Edge cache for password-less public sites (GET /s/{slug}). Keyed on the
        # canonical {PUBLIC_SITE_BASE_URL}/s/{slug} URL so it stays symmetric with
        # services.site_cache.purge_site_cache. All of this is best-effort: any
        # failure falls through to serving the page uncached.
        site_cache_key = None
        edge_cache = None
        if request.method == "GET":
            try:
                from js import caches
                path = req_path
                base = (os.environ.get("PUBLIC_SITE_BASE_URL") or "").rstrip("/")
                if base and path.startswith("/s/"):
                    site_cache_key = base + path
                    edge_cache = caches.default
                    cached = await edge_cache.match(site_cache_key)
                    if cached is not None:
                        return cached
            except Exception:
                site_cache_key = None
                edge_cache = None

        try:
            resp = await asgi.fetch(app, request, self.env)
        except Exception:
            h = Headers.new()
            h.set("content-type", "application/json")
            if cors_origin:
                h.set("access-control-allow-origin", cors_origin)
                h.set("access-control-allow-credentials", "true")
            return Response.new('{"error":"Internal server error"}', status=500, headers=h)

        # Store cacheable public-site responses (Cache-Control public, max-age).
        if edge_cache is not None and site_cache_key:
            try:
                cc = resp.headers.get("cache-control") or ""
                if getattr(resp, "status", 0) == 200 and "public" in cc and "max-age" in cc:
                    await edge_cache.put(site_cache_key, resp.clone())
            except Exception:
                pass

        # Uncredentialed public RSVP: force Access-Control-Allow-Origin:* and
        # never emit credentials, regardless of the request Origin.
        if is_public_rsvp:
            h = Headers.new(resp.headers)
            h.set("access-control-allow-origin", "*")
            return Response.new(resp.body, status=resp.status, headers=h)

        # Always patch CORS headers at the worker level. The Cloudflare Python
        # Workers ASGI bridge may drop the Origin header from the ASGI scope,
        # preventing FastAPI's CORSMiddleware from adding them to the response.
        if cors_origin:
            h = Headers.new(resp.headers)
            h.set("access-control-allow-origin", cors_origin)
            h.set("access-control-allow-credentials", "true")
            return Response.new(resp.body, status=resp.status, headers=h)

        return resp


app = FastAPI(title="Wedding Planner API", version="2.0.0")

_allowed_origins = [
    "https://wedding-planner-frontend.romanhess1994.workers.dev",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
]
_extra = os.environ.get("CORS_EXTRA_ORIGINS", "")
if _extra:
    _allowed_origins.extend(o.strip() for o in _extra.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Installed AFTER (i.e. OUTSIDE) CORSMiddleware so it runs first on the request
# and last on the response: it serves ONLY /api/public/rsvp/* with a permissive,
# UNcredentialed CORS policy without widening CORS on any authenticated route.
app.add_middleware(PublicRsvpCORSMiddleware)

# Consolidated {"code","detail"} error envelope + generic 500 (no traceback leak).
register_exception_handlers(app)


# Health check. `version` is the git sha injected at deploy time as the GIT_SHA
# Worker var (see the deploy workflow / DEPLOY.md); "dev" off-platform.
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": os.environ.get("GIT_SHA", "dev")}


# Auth
app.include_router(auth_router, prefix="/api/auth")
app.include_router(guest_auth_router, prefix="/api/guest-auth")

# Core tenant routes
app.include_router(wedding_router, prefix="/api/weddings")
app.include_router(guest_router, prefix="/api/guests")
app.include_router(task_router, prefix="/api/tasks")
app.include_router(cost_router, prefix="/api/costs")
app.include_router(content_router, prefix="/api/content")
app.include_router(analytics_router, prefix="/api/analytics")
app.include_router(billing_router, prefix="/api/billing")
app.include_router(ai_router, prefix="/api/ai")

# Additional feature routes
app.include_router(invitation_router, prefix="/api/invitations")
app.include_router(event_router, prefix="/api/events")
app.include_router(message_router, prefix="/api/messages")
app.include_router(gift_registry_router, prefix="/api/gift-registry")
app.include_router(guest_photo_router, prefix="/api/guest-photos")
app.include_router(venue_router, prefix="/api/venues")
app.include_router(seating_router, prefix="/api/seating")
app.include_router(rsvp_reminder_router, prefix="/api/rsvp-reminders")
app.include_router(user_router, prefix="/api/users")
app.include_router(moodboard_router)  # Has own /api/moodboards prefix in routes
app.include_router(agenda_router, prefix="/api/agenda")
app.include_router(onboarding_router, prefix="/api/onboarding")
app.include_router(subscription_router, prefix="/api/subscriptions")
app.include_router(image_router)  # Has own /api/images prefix in routes
app.include_router(demo_router, prefix="/api/demo")
app.include_router(website_router, prefix="/api/website")

# Visitor geo → presentment currency (public, no auth).
app.include_router(geo_router, prefix="/api/geo")

# Public, unauthenticated hosting: GET /s/{slug} (server-rendered published
# sites) and POST /api/public/rsvp/{slug}. Full paths live on the router.
app.include_router(public_site_router)
