import uuid
import re
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.auth import require_admin_auth
from src.middleware import get_db, get_wedding, wedding_meets_plan, PLAN_LIMITS

router = APIRouter()


class CreateWeddingBody(BaseModel):
    partner_one_name: str
    partner_two_name: str
    wedding_date: str | None = None
    location: str | None = None
    slug: str | None = None


class UpdateWeddingBody(BaseModel):
    partner_one_name: str | None = None
    partner_two_name: str | None = None
    wedding_date: str | None = None
    location: str | None = None
    slug: str | None = None


def _generate_slug(p1: str, p2: str, year: int) -> str:
    def _s(n: str) -> str:
        n = n.lower().strip()
        n = re.sub(r"[^a-z0-9\s-]", "", n)
        n = re.sub(r"\s+", "-", n)
        return n.strip("-")
    return f"{_s(p1.split()[0] if p1 else 'partner1')}-and-{_s(p2.split()[0] if p2 else 'partner2')}-{year}"


async def _unique_slug(db, base: str, exclude_id: str | None = None) -> str:
    slug, counter = base, 1
    while True:
        row = await db.prepare(
            "SELECT id FROM weddings WHERE slug = ?" + (" AND id != ?" if exclude_id else "")
        ).bind(*([slug, exclude_id] if exclude_id else [slug])).first()
        if not row:
            return slug
        slug = f"{base}-{counter}"
        counter += 1


def _wedding_dict(w: dict) -> dict:
    plan = w.get("plan", "free")
    return {
        "id": w["id"],
        "slug": w["slug"],
        "owner_id": w["owner_id"],
        "plan": plan,
        "partner_one_name": w.get("partner_one_name"),
        "partner_two_name": w.get("partner_two_name"),
        "wedding_date": w.get("wedding_date"),
        "location": w.get("location"),
        "is_active": bool(w.get("is_active", 1)),
        "stripe_customer_id": w.get("stripe_customer_id"),
        "stripe_subscription_id": w.get("stripe_subscription_id"),
        "limits": PLAN_LIMITS.get(plan, {}),
        "created_at": w.get("created_at"),
    }


@router.post("/create", status_code=201)
async def create_wedding(
    body: CreateWeddingBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    user_id = payload["sub"]

    existing = await db.prepare(
        "SELECT id FROM weddings WHERE owner_id = ?"
    ).bind(user_id).first()
    if existing:
        w = await db.prepare("SELECT * FROM weddings WHERE id = ?").bind(existing["id"]).first()
        raise HTTPException(409, {
            "error": "You already have a wedding. Use PUT /api/weddings/current to update it.",
            "wedding": _wedding_dict(dict(w)),
        })

    year = 2026
    if body.wedding_date:
        try:
            year = int(body.wedding_date.split("-")[0])
        except (ValueError, IndexError):
            pass

    base_slug = _generate_slug(body.partner_one_name, body.partner_two_name, year)
    if body.slug:
        custom = re.sub(r"[^a-z0-9-]", "-", body.slug.lower())
        custom = re.sub(r"-+", "-", custom).strip("-")
        if len(custom) >= 3:
            base_slug = custom

    slug = await _unique_slug(db, base_slug)
    wedding_id = str(uuid.uuid4())

    await db.prepare(
        "INSERT INTO weddings (id, slug, owner_id, partner_one_name, partner_two_name, "
        "wedding_date, location, plan, is_active, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'free', 1, datetime('now'), datetime('now'))"
    ).bind(
        wedding_id, slug, user_id, body.partner_one_name, body.partner_two_name,
        body.wedding_date, body.location
    ).run()

    await db.prepare(
        "UPDATE users SET current_wedding_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(wedding_id, user_id).run()

    w = await db.prepare("SELECT * FROM weddings WHERE id = ?").bind(wedding_id).first()
    return {"message": "Wedding created successfully", "wedding": _wedding_dict(dict(w))}


@router.get("/current")
async def get_current_wedding(
    wedding: dict = Depends(get_wedding),
):
    return _wedding_dict(wedding)


@router.put("/current")
async def update_current_wedding(
    body: UpdateWeddingBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    wedding_id = wedding["id"]

    if body.partner_one_name is not None:
        await db.prepare(
            "UPDATE weddings SET partner_one_name = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(body.partner_one_name.strip(), wedding_id).run()

    if body.partner_two_name is not None:
        await db.prepare(
            "UPDATE weddings SET partner_two_name = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(body.partner_two_name.strip(), wedding_id).run()

    if body.location is not None:
        await db.prepare(
            "UPDATE weddings SET location = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(body.location.strip() or None, wedding_id).run()

    if body.wedding_date is not None:
        await db.prepare(
            "UPDATE weddings SET wedding_date = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(body.wedding_date or None, wedding_id).run()

    if body.slug:
        if not wedding_meets_plan(wedding, "starter"):
            raise HTTPException(402, {
                "error": "Custom slug requires Starter plan or higher",
                "upgrade_url": "/admin/billing",
            })
        new_slug = re.sub(r"[^a-z0-9-]", "-", body.slug.lower())
        new_slug = re.sub(r"-+", "-", new_slug).strip("-")
        if new_slug != wedding["slug"]:
            conflict = await db.prepare(
                "SELECT id FROM weddings WHERE slug = ? AND id != ?"
            ).bind(new_slug, wedding_id).first()
            if conflict:
                raise HTTPException(409, "That slug is already taken")
            await db.prepare(
                "UPDATE weddings SET slug = ?, updated_at = datetime('now') WHERE id = ?"
            ).bind(new_slug, wedding_id).run()

    w = await db.prepare("SELECT * FROM weddings WHERE id = ?").bind(wedding_id).first()
    return _wedding_dict(dict(w))


@router.get("/by-slug/{slug}")
async def get_wedding_by_slug(slug: str, request: Request):
    """Public endpoint — no auth required."""
    db = await get_db(request)
    w = await db.prepare(
        "SELECT * FROM weddings WHERE slug = ? AND is_active = 1"
    ).bind(slug).first()
    if not w:
        raise HTTPException(404, "Wedding not found")
    w = dict(w)
    return {
        "id": w["id"],
        "slug": w["slug"],
        "partner_one_name": w.get("partner_one_name"),
        "partner_two_name": w.get("partner_two_name"),
        "wedding_date": w.get("wedding_date"),
        "location": w.get("location"),
        "plan": w.get("plan"),
    }
