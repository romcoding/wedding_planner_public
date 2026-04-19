import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.middleware import get_db, get_wedding

router = APIRouter()


class TaskBody(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = "medium"
    status: str | None = "todo"
    due_date: str | None = None
    category: str | None = None
    assigned_to: str | None = None
    estimated_cost: float | None = None
    actual_cost: float | None = None
    event_id: str | None = None
    reminder_date: str | None = None


@router.get("")
async def get_tasks(
    wedding: dict = Depends(get_wedding),
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    request: Request = None,
):
    db = await get_db(request)
    sql = "SELECT * FROM tasks WHERE wedding_id = ?"
    binds = [wedding["id"]]
    if status:
        sql += " AND status = ?"; binds.append(status)
    if priority:
        sql += " AND priority = ?"; binds.append(priority)
    if category:
        sql += " AND category = ?"; binds.append(category)
    sql += " ORDER BY due_date ASC, priority DESC"
    result = await db.prepare(sql).bind(*binds).all()
    return [dict(t) for t in (result.results or [])]


@router.post("", status_code=201)
async def create_task(
    body: TaskBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    if not body.title:
        raise HTTPException(400, "Title is required")

    task_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO tasks (id, wedding_id, title, description, priority, status, due_date, "
        "category, assigned_to, estimated_cost, actual_cost, event_id, reminder_date, "
        "created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(
        task_id, wedding["id"], body.title.strip(), body.description,
        body.priority or "medium", body.status or "todo",
        body.due_date, body.category, body.assigned_to,
        body.estimated_cost, body.actual_cost, body.event_id, body.reminder_date,
    ).run()

    task = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(task_id).first()
    return dict(task)


@router.put("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    task = await db.prepare(
        "SELECT * FROM tasks WHERE id = ? AND wedding_id = ?"
    ).bind(task_id, wedding["id"]).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task = dict(task)

    updates = []
    binds = []

    if body.title is not None:
        updates.append("title = ?"); binds.append(body.title)
    if body.description is not None:
        updates.append("description = ?"); binds.append(body.description)
    if body.priority is not None:
        updates.append("priority = ?"); binds.append(body.priority)
    if body.status is not None:
        updates.append("status = ?"); binds.append(body.status)
        if body.status == "completed" and not task.get("completed_at"):
            updates.append("completed_at = datetime('now')")
        elif body.status != "completed":
            updates.append("completed_at = NULL")
    if body.due_date is not None:
        updates.append("due_date = ?"); binds.append(body.due_date or None)
    if body.category is not None:
        updates.append("category = ?"); binds.append(body.category)
    if body.assigned_to is not None:
        updates.append("assigned_to = ?"); binds.append(body.assigned_to)
    if body.estimated_cost is not None:
        updates.append("estimated_cost = ?"); binds.append(body.estimated_cost)
    if body.actual_cost is not None:
        updates.append("actual_cost = ?"); binds.append(body.actual_cost)
    if body.event_id is not None:
        updates.append("event_id = ?"); binds.append(body.event_id or None)
    if body.reminder_date is not None:
        updates.append("reminder_date = ?"); binds.append(body.reminder_date or None)

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(task_id)
        await db.prepare(
            f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
        ).bind(*binds).run()

    updated = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(task_id).first()
    return dict(updated)


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    task = await db.prepare(
        "SELECT id FROM tasks WHERE id = ? AND wedding_id = ?"
    ).bind(task_id, wedding["id"]).first()
    if not task:
        raise HTTPException(404, "Task not found")
    await db.prepare("DELETE FROM tasks WHERE id = ?").bind(task_id).run()
    return {"message": "Task deleted successfully"}
