// =============================================================================
// API ROUTES — server/routes.ts
// =============================================================================
// What this file does:
//   Defines every API endpoint the React frontend calls (/api/*).
//   Also sets up session handling and Google OAuth.
//
// Route groups:
//   /api/auth/*          Login, logout, Google OAuth, "who am I?"
//   /api/events/*        Club calendar events (CRUD)
//   /api/announcements/* News/posts (CRUD, with pinning + featured images)
//   /api/registrations/* Sign-up enquiries from the public Sign Up page
//   /api/contact/*       Contact form messages
//   /api/upload          Image upload endpoint (multer)
//   /api/media/*         Media library (list + delete uploaded images)
//   /api/juniors-content Juniors page section text (editable by juniors coordinator)
//   /api/settings        Site settings like Instagram feed ID, store URL, hero image
//   /api/users/*         Admin user management (super_admin only)
//
// Sessions:
//   Logged-in state is stored in a session cookie backed by SQLite.
//   Sessions last 7 days. The secret is set via SESSION_SECRET in .env.
//
// Google OAuth:
//   Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env.
//   If those are missing the /api/auth/google routes exist but passport won't
//   have a strategy registered, and the frontend hides the Google button.
// =============================================================================

import { type Express, type Request, type Response } from "express";
import { createServer } from "http";
import session from "express-session";
import ConnectSqlite3 from "connect-sqlite3";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import { mkdirSync } from "fs";
import { eq, desc, gte, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, events, registrations, announcements, juniorsContent,
  mediaUploads, siteSettings, contactMessages,
  sponsors, matchResults, newsletterSubscribers, pageContent, listItems,
  insertEventSchema, insertRegistrationSchema, insertAnnouncementSchema,
  insertSponsorSchema, insertMatchResultSchema,
  loginSchema, createUserSchema,
} from "@shared/schema";
import { requireAuth, requireRole } from "./middleware";
import { notifyContactMessage, notifyNewRegistration } from "./email";
import { SITEMAP_PAGES } from "@shared/seo";
import { getOrigin } from "./seo-inject";
import { getAdminPath } from "./runtime-config";
import {
  getClientIP, isBlocked, recordFailedAttempt, recordSuccessfulLogin,
  formatTime, getSuspiciousIPs, unblockIP,
} from "./security";

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

// ── Multer (file uploads) ───────────────────────────────────────────────────
const uploadDir = path.resolve("public/uploads");
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safe = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    cb(null, `${safe}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Serve uploaded files
  app.use("/uploads", (await import("express")).default.static(uploadDir));

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

  // ── SEO: robots.txt ─────────────────────────────────────────────────
  // Tells search engines what to crawl and where the sitemap is.
  // Admin pages are disallowed so they don't appear in search results.
  app.get("/robots.txt", (req: Request, res: Response) => {
    const origin = getOrigin(req);
    // NOTE: we deliberately do NOT list the admin path here — robots.txt is
    // public, so naming it would defeat the point of a secret path. The admin
    // area is noindex'd via the page itself instead.
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Allow: /",
        "",
        `Sitemap: ${origin}/sitemap.xml`,
      ].join("\n")
    );
  });

  // ── SEO: sitemap.xml ────────────────────────────────────────────────
  // Lists all public pages for search engines. Respects the page on/off
  // toggles in Settings (a hidden page is left out of the sitemap), and
  // includes published news posts so articles get indexed too.
  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    const origin = getOrigin(req);

    // Page visibility settings (nav_show_*) decide which optional pages appear
    const settingRows = await db.select().from(siteSettings);
    const settingsMap: Record<string, string> = {};
    for (const r of settingRows) settingsMap[r.key] = r.value;
    const pageOn = (key: string) => settingsMap[`nav_show_${key}`] !== "false";

    // Map sitemap paths to their visibility key (pages without a key are always on)
    const visKey: Record<string, string> = {
      "/gallery": "gallery",
      "/fixtures": "fixtures",
      "/store": "store",
    };

    const today = new Date().toISOString().split("T")[0];
    const urls = SITEMAP_PAGES
      .filter((p) => {
        const key = visKey[p.path];
        return !key || pageOn(key);
      })
      .map(
        (p) =>
          `  <url>\n    <loc>${origin}${p.path}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
      );

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.join("\n") +
      `\n</urlset>`;

    res.type("application/xml").send(xml);
  });

  // ── Auth — username/password ────────────────────────────────────────
  // Protected by progressive IP-based brute-force lockout (see server/security.ts)
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    // 1. If this IP is currently locked out, reject before doing anything else
    const block = isBlocked(ip);
    if (block.blocked) {
      return res.status(429).json({
        message: `Too many failed attempts. Please try again in ${formatTime(block.timeRemaining || 0)}.`,
        retryAfter: block.timeRemaining,
      });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      recordFailedAttempt(ip);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const { username, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    // 2. Any failure (bad user, inactive, wrong password) counts as an attempt.
    //    The message stays generic so attackers can't tell which part was wrong.
    const fail = (msg = "Invalid credentials") => {
      const r = recordFailedAttempt(ip);
      const m = r.blockedUntil
        ? `Invalid credentials. Too many failed attempts — locked for ${formatTime(r.blockedUntil.getTime() - Date.now())}.`
        : msg;
      return res.status(401).json({ message: m });
    };

    if (!user || !user.isActive) return fail();
    if (!user.passwordHash) return res.status(401).json({ message: "This account uses Google Sign-In" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return fail();

    // 3. Success — clear this IP's failed-attempt record
    recordSuccessfulLogin(ip);

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

    // Flag if this account still uses the default seeded password. The admin UI
    // shows a prominent warning banner until it's changed — important for a
    // gifted/handed-over site so it never sits on the public default password.
    let usingDefaultPassword = false;
    if (user.passwordHash) {
      usingDefaultPassword = await bcrypt.compare("lions2024!", user.passwordHash);
    }

    res.json({
      id: user.id, name: user.name, role: user.role,
      email: user.email, username: user.username, usingDefaultPassword,
    });
  });

  // ── Change own password (any logged-in admin) ───────────────────────
  // Lets every admin manage their OWN password without needing a super admin.
  // Requires the current password (unless the account is still on the default).
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify the current password (skip the check only if still on the default,
    // so a freshly-handed-over admin can set their own without friction).
    const onDefault = user.passwordHash
      ? await bcrypt.compare("lions2024!", user.passwordHash)
      : false;
    if (!onDefault) {
      const ok = user.passwordHash && (await bcrypt.compare(currentPassword ?? "", user.passwordHash));
      if (!ok) return res.status(400).json({ message: "Current password is incorrect." });
    }

    await db.update(users)
      .set({ passwordHash: await bcrypt.hash(newPassword, 12) })
      .where(eq(users.id, user.id));
    res.json({ ok: true });
  });

  // ── Google OAuth ────────────────────────────────────────────────────
  app.get("/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: `${getAdminPath()}/login?error=google` }),
    async (req: Request, res: Response) => {
      const user = req.user as any;
      if (user) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = user.name;
      }
      res.redirect(getAdminPath());
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
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      .limit(10);
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
  // ── Sign-up submission ──────────────────────────────────────────────
  // Saves to DB, emails the club (full details), and sends a confirmation
  // auto-reply to the person who registered (or their parent if it's a junior).
  // Requires CONTACT_EMAIL_USER + CONTACT_EMAIL_PASS in .env for emails to fire.
  app.post("/api/registrations", async (req: Request, res: Response) => {
    const parsed = insertRegistrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });

    // Save to database — happens regardless of email success
    const [row] = await db.insert(registrations).values(parsed.data).returning();

    // Fire both emails in background: club notification + registrant auto-reply
    notifyNewRegistration({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      isJunior: row.isJunior ?? false,
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      teamPreference: row.teamPreference,
      experienceLevel: row.experienceLevel,
      kidsportEligible: row.kidsportEligible ?? false,
      howHeard: row.howHeard,
      message: row.message,
    }).catch(() => {});

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
  // Saves to DB AND emails the club — same pattern as neaves.au.
  // Email requires CONTACT_EMAIL_USER + CONTACT_EMAIL_PASS in .env.
  // If email isn't configured the message is still saved to the database.
  app.post("/api/contact", async (req: Request, res: Response) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message)
      return res.status(400).json({ message: "All fields are required" });

    // Always save to DB first — never lose a message even if email fails
    const [row] = await db.insert(contactMessages).values({ name, email, subject, message }).returning();

    // Email notification fires in background — response is instant regardless
    notifyContactMessage({ name, email, subject, message }).catch(() => {});

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

  // ── Media Uploads ───────────────────────────────────────────────────
  app.post("/api/upload", requireAuth, requireRole("content_manager"),
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      const [row] = await db.insert(mediaUploads).values({
        filename: req.file.filename,
        originalName: req.file.originalname,
        url,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedBy: req.session.userId,
      }).returning();
      res.json({ url, id: row.id });
    }
  );

  app.get("/api/media", requireAuth, requireRole("content_manager"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(mediaUploads).orderBy(desc(mediaUploads.createdAt)).limit(200);
    res.json(rows);
  });

  app.delete("/api/media/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(mediaUploads).where(eq(mediaUploads.id, id)).limit(1);
    if (row) {
      const { unlink } = await import("fs/promises");
      await unlink(path.join(uploadDir, row.filename)).catch(() => {});
      await db.delete(mediaUploads).where(eq(mediaUploads.id, id));
    }
    res.json({ ok: true });
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

  // ── Sponsors ────────────────────────────────────────────────────────
  // Public: GET /api/sponsors (active only, sorted)
  // Admin: full CRUD (club_admin+)
  app.get("/api/sponsors", async (_req: Request, res: Response) => {
    const rows = await db.select().from(sponsors)
      .where(eq(sponsors.isActive, true))
      .orderBy(sponsors.sortOrder, sponsors.tier);
    res.json(rows);
  });

  app.get("/api/sponsors/all", requireAuth, requireRole("club_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(sponsors).orderBy(sponsors.sortOrder);
    res.json(rows);
  });

  app.post("/api/sponsors", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const parsed = insertSponsorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.insert(sponsors).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/sponsors/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertSponsorSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(sponsors).set(parsed.data).where(eq(sponsors.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/sponsors/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    await db.delete(sponsors).where(eq(sponsors.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Match Results ────────────────────────────────────────────────────
  // Public: GET /api/results (recent published results)
  // Admin: full CRUD (club_admin+)
  app.get("/api/results", async (_req: Request, res: Response) => {
    const rows = await db.select().from(matchResults)
      .where(eq(matchResults.isPublished, true))
      .orderBy(desc(matchResults.matchDate))
      .limit(20);
    res.json(rows);
  });

  app.get("/api/results/all", requireAuth, requireRole("club_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(matchResults).orderBy(desc(matchResults.matchDate)).limit(200);
    res.json(rows);
  });

  app.post("/api/results", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const parsed = insertMatchResultSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(matchResults).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/results/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertMatchResultSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(matchResults).set(parsed.data).where(eq(matchResults.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/results/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    await db.delete(matchResults).where(eq(matchResults.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Newsletter Subscribers ───────────────────────────────────────────
  // Public: POST /api/newsletter/subscribe
  // Admin: GET list + CSV export (club_admin+)
  app.post("/api/newsletter/subscribe", async (req: Request, res: Response) => {
    const { email, name } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email))
      return res.status(400).json({ message: "Valid email required" });
    try {
      await db.insert(newsletterSubscribers).values({ email: email.toLowerCase().trim(), name }).onConflictDoNothing();
      res.json({ ok: true });
    } catch {
      res.json({ ok: true }); // Silently ignore duplicate subscriptions
    }
  });

  app.get("/api/newsletter/subscribers", requireAuth, requireRole("club_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.isActive, true))
      .orderBy(desc(newsletterSubscribers.subscribedAt));
    res.json(rows);
  });

  // CSV export — download the full subscriber list
  app.get("/api/newsletter/export", requireAuth, requireRole("club_admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.isActive, true))
      .orderBy(newsletterSubscribers.subscribedAt);
    const csv = ["name,email,subscribed_at",
      ...rows.map((r) => `"${r.name ?? ""}","${r.email}","${r.subscribedAt}"`)
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="lions-newsletter-${new Date().toISOString().split("T")[0]}.csv"`);
    res.send(csv);
  });

  app.delete("/api/newsletter/subscribers/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    await db.update(newsletterSubscribers)
      .set({ isActive: false })
      .where(eq(newsletterSubscribers.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Page Content (CMS) ──────────────────────────────────────────────
  // GET /api/page-content/:page  — public, returns all sections for a page as {section: content}
  // PUT /api/page-content/:page/:section — content_manager+ to save a section
  //
  // Pages: home, about, contact, fixtures, store, gallery
  // Sections: any string key (hero_title, hero_subtitle, history_1, etc.)
  // If no row exists the frontend falls back to its hardcoded default text.
  app.get("/api/page-content/:page", async (req: Request, res: Response) => {
    const rows = await db.select().from(pageContent)
      .where(eq(pageContent.page, req.params.page));
    const map: Record<string, string> = {};
    for (const row of rows) map[row.section] = row.content;
    res.json(map);
  });

  app.put("/api/page-content/:page/:section", requireAuth, requireRole("content_manager"), async (req: Request, res: Response) => {
    const { page, section } = req.params;
    const { content } = req.body;
    if (!content && content !== "") return res.status(400).json({ message: "content is required" });

    // Upsert — insert if new, update if exists
    const existing = await db.select().from(pageContent)
      .where(and(eq(pageContent.page, page), eq(pageContent.section, section)))
      .limit(1);

    if (existing.length > 0) {
      const [row] = await db.update(pageContent)
        .set({ content, updatedAt: new Date().toISOString(), updatedBy: req.session.userId })
        .where(and(eq(pageContent.page, page), eq(pageContent.section, section)))
        .returning();
      return res.json(row);
    }
    const [row] = await db.insert(pageContent)
      .values({ page, section, content, updatedBy: req.session.userId })
      .returning();
    res.status(201).json(row);
  });

  // ── Media caption update ─────────────────────────────────────────────
  app.put("/api/media/:id/caption", requireAuth, requireRole("content_manager"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { caption } = req.body;
    const [row] = await db.update(mediaUploads).set({ caption }).where(eq(mediaUploads.id, id)).returning();
    res.json(row);
  });

  // ── List Items (team divisions, store apparel, juniors FAQ) ──────────
  // GET /api/list-items/:type — public, returns active rows sorted
  // Admin CRUD requires club_admin+ (so the right people manage structured lists)
  app.get("/api/list-items/:type", async (req: Request, res: Response) => {
    const rows = await db.select().from(listItems)
      .where(and(eq(listItems.listType, req.params.type), eq(listItems.isActive, true)))
      .orderBy(listItems.sortOrder);
    res.json(rows);
  });

  app.get("/api/list-items/:type/all", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const rows = await db.select().from(listItems)
      .where(eq(listItems.listType, req.params.type))
      .orderBy(listItems.sortOrder);
    res.json(rows);
  });

  app.post("/api/list-items", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const parsed = insertListItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(listItems).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/list-items/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertListItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(listItems).set(parsed.data).where(eq(listItems.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/list-items/:id", requireAuth, requireRole("club_admin"), async (req: Request, res: Response) => {
    await db.delete(listItems).where(eq(listItems.id, parseInt(req.params.id)));
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

  // Helper: how many ACTIVE super admins exist (besides an optional excluded id).
  // Used to prevent the club from ever locking themselves out by removing,
  // demoting or deactivating their last super admin.
  async function countOtherActiveSuperAdmins(excludeId: number): Promise<number> {
    const supers = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));
    return supers.filter((u) => u.id !== excludeId).length;
  }

  app.put("/api/users/:id", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { name, email, role, isActive, password } = req.body;

    // Look up the user being edited so we can apply lockout safeguards
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return res.status(404).json({ message: "User not found" });

    // SAFEGUARD: don't allow demoting or deactivating the LAST active super admin.
    // Without this, a club could accidentally remove all super-admin access and
    // permanently lose the ability to manage users and settings.
    const demoting = role && role !== "super_admin" && target.role === "super_admin";
    const deactivating = isActive === false && target.role === "super_admin";
    if ((demoting || deactivating) && (await countOtherActiveSuperAdmins(id)) === 0) {
      return res.status(400).json({
        message: "This is the only Super Admin. Promote another user to Super Admin first, then change this one.",
      });
    }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 12);
    const [row] = await db.update(users).set(updates).where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, role: users.role, isActive: users.isActive });
    res.json(row);
  });

  app.delete("/api/users/:id", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) return res.status(400).json({ message: "Cannot delete your own account" });

    // SAFEGUARD: never delete the last active super admin (prevents permanent lockout)
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (target?.role === "super_admin" && (await countOtherActiveSuperAdmins(id)) === 0) {
      return res.status(400).json({
        message: "This is the only Super Admin. Promote another user to Super Admin before deleting this one.",
      });
    }

    await db.delete(users).where(eq(users.id, id));
    res.json({ ok: true });
  });

  // ── Login security (super admin) ────────────────────────────────────
  // Shows IPs that have failed login attempts and lets an admin clear a block.
  app.get("/api/security/login-attempts", requireAuth, requireRole("super_admin"), (_req: Request, res: Response) => {
    res.json(getSuspiciousIPs());
  });

  app.post("/api/security/unblock", requireAuth, requireRole("super_admin"), (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ message: "IP required" });
    res.json({ ok: unblockIP(ip) });
  });

  return server;
}
