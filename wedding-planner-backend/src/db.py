"""Shared Cloudflare D1 (Pyodide) row helpers.

D1's ``.first()`` / ``.all()`` return ``JsProxy`` objects, not Python dicts.
Subscripting a JsProxy directly (``row["x"]``) raises on some return shapes, so
every row must be normalized first. These are the single, hardened conversion
path (promoted from the per-file ``_row_to_dict`` that production needed).
"""


def row_to_dict(row):
    """Normalize a single D1 row to a dict, or None.

    Tries ``row.to_py()`` first (the Pyodide-correct path), then falls back to
    ``dict(row)``. Returns None for a None row (e.g. a missing ``.first()``).
    """
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    to_py = getattr(row, "to_py", None)
    if callable(to_py):
        try:
            converted = to_py()
        except Exception:
            converted = None
        if isinstance(converted, dict):
            return converted
    try:
        return dict(row)
    except Exception as exc:
        raise TypeError(f"Unexpected D1 row format: {type(row).__name__}") from exc


def rows_to_list(result):
    """Normalize a D1 ``.all()`` result (or row iterable) to a list[dict]."""
    if result is None:
        return []
    rows = getattr(result, "results", None)
    if rows is None:
        rows = result  # already an iterable of rows
    return [row_to_dict(r) for r in (rows or [])]
