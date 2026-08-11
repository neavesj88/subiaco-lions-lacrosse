# =============================================================================
# Dockerfile — Club website
# =============================================================================
# Builds the whole app (frontend + backend) into one self-contained image.
# Multi-stage so the final image is small and doesn't ship build tools.
#
# You normally don't run this by hand — `docker compose up -d` does it for you.
# =============================================================================

# ---- Stage 1: build ----------------------------------------------------------
FROM node:20-bookworm-slim AS build
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
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

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
COPY --from=build /app/public ./public

# data/ holds the SQLite database + uploads — mounted as a volume (see compose)
RUN mkdir -p data/backups public/uploads

EXPOSE 5000

# On every start: create tables (safe to re-run), seed defaults if the DB is
# empty (creates the default admin + starter content), then launch the server.
CMD ["sh", "-c", "node scripts/migrate.mjs && node dist/seed.js && node dist/index.js"]
