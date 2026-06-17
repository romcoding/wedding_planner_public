"""Permissive CORS for the ONE uncredentialed public endpoint.

The published couple site is served from a different origin than the API worker
(until a custom domain unifies them), and its rendered RSVP form POSTs JSON to
``/api/public/rsvp/{slug}`` cross-origin. That endpoint takes no cookies, so it
is served — preflight included — with ``Access-Control-Allow-Origin: *`` and NO
``Access-Control-Allow-Credentials``.

This middleware ONLY ever touches ``/api/public/rsvp/*``. Every other route is
left to the strict credentialed allow-list in main.py's ``CORSMiddleware``; this
must be installed OUTSIDE that middleware so it can (a) answer the preflight
before the allow-list rejects the non-listed site origin and (b) overwrite the
allow-list's per-origin header with ``*`` and strip credentials on the response.
"""
from __future__ import annotations

PUBLIC_RSVP_PREFIX = "/api/public/rsvp/"

# A credentialed wildcard is forbidden by the CORS spec and by this design, so
# allow-credentials is deliberately never emitted for these responses.
_PREFLIGHT_HEADERS = [
    (b"access-control-allow-origin", b"*"),
    (b"access-control-allow-methods", b"POST, OPTIONS"),
    (b"access-control-allow-headers", b"content-type"),
    (b"access-control-max-age", b"86400"),
    (b"content-length", b"0"),
]


def is_public_rsvp_path(path: str) -> bool:
    return bool(path) and path.startswith(PUBLIC_RSVP_PREFIX)


class PublicRsvpCORSMiddleware:
    """ASGI middleware — see module docstring."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or not is_public_rsvp_path(scope.get("path", "")):
            await self.app(scope, receive, send)
            return

        if scope.get("method") == "OPTIONS":
            # Answer the preflight ourselves so the strict (credentialed)
            # CORSMiddleware never gets a chance to reject the site origin.
            await send({"type": "http.response.start", "status": 204,
                        "headers": list(_PREFLIGHT_HEADERS)})
            await send({"type": "http.response.body", "body": b""})
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = [
                    (k, v) for (k, v) in message.get("headers", [])
                    if k.lower() not in (b"access-control-allow-origin",
                                         b"access-control-allow-credentials")
                ]
                headers.append((b"access-control-allow-origin", b"*"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_wrapper)
