import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { injectSeo, getOrigin } from "./seo-inject";
import { injectRuntimeConfig } from "./runtime-config";
import { getSettingsSync } from "./site-settings";

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
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      // Inject per-route SEO tags so dev matches production behaviour
      template = injectSeo(template, url.split("?")[0], getOrigin(req), getSettingsSync());
      template = injectRuntimeConfig(template);
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
  app.use(express.static(distPath, { index: false }));

  // SPA catch-all: serve index.html but inject per-route SEO tags first so
  // crawlers/social scrapers see the correct title + description for each page.
  const indexPath = path.resolve(distPath, "index.html");
  const baseHtml = fs.readFileSync(indexPath, "utf-8");
  app.use("*", (req, res) => {
    let html = injectSeo(baseHtml, req.originalUrl.split("?")[0], getOrigin(req), getSettingsSync());
    html = injectRuntimeConfig(html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
