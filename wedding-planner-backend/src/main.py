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

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await asgi.fetch(app, request, self.env)


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


# Health check
@app.get("/api/health")
async def health():
    return {"status": "ok"}


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
