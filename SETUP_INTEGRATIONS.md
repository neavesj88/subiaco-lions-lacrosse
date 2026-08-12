# Integrations Setup — Google Login & Email

This guide walks through the two optional integrations, step by step.
Neither is required for the site to run — without them, the site still works
(admins log in with username/password, and form submissions save to the database).
But setting them up gives you **"Sign in with Google"** and **automatic email
notifications**.

Both are configured by editing the `.env` file in the project root, then
restarting the app (`pm2 restart club-website`, or just re-run `npm run dev`
in development).

---

## Part 1 — Google Sign-In for admins

Lets admins log into the admin area with their Google account instead of a password.

### Step 1: Create a Google Cloud project
1. Go to **https://console.cloud.google.com**
2. Click the project dropdown (top-left) → **New Project**
3. Name it e.g. "Subiaco Lions Website" → **Create**
4. Make sure the new project is selected

### Step 2: Configure the consent screen
1. Left menu → **APIs & Services → OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - App name: `Subiaco Lions Lacrosse`
   - User support email: your club email
   - Developer contact email: your email
4. **Save and Continue** through the Scopes and Test Users steps (defaults are fine)
5. Back on the dashboard, click **Publish App** so any club admin can use it
   (while in "Testing" mode only emails you add as test users can log in)

### Step 3: Create the OAuth credentials
1. Left menu → **APIs & Services → Credentials**
2. **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Lions Website`
5. Under **Authorised redirect URIs**, click **+ Add URI** and add BOTH:
   - For local testing: `http://localhost:5000/api/auth/google/callback`
   - For your live site: `https://YOURDOMAIN.com.au/api/auth/google/callback`
6. **Create**
7. A popup shows your **Client ID** and **Client Secret** — copy both

### Step 4: Add them to `.env`
```env
GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
GOOGLE_CALLBACK_URL=https://YOURDOMAIN.com.au/api/auth/google/callback
```
(Use the `http://localhost:5000/...` callback when testing locally.)

### Step 5: Restart and match emails
1. Restart the app: `pm2 restart club-website`
2. The **"Sign in with Google"** button now appears on the admin login page
3. **Important:** an admin can only log in with Google if their Google email
   matches the email on their admin account. In **Admin → Users**, make sure
   each person's email is their Google address.

✅ Done. Admins can now click "Sign in with Google".

---

## Part 2 — Email notifications (Mailgun)

When set up, the club gets an email whenever someone uses the **Contact** form
or the **Sign Up** form, and the person who signed up gets a confirmation reply.

We use **Mailgun** — the same provider as neaves.au. Free tier easily covers a
club's volume.

### Step 1: Create a Mailgun account
1. Go to **https://www.mailgun.com** → sign up (free)
2. Verify your email and phone number

### Step 2: Add and verify a sending domain
You need a domain to send from (e.g. `mail.subiacolions.com.au`).
1. Mailgun dashboard → **Sending → Domains → Add New Domain**
2. Enter a subdomain like `mail.yourdomain.com.au` (a subdomain is recommended)
3. Mailgun shows several **DNS records** (TXT, MX, CNAME)
4. Add those records in your domain's DNS (Cloudflare, if that's where your
   domain lives — same place you set up the website's DNS)
5. Back in Mailgun, click **Verify DNS Settings** (can take a few minutes to hours)

> No club domain yet? You can use Mailgun's **sandbox domain** for testing, but
> it only sends to pre-authorised addresses — fine for trying it out.

### Step 3: Get your SMTP credentials
1. Mailgun → **Sending → Domains → (your domain) → SMTP**
2. Note the **SMTP hostname** (usually `smtp.eu.mailgun.org` for EU, or
   `smtp.mailgun.org` for US — the code defaults to EU)
3. You'll see a **default SMTP login** (like `postmaster@mail.yourdomain.com.au`)
   and a **password** — copy both

### Step 4: Add them to `.env`
```env
CONTACT_EMAIL_USER=postmaster@mail.yourdomain.com.au
CONTACT_EMAIL_PASS=your-mailgun-smtp-password
CLUB_NOTIFY_EMAIL=subiacolacrosseclub@outlook.com
```
- `CONTACT_EMAIL_USER` / `CONTACT_EMAIL_PASS` — the SMTP login from Step 3
- `CLUB_NOTIFY_EMAIL` — where the club wants to *receive* notifications
  (can be any inbox, e.g. your existing Outlook address)

### Step 5: Restart and test
1. Restart the app: `pm2 restart club-website`
2. Go to the **Contact** page on the site and send a test message
3. Check the `CLUB_NOTIFY_EMAIL` inbox — you should get the message
4. Submit a test **Sign Up** — you'll get a notification, and the email you
   entered gets a confirmation reply

> If nothing arrives: check the server logs (`pm2 logs club-website`). The app
> prints `[email] Sent` on success or a warning if credentials are missing.
> Email failures never break the forms — submissions always save to the database
> and appear in the admin panel regardless.

---

## Using Gmail instead of Mailgun (simpler, lower volume)

If you'd rather use a Gmail account:
1. Enable **2-Step Verification** on the Google account
2. Create an **App Password** (Google Account → Security → App passwords)
3. In `.env`:
   ```env
   CONTACT_EMAIL_USER=yourclubgmail@gmail.com
   CONTACT_EMAIL_PASS=the-16-char-app-password
   CLUB_NOTIFY_EMAIL=yourclubgmail@gmail.com
   ```
The code auto-detects `@gmail.com` and uses Gmail's SMTP server. Gmail limits
sending to ~500 emails/day, which is plenty for a club.

---

## Quick reference — full `.env`

```env
# Core (required)
DATABASE_URL=./data/club.db
SESSION_SECRET=long-random-string-generated-by-setup.sh
NODE_ENV=production
PORT=5000

# Google Sign-In (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://yourdomain.com.au/api/auth/google/callback

# Email (optional)
CONTACT_EMAIL_USER=
CONTACT_EMAIL_PASS=
CLUB_NOTIFY_EMAIL=subiacolacrosseclub@outlook.com
```
