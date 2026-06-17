"""Server-side HTML renderer for published wedding websites.

The public site is SERVER-RENDERED static HTML by the backend worker from
``wedding_sites.published_snapshot`` — never the SPA, never the draft. This
module is the Python mirror of the React renderer
(features/website/themes/{SiteRenderer,blocks}.jsx + tokens.js); both read the
SAME theme tokens (services/themes.py <- shared/themes.json) so the published
page is visually faithful to the editor preview.

Security: this is a defense-in-depth boundary. ``site_schema`` already validated
the document at save/publish time, but EVERY string here is still
``html.escape``-d and every URL re-checked https-only, so a snapshot tampered
with at the DB level (the P4 test injects ``<script>`` directly) can never
produce executable markup. No framework JS is shipped to guests — only a few
lines of inline vanilla JS for scroll-reveal, the countdown and the RSVP form.
"""
from __future__ import annotations

import html
import json
import os

from services import site_schema
from services.themes import get_theme

# Blocks whose <section> uses the alt (page) background instead of the surface
# colour — mirrors the per-block ``alt`` flag in blocks.jsx so the light/dark
# banding matches the editor preview exactly.
_ALT_BLOCKS = {"story", "venue", "registry", "faq"}

_DEFAULT_TITLES = {
    "story": "Our Story",
    "schedule": "Schedule",
    "venue": "Venue",
    "rsvp": "RSVP",
    "registry": "Registry",
    "gallery": "Gallery",
    "faq": "FAQ",
}


# ---------------------------------------------------------------------------
# Escaping helpers — the renderer NEVER emits an un-escaped string or a
# non-https URL, regardless of what the snapshot contains.
# ---------------------------------------------------------------------------

def _esc(value) -> str:
    """HTML-escape any value (quotes included) for safe element/attribute use."""
    if value is None:
        return ""
    return html.escape(str(value), quote=True)


def _safe_url(value) -> str:
    """Return *value* only if it is a clean https:// URL, else ""."""
    if not isinstance(value, str):
        return ""
    v = value.strip()
    if not v or any(c.isspace() for c in v):
        return ""
    if not v.lower().startswith("https://"):
        return ""
    return v


def _attr_url(value) -> str:
    """A safe https URL, html-escaped for use inside a quoted attribute."""
    return _esc(_safe_url(value))


def _landing_url() -> str:
    """Marketing landing URL for the tasteful 'Made with Wedi' footer credit."""
    return (
        os.environ.get("WEDI_LANDING_URL")
        or os.environ.get("FRONTEND_URL")
        or "https://wedding-planner-frontend.romanhess1994.workers.dev"
    )


# ---------------------------------------------------------------------------
# CSS — generated from the theme tokens. Critical CSS is inlined (no external
# stylesheet request); the named display fonts degrade to the system stack so
# guests pay for zero web-font downloads.
# ---------------------------------------------------------------------------

def _css_variables(tokens: dict) -> str:
    c = tokens["colors"]
    s = tokens["spacing"]
    f = tokens["fonts"]
    d = tokens["divider"]
    on_primary = c["bg"] if tokens.get("mode") == "dark" else "#FFFFFF"
    pairs = {
        "--bg": c["bg"],
        "--surface": c["surface"],
        "--text": c["text"],
        "--muted": c["muted"],
        "--primary": c["primary"],
        "--accent": c["accent"],
        "--border": c["border"],
        "--hero-overlay": c["heroOverlay"],
        "--on-hero": c["onHero"],
        "--on-primary": on_primary,
        "--font-heading": f["heading"],
        "--font-body": f["body"],
        "--section": s["section"],
        "--block-gap": s["blockGap"],
        "--radius": s["radius"],
        "--max-width": s["maxWidth"],
        "--divider": d["color"],
    }
    return ";".join(f"{k}:{v}" for k, v in pairs.items())


# Static stylesheet (mirrors the inline styles in blocks.jsx). Plain string so
# the literal CSS braces don't collide with f-string interpolation; all
# theme-specific values come through the var(--…) custom properties above.
_STATIC_CSS = """
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-body);line-height:1.7;font-size:16px}
img{max-width:100%;display:block}
a{color:inherit}
.section{padding:var(--section) 24px;background:var(--surface)}
.section.alt{background:var(--bg)}
.container{max-width:var(--max-width);margin:0 auto}
.title{font-family:var(--font-heading);color:var(--primary);font-size:clamp(1.5rem,3vw,2.2rem);text-align:center;margin:0;font-weight:600}
.divider{margin:12px auto 26px;display:flex;align-items:center;justify-content:center;gap:8px}
.divider-rule .divider-bar{width:90px;height:1px;background:var(--divider)}
.divider-plain .divider-bar{width:44px;height:2px;background:var(--divider)}
.divider-leaf .divider-line{height:1px;width:40px;background:var(--divider)}
.divider-leaf .divider-dot{width:7px;height:7px;border-radius:9999px;background:var(--divider)}
.body-text{font-family:var(--font-body);color:var(--text);font-size:1rem;line-height:1.7}
.center{text-align:center}
.pre-line{white-space:pre-line}
.button{display:inline-block;padding:10px 20px;border-radius:var(--radius);background:var(--primary);color:var(--on-primary);text-decoration:none;font-family:var(--font-body);font-size:.95rem;border:none;cursor:pointer}
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:20px}
.photo-grid img{width:100%;height:150px;object-fit:cover;border-radius:var(--radius);border:1px solid var(--border)}
.hero{position:relative;padding:var(--section) 24px;text-align:center;overflow:hidden;background:var(--surface)}
.hero.has-img{background:var(--text)}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-overlay{position:absolute;inset:0;background:var(--hero-overlay)}
.hero-content{position:relative;color:var(--text)}
.hero.has-img .hero-content{color:var(--on-hero)}
.hero h1{font-family:var(--font-heading);font-size:clamp(2rem,5.5vw,3.6rem);margin:0;letter-spacing:.02em;font-weight:600}
.hero .tagline{font-family:var(--font-body);font-size:1.15rem;margin-top:14px;opacity:.95}
.hero .date{font-family:var(--font-body);margin-top:10px;letter-spacing:.12em;text-transform:uppercase;font-size:.82rem}
.hero .countdown{margin-top:18px;font-family:var(--font-heading);font-size:1.5rem;color:var(--primary)}
.hero.has-img .countdown{color:var(--on-hero)}
.stack{display:flex;flex-direction:column;gap:var(--block-gap)}
.event{display:flex;gap:16px;align-items:baseline;border-bottom:1px solid var(--border);padding-bottom:14px}
.event-time{min-width:92px;font-family:var(--font-body);color:var(--accent);font-size:.95rem;font-weight:600}
.event-title{font-family:var(--font-heading);color:var(--text);font-size:1.15rem}
.event-location{font-family:var(--font-body);color:var(--muted);font-size:.9rem}
.event-desc{font-size:.95rem;margin-top:4px}
.venue-name{font-family:var(--font-heading);font-size:1.3rem;color:var(--text)}
.venue-address{color:var(--muted);margin-top:6px}
.muted-note{color:var(--muted)}
.deadline{font-family:var(--font-body);color:var(--accent);margin-top:10px;font-weight:600}
.links{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:18px}
.faq-q{font-family:var(--font-heading);color:var(--text);font-size:1.1rem}
.site-footer{background:var(--bg);padding:40px 24px;text-align:center}
.footer-note{font-family:var(--font-heading);color:var(--muted);font-size:1rem;letter-spacing:.04em}
.footer-credit{margin-top:14px;font-family:var(--font-body);font-size:.8rem}
.footer-credit a{color:var(--muted);text-decoration:none;border-bottom:1px solid var(--border)}
.rsvp-form{max-width:440px;margin:18px auto 0;text-align:left}
.rsvp-form .field{margin-bottom:14px}
.rsvp-form label{display:block;font-family:var(--font-body);font-size:.82rem;color:var(--muted);margin-bottom:6px}
.rsvp-form input[type=text],.rsvp-form input[type=email],.rsvp-form input[type=number],.rsvp-form textarea{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);font-family:var(--font-body);font-size:1rem;background:var(--surface);color:var(--text)}
.rsvp-form textarea{min-height:84px;resize:vertical}
.rsvp-choice{display:flex;gap:18px;align-items:center}
.rsvp-choice label{display:inline-flex;align-items:center;gap:6px;margin:0;color:var(--text);font-size:.95rem}
.rsvp-actions{margin-top:8px;text-align:center}
.rsvp-result{margin-top:14px;text-align:center;font-family:var(--font-body)}
.rsvp-result.ok{color:var(--primary)}
.rsvp-result.err{color:#b3261e}
.hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}
.reveal{opacity:1}
.js .reveal{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease}
.js .reveal.is-visible{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){.js .reveal{opacity:1;transform:none;transition:none}}
@media (max-width:540px){.event{flex-direction:column;gap:2px}.event-time{min-width:0}}
"""


def _style_tag(tokens: dict) -> str:
    return "<style>:root{" + _css_variables(tokens) + "}" + _STATIC_CSS + "</style>"


# ---------------------------------------------------------------------------
# Block renderers — one per block type, mirroring blocks.jsx.
# ---------------------------------------------------------------------------

def _divider(tokens: dict) -> str:
    style = (tokens.get("divider") or {}).get("style", "rule")
    if style == "leaf":
        return ('<div class="divider divider-leaf">'
                '<span class="divider-line"></span>'
                '<span class="divider-dot"></span>'
                '<span class="divider-line"></span></div>')
    cls = "divider-plain" if style == "plain" else "divider-rule"
    return f'<div class="divider {cls}"><span class="divider-bar"></span></div>'


def _title(text: str) -> str:
    return f'<h2 class="title">{_esc(text)}</h2>'


def _photo_grid(photos) -> str:
    urls = [_attr_url(p) for p in (photos or [])]
    urls = [u for u in urls if u]
    if not urls:
        return ""
    imgs = "".join(f'<img src="{u}" alt="" loading="lazy">' for u in urls)
    return f'<div class="photo-grid">{imgs}</div>'


def _section(tokens, block_type, inner) -> str:
    alt = " alt" if block_type in _ALT_BLOCKS else ""
    return (f'<section class="section{alt} reveal">'
            f'<div class="container">{inner}</div></section>')


def _render_hero(data, tokens) -> str:
    img = _safe_url(data.get("heroImageUrl"))
    has_img = " has-img" if img else ""
    parts = [f'<h1>{_esc(data.get("coupleNames"))}</h1>']
    if data.get("tagline"):
        parts.append(f'<p class="tagline">{_esc(data.get("tagline"))}</p>')
    date = data.get("date")
    if date:
        parts.append(f'<p class="date">{_esc(date)}</p>')
    if data.get("showCountdown") and date:
        days = _days_until(date)
        # Render an initial server-side value; the inline JS keeps a cached page
        # accurate by recomputing from data-wedding-date.
        if days is not None and days >= 0:
            label = "Today is the day" if days == 0 else f"{days} days to go"
            parts.append(
                f'<p class="countdown" data-wedding-date="{_esc(date)}">{_esc(label)}</p>'
            )
        else:
            parts.append(
                f'<p class="countdown" data-wedding-date="{_esc(date)}" style="display:none"></p>'
            )
    overlay = '<div class="hero-overlay"></div>' if img else ""
    img_tag = f'<img class="hero-img" src="{_esc(img)}" alt="">' if img else ""
    return (f'<section class="hero{has_img} reveal">{img_tag}{overlay}'
            f'<div class="hero-content">{"".join(parts)}</div></section>')


def _render_story(data, tokens) -> str:
    inner = [_title(data.get("title") or "Our Story"), _divider(tokens)]
    if data.get("body"):
        inner.append(f'<p class="body-text pre-line center">{_esc(data.get("body"))}</p>')
    inner.append(_photo_grid(data.get("photos")))
    return _section(tokens, "story", "".join(inner))


def _render_schedule(data, tokens) -> str:
    rows = []
    for ev in (data.get("events") or []):
        if not isinstance(ev, dict):
            continue
        detail = [f'<div class="event-title">{_esc(ev.get("title"))}</div>']
        if ev.get("location"):
            detail.append(f'<div class="event-location">{_esc(ev.get("location"))}</div>')
        if ev.get("description"):
            detail.append(f'<div class="body-text event-desc">{_esc(ev.get("description"))}</div>')
        rows.append(
            f'<div class="event"><div class="event-time">{_esc(ev.get("time"))}</div>'
            f'<div>{"".join(detail)}</div></div>'
        )
    inner = [_title(data.get("title") or "Schedule"), _divider(tokens),
             f'<div class="stack">{"".join(rows)}</div>']
    return _section(tokens, "schedule", "".join(inner))


def _render_venue(data, tokens) -> str:
    body = []
    if data.get("venueName"):
        body.append(f'<div class="venue-name">{_esc(data.get("venueName"))}</div>')
    if data.get("address"):
        body.append(f'<div class="body-text venue-address">{_esc(data.get("address"))}</div>')
    if data.get("directions"):
        body.append(f'<p class="body-text pre-line" style="margin-top:12px">{_esc(data.get("directions"))}</p>')
    maps = _attr_url(data.get("mapsUrl"))
    if maps:
        body.append(f'<div style="margin-top:18px"><a class="button" href="{maps}" '
                    f'target="_blank" rel="noreferrer noopener">View on map</a></div>')
    inner = [_title(data.get("title") or "Venue"), _divider(tokens),
             f'<div class="center">{"".join(body)}</div>']
    return _section(tokens, "venue", "".join(inner))


def _render_rsvp(data, tokens, *, slug, base_url, rsvp_enabled) -> str:
    inner = [_title(data.get("title") or "RSVP"), _divider(tokens)]
    note_block = ['<div class="center">']
    if data.get("note"):
        note_block.append(f'<p class="body-text pre-line">{_esc(data.get("note"))}</p>')
    if data.get("deadline"):
        note_block.append(f'<p class="deadline">Please respond by {_esc(data.get("deadline"))}</p>')
    note_block.append("</div>")
    inner.append("".join(note_block))
    if rsvp_enabled:
        inner.append(_rsvp_form(slug, base_url))
    return _section(tokens, "rsvp", "".join(inner))


def _rsvp_form(slug, base_url) -> str:
    endpoint = f"{base_url.rstrip('/')}/api/public/rsvp/{_esc(slug)}"
    return (
        f'<form class="rsvp-form" data-rsvp-endpoint="{_esc(endpoint)}" novalidate>'
        '<div class="field"><label for="rsvp-name">Your name</label>'
        '<input id="rsvp-name" name="guest_name" type="text" maxlength="120" required></div>'
        '<div class="field"><label for="rsvp-email">Email (optional)</label>'
        '<input id="rsvp-email" name="email" type="email" maxlength="200"></div>'
        '<div class="field"><label>Will you join us?</label>'
        '<div class="rsvp-choice">'
        '<label><input type="radio" name="attending" value="yes" checked> Joyfully accepts</label>'
        '<label><input type="radio" name="attending" value="no"> Regretfully declines</label>'
        '</div></div>'
        '<div class="field"><label for="rsvp-party">Number of guests</label>'
        '<input id="rsvp-party" name="party_size" type="number" min="1" max="10" value="1"></div>'
        '<div class="field"><label for="rsvp-dietary">Dietary needs (optional)</label>'
        '<input id="rsvp-dietary" name="dietary" type="text" maxlength="300"></div>'
        '<div class="field"><label for="rsvp-message">A note for the couple (optional)</label>'
        '<textarea id="rsvp-message" name="message" maxlength="500"></textarea></div>'
        # Honeypot: real guests never see or fill this; a non-empty value is dropped.
        '<div class="hp" aria-hidden="true">'
        '<label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></div>'
        '<div class="rsvp-actions"><button type="submit" class="button">Send RSVP</button></div>'
        '<div class="rsvp-result" role="status" aria-live="polite"></div>'
        '</form>'
    )


def _render_registry(data, tokens) -> str:
    body = ['<div class="center">']
    if data.get("note"):
        body.append(f'<p class="body-text pre-line">{_esc(data.get("note"))}</p>')
    links = []
    for link in (data.get("links") or []):
        if not isinstance(link, dict):
            continue
        url = _attr_url(link.get("url"))
        if not url:
            continue
        label = _esc(link.get("label") or "View registry")
        links.append(f'<a class="button" href="{url}" target="_blank" rel="noreferrer noopener">{label}</a>')
    body.append(f'<div class="links">{"".join(links)}</div></div>')
    inner = [_title(data.get("title") or "Registry"), _divider(tokens), "".join(body)]
    return _section(tokens, "registry", "".join(inner))


def _render_gallery(data, tokens) -> str:
    inner = [_title(data.get("title") or "Gallery"), _divider(tokens),
             _photo_grid(data.get("photos"))]
    return _section(tokens, "gallery", "".join(inner))


def _render_faq(data, tokens) -> str:
    items = []
    for item in (data.get("items") or []):
        if not isinstance(item, dict):
            continue
        block = [f'<div class="faq-q">{_esc(item.get("q"))}</div>']
        if item.get("a"):
            block.append(f'<div class="body-text pre-line" style="margin-top:4px">{_esc(item.get("a"))}</div>')
        items.append(f'<div>{"".join(block)}</div>')
    inner = [_title(data.get("title") or "FAQ"), _divider(tokens),
             f'<div class="stack">{"".join(items)}</div>']
    return _section(tokens, "faq", "".join(inner))


def _render_footer(data, tokens) -> str:
    note = _esc(data.get("note"))
    credit = (f'<div class="footer-credit"><a href="{_attr_url(_landing_url())}" '
              f'target="_blank" rel="noreferrer noopener">Made with Wedi</a></div>')
    return (f'<footer class="site-footer reveal"><div class="footer-note">{note}</div>'
            f'{credit}</footer>')


_BLOCK_RENDERERS = {
    "hero": _render_hero,
    "story": _render_story,
    "schedule": _render_schedule,
    "venue": _render_venue,
    "registry": _render_registry,
    "gallery": _render_gallery,
    "faq": _render_faq,
}


# ---------------------------------------------------------------------------
# Date / countdown helper (server-side seed; the inline JS recomputes)
# ---------------------------------------------------------------------------

def _days_until(date_str):
    """Best-effort days from today to *date_str* (ISO-ish), or None.

    The hero ``date`` is free text, so this only parses an unambiguous leading
    ISO date; anything else falls to the client-side ``new Date()`` recompute.
    """
    from datetime import date, datetime
    if not isinstance(date_str, str):
        return None
    head = date_str.strip()[:10]
    try:
        target = datetime.strptime(head, "%Y-%m-%d").date()
    except ValueError:
        return None
    return (target - date.today()).days


# ---------------------------------------------------------------------------
# Inline JS — scroll-reveal, live countdown, RSVP submit. No frameworks.
# ---------------------------------------------------------------------------

_SITE_JS = """
(function(){
  var d=document, root=d.documentElement;
  root.classList.add('js');
  var reveal=function(){
    var els=d.querySelectorAll('.reveal');
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){
        if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}});},
        {threshold:0.12});
      els.forEach(function(el){io.observe(el);});
    } else {els.forEach(function(el){el.classList.add('is-visible');});}
  };
  var countdown=function(){
    var el=d.querySelector('[data-wedding-date]');
    if(!el)return;
    var t=new Date(el.getAttribute('data-wedding-date'));
    if(isNaN(t.getTime()))return;
    var a=new Date(t);a.setHours(0,0,0,0);
    var b=new Date();b.setHours(0,0,0,0);
    var days=Math.round((a-b)/86400000);
    if(days<0){el.style.display='none';return;}
    el.style.display='';
    el.textContent=days===0?'Today is the day':days+' days to go';
  };
  var rsvp=function(){
    var form=d.querySelector('.rsvp-form');
    if(!form)return;
    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      var result=form.querySelector('.rsvp-result');
      var btn=form.querySelector('button[type=submit]');
      var attendingEl=form.querySelector('input[name=attending]:checked');
      var payload={
        guest_name:(form.guest_name.value||'').trim(),
        email:(form.email.value||'').trim(),
        attending:attendingEl?attendingEl.value==='yes':true,
        party_size:parseInt(form.party_size.value,10)||1,
        dietary:(form.dietary.value||'').trim(),
        message:(form.message.value||'').trim(),
        website:form.website.value||''
      };
      btn.disabled=true;result.className='rsvp-result';result.textContent='Sending…';
      fetch(form.getAttribute('data-rsvp-endpoint'),{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
      }).then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {ok:r.ok,j:j};});})
      .then(function(res){
        if(res.ok){
          form.querySelectorAll('input,textarea,button').forEach(function(el){el.disabled=true;});
          result.className='rsvp-result ok';
          result.textContent=(res.j&&res.j.message)||'Thank you — see you there!';
        } else {
          btn.disabled=false;
          var msg=(res.j&&(res.j.error||(res.j.detail&&(res.j.detail.error||res.j.detail))))||'Something went wrong — please try again.';
          result.className='rsvp-result err';
          result.textContent=typeof msg==='string'?msg:'Please check your details and try again.';
        }
      }).catch(function(){
        btn.disabled=false;result.className='rsvp-result err';
        result.textContent='Something went wrong — please try again.';
      });
    });
  };
  reveal();countdown();rsvp();
})();
"""


# ---------------------------------------------------------------------------
# Document assembly
# ---------------------------------------------------------------------------

def _blocks_by_type(snapshot: dict) -> dict:
    out = {}
    for block in (snapshot.get("blocks") or []):
        if isinstance(block, dict) and block.get("type") in site_schema.BLOCK_SPECS:
            out[block["type"]] = block
    return out


def _hero_data(by_type: dict) -> dict:
    hero = by_type.get("hero") or {}
    return hero.get("data") or {} if isinstance(hero, dict) else {}


def _document(*, head: str, body: str, lang="en") -> str:
    return (f'<!doctype html><html lang="{lang}"><head>{head}</head>'
            f'<body>{body}</body></html>')


# A tiny inline SVG favicon (interlocking rings) — no external favicon request.
_FAVICON = (
    'data:image/svg+xml,'
    '%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E'
    '%3Ccircle%20cx%3D%2213%22%20cy%3D%2218%22%20r%3D%228%22%20fill%3D%22none%22%20stroke%3D%22%23B08D57%22%20stroke-width%3D%222%22%2F%3E'
    '%3Ccircle%20cx%3D%2220%22%20cy%3D%2214%22%20r%3D%228%22%20fill%3D%22none%22%20stroke%3D%22%236E5C43%22%20stroke-width%3D%222%22%2F%3E'
    '%3C%2Fsvg%3E'
)


def _head(*, title, description, og_url, og_image, robots="index, follow", tokens=None) -> str:
    parts = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f'<title>{_esc(title)}</title>',
        f'<meta name="robots" content="{_esc(robots)}">',
        f'<link rel="icon" href="{_FAVICON}">',
    ]
    if description:
        parts.append(f'<meta name="description" content="{_esc(description)}">')
    # Open Graph (link previews in chat apps).
    parts.append('<meta property="og:type" content="website">')
    parts.append(f'<meta property="og:title" content="{_esc(title)}">')
    if description:
        parts.append(f'<meta property="og:description" content="{_esc(description)}">')
    if og_url:
        parts.append(f'<meta property="og:url" content="{_esc(og_url)}">')
    og_img = _safe_url(og_image)
    if og_img:
        parts.append(f'<meta property="og:image" content="{_esc(og_img)}">')
        parts.append('<meta name="twitter:card" content="summary_large_image">')
    else:
        parts.append('<meta name="twitter:card" content="summary">')
    if tokens is not None:
        parts.append(_style_tag(tokens))
    return "".join(parts)


def render_site(snapshot: dict, theme: str, slug: str, base_url: str,
                rsvp_enabled: bool = True) -> str:
    """Render a published site's snapshot to a full HTML document.

    *snapshot* is the validated content document (``{version, blocks:[…]}``);
    *theme* selects the token set; *slug* + *base_url* build the canonical
    og:url and the RSVP endpoint. Every string is escaped and every URL
    re-validated here regardless of upstream validation.
    """
    if not isinstance(snapshot, dict):
        snapshot = {}
    tokens = get_theme(theme)
    by_type = _blocks_by_type(snapshot)

    # <head> metadata sourced from the hero block.
    hero = _hero_data(by_type)
    couple = (hero.get("coupleNames") or "Our Wedding").strip() or "Our Wedding"
    date = (hero.get("date") or "").strip()
    title = f"{couple} — {date}" if date else couple
    description = (hero.get("tagline") or "").strip()
    base = (base_url or "").rstrip("/")
    og_url = f"{base}/s/{slug}" if base else ""

    body_parts = []
    for block_type in site_schema.BLOCK_ORDER:
        block = by_type.get(block_type)
        if not isinstance(block, dict) or not block.get("enabled"):
            continue
        data = block.get("data") or {}
        if not isinstance(data, dict):
            data = {}
        if block_type == "rsvp":
            body_parts.append(_render_rsvp(data, tokens, slug=slug, base_url=base,
                                           rsvp_enabled=rsvp_enabled))
        elif block_type == "footer":
            body_parts.append(_render_footer(data, tokens))
        else:
            renderer = _BLOCK_RENDERERS.get(block_type)
            if renderer:
                body_parts.append(renderer(data, tokens))

    head = _head(title=title, description=description, og_url=og_url,
                 og_image=hero.get("heroImageUrl"), robots="index, follow",
                 tokens=tokens)
    body = "".join(body_parts) + f"<script>{_SITE_JS}</script>"
    return _document(head=head, body=body)


# ---------------------------------------------------------------------------
# Password gate + 404 — on-brand, calm, no debug/stack text.
# ---------------------------------------------------------------------------

def _shell_page(*, title, robots, inner) -> str:
    tokens = get_theme(site_schema.DEFAULT_THEME)
    head = _head(title=title, description="", og_url="", og_image="",
                 robots=robots, tokens=tokens)
    body = (
        '<section class="hero"><div class="hero-content" style="max-width:480px;margin:0 auto">'
        f'{inner}</div></section>'
        f'<footer class="site-footer"><div class="footer-credit">'
        f'<a href="{_attr_url(_landing_url())}" target="_blank" rel="noreferrer noopener">Made with Wedi</a>'
        '</div></footer>'
    )
    return _document(head=head, body=body)


def render_password_page(slug: str, base_url: str, error: bool = False) -> str:
    """A minimal, calm password gate for a protected published site."""
    action = f"{(base_url or '').rstrip('/')}/s/{_esc(slug)}"
    err = ('<p class="body-text" style="color:#b3261e;margin-top:8px">'
           'That password didn\'t match. Please try again.</p>') if error else ""
    inner = (
        '<h1 style="font-size:clamp(1.6rem,4vw,2.4rem)">This website is private</h1>'
        '<p class="body-text" style="margin-top:10px">Enter the password the couple shared with you.</p>'
        f'<form method="post" action="{_esc(action)}" class="rsvp-form" style="max-width:340px">'
        '<div class="field"><label for="pw">Password</label>'
        '<input id="pw" name="password" type="password" autocomplete="current-password" required '
        'style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);'
        'font-size:1rem;background:var(--surface);color:var(--text)"></div>'
        f'{err}'
        '<div class="rsvp-actions" style="margin-top:8px">'
        '<button type="submit" class="button">View website</button></div>'
        '</form>'
    )
    return _shell_page(title="Private wedding website", robots="noindex, nofollow", inner=inner)


def render_not_found_page(base_url: str = "") -> str:
    """A friendly 404 for an unknown / unpublished / draft slug."""
    inner = (
        '<h1 style="font-size:clamp(1.8rem,4vw,2.6rem)">This page isn\'t here</h1>'
        '<p class="body-text" style="margin-top:12px">'
        'The wedding website you\'re looking for may have moved or isn\'t published yet. '
        'Please double-check the link the couple shared with you.</p>'
    )
    return _shell_page(title="Page not found", robots="noindex, nofollow", inner=inner)
