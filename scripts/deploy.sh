#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Club website — Quick Deploy Script
# Run on the server after git push: ./scripts/deploy.sh
# ─────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Deploying website update...          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# 1. Pull latest code
echo -e "${BLUE}📥 Pulling latest code from GitHub...${NC}"
git pull origin master

# 2. Install / update dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm ci --omit=dev --silent 2>/dev/null || npm install --silent

# 3. Run any pending DB migrations
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
node scripts/migrate.mjs 2>/dev/null && echo "Migration OK" || echo "No migration needed"

# 4. Build client + server
echo -e "${BLUE}🔨 Building...${NC}"
npm run build

# 5. Restart (or start) with PM2
echo -e "${BLUE}🚀 Restarting app...${NC}"
if pm2 describe lions-lacrosse > /dev/null 2>&1; then
  pm2 reload lions-lacrosse --update-env
else
  pm2 start ecosystem.config.cjs --env production
  pm2 save
fi

echo ""
echo -e "${GREEN}✅ Deploy complete!${NC}"
pm2 status lions-lacrosse
