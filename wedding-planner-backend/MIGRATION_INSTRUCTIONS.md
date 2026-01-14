# Database Migration Instructions

## Fix for Costs Table Missing Columns

The `costs` table is missing the following columns:
- `vendor_name`
- `vendor_contact`
- `receipt_url`

### To run the migration on Render:

1. **Open Render Shell:**
   - Go to your Render dashboard
   - Select your backend service
   - Click on "Shell" tab

2. **Run the migration:**
   ```bash
   cd wedding-planner-backend
   PYTHONPATH=$(pwd):$PYTHONPATH python migrate_add_cost_receipts.py
   ```

3. **Verify the migration:**
   The script will output which columns were added. You should see:
   - ✅ Added 'vendor_name' column.
   - ✅ Added 'vendor_contact' column.
   - ✅ Added 'receipt_url' column.

### Alternative: Run via Render's Deploy Script

You can also add this to your build command or create a one-time migration job in Render.
