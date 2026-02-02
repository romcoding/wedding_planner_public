from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
import logging
from src.models import db
from src.routes.auth import auth_bp
from src.routes.guest_auth import guest_auth_bp
from src.routes.guests import guests_bp
from src.routes.tasks import tasks_bp
from src.routes.costs import costs_bp
from src.routes.content import content_bp
from src.routes.analytics import analytics_bp
from src.routes.images import images_bp
from src.routes.invitations import invitations_bp
from src.routes.events import events_bp
from src.routes.messages import messages_bp
from src.routes.gift_registry import gift_registry_bp
from src.routes.guest_photos import guest_photos_bp
from src.routes.venues import venues_bp
from src.routes.seating import seating_bp
from src.routes.rsvp_reminders import reminders_bp
from src.routes.users import users_bp
from src.routes.venue_offers import offers_bp
from src.routes.venue_documents import documents_bp
from src.routes.venue_chat import chat_bp
from src.routes.moodboards import moodboards_bp
from src.routes.agenda import agenda_bp

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        force=True  # Force reconfiguration
    )
    
    # Get logger after configuration
    logger = logging.getLogger(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # Set to timedelta(hours=24) for production
    
    # Upload limits (Render free tier can 502 if requests run too long; keep uploads reasonable)
    # Default 25MB; can override via MAX_UPLOAD_MB env var.
    try:
        max_upload_mb = int(os.getenv('MAX_UPLOAD_MB', '25'))
    except ValueError:
        max_upload_mb = 25
    app.config['MAX_CONTENT_LENGTH'] = max_upload_mb * 1024 * 1024
    
    # Database configuration
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        # Render PostgreSQL connection string format
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///wedding_planner.db'
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # CORS configuration
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    # Build list of allowed origins
    allowed_origins = [frontend_url]
    
    # Add Vercel deployment URL if provided
    vercel_url = os.getenv('VERCEL_URL')
    if vercel_url and not vercel_url.startswith('http'):
        vercel_url = f'https://{vercel_url}'
    if vercel_url and vercel_url not in allowed_origins:
        allowed_origins.append(vercel_url)
    
    # Always allow the production Vercel domain
    production_vercel = 'https://weddingplanner-mu.vercel.app'
    if production_vercel not in allowed_origins:
        allowed_origins.append(production_vercel)
    
    # Remove duplicates and None values
    allowed_origins = list(set([origin for origin in allowed_origins if origin]))
    
    logger.info(f"CORS allowed origins: {allowed_origins}")
    
    # Public analytics track routes allow any origin (no credentials); rest use explicit origins
    CORS(app,
         resources={
             r"/api/analytics/track/.*": {
                 "origins": "*",
                 "supports_credentials": False,
                 "allow_headers": ["Content-Type"],
                 "methods": ["GET", "POST", "OPTIONS"],
             },
         },
         origins=allowed_origins,
         supports_credentials=True,
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         allow_headers=['Content-Type', 'Authorization'],
         expose_headers=['Content-Length', 'Content-Type'],
         always_send=True)  # Always send CORS headers, even on errors
    
    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    
    # Add error handlers for JWT
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        import logging
        logging.error(f'Invalid JWT token: {str(error)}')
        return jsonify({'error': f'Invalid token: {str(error)}'}), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        import logging
        logging.error(f'Missing JWT token: {str(error)}')
        return jsonify({'error': 'Authorization token is missing'}), 401
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(guest_auth_bp, url_prefix='/api/guest-auth')
    app.register_blueprint(guests_bp, url_prefix='/api/guests')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(costs_bp, url_prefix='/api/costs')
    app.register_blueprint(content_bp, url_prefix='/api/content')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(images_bp, url_prefix='')
    app.register_blueprint(invitations_bp, url_prefix='/api/invitations')
    app.register_blueprint(events_bp, url_prefix='/api/events')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(gift_registry_bp, url_prefix='/api/gift-registry')
    app.register_blueprint(guest_photos_bp, url_prefix='/api/guest-photos')
    app.register_blueprint(venues_bp, url_prefix='/api/venues')
    app.register_blueprint(offers_bp, url_prefix='/api')
    app.register_blueprint(documents_bp, url_prefix='/api')
    app.register_blueprint(chat_bp, url_prefix='/api')
    app.register_blueprint(seating_bp, url_prefix='/api/seating')
    app.register_blueprint(reminders_bp, url_prefix='/api/rsvp-reminders')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(moodboards_bp, url_prefix='')
    app.register_blueprint(agenda_bp, url_prefix='/api/agenda')
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    @app.route('/api/health')
    def health():
        return {'status': 'ok'}, 200
    
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')

