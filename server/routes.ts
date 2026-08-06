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
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import { mkdirSync } from "fs";
import { randomBytes } from "crypto";
import { eq, desc, gte, and, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users, events, registrations, announcements, juniorsContent,
  mediaUploads, siteSettings, contactMessages,
  sponsors, matchResults, newsletterSubscribers, pageContent,
  customPages, listItems,
  committeeMembers,
  products, productVariants, orders, orderItems,
  insertEventSchema, insertRegistrationSchema, insertAnnouncementSchema,
  insertSponsorSchema, insertMatchResultSchema, insertListItemSchema,
  insertCustomPageSchema,
  insertCommitteeMemberSchema,
  insertProductSchema, insertProductVariantSchema,
  loginSchema, createUserSchema,
} from "@shared/schema";
import { requireAuth, requirePermission } from "./middleware";
import { notifyContactMessage, notifyNewRegistration, sendTestEmail, notifyOrderPaid } from "./email";
import { SITEMAP_PAGES } from "@shared/seo";
import { getOrigin } from "./seo-inject";
import { getAdminPath, isDefaultPassword} from "./runtime-config";
import { invalidateSettingsCache, getSettingsSync } from "./site-settings";
import { cleanHtmlFields, cleanText } from "./sanitize";
import { SqliteSessionStore } from "./session-store";
import {
  getStoreConfig, canTakePayments, isTestMode, paymentSetupStatus,
  createCheckout, verifyWebhook,
} from "./payments";
import {
  priceCart, CartError, generateOrderReference, decrementStockForOrder,
  listProducts, getOrderWithItems,
} from "./store";
import {
  getClientIP, isBlocked, recordFailedAttempt, recordSuccessfulLogin,
  formatTime, getSuspiciousIPs, unblockIP, allowFormSubmission,
} from "./security";

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

// SECURITY: uploaded files are served from this site's own web address, so an
// uploaded file that a browser treats as a *document* rather than a picture can
// run code as if the club wrote it. Two rules keep that impossible:
//
//   1. The saved filename's extension comes from THIS list, never from the
//      name the browser sent. A file called "photo.html" cannot be created.
//   2. SVG is deliberately not allowed. It looks like an image and has an
//      image/... content type, but it is really a document that can contain
//      scripts. Clubs want photos and logos; PNG/JPEG/WebP/GIF cover that.
//
// The browser-supplied content type is only a hint and is easily faked, so it
// is checked but never trusted on its own.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Extension is chosen by us from the allow-list above, not taken from the
    // uploaded name — that is what stops "evil.html" ever hitting the disk.
    const ext = ALLOWED_IMAGE_TYPES[file.mimetype] ?? ".bin";
    const base = path.basename(file.originalname, path.extname(file.originalname));
    const safe = base.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60) || "image";
    cb(null, `${safe}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }, // 8 MB, one file per request
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error("Only JPEG, PNG, GIF, WebP or AVIF images can be uploaded."));
  },
});

// Every real image format starts with a known sequence of bytes ("magic
// numbers"). Checking them proves the file genuinely IS the picture it claims
// to be, rather than something else wearing an image label — which the browser
// alone can't tell us, since the type it sends is trivially faked.
function looksLikeRealImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  if (startsWith(0xff, 0xd8, 0xff)) return true;                          // JPEG
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return true;                    // PNG
  if (buf.subarray(0, 3).toString("latin1") === "GIF") return true;       // GIF
  // WebP and AVIF are containers: "RIFF....WEBP" / "....ftypavif"
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" &&
      buf.subarray(8, 12).toString("latin1") === "WEBP") return true;
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return true;      // AVIF/HEIF
  return false;
}

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Serve uploaded files.
  //
  // The headers are a second line of defence behind the upload allow-list: even
  // if a file that isn't really a picture ever reached this folder, these stop a
  // browser from running it. "sandbox" strips it of scripts and same-origin
  // access; "nosniff" stops the browser guessing a different type to the one we
  // send. Ordinary images are completely unaffected.
  app.use(
    "/uploads",
    (_req: Request, res: Response, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox");
      next();
    },
    (await import("express")).default.static(uploadDir, {
      index: false,
      dotfiles: "deny",
      setHeaders: (res) => res.setHeader("Cache-Control", "public, max-age=86400"),
    }),
  );

  // ── Behind a reverse proxy ──────────────────────────────────────────
  // In production this app almost always sits behind something else: nginx,
  // a Cloudflare Tunnel, or both. That front end terminates HTTPS and then
  // talks to this app over plain HTTP on localhost.
  //
  // Without this line Express believes the request arrived over HTTP, so the
  // login cookie below (which is marked "https only" in production) is never
  // sent to the browser. The symptom is nasty and hard to diagnose: logging in
  // appears to succeed, then you land straight back on the login page forever.
  //
  // "1" means: trust exactly one proxy in front of us, which is the normal
  // setup. It must NOT be blanket-true, or a visitor could spoof their own
  // address and defeat the login lockout.
  app.set("trust proxy", 1);

  // ── Session setup ───────────────────────────────────────────────────
  // SECURITY: the session secret signs every admin login cookie. If it were
  // a known/guessable default, anyone could forge an admin session. So:
  // if SESSION_SECRET is missing (or still a placeholder), we generate a
  // random one-off secret and warn loudly. The site still works — but every
  // admin gets logged out whenever the server restarts, until a real
  // SESSION_SECRET is set in .env (see .env.example for how).
  const PLACEHOLDER_SECRETS = [
    "lions-lacrosse-secret-change-me",
    "change-this-to-a-long-random-string",
  ];
  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || PLACEHOLDER_SECRETS.includes(sessionSecret)) {
    sessionSecret = randomBytes(32).toString("hex");
    console.warn(
      "[security] ⚠ SESSION_SECRET is not set in .env — using a random one-off secret.\n" +
      "[security]   Admin logins will NOT survive a server restart until you set it.\n" +
      "[security]   Fix: add SESSION_SECRET=<output of `openssl rand -hex 32`> to .env"
    );
  }

  // Idle timeout: admins are logged out after this long with NO activity.
  // "rolling: true" makes it a sliding window — every request an admin makes
  // pushes the expiry forward, so an actively-working admin is never
  // interrupted, but a login left open on a shared/club laptop dies after
  // SESSION_IDLE_HOURS (default 2, same policy as neaves.au).
  const idleHours = parseFloat(process.env.SESSION_IDLE_HOURS ?? "2") || 2;

  app.use(
    session({
      store: new SqliteSessionStore("./data/sessions.db"),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true, // refresh the expiry on every request (sliding idle window)
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,   // JavaScript on the page can never read the cookie
        // "lax" means the cookie is not sent on requests started by another
        // website, which blocks cross-site request forgery: a malicious page
        // cannot make a logged-in admin's browser POST to this site.
        sameSite: "lax",
        maxAge: idleHours * 60 * 60 * 1000,
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
      "/coaches-board": "coaches_board",
      "/committee": "committee",
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

    // Issue a BRAND NEW session id now that this browser has become an admin.
    // Reusing the id the browser turned up with would allow "session fixation":
    // if someone managed to plant a known session id in an admin's browser
    // beforehand, that same id would silently become a logged-in admin session
    // the moment the real admin signed in. Regenerating makes the planted id
    // worthless.
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: "Could not start session" });

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;

      // Wait for the new session to be written before replying, so the very
      // next request from this browser is already recognised as logged in.
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Could not start session" });
        res.json({ id: user.id, name: user.name, role: user.role, email: user.email });
      });
    });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => req.session.destroy(() => res.json({ ok: true })));
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const userId = req.session.userId ?? (req.user as any)?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    // Also reject if the account was locked out or deleted while they were
    // logged in — otherwise the admin UI would keep looking signed-in even
    // though every API call is now being refused.
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Flag if this account still uses the default seeded password. The admin UI
    // shows a prominent warning banner until it's changed — important for a
    // gifted/handed-over site so it never sits on the public default password.
    const usingDefaultPassword = await isDefaultPassword(user.passwordHash, bcrypt.compare);

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
    const onDefault = await isDefaultPassword(user.passwordHash, bcrypt.compare);
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

  app.get("/api/events/all", requireAuth, requirePermission("events"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(events).orderBy(desc(events.startDate)).limit(200);
    res.json(rows);
  });

  app.post("/api/events", requireAuth, requirePermission("events"), async (req: Request, res: Response) => {
    const parsed = insertEventSchema.safeParse({ ...req.body, createdBy: req.session.userId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(events).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/events/:id", requireAuth, requirePermission("events"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertEventSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(events).set(parsed.data).where(eq(events.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Event not found" });
    res.json(row);
  });

  app.delete("/api/events/:id", requireAuth, requirePermission("events"), async (req: Request, res: Response) => {
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

  app.get("/api/announcements/all", requireAuth, requirePermission("news"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
    res.json(rows);
  });

  app.post("/api/announcements", requireAuth, requirePermission("news"), async (req: Request, res: Response) => {
    // Rich text is sanitised before validation so only safe HTML is ever stored.
    const parsed = insertAnnouncementSchema.safeParse({
      ...cleanHtmlFields(req.body, ["content"]), createdBy: req.session.userId,
    });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.insert(announcements).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/announcements/:id", requireAuth, requirePermission("news"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertAnnouncementSchema.partial().safeParse(cleanHtmlFields(req.body, ["content"]));
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(announcements).set(parsed.data).where(eq(announcements.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/announcements/:id", requireAuth, requirePermission("news"), async (req: Request, res: Response) => {
    await db.delete(announcements).where(eq(announcements.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Registrations ───────────────────────────────────────────────────
  // ── Sign-up submission ──────────────────────────────────────────────
  // Saves to DB, emails the club (full details), and sends a confirmation
  // auto-reply to the person who registered (or their parent if it's a junior).
  // Requires CONTACT_EMAIL_USER + CONTACT_EMAIL_PASS in .env for emails to fire.
  app.post("/api/registrations", async (req: Request, res: Response) => {
    // Anyone on the internet can post here, and each submission sends two
    // emails, so cap how often one address may do it.
    if (!allowFormSubmission(getClientIP(req), 5)) {
      return res.status(429).json({
        message: "Too many sign-ups from this connection. Please try again later, or email the club directly.",
      });
    }
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

  app.get("/api/registrations", requireAuth, requirePermission("signups"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(registrations).orderBy(desc(registrations.createdAt)).limit(500);
    res.json(rows);
  });

  app.put("/api/registrations/:id/status", requireAuth, requirePermission("signups"), async (req: Request, res: Response) => {
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
    if (!allowFormSubmission(getClientIP(req), 5)) {
      return res.status(429).json({
        message: "Too many messages from this connection. Please try again later.",
      });
    }
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message)
      return res.status(400).json({ message: "All fields are required" });

    // Length caps: without them a bot could push megabytes into the database
    // with a single request. These are far above anything a real person sends.
    const tooLong =
      String(name).length > 100 || String(email).length > 200 ||
      String(subject).length > 200 || String(message).length > 5000;
    if (tooLong) return res.status(400).json({ message: "One of those fields is too long." });
    if (!/^\S+@\S+\.\S+$/.test(String(email))) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    // Always save to DB first — never lose a message even if email fails
    const [row] = await db.insert(contactMessages).values({ name, email, subject, message }).returning();

    // Email notification fires in background — response is instant regardless
    notifyContactMessage({ name, email, subject, message }).catch(() => {});

    res.status(201).json({ ok: true, id: row.id });
  });

  app.get("/api/contact", requireAuth, requirePermission("messages"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(200);
    res.json(rows);
  });

  app.put("/api/contact/:id/read", requireAuth, requirePermission("messages"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [row] = await db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, id)).returning();
    res.json(row);
  });

  // ── Juniors Content ─────────────────────────────────────────────────
  app.get("/api/juniors-content", async (_req: Request, res: Response) => {
    const rows = await db.select().from(juniorsContent);
    res.json(rows);
  });

  app.put("/api/juniors-content/:section", requireAuth, requirePermission("juniors"), async (req: Request, res: Response) => {
    const { section } = req.params;
    const { title, content } = cleanHtmlFields(req.body, ["content"]);
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
  app.post("/api/upload", requireAuth, requirePermission("media"),
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      // Confirm the saved file really is an image; if not, delete it again and
      // tell the admin plainly, rather than leaving a broken picture in the
      // media library for someone to puzzle over later.
      const { readFile, unlink: removeFile } = await import("fs/promises");
      const diskPath = path.join(uploadDir, req.file.filename);
      const head = await readFile(diskPath).then((b) => b.subarray(0, 16)).catch(() => Buffer.alloc(0));
      if (!looksLikeRealImage(head)) {
        await removeFile(diskPath).catch(() => {});
        return res.status(400).json({
          message: "That file isn't a valid image. Please upload a JPEG, PNG, GIF, WebP or AVIF photo.",
        });
      }

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

  app.get("/api/media", requireAuth, requirePermission("media"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(mediaUploads).orderBy(desc(mediaUploads.createdAt)).limit(200);
    res.json(rows);
  });

  app.delete("/api/media/:id", requireAuth, requirePermission("media"), async (req: Request, res: Response) => {
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
  // SECURITY: /api/settings is PUBLIC (the site needs the logo, colours etc.
  // before anyone logs in), so mail credentials must never appear there.
  // They're stripped below and exposed only to super admins via
  // /api/settings/secure, with the password masked.
  const SECRET_SETTING_KEYS = [
    "mail_pass", "mail_user", "mail_host", "mail_port", "mail_from", "mail_notify",
    // The Stripe SECRET key can create charges and issue refunds on the club's
    // account. It must never be sent to a browser. (The PUBLISHABLE key is
    // designed to be public and is served via /api/store/config.)
    "stripe_secret_key", "stripe_webhook_secret",
  ];

  app.get("/api/settings", async (_req: Request, res: Response) => {
    const rows = await db.select().from(siteSettings);
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (SECRET_SETTING_KEYS.includes(row.key)) continue; // never expose publicly
      map[row.key] = row.value;
    }
    res.json(map);
  });

  // Super-admin view INCLUDING mail settings, for the Settings/Security tabs.
  // The password is masked — the stored value is only ever written, never
  // sent back to a browser.
  app.get("/api/settings/secure", requireAuth, requirePermission("settings"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(siteSettings);
    const map: Record<string, string> = {};
    for (const row of rows) {
      // Secrets are shown only as "set" or "not set" — the stored value is
      // written to, never read back out, even for a super admin.
      const isSecret = ["mail_pass", "stripe_secret_key", "stripe_webhook_secret"].includes(row.key);
      map[row.key] = isSecret ? (row.value ? "********" : "") : row.value;
    }
    res.json(map);
  });

  app.put("/api/settings", requireAuth, requirePermission("settings"), async (req: Request, res: Response) => {
    const updates = req.body as Record<string, string>;
    // Ignore the masked placeholder so re-saving the form doesn't overwrite the
    // real SMTP password with literal asterisks.
    for (const key of ["mail_pass", "stripe_secret_key", "stripe_webhook_secret"]) {
      if (updates[key] === "********") delete updates[key];
    }
    for (const [key, value] of Object.entries(updates)) {
      const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(siteSettings).set({ value, updatedAt: new Date().toISOString() }).where(eq(siteSettings.key, key));
      } else {
        await db.insert(siteSettings).values({ key, value });
      }
    }
    // Drop the server-side cache so the SEO tags injected into the HTML use
    // the new club name/sport straight away instead of up to 30s later.
    invalidateSettingsCache();
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

  app.get("/api/sponsors/all", requireAuth, requirePermission("sponsors"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(sponsors).orderBy(sponsors.sortOrder);
    res.json(rows);
  });

  app.post("/api/sponsors", requireAuth, requirePermission("sponsors"), async (req: Request, res: Response) => {
    const parsed = insertSponsorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.insert(sponsors).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/sponsors/:id", requireAuth, requirePermission("sponsors"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertSponsorSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(sponsors).set(parsed.data).where(eq(sponsors.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/sponsors/:id", requireAuth, requirePermission("sponsors"), async (req: Request, res: Response) => {
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

  app.get("/api/results/all", requireAuth, requirePermission("results"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(matchResults).orderBy(desc(matchResults.matchDate)).limit(200);
    res.json(rows);
  });

  app.post("/api/results", requireAuth, requirePermission("results"), async (req: Request, res: Response) => {
    const parsed = insertMatchResultSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(matchResults).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/results/:id", requireAuth, requirePermission("results"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertMatchResultSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(matchResults).set(parsed.data).where(eq(matchResults.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/results/:id", requireAuth, requirePermission("results"), async (req: Request, res: Response) => {
    await db.delete(matchResults).where(eq(matchResults.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Newsletter Subscribers ───────────────────────────────────────────
  // Public: POST /api/newsletter/subscribe
  // Admin: GET list + CSV export (club_admin+)
  app.post("/api/newsletter/subscribe", async (req: Request, res: Response) => {
    if (!allowFormSubmission(getClientIP(req), 10)) {
      return res.status(429).json({ message: "Too many attempts. Please try again later." });
    }
    const { email, name } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email) || String(email).length > 200)
      return res.status(400).json({ message: "Valid email required" });
    try {
      await db.insert(newsletterSubscribers).values({ email: email.toLowerCase().trim(), name }).onConflictDoNothing();
      res.json({ ok: true });
    } catch {
      res.json({ ok: true }); // Silently ignore duplicate subscriptions
    }
  });

  app.get("/api/newsletter/subscribers", requireAuth, requirePermission("newsletter"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.isActive, true))
      .orderBy(desc(newsletterSubscribers.subscribedAt));
    res.json(rows);
  });

  // CSV export — download the full subscriber list
  app.get("/api/newsletter/export", requireAuth, requirePermission("newsletter"), async (_req: Request, res: Response) => {
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

  app.delete("/api/newsletter/subscribers/:id", requireAuth, requirePermission("newsletter"), async (req: Request, res: Response) => {
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

  app.put("/api/page-content/:page/:section", requireAuth, requirePermission("pages"), async (req: Request, res: Response) => {
    const { page, section } = req.params;
    const { content } = cleanHtmlFields(req.body, ["content"]);
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
  app.put("/api/media/:id/caption", requireAuth, requirePermission("media"), async (req: Request, res: Response) => {
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

  app.get("/api/list-items/:type/all", requireAuth, requirePermission("lists"), async (req: Request, res: Response) => {
    const rows = await db.select().from(listItems)
      .where(eq(listItems.listType, req.params.type))
      .orderBy(listItems.sortOrder);
    res.json(rows);
  });

  app.post("/api/list-items", requireAuth, requirePermission("lists"), async (req: Request, res: Response) => {
    const parsed = insertListItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(listItems).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/list-items/:id", requireAuth, requirePermission("lists"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertListItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(listItems).set(parsed.data).where(eq(listItems.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/list-items/:id", requireAuth, requirePermission("lists"), async (req: Request, res: Response) => {
    await db.delete(listItems).where(eq(listItems.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Users ───────────────────────────────────────────────────────────
  app.get("/api/users", requireAuth, requirePermission("users"), async (_req: Request, res: Response) => {
    const rows = await db.select({
      id: users.id, username: users.username, name: users.name,
      email: users.email, role: users.role, isActive: users.isActive,
      googleId: users.googleId, createdAt: users.createdAt,
    }).from(users).orderBy(users.name);
    res.json(rows);
  });

  app.post("/api/users", requireAuth, requirePermission("users"), async (req: Request, res: Response) => {
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

  app.put("/api/users/:id", requireAuth, requirePermission("users"), async (req: Request, res: Response) => {
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

  app.delete("/api/users/:id", requireAuth, requirePermission("users"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) return res.status(400).json({ message: "Cannot delete your own account" });

    // SAFEGUARD: never delete the last active super admin (prevents permanent lockout)
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (target?.role === "super_admin" && (await countOtherActiveSuperAdmins(id)) === 0) {
      return res.status(400).json({
        message: "This is the only Super Admin. Promote another user to Super Admin before deleting this one.",
      });
    }

    // Their news posts, events and uploads are the CLUB's content and must
    // survive the person leaving. Those tables have a foreign key to users, so
    // deleting the row outright fails ("FOREIGN KEY constraint failed") and
    // would crash the server. Clear the authorship links first, then delete.
    try {
      await db.update(announcements).set({ createdBy: null }).where(eq(announcements.createdBy, id));
      await db.update(events).set({ createdBy: null }).where(eq(events.createdBy, id));
      await db.update(juniorsContent).set({ updatedBy: null }).where(eq(juniorsContent.updatedBy, id));
      await db.update(mediaUploads).set({ uploadedBy: null }).where(eq(mediaUploads.uploadedBy, id));
      await db.update(pageContent).set({ updatedBy: null }).where(eq(pageContent.updatedBy, id));
      await db.delete(users).where(eq(users.id, id));
    } catch (e: any) {
      // Never let this take the site down — report it instead.
      console.error("[users] Delete failed:", e?.message ?? e);
      return res.status(500).json({
        message: "Couldn't remove this account. Try locking it instead (Security → Admin Access).",
      });
    }
    res.json({ ok: true });
  });

  // ── Committee / Board ───────────────────────────────────────────────
  // Public: the active members shown on /committee.
  // Admin: full CRUD for whoever has the "committee" permission.
  app.get("/api/committee", async (_req: Request, res: Response) => {
    const rows = await db.select().from(committeeMembers)
      .where(eq(committeeMembers.isActive, true))
      .orderBy(committeeMembers.sortOrder, committeeMembers.id);
    res.json(rows);
  });

  app.get("/api/committee/all", requireAuth, requirePermission("committee"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(committeeMembers)
      .orderBy(committeeMembers.sortOrder, committeeMembers.id);
    res.json(rows);
  });

  app.post("/api/committee", requireAuth, requirePermission("committee"), async (req: Request, res: Response) => {
    const parsed = insertCommitteeMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    const [row] = await db.insert(committeeMembers).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/committee/:id", requireAuth, requirePermission("committee"), async (req: Request, res: Response) => {
    const parsed = insertCommitteeMemberSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [row] = await db.update(committeeMembers).set(parsed.data)
      .where(eq(committeeMembers.id, parseInt(req.params.id))).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });

  app.delete("/api/committee/:id", requireAuth, requirePermission("committee"), async (req: Request, res: Response) => {
    await db.delete(committeeMembers).where(eq(committeeMembers.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Custom Pages (admin-created) ────────────────────────────────────
  // Public: list published pages (for the nav) and fetch one by slug.
  // Admin (club_admin+): full create/edit/delete.
  app.get("/api/pages", async (_req: Request, res: Response) => {
    const rows = await db.select().from(customPages)
      .where(eq(customPages.isPublished, true))
      .orderBy(customPages.sortOrder, customPages.title);
    res.json(rows);
  });

  app.get("/api/pages/all", requireAuth, requirePermission("pages"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(customPages).orderBy(customPages.sortOrder, customPages.title);
    res.json(rows);
  });

  app.get("/api/pages/:slug", async (req: Request, res: Response) => {
    const [row] = await db.select().from(customPages)
      .where(eq(customPages.slug, req.params.slug)).limit(1);
    if (!row || !row.isPublished) return res.status(404).json({ message: "Page not found" });
    res.json(row);
  });

  app.post("/api/pages", requireAuth, requirePermission("pages"), async (req: Request, res: Response) => {
    const parsed = insertCustomPageSchema.safeParse({
      ...cleanHtmlFields(req.body, ["content"]), createdBy: req.session.userId,
    });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });

    // Slugs must be unique — they're the page's web address.
    const [clash] = await db.select().from(customPages)
      .where(eq(customPages.slug, parsed.data.slug)).limit(1);
    if (clash) {
      return res.status(400).json({ message: "A page with that web address already exists. Try a different title." });
    }

    const [row] = await db.insert(customPages).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/pages/:id", requireAuth, requirePermission("pages"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsed = insertCustomPageSchema.partial().safeParse(cleanHtmlFields(req.body, ["content"]));
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });

    // If the slug is changing, make sure it doesn't collide with another page.
    if (parsed.data.slug) {
      const [clash] = await db.select().from(customPages)
        .where(eq(customPages.slug, parsed.data.slug)).limit(1);
      if (clash && clash.id !== id) {
        return res.status(400).json({ message: "Another page already uses that web address." });
      }
    }

    const [row] = await db.update(customPages)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(customPages.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Page not found" });
    res.json(row);
  });

  app.delete("/api/pages/:id", requireAuth, requirePermission("pages"), async (req: Request, res: Response) => {
    await db.delete(customPages).where(eq(customPages.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // ── Login security (super admin) ────────────────────────────────────
  // Shows IPs that have failed login attempts and lets an admin clear a block.
  app.get("/api/security/login-attempts", requireAuth, requirePermission("security"), (_req: Request, res: Response) => {
    res.json(getSuspiciousIPs());
  });

  app.post("/api/security/unblock", requireAuth, requirePermission("security"), (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ message: "IP required" });
    res.json({ ok: unblockIP(ip) });
  });

  // ── Security: send a test email ─────────────────────────────────────
  // Lets a super admin confirm the mail settings actually work, without
  // waiting for a real form submission.
  app.post("/api/security/test-email", requireAuth, requirePermission("security"), async (req: Request, res: Response) => {
    const to = (req.body?.to || "").trim();
    if (!to || !/\S+@\S+\.\S+/.test(to)) {
      return res.status(400).json({ message: "A valid destination email is required." });
    }
    try {
      await sendTestEmail(to);
      res.json({ ok: true, message: `Test email sent to ${to}. Check the inbox (and spam).` });
    } catch (e: any) {
      // Surface the real SMTP error — that's what makes this button useful.
      res.status(400).json({ message: e?.message ?? "Sending failed." });
    }
  });

  // ── Security: reset another admin's password (super admin only) ─────
  // For when a committee member forgets theirs. The super admin sets a
  // temporary password and passes it on; the user can then change it
  // themselves from the Password button.
  app.post("/api/security/reset-user-password", requireAuth, requirePermission("security"), async (req: Request, res: Response) => {
    const id = parseInt(req.body?.userId);
    const newPassword = String(req.body?.newPassword ?? "");
    if (!id) return res.status(400).json({ message: "User is required." });
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return res.status(404).json({ message: "User not found." });

    await db.update(users)
      .set({ passwordHash: await bcrypt.hash(newPassword, 12) })
      .where(eq(users.id, id));

    res.json({ ok: true, message: `Password reset for ${target.name}.` });
  });

  // ── Security: lock / unlock an admin account ────────────────────────
  // "Locking" sets is_active = false: the account stays (so their history is
  // intact) but they can no longer log in. Reversible, unlike deleting.
  app.post("/api/security/set-user-active", requireAuth, requirePermission("security"), async (req: Request, res: Response) => {
    const id = parseInt(req.body?.userId);
    const isActive = req.body?.isActive === true;
    if (!id) return res.status(400).json({ message: "User is required." });
    if (id === req.session.userId) {
      return res.status(400).json({ message: "You can't lock your own account." });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return res.status(404).json({ message: "User not found." });

    // Same safeguard as elsewhere: never lock out the last active super admin.
    if (!isActive && target.role === "super_admin" && (await countOtherActiveSuperAdmins(id)) === 0) {
      return res.status(400).json({
        message: "This is the only Super Admin. Promote another user first.",
      });
    }

    await db.update(users).set({ isActive }).where(eq(users.id, id));
    res.json({ ok: true, message: `${target.name} ${isActive ? "unlocked" : "locked out"}.` });
  });


  // ═══════════════════════════════════════════════════════════════════════
  // THE SHOP
  // ═══════════════════════════════════════════════════════════════════════
  // Public: what's for sale, and starting a payment.
  // Admin:  products, sizes, stock and orders (needs the "store" permission).
  //
  // The golden rule, enforced in server/store.ts: the browser only ever tells
  // us WHICH item and HOW MANY. Prices always come from the database.
  // ═══════════════════════════════════════════════════════════════════════

  // What the store page needs to render itself. Safe for anyone to read — the
  // publishable key is designed to be public; the secret key never appears.
  app.get("/api/store/config", async (_req: Request, res: Response) => {
    const cfg = getStoreConfig();
    const s = getSettingsSync();
    res.json({
      mode: cfg.mode,
      currency: cfg.currency,
      currencySymbol: cfg.currencySymbol,
      canPay: canTakePayments(cfg),
      testMode: isTestMode(cfg),
      pickupEnabled: s.store_pickup_enabled !== "false",
      shippingEnabled: s.store_shipping_enabled === "true",
      shippingCents: parseInt(s.store_shipping_cents ?? "0", 10) || 0,
      freeShippingOverCents: parseInt(s.store_free_shipping_over_cents ?? "", 10) || 0,
      taxNote: s.store_tax_note ?? "",
      terms: s.store_terms ?? "",
      externalUrl: s.store_url ?? "",
    });
  });

  // Everything currently for sale.
  app.get("/api/products", async (_req: Request, res: Response) => {
    res.json(listProducts(true));
  });

  // ── Start a payment ─────────────────────────────────────────────────────
  app.post("/api/store/checkout", async (req: Request, res: Response) => {
    // Same throttle as the other public forms: creating a checkout makes an
    // outbound API call, so it shouldn't be free to trigger in bulk.
    if (!allowFormSubmission(getClientIP(req), 20)) {
      return res.status(429).json({ message: "Too many attempts. Please wait a moment and try again." });
    }

    const cfg = getStoreConfig();
    if (!canTakePayments(cfg)) {
      return res.status(503).json({ message: "Online payment isn't available right now. Please contact the club." });
    }

    const { cart, customer, fulfilmentMethod, notes } = req.body ?? {};
    const method = fulfilmentMethod === "shipping" ? "shipping" : "pickup";

    const settings = getSettingsSync();
    if (method === "pickup" && settings.store_pickup_enabled === "false") {
      return res.status(400).json({ message: "Pickup isn't available." });
    }
    if (method === "shipping" && settings.store_shipping_enabled !== "true") {
      return res.status(400).json({ message: "Postage isn't available." });
    }

    const email = String(customer?.email ?? "").trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || email.length > 200) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    const name = cleanText(customer?.name).slice(0, 100);
    if (!name) return res.status(400).json({ message: "Please enter your name." });

    const address = cleanText(customer?.address).slice(0, 500);
    if (method === "shipping" && !address) {
      return res.status(400).json({ message: "Please enter a postal address." });
    }

    let priced;
    try {
      priced = priceCart(cart, method);          // prices re-read from the database
    } catch (err) {
      if (err instanceof CartError) return res.status(400).json({ message: err.message });
      throw err;
    }

    // Record the order BEFORE sending anyone to pay, so an interrupted payment
    // still leaves a trace the club can follow up rather than vanishing.
    const reference = generateOrderReference();
    const [order] = await db.insert(orders).values({
      reference,
      status: "pending",
      customerName: name,
      customerEmail: email,
      customerPhone: cleanText(customer?.phone).slice(0, 50) || null,
      fulfilmentMethod: method,
      shippingAddress: method === "shipping" ? address : null,
      subtotalCents: priced.subtotalCents,
      shippingCents: priced.shippingCents,
      totalCents: priced.totalCents,
      currency: cfg.currency,
      paymentProvider: "stripe",
      notes: cleanText(notes).slice(0, 1000) || null,
    }).returning();

    await db.insert(orderItems).values(
      priced.items.map((i) => ({
        orderId: order.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantLabel: i.variantLabel,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
    );

    const origin = getOrigin(req);
    try {
      const { url, paymentRef } = await createCheckout({
        reference,
        currency: cfg.currency,
        lines: priced.lines,
        shippingCents: priced.shippingCents,
        shippingLabel: settings.store_shipping_label?.trim() || "Postage",
        customerEmail: email,
        successUrl: `${origin}/store/thank-you?ref=${encodeURIComponent(reference)}`,
        cancelUrl: `${origin}/store/cancelled?ref=${encodeURIComponent(reference)}`,
      });

      await db.update(orders).set({ paymentRef }).where(eq(orders.id, order.id));
      res.json({ url, reference });
    } catch (err) {
      // The payment company refused or is unreachable. Remove the pending order
      // so it doesn't sit in the admin list looking like a real sale.
      await db.delete(orders).where(eq(orders.id, order.id));
      console.error("[store] Could not create payment page:", (err as Error).message);
      res.status(502).json({ message: "Couldn't reach the payment provider. Please try again shortly." });
    }
  });

  // ── Payment confirmation from Stripe ────────────────────────────────────
  // This is the ONLY thing that marks an order paid. The customer's browser
  // returning to the "thank you" page proves nothing — anyone can visit a URL.
  app.post("/api/store/webhook", async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (typeof signature !== "string" || !rawBody) {
      return res.status(400).json({ message: "Missing signature" });
    }

    let event;
    try {
      event = await verifyWebhook(rawBody, signature);
    } catch (err) {
      // Either not from Stripe, or altered in transit. Never act on it.
      console.warn("[store] Rejected an unverified payment webhook:", (err as Error).message);
      return res.status(400).json({ message: "Invalid signature" });
    }

    try {
      if (event.kind === "paid" && event.paymentRef) {
        const [order] = await db.select().from(orders)
          .where(eq(orders.paymentRef, event.paymentRef)).limit(1);

        if (order && order.status === "pending") {
          // Stripe retries webhooks until it gets a 200, and may deliver the
          // same event twice. Only acting while the order is still "pending"
          // makes that harmless — stock can never be decremented twice.
          await db.update(orders).set({
            status: "paid",
            paidAt: new Date().toISOString(),
            paymentIntent: event.paymentIntent ?? null,
            shippingAddress: order.shippingAddress ?? event.shippingAddress ?? null,
          }).where(eq(orders.id, order.id));

          decrementStockForOrder(order.id);

          const full = getOrderWithItems(order.id);
          if (full) notifyOrderPaid(full).catch(() => {});
        }
      } else if (event.kind === "expired" && event.paymentRef) {
        await db.update(orders).set({ status: "cancelled" })
          .where(and(eq(orders.paymentRef, event.paymentRef), eq(orders.status, "pending")));
      } else if (event.kind === "refunded" && event.paymentIntent) {
        await db.update(orders).set({ status: "refunded" })
          .where(eq(orders.paymentIntent, event.paymentIntent));
      }
    } catch (err) {
      // Tell Stripe we failed so it retries, rather than losing the payment.
      console.error("[store] Failed handling a confirmed payment:", (err as Error).message);
      return res.status(500).json({ message: "Processing failed" });
    }

    res.json({ received: true });
  });

  // Order status for the "thank you" page. Deliberately returns no personal
  // details — just enough to confirm the order came through.
  app.get("/api/store/order/:reference", async (req: Request, res: Response) => {
    const [order] = await db.select().from(orders)
      .where(eq(orders.reference, req.params.reference)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    res.json({
      reference: order.reference,
      status: order.status,
      totalCents: order.totalCents,
      currency: order.currency,
      fulfilmentMethod: order.fulfilmentMethod,
      items: items.map((i) => ({
        productName: i.productName, variantLabel: i.variantLabel,
        quantity: i.quantity, unitPriceCents: i.unitPriceCents,
      })),
    });
  });

  // ── Admin: products & sizes ─────────────────────────────────────────────
  app.get("/api/admin/products", requireAuth, requirePermission("store"), async (_req: Request, res: Response) => {
    res.json(listProducts(false));
  });

  app.get("/api/admin/store-status", requireAuth, requirePermission("store"), async (_req: Request, res: Response) => {
    const cfg = getStoreConfig();
    res.json({
      mode: cfg.mode,
      canPay: canTakePayments(cfg),
      testMode: isTestMode(cfg),
      message: paymentSetupStatus(cfg),
      webhookPath: "/api/store/webhook",
    });
  });

  app.post("/api/admin/products", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const parsed = insertProductSchema.safeParse(cleanHtmlFields(req.body, ["description"]));
    if (!parsed.success) return res.status(400).json({ message: "Invalid product details", errors: parsed.error.issues });
    const [row] = await db.insert(products).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/admin/products/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const parsed = insertProductSchema.partial().safeParse(cleanHtmlFields(req.body, ["description"]));
    if (!parsed.success) return res.status(400).json({ message: "Invalid product details" });
    const [row] = await db.update(products)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(products.id, parseInt(req.params.id))).returning();
    if (!row) return res.status(404).json({ message: "Product not found" });
    res.json(row);
  });

  app.delete("/api/admin/products/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    // Past orders keep their own copy of the name and price, so deleting a
    // product never rewrites history — but the order lines still point at it,
    // so clear those links before removing the rows.
    const variantIds = (await db.select({ id: productVariants.id }).from(productVariants)
      .where(eq(productVariants.productId, id))).map((v) => v.id);

    await db.update(orderItems).set({ productId: null }).where(eq(orderItems.productId, id));
    if (variantIds.length > 0) {
      await db.update(orderItems).set({ variantId: null }).where(inArray(orderItems.variantId, variantIds));
    }
    await db.delete(productVariants).where(eq(productVariants.productId, id));
    await db.delete(products).where(eq(products.id, id));
    res.json({ ok: true });
  });

  app.post("/api/admin/variants", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const parsed = insertProductVariantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid size details", errors: parsed.error.issues });
    const [row] = await db.insert(productVariants).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/admin/variants/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const parsed = insertProductVariantSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid size details" });
    const [row] = await db.update(productVariants).set(parsed.data)
      .where(eq(productVariants.id, parseInt(req.params.id))).returning();
    if (!row) return res.status(404).json({ message: "Size not found" });
    res.json(row);
  });

  app.delete("/api/admin/variants/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await db.update(orderItems).set({ variantId: null }).where(eq(orderItems.variantId, id));
    await db.delete(productVariants).where(eq(productVariants.id, id));
    res.json({ ok: true });
  });

  // ── Admin: orders ───────────────────────────────────────────────────────
  app.get("/api/admin/orders", requireAuth, requirePermission("store"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
    const lines = await db.select().from(orderItems);
    res.json(rows.map((o) => ({ ...o, items: lines.filter((l) => l.orderId === o.id) })));
  });

  app.put("/api/admin/orders/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { status, adminNotes } = req.body ?? {};
    const allowed = ["pending", "paid", "fulfilled", "cancelled", "refunded"];
    const update: Record<string, unknown> = {};
    if (typeof status === "string" && allowed.includes(status)) update.status = status;
    if (typeof adminNotes === "string") update.adminNotes = cleanText(adminNotes).slice(0, 2000);
    if (Object.keys(update).length === 0) return res.status(400).json({ message: "Nothing to update" });

    const [row] = await db.update(orders).set(update).where(eq(orders.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Order not found" });
    res.json(row);
  });

  return server;
}
