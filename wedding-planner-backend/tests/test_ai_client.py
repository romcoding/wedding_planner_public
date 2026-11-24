"""The Anthropic client is async, reads the model per call, and every caller awaits it."""
import asyncio
import inspect
import json
import sys

import httpx
import pytest


def _run(coro):
    """Run on a private loop. _run() would clear the global event loop
    that older tests in this suite still fetch with get_event_loop()."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture()
def ai(real_app):
    return sys.modules["services.ai_service"]


def _capture(monkeypatch, handler):
    """Route httpx.AsyncClient through a MockTransport; record its constructor kwargs."""
    seen = {}
    real = httpx.AsyncClient

    def factory(*a, **kw):
        seen.update(kw)
        return real(transport=httpx.MockTransport(handler), **{k: v for k, v in kw.items()})

    monkeypatch.setattr(httpx, "AsyncClient", factory)
    return seen


def _ok(request):
    return httpx.Response(200, json={"content": [{"text": "hi"}], "usage": {"input_tokens": 1, "output_tokens": 2}})


def test_public_api_is_async(ai):
    for name in ("call_claude", "call_claude_json", "generate_timeline", "generate_vendor_suggestions",
                 "generate_website_copy", "generate_seating_suggestions"):
        assert inspect.iscoroutinefunction(getattr(ai, name)), name


def test_no_synchronous_httpx_post_remains():
    import pathlib
    src = pathlib.Path(__file__).parent.parent / "src"
    offenders = [str(p) for p in src.rglob("*.py") if "httpx.post(" in p.read_text() or "httpx.get(" in p.read_text()]
    assert offenders == []


def test_call_uses_async_client_with_30s_timeout_and_configured_model(ai, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-custom-model")
    sent = {}

    def handler(request):
        sent["body"] = json.loads(request.content)
        sent["key"] = request.headers["x-api-key"]
        return _ok(request)

    seen = _capture(monkeypatch, handler)
    out = _run(ai.call_claude("sys", "hello"))
    assert out == "hi"
    assert seen["timeout"] == 30.0
    assert sent["body"]["model"] == "claude-custom-model" and sent["key"] == "sk-test"


def test_model_defaults_when_setting_absent_and_explicit_model_wins(ai, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)
    bodies = []

    def handler(request):
        bodies.append(json.loads(request.content)["model"])
        return _ok(request)

    _capture(monkeypatch, handler)
    _run(ai.call_claude_json("s", "u"))
    _run(ai.call_claude_json("s", "u", model="explicit"))
    assert bodies == [ai.DEFAULT_MODEL, "explicit"] and ai.DEFAULT_MODEL == "claude-sonnet-4-6"


def test_http_failure_becomes_runtimeerror(ai, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    _capture(monkeypatch, lambda r: httpx.Response(529, json={"error": "overloaded"}))
    with pytest.raises(RuntimeError):
        _run(ai.call_claude("s", "u"))


def test_missing_key_raises(ai, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        _run(ai.call_claude("s", "u"))


def test_anthropic_model_is_mirrored_from_worker_settings():
    import pathlib
    main = (pathlib.Path(__file__).parent.parent / "src" / "main.py").read_text()
    assert '"ANTHROPIC_MODEL"' in main


def test_ai_route_awaits_the_client(world, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    w = world.wedding("a@x.com", plan="premium")
    _capture(monkeypatch, lambda r: httpx.Response(200, json={
        "content": [{"text": json.dumps({"timeline": [{"month_label": "12m", "months_before": 12, "tasks": ["x"]}]})}]}))
    r = world.client.post("/api/ai/timeline", headers=w.h, json={
        "wedding_date": "2027-06-01", "location": "Zurich", "guest_count": 80, "ceremony_type": "civil"})
    assert r.status_code == 200, r.text
    assert r.json()["timeline"][0]["tasks"] == ["x"]


def test_ai_route_failure_is_502_envelope(world, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    w = world.wedding("a@x.com", plan="premium")
    _capture(monkeypatch, lambda r: httpx.Response(500))
    r = world.client.post("/api/ai/timeline", headers=w.h, json={
        "wedding_date": "2027-06-01", "location": "Zurich", "guest_count": 80, "ceremony_type": "civil"})
    assert r.status_code == 502 and set(r.json()) == {"code", "detail"}


def test_venue_chat_awaits_the_client(world, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    w = world.wedding("a@x.com", plan="premium")
    _capture(monkeypatch, lambda r: httpx.Response(200, json={"content": [{"text": "The hall seats 120."}]}))
    r = world.client.post("/api/venues/v1/chat", headers=w.h, json={"role": "user", "content": "capacity?"})
    assert r.status_code == 201, r.text
    assert "120" in json.dumps(r.json())
