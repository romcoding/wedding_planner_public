from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Table, SeatAssignment, Guest, User
from datetime import datetime
from src.utils.rbac import require_roles

seating_bp = Blueprint('seating', __name__)

@seating_bp.route('/tables', methods=['GET'])
@jwt_required()
def get_tables():
    """Get all tables with assignments (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    include_assignments = request.args.get('include_assignments', 'false').lower() == 'true'
    # Single-instance mode: seating is shared across dashboard users.
    tables = Table.query.order_by(Table.name).all()
    
    return jsonify([t.to_dict(include_assignments=include_assignments) for t in tables]), 200

@seating_bp.route('/tables', methods=['POST'])
@jwt_required()
def create_table():
    """Create a new table (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('capacity'):
        return jsonify({'error': 'Name and capacity are required'}), 400
    
    table = Table(
        user_id=user.id,
        name=data['name'],
        capacity=data['capacity'],
        shape=data.get('shape', 'round'),
        position_x=data.get('position_x', 0.0),
        position_y=data.get('position_y', 0.0),
        notes=data.get('notes')
    )
    
    db.session.add(table)
    db.session.flush()  # Flush to get the table.id before creating assignments
    
    # Create empty seat assignments
    for seat_num in range(1, table.capacity + 1):
        assignment = SeatAssignment(
            table_id=table.id,
            seat_number=seat_num,
            guest_id=None
        )
        db.session.add(assignment)
    
    db.session.commit()
    
    return jsonify(table.to_dict(include_assignments=True)), 201

@seating_bp.route('/tables/<int:table_id>', methods=['PUT'])
@jwt_required()
def update_table(table_id):
    """Update a table (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    table = Table.query.filter_by(id=table_id).first()
    if not table:
        return jsonify({'error': 'Table not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        table.name = data['name']
    if 'capacity' in data:
        old_capacity = table.capacity
        table.capacity = data['capacity']
        
        # Adjust seat assignments if capacity changed
        if data['capacity'] > old_capacity:
            # Add new empty seats
            max_seat = max([a.seat_number for a in table.assignments] or [0])
            for seat_num in range(max_seat + 1, data['capacity'] + 1):
                assignment = SeatAssignment(
                    table_id=table.id,
                    seat_number=seat_num,
                    guest_id=None
                )
                db.session.add(assignment)
        elif data['capacity'] < old_capacity:
            # Remove excess empty seats (only if not assigned)
            assignments_to_remove = SeatAssignment.query.filter_by(
                table_id=table.id
            ).filter(
                SeatAssignment.seat_number > data['capacity'],
                SeatAssignment.guest_id.is_(None)
            ).all()
            for assignment in assignments_to_remove:
                db.session.delete(assignment)
    
    if 'shape' in data:
        table.shape = data['shape']
    if 'position_x' in data:
        table.position_x = data['position_x']
    if 'position_y' in data:
        table.position_y = data['position_y']
    if 'notes' in data:
        table.notes = data['notes']
    
    table.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(table.to_dict(include_assignments=True)), 200

@seating_bp.route('/tables/<int:table_id>', methods=['DELETE'])
@jwt_required()
def delete_table(table_id):
    """Delete a table (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    table = Table.query.filter_by(id=table_id).first()
    if not table:
        return jsonify({'error': 'Table not found'}), 404
    
    db.session.delete(table)
    db.session.commit()
    
    return jsonify({'message': 'Table deleted successfully'}), 200

@seating_bp.route('/assignments', methods=['POST'])
@jwt_required()
def assign_guest():
    """Assign a guest to a seat (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    data = request.get_json()
    
    if not data or not data.get('table_id') or not data.get('seat_number'):
        return jsonify({'error': 'table_id and seat_number are required'}), 400
    
    table = Table.query.filter_by(id=data['table_id']).first()
    if not table:
        return jsonify({'error': 'Table not found'}), 404
    
    if data['seat_number'] > table.capacity or data['seat_number'] < 1:
        return jsonify({'error': 'Invalid seat number'}), 400
    
    guest_id = data.get('guest_id')
    attendee_name = data.get('attendee_name')
    if attendee_name and not guest_id:
        return jsonify({'error': 'attendee_name requires guest_id'}), 400

    # Find or create assignment
    assignment = SeatAssignment.query.filter_by(
        table_id=data['table_id'],
        seat_number=data['seat_number']
    ).first()
    
    if not assignment:
        assignment = SeatAssignment(
            table_id=data['table_id'],
            seat_number=data['seat_number'],
            guest_id=guest_id,
            attendee_name=attendee_name
        )
        db.session.add(assignment)
    else:
        # Check if seat is already taken by another guest
        existing_key = f"{assignment.guest_id or ''}::{assignment.attendee_name or ''}"
        next_key = f"{guest_id or ''}::{attendee_name or ''}"
        if assignment.guest_id and existing_key != next_key:
            return jsonify({'error': 'Seat is already assigned to another guest'}), 400
        assignment.guest_id = guest_id
        assignment.attendee_name = attendee_name

    # Prevent assigning the same person to multiple seats
    if guest_id:
        dup = SeatAssignment.query.filter(
            SeatAssignment.guest_id == guest_id,
            (SeatAssignment.attendee_name == attendee_name) if attendee_name is not None else (SeatAssignment.attendee_name.is_(None)),
            SeatAssignment.id != assignment.id
        ).first()
        if dup and dup.guest_id is not None:
            return jsonify({'error': 'This person is already assigned to a seat'}), 400
    
    if 'notes' in data:
        assignment.notes = data['notes']
    
    assignment.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(assignment.to_dict(include_guest=True)), 200

@seating_bp.route('/assignments/<int:assignment_id>', methods=['DELETE'])
@jwt_required()
def unassign_guest(assignment_id):
    """Remove guest assignment from a seat (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    assignment = SeatAssignment.query.get(assignment_id)
    if not assignment:
        return jsonify({'error': 'Assignment not found'}), 404
    
    assignment.guest_id = None
    assignment.attendee_name = None
    assignment.notes = None
    assignment.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Guest unassigned successfully'}), 200

@seating_bp.route('/assignments/bulk', methods=['POST'])
@jwt_required()
def bulk_assign():
    """Bulk assign guests to seats (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    data = request.get_json()
    
    if not data or not isinstance(data.get('assignments'), list):
        return jsonify({'error': 'assignments array is required'}), 400
    
    results = {'success': [], 'errors': []}
    
    for assignment_data in data['assignments']:
        try:
            table_id = assignment_data.get('table_id')
            seat_number = assignment_data.get('seat_number')
            guest_id = assignment_data.get('guest_id')
            attendee_name = assignment_data.get('attendee_name')
            
            if not table_id or not seat_number:
                results['errors'].append({'assignment': assignment_data, 'error': 'Missing table_id or seat_number'})
                continue
            
            table = Table.query.filter_by(id=table_id).first()
            if not table:
                results['errors'].append({'assignment': assignment_data, 'error': 'Table not found'})
                continue
            
            assignment = SeatAssignment.query.filter_by(
                table_id=table_id,
                seat_number=seat_number
            ).first()
            
            if not assignment:
                assignment = SeatAssignment(
                    table_id=table_id,
                    seat_number=seat_number,
                    guest_id=guest_id,
                    attendee_name=attendee_name
                )
                db.session.add(assignment)
            else:
                assignment.guest_id = guest_id
                assignment.attendee_name = attendee_name
            
            assignment.updated_at = datetime.utcnow()
            results['success'].append(assignment.to_dict())
            
        except Exception as e:
            results['errors'].append({'assignment': assignment_data, 'error': str(e)})
    
    db.session.commit()
    
    return jsonify(results), 200

@seating_bp.route('/guests/unassigned', methods=['GET'])
@jwt_required()
def get_unassigned_guests():
    """Get all confirmed guest-members without seat assignments (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    confirmed_guests = Guest.query.filter_by(rsvp_status='confirmed').all()

    # Build set of assigned people (guest_id + attendee_name).
    assigned = set()
    assignments = SeatAssignment.query.filter(SeatAssignment.guest_id.isnot(None)).all()
    guest_by_id = {g.id: g for g in confirmed_guests}
    for a in assignments:
        if not a.guest_id:
            continue
        if a.attendee_name:
            assigned.add((a.guest_id, a.attendee_name))
            continue
        # Legacy assignments without attendee_name:
        g = guest_by_id.get(a.guest_id) or Guest.query.get(a.guest_id)
        if g:
            names = g.get_attending_names() or g.get_invitee_names() or []
            if names:
                assigned.add((a.guest_id, names[0]))
            else:
                full = f"{g.first_name or ''} {g.last_name or ''}".strip()
                assigned.add((a.guest_id, full))
        else:
            assigned.add((a.guest_id, ''))

    result = []
    for g in confirmed_guests:
        # Get names from attending_names (who is actually coming) or invitee_names (who was invited)
        names = g.get_attending_names() or g.get_invitee_names() or []
        
        # Get the number of people expected (at least 1)
        num_guests = max(g.number_of_guests or 1, 1)
        
        # Build the primary guest name
        primary_name = f"{g.first_name or ''} {g.last_name or ''}".strip()
        if not primary_name:
            primary_name = f"Guest {g.id}"
        
        # If names list doesn't have enough entries for all guests, supplement it
        if len(names) < num_guests:
            # Start with existing names or primary name
            if not names:
                names = [primary_name]
            
            # Add additional entries for remaining guests
            last_name = g.last_name or ''
            for i in range(len(names), num_guests):
                if last_name:
                    additional_name = f"Guest {i + 1} ({last_name})"
                else:
                    additional_name = f"Guest {i + 1} (Invitation #{g.id})"
                names.append(additional_name)
        
        for idx, name in enumerate(names):
            if (g.id, name) in assigned:
                continue
            result.append({
                'id': f"member-{g.id}-{idx}",
                'guest_id': g.id,
                'attendee_name': name,
                'display_name': name,
                'guest': {
                    'id': g.id,
                    'first_name': g.first_name,
                    'last_name': g.last_name,
                    'email': g.email,
                    'number_of_guests': g.number_of_guests,
                    'invitee_names': g.get_invitee_names(),
                }
            })

    return jsonify(result), 200
