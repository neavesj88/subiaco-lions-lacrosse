# Subiaco Lions Lacrosse Club — Website

The official website for the Subiaco Lions Lacrosse Club. A full content-managed
club site: news, calendar, fixtures, photo gallery, juniors info, sign-ups,
sponsors, newsletter and a complete admin panel — all editable without touching code.

Built with **React + Vite + Express + SQLite** (same stack family as neaves.au,
but self-contained — no external database needed).

---

## Quick Start (local development)

```bash
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git
cd subiaco-lions-lacrosse
npm install
node scripts/migrate.mjs   # create the database tables
npm run db:seed            # create the default admin + starter content
npm run dev                # → http://localhost:5000
```

Then log in at **http://localhost:5000/admin/login**
Default credentials: **`admin` / `lions2024!`** — change this immediately.

---

## Hosting it for real

Everything you need is automated. On a fresh Ubuntu server:

```bash
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git
cd subiaco-lions-lacrosse
bash scripts/setup.sh      # installs Node + PM2, builds, seeds, starts the app
```

Then point nginx + Cloudflare at it. **Full step-by-step guide:
[DEPLOYMENT.md](./DEPLOYMENT.md)** (nginx config, SSL, Google login, backups).

### Updating after the first deploy

```bash
./scripts/deploy.sh        # git pull → install → migrate → build → restart
```

---

## Scripts at a glance

| Script | What it does |
|--------|--------------|
| `scripts/setup.sh`   | One-time server setup (Node, PM2, build, seed, start) |
| `scripts/deploy.sh`  | Pull latest code and redeploy |
| `scripts/migrate.mjs`| Create/update database tables (safe to re-run) |
| `scripts/backup.sh`  | Back up the database (add to cron for nightly backups) |
| `scripts/restore.sh` | Restore the database from a backup |
| `npm run dev`        | Local development server with hot reload |
| `npm run build`      | Production build |
| `npm run db:seed`    | Seed default admin + starter content |

---

## What admins can manage (no code required)

Log in at `/admin` to manage everything:

- **News** — rich-text posts with images, pin/highlight, draft/publish
- **Calendar** — club events (or embed a Google Calendar)
- **Fixtures & Results** — match results with scores
- **Photo Gallery** — drag-and-drop image library with captions
- **Juniors** — fully editable program info
- **Sign-ups** — view registrations, track status, auto-email confirmations
- **Sponsors** — logos + tiers shown on the home page
- **Newsletter** — collect subscribers, export to CSV
- **Pages** — edit page text inline (hover any text while logged in → pencil)
- **Media** — upload once, pick anywhere (logo, hero, sponsors, posts)
- **Settings** — logo, hero image, Instagram feed, social links
- **Page visibility** — toggle any page on/off instantly
- **Users** — multiple admins with role-based permissions

### Admin roles

| Role | Can manage |
|------|-----------|
| `super_admin` | Everything, including users & settings |
| `club_admin` | Events, fixtures, sign-ups, sponsors, newsletter, messages |
| `juniors_coordinator` | Juniors page content |
| `content_manager` | News posts & media |

Admins can sign in with username/password **or Google** (once configured).

---

## Tech stack

- **Frontend:** React 18, Vite, Wouter (routing), TanStack Query, Tailwind CSS, Radix UI
- **Editor:** TipTap (rich text with image upload)
- **Backend:** Express, Passport (Google OAuth), Multer (uploads), Nodemailer (email)
- **Database:** SQLite via Drizzle ORM — a single `data/club.db` file
- **Process manager:** PM2
- **Hosting:** nginx + Cloudflare (see DEPLOYMENT.md)

---

## Project structure

```
client/          React frontend
  src/pages/     One file per page (home, about, calendar, etc.)
  src/components/Reusable UI + CMS components (EditableSection, ImagePicker…)
server/          Express backend
  routes.ts      All API endpoints
  db.ts          Database connection
  email.ts       Email notifications
shared/
  schema.ts      Database schema (single source of truth)
scripts/         Setup, deploy, migrate, backup
data/            SQLite database + uploads (created at runtime, not committed)
```
