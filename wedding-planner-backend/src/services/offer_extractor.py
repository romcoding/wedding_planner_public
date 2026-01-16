"""
Lightweight offer extraction from unstructured venue documents.

Goal: detect obvious offer lines such as:
- "Dinner menu: 79 € per person"
- "Minimum spend: €5,000"
- "Open bar 45 EUR pp"
"""

import re
from typing import List, Dict, Optional


_CURRENCY_RE = re.compile(r'(?P<cur>€|EUR|USD|CHF|GBP)', re.IGNORECASE)
_AMOUNT_RE = re.compile(r'(?P<amount>\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)')
_PER_PERSON_RE = re.compile(r'\b(per\s*person|per\s*pax|pp|p\.p\.)\b', re.IGNORECASE)
_MIN_SPEND_RE = re.compile(r'\b(minimum\s*spend|min\.\s*spend|mindestumsatz|minimum)\b', re.IGNORECASE)


def _normalize_amount(raw: str) -> Optional[float]:
    """
    Normalize European/US formatted numbers into float.
    Examples:
      "1.200,50" -> 1200.50
      "1,200.50" -> 1200.50
      "1200" -> 1200.0
    """
    if not raw:
        return None

    s = raw.strip()
    # If both separators present, infer decimal by last occurrence.
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'):
            # 1.234,56
            s = s.replace('.', '').replace(',', '.')
        else:
            # 1,234.56
            s = s.replace(',', '')
    else:
        # Only comma: treat comma as decimal if it looks like decimals.
        if ',' in s and re.search(r',\d{1,2}$', s):
            s = s.replace('.', '').replace(',', '.')
        else:
            # Otherwise remove thousands separators
            s = s.replace(',', '')

    try:
        return float(s)
    except Exception:
        return None


def extract_offers_from_text(text: str, max_offers: int = 25) -> List[Dict]:
    """
    Heuristic extractor. Returns list of offer dicts:
      { name, price, currency, unit, price_type, source_line }
    """
    if not text:
        return []

    offers: List[Dict] = []

    # Split by lines; many PDFs turn into line-ish text via pdfminer.
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    for line in lines:
        # Must contain a currency and a number.
        cur_match = _CURRENCY_RE.search(line)
        if not cur_match:
            continue

        amt_match = _AMOUNT_RE.search(line)
        if not amt_match:
            continue

        amount = _normalize_amount(amt_match.group('amount'))
        if amount is None or amount <= 0:
            continue

        currency_raw = cur_match.group('cur').upper()
        currency = 'EUR' if currency_raw == '€' else currency_raw

        unit = None
        if _PER_PERSON_RE.search(line):
            unit = 'per person'

        price_type = 'minimum_spend' if _MIN_SPEND_RE.search(line) else 'fixed'

        # Use left side of line as name when possible.
        name = line
        # Strip trailing price part to get a cleaner name
        name = re.sub(r'[\s:–-]*' + re.escape(cur_match.group(0)) + r'.*$', '', name, flags=re.IGNORECASE).strip() or line
        name = name[:200]

        offers.append({
            'name': name,
            'price': amount,
            'currency': currency,
            'unit': unit,
            'price_type': price_type,
            'source_line': line[:500],
        })

        if len(offers) >= max_offers:
            break

    # De-dupe by (name, price, currency)
    seen = set()
    deduped: List[Dict] = []
    for o in offers:
        key = (o['name'].lower(), o['price'], o['currency'])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(o)

    return deduped

