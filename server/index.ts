// =============================================================================
// SERVER ENTRY POINT — server/index.ts
// =============================================================================
// What this file does:
//   Starts the Express web server. In development it also runs Vite (the tool
//   that compiles the React frontend) as middleware so you get hot reload.
//   In production it serves the pre-built static files instead.
//
// How to run:
//   Development:  npm run dev        (starts on port 5000 with hot reload)
//   Production:   npm run build      (builds everything)
//                 npm start          (serves the built files)
//
// Architecture:
//   Browser → Express → API routes (/api/*)
//                      → React app (everything else, served as index.html)
// =============================================================================

// Load .env FIRST, before anything else looks at process.env.
//
// Without this the .env file is just a text file nobody reads: the admin page
// address, the session secret, the Google sign-in keys and the mail settings
// documented in .env.example would all be silently ignored, and the site would
// quietly run on its built-in defaults instead.
import "dotenv/config";

import { randomBytes } from "crypto";

import express, { type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { backfillSanitiseContent, backfillPlainText } from "./backfill";

const app = express();

// Squash everything on the way out. The site's main JavaScript file is about
// 305 KB as written and about 96 KB compressed — a third of the download for
// one line of setup. That difference is barely noticeable on clubhouse wi-fi
// and very noticeable to a parent checking fixtures on a phone at a ground
// with one bar of signal, which is who this site is really for.
//
// Worth keeping even when Cloudflare sits in front and compresses too: this
// also shrinks the traffic between the club's computer and Cloudflare, and a
// club running without any of that still gets the benefit.
app.use(compression());

// Parse JSON and URL-encoded request bodies (needed for all API routes).
//
// The `verify` step keeps a copy of the untouched bytes for the payment
// webhook. Stripe signs the EXACT text it sends, so once JSON.parse has turned
// it into an object the original text can't be reconstructed reliably —
// re-serialising it changes spacing and key order, and the signature check
// then fails. Only that one route needs it, so only that one route is stored.
app.use(express.json({
  verify: (req, _res, buf) => {
    if ((req as Request).originalUrl?.startsWith("/api/store/webhook")) {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: false }));

// ── Security headers ────────────────────────────────────────────────────────
// Headers are instructions to the browser about what this page is allowed to
// do. They are the cheapest protection available, and they matter more here
// than on a normal site because the people running a club website cannot be
// expected to spot an attack themselves.
//
// SHOULD A CLUB EDIT THIS?  No — unless you add a new embedded service.
// If you embed something new (a different maps provider, a fixtures widget)
// and it silently refuses to appear, its address needs adding to the matching
// line in the policy below. That is the ONE thing here a club might ever need
// changed, and it needs someone technical.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // The Coaches Board is a self-contained tool (one HTML file with its own
  // inline script and styles) that the site shows inside a frame on its
  // /coaches-board page. It gets a policy of its own: it may be framed by
  // this site only, and may run its own inline code, but still loads nothing
  // from anywhere else. Everything else keeps the strict policy below.
  if (req.path === "/coaches-board.html") {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "manifest-src data:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "));
    return next();
  }

  res.setHeader("X-Frame-Options", "DENY");

  // Switch off browser features this site never uses, so a future bug or a
  // compromised third-party embed cannot quietly reach for them.
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );

  // A random one-off token that marks OUR inline script as trusted. Anything
  // injected into the page by an attacker will not have it, so the browser
  // refuses to run it. Generated per request — a fixed value would be useless.
  const nonce = randomBytes(16).toString("base64");
  (res.locals as { cspNonce?: string }).cspNonce = nonce;

  const isDev = process.env.NODE_ENV !== "production";

  // Content Security Policy: an allow-list of where the page may load things
  // from. Each line below names a real feature of this site — remove one and
  // that feature stops working.
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Images: the club's own uploads, plus any image URL an admin pastes into
    // a news post, plus data: URIs used by inline icons.
    "img-src 'self' data: https:",
    // Google Fonts serves the site's typeface as a stylesheet plus font files.
    // 'unsafe-inline' for styles is a deliberate compromise: React and the
    // Tailwind build both set style attributes, and removing it would break
    // the club's own colour settings. Inline STYLES cannot execute code, so
    // this is far less dangerous than inline scripts, which are blocked.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Scripts: only this site's own files, plus the one inline settings script
    // carrying the nonce above, plus the Instagram feed widget if a club has
    // switched it on.
    //
    // DEVELOPMENT IS DIFFERENT, and has to be. The dev server (Vite) injects
    // its own inline scripts for hot-reloading, which it does not put our
    // nonce on. Blocking them stops React starting at all and every page comes
    // up blank — which is exactly what happened when this policy was first
    // added and only the production build was tested.
    //
    // Relaxing it here is safe: the dev server only ever runs on a developer's
    // own machine. The strict policy above is what a club's visitors get.
    isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://w.behold.so`
      : `script-src 'self' 'nonce-${nonce}' https://w.behold.so`,
    // The Instagram widget fetches the posts themselves from feeds.behold.so.
    isDev
      ? "connect-src 'self' ws: wss: https://w.behold.so https://feeds.behold.so"   // ws: is the hot-reload channel
      : "connect-src 'self' https://w.behold.so https://feeds.behold.so",
    // Instagram video posts play from Instagram's own servers.
    "media-src 'self' https:",
    // Embedded panels: the site's own Coaches Board, the map on the contact
    // page, an embedded Google Calendar, and the Instagram feed.
    "frame-src 'self' https://www.google.com https://calendar.google.com https://w.behold.so",
  ].join("; "));

  // HSTS tells browsers to only ever reach this site over HTTPS. Set only in
  // production and only on an HTTPS request: sending it during local
  // development would lock "localhost" into HTTPS in your browser for months
  // and make the site unreachable while you work on it.
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

// ── Request logger ───────────────────────────────────────────────────────────
// Logs every API request to the console: method, path, status code, duration.
// Useful for debugging — only logs /api/* routes, not static file requests.
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let captured: Record<string, unknown> | undefined;

  const orig = res.json.bind(res);
  res.json = function (body, ...args) {
    captured = body;
    return orig(body, ...args);
  };

  // Routes whose response contents must never reach a log file. Logs get
  // copied around, pasted into support emails and kept for months, so account
  // details and mail settings have no business sitting in them.
  const SENSITIVE = ["/api/auth", "/api/settings", "/api/users", "/api/security"];

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      // Only an ERROR's reply is added, because that is what helps diagnose a
      // problem. A successful reply can be a list of sign-ups — children's
      // names, parents' emails and phone numbers — which must not end up in
      // the log.
      if (captured && res.statusCode >= 400 && !SENSITIVE.some((p) => path.startsWith(p))) {
        line += ` :: ${JSON.stringify(captured)}`.slice(0, 80);
      }
      log(line);
    }
  });

  next();
});

// ── Last-resort crash guards ─────────────────────────────────────────────────
// Express's error handler only catches errors thrown while handling a request.
// An error from an async callback (e.g. a failed database write) escapes it and
// would kill the Node process — taking the whole club website offline until
// someone SSHs in and restarts it.
//
// These guards log the problem and keep serving. PM2 would restart the process
// anyway, but staying up means visitors never see an outage at all.
process.on("uncaughtException", (err) => {
  console.error("[fatal] Uncaught exception — server kept alive:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] Unhandled promise rejection — server kept alive:", reason);
});

// ── Start up ─────────────────────────────────────────────────────────────────
(async () => {
  // One-time tidy-up of content saved before HTML sanitising existed.
  // Does nothing on every startup after the first.
  backfillSanitiseContent();
  backfillPlainText();

  // Register all API routes and get back the HTTP server instance
  const server = await registerRoutes(app);

  // An /api/ address that doesn't exist answers in the same JSON the admin
  // panel understands, rather than falling through to the website's page.
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ message: "That isn't something this site can do." });
  });

  if (app.get("env") === "development") {
    // Development: Vite runs inside Express so you get React hot reload
    await setupVite(app, server);
  } else {
    // Production: serve the pre-built React app from dist/public
    serveStatic(app);
  }

  // Global error handler, last so it also catches errors from the page
  // handlers above. A problem with the request (4xx) is explained to the
  // admin; a fault on the server (5xx) is logged here and the browser gets a
  // plain sentence, not the database's own wording.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { status?: number; name?: string; code?: string; message?: string };
    let status = e.status ?? 500;
    let message = e.message ?? "Something went wrong.";
    if (e.name === "MulterError") {
      status = e.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      if (e.code === "LIMIT_FILE_SIZE") message = "That image is over 8 MB. Make it smaller and try again.";
    }
    if (status >= 500) {
      console.error("[error]", err);
      message = "Something went wrong on the server. Try again, and if it keeps happening check the server log.";
    }
    if (res.headersSent) return;
    res.status(status).json({ message });
  });

  const port = parseInt(process.env.PORT ?? "5000");
  server.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
