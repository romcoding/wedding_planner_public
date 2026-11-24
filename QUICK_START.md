# Quick Start Guide

Get the Wedding Planner application running locally in minutes.

## Prerequisites

- Python 3.11+ installed
- Node.js 18+ installed
- pnpm installed (or npm)

## Backend Setup (5 minutes)

```bash
# Navigate to backend directory
cd wedding-planner-backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example)
# Edit .env and set your values:
# SECRET_KEY=your-secret-key
# JWT_SECRET_KEY=your-jwt-secret
# DATABASE_URL=sqlite:///wedding_planner.db
# FRONTEND_URL=http://localhost:5173

# Run the server
python src/main.py
```

The backend will start on `http://localhost:8787`

## Frontend Setup (3 minutes)

```bash
# Navigate to frontend directory
cd wedding-planner-frontend

# Install dependencies
pnpm install
# or: npm install

# Create .env.local file
# Add: VITE_API_URL=http://localhost:8787/api

# Start development server
pnpm run dev
# or: npm run dev
```

The frontend will start on `http://localhost:5173`

## Create Your First Admin User

Once both servers are running:

1. Open `http://localhost:5173/admin/login`
2. You'll need to create an admin user first

**Option 1: Using curl**
```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password",
    "name": "Admin User"
  }'
```

**Option 2: Using Python script**
Create a file `create_admin.py` in the backend directory:

```python
from src.main import create_app
from src.models import db, User

app = create_app()
with app.app_context():
    user = User(
        email='admin@example.com',
        name='Admin User',
        role='admin'
    )
    user.set_password('your-password')
    db.session.add(user)
    db.session.commit()
    print('Admin user created!')
```

Run: `python create_admin.py`

## Access the Application

- **Guest Portal**: `http://localhost:5173/`
- **Admin Dashboard**: `http://localhost:5173/admin/dashboard`
- **Admin Login**: `http://localhost:5173/admin/login`

## Next Steps

1. **Login** to the admin dashboard
2. **Add Content** for the guest portal (Content Management page)
3. **Test Guest Registration** by visiting the home page
4. **Explore Features**:
   - View analytics on the dashboard
   - Add tasks for wedding planning
   - Track costs and budget
   - Manage guest registrations

## Troubleshooting

### Backend Issues

**Port already in use:**
```bash
# Change port in .env
PORT=5001
```

**Database errors:**
```bash
# Delete the database file and restart
rm wedding_planner.db
python src/main.py
```

### Frontend Issues

**API connection errors:**
- Verify `VITE_API_URL` in `.env.local` is correct
- Ensure backend is running on the correct port
- Check CORS settings in backend

**Build errors:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

## Development Tips

- **Hot Reload**: Both frontend and backend support hot reload
- **Database**: SQLite is used by default (no setup needed)
- **API Testing**: Use the browser dev tools or Postman
- **Logs**: Check terminal output for both servers

## Production Setup

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md)

