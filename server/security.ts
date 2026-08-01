// =============================================================================
// LOGIN SECURITY — server/security.ts
// =============================================================================
// Brute-force protection for the admin login, mirroring the approach used on
// neaves.au: progressive IP-based lockout with escalating block durations.
//
// How it works:
//   - Each failed login is counted per client IP (in memory).
//   - After 3 fails the IP is blocked 5 min; 6 fails -> 15 min; 9 -> 30 min;
//     and so on up to 24 hours. A successful login clears the counter.
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

interface LoginAttempt {
  count: number;
  firstAttempt: Date;
  lastAttempt: Date;
  blockedUntil?: Date;
}

// IP -> attempt record
const loginAttempts = new Map<string, LoginAttempt>();

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
// Order matters: Cloudflare's header is most trustworthy in your setup, then
// the standard proxy headers, then the raw socket.
export function getClientIP(req: Request): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;

  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) {
    // "client, proxy1, proxy2" — the first entry is the original client
    return xff.split(",")[0].trim();
  }

  const xreal = req.headers["x-real-ip"];
  if (typeof xreal === "string" && xreal) return xreal;

  return req.ip || req.socket?.remoteAddress || "0.0.0.0";
}

// ── Is this IP currently blocked? ───────────────────────────────────────────
export function isBlocked(ip: string): { blocked: boolean; timeRemaining?: number } {
  const attempt = loginAttempts.get(ip);
  if (!attempt?.blockedUntil) return { blocked: false };

  const now = Date.now();
  if (now < attempt.blockedUntil.getTime()) {
    return { blocked: true, timeRemaining: attempt.blockedUntil.getTime() - now };
  }

  // Block expired — reset the counter so they get a clean slate
  attempt.count = 0;
  attempt.blockedUntil = undefined;
  return { blocked: false };
}

// ── Record a failed attempt, escalating the block if needed ─────────────────
export function recordFailedAttempt(ip: string): { blockedUntil?: Date; attempts: number } {
  const now = new Date();
  let attempt = loginAttempts.get(ip);

  if (!attempt) {
    attempt = { count: 1, firstAttempt: now, lastAttempt: now };
    loginAttempts.set(ip, attempt);
  } else {
    attempt.count++;
    attempt.lastAttempt = now;
  }

  const tier = BLOCK_THRESHOLDS.findIndex((t) => attempt!.count >= t);
  if (tier >= 0) {
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
  return out.sort((x, y) => new Date(y.lastAttempt).getTime() - new Date(x.lastAttempt).getTime());
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
 */
export function allowFormSubmission(ip: string, maxPerHour: number): boolean {
  const now = Date.now();
  const rec = formSubmissions.get(ip);

  if (!rec || now - rec.windowStart > FORM_WINDOW_MS) {
    formSubmissions.set(ip, { count: 1, windowStart: now });
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
}, FORM_WINDOW_MS).unref();
