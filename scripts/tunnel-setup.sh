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
#   • create a tunnel named "club-website"
#   • point yourdomain.com AND www.yourdomain.com at this server
#   • install it as a systemd service so it starts on boot and self-heals
#
# No domain yet? Use ./scripts/tunnel-quick.sh for a free temporary address.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# A value from the site's .env ("" if unset), minus any trailing "# comment".
env_value() {
  [ -f "$PROJECT_DIR/.env" ] || return 0
  grep -E "^$1=" "$PROJECT_DIR/.env" | tail -1 | cut -d= -f2- \
    | sed -E 's/[[:space:]]+#.*$//; s/^["'"'"']//; s/["'"'"']$//' || true
}

DOMAIN="${1:-}"
# The port the site runs on: as given, else the PORT in .env, else 5000 (what
# the clubhouse installer uses).
PORT="${2:-$(env_value PORT)}"
PORT="${PORT:-5000}"
TUNNEL_NAME="club-website"

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
# Installs set up before the rename used "lions-lacrosse"; carry on with that
# one rather than creating a second tunnel next to it.
if ! cloudflared tunnel list 2>/dev/null | grep -qw "$TUNNEL_NAME" \
   && cloudflared tunnel list 2>/dev/null | grep -qw "lions-lacrosse"; then
  TUNNEL_NAME="lions-lacrosse"
fi
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
# Re-running this script is fine: a name that already points at THIS tunnel is
# reported as such. Anything else — most often an old A or CNAME record left
# over from previous hosting — is shown as it is, because the site will not be
# reachable at that name until it is fixed.
route_dns() {
  local out
  if out="$(cloudflared tunnel route dns "$TUNNEL_NAME" "$1" 2>&1)"; then
    echo "✓ $1 now points at the tunnel"
  elif echo "$out" | grep -qi "already configured to route to your tunnel"; then
    echo "✓ $1 already points at the tunnel"
  else
    echo ""
    echo "✗ Couldn't point $1 at the tunnel. Cloudflare said:"
    echo "$out" | sed 's/^/    /'
    echo ""
    echo "  If that says a record already exists: in the Cloudflare dashboard,"
    echo "  open DNS for this domain, delete the existing record for $1, then"
    echo "  run this script again."
    exit 1
  fi
}
route_dns "$DOMAIN"
route_dns "www.$DOMAIN"

# ── 6. Run it as a service so it survives reboots ────────────────────────────
sudo cloudflared service install 2>/dev/null || true
sudo systemctl enable --now cloudflared
sleep 2
sudo systemctl restart cloudflared

# The site's own address goes into .env (if not set already), so links in the
# emails the site sends point at the real domain.
if [ -f "$PROJECT_DIR/.env" ] && [ -z "$(env_value SITE_URL)" ]; then
  if grep -qE '^SITE_URL=' "$PROJECT_DIR/.env"; then
    sed -i "s|^SITE_URL=.*|SITE_URL=https://${DOMAIN}|" "$PROJECT_DIR/.env"
  else
    echo "SITE_URL=https://${DOMAIN}" >> "$PROJECT_DIR/.env"
  fi
  echo "✓ Set SITE_URL=https://${DOMAIN} in .env (restart the site to use it)"
fi

ADMIN_PATH_VALUE="$(env_value ADMIN_PATH)"
echo ""
echo "════════════════════════════════════════════════"
echo " ✅ Tunnel is live"
echo "════════════════════════════════════════════════"
echo " Your site:  https://${DOMAIN}"
echo " Admin:      https://${DOMAIN}${ADMIN_PATH_VALUE:-/manage}/login"
echo ""
echo " Check it:   sudo systemctl status cloudflared"
echo " Logs:       sudo journalctl -u cloudflared -f"
echo ""
echo " NOTE: the site itself must be running on port ${PORT}. Check with:"
echo "       sudo systemctl status club-website     (clubhouse PC)"
echo "       pm2 status                             (rented server)"
echo ""
