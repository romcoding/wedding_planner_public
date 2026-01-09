from src.models import db
from datetime import datetime

class Table(db.Model):
    """Table model for seating chart"""
    __tablename__ = 'tables'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    name = db.Column(db.String(100), nullable=False)  # e.g., "Table 1", "Sweetheart Table"
    capacity = db.Column(db.Integer, nullable=False)  # Max number of seats
    shape = db.Column(db.String(20), default='round')  # round, rectangular, square
    position_x = db.Column(db.Float, default=0.0)  # X position in seating chart
    position_y = db.Column(db.Float, default=0.0)  # Y position in seating chart
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('tables', lazy=True))
    assignments = db.relationship('SeatAssignment', backref='table', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_assignments=False):
        """Convert table to dictionary"""
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'capacity': self.capacity,
            'shape': self.shape,
            'position_x': self.position_x,
            'position_y': self.position_y,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'occupied_seats': len([a for a in self.assignments if a.guest_id]),
            'available_seats': self.capacity - len([a for a in self.assignments if a.guest_id])
        }
        if include_assignments:
            result['assignments'] = [a.to_dict(include_guest=True) for a in self.assignments]
        return result

class SeatAssignment(db.Model):
    """Seat assignment model linking guests to tables"""
    __tablename__ = 'seat_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=False)
    guest_id = db.Column(db.Integer, db.ForeignKey('guests.id'), nullable=True)  # Nullable for empty seats
    seat_number = db.Column(db.Integer, nullable=False)  # Seat position at table (1, 2, 3, etc.)
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    guest = db.relationship('Guest', backref=db.backref('seat_assignment', uselist=False))
    
    def to_dict(self, include_guest=False):
        """Convert seat assignment to dictionary"""
        result = {
            'id': self.id,
            'table_id': self.table_id,
            'guest_id': self.guest_id,
            'seat_number': self.seat_number,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_guest and self.guest:
            result['guest'] = {
                'id': self.guest.id,
                'first_name': self.guest.first_name,
                'last_name': self.guest.last_name,
                'email': self.guest.email,
                'number_of_guests': self.guest.number_of_guests,
            }
        return result
