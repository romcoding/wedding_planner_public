# How to Create a Guest Account

## Important: Run Migration First!

Before creating guest accounts, you **must** run the database migration to add the `username` and `password_hash` columns.

## Step 1: Run Database Migration

In Render Shell:

```bash
cd wedding-planner-backend
python migrate_add_guest_auth.py
```

This will:
- ✅ Add `username` column to guests table
- ✅ Add `password_hash` column to guests table
- ✅ Create index on username

**You only need to run this ONCE.** After that, you can create guest accounts.

## Step 2: Create Guest Account

After migration completes, run:

```bash
python create_guest.py
```

Follow the prompts:
- **Username**: Choose a unique username (e.g., `romanhess`)
- **Password**: Set a secure password
- **First Name**: Guest's first name
- **Last Name**: Guest's last name
- **Email**: Guest's email address
- **Phone**: (Optional) Guest's phone number

## Example

```bash
# First, run migration (only once)
python migrate_add_guest_auth.py

# Then create guest account
python create_guest.py
```

Prompts:
```
Enter username: romanhess
Enter password: SecurePass123!
Enter first name: Roman
Enter last name: Hess
Enter email: roman@example.com
Enter phone (optional): +1234567890
```

## After Creating Account

The guest can now:
1. Go to: `https://weddingplanner-mu.vercel.app/login`
2. Login with their username and password
3. Access their RSVP and wedding information

## Troubleshooting

### "column guests.username does not exist"
- **Solution**: Run the migration script first!
  ```bash
  python migrate_add_guest_auth.py
  ```

### "Username already exists"
- Choose a different username
- Usernames must be unique

### "Email already exists"
- The email is already registered
- Guest should use existing account or you can update it

## Quick Reference

**Migration (run once):**
```bash
cd wedding-planner-backend
python migrate_add_guest_auth.py
```

**Create Guest:**
```bash
python create_guest.py
```

**Guest Login URL:**
```
https://weddingplanner-mu.vercel.app/login
```

