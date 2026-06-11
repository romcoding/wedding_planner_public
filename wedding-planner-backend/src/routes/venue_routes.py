import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from middleware import get_db, get_wedding
from entitlements import require_feature

_gate = require_feature("venue")

router = APIRouter()


class VenueRequestBody(BaseModel):
    venue_id: str
    message: str | None = None


class VenueChatBody(BaseModel):
    role: str = "user"
    content: str


@router.get("")
async def list_venues(request: Request):
    """Public: list all active venues."""
    db = await get_db(request)
    result = await db.prepare("SELECT * FROM venues WHERE is_active = 1 ORDER BY name ASC").all()
    return [dict(v) for v in (result.results or [])]


@router.get("/{venue_id}")
async def get_venue(venue_id: str, request: Request):
    db = await get_db(request)
    venue = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(venue_id).first()
    if not venue:
        raise HTTPException(404, "Venue not found")
    return dict(venue)


@router.post("/requests", status_code=201)
async def create_venue_request(
    body: VenueRequestBody,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    db = await get_db(request)
    rid = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO venue_requests (id, venue_id, wedding_id, status, message, created_at, updated_at) "
        "VALUES (?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))"
    ).bind(rid, body.venue_id, wedding["id"], body.message).run()
    r = await db.prepare("SELECT * FROM venue_requests WHERE id = ?").bind(rid).first()
    return dict(r)


@router.get("/{venue_id}/offers/categories")
async def list_offer_categories(venue_id: str, request: Request):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM venue_offer_categories WHERE venue_id = ? ORDER BY name ASC"
    ).bind(venue_id).all()
    cats = []
    for c in (result.results or []):
        c = dict(c)
        offers_r = await db.prepare(
            "SELECT * FROM venue_offers WHERE category_id = ? AND is_active = 1"
        ).bind(c["id"]).all()
        c["offers"] = [dict(o) for o in (offers_r.results or [])]
        cats.append(c)
    return cats


@router.post("/{venue_id}/chat", status_code=201)
async def venue_chat(
    venue_id: str,
    body: VenueChatBody,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """AI-assisted venue chat using venue documents as context."""
    db = await get_db(request)

    # Route through the same AI gate as ai_routes (plan + daily cap + counts
    # toward usage) so this Claude path is never an ungated free-tier bypass.
    from routes.ai_routes import _ai_gate
    await _ai_gate(db, wedding)

    chat_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO venue_chat_history (id, venue_id, wedding_id, role, content, created_at) "
        "VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(chat_id, venue_id, wedding["id"], body.role, body.content).run()

    # Get venue info for context
    venue_raw = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(venue_id).first()
    venue = dict(venue_raw) if venue_raw else None
    venue_name = venue.get("name") if venue else "this venue"

    # Get recent chat history
    history_r = await db.prepare(
        "SELECT role, content FROM venue_chat_history WHERE venue_id = ? AND wedding_id = ? "
        "ORDER BY created_at ASC LIMIT 20"
    ).bind(venue_id, wedding["id"]).all()
    history = [{"role": r.get("role"), "content": r.get("content")} for r in [dict(x) for x in (history_r.results or [])]]

    # Get venue document snippets for context
    docs_r = await db.prepare(
        "SELECT content_text FROM venue_documents WHERE venue_id = ? LIMIT 3"
    ).bind(venue_id).all()
    doc_context = "\n\n".join(
        d.get("content_text") for d in [dict(x) for x in (docs_r.results or [])] if d.get("content_text")
    )

    try:
        from services.ai_service import call_claude
        system = (
            f"You are a helpful assistant for {venue_name}. "
            "Answer questions about this venue based on the provided information. "
            "Be concise and helpful.\n\n"
        )
        if doc_context:
            system += f"Venue information:\n{doc_context}"

        messages_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-10:])
        reply = call_claude(system, messages_text)
    except Exception as e:
        reply = f"I'm sorry, I couldn't process your request at this time."

    # Save assistant reply
    reply_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO venue_chat_history (id, venue_id, wedding_id, role, content, created_at) "
        "VALUES (?, ?, ?, 'assistant', ?, datetime('now'))"
    ).bind(reply_id, venue_id, wedding["id"], reply).run()

    return {"reply": reply, "history": history + [{"role": "assistant", "content": reply}]}


@router.get("/{venue_id}/chat")
async def get_chat_history(
    venue_id: str,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT role, content, created_at FROM venue_chat_history "
        "WHERE venue_id = ? AND wedding_id = ? ORDER BY created_at ASC"
    ).bind(venue_id, wedding["id"]).all()
    return [dict(r) for r in (result.results or [])]
