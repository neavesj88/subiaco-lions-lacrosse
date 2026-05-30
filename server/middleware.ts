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
import type { User } from "@shared/schema";

type Role = User["role"];

// Numeric level for each role — higher number = more permissions
const roleHierarchy: Record<Role, number> = {
  content_manager: 1,
  juniors_coordinator: 2,
  club_admin: 3,
  super_admin: 4,
};

// ── requireAuth ──────────────────────────────────────────────────────────────
// Blocks the request if the user isn't logged in.
// Returns 401 so the frontend knows to redirect to /admin/login.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// ── requireRole ──────────────────────────────────────────────────────────────
// Blocks the request if the user's role level is below the minimum required.
// Pass the MINIMUM role needed — anyone at that level or above is allowed.
//
// Example: requireRole("club_admin") allows club_admin AND super_admin
//          requireRole("super_admin") allows ONLY super_admin
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.userRole) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const userLevel = roleHierarchy[req.session.userRole as Role] ?? 0;
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
