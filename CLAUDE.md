# Subiaco Lions Lacrosse — club website + CMS

React 18 + Vite SPA (wouter routing, TanStack Query, shadcn/Radix, TipTap editor) served by a single Express server. SQLite via better-sqlite3 + Drizzle ORM. Sessions in their own SQLite file next to the database (`server/session-store.ts`, a small custom store), auth via bcrypt + optional Google OAuth (passport). Email via nodemailer/Mailgun. Everything self-contained — no external DB.

## Commands

- `npm run dev` — Express + Vite middleware with hot reload, http://localhost:5000
- `npm run build` — vite build (client → `dist/public`) + esbuild bundle (server → `dist/`)
- `npm start` — serve the production build
- `node scripts/migrate.mjs` — create/alter DB tables (idempotent)
- `npm run db:seed` — default admin + starter content
- `npm run check` — TypeScript type-check (`tsc --noEmit`). Run it before committing; the vite build does NOT catch type errors or undefined identifiers.
- No test suite exists. Do not invent test commands.

## Critical rules

1. **Schema changes are manual.** Edit the table in `shared/schema.ts`, add the matching `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` to `scripts/migrate.mjs`, then run `node scripts/migrate.mjs`. Both files must stay in sync. (`drizzle-kit push` was removed along with its `db:push` script and config — it cannot express SQLite's ALTER limitations and silently desynced the two files.)
2. `shared/schema.ts` is the single source of truth for tables, insert schemas (drizzle-zod), and TS types — import types from there on both client and server, never redefine them.
3. Admin panel path is configurable via `ADMIN_PATH` in `.env` (default `/manage`, login at `<ADMIN_PATH>/login`). Never hardcode `/admin` in links or redirects.
4. All API endpoints live in `server/routes.ts` under `/api/*`. Everything else falls through to the SPA's `index.html`. New client routes go in `client/src/App.tsx` (wouter).
5. Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`.
6. This codebase is maintained by non-developers after handover — keep the existing heavily-commented file-header style when editing `server/` and `shared/` files, and keep code boring and explicit.
7. Config comes from `.env` (see `.env.example` for every variable and setup instructions). Email, Google OAuth, Stripe, and Cloudflare Tunnel are all optional — code must degrade gracefully when their vars are blank (existing patterns do this; follow them). `.env` is loaded by `dotenv` at the top of `server/index.ts`, and also by `server/seed.ts`, `scripts/migrate.mjs`, `scripts/backup.mjs` and `ecosystem.config.cjs` (PORT), so a setting there applies everywhere.
8. **Shop money rules.** Prices are stored in whole cents, never decimals. The browser may only send product/variant IDs and quantities — `server/store.ts` re-prices every cart from the database, so never trust a price from a request. An order becomes `paid` ONLY via the signature-verified Stripe webhook, never from the browser returning to the success page. The webhook needs the raw request body, which `server/index.ts` captures via `express.json({ verify })` for that one path — do not parse or re-serialise it.
9. Secrets (`mail_pass`, `stripe_secret_key`, `stripe_webhook_secret`) are write-only: stripped from `/api/settings`, masked as `********` in `/api/settings/secure`, and a submitted `********` is ignored so re-saving a form can't blank them. The full list of settings kept out of browsers is `PRIVATE_SETTING_KEYS` in `server/site-settings.ts`; public settings are also embedded in every page (`server/runtime-config.ts`), so anything private must be on that list.
10. **Settings saves send only changed keys** (admin Settings and Shop forms diff against the loaded copy). Never PUT a whole stale settings object — it silently reverts changes made in other tabs.
11. **The menu is one setting** (`nav_menu`, model in `shared/nav.ts`). Pages, Menu and the server (`server/menu.ts`) all edit it; a custom page's `nav_location` column is legacy, read once on upgrade by `placePagesFromOldSettings()`.
12. **No club-specific facts in code defaults.** `shared/club-config.ts` defaults must suit any club; a value that only made sense for the first club belongs in its database (see migrate.mjs v10, which wrote Subiaco's old built-in values into existing installs only).

## Layout

- `client/` — Vite root; pages in `client/src/pages/` (admin pages under `pages/admin/`), shared components in `client/src/components/`
- `server/` — `index.ts` entry, `routes.ts` all endpoints, `db.ts` Drizzle setup, `email.ts`, `security.ts`, `seo-inject.ts`
- `shared/` — `schema.ts` (DB + types), `seo.ts`
- `scripts/` — `migrate.mjs`, `backup.sh`, `deploy.sh`, `reset-admin.mjs`
- `data/club.db` — the SQLite database (gitignored); uploads land in `public/uploads/`

## Deployment

Production runs on the same Ubuntu VM as neaves.au: PM2 (`ecosystem.config.cjs`) + nginx + Cloudflare, **PORT=5001** (neaves.au owns 5000). Docker + Cloudflare Tunnel is the alternative path. Details: `DEPLOYMENT.md`, `SETUP_HOSTING.md`, `HANDOVER.md`.
