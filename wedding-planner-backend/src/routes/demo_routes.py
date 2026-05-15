"""
Public demo data — no auth, no DB writes.

Returns a hardcoded sample wedding for `/demo` so prospects can experience the
admin dashboard before signing up.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/overview")
async def demo_overview() -> dict:
    """Return a self-contained snapshot the demo page can render against."""
    guests = [
        {"id": "g1", "name": "Olivia & Marcus Bennett", "email": "o.bennett@example.com", "rsvp_status": "confirmed", "dietary": "vegetarian"},
        {"id": "g2", "name": "Aiko Tanaka", "email": "aiko@example.com", "rsvp_status": "confirmed", "dietary": "no-gluten"},
        {"id": "g3", "name": "Lukas Müller", "email": "lukas@example.com", "rsvp_status": "confirmed", "dietary": None},
        {"id": "g4", "name": "Priya Sharma + 1", "email": "priya@example.com", "rsvp_status": "confirmed", "dietary": "vegan"},
        {"id": "g5", "name": "Diego Alvarez", "email": "diego@example.com", "rsvp_status": "confirmed", "dietary": None},
        {"id": "g6", "name": "Camille Laurent", "email": "camille@example.com", "rsvp_status": "confirmed", "dietary": None},
        {"id": "g7", "name": "Henrik Olsen", "email": "henrik@example.com", "rsvp_status": "confirmed", "dietary": None},
        {"id": "g8", "name": "Mira Singh", "email": "mira@example.com", "rsvp_status": "confirmed", "dietary": "pescatarian"},
        {"id": "g9", "name": "Theo Reyes", "email": "theo@example.com", "rsvp_status": "confirmed", "dietary": None},
        {"id": "g10", "name": "Yuki Watanabe + 1", "email": "yuki@example.com", "rsvp_status": "pending", "dietary": None},
        {"id": "g11", "name": "Noor El-Sayed", "email": "noor@example.com", "rsvp_status": "pending", "dietary": "halal"},
        {"id": "g12", "name": "Greta Lindqvist", "email": "greta@example.com", "rsvp_status": "declined", "dietary": None},
    ]

    tasks = [
        {"id": "t1", "title": "Book venue", "status": "done", "due_date": "2025-02-01"},
        {"id": "t2", "title": "Send save-the-dates", "status": "done", "due_date": "2025-03-15"},
        {"id": "t3", "title": "Choose florist", "status": "done", "due_date": "2025-05-01"},
        {"id": "t4", "title": "Cake tasting", "status": "done", "due_date": "2025-06-20"},
        {"id": "t5", "title": "Confirm DJ playlist", "status": "pending", "due_date": "2025-08-10"},
        {"id": "t6", "title": "Finalize seating chart", "status": "pending", "due_date": "2025-08-25"},
        {"id": "t7", "title": "Pick up rings", "status": "pending", "due_date": "2025-09-05"},
        {"id": "t8", "title": "Rehearsal dinner", "status": "pending", "due_date": "2025-09-13"},
    ]

    costs = [
        {"id": "c1", "category": "Venue",        "name": "Lakeside Estate",        "estimated": 8500.0, "actual": 8500.0},
        {"id": "c2", "category": "Catering",     "name": "Coastal Catering Co.",    "estimated": 4800.0, "actual": 5120.0},
        {"id": "c3", "category": "Photography",  "name": "Rose Hill Studio",        "estimated": 2400.0, "actual": 2400.0},
        {"id": "c4", "category": "Florals",      "name": "Botanica",                "estimated": 1500.0, "actual": 1380.0},
        {"id": "c5", "category": "Music",        "name": "DJ Lumière",              "estimated": 1200.0, "actual": None},
    ]

    return {
        "wedding": {
            "couple_names": "Sophie & James",
            "wedding_date": "2025-09-14",
            "location": "Lakeside Estate, Como",
        },
        "guests": guests,
        "tasks": tasks,
        "costs": costs,
        "analytics": {
            "total_guests": len(guests),
            "confirmed": sum(1 for g in guests if g["rsvp_status"] == "confirmed"),
            "pending":   sum(1 for g in guests if g["rsvp_status"] == "pending"),
            "declined":  sum(1 for g in guests if g["rsvp_status"] == "declined"),
        },
    }
