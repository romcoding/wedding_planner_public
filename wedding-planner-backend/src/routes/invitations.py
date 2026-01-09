from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Invitation, User, Guest, InvitationTemplate
from src.services.email_service import EmailService
from datetime import datetime, timedelta
import os

invitations_bp = Blueprint('invitations', __name__)

@invitations_bp.route('', methods=['GET'])
@jwt_required()
def get_invitations():
    """Get all invitations (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Filtering options
    status = request.args.get('status')
    email = request.args.get('email')
    
    query = Invitation.query
    
    if status:
        query = query.filter_by(status=status)
    if email:
        query = query.filter(Invitation.email.ilike(f'%{email}%'))
    
    invitations = query.order_by(Invitation.created_at.desc()).all()
    
    return jsonify([inv.to_dict(include_template=True) for inv in invitations]), 200

@invitations_bp.route('', methods=['POST'])
@jwt_required()
def create_invitation():
    """Create and send invitation (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('email'):
        return jsonify({'error': 'Email is required'}), 400
    
    email = data['email'].strip().lower()
    guest_name = data.get('guest_name')
    plus_one_allowed = data.get('plus_one_allowed', False)
    plus_one_count = data.get('plus_one_count', 0)
    expires_days = data.get('expires_days', 30)
    send_email = data.get('send_email', True)
    template_id = data.get('template_id')
    scheduled_at = data.get('scheduled_at')  # ISO datetime string
    
    # Check if invitation already exists for this email
    existing = Invitation.query.filter_by(email=email).filter(
        Invitation.status.in_(['pending', 'sent'])
    ).first()
    
    if existing and existing.is_valid():
        return jsonify({'error': 'An active invitation already exists for this email'}), 400
    
    # Create invitation
    invitation = Invitation.create_invitation(
        user_id=user_id,
        email=email,
        guest_name=guest_name,
        plus_one_allowed=plus_one_allowed,
        plus_one_count=plus_one_count,
        expires_days=expires_days
    )
    
    # Set template if provided
    if template_id:
        template = InvitationTemplate.query.filter_by(id=template_id, user_id=user_id).first()
        if template:
            invitation.template_id = template_id
    
    # Set scheduled time if provided
    if scheduled_at:
        try:
            invitation.scheduled_at = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
            send_email = False  # Don't send immediately if scheduled
        except ValueError:
            return jsonify({'error': 'Invalid scheduled_at format'}), 400
    
    db.session.add(invitation)
    db.session.commit()
    
    # Send email if requested and not scheduled
    if send_email and not invitation.scheduled_at:
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        template = invitation.template if invitation.template_id else None
        
        email_sent = EmailService.send_invitation_email(
            email=email,
            invitation_token=invitation.token,
            guest_name=guest_name,
            frontend_url=frontend_url,
            template=template
        )
        
        if email_sent:
            invitation.mark_as_sent()
            db.session.commit()
    
    return jsonify({
        'message': 'Invitation created successfully',
        'invitation': invitation.to_dict(include_template=True)
    }), 201

@invitations_bp.route('/<int:invitation_id>', methods=['GET'])
@jwt_required()
def get_invitation(invitation_id):
    """Get specific invitation (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    invitation = Invitation.query.get_or_404(invitation_id)
    return jsonify(invitation.to_dict(include_template=True)), 200

@invitations_bp.route('/<int:invitation_id>/resend', methods=['POST'])
@jwt_required()
def resend_invitation(invitation_id):
    """Resend invitation email (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    invitation = Invitation.query.get_or_404(invitation_id)
    
    if invitation.status == 'accepted':
        return jsonify({'error': 'Cannot resend accepted invitation'}), 400
    
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    email_sent = EmailService.send_invitation_email(
        email=invitation.email,
        invitation_token=invitation.token,
        guest_name=invitation.guest_name,
        frontend_url=frontend_url
    )
    
    if email_sent:
        invitation.mark_as_sent()
        db.session.commit()
        return jsonify({'message': 'Invitation resent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send email. Check SMTP configuration.'}), 500

@invitations_bp.route('/<int:invitation_id>/revoke', methods=['POST'])
@jwt_required()
def revoke_invitation(invitation_id):
    """Revoke invitation (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    invitation = Invitation.query.get_or_404(invitation_id)
    
    if invitation.status == 'accepted':
        return jsonify({'error': 'Cannot revoke accepted invitation'}), 400
    
    invitation.revoke()
    db.session.commit()
    
    return jsonify({'message': 'Invitation revoked successfully'}), 200

@invitations_bp.route('/validate/<token>', methods=['GET'])
def validate_invitation_token(token):
    """Validate invitation token (public endpoint)"""
    invitation = Invitation.query.filter_by(token=token).first()
    
    if not invitation:
        return jsonify({'error': 'Invalid invitation token'}), 404
    
    if not invitation.is_valid():
        return jsonify({
            'error': 'Invitation has expired or been revoked',
            'status': invitation.status
        }), 400
    
    return jsonify({
        'valid': True,
        'email': invitation.email,
        'guest_name': invitation.guest_name,
        'plus_one_allowed': invitation.plus_one_allowed,
        'plus_one_count': invitation.plus_one_count,
        'expires_at': invitation.expires_at.isoformat() if invitation.expires_at else None
    }), 200

@invitations_bp.route('/register', methods=['POST'])
def register_with_invitation():
    """Register guest using invitation token"""
    data = request.get_json()
    
    if not data or not data.get('token'):
        return jsonify({'error': 'Invitation token is required'}), 400
    
    token = data['token']
    invitation = Invitation.query.filter_by(token=token).first()
    
    if not invitation:
        return jsonify({'error': 'Invalid invitation token'}), 404
    
    if not invitation.is_valid():
        return jsonify({
            'error': 'Invitation has expired or been revoked',
            'status': invitation.status
        }), 400
    
    # Check if guest already exists
    existing_guest = Guest.query.filter_by(email=invitation.email).first()
    
    if existing_guest:
        return jsonify({'error': 'A guest with this email already exists'}), 400
    
    # Validate required fields
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    if not data.get('first_name') or not data.get('last_name'):
        return jsonify({'error': 'First name and last name are required'}), 400
    
    # Create guest account
    from flask_jwt_extended import create_access_token
    
    guest = Guest(
        email=invitation.email,
        first_name=data['first_name'],
        last_name=data['last_name'],
        phone=data.get('phone'),
        username=data['username'],
        rsvp_status='pending',
        number_of_guests=1 + (invitation.plus_one_count if invitation.plus_one_allowed else 0)
    )
    guest.set_password(data['password'])
    
    db.session.add(guest)
    
    # Mark invitation as accepted
    invitation.mark_as_accepted(guest.id)
    
    db.session.commit()
    
    # Generate JWT token
    access_token = create_access_token(identity=f"guest_{guest.id}")
    
    return jsonify({
        'message': 'Registration successful',
        'access_token': access_token,
        'guest': guest.to_dict(include_sensitive=False),
        'invitation': invitation.to_dict(include_template=True)
    }), 201

# Tracking endpoints
@invitations_bp.route('/track/open/<token>', methods=['POST'])
def track_open(token):
    """Track email open (public endpoint, called by tracking pixel)"""
    invitation = Invitation.query.filter_by(token=token).first()
    if invitation:
        invitation.track_open()
        db.session.commit()
    return '', 204  # Return 1x1 transparent pixel

@invitations_bp.route('/track/click/<token>', methods=['POST'])
def track_click(token):
    """Track link click (public endpoint)"""
    invitation = Invitation.query.filter_by(token=token).first()
    if invitation:
        invitation.track_click()
        db.session.commit()
    return jsonify({'message': 'Click tracked'}), 200

# Template routes
@invitations_bp.route('/templates', methods=['GET'])
@jwt_required()
def get_templates():
    """Get all invitation templates (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    templates = InvitationTemplate.query.filter_by(user_id=user_id, is_active=True).order_by(InvitationTemplate.created_at.desc()).all()
    return jsonify([t.to_dict() for t in templates]), 200

@invitations_bp.route('/templates', methods=['POST'])
@jwt_required()
def create_template():
    """Create invitation template (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('subject') or not data.get('html_content'):
        return jsonify({'error': 'Name, subject, and html_content are required'}), 400
    
    # If this is set as default, unset other defaults
    if data.get('is_default'):
        InvitationTemplate.query.filter_by(user_id=user_id, is_default=True).update({'is_default': False})
    
    template = InvitationTemplate(
        user_id=user_id,
        name=data['name'],
        subject=data['subject'],
        html_content=data['html_content'],
        is_default=data.get('is_default', False),
        is_active=data.get('is_active', True)
    )
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify(template.to_dict()), 201

@invitations_bp.route('/templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_template(template_id):
    """Update invitation template (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    template = InvitationTemplate.query.filter_by(id=template_id, user_id=user_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        template.name = data['name']
    if 'subject' in data:
        template.subject = data['subject']
    if 'html_content' in data:
        template.html_content = data['html_content']
    if 'is_default' in data:
        if data['is_default']:
            InvitationTemplate.query.filter_by(user_id=user_id, is_default=True).update({'is_default': False})
        template.is_default = data['is_default']
    if 'is_active' in data:
        template.is_active = data['is_active']
    
    template.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(template.to_dict()), 200

@invitations_bp.route('/templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_template(template_id):
    """Delete invitation template (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    template = InvitationTemplate.query.filter_by(id=template_id, user_id=user_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    db.session.delete(template)
    db.session.commit()
    
    return jsonify({'message': 'Template deleted successfully'}), 200
