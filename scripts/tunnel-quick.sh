#!/bin/bash
# =============================================================================
# QUICK TUNNEL (no domain needed) — scripts/tunnel-quick.sh
# =============================================================================
# Puts the Lions site on the public internet in about 10 seconds, with HTTPS,
# WITHOUT needing a domain name or even a Cloudflare account.
#
# Cloudflare gives you a random free address like:
#     https://shiny-otter-lamp-verb.trycloudflare.com
#
# PERFECT FOR: showing the site to the club committee, testing on a phone,
# checking it works from outside your network.
#
# NOT FOR PRODUCTION, because:
#   • The address CHANGES every time you restart this script.
#   • Cloudflare rate-limits these and can withdraw them at any time.
#   • You can't use your own domain name.
# When the club has a real domain, use scripts/tunnel-setup.sh instead.
#
# USAGE:
#   ./scripts/tunnel-quick.sh          # tunnels the site's port (PORT in .env, else 5000)
#   ./scripts/tunnel-quick.sh 5001     # tunnels a different port
#
# Press Ctrl+C to stop the tunnel (the site keeps running locally).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_PORT="$( [ -f "$PROJECT_DIR/.env" ] && grep -E '^PORT=' "$PROJECT_DIR/.env" | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//' || true)"
PORT="${1:-${ENV_PORT:-5000}}"

# ── Check the site is actually running on that port ──────────────────────────
# Done FIRST so we don't install anything before knowing there's a site to serve.
if ! curl -fsS --max-time 3 "http://localhost:${PORT}/" >/dev/null 2>&1; then
  echo ""
  echo "⚠ Nothing is responding on http://localhost:${PORT}"
  echo "  Start the site first, e.g.:"
  echo "    sudo systemctl start club-website                    (clubhouse PC)"
  echo "    pm2 start ecosystem.config.cjs --env production     (rented server)"
  echo "    npm run dev                                          (development)"
  echo ""
  echo "  Or point at a different port:  ./scripts/tunnel-quick.sh 5001"
  echo ""
  exit 1
fi

# ── Make sure cloudflared is installed ───────────────────────────────────────
# Auto-install only works on Debian/Ubuntu (which is what the VM runs).
# Anywhere else we stop with a link rather than failing confusingly.
if ! command -v cloudflared &>/dev/null; then
  if ! command -v dpkg &>/dev/null; then
    echo ""
    echo "⚠ cloudflared isn't installed, and this doesn't look like a Debian/Ubuntu"
    echo "  system so it can't be installed automatically."
    echo "  Install it manually, then re-run this script:"
    echo "    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    echo ""
    exit 1
  fi
  echo "cloudflared is not installed. Installing it now (needs sudo)..."
  ARCH=$(dpkg --print-architecture)   # amd64 on most VMs, arm64 on Pi/ARM
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb" -o /tmp/cloudflared.deb
  sudo dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
  echo "✓ cloudflared installed"
fi

echo ""
echo "Starting a quick tunnel to http://localhost:${PORT} ..."
echo "Your public address will appear below in a few seconds."
echo "(It changes every restart. Press Ctrl+C to stop.)"
echo ""

# --no-autoupdate keeps it from restarting itself mid-demo
exec cloudflared tunnel --no-autoupdate --url "http://localhost:${PORT}"
