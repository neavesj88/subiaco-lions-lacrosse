import { type Express, type Request, type Response } from "express";
import { createServer } from "http";
import session from "express-session";
import ConnectSqlite3 from "connect-sqlite3";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import { eq, desc, gte, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  events,
  registrations,
  announcements,
  juniorsContent,
  siteSettings,
  contactMessages,
  insertEventSchema,
  insertRegistrationSchema,
  insertAnnouncementSchema,
  loginSchema,
  createUserSchema,
} from "@shared/schema";
import { requireAuth, requireRole } from "./middleware";

const SQLiteStore = ConnectSqlite3(session);

// ── Passport Google OAuth ───────────────────────────────────────────────────
function setupPassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:5000/api/auth/google/callback";

  if (clientID && clientSecret) {
    passport.use(
      new GoogleStrategy(
        { clientID, clientSecret, callbackURL },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error("No email from Google"), undefined);

            // Find matching admin user by Google ID first, then by email
            let [user] = await db.select().from(users)
              .where(eq(users.googleId, profile.id)).limit(1);

            if (!user) {
              [user] = await db.select().from(users)
                .where(eq(users.email, email)).limit(1);
              // Link google ID to this user
              if (user) {
                await db.update(users).set({ googleId: profile.id }).where(eq(users.id, user.id));
              }
            }

            if (!user || !user.isActive) {
              return done(null, false);
            }
            return done(null, user);
          } catch (err) {
            return done(err as Error, undefined);
          }
        }
      )
    );

    passport.serializeUser((user: any, done) => done(null, user.id));
    passport.deserializeUser(async (id: number, done) => {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        done(null, user ?? false);
      } catch (err) {
        done(err);
      }
    });
  }
}

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Session
  app.use(
    session({
      store: new (SQLiteStore as any)({ db: "sessions.db", dir: "./data" }),
      secret: process.env.SESSION_SECRET ?? "lions-lacrosse-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  setupPassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // ── Auth — username/password ────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid credentials" });

    const { username, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || !user.isActive) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.passwordHash) return res.status(401).json({ message: "This account uses Google Sign-In" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.name;

    res.json({ id: user.id, name: user.name, role: user.role, email: user.email });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => req.session.destroy(() => res.json({ ok: true })));
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const userId = req.session.userId ?? (req.user as any)?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ id: user.id, name: user.name, role: user.role, email: user.email, username: user.username });
  });

  // ── Google OAuth ────────────────────────────────────────────────────
  app.get("/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/admin/login?error=google" }),
    async (req: Request, res: Response) => {
      const user = req.user as any;
      if (user) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = user.name;
      }
      res.redirect("/admin");
    }
  );

  app.get("/api/auth/google/available", (_req: Request, res: Response) => {
    res.json({ available: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
  });

  // ── Events ──────────────────────────────────────────────────────────
  app.get("/api/events", async (_req: Request, res: Response) => {
    const now = new Date().toISOString().split("T")[0];
    const rows = await db.select().from(events)
      .where(and(eq(events.isPublished, true), gte(events.startDate, now)))
      .orderBy(events.startDate).limit(50);
    res.json(rows);
  });

  app.get("/api/events/all", requireAuth, requireRole("club_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(events).orderBy(desc(events.startDate)).limit(200);
    res.json(rows);
  });

  app.post("/api/events", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const parsed = insertEventSchema.safeParse({ ...req.body, createdBy: req.session.userId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(events).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/events/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertEventSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(events).set(parsed.data).where(eq(events.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Event not found" });
    res.json(row);
  });

  app.delete("/api/events/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    await db.delete(events).where(eq(events.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Announcements ───────────────────────────────────────────────────
  app.get("/api/announcements", async (_req: Request, res: Response) => {
    const rows = await db.select().from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.createdAt)).limit(10);
    res.json(rows);
  });

  app.get("/api/announcements/all", requireAuth, requireRole("content_manager"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
    res.json(rows);
  });

  app.post("/api/announcements", requireAuth, requireRole("content_manager"), async (req: Request, res: Response) => {
    const parsed = insertAnnouncementSchema.safeParse({ ...req.body, createdBy: req.session.userId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.insert(announcements).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/announcements/:id", requireAuth, requireRole("content_manager"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertAnnouncementSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(announcements).set(parsed.data).where(eq(announcements.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/announcements/:id", requireAuth, requireRole("content_manager"), async (req: Request, res: Response) => {
    await db.delete(announcements).where(eq(announcements.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Registrations ───────────────────────────────────────────────────
  app.post("/api/registrations", async (req: Request, res: Response) => {
    const parsed = insertRegistrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(registrations).values(parsed.data).returning();
    res.status(201).json({ ok: true, id: row.id });
  });

  app.get("/api/registrations", requireAuth, requireRole("club_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(registrations).orderBy(desc(registrations.createdAt)).limit(500);
    res.json(rows);
  });

  app.put("/api/registrations/:id/status", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!["new", "contacted", "registered", "declined"].includes(status))
      return res.status(400).json({ message: "Invalid status" });
    const [row] = await db.update(registrations).set({ status }).where(eq(registrations.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  // ── Contact messages ────────────────────────────────────────────────
  app.post("/api/contact", async (req: Request, res: Response) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message)
      return res.status(400).json({ message: "All fields are required" });
    const [row] = await db.insert(contactMessages).values({ name, email, subject, message }).returning();
    res.status(201).json({ ok: true, id: row.id });
  });

  app.get("/api/contact", requireAuth, requireRole("club_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(200);
    res.json(rows);
  });

  app.put("/api/contact/:id/read", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [row] = await db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, id)).returning();
    res.json(row);
  });

  // ── Juniors Content ─────────────────────────────────────────────────
  app.get("/api/juniors-content", async (_req: Request, res: Response) => {
    const rows = await db.select().from(juniorsContent);
    res.json(rows);
  });

  app.put("/api/juniors-content/:section", requireAuth, requireRole("juniors_coordinator"), async (req: Request, res: Response) => {
    const { section } = req.params;
    const { title, content } = req.body;
    const existing = await db.select().from(juniorsContent).where(eq(juniorsContent.section, section)).limit(1);
    if (existing.length > 0) {
      const [row] = await db.update(juniorsContent)
        .set({ title, content, updatedBy: req.session.userId, updatedAt: new Date().toISOString() })
        .where(eq(juniorsContent.section, section)).returning();
      return res.json(row);
    }
    const [row] = await db.insert(juniorsContent).values({ section, title, content, updatedBy: req.session.userId }).returning();
    res.status(201).json(row);
  });

  // ── Site Settings ───────────────────────────────────────────────────
  app.get("/api/settings", async (_req: Request, res: Response) => {
    const rows = await db.select().from(siteSettings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    res.json(map);
  });

  app.put("/api/settings", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(siteSettings).set({ value, updatedAt: new Date().toISOString() }).where(eq(siteSettings.key, key));
      } else {
        await db.insert(siteSettings).values({ key, value });
      }
    }
    res.json({ ok: true });
  });

  // ── Users ───────────────────────────────────────────────────────────
  app.get("/api/users", requireAuth, requireRole("super_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select({
      id: users.id, username: users.username, name: users.name,
      email: users.email, role: users.role, isActive: users.isActive,
      googleId: users.googleId, createdAt: users.createdAt,
    }).from(users).orderBy(users.name);
    res.json(rows);
  });

  app.post("/api/users", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const { password, ...rest } = parsed.data;
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const [row] = await db.insert(users).values({ ...rest, passwordHash: passwordHash ?? "" }).returning({
      id: users.id, username: users.username, name: users.name, email: users.email, role: users.role,
    });
    res.status(201).json(row);
  });

  app.put("/api/users/:id", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { name, email, role, isActive, password } = req.body;
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 12);
    const [row] = await db.update(users).set(updates).where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, role: users.role, isActive: users.isActive });
    if (!row) return res.status(404).json({ message: "User not found" });
    res.json(row);
  });

  app.delete("/api/users/:id", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) return res.status(400).json({ message: "Cannot delete your own account" });
    await db.delete(users).where(eq(users.id, id));
    res.json({ ok: true });
  });

  return server;
}
