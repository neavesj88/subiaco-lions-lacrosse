// =============================================================================
// AUTH MIDDLEWARE — server/middleware.ts
// =============================================================================
// What this file does:
//   Provides two Express middleware functions used to protect admin API routes:
//
//   requireAuth  — checks the user is logged in (session exists)
//   requireRole  — checks the user has a high enough role for the action
//
// Role hierarchy (lowest → highest):
//   content_manager      Can post/edit announcements only
//   juniors_coordinator  Can also edit the Juniors page content
//   club_admin           Can also manage events and view sign-up enquiries
//   super_admin          Full access — users, settings, everything
//
// How it works:
//   When someone logs in (username/password or Google), their user ID and role
//   are stored in their session (a cookie). Each protected route checks this.
//   If the check fails → 401 (not logged in) or 403 (wrong role).
//
// Usage in routes.ts:
//   app.get("/api/users", requireAuth, requireRole("super_admin"), handler)
//   app.post("/api/events", requireAuth, requireRole("club_admin"), handler)
// =============================================================================

import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type User } from "@shared/schema";

type Role = User["role"];

// Numeric level for each role — higher number = more permissions
const roleHierarchy: Record<Role, number> = {
  content_manager: 1,
  juniors_coordinator: 2,
  club_admin: 3,
  super_admin: 4,
};

// ── loadCurrentUser ──────────────────────────────────────────────────────────
// Re-reads the logged-in user FROM THE DATABASE on every protected request.
//
// Why not just trust the session?
//   The session cookie is a snapshot from login time. If we trusted it, then
//   locking someone out, demoting them, or deleting their account would only
//   take effect the NEXT time they logged in — meanwhile their existing browser
//   session would keep working with the old permissions. For a club handing
//   over admin access that's exactly backwards: "remove their access" must
//   mean immediately.
//
//   Re-checking costs one indexed SQLite lookup per admin request, which is
//   nothing at this site's traffic, and it also keeps the session's cached role
//   in sync so later checks in the same request see the truth.
// ---------------------------------------------------------------------------
async function loadCurrentUser(req: Request) {
  if (!req.session.userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);

  // Account deleted or locked out (is_active = false) → session is dead.
  if (!user || !user.isActive) return null;

  // Keep the session's cached role current after a promotion/demotion.
  req.session.userRole = user.role;
  return user;
}

// ── requireAuth ──────────────────────────────────────────────────────────────
// Blocks the request unless the user is logged in AND their account is still
// active. Returns 401 so the frontend redirects to the login page.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await loadCurrentUser(req);
  if (!user) {
    // Destroy the now-invalid session so the browser stops sending it.
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// ── requireRole ──────────────────────────────────────────────────────────────
// Blocks the request if the user's role level is below the minimum required.
// Pass the MINIMUM role needed — anyone at that level or above is allowed.
// The role is read live from the database, so demotions apply immediately.
//
// Example: requireRole("club_admin") allows club_admin AND super_admin
//          requireRole("super_admin") allows ONLY super_admin
export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadCurrentUser(req);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }
    const userLevel = roleHierarchy[user.role] ?? 0;
    const minRequired = Math.min(...roles.map((r) => roleHierarchy[r]));
    if (userLevel < minRequired) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

// Extend express-session's built-in types to include our custom fields
declare module "express-session" {
  interface SessionData {
    userId: number;     // The logged-in user's database ID
    userRole: string;   // Their role string (e.g. "super_admin")
    userName: string;   // Their display name (used in the admin header)
  }
}
