# Running the website on a PC in the clubhouse

This is the complete guide for running the club website on an ordinary Linux PC
sitting in the clubhouse — including how to make it reachable from the internet
when the club's internet connection **does not have a fixed IP address**, which
is the normal situation on a home or small-business connection.

Everything here has been kept to as few steps as possible. If you can copy and
paste a command, you can do this.

**Contents**

1. [What you need](#1-what-you-need)
2. [Install it](#2-install-it)
3. [Put it on the internet (no fixed IP needed)](#3-put-it-on-the-internet-no-fixed-ip-needed)
4. [First login](#4-first-login)
5. [Day-to-day running](#5-day-to-day-running)
6. [Backups](#6-backups)
7. [Restoring after something goes wrong](#7-restoring-after-something-goes-wrong)
8. [Keeping it up to date](#8-keeping-it-up-to-date)
9. [When something breaks](#9-when-something-breaks)

---

## 1. What you need

| | |
|---|---|
| **A PC** | Anything from the last ~10 years. 4 GB of memory is plenty. It does not need to be fast — this website is very light. |
| **Ubuntu or Debian Linux** | Ubuntu Server 22.04 or 24.04 is the easiest choice. A desktop install works too. |
| **The PC left switched on** | It's the club's web server, so it needs to stay on and connected. Plug it into the router with a network cable if you can — Wi-Fi is fine but less reliable. |
| **A free Cloudflare account** | Used to put the site on the internet safely. Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up). |
| **A domain name** | e.g. `yourclub.org.au`. About $20/year. You can try the site out without one first. |

**You do not need:** a fixed IP address, port forwarding, a static DNS service,
or any changes to the club's router. Section 3 explains why.

---

## 2. Install it

Open a terminal on the club PC and run these four lines:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/neavesj88/subiaco-lions-lacrosse.git club-website
cd club-website
./scripts/install-clubhouse.sh
```

The installer does the lot: installs Node.js, builds the site, creates the first
admin account, sets the site to start automatically whenever the PC is switched
on, schedules a nightly backup, and turns on automatic security updates.

It prints an **admin web address** at the end, something like
`/manage-a3f9c2`. **Write this down.** It is deliberately random so that
password-guessing bots trawling the internet for `/admin` never find your login
page at all.

When it finishes, check the site is up:

```bash
curl -I http://localhost:5000
```

`HTTP/1.1 200 OK` means it's running.

> Running the install script again later is safe — it updates what's there
> rather than making a mess.

---

## 3. Put it on the internet (no fixed IP needed)

### Why the usual approach doesn't work

The normal way to host a website is to point your domain name at your IP
address, and open a port on the router. In a clubhouse that fails for two
reasons:

- **The IP address changes.** Most connections get a new address every so often,
  so the domain would keep pointing at nothing.
- **Many connections can't accept incoming traffic at all.** Mobile broadband
  and a lot of NBN plans put you behind the provider's own network (called
  CGNAT), so port forwarding simply has no effect no matter how you configure
  the router.

### What we do instead

A **Cloudflare Tunnel** turns the problem around. Instead of the internet
connecting *in* to the clubhouse, the club PC makes an outgoing connection *out*
to Cloudflare and holds it open. Visitors go to Cloudflare, and Cloudflare
passes them down that existing connection.

That means:

- The club's IP address can change as often as it likes — nothing breaks.
- CGNAT doesn't matter, because nothing needs to connect inward.
- **No ports are opened on the club's router at all**, so the clubhouse network
  is not exposed. This is genuinely safer than port forwarding, not just easier.
- HTTPS (the padlock) is handled for you, free, and renews itself.

### Try it first, without a domain

```bash
./scripts/tunnel-quick.sh
```

This prints a temporary `https://something-random.trycloudflare.com` address
that works immediately. Open it on your phone, off the club Wi-Fi, to prove the
site is genuinely reachable from the outside world. The address disappears when
you stop the script — it's for testing only.

### The permanent setup

Once the club has a domain name pointed at Cloudflare:

```bash
./scripts/tunnel-setup.sh yourclub.org.au
```

It opens a browser window once so you can authorise the club's Cloudflare
account, then configures everything and sets the tunnel to start automatically
on boot. After that the site stays online through reboots, power cuts and IP
address changes without anyone touching it.

Check it any time with:

```bash
systemctl status cloudflared
```

---

## 4. First login

1. Go to your site's address followed by the admin path the installer printed,
   plus `/login` — for example `https://yourclub.org.au/manage-a3f9c2/login`
2. Sign in with **`admin`** and the password shown at the end of the install
   (default `changeme123!`)
3. **Change that password immediately** — Admin → My Account. A red warning
   banner sits across the admin panel until you do.
4. Work through the setup wizard: club name, sport, ground, contact details and
   colours. It only appears on a brand new site.

Then add a real account for each committee member (Admin → Admins) and give
each the least access they need:

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including managing other admins |
| **Club Admin** | All content and settings, but not admins or security |
| **Juniors Coordinator** | News, photos and the juniors page |
| **Content Manager** | News and photos |
| **Social Media Manager** | News and photos only — nothing else is even visible |

Give the "Social Media Manager" role to volunteers who only post news. It's the
most limited role, so it's the safest one to hand out.

---

## 5. Day-to-day running

The website looks after itself. These are the only commands worth knowing:

```bash
sudo systemctl status club-website
```
Is it running? Look for `active (running)` in green.

```bash
sudo systemctl restart club-website
```
Restart it. Safe at any time; takes a couple of seconds.

```bash
sudo journalctl -u club-website -n 50
```
Show the last 50 lines of what it's been doing. This is where errors appear.

**After a power cut you do not need to do anything.** The site starts itself
when the PC boots, and restarts itself if it ever crashes.

---

## 6. Backups

A nightly backup at 2am is set up for you. It saves **both** things that matter:

- the database — every page, post, event, committee member and setting
- the uploaded photos — which live outside the database

Backups are kept in `data/backups/`, newest 30 retained.

```bash
./scripts/backup.sh          # back up right now
ls -lt data/backups/         # see what backups exist
```

### Do this bit — copy backups off the PC

A backup sitting on the same PC as the website does not protect you from the
thing most likely to happen: **that PC's hard drive failing.** It also won't
help if the clubhouse is broken into or floods.

Plug in a USB stick and point the nightly backup at it:

```bash
crontab -e
```

Change the backup line to include a destination:

```
0 2 * * * BACKUP_DIR=/media/usb-backup /home/club/club-website/scripts/backup.sh >> /home/club/club-website/data/backup.log 2>&1
```

Better still, have someone copy a backup folder to a laptop or cloud drive at
the start of each season. It takes two minutes and it is the difference between
an annoyance and losing the club's website.

### Check the backups are actually working

Once a season, look at the log and confirm recent dates:

```bash
tail -20 data/backup.log
```

> **Why not just copy the database file yourself?** Because the site keeps
> recent changes in a second file alongside it, so a plain copy can quietly
> miss the newest content and still look perfectly fine — you'd only discover
> it the day you needed it. `backup.sh` asks the database to produce the copy
> properly, which is always complete.

---

## 7. Restoring after something goes wrong

Someone deleted a page, or the site is misbehaving and you want yesterday back:

```bash
./scripts/restore.sh
```

It lists the available backups, asks which one you want, and asks you to type
`YES` to confirm. It **saves the current state as its own backup first**, so a
restore can itself be undone if you pick the wrong one.

It restores the photos as well as the database, stops and starts the site for
you, and cleans up the database's working files so you get exactly the backup
you asked for.

---

## 8. Keeping it up to date

**The PC's own security updates** install themselves — that was set up during
install, and it's the update that matters most.

**The website itself**, when there are changes to pull down:

```bash
cd ~/club-website
./scripts/backup.sh
git pull
npm ci --omit=optional
node scripts/migrate.mjs
npm run build
sudo systemctl restart club-website
```

Always take the backup first. If an update ever goes wrong, `./scripts/restore.sh`
puts you back.

**Checking for security problems in the site's building blocks:**

```bash
npm audit --omit=optional --omit=dev
```

`found 0 vulnerabilities` is what you want. If it reports something, that's a
job for whoever maintains the site rather than something to fix blind — the
suggested `npm audit fix --force` can break a working site.

---

## 9. When something breaks

**The website won't load at all**

```bash
sudo systemctl status club-website     # is it running?
sudo journalctl -u club-website -n 50  # what went wrong?
sudo systemctl restart club-website    # try turning it off and on again
```

**It works inside the clubhouse but not from outside**

That's the tunnel, not the website:

```bash
systemctl status cloudflared
sudo systemctl restart cloudflared
```

**Nobody can log in / the admin password is lost**

From the club PC:

```bash
node scripts/reset-admin.mjs
```

This sets a fresh password for the admin account. It has to be run on the PC
itself, which is what stops it being a way in for anyone else.

**Logging in does nothing — it just returns to the login page**

Check `.env` still has a `SESSION_SECRET` line with a long random value. If that
line is empty, admins get logged out constantly. Fix it with:

```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
sudo systemctl restart club-website
```

**The site is slow or the PC is out of disk space**

```bash
df -h                        # how full is the disk?
du -sh public/uploads        # photos are usually the culprit
```

Delete unused photos in Admin → Photos. Old backups prune themselves.

---

## Where else to look

- **`HANDOVER.md`** — for committee members: how to edit the site, no technical
  knowledge assumed
- **`SETUP_INTEGRATIONS.md`** — optional extras: Google sign-in for admins, and
  email notifications for contact-form messages
- **`SETUP_HOSTING.md`** — the alternative setup, for hosting on a rented server
  with a fixed IP instead of a clubhouse PC
