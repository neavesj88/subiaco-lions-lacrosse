import { type Request, type Response, type NextFunction } from "express";
import type { User } from "@shared/schema";

type Role = User["role"];

const roleHierarchy: Record<Role, number> = {
  content_manager: 1,
  juniors_coordinator: 2,
  club_admin: 3,
  super_admin: 4,
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

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

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
    userName: string;
  }
}
