"""Structured-logging helper guards (Phase 4 #11).

The helper emits one compact JSON line per event and logs ONLY the fields it is
handed (so a caller can never accidentally widen a log). None values are dropped.
The "no prompt / no PII" guarantee is the caller's discipline and is verified at
the call sites (e.g. test_wedi_generation.py asserts the prompt is never logged).
"""
import os
import sys
import json

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

import obs  # noqa: E402


def test_format_event_is_compact_json_with_event_key():
    line = obs.format_event("wedi_generation", wedding_id="wA", status="ok",
                            input_tokens=123, output_tokens=456)
    parsed = json.loads(line)
    assert parsed == {
        "event": "wedi_generation", "wedding_id": "wA", "status": "ok",
        "input_tokens": 123, "output_tokens": 456,
    }
    assert ", " not in line and ": " not in line  # compact separators


def test_format_event_drops_none_fields():
    parsed = json.loads(obs.format_event("wedi_generation", wedding_id="wA",
                                         status="paused", input_tokens=None,
                                         output_tokens=None, mode=None))
    assert parsed == {"event": "wedi_generation", "wedding_id": "wA", "status": "paused"}
    assert "input_tokens" not in parsed and "mode" not in parsed


def test_format_event_only_includes_passed_fields():
    # A field that was never passed (e.g. a prompt) can never appear in the line.
    line = obs.format_event("wedi_generation", wedding_id="wA", status="ok")
    assert "prompt" not in line and "promptText" not in line


def test_log_event_prints_one_json_line(capsys):
    obs.log_event("public_site_404", slug="alex-sam", host="x.workers.dev")
    out = capsys.readouterr().out.strip()
    assert json.loads(out) == {"event": "public_site_404", "slug": "alex-sam",
                               "host": "x.workers.dev"}


def test_log_event_never_raises_on_bad_input(capsys):
    class Unserializable:
        pass
    # Must not raise even if a value is not directly JSON-serializable.
    obs.log_event("weird", value=Unserializable())
    out = capsys.readouterr().out
    assert '"event":"weird"' in out
