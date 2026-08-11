# Club website

A complete website for a sports club: news, fixtures, a calendar, a juniors
page, a photo gallery, a committee page, sign-up and contact forms, and an
optional shop that can take card payments.

Everything a visitor sees is edited from an admin panel in the browser. **You
do not edit code to run this site.** The only file you ever open in a text
editor is `.env`, once, during setup.

---

## Is this guide for you?

| You are | Read |
|---|---|
| A committee member who will **run** an already-installed site | [HANDOVER.md](HANDOVER.md) — how to edit pages, post news, manage admins |
| Setting the site up on **a computer at the club** | This guide, then [CLUBHOUSE_SETUP.md](CLUBHOUSE_SETUP.md) |
| Setting it up on **a rented server** | This guide, then [SETUP_HOSTING.md](SETUP_HOSTING.md) |
| Turning on **email or Google sign-in** | [SETUP_INTEGRATIONS.md](SETUP_INTEGRATIONS.md) |
| Turning on **the shop** | [SETUP_SHOP.md](SETUP_SHOP.md) |

**Be honest with yourself about step 3 below.** Installing this needs about
twenty minutes at a command line. If typing commands into a black window is not
something you have done before, that part is worth borrowing someone technical
for — an hour of their time, once. Everything after it is ordinary web forms.

---

> **Before you start:** work through
> [templates/club-details-worksheet.md](templates/club-details-worksheet.md).
> It lists every detail the site will ask you for, so you can gather them at a
> committee meeting rather than hunting for them mid-setup.

## What you need before starting

- **A computer to run it on**, left switched on. Any PC from the last ten years
  running Ubuntu or Debian Linux is plenty. It can sit in the clubhouse.
- **A domain name** — e.g. `yourclub.org.au`. Roughly $20 a year. You can try
  everything out without one first.
- **A free Cloudflare account** — this is how the site gets on the internet
  safely without touching the club's router. Sign up at cloudflare.com.
- **About an hour**, and someone technical on hand for step 3 if commands are
  unfamiliar.

You do **not** need a fixed IP address, port forwarding, or any router changes.

---

## Step 1 — Get the code

On the computer that will run the site:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git club-website
cd club-website
```

> The repository is named after the first club that used it. The site itself
> contains no club's details — you fill those in yourself in step 5.

## Step 2 — Install it

```bash
./scripts/install-clubhouse.sh
```

This installs everything, builds the site, creates your first admin login, sets
the site to start by itself whenever the computer is switched on, schedules a
nightly backup, and turns on automatic security updates.

**Write down the two things it prints at the end:**

1. The **admin web address** — something like `/manage-a3f9c2`. It is
   deliberately random so that password-guessing robots never find your login
   page. Without it you cannot get in.
2. The **starting password** for the `admin` account.

Check it worked:

```bash
curl -I http://localhost:5000
```

`HTTP/1.1 200 OK` means it is running.

## Step 3 — Put it on the internet

```bash
./scripts/tunnel-quick.sh
```

This prints a temporary web address you can open on your phone to prove the
site is genuinely reachable. It disappears when you stop the script.

When you have your domain name:

```bash
./scripts/tunnel-setup.sh yourclub.org.au
```

Why a "tunnel" rather than the usual approach: most club and home internet
connections get a new address every so often, and many cannot accept incoming
connections at all. A tunnel works the other way round — the club's computer
dials out and holds the line open — so it keeps working through address changes
and opens no ports on the club's network. [CLUBHOUSE_SETUP.md](CLUBHOUSE_SETUP.md)
explains this properly.

## Step 4 — Log in

Go to your site's address, then the admin address from step 2, then `/login`:

```
https://yourclub.org.au/manage-a3f9c2/login
```

Sign in as `admin` with the password from step 2, then **change that password
immediately** — Admin → Password. A red warning sits across the panel until you
do.

## Step 5 — Make it your club's

A setup wizard opens by itself the first time. It asks for:

- **Club name** — e.g. `Riverside Rovers`, and a second line like `Netball Club`
- **Your sport** — the word is used throughout the site, so "netball" makes
  pages read "junior netball programs" and so on
- **Where you play** — ground name and address, used on the contact map
- **Contact email** — where enquiries go
- **Your colours** — pick them and the whole site restyles instantly

> **On colours:** the site warns you if white text would be unreadable on the
> colour you picked. If you see that warning, choose a darker shade. Ignoring
> it makes your site hard to read in sunlight at a ground, which is exactly
> where people will be using it.

You can change all of it later under **Admin → Settings**. Nothing is set in
stone and nothing needs a developer.

## Step 6 — Fill in your content

Work through the admin panel left to right. Nothing is compulsory — a page you
leave empty shows a tidy "nothing here yet" message rather than breaking.

| Tab | What goes there |
|---|---|
| **News** | Announcements, shown on the home page |
| **Photos** | Your photo library, also the public gallery |
| **Events** | Training times, games, social events |
| **Committee** | President and board, for the public committee page |
| **Page Lists** | Team divisions, juniors FAQ |
| **Settings** | Club details, colours, which pages appear in the menu |
| **Admins** | Who else can log in, and how much they can do |

Turn off any page you do not want under **Settings → Page Visibility**. It
disappears from the menu and from Google.

---

## Giving other people access

**Admin → Admin Users.** Give each person the least access they need:

| Role | Can do |
|---|---|
| Super Admin | Everything, including adding admins and security |
| Club Admin | All content, settings and the shop — not admins or security |
| Juniors Coordinator | News, photos, juniors page |
| Content Manager | News and photos |
| Social Media Manager | News and photos only — sees nothing else at all |

Give volunteers the Social Media Manager role. It is the most limited one, so
it is the safest to hand out.

---

## Looking after it

| Task | How |
|---|---|
| Is it running? | `sudo systemctl status club-website` |
| Restart it | `sudo systemctl restart club-website` |
| Back up now | `./scripts/backup.sh` |
| Restore a backup | `./scripts/restore.sh` |
| Nobody can log in | `node scripts/reset-admin.mjs` on the club computer |

Backups run nightly by themselves and cover both the database and your photos.
**Copy them off the machine as well** — a backup on the same computer does not
help you when that computer's hard drive fails. See "Backups" in
[CLUBHOUSE_SETUP.md](CLUBHOUSE_SETUP.md).

---

## When something looks wrong

**The site will not load at all**

```bash
sudo systemctl status club-website
sudo journalctl -u club-website -n 50
sudo systemctl restart club-website
```

**It works at the clubhouse but not from outside** — that is the tunnel, not
the website:

```bash
systemctl restart cloudflared
```

**Logging in does nothing and returns to the login page** — the `SESSION_SECRET`
line in `.env` is probably empty:

```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
sudo systemctl restart club-website
```

**Something is going wrong right now and you want it stopped** — Admin →
Security → Emergency stops. Two switches: outgoing email, and card payments.
Both take effect immediately and lose nothing.

---

## Updating the site later

```bash
cd ~/club-website
./scripts/backup.sh
git pull
npm ci --omit=optional
node scripts/migrate.mjs
npm run build
sudo systemctl restart club-website
```

Always back up first. If an update goes wrong, `./scripts/restore.sh` puts you
back.

---

## Privacy, because clubs handle children's details

The sign-up form collects children's names, dates of birth, and their parents'
contact details. That carries real obligations:

- The form shows people what you collect and why, and will not submit until
  they tick to confirm they have read it. **Edit that wording to match your own
  club policy** — Admin → Settings, "privacy" fields.
- Sign-up details are only ever visible to logged-in admins with the Sign-Ups
  permission. They never appear on a public page, in the sitemap, or in Google.
- The committee page **is public** — names, photos, roles and any email you
  enter there are visible to anyone. Only put an adult committee member's
  details there, and use a club role address rather than a personal one where
  you can.
- Never put a child's full name and photo together in the public gallery
  without their parent's permission.

**Blank forms to get you started** are in [templates/](templates/):

- [privacy-policy.md](templates/privacy-policy.md) — adapt it, then publish it
  under Admin → Pages and link it from your footer
- [photo-consent-form.md](templates/photo-consent-form.md) — a parent's
  permission to publish photos of their child
- [committee-handover-checklist.md](templates/committee-handover-checklist.md) —
  for passing website access on at each AGM

They are plain-English starting points, not legal advice. Your sport's national
body probably publishes versions that take precedence — use theirs if so.

This site includes no analytics and no tracking of any kind.

---

## For developers

- Stack: React + Vite, Express, SQLite via Drizzle, Tailwind. No external
  database or paid service is required.
- `npm run dev` — development server on port 5000
- `npm run build` — production build
- `npm run check` — TypeScript check. There is no test suite.
- `node scripts/migrate.mjs` — create or update database tables
- Architecture notes and the rules that matter are in [CLAUDE.md](CLAUDE.md).
