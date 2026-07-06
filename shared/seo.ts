// =============================================================================
// SEO CONFIG — shared/seo.ts
// =============================================================================
// Central per-route SEO metadata, shared by BOTH the client and the server.
//
// Why shared?
//   - The client (<SEO> component) uses it to update the page title/description
//     as the user navigates between pages.
//   - The server uses it to inject the correct <title> + Open Graph tags into
//     the HTML *before* it's sent — so Google's crawler and social scrapers
//     (Facebook, WhatsApp, LinkedIn, etc.), which don't run JavaScript, still
//     see proper per-page titles, descriptions and share previews.
//
// To add SEO for a new page: add an entry to PAGE_SEO keyed by its path.
// =============================================================================

export const SITE_NAME = "Subiaco Lions Lacrosse Club";

// Default/fallback metadata used when a route isn't listed below.
export const DEFAULT_SEO = {
  title: "Subiaco Lions Lacrosse Club | Perth Lacrosse",
  description:
    "Subiaco Lions Lacrosse Club — Perth's home of lacrosse since 1940 at Rosalie Park, Shenton Park. Men's, Women's and Junior teams. New players welcome, loan equipment available.",
  keywords:
    "Subiaco lacrosse, lacrosse Perth, lacrosse Western Australia, junior lacrosse Perth, Subiaco Lions, lacrosse club Perth, Rosalie Park lacrosse, learn lacrosse Perth",
};

export interface PageSeo {
  title: string;
  description: string;
  keywords?: string;
}

// Per-route metadata. Keys are the URL paths.
export const PAGE_SEO: Record<string, PageSeo> = {
  "/": {
    title: "Subiaco Lions Lacrosse Club | Perth Lacrosse Since 1940",
    description:
      "Join the Subiaco Lions — Perth's longest-running lacrosse club. Men's, Women's and Junior teams at Rosalie Park, Shenton Park. All skill levels welcome, loan gear provided.",
    keywords: DEFAULT_SEO.keywords,
  },
  "/about": {
    title: "About the Club | Subiaco Lions Lacrosse",
    description:
      "Founded in 1940, the Subiaco Lions are one of WA's most successful lacrosse clubs. Learn our history, teams and what makes the Lions a Perth lacrosse institution.",
    keywords: "Subiaco lacrosse history, lacrosse club Perth, Lacrosse WA club, about Subiaco Lions",
  },
  "/calendar": {
    title: "Club Calendar | Subiaco Lions Lacrosse",
    description:
      "Upcoming games, training sessions and club events for Subiaco Lions Lacrosse Club. Stay up to date with everything happening at the club.",
    keywords: "Subiaco lacrosse training times, lacrosse fixtures Perth, club calendar",
  },
  "/fixtures": {
    title: "Fixtures & Results | Subiaco Lions Lacrosse",
    description:
      "Game schedules, scores and ladders for all Subiaco Lions teams across Men's, Women's and Junior divisions, hosted on GameDay and Lacrosse WA.",
    keywords: "Subiaco lacrosse fixtures, lacrosse results Perth, Lacrosse WA ladder, GameDay lacrosse",
  },
  "/gallery": {
    title: "Photo Gallery | Subiaco Lions Lacrosse",
    description:
      "Match day moments, training sessions and club life at the Subiaco Lions Lacrosse Club. Browse our photo gallery.",
    keywords: "Subiaco lacrosse photos, lacrosse club gallery Perth",
  },
  "/juniors": {
    title: "Junior Lacrosse Programs (U11–U17) | Subiaco Lions",
    description:
      "Junior lacrosse for boys and girls aged 8–17 in Perth. Fun, safe and inclusive programs with loan equipment and KidSport support. Register your child with the Subiaco Lions.",
    keywords:
      "junior lacrosse Perth, kids lacrosse Perth, lacrosse for children WA, KidSport lacrosse, U11 U13 U15 U17 lacrosse, youth lacrosse Subiaco",
  },
  "/store": {
    title: "Club Store | Subiaco Lions Lacrosse",
    description:
      "Official Subiaco Lions Lacrosse Club apparel and equipment — playing kit, training gear, hoodies, caps and more.",
    keywords: "Subiaco lacrosse merchandise, lacrosse apparel Perth, club kit",
  },
  "/sign-up": {
    title: "Join the Lions — Sign Up to Play Lacrosse | Subiaco Lions",
    description:
      "New to lacrosse? Join the Subiaco Lions. No experience needed, loan equipment provided, all ages welcome. Register your interest and we'll be in touch within 48 hours.",
    keywords:
      "join lacrosse Perth, learn lacrosse, play lacrosse WA, lacrosse beginners Perth, sign up lacrosse Subiaco",
  },
  "/coaches-board": {
    title: "Coaches Board — Tactical Whiteboard | Subiaco Lions Lacrosse",
    description:
      "Free interactive lacrosse tactical whiteboard from the Subiaco Lions. Draw plays, position players and plan set pieces — works on phones and tablets, even offline.",
    keywords: "lacrosse whiteboard, lacrosse tactics board, lacrosse coaching app, lacrosse play designer",
  },
  "/contact": {
    title: "Contact Us | Subiaco Lions Lacrosse Club",
    description:
      "Get in touch with the Subiaco Lions Lacrosse Club. Questions about joining, junior programs or sponsorship? Find us at Rosalie Park, Shenton Park WA.",
    keywords: "contact Subiaco lacrosse, lacrosse club Perth contact, Rosalie Park lacrosse",
  },
};

// Returns the SEO metadata for a given path, falling back to DEFAULT_SEO.
export function getSeoForPath(path: string): PageSeo {
  // Normalise trailing slash (except root)
  const clean = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  return PAGE_SEO[clean] ?? DEFAULT_SEO;
}

// Public pages that should appear in the sitemap, with crawl priority.
// (Admin pages are intentionally excluded.)
export const SITEMAP_PAGES: { path: string; priority: number; changefreq: string }[] = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/about", priority: 0.7, changefreq: "monthly" },
  { path: "/juniors", priority: 0.9, changefreq: "monthly" },
  { path: "/sign-up", priority: 0.9, changefreq: "monthly" },
  { path: "/calendar", priority: 0.8, changefreq: "weekly" },
  { path: "/fixtures", priority: 0.8, changefreq: "weekly" },
  { path: "/gallery", priority: 0.5, changefreq: "weekly" },
  { path: "/store", priority: 0.5, changefreq: "monthly" },
  { path: "/coaches-board", priority: 0.5, changefreq: "monthly" },
  { path: "/contact", priority: 0.6, changefreq: "yearly" },
];
