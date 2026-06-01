# Hosting Guide — Subiaco Lions Lacrosse Club

This guide gets the website live on the internet with a proper domain and HTTPS.

**You do NOT need to flash a PC with Debian or be a Linux expert.** Pick the
option below that suits you. The recommended one (Docker + Cloudflare Tunnel)
is the closest thing to one-click and avoids the fiddly parts of hosting
(no nginx, no SSL certificates, no router port-forwarding).

---

## First, answer one question: where will it run?

The website is a small program that needs to run 24/7 on a computer that's
always on. Your options, cheapest to easiest:

| Option | Cost | Effort | Best if… |
|--------|------|--------|----------|
| **A. Cloud server (VPS)** | ~$5–6/mo | Low | You want it always-on and hands-off (**recommended for a club**) |
| **B. A spare PC at home/clubhouse** | Free | Medium | You have an always-on computer and want $0 hosting |
| **C. Managed platform (Render etc.)** | Free–$7/mo | Lowest | You want zero server management at all |

**For a sports club, Option A (a $6/month cloud server) is the sweet spot** —
it's always online, doesn't depend on the clubhouse internet, and the setup
below is copy-paste. The rest of this guide assumes A or B (they're identical
once you have a machine). Option C is covered briefly at the end.

You do **not** flash or install Debian yourself for Option A — the cloud
provider gives you a ready-to-go Ubuntu/Debian machine in about 60 seconds.

---

## What you need before starting (15 minutes, one-time)

1. **A domain name** — e.g. `subiacolions.com.au`. Buy from any registrar
   (~$15/yr), or you may already have one.
2. **A free Cloudflare account** — https://dash.cloudflare.com/sign-up
   - Add your domain to Cloudflare (it walks you through pointing your
     domain's nameservers at Cloudflare — a 5-minute, one-time step).
3. **A server** (Option A) — see the box below.

> **Getting a cloud server (Option A):** Sign up at DigitalOcean, Vultr,
> Hetzner, or Linode. Create the cheapest "Droplet"/"Instance" with
> **Ubuntu 24.04**, 1GB RAM. They email you an IP address and password.
> That's your server. You connect to it by typing `ssh root@YOUR_SERVER_IP`
> in a terminal (Mac/Linux: Terminal app; Windows: PowerShell or
> [PuTTY](https://putty.org)).

---

## The Easy Path: Docker + Cloudflare Tunnel (recommended)

This bundles everything. Once set up, the whole site runs with **one command**,
and updates are **one command**. No nginx, no SSL certs, no open ports.

### Step 1 — Install Docker on the server (one-time, copy-paste)

Connect to your server (`ssh root@YOUR_SERVER_IP`) and run:

```bash
curl -fsSL https://get.docker.com | sh
```

That's it — Docker is installed.

### Step 2 — Create the Cloudflare Tunnel (one-time, in the browser)

This is what gives you HTTPS and a public address with no server config.

1. Go to the **Cloudflare Zero Trust** dashboard:
   https://one.dash.cloudflare.com → pick your account
   (if asked to choose a plan, choose the **Free** plan).
2. Left menu → **Networks → Tunnels** → **Create a tunnel**.
3. Choose **Cloudflared** → name it `lions-lacrosse` → **Save tunnel**.
4. On the next screen you'll see a **token** (a long string starting with
   `eyJ...`). **Copy it** — you'll paste it in Step 4. Ignore the install
   commands they show; Docker handles that part.
5. Scroll to **Public Hostnames** → **Add a public hostname**:
   - **Subdomain:** leave blank (or `www`)
   - **Domain:** pick your domain
   - **Type:** `HTTP`
   - **URL:** `web:5000`  ← important: this exact value
   - **Save**.
6. (Optional, recommended) Add a second public hostname for `www` the same way,
   both pointing at `web:5000`.

### Step 3 — Get the code onto the server

```bash
# Install git if needed, then clone the project
apt-get update && apt-get install -y git
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git
cd subiaco-lions-lacrosse
```

### Step 4 — Configure your secrets

```bash
cp .env.example .env
nano .env
```

Set these three lines (leave the rest as-is for now):

```env
NODE_ENV=production
SESSION_SECRET=paste-a-long-random-string-here
CLOUDFLARE_TUNNEL_TOKEN=paste-the-token-from-step-2
```

> Generate a random `SESSION_SECRET` by running this once and pasting the output:
> ```bash
> openssl rand -hex 32
> ```

Save and exit nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

### Step 5 — Launch 🚀

```bash
docker compose up -d --build
```

The first run takes a few minutes (it builds the site). When it finishes,
**open your domain in a browser** — the site is live, with HTTPS, automatically.

That's the whole deployment. Two services are now running: the website and the
Cloudflare tunnel, both set to restart automatically if the server reboots.

### Step 6 — Log in and lock it down

1. Go to `https://yourdomain.com/admin/login`
2. Log in with **`admin` / `lions2024!`**
3. **Immediately** change the admin password (Admin → Users), and update the
   club details in Admin → Settings.

---

## Updating the site later

When there are new features/fixes, updating is two commands on the server:

```bash
cd subiaco-lions-lacrosse
git pull
docker compose up -d --build
```

Your database and uploaded photos are safe — they live in the `data/` and
`public/uploads/` folders on the server, which survive rebuilds.

---

## Backups (do this!)

Your entire site (all content, photos, sign-ups) is in two folders on the
server: `data/` and `public/uploads/`. Back them up regularly.

**Quick manual backup:**
```bash
cd subiaco-lions-lacrosse
tar czf ~/lions-backup-$(date +%F).tar.gz data public/uploads
```

**Automatic nightly backup** — run `crontab -e` and add:
```
0 2 * * * cd /root/subiaco-lions-lacrosse && tar czf ~/lions-backup-$(date +\%F).tar.gz data public/uploads
```

Then copy those backup files off the server occasionally (e.g. download them to
a club laptop, or set up Cloudflare R2 / Dropbox).

---

## Common operations

```bash
# See if it's running / view status
docker compose ps

# View live logs (Ctrl+C to stop watching)
docker compose logs -f web

# Restart everything
docker compose restart

# Stop the site
docker compose down

# Start it again
docker compose up -d
```

---

## Troubleshooting

**Domain shows a Cloudflare error / "no healthy origin":**
- Check both services are up: `docker compose ps` (both should say "running").
- In the tunnel's Public Hostname, confirm the URL is exactly `web:5000`.
- View logs: `docker compose logs web` and `docker compose logs tunnel`.

**"Email not sending" / "Google login not showing":**
- Those are optional. Fill in the relevant `.env` values and run
  `docker compose up -d` again. See `SETUP_INTEGRATIONS.md` for the steps.

**Site works but I want to change content:**
- Everything is editable in the admin panel — no redeploy needed. Only code
  changes require the `git pull` + rebuild step.

---

## Alternative: Option C — Managed platform (no server at all)

If you'd rather not manage a server, platforms like **Render.com** can run the
Docker image directly:

1. Push this repo to your GitHub (already done).
2. On Render: **New → Web Service → connect the repo**.
3. Render auto-detects the `Dockerfile`. Set:
   - **Environment variable** `SESSION_SECRET` = a long random string
   - **Add a Disk** mounted at `/app/data` (so the database persists)
4. Deploy. Render gives you an HTTPS URL; point your domain at it via a CNAME.

This skips Docker/SSH entirely but costs ~$7/mo for an always-on instance with
a persistent disk (the free tier sleeps and would wipe SQLite data).

---

## Why this approach (the short version)

- **Cloudflare Tunnel** replaces nginx + SSL certificates + port-forwarding with
  a single token. Cloudflare terminates HTTPS and forwards traffic to your app
  over an encrypted tunnel — nothing on your server is exposed to the internet
  directly, which is also more secure.
- **Docker** bundles Node, the build tools, and the app so you never install or
  match versions by hand. "It works on my machine" becomes "it works."
- **SQLite** means there's no separate database server to run or back up — your
  whole site is a couple of folders you can copy.
