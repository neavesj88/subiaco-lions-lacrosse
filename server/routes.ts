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
import { z } from "zod";
import multer from "multer";
import path from "path";
import { mkdirSync } from "fs";
import { randomBytes } from "crypto";
import { eq, desc, gte, and, inArray, sql } from "drizzle-orm";
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
import { requireAuth, requirePermission, catchAsyncErrors } from "./middleware";
import { isEmailAddress } from "./input";
import { readSavedMenu, saveMenu } from "./menu";
import { placePage, renamePageSlug, removePage } from "@shared/nav";
import { ROLES } from "@shared/roles";
import { notifyContactMessage, notifyNewRegistration, sendTestEmail, notifyOrderPaid } from "./email";
import { SITEMAP_PAGES, isPageSwitchedOn } from "@shared/seo";
import { getOrigin } from "./seo-inject";
import { getAdminPath, isDefaultPassword} from "./runtime-config";
import { invalidateSettingsCache, getSettingsSync, publicSettings } from "./site-settings";
import { cleanHtmlFields, cleanText, cleanMaybeHtml, cleanHtml, RICH_TEXT_SETTINGS } from "./sanitize";
import { csvFile, csvFilename } from "./csv";
import { SqliteSessionStore } from "./session-store";
import {
  getStoreConfig, canTakePayments, isTestMode, paymentSetupStatus,
  createCheckout, verifyWebhook, formatMoney,
} from "./payments";
import {
  priceCart, CartError, generateOrderReference, decrementStockForOrder,
  listProducts, getOrderWithItems, restockOrder, isTestOrder,
} from "./store";
import {
  getClientIP, isBlocked, recordFailedAttempt, recordSuccessfulLogin,
  formatTime, getSuspiciousIPs, unblockIP, allowFormSubmission, TRUST_PROXY,
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
            const googleEmail = profile.emails?.[0] as { value?: string; verified?: boolean } | undefined;
            const email = googleEmail?.value?.trim().toLowerCase();
            if (!email) return done(new Error("No email from Google"), undefined);

            // Find matching admin user by Google ID first, then by email
            let [user] = await db.select().from(users)
              .where(eq(users.googleId, profile.id)).limit(1);

            if (!user) {
              // Only an address Google has actually verified may claim an
              // admin account; otherwise someone could make a Google account
              // using a committee member's address and sign in as them.
              if (googleEmail?.verified !== true) return done(null, false);
              // Email addresses are case-insensitive: "Jane.Smith@x.com" typed
              // in Admin -> Users must match "jane.smith@x.com" from Google.
              [user] = await db.select().from(users)
                .where(sql`lower(trim(${users.email})) = ${email}`).limit(1);
              // Link this Google account, unless the admin is already linked
              // to a DIFFERENT one, which must not be silently replaced.
              if (user?.googleId && user.googleId !== profile.id) return done(null, false);
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
    // status 400 marks it as the admin's mistake, so the error handler in
    // index.ts shows them this sentence rather than a generic server error.
    cb(Object.assign(new Error("Only JPEG, PNG, GIF, WebP or AVIF images can be uploaded."), { status: 400 }));
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

// What the public sign-up form may send. The table's own schema only says
// "text", which let a single request store megabytes, or address the club's
// automatic reply to a list of strangers ("a@x.com, b@y.com").
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const registrationInput = insertRegistrationSchema.extend({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().refine(isEmailAddress, "Please enter a valid email address."),
  phone: optionalText(40),
  dateOfBirth: optionalText(20),
  parentName: optionalText(100),
  parentEmail: z.string().trim()
    .refine((v) => v === "" || isEmailAddress(v), "Please enter a valid parent email address.")
    .nullish(),
  parentPhone: optionalText(40),
  howHeard: optionalText(200),
  message: optionalText(5000),
  // The form won't submit without the privacy box ticked; this makes the
  // server insist too. Every saved sign-up therefore records consent given at
  // the moment in its created_at column.
  privacyConsent: z.literal(true, { errorMap: () => ({ message: "Please tick the privacy box." }) }),
});

/** A product's name and description are plain text (typed in a plain box,
 *  shown as plain text), so tags are stripped but "&" stays "&". */
function plainProductText<T extends Record<string, unknown>>(body: T): T {
  if (!body || typeof body !== "object") return body;
  const out: Record<string, unknown> = { ...body };
  for (const key of ["name", "description"]) {
    if (typeof out[key] === "string") out[key] = cleanText(out[key]);
  }
  return out as T;
}

// A password hash of nothing in particular, checked against when a login names
// a username that doesn't exist (see /api/auth/login).
const TIMING_DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString("hex"), 12);

export async function registerRoutes(app: Express) {
  const server = createServer(app);
  // Before any route: a failing async handler then answers with an error
  // instead of leaving the request hanging (see middleware.ts).
  catchAsyncErrors(app);

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
      setHeaders: (res, filePath) => {
        res.setHeader("Cache-Control", "public, max-age=86400");
        // The built-in list of file types doesn't know AVIF (an upload type we
        // accept), and with "nosniff" set a browser won't guess.
        if (filePath.toLowerCase().endsWith(".avif")) res.setHeader("Content-Type", "image/avif");
      },
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
  // Only our own proxy (on this machine by default; see TRUST_PROXY in
  // server/security.ts) is trusted to say what the visitor's address and
  // protocol were. It must NOT be blanket-true, and not "1" either: with "1",
  // someone connecting straight to the port could write their own
  // X-Forwarded-For and defeat the login lockout.
  app.set("trust proxy", TRUST_PROXY);

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

  // Logins are kept in their own small file next to the club's database (so a
  // DATABASE_URL elsewhere takes the sessions with it).
  const sessionStore = new SqliteSessionStore(
    path.join(path.dirname(process.env.DATABASE_URL ?? "./data/club.db"), "sessions.db"),
  );

  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true, // refresh the expiry on every request (sliding idle window)
      cookie: {
        // "auto": https-only whenever the visitor reached us over https (the
        // tunnel or nginx), but still usable over plain http. A fixed
        // `true` silently broke logging in from the clubhouse PC's own
        // http://<address>:5000 — the login "worked", no cookie was kept,
        // and the admin landed back on the login page every time.
        secure: "auto",
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
    const settingsMap = getSettingsSync();

    const today = new Date().toISOString().split("T")[0];
    const entry = (path: string, changefreq: string, priority: number) =>
      `  <url>\n    <loc>${origin}${path}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n    <lastmod>${today}</lastmod>\n  </url>`;
    const urls = SITEMAP_PAGES
      .filter((p) => !p.visibility || isPageSwitchedOn(settingsMap, p.visibility))
      .map((p) => entry(p.path, p.changefreq, p.priority));

    // Pages the club has made and published.
    const published = await db.select({ slug: customPages.slug }).from(customPages)
      .where(eq(customPages.isPublished, true));
    for (const p of published) urls.push(entry(`/p/${encodeURIComponent(p.slug)}`, "monthly", 0.5));

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

    // 2. Count this attempt NOW, before any slow work, so a burst of guesses
    //    sent at once can't all slip past the check above (security.ts
    //    explains). A correct password wipes the count again below.
    const attempt = recordFailedAttempt(ip);

    // Any failure (bad user, inactive, wrong password) ends here. The message
    // stays generic so attackers can't tell which part was wrong.
    const fail = (status = 401, msg = "Invalid credentials") => {
      const m = attempt.blockedUntil
        ? `Invalid credentials. Too many failed attempts — locked for ${formatTime(attempt.blockedUntil.getTime() - Date.now())}.`
        : msg;
      return res.status(status).json({ message: m });
    };

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return fail(400);

    const { username, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || !user.isActive || !user.passwordHash) {
      // Spend the same time a real password check would, so how fast the
      // answer comes back doesn't reveal which usernames exist.
      await bcrypt.compare(password, TIMING_DUMMY_HASH);
      if (user?.isActive && !user.passwordHash) return fail(401, "This account uses Google Sign-In");
      return fail();
    }

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
    // Anyone still signed in as them elsewhere is signed out; this browser
    // stays signed in.
    sessionStore.destroyForUser(user.id, req.sessionID);
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
    // Today in the club's own time zone (the server's clock), not in UTC,
    // which in Perth is still "yesterday" until 8am.
    const today = new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD
    // An event stays listed until its LAST day is over: a weekend carnival
    // should still be on the calendar on its second day.
    const rows = await db.select().from(events)
      .where(and(
        eq(events.isPublished, true),
        sql`coalesce(nullif(${events.endDate}, ''), ${events.startDate}) >= ${today}`,
      ))
      .orderBy(events.startDate).limit(100);
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
  // The latest 10 by default (the home page); the News page asks for more
  // with ?limit=, up to 200.
  app.get("/api/announcements", async (req: Request, res: Response) => {
    const asked = parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isInteger(asked) ? Math.min(Math.max(asked, 1), 200) : 10;
    const rows = await db.select().from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      .limit(limit);
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
    if (!allowFormSubmission(getClientIP(req), 40, "signup")) {
      return res.status(429).json({
        message: "Too many sign-ups from this connection. Please try again later, or email the club directly.",
      });
    }
    const parsed = registrationInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
        errors: parsed.error.issues,
      });
    }
    const { privacyConsent: _consented, ...signup } = parsed.data;

    // Save to database — happens regardless of email success
    const [row] = await db.insert(registrations).values(signup).returning();

    // Fire both emails in background: club notification + registrant auto-reply
    notifyNewRegistration({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth,
      isJunior: row.isJunior ?? false,
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      parentPhone: row.parentPhone,
      teamPreference: row.teamPreference,
      experienceLevel: row.experienceLevel,
      kidsportEligible: row.kidsportEligible ?? false,
      howHeard: row.howHeard,
      message: row.message,
    }, getOrigin(req)).catch(() => {});

    res.status(201).json({ ok: true, id: row.id });
  });

  app.get("/api/registrations", requireAuth, requirePermission("signups"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(registrations).orderBy(desc(registrations.createdAt)).limit(500);
    res.json(rows);
  });

  // A spreadsheet of every sign-up, for the registrar — and the way to hand a
  // person a copy of what the club holds about them if they ask.
  app.get("/api/registrations/export", requireAuth, requirePermission("signups"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(registrations).orderBy(desc(registrations.createdAt));
    const csv = csvFile(
      ["submitted", "status", "first_name", "last_name", "email", "phone", "date_of_birth", "junior",
        "parent_name", "parent_email", "parent_phone", "team", "experience", "subsidy_info_wanted",
        "how_heard", "message"],
      rows.map((r) => [r.createdAt, r.status, r.firstName, r.lastName, r.email, r.phone, r.dateOfBirth,
        r.isJunior ? "yes" : "no", r.parentName, r.parentEmail, r.parentPhone, r.teamPreference,
        r.experienceLevel, r.kidsportEligible ? "yes" : "no", r.howHeard, r.message]),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${csvFilename("sign-ups")}"`);
    res.send(csv);
  });

  // Deleting a sign-up or a message: for tidying up, and for when someone
  // asks the club to delete their details (which the Privacy Act expects a
  // club to be able to do).
  app.delete("/api/registrations/:id", requireAuth, requirePermission("signups"), async (req: Request, res: Response) => {
    await db.delete(registrations).where(eq(registrations.id, parseInt(req.params.id)));
    res.json({ ok: true });
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
    if (!allowFormSubmission(getClientIP(req), 10, "contact")) {
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
    if (!isEmailAddress(email)) {
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

  app.delete("/api/contact/:id", requireAuth, requirePermission("messages"), async (req: Request, res: Response) => {
    await db.delete(contactMessages).where(eq(contactMessages.id, parseInt(req.params.id)));
    res.json({ ok: true });
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
    const title = typeof req.body?.title === "string" ? cleanText(req.body.title) : req.body?.title;
    const content = cleanMaybeHtml(req.body?.content) as string;
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

  // Generous rather than unlimited: a club with years of photos still gets
  // them all, without one request being able to return an unbounded list.
  const MEDIA_LIST_LIMIT = 5000;

  app.get("/api/media", requireAuth, requirePermission("media"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(mediaUploads).orderBy(desc(mediaUploads.createdAt)).limit(MEDIA_LIST_LIMIT);
    res.json(rows);
  });

  // The public Photo Gallery. Separate from the admin list above, which needs
  // a login — the gallery used to call that one, so every visitor saw an empty
  // gallery. Only what a visitor needs is sent: no file names or uploaders.
  app.get("/api/gallery", async (_req: Request, res: Response) => {
    const rows = await db.select({
      id: mediaUploads.id, url: mediaUploads.url, caption: mediaUploads.caption,
      mimeType: mediaUploads.mimeType, createdAt: mediaUploads.createdAt,
    }).from(mediaUploads).orderBy(desc(mediaUploads.createdAt)).limit(MEDIA_LIST_LIMIT);
    res.json(rows);
  });

  /**
   * Where on the site is this photo used? In: its web address (/uploads/...).
   * Out: plain-English places, e.g. ["the club logo", 'news post "Grand Final"'].
   * Used to warn before a delete that would leave a broken image behind.
   */
  async function whereImageIsUsed(url: string): Promise<string[]> {
    const places: string[] = [];
    const settingNames: Record<string, string> = {
      club_logo_url: "the club logo", hero_image_url: "the home page photo",
    };
    for (const row of await db.select().from(siteSettings)) {
      if (row.value && row.value.includes(url)) places.push(settingNames[row.key] ?? `the "${row.key}" setting`);
    }
    for (const r of await db.select({ name: sponsors.name, logo: sponsors.logoUrl }).from(sponsors)) {
      if (r.logo === url) places.push(`sponsor "${r.name}"`);
    }
    for (const r of await db.select({ name: committeeMembers.name, photo: committeeMembers.photoUrl }).from(committeeMembers)) {
      if (r.photo === url) places.push(`committee member "${r.name}"`);
    }
    for (const r of await db.select({ name: products.name, image: products.imageUrl }).from(products)) {
      if (r.image === url) places.push(`shop item "${r.name}"`);
    }
    for (const r of await db.select({ title: announcements.title, image: announcements.featuredImageUrl, content: announcements.content }).from(announcements)) {
      if (r.image === url || (r.content ?? "").includes(url)) places.push(`news post "${r.title}"`);
    }
    for (const r of await db.select({ title: customPages.title, content: customPages.content }).from(customPages)) {
      if ((r.content ?? "").includes(url)) places.push(`page "${r.title}"`);
    }
    for (const r of await db.select({ page: pageContent.page, content: pageContent.content }).from(pageContent)) {
      if ((r.content ?? "").includes(url)) places.push(`the ${r.page} page`);
    }
    for (const r of await db.select({ content: juniorsContent.content }).from(juniorsContent)) {
      if ((r.content ?? "").includes(url)) places.push("the Juniors page");
    }
    return [...new Set(places)];
  }

  app.delete("/api/media/:id", requireAuth, requirePermission("media"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(mediaUploads).where(eq(mediaUploads.id, id)).limit(1);
    if (!row) return res.json({ ok: true });

    // A photo still in use would leave a broken image wherever it appears.
    // Say where, and only go ahead once the admin has confirmed with that
    // list in front of them (the client re-sends with ?force=1).
    if (req.query.force !== "1") {
      const usedIn = await whereImageIsUsed(row.url);
      if (usedIn.length > 0) {
        return res.status(409).json({
          message: `This photo is still used on the site: ${usedIn.join(", ")}.`,
          usedIn,
        });
      }
    }

    const { unlink } = await import("fs/promises");
    await unlink(path.join(uploadDir, row.filename)).catch(() => {});
    await db.delete(mediaUploads).where(eq(mediaUploads.id, id));
    res.json({ ok: true });
  });

  // ── Site Settings ───────────────────────────────────────────────────
  // SECURITY: /api/settings is PUBLIC (the site needs the logo, colours etc.
  // before anyone logs in), so mail credentials must never appear there.
  // They're stripped below and exposed only to super admins via
  // /api/settings/secure, with the password masked.
  // The list of what is kept private lives in server/site-settings.ts, shared
  // with the copy of the settings put into each page (runtime-config.ts).
  app.get("/api/settings", async (_req: Request, res: Response) => {
    res.json(publicSettings());
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
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ message: "Nothing to save." });
    }
    // Every setting is stored as text. Numbers and true/false are turned into
    // text; anything else (a list, an object) is a mistake and is refused, as
    // is a name that isn't a plain setting name.
    const updates: Record<string, string> = {};
    for (const [key, raw] of Object.entries(body)) {
      if (!/^[a-z0-9_]{1,64}$/.test(key)) {
        return res.status(400).json({ message: `"${key.slice(0, 40)}" isn't a setting this site has.` });
      }
      if (raw === null || raw === undefined) continue;
      if (!["string", "number", "boolean"].includes(typeof raw)) {
        return res.status(400).json({ message: `The value for ${key} wasn't text.` });
      }
      const value = String(raw);
      if (value.length > 50_000) return res.status(400).json({ message: `The value for ${key} is far too long.` });
      updates[key] = value;
    }
    // Ignore the masked placeholder so re-saving the form doesn't overwrite the
    // real SMTP password with literal asterisks.
    for (const key of ["mail_pass", "stripe_secret_key", "stripe_webhook_secret"]) {
      if (updates[key] === "********") delete updates[key];
    }
    // Settings that are displayed as formatted text get the same cleaning as
    // anything else written in the editor (see server/sanitize.ts).
    for (const key of RICH_TEXT_SETTINGS) {
      if (typeof updates[key] === "string") updates[key] = cleanHtml(updates[key]);
    }
    // All or nothing: a form that saves twenty settings must never end up
    // with only half of them changed.
    const now = new Date().toISOString();
    db.transaction((tx) => {
      for (const [key, value] of Object.entries(updates)) {
        tx.insert(siteSettings).values({ key, value })
          .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: now } })
          .run();
      }
    });
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
    if (!allowFormSubmission(getClientIP(req), 20, "newsletter")) {
      return res.status(429).json({ message: "Too many attempts. Please try again later." });
    }
    const { email, name } = req.body;
    if (!isEmailAddress(email)) return res.status(400).json({ message: "Please enter a valid email address." });
    const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : null;
    // Someone an admin removed earlier who signs up again is re-activated,
    // rather than told "done" while staying switched off.
    await db.insert(newsletterSubscribers)
      .values({ email: email.toLowerCase().trim(), name: cleanName })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: { isActive: true, ...(cleanName ? { name: cleanName } : {}) },
      });
    res.json({ ok: true });
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
    const csv = csvFile(
      ["name", "email", "subscribed_at"],
      rows.map((r) => [r.name, r.email, r.subscribedAt]),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${csvFilename("newsletter")}"`);
    res.send(csv);
  });

  // Removing a subscriber deletes their address outright. Under the Privacy
  // Act a person who asks to be removed should be, not kept on file switched
  // off; and if they sign up again later they simply rejoin.
  app.delete("/api/newsletter/subscribers/:id", requireAuth, requirePermission("newsletter"), async (req: Request, res: Response) => {
    await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, parseInt(req.params.id)));
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
    // Some sections are headings (plain text), some are editor bodies (HTML);
    // cleanMaybeHtml treats each correctly without needing to be told which.
    const content = cleanMaybeHtml(req.body?.content) as string;
    if (typeof content !== "string") return res.status(400).json({ message: "content is required" });

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
    // Say so plainly, rather than letting the database refuse the duplicate
    // and the admin see a generic server error.
    if ((await db.select({ id: users.id }).from(users).where(eq(users.username, rest.username)).limit(1)).length) {
      return res.status(400).json({ message: `There is already an admin called "${rest.username}".` });
    }
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

  // The same rules as creating an account (shared/schema.ts createUserSchema),
  // for each field an edit may change. Every field is optional.
  const editUserSchema = z.object({
    name: z.string().trim().min(1, "Name can't be blank.").max(100).optional(),
    email: z.union([z.literal(""), z.string().trim().email("That email address doesn't look right.").max(200)]).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8, "Passwords need at least 8 characters.").max(200).optional(),
  });

  app.put("/api/users/:id", requireAuth, requirePermission("users"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const parsedEdit = editUserSchema.safeParse(req.body ?? {});
    if (!parsedEdit.success) {
      return res.status(400).json({ message: parsedEdit.error.issues[0]?.message ?? "Please check the details." });
    }
    const { name, email, role, isActive, password } = parsedEdit.data;

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
    if (email !== undefined) updates.email = email.toLowerCase();
    if (role) updates.role = role;
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 12);
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: "Nothing to change." });
    const [row] = await db.update(users).set(updates).where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive });
    if (password) sessionStore.destroyForUser(id, id === req.session.userId ? req.sessionID : undefined);
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
    // All in one go, so a failure part-way can't leave half the links cleared.
    try {
      db.transaction((tx) => {
        tx.update(announcements).set({ createdBy: null }).where(eq(announcements.createdBy, id)).run();
        tx.update(events).set({ createdBy: null }).where(eq(events.createdBy, id)).run();
        tx.update(juniorsContent).set({ updatedBy: null }).where(eq(juniorsContent.updatedBy, id)).run();
        tx.update(mediaUploads).set({ uploadedBy: null }).where(eq(mediaUploads.uploadedBy, id)).run();
        tx.update(pageContent).set({ updatedBy: null }).where(eq(pageContent.updatedBy, id)).run();
        tx.update(customPages).set({ createdBy: null }).where(eq(customPages.createdBy, id)).run();
        tx.delete(users).where(eq(users.id, id)).run();
      });
      sessionStore.destroyForUser(id);
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
  // Only what the menu needs: this is fetched on every page view, so it
  // shouldn't carry every page's full text with it.
  app.get("/api/pages", async (_req: Request, res: Response) => {
    const rows = await db.select({
      id: customPages.id, slug: customPages.slug, title: customPages.title,
    }).from(customPages)
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

    // "Where in the menu" from the Pages editor goes straight into the menu,
    // so the page appears where the editor said it would.
    if (typeof req.body?.menuPlace === "string") {
      saveMenu(placePage(readSavedMenu(), row.slug, row.title, req.body.menuPlace));
    }
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

    const [before] = await db.select().from(customPages).where(eq(customPages.id, id)).limit(1);
    const [row] = await db.update(customPages)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(customPages.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Page not found" });

    // Keep the menu in step with the page:
    //  - a new web address: the menu entry follows it (it used to vanish);
    //  - a new title: the menu label follows, unless the club gave the menu
    //    entry a different name of its own in Admin -> Menu;
    //  - a place chosen in the editor: moved there.
    let menu = readSavedMenu();
    const original = JSON.stringify(menu);
    if (before && before.slug !== row.slug) menu = renamePageSlug(menu, before.slug, row.slug);
    if (before && before.title !== row.title) {
      menu = menu.map((i) => (i.key === `page:${row.slug}` && i.label === before.title ? { ...i, label: row.title } : i));
    }
    if (typeof req.body?.menuPlace === "string") menu = placePage(menu, row.slug, row.title, req.body.menuPlace);
    if (JSON.stringify(menu) !== original) saveMenu(menu);

    res.json(row);
  });

  app.delete("/api/pages/:id", requireAuth, requirePermission("pages"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [page] = await db.select().from(customPages).where(eq(customPages.id, id)).limit(1);
    await db.delete(customPages).where(eq(customPages.id, id));
    // Take it out of the menu too, rather than leaving a "missing page" entry.
    if (page) {
      const menu = readSavedMenu();
      if (menu.some((i) => i.key === `page:${page.slug}`)) saveMenu(removePage(menu, page.slug));
    }
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
    if (!isEmailAddress(to)) {
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
    // A reset usually means "someone may know the old one": sign them out
    // everywhere so the old password's logins stop working too.
    sessionStore.destroyForUser(id, id === req.session.userId ? req.sessionID : undefined);

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
    if (!allowFormSubmission(getClientIP(req), 30, "checkout")) {
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
    if (!isEmailAddress(email)) {
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

        if (!order) {
          console.warn(`[store] A confirmed payment (${event.paymentRef}) matched no order. Check the Stripe dashboard.`);
        }

        // Acted on only if no payment has been recorded yet. Stripe retries
        // webhooks and may deliver the same one twice; making the change
        // conditional, in the UPDATE itself, means stock can never be
        // decremented twice.
        //
        // "cancelled" is included on purpose. An admin may cancel an order that
        // looked abandoned while the customer was in fact still on the payment
        // page; if they then pay, the money has been taken, so the order must
        // come back to life rather than the payment being silently ignored.
        const changed = order
          ? db.update(orders).set({
              status: "paid",
              paidAt: new Date().toISOString(),
              paymentIntent: event.paymentIntent ?? null,
              shippingAddress: order.shippingAddress ?? event.shippingAddress ?? null,
            }).where(and(
              eq(orders.id, order.id),
              sql`${orders.paidAt} IS NULL`,
              inArray(orders.status, ["pending", "cancelled"]),
            )).run().changes
          : 0;

        if (order && changed > 0) {
          const warnings = decrementStockForOrder(order.id);
          if (order.status === "cancelled") {
            warnings.unshift("This order had been cancelled, but the customer then paid. Contact them to sort it out.");
          }
          if (warnings.length > 0) {
            const note = `⚠ ${warnings.join(" · ")}`;
            await db.update(orders)
              .set({ adminNotes: order.adminNotes ? `${note}\n${order.adminNotes}` : note })
              .where(eq(orders.id, order.id));
            console.warn(`[store] Order ${order.reference}: ${warnings.join("; ")}`);
          }

          const full = getOrderWithItems(order.id);
          if (full) notifyOrderPaid(full).catch(() => {});
        }
      } else if (event.kind === "expired" && event.paymentRef) {
        await db.update(orders).set({ status: "cancelled" })
          .where(and(eq(orders.paymentRef, event.paymentRef), eq(orders.status, "pending")));
      } else if (event.kind === "refunded" && event.paymentIntent) {
        const [order] = await db.select().from(orders)
          .where(eq(orders.paymentIntent, event.paymentIntent)).limit(1);
        if (order) {
          // Only a FULL refund makes the order "refunded". A partial one (one
          // jersey of two) leaves it as it was, with a note, so the order isn't
          // wrongly shown as wholly given back.
          const refunded = event.amountRefundedCents ?? 0;
          if (event.fullyRefunded || refunded >= order.totalCents) {
            await db.update(orders).set({ status: "refunded" }).where(eq(orders.id, order.id));
          } else if (refunded > 0) {
            const symbol = getSettingsSync().store_currency_symbol?.trim() || "$";
            const note = `Partly refunded: ${formatMoney(refunded, symbol)} of ${formatMoney(order.totalCents, symbol)} given back.`;
            await db.update(orders)
              .set({ adminNotes: order.adminNotes ? `${note}\n${order.adminNotes}` : note })
              .where(eq(orders.id, order.id));
          }
        }
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
    const parsed = insertProductSchema.safeParse(plainProductText(req.body));
    if (!parsed.success) return res.status(400).json({ message: "Invalid product details", errors: parsed.error.issues });
    const [row] = await db.insert(products).values(parsed.data).returning();
    res.status(201).json(row);
  });

  app.put("/api/admin/products/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const parsed = insertProductSchema.partial().safeParse(plainProductText(req.body));
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

  // Add or take away stock (the +/- buttons on the Stock screen). The change is
  // applied to whatever the stock is NOW, in the database, rather than writing
  // back a number the screen worked out from what it loaded earlier, which
  // quietly undid any online sales made since the page was opened.
  app.post("/api/admin/variants/:id/adjust", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const delta = Number(req.body?.delta);
    if (!Number.isInteger(delta) || Math.abs(delta) > 100_000) {
      return res.status(400).json({ message: "That isn't a whole number of items." });
    }
    const [row] = await db.update(productVariants)
      .set({ stock: sql`max(0, ${productVariants.stock} + ${delta})` })
      .where(and(eq(productVariants.id, parseInt(req.params.id)), sql`${productVariants.stock} IS NOT NULL`))
      .returning();
    if (!row) return res.status(404).json({ message: "That size isn't being counted." });
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
    res.json(rows.map((o) => ({ ...o, isTest: isTestOrder(o), items: lines.filter((l) => l.orderId === o.id) })));
  });

  // A spreadsheet of orders, ONE ROW PER ITEM — the shape a treasurer needs to
  // reconcile takings against the Stripe payouts, and to see what sizes
  // actually sold when ordering next season's stock.
  app.get("/api/admin/orders/export", requireAuth, requirePermission("store"), async (_req: Request, res: Response) => {
    // Test purchases made while setting up Stripe moved no real money, so they
    // are left out: this sheet has to reconcile with real Stripe payouts.
    const rows = (await db.select().from(orders).orderBy(desc(orders.createdAt))).filter((o) => !isTestOrder(o));
    const lines = await db.select().from(orderItems);

    const body: unknown[][] = [];
    for (const o of rows) {
      const items = lines.filter((l) => l.orderId === o.id);
      // An order with no lines still gets a row — otherwise it disappears from
      // the spreadsheet and the totals silently stop reconciling.
      for (const i of items.length > 0 ? items : [null]) {
        body.push([
          o.reference, o.status, o.createdAt, o.paidAt,
          o.customerName, o.customerEmail, o.customerPhone,
          o.fulfilmentMethod, o.shippingAddress,
          i?.productName ?? "", i?.variantLabel ?? "", i?.quantity ?? "",
          i ? (i.unitPriceCents / 100).toFixed(2) : "",
          i ? ((i.unitPriceCents * i.quantity) / 100).toFixed(2) : "",
          (o.shippingCents / 100).toFixed(2),
          (o.totalCents / 100).toFixed(2),
          o.currency, o.paymentIntent,
        ]);
      }
    }

    const csv = csvFile([
      "reference", "status", "ordered_at", "paid_at", "customer", "email", "phone",
      "fulfilment", "address", "item", "size", "quantity", "unit_price", "line_total",
      "order_postage", "order_total", "currency", "payment_id",
    ], body);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${csvFilename("orders")}"`);
    res.send(csv);
  });

  app.put("/api/admin/orders/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { status, adminNotes, restock } = req.body ?? {};
    const allowed = ["pending", "paid", "fulfilled", "cancelled", "refunded"];
    const update: Record<string, unknown> = {};
    if (typeof status === "string" && allowed.includes(status)) update.status = status;
    if (typeof adminNotes === "string") update.adminNotes = cleanText(adminNotes).slice(0, 2000);
    if (Object.keys(update).length === 0) return res.status(400).json({ message: "Nothing to update" });

    const [before] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!before) return res.status(404).json({ message: "Order not found" });

    const [row] = await db.update(orders).set(update).where(eq(orders.id, id)).returning();

    // Cancelling or refunding a paid order can put its items back on the
    // shelf, when the admin ticks that box (items that were never handed over,
    // or that came back). Only for an order whose stock was actually taken.
    const wasStockTaken = before.paidAt !== null && ["paid", "fulfilled"].includes(before.status);
    if (restock === true && wasStockTaken && ["cancelled", "refunded"].includes(row.status)) {
      restockOrder(id);
    }
    res.json(row);
  });

  // Delete an order outright. Only for orders that moved no real money: test
  // purchases made while setting up Stripe, and orders that were never paid.
  // A real sale is never deleted (cancel or refund it instead), so the record
  // of money taken stays complete.
  app.delete("/api/admin/orders/:id", requireAuth, requirePermission("store"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return res.json({ ok: true });

    const neverPaid = order.paidAt === null && ["pending", "cancelled"].includes(order.status);
    if (!isTestOrder(order) && !neverPaid) {
      return res.status(400).json({ message: "A real, paid order can't be deleted. Cancel or refund it instead." });
    }
    // A paid TEST order took stock when its pretend payment came through;
    // give that back so the test leaves no trace.
    if (isTestOrder(order) && order.paidAt !== null && ["paid", "fulfilled"].includes(order.status)) {
      restockOrder(id);
    }
    db.transaction((tx) => {
      tx.delete(orderItems).where(eq(orderItems.orderId, id)).run();
      tx.delete(orders).where(eq(orders.id, id)).run();
    });
    res.json({ ok: true });
  });

  return server;
}
