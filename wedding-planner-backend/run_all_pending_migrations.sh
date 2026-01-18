#!/bin/bash
# Script to run all pending migrations
# Run this in the Render Shell: bash run_all_pending_migrations.sh

echo "=========================================="
echo "Running All Pending Migrations"
echo "=========================================="
echo ""

cd wedding-planner-backend

echo "1. Running venue model enhancement migration..."
python3 migrate_enhance_venue_model.py
echo ""

echo "2. Running analytics tables migration..."
python3 migrate_add_analytics_tables.py
echo ""

echo "3. Running RBAC fields migration..."
python3 migrate_add_rbac_fields.py
echo ""

echo "4. Running content scheduling migration..."
python3 migrate_add_content_scheduling.py
echo ""

echo "5. Running invitation tracking migration..."
python3 migrate_add_invitation_tracking.py
echo ""

echo "6. Running guest invitee names migration..."
python3 migrate_add_invitee_names.py
echo ""

echo "7. Running moodboards table migration..."
python3 migrate_create_moodboards_table.py
echo ""

echo "8. Running seating assignment attendee name migration..."
python3 migrate_add_seat_assignment_attendee_name.py
echo ""

echo "=========================================="
echo "All migrations completed!"
echo "=========================================="
