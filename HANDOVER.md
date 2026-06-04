# Club Handover Guide — Subiaco Lions Lacrosse Website

Welcome! This is everything the club needs to run the website. No coding required.
Keep this document somewhere safe (and share it with at least two committee members).

---

## 1. Logging in

- Go to **https://YOUR-DOMAIN/SECRET-PATH/login**
  (the admin area is at a private path, not the obvious "/admin", to keep bots
  out — the exact address was provided at handover. Bookmark it.)
- Username and password were provided at handover.
- **First thing to do:** if you see a yellow "Security warning" bar at the top,
  click **Change Password** and set your own. Don't skip this.

> Tip: every admin can change their own password anytime via the **Password**
> button in the top-right of the admin panel.

---

## 2. Editing the website

Almost everything is editable without code:

| To change… | Go to… |
|------------|--------|
| News / announcements | Admin → **News** |
| Games & events | Admin → **Events** |
| Match results & ladders | Admin → **Results** (or they link out to GameDay) |
| Photos | Admin → **Media** (upload), shown on **Gallery** |
| Junior program info | Admin → **Juniors** |
| Sponsors | Admin → **Sponsors** |
| Page text (headings, intros) | Log in, then **hover any text** on the page → click the pencil |
| Logo, hero image, social links, club email | Admin → **Settings** |
| Turn a whole page on/off | Admin → **Settings → Page Visibility** |

Changes are live instantly — no "publish site" step.

---

## 3. Managing who has access (admins)

Admin → **Users** (Super Admins only). There are four permission levels:

| Role | Can do |
|------|--------|
| **Super Admin** | Everything, including managing users & settings |
| **Club Admin** | Events, results, sign-ups, sponsors, newsletter, messages |
| **Juniors Coordinator** | Junior page content |
| **Content Manager** | News posts & photos |

**Golden rules so you never get locked out:**
- Always keep **at least two Super Admins** (e.g. President + Secretary).
  The site will refuse to delete or demote the *last* Super Admin on purpose.
- When someone leaves the committee, either delete their account or set it to
  inactive.

---

## 4. "Help, nobody can log in!" (emergency reset)

If every admin is locked out, whoever manages the server can reset access:

```bash
cd ~/subiaco-lions-lacrosse
node scripts/reset-admin.mjs
```

This prints a new temporary password for the `admin` account (and restores it
to Super Admin). Log in with it, then change it. This works even with no email
set up — it's the guaranteed way back in.

---

## 5. Backups (important!)

Everything you create — news, photos, sign-ups — lives on the server. Back it up.

- A backup runs automatically every night (if set up at handover).
- To make one manually, on the server:
  ```bash
  cd ~/subiaco-lions-lacrosse && ./scripts/backup.sh
  ```
- **Occasionally download a backup off the server** (e.g. to a committee
  laptop) so you're covered if the server itself fails.

---

## 6. Optional features you can turn on later

These work without setup, but become better if configured (see
`SETUP_INTEGRATIONS.md` for click-by-click steps):

- **Email alerts** — get an email when someone signs up or sends a message.
- **Google Sign-In** — log in with a Google account instead of a password.
- **Instagram feed** — show your latest posts automatically.
- **Google Calendar** — display an existing club Google Calendar.

---

## 7. Who to call

- **Day-to-day content:** any committee member with an admin login (this guide).
- **Server / domain / technical issues:** whoever set the site up for you.
- The full technical docs are in the project: `README.md`, `SETUP_HOSTING.md`,
  `SETUP_INTEGRATIONS.md`, `DEPLOYMENT.md`.

---

*Built for the Subiaco Lions Lacrosse Club. Go Lions! 🦁🥍*
