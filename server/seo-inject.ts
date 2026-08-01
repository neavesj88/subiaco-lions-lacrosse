// =============================================================================
// SERVER-SIDE SEO INJECTION — server/seo-inject.ts
// =============================================================================
// The site is a single-page app, so the same index.html is served for every
// route. That's bad for SEO and social sharing: Google's crawler and the
// scrapers used by Facebook/WhatsApp/LinkedIn/Slack often DON'T run JavaScript,
// so they'd see the same generic title/description for every page.
//
// This module rewrites the <title>, <meta description>, Open Graph and Twitter
// tags in the HTML based on the requested URL, *before* the page is sent. So a
// link to /juniors shared on Facebook shows the juniors title + description,
// not the homepage's. Real users get the right tags immediately too (the
// client <SEO> component then keeps them correct as they navigate).
//
// Used by both dev (vite middleware) and production (static serving).
// =============================================================================

import { getSeoForPath, getSiteName, type PageSeo } from "@shared/seo";

// Escape text so it's safe inside an HTML attribute
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Build the <head> meta block for a given path + site origin
function buildMetaTags(path: string, origin: string, seo: PageSeo, siteName: string): string {
  const url = origin + path;
  const ogImage = origin + "/og-image.jpg";
  const t = esc(seo.title);
  const d = esc(seo.description);

  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    seo.keywords ? `<meta name="keywords" content="${esc(seo.keywords)}" />` : "",
    `<link rel="canonical" href="${esc(url)}" />`,
    // Open Graph
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:image" content="${esc(ogImage)}" />`,
    // Twitter
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
  ].filter(Boolean).join("\n    ");
}

// Work out the site origin from the incoming request (respects proxy headers
// so it's correct behind nginx/Cloudflare in production).
export function getOrigin(req: { headers: Record<string, any>; protocol?: string }): string {
  const host = req.headers["host"] ?? "localhost:5000";
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "http";
  return `${proto}://${host}`;
}

// Take the raw index.html and replace the default <title>/<meta description>
// with route-specific SEO tags. The base index.html should contain a marker
// comment <!--SEO--> where these tags go (we also strip the default title).
// `settings` are the club's saved settings — they fill the {club}/{sport}
// placeholders in the SEO templates so the metadata matches whichever club is
// running the site.
export function injectSeo(
  html: string, path: string, origin: string,
  settings?: Record<string, string>,
): string {
  const seo = getSeoForPath(path, settings);
  const metaBlock = buildMetaTags(path, origin, seo, getSiteName(settings));

  // Replace everything between the SEO markers if present, else replace the
  // default <title> tag. Using markers keeps the base HTML clean and explicit.
  if (html.includes("<!--SEO-START-->") && html.includes("<!--SEO-END-->")) {
    return html.replace(
      /<!--SEO-START-->[\s\S]*?<!--SEO-END-->/,
      `<!--SEO-START-->\n    ${metaBlock}\n    <!--SEO-END-->`
    );
  }
  // Fallback: replace the first <title>…</title>
  return html.replace(/<title>[\s\S]*?<\/title>/, metaBlock);
}
