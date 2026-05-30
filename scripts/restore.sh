#!/bin/bash
# =============================================================================
# DATABASE RESTORE — scripts/restore.sh
# =============================================================================
# What this does:
#   Restores the database from a backup file created by backup.sh.
#   Stops the app, swaps the database file, then restarts.
#
# Usage:
#   ./scripts/restore.sh                       # Interactive — shows backups to choose from
#   ./scripts/restore.sh club_20250101_020000.db  # Restore a specific backup
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/data/backups"
DB_FILE="$PROJECT_DIR/data/club.db"

# If no argument given, list available backups and prompt
if [ -z "$1" ]; then
  echo "Available backups:"
  echo ""
  ls -lt "$BACKUP_DIR"/club_*.db 2>/dev/null | awk '{print NR". "$NF}' | sed "s|$BACKUP_DIR/||"
  echo ""
  read -p "Enter backup filename (or press Ctrl+C to cancel): " CHOSEN
  BACKUP_FILE="$BACKUP_DIR/$CHOSEN"
else
  BACKUP_FILE="$BACKUP_DIR/$1"
fi

# Check the backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup not found: $BACKUP_FILE"
  exit 1
fi

echo ""
echo "⚠️  This will replace the current database with:"
echo "   $BACKUP_FILE"
echo ""
read -p "Type YES to confirm: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  echo "Cancelled."
  exit 0
fi

# Back up current DB before overwriting (safety net)
SAFETY="$BACKUP_DIR/club_pre_restore_$(date +%Y%m%d_%H%M%S).db"
cp "$DB_FILE" "$SAFETY"
echo "Current DB saved as safety backup: $SAFETY"

# Stop the app
echo "Stopping app..."
pm2 stop lions-lacrosse 2>/dev/null || true

# Replace the database
cp "$BACKUP_FILE" "$DB_FILE"
echo "✓ Database restored from $BACKUP_FILE"

# Restart the app
pm2 start lions-lacrosse 2>/dev/null || pm2 start ecosystem.config.cjs --env production
echo "✓ App restarted"
