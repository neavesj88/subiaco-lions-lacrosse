// =============================================================================
// WHAT GOOGLE AND FACEBOOK SEE — server/seo-inject.ts
// =============================================================================
// WHAT THIS IS
// The site is a "single page app": the browser downloads one HTML file and
// JavaScript draws every page into it. That is fine for people, but Google's
// crawler and the link-preview scrapers used by Facebook, WhatsApp and Slack
// often DON'T run JavaScript. Left alone they would see the same empty page
// for every address, so every page of the club site would look identical in
// search results and every shared link would preview the same way.
//
// This file rewrites the page's title, description, share image and structured
// data on the server, before the HTML is sent, based on which page was asked
// for and on the club's own settings.
//
// SHOULD A CLUB EDIT THIS FILE?  No. Leave it alone.
// The words it inserts come from Admin -> Settings and from the wording in
// shared/club-config.ts. Change them there.
// =============================================================================

import { and, eq } from "drizzle-orm";
import { getSeoForPath, getSiteName, type PageSeo } from "@shared/seo";
import { resolveText } from "@shared/club-config";
import { readableTextOn } from "@shared/contrast";
import { customPages } from "@shared/schema";
import { db } from "./db";

/** A published page the club made, by its address (/p/<slug>), or null. */
export function publishedCustomPage(slug: string): { title: string; subtitle: string | null } | null {
  if (!slug) return null;
  try {
    const [row] = db.select({ title: customPages.title, subtitle: customPages.subtitle })
      .from(customPages)
      .where(and(eq(customPages.slug, slug), eq(customPages.isPublished, true)))
      .limit(1).all();
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Make text safe to sit inside an HTML attribute.
 * In: any string a club typed into settings. Out: the same text with the five
 * characters that could break out of an attribute turned into entities.
 * Exists because club settings are free text and end up inside content="...".
 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Make text safe to sit inside a <script type="application/ld+json"> block. */
function escJson(value: string): string {
  // JSON.stringify handles quotes and control characters. The extra replace
  // stops a value containing the literal text "</script>" from ending the
  // block early — the one way JSON-LD can become an injection point.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Build the <head> tags for one page.
 * In: the path, the site origin, the resolved SEO text, the club's name.
 * Out: an HTML string of meta tags.
 */
function buildMetaTags(
  path: string, origin: string, seo: PageSeo, siteName: string,
  settings: Record<string, string> | undefined, noindex: boolean,
): string {
  // One address per page: "/about/" and "/about" are the same page, so the
  // canonical never carries a trailing slash.
  const cleanPath = path !== "/" ? path.replace(/\/+$/, "") || "/" : "/";
  const url = origin + cleanPath;
  const t = esc(seo.title);
  const d = esc(seo.description);

  // The picture shown when the site is shared on Facebook, Messages, etc.
  // The home page photo suits the large card best; the logo is the fallback,
  // shown as a small square card so it isn't cropped. If the club has set
  // neither, no picture is claimed at all (rather than one that doesn't exist).
  const absolute = (u: string) => (/^https?:\/\//i.test(u) ? u : u.startsWith("/") ? origin + u : "");
  const hero = absolute(resolveText(settings, "hero_image_url").trim());
  const logo = absolute(resolveText(settings, "club_logo_url").trim());
  const shareImage = hero || logo;
  const card = hero ? "summary_large_image" : "summary";

  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    // Admin and checkout screens are for the people using them, not for
    // search results. Saying so in the page itself (not only once the app has
    // loaded) means search engines see it on their first look.
    noindex
      ? `<meta name="robots" content="noindex, nofollow" />`
      : `<meta name="robots" content="index, follow" />
    <link rel="canonical" href="${esc(url)}" />`,
    seo.keywords ? `<meta name="keywords" content="${esc(seo.keywords)}" />` : "",
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    shareImage ? `<meta property="og:image" content="${esc(shareImage)}" />` : "",
    `<meta name="twitter:card" content="${card}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    shareImage ? `<meta name="twitter:image" content="${esc(shareImage)}" />` : "",
  ].filter(Boolean).join("\n    ");
}

/**
 * The club's colours as a style block in the page itself, so the very first
 * paint uses them. Without it the page appears in the default maroon and gold
 * for a moment until the settings load, then changes.
 *
 * Only plain colour values are let through (#abc, #aabbcc, rgb(...),
 * hsl(...), or a colour name) and angles like "135deg", so a setting can
 * never be used to slip other CSS into the page.
 */
function themeStyle(settings: Record<string, string> | undefined): string {
  const colour = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s]+\)|[a-z]{3,20})$/i;
  const angle = /^-?[0-9]{1,3}(\.[0-9]+)?deg$/;
  const vars: string[] = [];
  const add = (key: string, cssVar: string, ok: RegExp) => {
    const value = (settings?.[key] ?? "").trim();
    if (value && ok.test(value)) vars.push(`${cssVar}:${value}`);
  };
  add("theme_primary", "--brand-primary", colour);
  add("theme_primary_dark", "--brand-primary-dark", colour);
  add("theme_accent", "--brand-accent", colour);
  add("theme_gradient_angle", "--brand-gradient-angle", angle);
  const accent = (settings?.theme_accent ?? "").trim();
  if (accent && colour.test(accent)) vars.push(`--brand-accent-text:${readableTextOn(accent)}`);
  return vars.length > 0 ? `<style>:root{${vars.join(";")}}</style>` : "";
}

/**
 * Build the "structured data" block — the machine-readable summary of the club
 * that Google uses for the map pin and business panel in local search.
 *
 * In: the club's settings. Out: a <script type="application/ld+json"> block, or
 * an empty string if the club has not entered a name yet.
 *
 * This is generated per club rather than written into index.html, because a
 * hardcoded block would publish one club's real address, email and social
 * accounts on every other club's website — bad for them and misleading to
 * Google. Fields the club has left blank are omitted rather than sent empty,
 * since an empty address is worse than no address at all.
 */
function buildStructuredData(settings: Record<string, string> | undefined, origin: string): string {
  const get = (key: string) => resolveText(settings, key).trim();

  const clubName = [get("club_name"), get("club_name_suffix")].filter(Boolean).join(" ");
  // Without a club name there is nothing meaningful to tell Google, and a
  // half-filled entry can suppress the rich result entirely.
  if (!clubName) return "";

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: clubName,
    url: origin,
  };

  const sport = get("sport_name_title");
  if (sport) data.sport = sport;

  const founded = get("club_founded");
  if (founded) data.foundingDate = founded;

  const tagline = get("club_tagline");
  if (tagline) data.description = tagline;

  const email = get("contact_email");
  if (email) data.email = email;

  // Where the club plays: only included when there is something real to say,
  // and only the parts the club filled in. The venue is a place ("Rosalie
  // Park") and the address is one free-text line, so they are given to Google
  // as exactly that, rather than forced into street/suburb boxes they don't
  // fit (which put a park's name where a street address should be).
  const venue = get("venue_name");
  const addressLine = get("venue_address");
  if (venue || addressLine) {
    const place: Record<string, string> = { "@type": "Place" };
    if (venue) place.name = venue;
    if (addressLine) place.address = addressLine;
    data.location = place;
  }

  const region = get("region_name");
  if (region) data.areaServed = region;

  // Social profiles help Google connect the website to the club's pages.
  const social = [
    get("facebook_url"),
    get("instagram_handle") ? `https://www.instagram.com/${get("instagram_handle")}/` : "",
  ].filter(Boolean);
  if (social.length > 0) data.sameAs = social;

  const json = Object.entries(data)
    .map(([k, v]) => `${escJson(k)}:${typeof v === "string" ? escJson(v) : JSON.stringify(v).replace(/</g, "\\u003c")}`)
    .join(",");

  return `<script type="application/ld+json">{${json}}</script>`;
}

/**
 * Work out the site's public web address from the incoming request.
 * In: the request. Out: e.g. "https://yourclub.org.au".
 * Reads the proxy headers because in production the site sits behind nginx or
 * a Cloudflare Tunnel, and the raw connection would otherwise look like plain
 * HTTP on localhost — which would put the wrong address in every share link.
 */
export function getOrigin(req: { headers: Record<string, any>; protocol?: string }): string {
  // The site's own address from .env, when set, beats anything a request
  // claims. Emails sent to the public use this for their links, and a request
  // sent straight to the server (not through Cloudflare) can put any name it
  // likes in its Host header.
  const configured = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^/\s]+$/i.test(configured)) return configured;

  const host = req.headers["host"] ?? "localhost:5000";
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "http";
  return `${proto}://${host}`;
}

/**
 * Put the right tags into the page before it is sent.
 * In: the raw index.html, the requested path, the site origin, the club's
 * settings. Out: the same HTML with the SEO block and structured data filled in.
 */
export function injectSeo(
  html: string, path: string, origin: string,
  settings?: Record<string, string>,
  adminPath?: string,
): string {
  let seo = getSeoForPath(path, settings);

  // A page the club made gets its own title and description, not the home
  // page's.
  const pageMatch = /^\/p\/([^/?#]+)\/?$/.exec(path);
  const custom = pageMatch ? publishedCustomPage(decodeURIComponent(pageMatch[1])) : null;
  if (custom) {
    const siteName = getSiteName(settings);
    seo = {
      title: siteName ? `${custom.title} | ${siteName}` : custom.title,
      description: custom.subtitle || seo.description,
    };
  }

  const noindex =
    (!!adminPath && (path === adminPath || path.startsWith(adminPath + "/"))) ||
    path.startsWith("/store/");
  const metaBlock = buildMetaTags(path, origin, seo, getSiteName(settings), settings, noindex);

  // The club's own colour, so a phone's browser chrome matches the site.
  const themeColour = esc(resolveText(settings, "theme_primary") || "#7B1E32");
  const themeTag = `<meta name="theme-color" content="${themeColour}" />`;

  const block = [metaBlock, themeTag, themeStyle(settings), buildStructuredData(settings, origin)]
    .filter(Boolean)
    .join("\n    ");

  // A FUNCTION as the replacement, not a string: in a replacement string "$&",
  // "$'" and "$$" are instructions, so a club tagline like "Pay $5 at the
  // gate, it's $$ well spent" used to splice copies of the page into itself.
  if (html.includes("<!--SEO-START-->") && html.includes("<!--SEO-END-->")) {
    return html.replace(
      /<!--SEO-START-->[\s\S]*?<!--SEO-END-->/,
      () => `<!--SEO-START-->\n    ${block}\n    <!--SEO-END-->`,
    );
  }
  // Fallback for a page shell whose markers were removed.
  return html.replace(/<title>[\s\S]*?<\/title>/, () => block);
}
