"""
AI Service — Claude (Anthropic) integration.
All public functions call Claude via httpx (pure Python, Pyodide-compatible).
"""
import os
import json
import logging

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_MAX_TOKENS = 2000
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


def call_claude(system_prompt: str, user_message: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> str:
    """
    Call Claude API via httpx (pure Python, no native extensions needed).
    Raises RuntimeError on failure.
    """
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    import httpx
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
    }
    try:
        response = httpx.post(ANTHROPIC_API_URL, headers=headers, json=body, timeout=60.0)
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise RuntimeError(f"AI request failed: {str(e)}")


def _parse_json_response(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:])
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw": raw}


def generate_timeline(wedding_date: str, location: str, guest_count: int, ceremony_type: str) -> dict:
    system = (
        "You are an expert wedding planner with 20+ years of experience. "
        "Generate detailed, realistic, actionable wedding planning timelines. "
        "Always return valid JSON with a 'timeline' array of objects: "
        "{ 'month_label': string, 'months_before': number, 'tasks': [string, ...] }. "
        "Order from furthest to closest. Be specific and practical."
    )
    user = (
        f"Generate a complete wedding planning timeline for:\n"
        f"- Wedding date: {wedding_date}\n"
        f"- Location: {location}\n"
        f"- Guest count: {guest_count}\n"
        f"- Ceremony type: {ceremony_type}\n\n"
        f"Return ONLY a JSON object with a 'timeline' array, no other text."
    )
    raw = call_claude(system, user, max_tokens=3000)
    return _parse_json_response(raw)


def generate_vendor_suggestions(budget: float, location: str, style_preferences: str, guest_count: int) -> dict:
    system = (
        "You are a professional wedding planner and financial advisor specializing in weddings. "
        "Generate specific, practical vendor recommendations and budget allocations. "
        "Return valid JSON only with a 'vendors' array of: "
        "{ 'category': string, 'budget_allocation_pct': number, 'estimated_cost': number, "
        "'tips': string, 'questions_to_ask': [string] }."
    )
    user = (
        f"Suggest wedding vendors and budget allocations for:\n"
        f"- Total budget: ${budget:,.0f}\n"
        f"- Location: {location}\n"
        f"- Style: {style_preferences}\n"
        f"- Guests: {guest_count}\n\n"
        f"Return ONLY a JSON object with a 'vendors' array, no other text."
    )
    raw = call_claude(system, user, max_tokens=2500)
    return _parse_json_response(raw)


def generate_website_copy(couple_names: str, wedding_date: str, location: str, story_notes: str) -> dict:
    system = (
        "You are a professional wedding copywriter who crafts warm, personal, and elegant wedding website content. "
        "Return valid JSON only with keys: 'welcome_text' (string), 'our_story' (string), "
        "'faq' (array of { 'question': string, 'answer': string })."
    )
    user = (
        f"Write wedding website copy for:\n"
        f"- Couple: {couple_names}\n"
        f"- Wedding date: {wedding_date}\n"
        f"- Location: {location}\n"
        f"- Their story: {story_notes}\n\n"
        f"Return ONLY a JSON object with 'welcome_text', 'our_story', and 'faq' keys."
    )
    raw = call_claude(system, user, max_tokens=2500)
    return _parse_json_response(raw)


def generate_seating_suggestions(guests: list) -> dict:
    system = (
        "You are a professional wedding seating coordinator. "
        "Group guests into tables considering relationships, dietary needs, and social dynamics. "
        "Return valid JSON with a 'tables' array of: "
        "{ 'table_number': number, 'guests': [string, ...], 'reasoning': string }."
    )
    guest_list = "\n".join(
        f"- {g.get('name', 'Unknown')}: {g.get('relationship', 'guest')}, dietary: {g.get('dietary', 'none')}"
        for g in guests
    )
    user = (
        f"Create seating arrangements for {len(guests)} guests:\n{guest_list}\n\n"
        f"Aim for 8-10 guests per table. Return ONLY a JSON object with a 'tables' array."
    )
    raw = call_claude(system, user, max_tokens=3000)
    return _parse_json_response(raw)
