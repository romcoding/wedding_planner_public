# Fix CORS Error - Step by Step

## Problem

The backend is blocking requests from your Vercel frontend because CORS (Cross-Origin Resource Sharing) is not configured correctly.

**Error:** `No 'Access-Control-Allow-Origin' header is present`

## Solution: Update FRONTEND_URL in Render

### Step 1: Go to Render Dashboard

1. Navigate to **Render Dashboard**
2. Click on your **Backend Service** (`wedding-planner-backend`)

### Step 2: Update Environment Variable

1. Click on the **"Environment"** tab
2. Find the `FRONTEND_URL` variable
3. Click the **edit icon** (pencil) next to it
4. **Update the value** to your exact Vercel URL:
   ```
   https://weddingplanner-mu.vercel.app
   ```
   ⚠️ **Important:**
   - Use `https://` (not `http://`)
   - No trailing slash at the end
   - Must match your Vercel URL exactly

5. Click **"Save"**

### Step 3: Wait for Redeploy

- Render will automatically redeploy (takes 1-2 minutes)
- Watch the deployment logs to confirm it completes

### Step 4: Test Login

1. Go to: `https://weddingplanner-mu.vercel.app/admin/login`
2. Try logging in again
3. CORS error should be gone!

## Verify Your URLs

**Frontend (Vercel):**
```
https://weddingplanner-mu.vercel.app
```

**Backend (Render):**
```
https://wedding-planner-backend-vupg.onrender.com
```

**FRONTEND_URL should be:**
```
https://weddingplanner-mu.vercel.app
```

## If Still Having Issues

### Check 1: Verify Environment Variable

In Render → Environment tab, make sure:
- **Key**: `FRONTEND_URL`
- **Value**: `https://weddingplanner-mu.vercel.app` (exact match, no trailing slash)

### Check 2: Check Backend Logs

After redeploy, check Render logs for any errors.

### Check 3: Multiple Frontend URLs

If you have multiple environments (staging, production), you may need to update the CORS configuration to allow multiple origins. Let me know if you need this.

## Quick Fix Summary

1. Render Dashboard → Backend Service → Environment
2. Update `FRONTEND_URL` = `https://weddingplanner-mu.vercel.app`
3. Save and wait for redeploy
4. Test login again

That's it! The CORS error should be resolved.

