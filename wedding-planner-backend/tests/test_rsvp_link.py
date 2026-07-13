"""Contract test for the RSVP invitation link builder.

Guards against the P0 bug where the backend emailed `/rsvp/{token}` while the
frontend only mounted the route at `/guest/rsvp/:token` — any future change to
this format must be made consciously in both places (see App.jsx's
`/rsvp/:token` redirect route).
"""
import os
import sys

_SRC = os.path.join(os.path.dirname(__file__), "..", "src")
if _SRC not in sys.path:
    sys.path.insert(0, os.path.abspath(_SRC))

from services.urls import rsvp_link


def test_rsvp_link_format():
    assert rsvp_link("https://example.com", "abc123") == "https://example.com/rsvp/abc123"


def test_rsvp_link_no_trailing_slash_duplication():
    assert "//rsvp" not in rsvp_link("https://example.com", "abc123")
