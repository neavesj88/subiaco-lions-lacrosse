#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Subiaco Lions Lacrosse — First-Time Server Setup
# Run ONCE on a fresh Ubuntu server:  bash scripts/setup.sh
# ─────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Subiaco Lions — First-Time Server Setup  ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# ── Node.js (via nvm) ────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${BLUE}Installing Node.js via nvm...${NC}"
  curl -fsSL https://fnm.vercel.app/install | bash
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
  fnm install 20
  fnm use 20
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

# ── Seed database ────────────────────────────────────────────
echo -e "${BLUE}Seeding database (creates default admin)...${NC}"
npm run db:seed
node scripts/migrate.mjs

# ── PM2 log dir ─────────────────────────────────────────────
sudo mkdir -p /var/log/pm2
sudo chown "$USER":"$USER" /var/log/pm2

# ── Start ────────────────────────────────────────────────────
pm2 start ecosystem.config.cjs --env production
pm2 save

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Setup complete! 🦁              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "App running on port 5000 via PM2."
echo ""
echo "Next steps:"
echo "  1. Configure nginx to proxy port 5000  (see DEPLOYMENT.md)"
echo "  2. Set up Cloudflare DNS + SSL          (same as neaves.au)"
echo "  3. Log in at /admin/login               admin / ${SEED_ADMIN_PASSWORD:-changeme123!}"
echo "  4. Change the admin password immediately"
echo ""
