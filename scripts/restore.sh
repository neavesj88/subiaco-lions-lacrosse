#!/bin/bash
# =============================================================================
# RESTORE — scripts/restore.sh
# =============================================================================
# Puts the website back to how it was at the time of a chosen backup: both the
# database AND the uploaded photos.
#
# Usage:
#   ./scripts/restore.sh                       # pick from a list
#   ./scripts/restore.sh backup_20250801_020000
#
# Nothing is destroyed without warning: the CURRENT state is saved as its own
# backup first, so a restore can itself be undone.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/data/backups}"
DB_FILE="$PROJECT_DIR/data/club.db"
UPLOADS_DIR="$PROJECT_DIR/public/uploads"
APP_NAME="$(node -e "try{console.log(require('$PROJECT_DIR/ecosystem.config.cjs').apps[0].name)}catch(e){console.log('club-website')}" 2>/dev/null || echo club-website)"
SERVICE_NAME="${SERVICE_NAME:-club-website}"

# The site may be run either by systemd (the clubhouse PC setup) or by PM2 (the
# server setup). Work out which, so restore stops and starts the right one.
stop_site() {
  if systemctl list-units --full -all 2>/dev/null | grep -q "$SERVICE_NAME.service"; then
    sudo systemctl stop "$SERVICE_NAME"
  elif command -v pm2 >/dev/null 2>&1; then
    pm2 stop "$APP_NAME" 2>/dev/null || true
  else
    echo "  (couldn't find a running service to stop — carrying on)"
  fi
}
start_site() {
  if systemctl list-units --full -all 2>/dev/null | grep -q "$SERVICE_NAME.service"; then
    sudo systemctl start "$SERVICE_NAME"
  elif command -v pm2 >/dev/null 2>&1; then
    pm2 start "$APP_NAME" 2>/dev/null || pm2 start "$PROJECT_DIR/ecosystem.config.cjs" --env production
  fi
}

# ── Choose which backup ─────────────────────────────────────────────────────
if [ $# -ge 1 ]; then
  CHOSEN="$1"
else
  echo "Available backups (newest first):"
  echo ""
  ls -1r "$BACKUP_DIR" 2>/dev/null | grep '^backup_' || { echo "  (none found in $BACKUP_DIR)"; exit 1; }
  echo ""
  read -r -p "Type the backup name to restore (or Ctrl+C to cancel): " CHOSEN
fi

SOURCE="$BACKUP_DIR/$CHOSEN"
if [ ! -d "$SOURCE" ] || [ ! -f "$SOURCE/club.db" ]; then
  echo "ERROR: no valid backup at $SOURCE"
  exit 1
fi

echo ""
echo "This will replace the CURRENT website content with the backup from:"
echo "   $SOURCE"
echo ""
read -r -p "Type YES to confirm: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "Cancelled — nothing changed."; exit 0; }

# ── Safety net: snapshot the current state first ────────────────────────────
echo ""
echo "Saving the current state first, in case you need to undo this..."
BACKUP_DIR="$BACKUP_DIR" node "$PROJECT_DIR/scripts/backup.mjs"

# ── Stop the site ───────────────────────────────────────────────────────────
# The database must not be in use while its file is swapped underneath it.
echo ""
echo "Stopping the website..."
stop_site

# ── Restore the database ────────────────────────────────────────────────────
cp "$SOURCE/club.db" "$DB_FILE"

# CRITICAL: remove the leftover -wal and -shm files.
#
# These two sidecar files hold recent changes belonging to the OLD database. If
# they are left behind, SQLite will happily apply them on top of the database
# we just restored — mixing old and new data together, or refusing to open at
# all. Deleting them is what makes the restore actually be the backup.
rm -f "$DB_FILE-wal" "$DB_FILE-shm"
echo "✓ Database restored"

# ── Restore the uploaded photos ─────────────────────────────────────────────
if [ -d "$SOURCE/uploads" ]; then
  mkdir -p "$UPLOADS_DIR"
  cp -r "$SOURCE/uploads/." "$UPLOADS_DIR/"
  echo "✓ Photos restored"
else
  echo "· No photos in this backup — leaving existing ones alone"
fi

# ── Start the site again ────────────────────────────────────────────────────
start_site
echo "✓ Website restarted"
echo ""
echo "Done. Open the site in a browser and check a few pages look right."
