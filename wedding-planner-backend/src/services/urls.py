"""Shared URL builders so link generation can't drift from the frontend router."""


def rsvp_link(frontend_url: str, token: str) -> str:
    """Build the guest RSVP invitation link. Must match the frontend's
    top-level `/rsvp/:token` route (see wedding-planner-frontend/src/App.jsx)."""
    return f"{frontend_url}/rsvp/{token}"
