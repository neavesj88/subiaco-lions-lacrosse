# Hosting Guide — Subiaco Lions Lacrosse Club

You already run **neaves.au on an Ubuntu server VM** (PM2 + nginx + Cloudflare).
This site is built the same way, so the easiest option by far is to **run it
alongside neaves.au on that same VM**. No new server, no Docker needed.

This guide is written specifically for that. (A Docker/Cloudflare-Tunnel option
also exists if you ever want it — see the end.)

---

## The one thing that matters: ports

Your VM already runs neaves.au on **port 5000**. Two apps can't share a port,
so the Lions site is configured to run on **port 5001** (already set in
`ecosystem.config.cjs`). nginx then routes each domain to the right port:

```
lions-domain.com   → Cloudflare → nginx → localhost:5001  (Lions)
neaves.au          → Cloudflare → nginx → localhost:5000  (existing)
```

Everything else (PM2, the HTTP-only nginx + Cloudflare SSL pattern) is identical
to what you already do.

---

## Step 1 — Get the code onto the VM

SSH into your VM (the same one running neaves.au), then:

```bash
cd ~
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git
cd subiaco-lions-lacrosse
```

## Step 2 — Configure secrets

```bash
cp .env.example .env
nano .env
```

Set at minimum:

```env
NODE_ENV=production
PORT=5001
SESSION_SECRET=paste-a-long-random-string
ADMIN_PATH=/pick-a-secret-path        # admin login lives here, not /admin
```

Generate the secret with: `openssl rand -hex 32`
Pick a private `ADMIN_PATH` (e.g. `/lions-office-7y2x`) so the login isn't at the
obvious `/admin`. You'll log in at `https://your-domain.com<ADMIN_PATH>/login`.
(Email + Google login are optional — see `SETUP_INTEGRATIONS.md`. Leave blank for now.)

Save: `Ctrl+O`, `Enter`, `Ctrl+X`.

## Step 3 — Install, build, seed, start

Node and PM2 are already on your VM from neaves.au, so:

```bash
npm ci                      # install dependencies
npm run build               # build frontend + backend
node scripts/migrate.mjs    # create database tables
npm run db:seed             # create default admin + starter content
pm2 start ecosystem.config.cjs --env production
pm2 save                    # remember it across reboots
```

Check it's up:
```bash
pm2 status                          # should list lions-lacrosse, online
curl -I http://localhost:5001       # should return HTTP 200
```

At this point the Lions site is running on the VM — we just need to point a
domain at it.

## Step 4 — Add the nginx server block

You already have an nginx config for neaves.au. We **add a second server block**
for the Lions domain — it doesn't touch your existing one.

```bash
sudo nano /etc/nginx/sites-available/lions-lacrosse
```

Paste this (replace `lions-domain.com` with the real domain):

```nginx
server {
    listen 80;
    server_name lions-domain.com www.lions-domain.com;

    location / {
        proxy_pass http://localhost:5001;   # Lions app port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/lions-lacrosse /etc/nginx/sites-enabled/
sudo nginx -t          # test config — should say "syntax is ok"
sudo systemctl reload nginx
```

> **Note:** if your neaves.au config is the default `sites-enabled/default` with
> a catch-all `server_name _;`, adding `server_name lions-domain.com` here means
> nginx now routes by domain name — neaves.au keeps working, Lions gets its own.

## Step 5 — Point the domain at the VM in Cloudflare

Same as you did for neaves.au:

1. In Cloudflare, add the Lions domain (or use a subdomain of an existing one).
2. **DNS → Add record:**
   - Type `A`, Name `@`, IPv4 = **your VM's IP**, Proxy status **Proxied** (orange cloud)
   - Type `A`, Name `www`, IPv4 = **your VM's IP**, Proxied
3. **SSL/TLS → Overview** → set to **Full** (matches your neaves.au setup —
   Cloudflare does HTTPS, nginx stays HTTP-only).

Give DNS a minute, then open `https://lions-domain.com` — it's live with HTTPS.

## Step 6 — Log in and lock down

1. Go to your secret admin path: `https://lions-domain.com<ADMIN_PATH>/login`
   (e.g. `/pick-a-secret-path/login` — whatever you set in `.env`).
2. Log in: **`admin` / `lions2024!`**
3. **Change the password immediately** — a yellow warning banner will prompt you,
   or use the **Password** button in the admin top bar. Then set club details in
   Settings.

---

## Updating later

```bash
cd ~/subiaco-lions-lacrosse
git pull
npm ci
npm run build
node scripts/migrate.mjs
pm2 restart lions-lacrosse
```

(Or just run `./scripts/deploy.sh`, which does all of that.) Your database and
uploaded photos live in `data/` and `public/uploads/` and are untouched by updates.

---

## Backups

Same idea as neaves.au, but this site's data is just two folders (SQLite +
uploads). Quick manual backup:

```bash
cd ~/subiaco-lions-lacrosse
./scripts/backup.sh         # writes a timestamped copy to data/backups/
```

Automatic nightly backup — `crontab -e` and add:
```
0 3 * * * cd /home/YOURUSER/subiaco-lions-lacrosse && ./scripts/backup.sh
```
(Use 3am so it doesn't clash with your neaves.au 2am job.)

---

## Running both sites — quick reference

```bash
pm2 status                       # see both apps (portfolio-website + lions-lacrosse)
pm2 logs lions-lacrosse          # Lions logs only
pm2 restart lions-lacrosse       # restart just the Lions site
```

The two sites are fully independent: separate ports, separate PM2 processes,
separate databases, separate nginx blocks. Restarting or updating one never
affects the other.

---

## If you ever want zero-server hosting instead (Docker + Cloudflare Tunnel)

The repo also includes a `Dockerfile` and `docker-compose.yml` that bundle the
app with a Cloudflare Tunnel (automatic HTTPS, no nginx, no ports). That's
useful on a fresh machine, but since you already have a working VM, **Steps 1–6
above are the simpler path for you.** If you do want the Docker route, run
`docker compose up -d --build` after setting `CLOUDFLARE_TUNNEL_TOKEN` in `.env`.
