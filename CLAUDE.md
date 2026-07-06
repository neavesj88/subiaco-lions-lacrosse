# Subiaco Lions Lacrosse — club website + CMS

React 18 + Vite SPA (wouter routing, TanStack Query, shadcn/Radix, TipTap editor) served by a single Express server. SQLite via better-sqlite3 + Drizzle ORM. Sessions in SQLite (connect-sqlite3), auth via bcrypt + optional Google OAuth (passport). Email via nodemailer/Mailgun. Everything self-contained — no external DB.

## Commands

- `npm run dev` — Express + Vite middleware with hot reload, http://localhost:5000
- `npm run build` — vite build (client → `dist/public`) + esbuild bundle (server → `dist/`)
- `npm start` — serve the production build
- `node scripts/migrate.mjs` — create/alter DB tables (idempotent)
- `npm run db:seed` — default admin + starter content
- `npm run check` — TypeScript type-check (`tsc --noEmit`). Run it before committing; the vite build does NOT catch type errors or undefined identifiers.
- No test suite exists. Do not invent test commands.

## Critical rules

1. **Schema changes are manual — do NOT use `drizzle-kit push` / `npm run db:push`.** The workflow is: edit the table in `shared/schema.ts`, add the matching `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` to `scripts/migrate.mjs`, then run `node scripts/migrate.mjs`. Both files must stay in sync.
2. `shared/schema.ts` is the single source of truth for tables, insert schemas (drizzle-zod), and TS types — import types from there on both client and server, never redefine them.
3. Admin panel path is configurable via `ADMIN_PATH` in `.env` (default `/manage`, login at `<ADMIN_PATH>/login`). Never hardcode `/admin` in links or redirects.
4. All API endpoints live in `server/routes.ts` under `/api/*`. Everything else falls through to the SPA's `index.html`. New client routes go in `client/src/App.tsx` (wouter).
5. Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`.
6. This codebase is maintained by non-developers after handover — keep the existing heavily-commented file-header style when editing `server/` and `shared/` files, and keep code boring and explicit.
7. Config comes from `.env` (see `.env.example` for every variable and setup instructions). Email, Google OAuth, and Cloudflare Tunnel are all optional — code must degrade gracefully when their vars are blank (existing patterns do this; follow them).

## Layout

- `client/` — Vite root; pages in `client/src/pages/` (admin pages under `pages/admin/`), shared components in `client/src/components/`
- `server/` — `index.ts` entry, `routes.ts` all endpoints, `db.ts` Drizzle setup, `email.ts`, `security.ts`, `seo-inject.ts`
- `shared/` — `schema.ts` (DB + types), `seo.ts`
- `scripts/` — `migrate.mjs`, `backup.sh`, `deploy.sh`, `reset-admin.mjs`
- `data/club.db` — the SQLite database (gitignored); uploads land in `public/uploads/`

## Deployment

Production runs on the same Ubuntu VM as neaves.au: PM2 (`ecosystem.config.cjs`) + nginx + Cloudflare, **PORT=5001** (neaves.au owns 5000). Docker + Cloudflare Tunnel is the alternative path. Details: `DEPLOYMENT.md`, `SETUP_HOSTING.md`, `HANDOVER.md`.
