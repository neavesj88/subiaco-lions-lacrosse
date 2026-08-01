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
Default credentials: **`admin` / `changeme123!`** — change this immediately.
(Set `SEED_ADMIN_PASSWORD` in `.env` before seeding to choose your own.)

---

## Hosting it for real

**Running it on a PC in the clubhouse?** Read **[CLUBHOUSE_SETUP.md](CLUBHOUSE_SETUP.md)**.
That covers the whole thing end to end, including how to put the site on the
internet when the club's connection has no fixed IP address (which is the usual
case) — no port forwarding and no router changes needed.

The rest of this section is the alternative: hosting on a rented server.

Runs the same way as neaves.au (PM2 + nginx + Cloudflare) and is designed to
sit **alongside it on the same Ubuntu VM** — it uses port **5001** so it won't
clash with neaves.au on 5000.

```bash
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git
cd subiaco-lions-lacrosse
cp .env.example .env        # set SESSION_SECRET, PORT=5001
npm ci && npm run build
node scripts/migrate.mjs && npm run db:seed
pm2 start ecosystem.config.cjs --env production && pm2 save
# then add an nginx server block → localhost:5001 and point Cloudflare DNS at the VM
```

**Full step-by-step (nginx block, Cloudflare DNS, backups, running both sites):
[SETUP_HOSTING.md](./SETUP_HOSTING.md).**
Integrations (email, Google login): [SETUP_INTEGRATIONS.md](./SETUP_INTEGRATIONS.md).

### Updating after the first deploy

```bash
./scripts/deploy.sh         # git pull → install → migrate → build → pm2 restart
```

> Want zero-server hosting on a fresh machine instead? A Docker + Cloudflare
> Tunnel setup is also bundled (`docker compose up -d --build`) — but on your
> existing VM the steps above are simpler.

---

## Scripts at a glance

| Script | What it does |
|--------|--------------|
| `scripts/setup.sh`   | One-time server setup (Node, PM2, build, seed, start) |
| `scripts/deploy.sh`  | Pull latest code and redeploy |
| `scripts/tunnel-quick.sh` | Free temporary public URL — no domain needed (testing/demos) |
| `scripts/tunnel-setup.sh` | Permanent Cloudflare Tunnel on your own domain (no nginx/SSL/ports) |
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
