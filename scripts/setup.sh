#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Club website — First-Time Server Setup
# Run ONCE on a fresh Ubuntu server:  bash scripts/setup.sh
# ─────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Club website — First-Time Server Setup  ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# ── Node.js (via nvm) ────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${BLUE}Installing Node.js via nvm...${NC}"
  curl -fsSL https://fnm.vercel.app/install | bash
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
  fnm install 22
  fnm use 22
fi
echo -e "${GREEN}✓ Node $(node -v)${NC}"

# ── PM2 ─────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo -e "${BLUE}Installing PM2...${NC}"
  npm install -g pm2
  pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash
fi
echo -e "${GREEN}✓ PM2 $(pm2 -v)${NC}"

# ── Create .env if it doesn't exist ─────────────────────────
if [ ! -f .env ]; then
  echo -e "${YELLOW}Creating .env from .env.example...${NC}"
  cp .env.example .env
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i "s/change-this-to-a-long-random-string/$SECRET/" .env
  # A non-obvious admin address and a random first password, as the clubhouse
  # installer does — never a default that is printed in a public repository.
  sed -i "s|^ADMIN_PATH=.*|ADMIN_PATH=/manage-$(openssl rand -hex 3)|" .env
  sed -i "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=')|" .env
  echo ""
  echo -e "${YELLOW}⚠️  Edit .env now and set your values:${NC}"
  echo "   nano .env"
  echo ""
  echo "   Required:"
  echo "   - SESSION_SECRET  (already randomised)"
  echo "   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  (optional, for Google login)"
  echo ""
  read -p "Press Enter after you've saved .env to continue..."
fi

# ── Install dependencies ─────────────────────────────────────
echo -e "${BLUE}Installing npm dependencies...${NC}"
npm ci

# ── Create data directory ────────────────────────────────────
mkdir -p data
echo -e "${GREEN}✓ data/ directory ready${NC}"

# ── Build ────────────────────────────────────────────────────
echo -e "${BLUE}Building...${NC}"
npm run build

# ── Database ─────────────────────────────────────────────────
# Tables first, then the first admin: the seed can't add an admin to a table
# that doesn't exist yet.
echo -e "${BLUE}Creating the database and the first admin...${NC}"
node scripts/migrate.mjs
npm run db:seed

# ── PM2 log dir ─────────────────────────────────────────────
sudo mkdir -p /var/log/pm2
sudo chown "$USER":"$USER" /var/log/pm2

# ── Start ────────────────────────────────────────────────────
pm2 start ecosystem.config.cjs --env production
pm2 save

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Setup complete!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
# Values from .env, without the "# explanation" some lines carry after them.
env_value() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//' || true; }
APP_PORT="$(env_value PORT)"
APP_ADMIN="$(env_value ADMIN_PATH)"
APP_PW="$(env_value SEED_ADMIN_PASSWORD)"
echo "App running on port ${APP_PORT:-5000} via PM2."
echo ""
echo "Next steps:"
echo "  1. Configure nginx to proxy port ${APP_PORT:-5000}  (see DEPLOYMENT.md)"
echo "  2. Point your domain at it through Cloudflare     (see SETUP_HOSTING.md)"
echo "  3. Log in at ${APP_ADMIN:-/manage}/login"
echo "       username: admin"
echo "       password: ${APP_PW:-shown in the box further up}"
echo "  4. Change the admin password straight away"
echo ""
