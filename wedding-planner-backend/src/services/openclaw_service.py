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
    def apply_command(message, current_config):
        config = OpenClawService._safe_config(current_config)
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
            'updated_config': config,
        }
