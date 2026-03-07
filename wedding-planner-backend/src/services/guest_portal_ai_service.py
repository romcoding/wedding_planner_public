import json
import os
from datetime import datetime

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - dependency failures handled by fallback
    OpenAI = None


class GuestPortalAIService:
    """Generate AI-assisted guest portal copy with graceful fallback templates."""

    @staticmethod
    def _fallback(context):
        couple_names = context.get('couple_names') or 'the couple'
        wedding_date = context.get('wedding_date') or 'our wedding day'
        wedding_location = context.get('wedding_location') or 'our venue'
        style_note = context.get('style_note') or 'warm and personal'

        base = {
            'guestEventDetails': (
                f"We're so happy to celebrate with you at {wedding_location} on {wedding_date}. "
                f"The day is designed to feel {style_note}."
            ),
            'guestAgenda': "Guest arrival and welcome drink\nCeremony\nDinner and speeches\nParty and dancing",
            'guestDresscode': "Festive elegance. Comfortable shoes recommended for dancing and outdoor areas.",
            'guestAccommodationDetails': (
                "For guests traveling from out of town, we recommend booking your stay early. "
                "A preferred accommodation option is listed below, and nearby alternatives are available."
            ),
            'giftMessage': (
                f"Your presence at {couple_names}'s wedding is the greatest gift. "
                "If you would still like to contribute, you can use the details below."
            ),
        }
        return {
            'en': base,
            'de': base,
            'fr': base,
            'meta': {
                'provider': 'template-fallback',
                'warning': 'AI provider unavailable. Generated using fallback templates in English copied to all languages.',
            },
        }

    @staticmethod
    def generate_guest_portal_draft(context):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key or not OpenAI:
            return GuestPortalAIService._fallback(context)

        model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
        base_url = os.getenv('OPENAI_BASE_URL')

        couple_names = context.get('couple_names') or 'the couple'
        wedding_date = context.get('wedding_date') or ''
        wedding_location = context.get('wedding_location') or ''
        style_note = context.get('style_note') or 'warm and personal'
        existing_details = context.get('existing_guest_event_details') or ''
        existing_dresscode = context.get('existing_dresscode') or ''

        prompt = (
            "Create concise wedding guest website content as valid JSON only. "
            "Do not include markdown fences."
            "\n\nJSON schema:\n"
            "{\n"
            "  \"en\": {\n"
            "    \"guestEventDetails\": string,\n"
            "    \"guestAgenda\": string,\n"
            "    \"guestDresscode\": string,\n"
            "    \"guestAccommodationDetails\": string,\n"
            "    \"giftMessage\": string\n"
            "  },\n"
            "  \"de\": {same fields},\n"
            "  \"fr\": {same fields}\n"
            "}\n\n"
            "Rules:\n"
            "- guestAgenda should be newline-separated bullet-like lines without markdown bullet symbols.\n"
            "- Keep every field under 500 characters.\n"
            "- Tone should be welcoming and practical.\n"
            "- If unsure about details, avoid inventing specifics.\n"
            f"- Couple: {couple_names}\n"
            f"- Date: {wedding_date}\n"
            f"- Location: {wedding_location}\n"
            f"- Style: {style_note}\n"
            f"- Existing event details (optional): {existing_details}\n"
            f"- Existing dresscode (optional): {existing_dresscode}\n"
        )

        try:
            client_kwargs = {'api_key': api_key}
            if base_url:
                client_kwargs['base_url'] = base_url

            client = OpenAI(**client_kwargs)
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        'role': 'system',
                        'content': (
                            'You are a wedding copywriting assistant for planners. '
                            'Return JSON only.'
                        ),
                    },
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.7,
                response_format={'type': 'json_object'},
            )

            content = response.choices[0].message.content or '{}'
            parsed = json.loads(content)

            for lang in ['en', 'de', 'fr']:
                parsed.setdefault(lang, {})
                for field in [
                    'guestEventDetails',
                    'guestAgenda',
                    'guestDresscode',
                    'guestAccommodationDetails',
                    'giftMessage',
                ]:
                    parsed[lang][field] = str(parsed[lang].get(field) or '')[:500]

            parsed['meta'] = {
                'provider': model,
                'generated_at': datetime.utcnow().isoformat() + 'Z',
            }
            return parsed
        except Exception as exc:
            fallback = GuestPortalAIService._fallback(context)
            fallback['meta']['warning'] = f"AI generation failed, used fallback template: {str(exc)}"
            return fallback
