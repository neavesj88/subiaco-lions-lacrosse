#!/bin/bash
# =============================================================================
# UPDATE THE COACHES BOARD — scripts/update-coaches-board.sh
# =============================================================================
# The Coaches Board page embeds a copy of the Lion Board app (a single HTML
# file). The app is developed in its own project:
#     https://github.com/neavesj88/lion-board
#
# When a new version of the board is released, run this script to pull the
# latest file in, then rebuild/redeploy the site as usual (./scripts/deploy.sh).
#
# It copies from a local checkout at ../lion-board if you have one, otherwise
# downloads straight from GitHub.
# =============================================================================
set -euo pipefail

DEST="client/public/coaches-board.html"
LOCAL_COPY="../lion-board/index.html"
RAW_URL="https://raw.githubusercontent.com/neavesj88/lion-board/main/index.html"

if [ -f "$LOCAL_COPY" ]; then
  cp "$LOCAL_COPY" "$DEST"
  echo "✓ Copied from local checkout: $LOCAL_COPY"
else
  curl -fsSL "$RAW_URL" -o "$DEST"
  echo "✓ Downloaded latest from GitHub"
fi

echo "  → $DEST ($(du -h "$DEST" | cut -f1))"
echo ""
echo "Now rebuild and deploy for it to go live:  ./scripts/deploy.sh"
