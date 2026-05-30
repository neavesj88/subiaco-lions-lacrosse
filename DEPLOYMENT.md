# Deployment Guide — Subiaco Lions Lacrosse Club

Same infrastructure as neaves.au: **PM2 + nginx + Cloudflare**.

---

## First-Time Setup (fresh Ubuntu server)

```bash
# Clone repo
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git
cd subiaco-lions-lacrosse

# Run setup (installs Node, PM2, builds, seeds DB, starts app)
bash scripts/setup.sh
```

---

## Updating from Git (every time you push changes)

```bash
cd ~/subiaco-lions-lacrosse
./scripts/deploy.sh
```

This does: `git pull` → `npm ci` → migrate DB → `npm run build` → `pm2 reload`

---

## nginx Config (HTTP only — Cloudflare handles SSL)

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
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

```bash
sudo nginx -t && sudo systemctl restart nginx
```

---

## Cloudflare Setup

Identical to neaves.au:
1. Add domain → DNS A record → server IP, Proxy ON
2. SSL/TLS → Full (strict) + Always Use HTTPS
3. That's it — no cert management needed

---

## Environment Variables (.env)

```env
DATABASE_URL=./data/club.db
SESSION_SECRET=<long random string — setup.sh generates this>
NODE_ENV=production
PORT=5000

# Google OAuth (optional — enables "Sign in with Google" on admin login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
```

---

## Google OAuth Setup (for admin Google Sign-In)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. New project → APIs & Services → Credentials
3. Create OAuth Client ID → Web application
4. Authorised redirect URIs: `https://yourdomain.com/api/auth/google/callback`
5. Copy Client ID + Secret → paste into `.env`
6. In Admin → Users: make sure each admin's email matches their Google account email

---

## Database Backups

The database is a single SQLite file: `data/club.db`

```bash
# Manual backup
cp data/club.db data/club.db.backup-$(date +%Y%m%d)

# Restore
cp data/club.db.backup-YYYYMMDD data/club.db
pm2 restart lions-lacrosse
```

Add to crontab for daily auto-backups:
```bash
0 2 * * * cp /home/user/subiaco-lions-lacrosse/data/club.db /home/user/backups/club.db.$(date +\%Y\%m\%d)
```

---

## PM2 Quick Reference

```bash
pm2 status                    # Check app is running
pm2 logs lions-lacrosse       # View live logs
pm2 restart lions-lacrosse    # Manual restart
pm2 stop lions-lacrosse       # Stop app
```
