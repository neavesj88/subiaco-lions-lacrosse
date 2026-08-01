#!/bin/bash
# =============================================================================
# BACKUP — scripts/backup.sh
# =============================================================================
# A thin wrapper so backups run the same way as every other script here.
# The real work happens in backup.mjs, which uses SQLite's own backup facility
# so the copy is always complete and undamaged, even while the site is in use.
#
# It backs up BOTH the database and the uploaded photos. (An earlier version of
# this script copied only the database file with `cp`. That could silently
# produce an incomplete copy, and left every photo out of the backup entirely.)
#
# Run it by hand:
#   ./scripts/backup.sh
#
# Run it automatically every night at 2am (recommended):
#   crontab -e
# then add this one line, with the path changed to match where the site lives:
#   0 2 * * * /home/club/club-website/scripts/backup.sh >> /var/log/club-backup.log 2>&1
#
# Back up to a USB stick or network drive rather than the club PC's own disk,
# so a failed hard drive doesn't destroy the backups along with the site:
#   BACKUP_DIR=/mnt/usb-backup ./scripts/backup.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"
exec node scripts/backup.mjs "$@"
