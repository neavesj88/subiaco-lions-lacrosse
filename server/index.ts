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

import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Parse JSON and URL-encoded request bodies (needed for all API routes)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Security headers (production only) ──────────────────────────────────────
// These headers protect against common web attacks.
// They're only applied in production because they can interfere with dev tools.
if (process.env.NODE_ENV === "production") {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Frame-Options", "DENY");           // Prevents clickjacking
    res.setHeader("X-Content-Type-Options", "nosniff"); // Prevents MIME sniffing
    res.setHeader("X-XSS-Protection", "1; mode=block"); // Older browser XSS protection
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

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

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured) line += ` :: ${JSON.stringify(captured)}`.slice(0, 80);
      log(line);
    }
  });

  next();
});

// ── Start up ─────────────────────────────────────────────────────────────────
(async () => {
  // Register all API routes and get back the HTTP server instance
  const server = await registerRoutes(app);

  // Global error handler — catches any unhandled errors from route handlers
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as Error).message ?? "Internal Server Error";
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    // Development: Vite runs inside Express so you get React hot reload
    await setupVite(app, server);
  } else {
    // Production: serve the pre-built React app from dist/public
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT ?? "5000");
  server.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
