"""Authoritative server-side validation for the wedding-website content document.

This module is the SINGLE XSS / integrity boundary for website content. The
frontend zod schema (``features/website/siteSchema.js``) mirrors these rules for
UX, but THIS validator is authoritative: every ``PUT /api/website/content`` and
every publish re-validates through here before anything is stored or frozen.

The website is a STRUCTURED-CONTENT system, not freeform HTML. A document is a
fixed, ordered list of typed blocks; themes render those blocks. No user- or
model-authored HTML is ever accepted or stored:

  * allowed keys ONLY — unknown block types or data keys are rejected,
  * every string is plain text with a max length (oversize is rejected),
  * every URL is https-only (http:// and other schemes are rejected),
  * control characters are stripped from every string.

``validate_document`` returns a NORMALIZED document: exactly the canonical
blocks, in canonical order, each cleaned. Missing blocks are filled with empty
defaults so the stored shape is always canonical.
"""
from __future__ import annotations

import re

DOCUMENT_VERSION = 1

# The four shipped themes (token objects live in the frontend themes module;
# the server only needs to validate the selected key).
VALID_THEMES = ("classic", "modern", "botanical", "midnight")
DEFAULT_THEME = "classic"

URL_MAX = 2000  # generous cap for a single https URL

# Control characters to strip from every string. Newlines (\n) and tabs (\t)
# are intentionally preserved for multi-line fields; everything else in the C0
# range plus DEL is removed.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class ValidationError(ValueError):
    """Raised when a content document violates the schema. Maps to HTTP 400."""


# ---------------------------------------------------------------------------
# Field-kind helpers — a small declarative vocabulary the block specs use.
# ---------------------------------------------------------------------------

def _text(max_len: int):
    return ("text", max_len)


def _url():
    return ("url", URL_MAX)


def _bool():
    return ("bool", None)


def _url_list(cap: int):
    return ("url_list", cap)


def _obj_list(cap: int, item_spec: dict):
    return ("obj_list", (cap, item_spec))


# ---------------------------------------------------------------------------
# Block specifications — the contract. Mirror of siteSchema.js.
# ---------------------------------------------------------------------------
# Fixed block order; the document always carries all of them, toggled on/off.
BLOCK_ORDER = (
    "hero", "story", "schedule", "venue", "rsvp",
    "registry", "gallery", "faq", "footer",
)

# Which blocks are enabled by default in a freshly-seeded site.
DEFAULT_ENABLED = {
    "hero": True,
    "story": True,
    "schedule": True,
    "venue": True,
    "rsvp": True,
    "registry": False,
    "gallery": False,
    "faq": False,
    "footer": True,
}

BLOCK_SPECS: dict[str, dict] = {
    "hero": {
        "coupleNames": _text(200),
        "tagline": _text(300),
        "date": _text(100),
        "heroImageUrl": _url(),
        "showCountdown": _bool(),
    },
    "story": {
        "title": _text(200),
        "body": _text(2000),
        "photos": _url_list(6),
    },
    "schedule": {
        "title": _text(200),
        "events": _obj_list(12, {
            "time": _text(100),
            "title": _text(200),
            "location": _text(200),
            "description": _text(1000),
        }),
    },
    "venue": {
        "title": _text(200),
        "venueName": _text(200),
        "address": _text(500),
        "mapsUrl": _url(),
        "directions": _text(2000),
    },
    "rsvp": {
        "title": _text(200),
        "deadline": _text(100),
        "note": _text(1000),
    },
    "registry": {
        "title": _text(200),
        "note": _text(1000),
        "links": _obj_list(8, {
            "label": _text(120),
            "url": _url(),
        }),
    },
    "gallery": {
        "title": _text(200),
        "photos": _url_list(16),
    },
    "faq": {
        "title": _text(200),
        "items": _obj_list(12, {
            "q": _text(300),
            "a": _text(2000),
        }),
    },
    "footer": {
        "note": _text(500),
    },
}

# Defensive upper bound on how many blocks an input may carry before we even
# look at them (the canonical document only ever has len(BLOCK_ORDER)).
_MAX_INPUT_BLOCKS = 50


# ---------------------------------------------------------------------------
# Scalar cleaners
# ---------------------------------------------------------------------------

def _clean_control(value: str) -> str:
    """Strip control chars (keeping \\n, \\t) and normalize newlines."""
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    return _CONTROL_RE.sub("", value)


def _clean_text(field: str, value, max_len: int) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string")
    cleaned = _clean_control(value).strip()
    if len(cleaned) > max_len:
        raise ValidationError(f"{field} exceeds max length of {max_len}")
    return cleaned


def _clean_url(field: str, value, max_len: int = URL_MAX) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string")
    cleaned = _clean_control(value).strip()
    if cleaned == "":
        return ""
    if any(c.isspace() for c in cleaned):
        raise ValidationError(f"{field} must not contain whitespace")
    if not cleaned.lower().startswith("https://"):
        raise ValidationError(f"{field} must be an https:// URL")
    if len(cleaned) > max_len:
        raise ValidationError(f"{field} exceeds max length of {max_len}")
    return cleaned


def _clean_bool(field: str, value) -> bool:
    if not isinstance(value, bool):
        raise ValidationError(f"{field} must be a boolean")
    return value


def _clean_field(field: str, kind: str, param, value):
    """Validate a single scalar/leaf field by kind."""
    if kind == "text":
        return _clean_text(field, value, param)
    if kind == "url":
        return _clean_url(field, value, param)
    if kind == "bool":
        return _clean_bool(field, value)
    raise ValidationError(f"{field} has an unsupported field kind")  # pragma: no cover


def _empty_for(kind: str):
    if kind == "text":
        return ""
    if kind == "url":
        return ""
    if kind == "bool":
        return False
    if kind == "url_list":
        return []
    if kind == "obj_list":
        return []
    raise ValidationError("unsupported field kind")  # pragma: no cover


# ---------------------------------------------------------------------------
# Block-data validation
# ---------------------------------------------------------------------------

def _validate_block_data(block_type: str, data) -> dict:
    if not isinstance(data, dict):
        raise ValidationError(f"{block_type}.data must be an object")
    spec = BLOCK_SPECS[block_type]
    unknown = set(data) - set(spec)
    if unknown:
        raise ValidationError(
            f"unknown key(s) in {block_type}: {', '.join(sorted(unknown))}"
        )

    out: dict = {}
    for field, (kind, param) in spec.items():
        prefixed = f"{block_type}.{field}"
        if field not in data or data[field] is None:
            out[field] = _empty_for(kind)
            continue
        value = data[field]
        if kind in ("text", "url", "bool"):
            out[field] = _clean_field(prefixed, kind, param, value)
        elif kind == "url_list":
            cap = param
            if not isinstance(value, list):
                raise ValidationError(f"{prefixed} must be a list")
            if len(value) > cap:
                raise ValidationError(f"{prefixed} allows at most {cap} items")
            cleaned_list = []
            for i, item in enumerate(value):
                url = _clean_url(f"{prefixed}[{i}]", item)
                if url:  # silently drop blank entries; reject invalid ones
                    cleaned_list.append(url)
            out[field] = cleaned_list
        elif kind == "obj_list":
            cap, item_spec = param
            if not isinstance(value, list):
                raise ValidationError(f"{prefixed} must be a list")
            if len(value) > cap:
                raise ValidationError(f"{prefixed} allows at most {cap} items")
            cleaned_items = []
            for i, item in enumerate(value):
                if not isinstance(item, dict):
                    raise ValidationError(f"{prefixed}[{i}] must be an object")
                extra = set(item) - set(item_spec)
                if extra:
                    raise ValidationError(
                        f"unknown key(s) in {prefixed}[{i}]: {', '.join(sorted(extra))}"
                    )
                obj: dict = {}
                for sub_field, (sub_kind, sub_param) in item_spec.items():
                    sub_prefixed = f"{prefixed}[{i}].{sub_field}"
                    sub_val = item.get(sub_field)
                    if sub_val is None:
                        obj[sub_field] = _empty_for(sub_kind)
                    else:
                        obj[sub_field] = _clean_field(sub_prefixed, sub_kind, sub_param, sub_val)
                cleaned_items.append(obj)
            out[field] = cleaned_items
    return out


def _empty_block_data(block_type: str) -> dict:
    return {field: _empty_for(kind) for field, (kind, _p) in BLOCK_SPECS[block_type].items()}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_document(raw) -> dict:
    """Validate and normalize a content document.

    Returns a canonical document: ``{"version": 1, "blocks": [...]}`` with
    exactly the blocks in ``BLOCK_ORDER``, each cleaned. Raises
    ``ValidationError`` on any unknown key/type, oversize string, non-https URL,
    or malformed structure.
    """
    if not isinstance(raw, dict):
        raise ValidationError("content must be an object")

    version = raw.get("version", DOCUMENT_VERSION)
    if version != DOCUMENT_VERSION:
        raise ValidationError(f"unsupported content version: {version!r}")

    blocks_in = raw.get("blocks", [])
    if not isinstance(blocks_in, list):
        raise ValidationError("blocks must be a list")
    if len(blocks_in) > _MAX_INPUT_BLOCKS:
        raise ValidationError("too many blocks")

    provided: dict[str, dict] = {}
    for block in blocks_in:
        if not isinstance(block, dict):
            raise ValidationError("each block must be an object")
        extra = set(block) - {"type", "enabled", "data"}
        if extra:
            raise ValidationError(f"unknown block key(s): {', '.join(sorted(extra))}")
        block_type = block.get("type")
        if block_type not in BLOCK_SPECS:
            raise ValidationError(f"unknown block type: {block_type!r}")
        if block_type in provided:
            raise ValidationError(f"duplicate block: {block_type}")
        provided[block_type] = block

    out_blocks = []
    for block_type in BLOCK_ORDER:
        block = provided.get(block_type)
        if block is None:
            out_blocks.append({
                "type": block_type,
                "enabled": DEFAULT_ENABLED[block_type],
                "data": _empty_block_data(block_type),
            })
            continue
        enabled = block.get("enabled", True)
        if not isinstance(enabled, bool):
            raise ValidationError(f"{block_type}.enabled must be a boolean")
        out_blocks.append({
            "type": block_type,
            "enabled": enabled,
            "data": _validate_block_data(block_type, block.get("data", {})),
        })

    return {"version": DOCUMENT_VERSION, "blocks": out_blocks}


def default_document(wedding: dict | None = None) -> dict:
    """Build a canonical starter document, seeding hero/venue from wedding data.

    The result is passed through ``validate_document`` so a freshly-seeded site
    is guaranteed to be canonical and valid.
    """
    wedding = wedding or {}
    p1 = (wedding.get("partner_one_name") or "").strip()
    p2 = (wedding.get("partner_two_name") or "").strip()
    couple = " & ".join([n for n in (p1, p2) if n]) or "Our Wedding"
    date = (wedding.get("wedding_date") or "").strip()
    location = (wedding.get("location") or "").strip()

    seeded = {
        "hero": {
            "coupleNames": couple,
            "tagline": "We're getting married!",
            "date": date,
            "heroImageUrl": "",
            "showCountdown": True,
        },
        "story": {"title": "Our Story", "body": "", "photos": []},
        "schedule": {"title": "Schedule", "events": []},
        "venue": {"title": "Venue", "venueName": "", "address": location,
                  "mapsUrl": "", "directions": ""},
        "rsvp": {"title": "RSVP", "deadline": "", "note": ""},
        "registry": {"title": "Registry", "note": "", "links": []},
        "gallery": {"title": "Gallery", "photos": []},
        "faq": {"title": "FAQ", "items": []},
        "footer": {"note": f"{couple}"},
    }

    blocks = [
        {"type": t, "enabled": DEFAULT_ENABLED[t], "data": seeded[t]}
        for t in BLOCK_ORDER
    ]
    return validate_document({"version": DOCUMENT_VERSION, "blocks": blocks})
