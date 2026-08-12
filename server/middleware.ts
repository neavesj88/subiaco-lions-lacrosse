// =============================================================================
// AUTH MIDDLEWARE — server/middleware.ts
// =============================================================================
// What this file does:
//   Provides two Express middleware functions used to protect admin API routes:
//
//   requireAuth        — is this person logged in, and still allowed in?
//   requirePermission  — is this person allowed to do THIS particular thing?
//
// There is deliberately no "role level" check. Roles are not a ladder here: a
// Social Media Manager is not a junior Club Admin, they are someone allowed to
// touch news and photos and nothing else. Asking "may they do X?" expresses
// that; asking "are they senior enough?" cannot. Who may do what lives in
// shared/roles.ts.
//
// How it works:
//   When someone logs in (username/password or Google), their user ID and role
//   are stored in their session (a cookie). Each protected route checks this.
//   If the check fails → 401 (not logged in) or 403 (wrong role).
//
// Usage in routes.ts:
//   app.get("/api/users", requireAuth, requirePermission("users"), handler)
//   app.post("/api/events", requireAuth, requirePermission("events"), handler)
// =============================================================================

import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";
import { roleHas, type Permission } from "@shared/roles";

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

// ── requirePermission ────────────────────────────────────────────────────────
// The preferred guard. Instead of "must be club_admin or above", it asks
// "is this person allowed to touch events?" — which is what we actually mean.
//
// Crucially this works for RESTRICTED roles: a Social Media Manager can be
// allowed to post news while being refused everything else, which a
// level-based ladder cannot express.
//
// Permissions per role live in shared/roles.ts, shared with the admin UI so
// the tabs someone sees always match what the server will actually allow.
export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadCurrentUser(req);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roleHas(user.role, permission)) {
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
