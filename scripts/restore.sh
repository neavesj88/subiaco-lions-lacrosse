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

# A value from the site's .env file ("" if it isn't set there), without the
# "# explanation" comments .env lines may carry after the value.
env_value() {
  [ -f "$PROJECT_DIR/.env" ] || return 0
  grep -E "^$1=" "$PROJECT_DIR/.env" | tail -1 | cut -d= -f2- \
    | sed -E 's/[[:space:]]+#.*$//; s/^["'"'"']//; s/["'"'"']$//' || true
}

# The same places the backups and the database really are: what's set for
# this command, else what .env says (where a USB-stick BACKUP_DIR is usually
# set), else the defaults.
BACKUP_DIR="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/data/backups}"
DB_FILE="$(env_value DATABASE_URL)"
DB_FILE="${DB_FILE:-./data/club.db}"
case "$DB_FILE" in /*) ;; *) DB_FILE="$PROJECT_DIR/${DB_FILE#./}" ;; esac
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
# With pruning switched off for this one: the usual "keep the newest 30" could
# otherwise delete the very backup you are about to restore.
echo ""
echo "Saving the current state first, in case you need to undo this..."
BACKUP_DIR="$BACKUP_DIR" BACKUP_KEEP=1000000 node "$PROJECT_DIR/scripts/backup.mjs"

# ── Stop the site ───────────────────────────────────────────────────────────
# The database must not be in use while its file is swapped underneath it.
# From here on, the site is started again however this script ends, even if a
# step below fails: a failed restore must never leave the club's website off.
echo ""
echo "Stopping the website..."
stop_site
trap 'start_site; echo "Website restarted."' EXIT

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
  # Backups on the same disk share their photos with the live site (backup.mjs
  # explains why). A photo that is literally the same file is already in
  # place, and plain `cp` refuses to copy a file onto itself, so skip it.
  for photo in "$SOURCE/uploads/"*; do
    [ -f "$photo" ] || continue
    dest="$UPLOADS_DIR/$(basename "$photo")"
    [ "$photo" -ef "$dest" ] && continue
    cp -f "$photo" "$dest"
  done
  echo "✓ Photos restored"
else
  echo "· No photos in this backup — leaving existing ones alone"
fi

# ── Done ────────────────────────────────────────────────────────────────────
# The site is started again by the trap above, as this script exits.
echo ""
echo "Done. Open the site in a browser and check a few pages look right."
