import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.middleware import get_db, get_wedding

router = APIRouter()


class CostBody(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    amount: float | None = None
    currency: str | None = "CHF"
    status: str | None = "planned"
    payment_date: str | None = None
    vendor_name: str | None = None
    vendor_contact: str | None = None
    receipt_url: str | None = None
    vendor: str | None = None
    notes: str | None = None
    is_recurring: bool | None = False
    recurring_frequency: str | None = None


@router.get("")
async def get_costs(
    wedding: dict = Depends(get_wedding),
    category: str | None = None,
    status: str | None = None,
    request: Request = None,
):
    db = await get_db(request)
    sql = "SELECT * FROM costs WHERE wedding_id = ?"
    binds = [wedding["id"]]
    if category:
        sql += " AND category = ?"; binds.append(category)
    if status:
        sql += " AND status = ?"; binds.append(status)
    sql += " ORDER BY created_at DESC"
    result = await db.prepare(sql).bind(*binds).all()
    return [dict(c) for c in (result.results or [])]


@router.post("", status_code=201)
async def create_cost(
    body: CostBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    if not body.name:
        raise HTTPException(400, "Name is required")
    if body.amount is None:
        raise HTTPException(400, "Amount is required")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be greater than 0")
    if not body.category:
        raise HTTPException(400, "Category is required")

    cost_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO costs (id, wedding_id, name, description, category, amount, currency, "
        "status, payment_date, vendor_name, vendor_contact, receipt_url, vendor, notes, "
        "is_recurring, recurring_frequency, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(
        cost_id, wedding["id"], body.name, body.description, body.category,
        body.amount, body.currency or "CHF", body.status or "planned",
        body.payment_date, body.vendor_name or body.vendor, body.vendor_contact,
        body.receipt_url, body.vendor, body.notes,
        int(body.is_recurring or False), body.recurring_frequency,
    ).run()

    cost = await db.prepare("SELECT * FROM costs WHERE id = ?").bind(cost_id).first()
    return dict(cost)


@router.put("/{cost_id}")
async def update_cost(
    cost_id: str,
    body: CostBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    cost = await db.prepare(
        "SELECT * FROM costs WHERE id = ? AND wedding_id = ?"
    ).bind(cost_id, wedding["id"]).first()
    if not cost:
        raise HTTPException(404, "Cost not found")

    updates = []
    binds = []

    simple = [
        ("name", body.name), ("description", body.description),
        ("category", body.category), ("amount", body.amount),
        ("currency", body.currency), ("status", body.status),
        ("payment_date", body.payment_date), ("vendor_name", body.vendor_name),
        ("vendor_contact", body.vendor_contact), ("receipt_url", body.receipt_url),
        ("vendor", body.vendor), ("notes", body.notes),
        ("recurring_frequency", body.recurring_frequency),
    ]
    for col, val in simple:
        if val is not None:
            updates.append(f"{col} = ?"); binds.append(val)

    if body.is_recurring is not None:
        updates.append("is_recurring = ?"); binds.append(int(body.is_recurring))

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(cost_id)
        await db.prepare(
            f"UPDATE costs SET {', '.join(updates)} WHERE id = ?"
        ).bind(*binds).run()

    updated = await db.prepare("SELECT * FROM costs WHERE id = ?").bind(cost_id).first()
    return dict(updated)


@router.delete("/{cost_id}")
async def delete_cost(
    cost_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    cost = await db.prepare(
        "SELECT id FROM costs WHERE id = ? AND wedding_id = ?"
    ).bind(cost_id, wedding["id"]).first()
    if not cost:
        raise HTTPException(404, "Cost not found")
    await db.prepare("DELETE FROM costs WHERE id = ?").bind(cost_id).run()
    return {"message": "Cost deleted successfully"}


@router.get("/analytics")
async def cost_analytics(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM costs WHERE wedding_id = ?"
    ).bind(wedding["id"]).all()
    costs = result.results or []

    category_totals: dict = {}
    status_totals = {"planned": 0.0, "pending": 0.0, "paid": 0.0}

    for c in costs:
        cat = c.get("category") or "other"
        st = c.get("status") or "planned"
        amount = float(c.get("amount") or 0)
        if cat not in category_totals:
            category_totals[cat] = {"planned": 0.0, "pending": 0.0, "paid": 0.0, "total": 0.0}
        category_totals[cat][st] = category_totals[cat].get(st, 0.0) + amount
        category_totals[cat]["total"] += amount
        if st in status_totals:
            status_totals[st] += amount

    alerts = []
    for cat, totals in category_totals.items():
        planned = totals.get("planned", 0)
        spent = totals.get("paid", 0) + totals.get("pending", 0)
        if planned > 0:
            pct = (spent / planned) * 100
            if pct >= 90:
                alerts.append({"category": cat, "percentage": round(pct, 1), "planned": planned, "spent": spent})

    return {
        "by_category": category_totals,
        "by_status": status_totals,
        "total": sum(status_totals.values()),
        "alerts": alerts,
    }
