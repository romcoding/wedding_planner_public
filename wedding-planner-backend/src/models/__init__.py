from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Wedding (tenant) must be imported before models that FK to it
from .wedding import Wedding
from .user import User
from .guest import Guest
from .task import Task
from .cost import Cost
from .content import Content
from .image import Image
from .moodboard import Moodboard
from .invitation import Invitation
from .event import Event
from .message import Message
from .gift_registry import GiftRegistry
from .guest_photo import GuestPhoto
from .venue import Venue
from .venue_request import VenueRequest
from .venue_offer import VenueOfferCategory, VenueOffer
from .venue_document import VenueDocument, DocumentChunk
from .venue_chat import VenueChatHistory
from .invitation_template import InvitationTemplate
from .table import Table, SeatAssignment
from .rsvp_reminder import RSVPReminder, ReminderSent
from .analytics import PageView, Visit, SecurityEvent
from .agenda_item import AgendaItem
from .subscription import UserSubscription, TokenUsage
from .ai_usage import AIUsage

__all__ = [
    'db',
    'Wedding',
    'User', 'Guest', 'Task', 'Cost', 'Content', 'Image', 'Moodboard',
    'Invitation', 'Event', 'Message', 'GiftRegistry', 'GuestPhoto',
    'Venue', 'VenueRequest', 'VenueOfferCategory', 'VenueOffer',
    'VenueDocument', 'DocumentChunk', 'VenueChatHistory', 'InvitationTemplate',
    'Table', 'SeatAssignment', 'RSVPReminder', 'ReminderSent',
    'PageView', 'Visit', 'SecurityEvent', 'AgendaItem',
    'UserSubscription', 'TokenUsage', 'AIUsage',
]
