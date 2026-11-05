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
# The full install, development tools included: the build step below needs
# vite and esbuild. Errors are left visible so a failed install stops here.
npm ci

# 3. Back up, then run any pending DB migrations. A failed migration stops the
# deploy (set -e) rather than carrying on with a half-changed database; the
# backup taken just before is what you'd restore from.
echo -e "${BLUE}🗄️  Backing up, then updating the database...${NC}"
node scripts/backup.mjs
node scripts/migrate.mjs

# 4. Build client + server
echo -e "${BLUE}🔨 Building...${NC}"
npm run build

# 5. Restart (or start) with PM2
echo -e "${BLUE}🚀 Restarting app...${NC}"
# Installs from before the rename run under the old PM2 name; reload whichever
# exists rather than starting a second copy that would fight it for the port.
APP=""
for name in club-website lions-lacrosse; do
  if pm2 describe "$name" > /dev/null 2>&1; then APP="$name"; break; fi
done
if [ -n "$APP" ]; then
  pm2 reload "$APP" --update-env
else
  APP=club-website
  pm2 start ecosystem.config.cjs --env production
  pm2 save
fi

echo ""
echo -e "${GREEN}✅ Deploy complete!${NC}"
pm2 status "$APP"
