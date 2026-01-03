# Fix JWT Token Validation Issue

## Problem
Login succeeds, but subsequent API calls return 401 Unauthorized. This happens because:

1. **Backend restarted** - Render restarted your service
2. **JWT_SECRET_KEY mismatch** - If JWT_SECRET_KEY is not set in Render environment variables, it uses a default value
3. **Tokens become invalid** - Tokens issued before restart won't work if the secret key changed

## Solution

### Step 1: Set JWT_SECRET_KEY in Render

1. Go to Render Dashboard → Your Backend Service → Environment
2. Add/Update these environment variables:
   ```
   JWT_SECRET_KEY=your-secret-key-here-make-it-long-and-random
   SECRET_KEY=your-secret-key-here-make-it-long-and-random
   ```
3. Use a strong random string (at least 32 characters)
4. **Important**: Use the SAME value for both if you want consistency, or generate two different strong keys

### Step 2: Generate a Strong Secret Key

You can generate a secure key using:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Or use an online generator, but make sure it's at least 32 characters long.

### Step 3: Restart the Service

After setting the environment variables:
1. Go to Render Dashboard → Your Backend Service
2. Click "Manual Deploy" → "Clear build cache & deploy"
3. Wait for deployment to complete

### Step 4: Test Login Again

1. Clear your browser's localStorage (or use incognito)
2. Login again
3. The token should now persist correctly

## Why This Happens

When Render restarts your service:
- If `JWT_SECRET_KEY` is not set, Flask uses the default: `'jwt-secret-key-change-in-production'`
- If you had a different key before, tokens issued with the old key won't validate with the new default
- Setting `JWT_SECRET_KEY` in environment variables ensures it's consistent across restarts

## Verify It's Working

After setting the environment variables and restarting:

1. Login should work
2. Navigate to different admin pages
3. You should stay logged in
4. Check Render logs - you should NOT see 401 errors after successful login

## Alternative: Check Current JWT_SECRET_KEY

If you want to see what JWT_SECRET_KEY is currently being used, you can add a temporary endpoint:

```python
@app.route('/api/debug/jwt-secret', methods=['GET'])
def debug_jwt_secret():
    return {'jwt_secret_set': bool(os.getenv('JWT_SECRET_KEY'))}, 200
```

But **don't expose the actual secret key** - just check if it's set.

