import copy
import re
from datetime import datetime


class OpenClawService:
    """
    Safe, deterministic assistant for guest webpage configuration updates.
    This intentionally avoids arbitrary code execution and only mutates allowed keys.
    """

    ALLOWED_KEYS = {
        'template',
        'guestThemeColors',
        'heroImages',
        'guestTimeline',
        'guestAgenda',
        'guestTextSections',
        'guestWitnessCards',
        'guestBrideCard',
        'guestGroomCard',
        'sectionOrder',
    }
    ALLOWED_SECTION_TYPES = {
        'hero',
        'about',
        'gallery',
        'timeline',
        'agenda',
        'registry',
        'rsvp',
        'contact',
        'witnesses',
        'couple_cards',
    }

    @staticmethod
    def _default_reply():
        return (
            "I can update dress code text, switch templates, update theme colors, "
            "or add agenda items with date/time."
        )

    @staticmethod
    def _safe_config(config):
        if not isinstance(config, dict):
            return {}
        sanitized = {}
        for key in OpenClawService.ALLOWED_KEYS:
            if key in config:
                sanitized[key] = copy.deepcopy(config[key])
        return sanitized

    @staticmethod
    def _normalize_hex(value):
        if not isinstance(value, str):
            return None
        value = value.strip()
        if re.fullmatch(r'#[0-9a-fA-F]{6}', value):
            return value.lower()
        return None

    @staticmethod
    def validate_config(config):
        """
        Enforce a strict allow-list and shape validation for supported keys.
        Any unsupported keys are dropped; malformed values are ignored.
        """
        safe = OpenClawService._safe_config(config)
        validated = {}

        template = safe.get('template')
        if isinstance(template, str) and template.strip():
            validated['template'] = template.strip()[:50]

        colors = safe.get('guestThemeColors')
        if isinstance(colors, dict):
            cleaned = {}
            for key in ['primary', 'secondary', 'accent', 'background', 'text']:
                hex_value = OpenClawService._normalize_hex(colors.get(key))
                if hex_value:
                    cleaned[key] = hex_value
            if cleaned:
                validated['guestThemeColors'] = cleaned

        hero = safe.get('heroImages')
        if isinstance(hero, list):
            cleaned_hero = []
            for item in hero[:20]:
                if not isinstance(item, dict):
                    continue
                url = str(item.get('url') or '').strip()
                if not url:
                    continue
                cleaned_hero.append({
                    'url': url[:1000],
                    'alt': str(item.get('alt') or '').strip()[:200],
                })
            validated['heroImages'] = cleaned_hero

        for key in ['guestTimeline', 'guestAgenda']:
            rows = safe.get(key)
            if isinstance(rows, list):
                cleaned_rows = []
                for row in rows[:50]:
                    if isinstance(row, dict):
                        cleaned_rows.append({
                            'title': str(row.get('title') or '').strip()[:120],
                            'description': str(row.get('description') or '').strip()[:2000],
                            'time': str(row.get('time') or '').strip()[:60],
                        })
                    elif isinstance(row, str):
                        cleaned_rows.append({'title': row.strip()[:120], 'description': ''})
                validated[key] = cleaned_rows

        text_sections = safe.get('guestTextSections')
        if isinstance(text_sections, dict):
            cleaned_sections = {}
            for key, value in text_sections.items():
                if not isinstance(key, str):
                    continue
                cleaned_sections[key[:60]] = str(value or '').strip()[:6000]
            validated['guestTextSections'] = cleaned_sections

        for key in ['guestWitnessCards', 'guestBrideCard', 'guestGroomCard']:
            card = safe.get(key)
            if isinstance(card, (list, dict)):
                validated[key] = card

        order = safe.get('sectionOrder')
        if isinstance(order, list):
            cleaned_order = []
            for item in order:
                token = str(item or '').strip().lower()
                if token in OpenClawService.ALLOWED_SECTION_TYPES and token not in cleaned_order:
                    cleaned_order.append(token)
            if cleaned_order:
                validated['sectionOrder'] = cleaned_order

        return validated

    @staticmethod
    def apply_command(message, current_config):
        config = OpenClawService.validate_config(current_config)
        text = (message or '').strip()
        lower = text.lower()
        reply = OpenClawService._default_reply()

        # Template switching
        if 'template' in lower or 'switch to' in lower:
            for template_name in ['classic', 'modern', 'boho', 'minimalist']:
                if template_name in lower:
                    config['template'] = template_name
                    reply = f"Done — I switched the guest webpage template to '{template_name}'."
                    break

        # Theme colors from hex in prompt (primary, secondary, accent)
        hex_colors = re.findall(r'#[0-9a-fA-F]{6}', text)
        if hex_colors:
            current = config.get('guestThemeColors') or {}
            if not isinstance(current, dict):
                current = {}
            keys = ['primary', 'secondary', 'accent']
            for idx, value in enumerate(hex_colors[:3]):
                current[keys[idx]] = value
            config['guestThemeColors'] = current
            reply = "Updated theme colors from your message."

        # Dress code update
        dress_match = re.search(r'dress code to\s+(.+)', text, re.IGNORECASE)
        if dress_match:
            dress_value = dress_match.group(1).strip().rstrip('.')
            text_sections = config.get('guestTextSections') or {}
            if not isinstance(text_sections, dict):
                text_sections = {}
            text_sections['dressCode'] = dress_value
            config['guestTextSections'] = text_sections
            reply = f"Updated dress code to: {dress_value}"

        # Add agenda item command: "add agenda item for brunch on 22 May at 10am"
        if 'agenda' in lower and ('add' in lower or 'new' in lower):
            agenda = config.get('guestAgenda') or []
            if not isinstance(agenda, list):
                agenda = []
            agenda.append({
                'title': text[:120],
                'description': text,
                'created_at': datetime.utcnow().isoformat() + 'Z',
            })
            config['guestAgenda'] = agenda
            reply = "Added a new agenda entry draft. You can fine-tune title/time in the builder."

        return {
            'assistant_reply': reply,
            'updated_config': OpenClawService.validate_config(config),
        }
