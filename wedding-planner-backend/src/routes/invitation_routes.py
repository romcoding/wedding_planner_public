import uuid
import secrets
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.middleware import get_db, get_wedding

router = APIRouter()


class InvitationBody(BaseModel):
    guest_id: str
    template_id: str | None = None
    scheduled_at: str | None = None


class TemplateBody(BaseModel):
    name: str
    subject: str
    html_content: str
    is_default: bool | None = False


@router.get("")
async def list_invitations(wedding: dict = Depends(get_wedding), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT i.*, g.first_name, g.last_name, g.email as guest_email FROM invitations i "
        "LEFT JOIN guests g ON i.guest_id = g.id WHERE i.wedding_id = ? ORDER BY i.created_at DESC"
    ).bind(wedding["id"]).all()
    return [dict(r) for r in (result.results or [])]


@router.post("", status_code=201)
async def create_invitation(
    body: InvitationBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    guest = await db.prepare(
        "SELECT * FROM guests WHERE id = ? AND wedding_id = ?"
    ).bind(body.guest_id, wedding["id"]).first()
    if not guest:
        raise HTTPException(404, "Guest not found")

    inv_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    await db.prepare(
        "INSERT INTO invitations (id, wedding_id, guest_id, template_id, token, status, "
        "scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))"
    ).bind(inv_id, wedding["id"], body.guest_id, body.template_id, token, body.scheduled_at).run()

    inv = await db.prepare("SELECT * FROM invitations WHERE id = ?").bind(inv_id).first()
    return dict(inv)


@router.post("/{invitation_id}/send")
async def send_invitation(
    invitation_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    inv = await db.prepare(
        "SELECT * FROM invitations WHERE id = ? AND wedding_id = ?"
    ).bind(invitation_id, wedding["id"]).first()
    if not inv:
        raise HTTPException(404, "Invitation not found")
    inv = dict(inv)

    if inv.get("guest_id"):
        guest = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(inv["guest_id"]).first()
        if guest:
            guest = dict(guest)
            import os
            from src.services.email_service import send_invitation_email
            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
            try:
                await send_invitation_email(
                    email=guest["email"],
                    token=inv["token"],
                    guest_name=f"{guest['first_name']} {guest['last_name']}",
                    frontend_url=frontend_url,
                )
            except Exception as e:
                raise HTTPException(500, f"Failed to send email: {str(e)}")

    await db.prepare(
        "UPDATE invitations SET status = 'sent', sent_at = datetime('now') WHERE id = ?"
    ).bind(invitation_id).run()
    return {"message": "Invitation sent successfully"}


@router.get("/track/open/{token}")
async def track_open(token: str, request: Request):
    db = await get_db(request)
    await db.prepare(
        "UPDATE invitations SET opened_at = datetime('now') WHERE token = ? AND opened_at IS NULL"
    ).bind(token).run()
    # Return 1x1 transparent GIF
    from fastapi.responses import Response
    gif = b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
    return Response(content=gif, media_type="image/gif")


# Templates
@router.get("/templates")
async def list_templates(wedding: dict = Depends(get_wedding), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM invitation_templates WHERE wedding_id = ? ORDER BY created_at DESC"
    ).bind(wedding["id"]).all()
    return [dict(t) for t in (result.results or [])]


@router.post("/templates", status_code=201)
async def create_template(
    body: TemplateBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    tid = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO invitation_templates (id, wedding_id, name, subject, html_content, is_default, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(tid, wedding["id"], body.name, body.subject, body.html_content, int(body.is_default or 0)).run()
    t = await db.prepare("SELECT * FROM invitation_templates WHERE id = ?").bind(tid).first()
    return dict(t)
