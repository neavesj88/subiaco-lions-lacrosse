#!/bin/bash
# =============================================================================
# CLUBHOUSE INSTALL — scripts/install-clubhouse.sh
# =============================================================================
# Sets up the whole website on a Linux PC sitting in the clubhouse, so that it:
#
#   • starts automatically whenever the PC is switched on
#   • restarts itself if it ever crashes
#   • is reachable from the internet WITHOUT a fixed IP address, without
#     port forwarding, and without touching the club's router
#   • backs itself up every night
#
# Run it once, from inside the project folder:
#
#     ./scripts/install-clubhouse.sh
#
# It is safe to run again later — it updates what's already there rather than
# duplicating it.
#
# Read CLUBHOUSE_SETUP.md for the full walkthrough, including the one manual
# step (connecting the tunnel to the club's Cloudflare account).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="club-website"
RUN_USER="${SUDO_USER:-$USER}"

cd "$PROJECT_DIR"

say()  { printf "\n\033[1;34m==> %s\033[0m\n" "$1"; }
ok()   { printf "    \033[0;32m✓\033[0m %s\n" "$1"; }
warn() { printf "    \033[0;33m!\033[0m %s\n" "$1"; }

if [ "$(id -u)" -eq 0 ]; then
  echo "Please run this as your normal user, not with sudo."
  echo "It will ask for your password when it needs administrator rights."
  exit 1
fi

# ── 1. Node.js ───────────────────────────────────────────────────────────────
say "Checking Node.js"
NEED_NODE=20
if command -v node >/dev/null 2>&1 && [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -ge "$NEED_NODE" ]; then
  ok "Node $(node -v) already installed"
else
  warn "Installing Node.js $NEED_NODE (this takes a minute)"
  curl -fsSL "https://deb.nodesource.com/setup_${NEED_NODE}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "Node $(node -v) installed"
fi

# Build tools — better-sqlite3 and bcrypt are compiled during install.
if ! dpkg -s build-essential python3 >/dev/null 2>&1; then
  warn "Installing build tools"
  sudo apt-get install -y build-essential python3
fi

# ── 2. Configuration ─────────────────────────────────────────────────────────
say "Checking configuration"
if [ ! -f .env ]; then
  cp .env.example .env
  # A strong random session secret, so admin logins survive restarts.
  SECRET="$(openssl rand -hex 32)"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
  # A non-obvious admin address, so the login page isn't sitting at /admin.
  RANDOM_PATH="/manage-$(openssl rand -hex 3)"
  sed -i "s|^ADMIN_PATH=.*|ADMIN_PATH=$RANDOM_PATH|" .env
  # The first admin's starting password, random rather than a default that is
  # printed in a public repository. Shown again at the end of this script.
  ADMIN_PW="$(openssl rand -base64 12 | tr -d '/+=')"
  sed -i "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=$ADMIN_PW|" .env
  ok "Created .env with a random session secret and admin password"
  ok "Admin page address set to: $RANDOM_PATH"
  warn "Write that address down — it is deliberately hard to guess."
else
  ok ".env already exists (leaving it alone)"
fi

# ── 3. Install and build ─────────────────────────────────────────────────────
say "Installing and building the site"
# A plain install. Not --omit=optional: the build tools (vite's rollup and
# esbuild) ship their Linux engines as "optional" packages, so leaving those
# out makes the build step below fail on every fresh PC.
npm ci || npm install
node scripts/migrate.mjs
npm run build
ok "Built"

if [ ! -s data/club.db ] || [ "$(node -e "const D=require('better-sqlite3');const d=new D('data/club.db',{readonly:true});console.log(d.prepare('SELECT COUNT(*) n FROM users').get().n)" 2>/dev/null || echo 0)" = "0" ]; then
  npm run db:seed
  ok "Created the first admin account"
  SEEDED=1
fi

# ── 4. Run it as a service ───────────────────────────────────────────────────
# systemd is what Linux itself uses to start things at boot. Using it directly
# means there is no extra process manager for the club to learn or maintain.
say "Setting up automatic start-up"
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<UNIT
[Unit]
Description=Club website
Documentation=file://$PROJECT_DIR/CLUBHOUSE_SETUP.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
# The app reads .env itself (via dotenv). Deliberately NOT using systemd's
# EnvironmentFile here: it does not understand the "# explanatory comment"
# notes after values in .env, and would treat them as part of the value.
ExecStart=$(command -v node) $PROJECT_DIR/dist/index.js

# Always come back up: after a crash, and after a power cut.
Restart=always
RestartSec=5

# Only allow writing to the folders it genuinely needs.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$PROJECT_DIR/data $PROJECT_DIR/public/uploads

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME" >/dev/null
sudo systemctl restart "$SERVICE_NAME"
sleep 3

if systemctl is-active --quiet "$SERVICE_NAME"; then
  ok "Website is running, and will start again by itself after a reboot"
else
  warn "The website did not start. See what went wrong with:"
  echo "        sudo journalctl -u $SERVICE_NAME -n 40"
  exit 1
fi

# ── 5. Nightly backups ───────────────────────────────────────────────────────
say "Scheduling nightly backups"
CRON_LINE="0 2 * * * $PROJECT_DIR/scripts/backup.sh >> $PROJECT_DIR/data/backup.log 2>&1"
if crontab -l 2>/dev/null | grep -Fq "$PROJECT_DIR/scripts/backup.sh"; then
  ok "Already scheduled"
else
  (crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -
  ok "Backups will run every night at 2am"
fi
warn "Backups go to data/backups on this PC. Also copy them somewhere else —"
warn "see 'Backups' in CLUBHOUSE_SETUP.md."

# ── 6. Automatic security updates ────────────────────────────────────────────
say "Turning on automatic security updates"
if ! dpkg -s unattended-upgrades >/dev/null 2>&1; then
  sudo apt-get install -y unattended-upgrades
fi
sudo dpkg-reconfigure -f noninteractive -p critical unattended-upgrades 2>/dev/null || true
ok "The PC will install its own security updates"

# ── 7. Getting it onto the internet ──────────────────────────────────────────
say "Internet access"
if command -v cloudflared >/dev/null 2>&1; then
  ok "Cloudflare Tunnel is installed"
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    ok "Tunnel is running — the site should be reachable from anywhere"
  else
    warn "Tunnel installed but not running. Finish it with:"
    echo "        ./scripts/tunnel-setup.sh yourclub.org.au"
  fi
else
  warn "Not set up yet. This is the step that makes the site reachable from"
  warn "outside the clubhouse WITHOUT a fixed IP address. Run:"
  echo ""
  echo "        ./scripts/tunnel-setup.sh yourclub.org.au"
  echo ""
  warn "or, to try it out with a free temporary address first:"
  echo "        ./scripts/tunnel-quick.sh"
fi

ADMIN_PATH_VALUE="$(grep -E '^ADMIN_PATH=' .env | cut -d= -f2- || echo /manage)"
say "Done"
echo "  On this PC the site is at:  http://localhost:${PORT:-5000}"
echo "  Admin login:                http://localhost:${PORT:-5000}${ADMIN_PATH_VALUE}/login"
if [ "${SEEDED:-0}" = "1" ]; then
  echo "  Username:                   admin"
  START_PW="$(grep -E '^SEED_ADMIN_PASSWORD=' .env | cut -d= -f2- || true)"
  echo "  Starting password:          ${START_PW:-shown in the box further up}"
  echo "                              (write it down, then change it after logging in)"
fi
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status $SERVICE_NAME     is it running?"
echo "    sudo systemctl restart $SERVICE_NAME    restart it"
echo "    sudo journalctl -u $SERVICE_NAME -f     watch what it's doing"
echo "    ./scripts/backup.sh                     back up right now"
echo ""
