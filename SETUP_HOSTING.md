# Hosting Guide — on a rented server

This guide puts the club website on a small rented server (a "VPS" or virtual
machine) running Ubuntu or Debian, kept running by PM2. If the club would
rather run it on a PC in the clubhouse, follow [CLUBHOUSE_SETUP.md](CLUBHOUSE_SETUP.md)
instead — that is simpler and needs no server.

## What to order

Any small virtual server will run this comfortably. The site itself uses about
**80 MB of memory** and the whole installation is around 300 MB on disk.

| | Minimum | Comfortable, with room to grow |
|---|---|---|
| **Memory (RAM)** | 1 GB | 2 GB |
| **Disk** | 10 GB | 25 GB or more |
| **Operating system** | Ubuntu 22.04 / Debian 12 or newer | Same |

The cheapest tier at most providers is enough. Pick 2 GB of memory if you want
the site to keep serving smoothly while you rebuild it after an update, which
is the only moment it needs more than it usually does.

Photos are automatically shrunk on upload (roughly 300 KB each), and nightly
backups share disk space with the existing photos rather than duplicating them,
so a club with a thousand photos and years of history stays under about 2 GB.

---

## The one thing to check: the port

The site listens on the `PORT` set in `.env` (5000 unless you change it). If
the server already runs another website on port 5000, set `PORT=5001` (or any
free number) in `.env`. That one setting is used by the site, by PM2 and by the
tunnel scripts, so there is nowhere else to change.

---

## Step 1 — Get the code onto the server

SSH in, then:

```bash
cd ~
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git club-website
cd club-website
```

## Step 2 — First-time setup (one command)

```bash
bash scripts/setup.sh
```

This installs Node.js and PM2 if they are missing, creates `.env` with a random
session secret, a hard-to-guess admin address and a random first admin
password, pauses so you can look over `.env`, then installs, builds, creates the
database and starts the site under PM2.

**At the end it prints the admin login address, `admin`, and the starting
password. Write them down.** (They are also in `.env`, as `ADMIN_PATH` and
`SEED_ADMIN_PASSWORD`.)

Check it's up:

```bash
pm2 status                          # should list club-website, online
curl -I http://localhost:5000       # use your PORT if you changed it; expect HTTP 200
```

## Step 3 — Put it on the internet

### Recommended: Cloudflare Tunnel

The tunnel gives the site HTTPS on the club's domain without opening any port
on the server, and the connection from Cloudflare to the server is encrypted
all the way. It needs the domain added to a free Cloudflare account (Cloudflare
walks you through pointing the nameservers, a one-time step).

```bash
./scripts/tunnel-setup.sh yourclub.org.au
pm2 restart club-website            # picks up SITE_URL, which the script sets
```

The script installs cloudflared, opens a Cloudflare login (copy the URL into a
browser if the server has no screen), creates the tunnel and the DNS records for
both `yourclub.org.au` and `www.`, and installs it as a service that starts on
boot. If a DNS record from earlier hosting is in the way, it says so and stops:
delete that record in the Cloudflare dashboard and run it again.

No domain yet? `./scripts/tunnel-quick.sh` gives a free temporary address
(`https://something.trycloudflare.com`) for showing the committee. It changes
every time and is for testing only.

### Alternative: nginx in front, with Cloudflare

Only if the server already uses nginx for other sites. Cloudflare must talk to
nginx over **HTTPS**, or admin passwords would cross the internet unencrypted
between Cloudflare and the server. So:

1. In Cloudflare: **SSL/TLS → Origin Server → Create Certificate**. Save the
   certificate and key on the server, e.g. `/etc/ssl/club-website.pem` and
   `/etc/ssl/club-website.key`.
2. Add an nginx site (replace the domain, and the port if you changed it):

   ```nginx
   server {
       listen 443 ssl;
       server_name yourclub.org.au www.yourclub.org.au;
       ssl_certificate     /etc/ssl/club-website.pem;
       ssl_certificate_key /etc/ssl/club-website.key;

       client_max_body_size 10m;            # photo uploads (8 MB limit)

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto https;
       }
   }
   ```

   Save it as `/etc/nginx/sites-available/club-website`, then:

   ```bash
   sudo ln -s /etc/nginx/sites-available/club-website /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. In Cloudflare **DNS**, add `A` records for `@` and `www` pointing at the
   server's IP, **Proxied** (orange cloud). Set **SSL/TLS → Overview → Full
   (strict)**.
4. Add `SITE_URL=https://yourclub.org.au` to `.env`, then `pm2 restart club-website`.
5. Firewall: let the internet reach only SSH and 443, and ideally only
   Cloudflare's addresses on 443. The site's own port (5000) should never be
   reachable from outside:

   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

## Step 4 — Log in and lock down

1. Go to `https://yourclub.org.au<ADMIN_PATH>/login` (the admin address
   printed by setup, also in `.env`).
2. Log in as `admin` with the starting password.
3. **Change the password straight away** — a yellow banner reminds you until
   you do, or use the **Password** button in the admin top bar. The setup
   wizard then walks you through the club's details.

The admin address being hard to guess is a small extra, not a lock: it is
visible to anyone who looks at the page's code. The password, and the
automatic lock-out after repeated wrong guesses, are what keep people out.

---

## Updating later

```bash
cd ~/club-website
./scripts/deploy.sh
```

That pulls the latest code, installs, **backs up**, updates the database,
rebuilds and restarts the site. If the database update fails it stops before
restarting, and the backup it just took is what you'd restore from. Your
database and photos live in `data/` and `public/uploads/` and are untouched by
updates.

---

## Backups

```bash
cd ~/club-website
./scripts/backup.sh         # writes a timestamped copy to data/backups/
```

Automatic nightly backup — `crontab -e` and add:

```
0 3 * * * cd /home/YOURUSER/club-website && ./scripts/backup.sh
```

Backups on the same disk protect against mistakes, not a dead disk. Set
`BACKUP_DIR` in `.env` to somewhere else (another disk, a mounted network
share) so a failed disk doesn't take the backups with it. To restore, see
`./scripts/restore.sh` (it lists the backups and asks before changing
anything).

---

## Quick reference

```bash
pm2 status                       # is it running?
pm2 logs club-website            # what is it doing?
pm2 restart club-website         # restart it (after editing .env, say)
```

If the server also runs other sites, they are fully independent: separate
ports, separate PM2 processes, separate databases.

---

## Docker instead

The repo also includes a `Dockerfile` and `docker-compose.yml` that run the site
next to a Cloudflare Tunnel (automatic HTTPS, no nginx, no open ports). Set
`CLOUDFLARE_TUNNEL_TOKEN` in `.env` (from Cloudflare Zero Trust → Networks →
Tunnels), then:

```bash
docker compose up -d --build
docker compose logs web          # the first admin's starting password is printed here, once
```

The first admin account is only created when there are no accounts at all, so
restarting the container never brings back a deleted one.
