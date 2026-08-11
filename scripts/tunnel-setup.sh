#!/bin/bash
# =============================================================================
# PERMANENT TUNNEL SETUP (needs a domain) — scripts/tunnel-setup.sh
# =============================================================================
# Sets up a proper, permanent Cloudflare Tunnel so the club's real domain
# serves the site with automatic HTTPS — and NO nginx, NO SSL certificates,
# and NO open ports on the server or router.
#
# BEFORE RUNNING, you need:
#   1. A domain name (e.g. yourclub.org.au)
#   2. That domain added to a free Cloudflare account, with its nameservers
#      pointed at Cloudflare (Cloudflare walks you through this once)
#
# Run it ON THE SERVER that hosts the site:
#     ./scripts/tunnel-setup.sh yourclub.org.au
#
# The script will:
#   • install cloudflared (if needed)
#   • open a browser login so you can authorise your Cloudflare account
#   • create a tunnel named "lions-lacrosse"
#   • point yourdomain.com AND www.yourdomain.com at this server
#   • install it as a systemd service so it starts on boot and self-heals
#
# No domain yet? Use ./scripts/tunnel-quick.sh for a free temporary address.
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
PORT="${2:-5001}"
TUNNEL_NAME="lions-lacrosse"

if [ -z "$DOMAIN" ]; then
  echo "Usage: ./scripts/tunnel-setup.sh <yourdomain.com> [port]"
  echo "Example: ./scripts/tunnel-setup.sh yourclub.org.au"
  echo ""
  echo "No domain yet? Run ./scripts/tunnel-quick.sh for a free temporary URL."
  exit 1
fi

# ── 1. Install cloudflared ───────────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  if ! command -v dpkg &>/dev/null; then
    echo "⚠ cloudflared isn't installed and this isn't a Debian/Ubuntu system."
    echo "  Install it manually, then re-run:"
    echo "  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi
  echo "▸ Installing cloudflared..."
  ARCH=$(dpkg --print-architecture)
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb" -o /tmp/cloudflared.deb
  sudo dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
fi
echo "✓ cloudflared $(cloudflared --version | head -1)"

# ── 2. Authorise with Cloudflare (opens a browser) ───────────────────────────
# On a headless server this prints a URL — copy it into a browser on your PC,
# log in, and pick the domain. It saves a certificate to ~/.cloudflared/.
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo ""
  echo "▸ Authorising with Cloudflare."
  echo "  A URL will appear below — open it in a browser, log in, and select"
  echo "  the domain '$DOMAIN'."
  echo ""
  cloudflared tunnel login
fi
echo "✓ Authorised with Cloudflare"

# ── 3. Create the tunnel (skip if it already exists) ─────────────────────────
if cloudflared tunnel list 2>/dev/null | grep -qw "$TUNNEL_NAME"; then
  echo "✓ Tunnel '$TUNNEL_NAME' already exists"
else
  cloudflared tunnel create "$TUNNEL_NAME"
  echo "✓ Created tunnel '$TUNNEL_NAME'"
fi

TUNNEL_ID=$(cloudflared tunnel list --output json | python3 -c "
import sys, json
for t in json.load(sys.stdin):
    if t['name'] == '$TUNNEL_NAME':
        print(t['id']); break
")

# ── 4. Write the config file ─────────────────────────────────────────────────
# 'ingress' rules say which hostname goes to which local service. The final
# 'http_status: 404' is a required catch-all for anything else.
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
# Cloudflare Tunnel config for the club website.
# Managed by scripts/tunnel-setup.sh — edit hostnames here if the domain changes.
tunnel: ${TUNNEL_ID}
credentials-file: ${HOME}/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${DOMAIN}
    service: http://localhost:${PORT}
  - hostname: www.${DOMAIN}
    service: http://localhost:${PORT}
  # Required catch-all: anything not matched above gets a 404.
  - service: http_status:404
EOF
echo "✓ Wrote /etc/cloudflared/config.yml"

# ── 5. Point the domain at this tunnel (creates the DNS records for you) ─────
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN"       2>/dev/null || echo "  (DNS for $DOMAIN already routed)"
cloudflared tunnel route dns "$TUNNEL_NAME" "www.$DOMAIN"   2>/dev/null || echo "  (DNS for www.$DOMAIN already routed)"
echo "✓ DNS records created in Cloudflare"

# ── 6. Run it as a service so it survives reboots ────────────────────────────
sudo cloudflared service install 2>/dev/null || true
sudo systemctl enable --now cloudflared
sleep 2
sudo systemctl restart cloudflared

echo ""
echo "════════════════════════════════════════════════"
echo " ✅ Tunnel is live"
echo "════════════════════════════════════════════════"
echo " Your site:  https://${DOMAIN}"
echo " Admin:      https://${DOMAIN}\${ADMIN_PATH}/login   (see .env)"
echo ""
echo " Check it:   sudo systemctl status cloudflared"
echo " Logs:       sudo journalctl -u cloudflared -f"
echo ""
echo " NOTE: make sure the site itself is running on port ${PORT}:"
echo "       pm2 start ecosystem.config.cjs --env production"
echo ""
