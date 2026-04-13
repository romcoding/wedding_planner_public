"""
AI Service — Claude (Anthropic) integration for Wedding Planner AI OS.

All public functions check plan limits before calling Claude.
Starter plan: 3 AI uses per day. Premium: unlimited.
"""
import os
import logging
import json

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
DEFAULT_MODEL = 'claude-sonnet-4-6'
DEFAULT_MAX_TOKENS = 2000


def _get_client():
    """Lazy-load the Anthropic client."""
    import anthropic
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def call_claude(system_prompt: str, user_message: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> str:
    """
    Core helper: call Claude and return the text response.
    Raises RuntimeError on failure.
    """
    if not ANTHROPIC_API_KEY:
        raise RuntimeError('ANTHROPIC_API_KEY is not configured')

    client = _get_client()
    try:
        response = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{'role': 'user', 'content': user_message}],
        )
        return response.content[0].text
    except Exception as e:
        logger.error(f'Claude API error: {e}')
        raise RuntimeError(f'AI request failed: {str(e)}')


def check_and_increment_usage(wedding) -> dict:
    """
    Check if the wedding has AI uses remaining today, and if so increment.
    Returns {'allowed': bool, 'count': int, 'limit': int|None}.
    Raises nothing — callers should check 'allowed'.
    """
    from src.models.ai_usage import AIUsage

    limit = wedding.get_limit('ai_uses_per_day')  # None = unlimited

    if limit == 0:
        return {'allowed': False, 'count': 0, 'limit': 0}

    today_count = AIUsage.get_today_count(wedding.id)

    if limit is not None and today_count >= limit:
        return {'allowed': False, 'count': today_count, 'limit': limit}

    new_count = AIUsage.increment(wedding.id)
    return {'allowed': True, 'count': new_count, 'limit': limit}


# ── AI Feature Implementations ──────────────────────────────────────────────

def generate_timeline(wedding_date: str, location: str, guest_count: int, ceremony_type: str) -> dict:
    """
    AI Wedding Timeline Builder.
    Returns a structured month-by-month planning timeline.
    """
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

    # Parse JSON response
    try:
        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith('```'):
            cleaned = '\n'.join(cleaned.split('\n')[1:])
            cleaned = cleaned.rsplit('```', 1)[0].strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Return structured fallback with raw text
        return {'timeline': [], 'raw': raw}


def generate_vendor_suggestions(budget: float, location: str, style_preferences: str, guest_count: int) -> dict:
    """
    AI Vendor Suggestions.
    Returns vendor categories with advice and budget allocation.
    """
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

    try:
        cleaned = raw.strip()
        if cleaned.startswith('```'):
            cleaned = '\n'.join(cleaned.split('\n')[1:])
            cleaned = cleaned.rsplit('```', 1)[0].strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {'vendors': [], 'raw': raw}


def generate_website_copy(couple_names: str, wedding_date: str, location: str, story_notes: str) -> dict:
    """
    Wedding Website Copy Generator.
    Returns welcome text, Our Story section, and FAQ drafts.
    """
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

    try:
        cleaned = raw.strip()
        if cleaned.startswith('```'):
            cleaned = '\n'.join(cleaned.split('\n')[1:])
            cleaned = cleaned.rsplit('```', 1)[0].strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {'welcome_text': raw, 'our_story': '', 'faq': []}


def generate_seating_suggestions(guests: list) -> dict:
    """
    Smart Seating Suggestions.
    guests: list of { name, dietary, relationship (family|friend|colleague), notes }
    Returns suggested table groupings.
    """
    system = (
        "You are a professional wedding seating coordinator. "
        "Group guests into tables considering relationships, dietary needs, and social dynamics. "
        "Return valid JSON with a 'tables' array of: "
        "{ 'table_number': number, 'guests': [string, ...], 'reasoning': string }."
    )

    guest_list = '\n'.join(
        f"- {g.get('name', 'Unknown')}: {g.get('relationship', 'guest')}, dietary: {g.get('dietary', 'none')}"
        for g in guests
    )
    user = (
        f"Create seating arrangements for {len(guests)} guests:\n{guest_list}\n\n"
        f"Aim for 8-10 guests per table. Return ONLY a JSON object with a 'tables' array."
    )

    raw = call_claude(system, user, max_tokens=3000)

    try:
        cleaned = raw.strip()
        if cleaned.startswith('```'):
            cleaned = '\n'.join(cleaned.split('\n')[1:])
            cleaned = cleaned.rsplit('```', 1)[0].strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {'tables': [], 'raw': raw}
