"""
Run all pending migrations in order
This script runs all migration scripts that haven't been applied yet
"""
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

# List of migrations in order (most recent first, but we'll check if they're needed)
MIGRATIONS = [
    'migrate_add_rbac_fields.py',
    'migrate_add_analytics_tables.py',
    'migrate_add_content_scheduling.py',
    'migrate_add_rsvp_reminders.py',
    'migrate_add_seating_chart.py',
    'migrate_add_cost_receipts.py',
    'migrate_add_event_task_linking.py',
    'migrate_add_invitation_tracking.py',
    'migrate_enhance_venue_model.py',
]

def run_migration(migration_file):
    """Run a single migration file"""
    print(f"\n{'=' * 60}")
    print(f"Running: {migration_file}")
    print('=' * 60)
    
    try:
        # Import and run the migration
        migration_path = os.path.join(os.path.dirname(__file__), migration_file)
        if not os.path.exists(migration_path):
            print(f"⚠️  Migration file not found: {migration_file}")
            return False
        
        # Read and execute the migration
        with open(migration_path, 'r') as f:
            code = f.read()
            # Extract the migrate function
            exec(compile(code, migration_path, 'exec'))
            # Call migrate if it exists
            if 'migrate' in locals() or 'migrate' in globals():
                migrate()
                return True
            else:
                print(f"⚠️  No migrate() function found in {migration_file}")
                return False
    except Exception as e:
        print(f"❌ Error running {migration_file}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Running All Pending Migrations")
    print("=" * 60)
    print()
    
    success_count = 0
    failed_count = 0
    
    for migration in MIGRATIONS:
        if run_migration(migration):
            success_count += 1
        else:
            failed_count += 1
    
    print()
    print("=" * 60)
    print(f"Migration Summary: {success_count} succeeded, {failed_count} failed")
    print("=" * 60)
