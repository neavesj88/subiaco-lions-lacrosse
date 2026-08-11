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

import { getSeoForPath, getSiteName, type PageSeo } from "@shared/seo";
import { resolveText } from "@shared/club-config";

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
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:image" content="${esc(ogImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
  ].filter(Boolean).join("\n    ");
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

  // Postal address: only included when there is something real to say, and
  // only the parts the club filled in.
  const venue = get("venue_name");
  const addressLine = get("venue_address");
  if (venue || addressLine) {
    const address: Record<string, string> = { "@type": "PostalAddress", addressCountry: "AU" };
    if (venue) address.streetAddress = venue;
    if (addressLine) address.addressLocality = addressLine;
    const state = get("region_state");
    if (state) address.addressRegion = state;
    data.address = address;
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
): string {
  const seo = getSeoForPath(path, settings);
  const metaBlock = buildMetaTags(path, origin, seo, getSiteName(settings));

  // The club's own colour, so a phone's browser chrome matches the site.
  const themeColour = esc(resolveText(settings, "theme_primary") || "#7B1E32");
  const themeTag = `<meta name="theme-color" content="${themeColour}" />`;

  const block = [metaBlock, themeTag, buildStructuredData(settings, origin)]
    .filter(Boolean)
    .join("\n    ");

  if (html.includes("<!--SEO-START-->") && html.includes("<!--SEO-END-->")) {
    return html.replace(
      /<!--SEO-START-->[\s\S]*?<!--SEO-END-->/,
      `<!--SEO-START-->\n    ${block}\n    <!--SEO-END-->`,
    );
  }
  // Fallback for a page shell whose markers were removed.
  return html.replace(/<title>[\s\S]*?<\/title>/, block);
}
