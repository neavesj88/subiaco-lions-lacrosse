# Committee handover checklist — blank template

For the AGM, or whenever the person who looks after the website changes.

Websites get orphaned when the one volunteer who understood them steps down.
Working through this once a year takes twenty minutes and prevents a club
locking itself out of its own site — which is far harder to recover from than
it sounds.

**How to use it:** the outgoing and incoming people go through it together, in
front of the site, ticking as they go.

---

## Who's involved

| | Outgoing | Incoming |
|---|---|---|
| Name | `____________________` | `____________________` |
| Role | `____________________` | `____________________` |
| Email | `____________________` | `____________________` |
| Date handed over | `____________________` | |

---

## 1. Website access

- [ ] Incoming person has their **own** admin account — not the outgoing
      person's login shared with them
- [ ] Their account is set to **Super Admin** (Admin → Admin Users)
- [ ] They have logged in successfully and changed their own password
- [ ] They have written down the **admin web address** — the site's login page
      is at a deliberately hard-to-guess address and cannot be found without it

      Admin address: `____________________________________`

- [ ] **At least two** people still have Super Admin, so one person leaving
      never locks the club out
- [ ] Anyone who has left the club has had their account **locked**
      (Admin → Admin Users → lock), not just been asked to stop using it

## 2. Where the website actually lives

- [ ] Incoming person knows **which computer** runs the site and where it is

      Location: `____________________________________`

- [ ] They can get into that computer (login, or knows who can)
- [ ] They know it must stay switched on and connected

## 3. Domain name and internet

- [ ] They know **who the domain name is registered with** and when it renews

      Registrar: `______________`  Renews: `______________`

- [ ] The domain is paid from a **club** account or card, not a volunteer's
      personal one
- [ ] The **Cloudflare account** login has been handed over, and is a club
      address rather than someone's personal email

> A domain quietly expiring on a former treasurer's personal credit card is the
> single most common way a club website disappears.

## 4. Email

- [ ] They know which email address the site sends from, and have its login
- [ ] They know where enquiries land, and are checking that inbox
- [ ] Someone has actually received a test message since the handover

## 5. The shop — skip if you don't sell anything

- [ ] **Stripe account login handed over.** Whoever holds this controls the
      club's money, so it should sit with a committee office (treasurer or
      president), not with whoever happens to run the website
- [ ] Stripe's bank account details are the **club's**, and still correct
- [ ] Incoming person knows refunds happen in Stripe, not on the website
- [ ] They know where the emergency stop is: **Admin → Security → Emergency
      stops** switches off email and card payments immediately

## 6. Backups

- [ ] They know backups run nightly by themselves
- [ ] They know **where the off-machine copy goes**, and have checked one exists

      Backup location: `____________________________________`

- [ ] They have watched a backup being taken: `./scripts/backup.sh`
- [ ] They know a backup can be put back with `./scripts/restore.sh`

> A backup sitting only on the club computer does not protect you from the most
> likely thing to happen: that computer's hard drive failing.

## 7. Knowing what to do

- [ ] They have found the **Help & Guide** tab inside the admin panel
- [ ] They know where the setup documents are (`README.md` and the guides
      beside it)
- [ ] They have made one real edit — a news post or a page change — while the
      outgoing person watched

## 8. If it all goes wrong

- [ ] They know the emergency admin reset exists: `node scripts/reset-admin.mjs`
      run on the club computer, for when nobody can log in
- [ ] There is a **named person or business** to call for technical help

      Contact: `____________________________________`

- [ ] That contact knows they're listed

---

## Signed off

| | |
|---|---|
| Outgoing | `______________________  Date: ____________` |
| Incoming | `______________________  Date: ____________` |

---

## Notes for the committee — delete before use if you like

Keep the completed checklist with your AGM minutes. It is the only record of
where the club's digital assets live, and the year it matters is the year
somebody leaves unexpectedly.

The three things that most often go wrong, in order:

1. **The domain expires** because it was on a personal card nobody replaced.
2. **Nobody can log in** because the only Super Admin left the club and the
   admin address was never written down.
3. **The backup was never checked** and turns out to be empty or years old.

Each of those is prevented by one tick above.
