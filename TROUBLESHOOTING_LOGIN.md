# Troubleshooting Login Issues

## Quick Diagnosis

The login functionality should **NOT** have been affected by our updates. We did not modify:
- User model
- Guest model  
- Auth routes (`/api/auth/login`)
- Guest auth routes (`/api/guest-auth/login`)

## Possible Causes

### 1. Backend Not Starting
The new models might be causing import errors. Check Render logs for:
- Import errors
- Database connection errors
- Table creation errors

**Solution**: Check if the backend is running by visiting:
- `https://your-backend-url.onrender.com/api/health`

### 2. Database Connection Issue
After migrations, the database connection might be broken.

**Solution**: Verify DATABASE_URL is correct in Render environment variables.

### 3. JWT Secret Key Changed
If JWT_SECRET_KEY changed, existing tokens won't work (but new logins should still work).

**Solution**: Check JWT_SECRET_KEY in Render environment variables.

### 4. CORS Issue
Frontend might not be able to reach backend.

**Solution**: Verify FRONTEND_URL in Render matches your Vercel URL exactly.

## Quick Fixes

### Option 1: Recreate Admin User
If you can't login, you can create a new admin user:

```bash
# In Render Shell
cd wedding-planner-backend
python create_admin.py
```

### Option 2: Check Backend Health
```bash
# Test if backend is running
curl https://your-backend-url.onrender.com/api/health
```

### Option 3: Check Render Logs
1. Go to Render Dashboard
2. Click on your backend service
3. Check "Logs" tab for errors
4. Look for:
   - Import errors
   - Database errors
   - Table creation errors

## Most Likely Issue

If migrations ran successfully, the most likely issue is:
1. **Backend crashed on startup** due to an import error in new models
2. **Database connection failed** after migrations

## Next Steps

1. Check Render logs for errors
2. Verify backend is running (check `/api/health` endpoint)
3. If backend is down, check for import errors in new models
4. If needed, recreate admin user using `create_admin.py`

## Testing Login

You can test the login endpoint directly:

```bash
# In Render Shell or locally
python test_login.py
```

Or use curl:
```bash
curl -X POST https://your-backend-url.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

