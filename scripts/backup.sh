#!/bin/bash
# =============================================================================
# DATABASE BACKUP — scripts/backup.sh
# =============================================================================
# What this does:
#   Copies the SQLite database file (data/club.db) to data/backups/ with
#   a date-and-time stamp so you can restore any previous version.
#   Automatically deletes backups older than 30 to keep disk usage low.
#
# Run manually:    ./scripts/backup.sh
# Run on a schedule (recommended):
#   Add to crontab with: crontab -e
#   Then add this line for a 2am daily backup:
#   0 2 * * * /home/user/subiaco-lions-lacrosse/scripts/backup.sh >> /var/log/lions-backup.log 2>&1
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/data/backups"
DB_FILE="$PROJECT_DIR/data/club.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/club_$DATE.db"

# Create the backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check the database file exists
if [ ! -f "$DB_FILE" ]; then
  echo "ERROR: Database file not found at $DB_FILE"
  exit 1
fi

# Copy the database (SQLite WAL mode = safe to copy while app is running)
cp "$DB_FILE" "$BACKUP_FILE"
echo "✓ Backed up to $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep only the 30 most recent backups — delete the rest
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/club_*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 30 ]; then
  ls -t "$BACKUP_DIR"/club_*.db | tail -n +31 | xargs rm -f
  echo "  Removed old backups (kept 30 most recent)"
fi
