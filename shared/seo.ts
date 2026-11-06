// =============================================================================
// SEO CONFIG — shared/seo.ts
// =============================================================================
// Per-page titles and descriptions, written as TEMPLATES rather than fixed
// text so they stay correct for whatever club is running the site.
//
// Placeholders filled at runtime from the club's settings:
//   {club}       full club name          e.g. "Riverside Rovers Netball Club"
//   {clubShort}  short name              e.g. "Lions"
//   {sport}      lowercase sport         e.g. "lacrosse"
//   {sportTitle} capitalised sport       e.g. "Lacrosse"
//   {region}     city/region             e.g. "Perth"
//   {state}      state                   e.g. "WA"
//   {venue}      home ground             e.g. "Kingsford Oval"
//
// The server injects the finished tags into the HTML before sending it, so
// Google and social scrapers (which don't run JavaScript) see the right
// per-page metadata. See server/seo-inject.ts.
// =============================================================================

import { CLUB_DEFAULTS, renderTemplate, seoTemplateValues } from "./club-config";

export interface PageSeo {
  title: string;
  description: string;
  keywords?: string;
}

// Templates. Nothing here names a specific club or sport.
export const PAGE_SEO: Record<string, PageSeo> = {
  "/": {
    title: "{club}[[ | {region} {sportTitle}]]",
    description:
      "{club} — {sport}[[ in {region}]][[, {state}]]. Men's, Women's and Junior teams. All skill levels welcome.",
  },
  "/about": {
    title: "About the Club | {club}",
    description:
      "Learn about {club} — our history, our teams, and what makes us part of the[[ {region}]] {sport} community.",
    keywords: "{club} history, {sport} club[[ {region}]], about {clubShort}",
  },
  "/calendar": {
    title: "Club Calendar | {club}",
    description:
      "Upcoming games, training sessions and club events for {club}. Stay up to date with everything happening at the club.",
    keywords: "{club} training times, {sport} fixtures[[ {region}]], club calendar",
  },
  "/fixtures": {
    title: "Fixtures & Results | {club}",
    description:
      "Game schedules, scores and ladders for all {club} teams across Men's, Women's and Junior divisions.",
    keywords: "{club} fixtures, {sport} results[[ {region}]], {sport} ladder",
  },
  "/news": {
    title: "Club News | {club}",
    description: "The latest news and announcements from {club}.",
    keywords: "{club} news, {sport} club news[[ {region}]]",
  },
  "/gallery": {
    title: "Photo Gallery | {club}",
    description: "Match day moments, training sessions and club life at {club}. Browse our photo gallery.",
    keywords: "{club} photos, {sport} club gallery[[ {region}]]",
  },
  "/juniors": {
    title: "Junior {sportTitle} Programs | {club}",
    description:
      "Junior {sport} for boys and girls[[ in {region}]]. Fun, safe and inclusive programs with loan equipment available. Register your child with {club}.",
    keywords:
      "junior {sport}[[ {region}]], kids {sport}[[ {region}]], {sport} for children[[ {state}]], youth {sport}",
  },
  "/store": {
    title: "Club Store | {club}",
    description: "Official {club} apparel and equipment — playing kit, training gear and supporter merchandise.",
    keywords: "{club} merchandise, {sport} apparel[[ {region}]], club kit",
  },
  "/sign-up": {
    title: "Join Us — Sign Up to Play {sportTitle} | {club}",
    description:
      "New to {sport}? Join {club}. No experience needed, loan equipment provided, all ages welcome. Register your interest today.",
    keywords:
      "join {sport}[[ {region}]], learn {sport}, play {sport}[[ {state}]], {sport} beginners[[ {region}]]",
  },
  "/coaches-board": {
    title: "Coaches Board — Tactical Whiteboard | {club}",
    description:
      "Interactive {sport} tactical whiteboard from {club}. Draw plays, position players and plan set pieces — works on phones and tablets.",
    keywords: "{sport} whiteboard, {sport} tactics board, {sport} coaching app",
  },
  "/committee": {
    title: "President & Board | {club}",
    description: "Meet the committee behind {club} — our President, board members and coaches.",
    keywords: "{club} committee, {sport} club president[[ {region}]], club board",
  },
  "/contact": {
    title: "Contact Us | {club}",
    description:
      "Get in touch with {club}. Questions about joining, junior programs or sponsorship?[[ Find us at {venue}.]]",
    keywords: "contact {club}, {sport} club[[ {region}]] contact[[, {venue}]]",
  },
};

/**
 * Returns the SEO for a path with all placeholders filled from the club's
 * settings. Pass the settings map (server) or leave undefined to use defaults.
 */
export function getSeoForPath(path: string, settings?: Record<string, string>): PageSeo {
  const clean = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  const values = seoTemplateValues(settings);

  const tpl = PAGE_SEO[clean] ?? {
    title: CLUB_DEFAULTS.seo_home_title,
    description: CLUB_DEFAULTS.seo_default_description,
    keywords: CLUB_DEFAULTS.seo_keywords,
  };

  return {
    title: renderTemplate(tpl.title, values),
    description: renderTemplate(tpl.description, values),
    keywords: tpl.keywords ? renderTemplate(tpl.keywords, values) : undefined,
  };
}

/** The site name used in Open Graph tags. */
export function getSiteName(settings?: Record<string, string>): string {
  return seoTemplateValues(settings).club;
}

// Public pages for the sitemap, with crawl priority. `visibility` names the
// Page Visibility switch (Admin -> Settings) that turns the page off.
export const SITEMAP_PAGES: { path: string; priority: number; changefreq: string; visibility?: string }[] = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/about", priority: 0.7, changefreq: "monthly" },
  { path: "/news", priority: 0.7, changefreq: "weekly" },
  { path: "/juniors", priority: 0.9, changefreq: "monthly", visibility: "juniors" },
  { path: "/sign-up", priority: 0.9, changefreq: "monthly" },
  { path: "/calendar", priority: 0.8, changefreq: "weekly" },
  { path: "/fixtures", priority: 0.8, changefreq: "weekly", visibility: "fixtures" },
  { path: "/gallery", priority: 0.5, changefreq: "weekly", visibility: "gallery" },
  { path: "/store", priority: 0.5, changefreq: "monthly", visibility: "store" },
  { path: "/coaches-board", priority: 0.5, changefreq: "monthly", visibility: "coaches_board" },
  { path: "/committee", priority: 0.4, changefreq: "yearly", visibility: "committee" },
  { path: "/contact", priority: 0.6, changefreq: "yearly" },
];

/** Is a Page Visibility switch on? Pages are on unless switched off. */
export function isPageSwitchedOn(settings: Record<string, string> | undefined, key: string): boolean {
  return (settings ?? {})[`nav_show_${key}`] !== "false";
}

/** The pages under /store/ (the shop's own steps). */
const STORE_STEPS = ["/store/checkout", "/store/thank-you", "/store/cancelled"];

/**
 * Does this web address correspond to a real page on the site?
 *
 * In: a path like "/juniors" or "/p/sponsorship", the admin address, the
 * club's settings, and a way to ask whether a club-made page exists. Out: true
 * if the site can actually show something there.
 *
 * Used by the server to decide whether to answer 404 instead of 200. Without
 * it every mistyped address returns "page found" with a Not Found message on
 * it, which search engines index as a real page and link checkers never flag.
 * A page switched off under Page Visibility counts as not there.
 */
export function isKnownPath(
  path: string,
  adminPath?: string,
  settings?: Record<string, string>,
  customPageExists?: (slug: string) => boolean,
): boolean {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";

  const builtIn = SITEMAP_PAGES.find((p) => p.path === clean);
  if (builtIn) return !builtIn.visibility || isPageSwitchedOn(settings, builtIn.visibility);
  if (STORE_STEPS.includes(clean)) return isPageSwitchedOn(settings, "store");
  if (clean.startsWith("/p/")) {
    const slug = clean.slice(3);
    return customPageExists ? customPageExists(slug) : slug.length > 0;
  }
  if (adminPath && (clean === adminPath || clean.startsWith(adminPath + "/"))) return true;

  return false;
}
