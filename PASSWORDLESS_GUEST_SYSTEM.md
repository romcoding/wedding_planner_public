# Passwordless Guest Authentication System

## Overview

We've completely redesigned the guest authentication system to use **unique token-based links** (similar to AWS document sharing). Guests no longer need usernames or passwords!

## How It Works

### 1. Admin Creates Guest
- Admin goes to **Admin → RSVP Requests**
- Clicks **"Add Guest"**
- Fills in guest information (name, email, phone, etc.)
- System automatically generates a **unique token** for the guest
- Admin receives:
  - **Unique RSVP link**: `https://your-site.com/rsvp/abc123xyz...`
  - **QR code** for printing on cards

### 2. Guest Receives Link
- **Email**: Admin can email the link directly
- **QR Code**: Print QR code on invitation cards
- **Direct Link**: Share the link via any method

### 3. Guest Visits Link
- Guest clicks link or scans QR code
- They land on `/rsvp/:token`
- System automatically:
  - Validates the token
  - Authenticates the guest
  - Shows personalized RSVP form (pre-filled with their name)
  - No login required!

### 4. Guest Submits RSVP
- Guest fills out RSVP form
- Submits → Gets glitter animation
- Redirected to info page
- Can return anytime using the same link

## Benefits

✅ **No passwords** - Guests don't need to remember anything  
✅ **No usernames** - Admin provides all info upfront  
✅ **QR codes** - Perfect for printed invitations  
✅ **Secure** - Each token is unique and cryptographically secure  
✅ **Easy sharing** - Just send the link  
✅ **Personalized** - Guest sees their name immediately  

## Database Migration Required

Run this in Render Shell:

```bash
cd wedding-planner-backend
python migrate_add_unique_token.py
```

This will:
1. Add `unique_token` column to `guests` table
2. Generate tokens for existing guests
3. Set up proper constraints

## Admin Workflow

1. **Create Guest**:
   - Go to Admin → RSVP Requests
   - Click "Add Guest"
   - Fill in guest details
   - Click "Create Guest"

2. **Get RSVP Link**:
   - After creation, QR code modal appears
   - Copy link or download QR code
   - Link format: `https://your-site.com/rsvp/{unique_token}`

3. **Share with Guest**:
   - Email the link
   - Print QR code on invitation
   - Share via WhatsApp, SMS, etc.

## Guest Workflow

1. **Receive Link**: Get unique RSVP link via email/card
2. **Click Link**: Opens personalized RSVP page
3. **Fill Form**: Complete RSVP (pre-filled with their info)
4. **Submit**: See success animation, redirected to info page
5. **Return Anytime**: Use same link to update RSVP

## Technical Details

### Backend Changes
- Added `unique_token` field to Guest model
- New endpoints:
  - `GET /api/guests/token/:token` - Get guest by token
  - `POST /api/guests/token/:token/auth` - Authenticate with token
  - `POST /api/guests` - Create guest (admin only, generates token)
  - `PUT /api/guests/update-rsvp` - Update RSVP (authenticated guest)

### Frontend Changes
- New route: `/rsvp/:token` - Auto-authenticates guest
- Updated GuestsPage: Create guest form with QR code display
- QR code generation using `qrcode.react`
- Removed username/password requirements

## Security

- Tokens are **cryptographically secure** (32 bytes, URL-safe)
- Each token is **unique** (enforced by database constraint)
- Tokens are **non-guessable** (secrets.token_urlsafe)
- No expiration (guests can use link anytime)
- Admin can regenerate token if needed (future feature)

## Next Steps

1. **Run migration** in Render Shell
2. **Test guest creation** in admin panel
3. **Test RSVP link** by creating a guest and visiting the link
4. **Generate QR codes** for printed invitations

## Backward Compatibility

- Old username/password system still works (for existing guests)
- New guests use token-based system
- Can migrate existing guests to tokens (migration script does this)

