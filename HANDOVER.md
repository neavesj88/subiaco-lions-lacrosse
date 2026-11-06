# Club Handover Guide — Subiaco Lions Lacrosse Website

Welcome! This is everything the club needs to run the website. No coding required.
Keep this document somewhere safe (and share it with at least two committee members).

---

## 1. Logging in

- Go to **https://YOUR-DOMAIN/SECRET-PATH/login**
  (the admin area is at a private path, not the obvious "/admin", which keeps it
  out of the way of casual bots — though anyone reading the page's code can find it,
  so the password is what really protects it
  out — the exact address was provided at handover. Bookmark it.)
- Username and password were provided at handover.
- **First thing to do:** if you see a yellow "Security warning" bar at the top,
  click **Change Password** and set your own. Don't skip this.

> Tip: every admin can change their own password anytime via the **Password**
> button in the top-right of the admin panel.

> **This whole guide also lives inside the site:** click the **Help** tab in
> the admin panel for step-by-step instructions on every feature. You never
> need to find this document again.

---

## 2. Editing the website

Almost everything is editable without code:

| To change… | Go to… |
|------------|--------|
| News / announcements | Admin → **News** |
| Games & events | Admin → **Events** |
| Match results & ladders | Admin → **Results** (or they link out to GameDay) |
| Photos | Admin → **Photos** (upload), shown on **Gallery** |
| Junior program info | Admin → **Juniors** |
| Sponsors | Admin → **Sponsors** |
| Page text (headings, intros) | Log in, then **hover any text** on the page → click the pencil |
| Your own extra pages (Life Members, Policies…) | Admin → **Pages** |
| The top menu, dropdowns and footer links | Admin → **Menu** |
| Logo, hero image, social links, club email | Admin → **Settings** |
| Team names, privacy wording, About page facts | Admin → **Settings → Wording & club details** |
| Turn a whole page on/off | Admin → **Settings → Page Visibility** |

Changes are live instantly — no "publish site" step.

---

## 3. Managing who has access (admins)

Admin → **Admin Users** (Super Admins only). There are five roles:

| Role | Can do |
|------|--------|
| **Super Admin** | Everything, including managing admins and security |
| **Club Admin** | All content, settings, the shop, sign-ups and messages — not admins or security |
| **Juniors Coordinator** | The Juniors page, plus news and photos |
| **Content Manager** | News posts & photos |
| **Social Media Manager** | News posts & photos only |

**Golden rules so you never get locked out:**
- Always keep **at least two Super Admins** (e.g. President + Secretary).
  The site will refuse to delete or demote the *last* Super Admin on purpose.
- When someone leaves the committee, either delete their account or set it to
  inactive.

---

## 4. Login protection (automatic)

The admin login automatically protects itself against password-guessing:
after three wrong passwords from the same internet connection, that connection
is locked out for 5 minutes, then longer if it keeps trying. Other connections
are not affected — but note that every device on the clubhouse Wi-Fi shares
one connection, so a lock-out there applies to all of them.

Super Admins can see any locked-out connections — and clear them — under
**Security** in the admin panel. If *you* get locked out by mistake, wait for
it to pass, use your phone's mobile data instead of the Wi-Fi, ask another
Super Admin to clear it, or have whoever manages the computer restart the
website (lock-outs are forgotten on a restart:
`sudo systemctl restart club-website` on the clubhouse PC,
`pm2 restart club-website` on a rented server).

---

## 5. "Help, nobody can log in!" (emergency reset)

If every admin is locked out, whoever manages the server can reset access:

```bash
cd ~/club-website
node scripts/reset-admin.mjs
```

This prints a new temporary password for the `admin` account (and restores it
to Super Admin). Log in with it, then change it. This works even with no email
set up — it's the guaranteed way back in. If the reason nobody could log in was
a lock-out after wrong guesses, also restart the website (see above), which
clears it.

---

## 6. Backups (important!)

Everything you create — news, photos, sign-ups — lives on the server. Back it up.

- A backup runs automatically every night (if set up at handover).
- To make one manually, on the server:
  ```bash
  cd ~/club-website && ./scripts/backup.sh
  ```
- **Occasionally download a backup off the server** (e.g. to a committee
  laptop) so you're covered if the server itself fails.

---

## 7. Optional features you can turn on later

These work without setup, but become better if configured (see
`SETUP_INTEGRATIONS.md` for click-by-click steps):

- **Email alerts** — get an email when someone signs up or sends a message.
- **Google Sign-In** — log in with a Google account instead of a password.
- **Instagram feed** — show your latest posts automatically.
- **Google Calendar** — display an existing club Google Calendar.

---

## 8. Who to call

- **Day-to-day content:** any committee member with an admin login (this guide).
- **Server / domain / technical issues:** whoever set the site up for you.
- The full technical docs are in the project: `README.md`, `SETUP_HOSTING.md`,
  `SETUP_INTEGRATIONS.md`, `DEPLOYMENT.md`.

---

*Built for the Subiaco Lions Lacrosse Club. Go Lions! 🦁🥍*
