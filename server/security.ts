// =============================================================================
// LOGIN SECURITY — server/security.ts
// =============================================================================
// Brute-force protection for the admin login, mirroring the approach used on
// neaves.au: progressive IP-based lockout with escalating block durations.
//
// How it works:
//   - Each failed login is counted per client IP (in memory).
//   - After 3 fails the IP is blocked 5 min; 6 fails -> 15 min; 9 -> 30 min;
//     and so on up to 24 hours. A successful login clears the counter, and so
//     does a whole day with no failed attempts.
//   - This makes automated password-guessing impractical without permanently
//     locking out a legitimate admin who just fat-fingered their password.
//
// Why in-memory (a Map) rather than a library or the database?
//   - It's exactly what neaves.au does, zero dependencies, and plenty for a
//     club site. The only downside is the counters reset if the server
//     restarts — which is fine (a restart isn't something an attacker controls,
//     and it only ever HELPS a legitimate locked-out admin).
// =============================================================================

import type { Request } from "express";
import { isIP } from "net";

interface LoginAttempt {
  count: number;
  firstAttempt: Date;
  lastAttempt: Date;
  blockedUntil?: Date;
}

// IP -> attempt record
const loginAttempts = new Map<string, LoginAttempt>();

// A ceiling on how many addresses are remembered at once. Without one, a flood
// of attempts from many addresses would grow memory without limit. When full,
// the address heard from least recently is forgotten first.
const MAX_TRACKED = 10_000;

/** Map.set, but forgetting the oldest entry once the map is full. */
function remember<V>(map: Map<string, V>, key: string, value: V): void {
  map.delete(key);   // re-inserting moves it to the "newest" end
  if (map.size >= MAX_TRACKED) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

// Block duration for each escalation tier (milliseconds)
const BLOCK_TIMES = [
  5 * 60 * 1000,      // 5 minutes  (after 3 fails)
  15 * 60 * 1000,     // 15 minutes (after 6)
  30 * 60 * 1000,     // 30 minutes (after 9)
  60 * 60 * 1000,     // 1 hour     (after 12)
  2 * 60 * 60 * 1000, // 2 hours    (after 15)
  6 * 60 * 60 * 1000, // 6 hours    (after 18)
  24 * 60 * 60 * 1000,// 24 hours   (after 21+)
];
const BLOCK_THRESHOLDS = [3, 6, 9, 12, 15, 18, 21];

// ── Real client IP (correct behind nginx + Cloudflare) ──────────────────────
// Every setup this site supports puts its proxy on the same machine:
// cloudflared on the clubhouse PC, nginx on a rented server. So a header
// claiming to name the visitor is believed ONLY when the connection itself
// came from that proxy. Anyone connecting directly — including someone on the
// clubhouse Wi-Fi — gets their real address, so they cannot dodge the lockout
// by inventing a new CF-Connecting-IP on every request.
//
// "Which connections are our proxy" is the TRUST_PROXY setting, used for
// Express's own "trust proxy" too (routes.ts), so req.ip and this function
// always agree. The default is this machine only; the Docker image adds its
// private network, because there cloudflared runs in a separate container.
export const TRUST_PROXY = (process.env.TRUST_PROXY ?? "").trim() || "loopback";

/** "::ffff:127.0.0.1" -> "127.0.0.1"; anything else unchanged. */
function plainAddress(addr: string): string {
  return addr.startsWith("::ffff:") && isIP(addr.slice(7)) === 4 ? addr.slice(7) : addr;
}

/** Did this connection come from our own proxy (see TRUST_PROXY)? */
function fromOurProxy(req: Request, peer: string): boolean {
  const trust = req.app?.get("trust proxy fn");
  return typeof trust === "function" ? trust(peer, 0) === true : false;
}

export function getClientIP(req: Request): string {
  const peer = req.socket?.remoteAddress ?? "";
  if (fromOurProxy(req, peer)) {
    const cf = req.headers["cf-connecting-ip"];
    // isIP also stops a junk value being used as a (huge) map key.
    if (typeof cf === "string" && isIP(cf.trim())) return plainAddress(cf.trim());
    if (req.ip && isIP(req.ip)) return plainAddress(req.ip);
  }
  return plainAddress(peer) || "0.0.0.0";
}

// A day without a failed attempt wipes an address's record.
const FORGET_AFTER_MS = 24 * 60 * 60 * 1000;

// ── Is this IP currently blocked? ───────────────────────────────────────────
export function isBlocked(ip: string): { blocked: boolean; timeRemaining?: number } {
  const attempt = loginAttempts.get(ip);
  if (!attempt?.blockedUntil) return { blocked: false };

  const now = Date.now();
  if (now < attempt.blockedUntil.getTime()) {
    return { blocked: true, timeRemaining: attempt.blockedUntil.getTime() - now };
  }

  // Block expired. The count stays, so the next failures escalate to the
  // longer blocks; it is forgotten after a quiet day (recordFailedAttempt).
  attempt.blockedUntil = undefined;
  return { blocked: false };
}

// ── Count an attempt, escalating the block if needed ────────────────────────
// The login route calls this BEFORE checking the password, not after. Checking
// a password takes a fifth of a second, and if attempts were only counted once
// that finished, a burst of a hundred guesses sent at the same instant would
// all get past the "are you blocked?" check before the first one was counted.
// Counting first means the fourth guess is refused however fast they arrive.
// A successful login then wipes the count (recordSuccessfulLogin).
export function recordFailedAttempt(ip: string): { blockedUntil?: Date; attempts: number } {
  const now = new Date();
  let attempt = loginAttempts.get(ip);

  if (!attempt || now.getTime() - attempt.lastAttempt.getTime() > FORGET_AFTER_MS) {
    attempt = { count: 1, firstAttempt: now, lastAttempt: now };
  } else {
    attempt.count++;
    attempt.lastAttempt = now;
  }
  remember(loginAttempts, ip, attempt);

  // Block on reaching each threshold (3, 6, 9 … fails), for longer each time;
  // past the last one, every further failure blocks for the longest time.
  // In between, the count is kept but doesn't block, so after a lock-out
  // expires a person gets three more tries, not one.
  const tier = BLOCK_THRESHOLDS.filter((t) => attempt!.count >= t).length - 1;
  const last = BLOCK_THRESHOLDS[BLOCK_THRESHOLDS.length - 1];
  if (tier >= 0 && (BLOCK_THRESHOLDS.includes(attempt.count) || attempt.count > last)) {
    const blockMs = BLOCK_TIMES[Math.min(tier, BLOCK_TIMES.length - 1)];
    attempt.blockedUntil = new Date(now.getTime() + blockMs);
  }

  return { blockedUntil: attempt.blockedUntil, attempts: attempt.count };
}

// ── Clear an IP's record after a successful login ───────────────────────────
export function recordSuccessfulLogin(ip: string): void {
  loginAttempts.delete(ip);
}

// ── Human-readable duration, e.g. "5 minutes", "1 hour" ─────────────────────
export function formatTime(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.ceil(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// ── For the admin "Security" view: list IPs with failed attempts ────────────
export function getSuspiciousIPs(): Array<{
  ip: string; attempts: number; lastAttempt: string; status: string;
}> {
  const out = [];
  for (const [ip, a] of loginAttempts.entries()) {
    if (a.count >= 1) {
      out.push({
        ip,
        attempts: a.count,
        lastAttempt: a.lastAttempt.toISOString(),
        status: a.blockedUntil && Date.now() < a.blockedUntil.getTime() ? "Blocked" : "Watching",
      });
    }
  }
  // The newest 200 is plenty to act on; listing thousands would only make the
  // Security screen slow to load during exactly the attack it is reporting.
  return out
    .sort((x, y) => new Date(y.lastAttempt).getTime() - new Date(x.lastAttempt).getTime())
    .slice(0, 200);
}

// ── Manually clear a block (admin "unblock" button) ─────────────────────────
export function unblockIP(ip: string): boolean {
  return loginAttempts.delete(ip);
}

// ── Public form throttling ──────────────────────────────────────────────────
// The contact form, sign-up form and newsletter box are open to the whole
// internet with no login. Without a limit, one bored person or a spam bot can
// submit thousands of times — which floods the club's inbox, fills the
// database, and (because each sign-up sends two emails) can get the club's
// email account flagged as a spam sender.
//
// This is a deliberately simple fixed-window counter per IP, in memory, in the
// same spirit as the login lockout above: no dependency, nothing to configure,
// and the worst case if the server restarts is that someone gets a fresh
// allowance. Genuine humans never hit these limits — a person submits the
// contact form once, not five times an hour.
const formSubmissions = new Map<string, { count: number; windowStart: number }>();
const FORM_WINDOW_MS = 60 * 60 * 1000; // one hour

/**
 * Returns true if this IP is allowed to submit, false if it has hit the limit.
 * Call once per submission — it counts the attempt as it checks.
 *
 * Each form has its own allowance ("form" names it), so a family who sent a
 * contact message isn't then refused when they try to sign up. Limits are set
 * with registration day in mind: behind the clubhouse Wi-Fi every family
 * shares ONE internet address, so the sign-up allowance has to cover a queue
 * of parents at the clubhouse, not one person at home.
 */
export function allowFormSubmission(ip: string, maxPerHour: number, form: string): boolean {
  const now = Date.now();
  const key = `${form}:${ip}`;
  const rec = formSubmissions.get(key);

  if (!rec || now - rec.windowStart > FORM_WINDOW_MS) {
    remember(formSubmissions, key, { count: 1, windowStart: now });
    return true;
  }
  rec.count += 1;
  return rec.count <= maxPerHour;
}

// Housekeeping: drop stale entries so the map can't grow forever on a
// long-running server. Runs hourly and is cheap (a few hundred entries at most).
// unref() lets the process exit normally despite this timer being scheduled.
setInterval(() => {
  const cutoff = Date.now() - FORM_WINDOW_MS;
  for (const [ip, rec] of formSubmissions) {
    if (rec.windowStart < cutoff) formSubmissions.delete(ip);
  }
  const forget = Date.now() - FORGET_AFTER_MS;
  for (const [ip, a] of loginAttempts) {
    const blocked = a.blockedUntil && a.blockedUntil.getTime() > Date.now();
    if (!blocked && a.lastAttempt.getTime() < forget) loginAttempts.delete(ip);
  }
}, FORM_WINDOW_MS).unref();
