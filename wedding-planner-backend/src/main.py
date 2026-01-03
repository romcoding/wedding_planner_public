from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
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

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # Set to timedelta(hours=24) for production
    
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
    CORS(app, origins=[frontend_url], supports_credentials=True)
    
    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    
    # Add error handlers for JWT
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': f'Invalid token: {str(error)}'}), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
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

