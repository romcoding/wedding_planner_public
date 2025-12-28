# How to Create an Admin User

## Quick Guide

You can create an admin user directly in Render using the provided script.

## Step-by-Step Instructions

### Step 1: Access Render Shell

1. Go to **Render Dashboard** → Your Backend Service (`wedding-planner-backend`)
2. Click on the **"Shell"** tab (or look for "Shell" in the navigation)
3. This opens a terminal/command line interface

### Step 2: Navigate to Backend Directory

```bash
cd wedding-planner-backend
```

### Step 3: Run the Admin Creation Script

```bash
python create_admin.py
```

### Step 4: Follow the Prompts

The script will ask you for:
1. **Email**: Your admin email address (e.g., `admin@example.com`)
2. **Name**: Your name (e.g., `Admin User`)
3. **Password**: Choose a secure password

Example:
```
Enter admin email: admin@example.com
Enter admin name: Admin User
Enter password: YourSecurePassword123!
```

### Step 5: Confirm Success

You should see:
```
✅ Admin user created successfully!
Email: admin@example.com
Name: Admin User

You can now login at /admin/login
```

## Step 6: Login

1. Go to your Vercel frontend URL
2. Navigate to: `https://your-vercel-url.vercel.app/admin/login`
3. Login with:
   - **Email**: The email you entered
   - **Password**: The password you entered

## Troubleshooting

### "User already exists"
- The email is already registered
- Use a different email or login with existing credentials

### "Error: Email is required"
- Make sure you enter an email address

### Script doesn't run
- Make sure you're in the `wedding-planner-backend` directory
- Check that Python is available: `python --version`
- Try: `python3 create_admin.py`

## Security Notes

- Choose a strong password
- Don't share admin credentials
- You can create multiple admin users
- Each admin has full access to the dashboard

## Multiple Admins

You can create multiple admin users by running the script multiple times with different emails.

## Alternative: Using API (Advanced)

If you prefer, you can also create an admin via API:

```bash
curl -X POST https://your-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "YourPassword123!",
    "name": "Admin User"
  }'
```

## Quick Reference

**Render Shell Command:**
```bash
cd wedding-planner-backend
python create_admin.py
```

**Login URL:**
```
https://your-vercel-url.vercel.app/admin/login
```

