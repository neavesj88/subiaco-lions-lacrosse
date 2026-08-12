import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { injectSeo, getOrigin } from "./seo-inject";
import { injectRuntimeConfig, getAdminPath } from "./runtime-config";
import { getSettingsSync } from "./site-settings";
import { isKnownPath } from "@shared/seo";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      // Cache-buster so the browser always fetches the freshest source during
      // development. A timestamp is enough here — this only ever runs in dev,
      // and it saves carrying a whole dependency for one random string.
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${Date.now()}"`,
      );
      // Inject per-route SEO tags so dev matches production behaviour
      template = injectSeo(template, url.split("?")[0], getOrigin(req), getSettingsSync());
      template = injectRuntimeConfig(template, res.locals.cspNonce);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Build directory not found: ${distPath}. Run 'npm run build' first.`);
  }
  // Serve built assets (JS/CSS/images) normally.
  //
  // index: false is important. By default express.static answers a request for
  // "/" with index.html straight off the disk — which would skip the catch-all
  // below, so the HOME PAGE alone would miss its SEO tags and runtime config
  // while every other page got them. Turning that off leaves "/" to the
  // catch-all, so every page is treated identically.
  app.use(express.static(distPath, {
    index: false,

    // Vite stamps a content hash into every built filename, e.g.
    // index-GP5p0aEW.js. Change the code and the name changes with it, so a
    // browser can safely keep the old one forever and will simply ask for the
    // new name after an update. Without this every visit re-checks every file
    // with the server before using it, which is pure delay on a slow phone.
    //
    // "immutable" tells the browser not to bother re-checking even on a manual
    // refresh. index.html is deliberately NOT covered here — it is built fresh
    // for every request by the catch-all below, and caching it would freeze a
    // club's page titles and settings.
    setHeaders: (res, filePath) => {
      if (/[.-][A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|avif)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  // SPA catch-all: serve index.html but inject per-route SEO tags first so
  // crawlers/social scrapers see the correct title + description for each page.
  const indexPath = path.resolve(distPath, "index.html");
  const baseHtml = fs.readFileSync(indexPath, "utf-8");
  app.use("*", (req, res) => {
    const path = req.originalUrl.split("?")[0];
    let html = injectSeo(baseHtml, path, getOrigin(req), getSettingsSync());
    html = injectRuntimeConfig(html, res.locals.cspNonce);

    // Answer 404 for addresses that aren't real pages. The SAME page is still
    // sent — the app shows its Not Found screen — but the status code now tells
    // the truth, so search engines drop mistyped links instead of indexing them
    // and broken-link checkers actually report them.
    const status = isKnownPath(path, getAdminPath()) ? 200 : 404;

    // Never cache this page. It is rebuilt on every request with the club's
    // current settings and a fresh one-time security token, so a stored copy
    // would eventually serve stale titles and a token the browser rejects.
    res.status(status).set({
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    }).end(html);
  });
}
