# =============================================================================
# Dockerfile — Club website
# =============================================================================
# Builds the whole app (frontend + backend) into one self-contained image.
# Multi-stage so the final image is small and doesn't ship build tools.
#
# You normally don't run this by hand — `docker compose up -d` does it for you.
# =============================================================================

# ---- Stage 1: build ----------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 is a native module — it needs build tools to compile
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies (cached unless package files change)
COPY package*.json ./
RUN npm ci

# Build the frontend + backend
COPY . .
RUN npm run build

# ---- Stage 2: runtime --------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
# cloudflared runs in its own container and reaches the site over Docker's
# private network, so that network counts as "our proxy" (server/security.ts).
ENV TRUST_PROXY="loopback, uniquelocal"

# Only copy what's needed to run (smaller, faster, more secure image)
COPY package*.json ./
RUN apt-get update && apt-get install -y python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y python3 make g++ && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy the built app and the files it needs at runtime
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/shared ./shared

# data/ holds the SQLite database + uploads — mounted as a volume (see compose)
RUN mkdir -p data/backups public/uploads

EXPOSE 5000

# On every start: create tables (safe to re-run), add any missing default
# settings, create the first admin ONLY if there are no accounts at all (its
# password is printed once: see it with `docker compose logs web`), then launch
# the server. A seed problem is reported but doesn't stop the site starting.
CMD ["sh", "-c", "node scripts/migrate.mjs && (node dist/seed.js || echo 'Seed step failed - see the error above') && node dist/index.js"]
