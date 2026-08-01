// =============================================================================
// CLUB CONFIG — shared/club-config.ts
// =============================================================================
// THE single source of truth for every piece of club-specific wording on the
// site: club name, page names, headings, sport terminology, league links, SEO.
//
// WHY THIS FILE EXISTS
//   Previously these strings were scattered across ~20 files, so making the
//   site work for a different club meant hunting through code. Everything now
//   has exactly one default here, and every default can be overridden by an
//   admin from Settings (stored in the site_settings table).
//
//   Resolution order, everywhere on the site:
//       admin's saved setting  →  the default below
//
// THE DEFAULTS ARE CLUB-NEUTRAL
//   Nothing below names a real club. Anything that must differ per club is
//   either blank (the feature using it hides itself) or a {placeholder}
//   template filled in from the club's own name, sport and region — so a brand
//   new install reads correctly as soon as the setup wizard is done.
//
//   Existing clubs are unaffected: their real values live in their own
//   site_settings table and always win over the defaults below.
//
// TO MAKE SOMETHING ELSE EDITABLE
//   Add it to CLUB_DEFAULTS with a settings key, then read it through
//   useSiteText() (client) or getSiteText() (server). Never hardcode a
//   club-specific string in a page again.
// =============================================================================

/**
 * Every configurable string, keyed by its settings key.
 * Grouped only for readability — it's a flat key/value map at runtime.
 */
export const CLUB_DEFAULTS: Record<string, string> = {
  // ── Club identity ─────────────────────────────────────────────────────────
  club_name: "Our Club",
  club_name_suffix: "{sportTitle} Club",
  club_short_name: "Club",               // used in casual copy, e.g. "Join the Club"
  club_tagline: "{region}'s home of {sport}. Teams competing across all divisions.",
  club_founded: "",                      // year the club started (blank = not shown)

  // ── The sport ─────────────────────────────────────────────────────────────
  // Swapping these makes the site read as netball, hockey, football, etc.
  sport_name: "sport",                   // lowercase, used mid-sentence
  sport_name_title: "Sport",             // capitalised, used in headings
  venue_word: "ground",                  // "ground" / "court" / "pitch" / "rink"

  // ── Where the club plays ──────────────────────────────────────────────────
  venue_name: "",                        // e.g. "Rosalie Park" (blank = hidden)
  venue_address: "",
  map_query: "",                         // blank hides the embedded map
  region_name: "",                       // city/region, used in SEO copy
  region_state: "",

  // ── Contact & social ──────────────────────────────────────────────────────
  // All blank — each belongs to one club's own accounts, and every UI element
  // that uses them is hidden while they are empty.
  contact_email: "",
  facebook_url: "",
  instagram_handle: "",

  // ── Governing body / league ───────────────────────────────────────────────
  // Any club has "a league we play in" and often a third-party "fixtures
  // provider". Both are blank until the club fills them in.
  league_name: "",
  league_url: "",
  fixtures_provider_name: "GameDay",
  // Blank by default: these point at one specific club's pages on third-party
  // sites, so every club must supply their own in Admin → Settings. The links
  // that use them stay hidden while they are empty.
  gameday_url: "",
  lacrossewa_fixtures_url: "",
  gameday_registration_url: "https://membership.mygameday.app/regoform.cgi?formID=101320",

  // ── Team category labels ──────────────────────────────────────────────────
  // The database stores fixed codes (mens/womens/juniors) so existing records
  // never break. These are only the LABELS shown to people, so a club can
  // display "Seniors"/"Reserves"/"Juniors" or anything else.
  team_label_mens: "Men's",
  team_label_womens: "Women's",
  team_label_juniors: "Juniors",
  team_label_all: "All Teams",

  // ── Page names (navigation + headings) ────────────────────────────────────
  nav_label_home: "Home",
  nav_label_about: "About",
  nav_label_calendar: "Calendar",
  nav_label_fixtures: "Fixtures",
  nav_label_gallery: "Photo Gallery",
  nav_label_store: "Store",
  nav_label_coaches_board: "Coaches Board",
  nav_label_juniors: "Juniors",
  nav_label_committee: "President & Board",
  nav_label_contact: "Contact",
  nav_label_signup: "Join Up",
  nav_label_club_menu: "Club",            // the dropdown's own label

  // ── Page hero headings & subtitles ────────────────────────────────────────
  // (Admins can also edit these inline via the hover-pencil; these are what
  // shows before anyone has.)
  page_about_title: "About the Club",
  page_about_subtitle: "{region}'s {sport} club — proud history, strong community.",
  page_fixtures_title: "Fixtures & Results",
  page_fixtures_subtitle: "Game schedules and results for all our teams.",
  page_gallery_title: "Photo Gallery",
  page_gallery_subtitle: "Match day moments, training sessions and club life.",
  page_store_title: "Club Store",
  page_store_subtitle: "Official club apparel and equipment.",
  page_juniors_title: "Juniors",
  page_juniors_subtitle:
    "Introducing the next generation. Fun, safe and inclusive for boys and girls aged 8–17.",
  page_committee_title: "President & Board",
  page_committee_subtitle: "The volunteers who run the club.",
  page_contact_title: "Contact Us",
  page_contact_subtitle:
    "Questions about joining, junior programs, sponsorship or anything else — we'd love to hear from you.",
  page_calendar_title: "Club Calendar",
  page_calendar_subtitle: "Games, training and social events for all teams.",
  page_signup_title: "Join the {clubShort}",
  page_signup_subtitle:
    "New to the game? No worries — we provide a welcoming environment for all skill levels.",
  signup_what_to_bring:
    "Just runners and a water bottle. Let us know if you need to borrow gear for your first few sessions.",
  signup_all_welcome:
    "Teams for all ages and abilities. Complete beginners are especially welcome.",

  // ── Home page ─────────────────────────────────────────────────────────────
  home_hero_title: "{clubName}",
  home_hero_tagline: "{region}'s home of {sport}. Men's, Women's and Junior teams playing out of {venue}.",
  home_strip_line2: "Men's · Women's · Juniors",
  home_strip_line3: "All skill levels welcome · Loan equipment available",
  home_news_heading: "Club News",
  home_events_heading: "Upcoming Events",
  home_results_heading: "Recent Results",
  home_cta_heading: "Ready to Join the {clubShort}?",
  home_cta_text:
    "No experience needed. All ages welcome. Loan equipment available for new players.",

  // ── About page ────────────────────────────────────────────────────────────
  about_history_title: "Our History",
  // Placeholder prompt, not real history — every club replaces this from
  // Admin → Pages → About. Subiaco's own history is stored in their database.
  about_history_body:
    "<p>Tell your club's story here. When was it founded, and by whom? What are the moments members still talk about?</p><p>Edit this text in Admin → Pages → About. A few short paragraphs works best — visitors mostly want to know who you are and that they'd be welcome.</p>",
  about_teams_title: "Our Teams",
  about_teams_subtitle: "Competing across all divisions of {league}. New players welcome at every level.",
  about_find_us_title: "Find Us",
  about_stat1_label: "Founded",
  about_stat1_value: "1940",
  about_stat2_label: "Teams",
  about_stat2_value: "10+",
  about_stat3_label: "Divisions",
  about_stat3_value: "State to Div 3",
  about_stat4_label: "Home Ground",

  // ── Store page ────────────────────────────────────────────────────────────
  store_apparel_title: "Available Apparel",
  store_ordering_title: "Ordering Information",

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme_primary: "#7B1E32",
  theme_primary_dark: "#3A0C17",
  theme_accent: "#C5942A",
  theme_gradient_angle: "135deg",

  // ── SEO ───────────────────────────────────────────────────────────────────
  // {club}, {sport}, {region} are replaced at runtime — so SEO stays correct
  // for any club without anyone editing meta tags.
  seo_title_suffix: "{club}",
  seo_home_title: "{club} | {region} {sportTitle} Club",
  seo_default_description:
    "{club} — {sport} in {region}, {state}. Men's, Women's and Junior teams. New players welcome.",
  seo_keywords:
    "{club}, {sport} {region}, {sport} club, junior {sport} {region}, play {sport}",
};

/** Fill {club}/{sport}/{region} style placeholders from resolved settings. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => values[key] ?? "");
}

/**
 * Resolve a config value: the admin's saved setting wins, otherwise the
 * default above. Used by both the client hook and the server helper so they
 * can never disagree.
 */
export function resolveText(
  settings: Record<string, string> | undefined,
  key: string,
): string {
  const saved = settings?.[key];
  const raw = (saved !== undefined && saved !== null && String(saved).trim() !== "")
    ? String(saved)
    : (CLUB_DEFAULTS[key] ?? "");

  // Any value — default OR admin-supplied — may use {club}, {sport}, {region}
  // etc. so copy stays correct when a club renames itself. Guarded against
  // recursion: the identity keys themselves are never templated.
  if (!raw.includes("{") || IDENTITY_KEYS.has(key)) return raw;
  return renderTemplate(raw, seoTemplateValues(settings));
}

// Keys that feed the placeholders — templating these would recurse.
const IDENTITY_KEYS = new Set([
  "club_name", "club_name_suffix", "club_short_name",
  "sport_name", "sport_name_title", "region_name", "region_state", "venue_name",
  "league_name",
]);

/** Values available to SEO templates, built from the resolved settings. */
export function seoTemplateValues(settings?: Record<string, string>) {
  const club = [resolveText(settings, "club_name"), resolveText(settings, "club_name_suffix")]
    .filter(Boolean).join(" ");
  return {
    club,
    clubShort: resolveText(settings, "club_short_name"),
    sport: resolveText(settings, "sport_name"),
    sportTitle: resolveText(settings, "sport_name_title"),
    region: resolveText(settings, "region_name"),
    state: resolveText(settings, "region_state"),
    venue: resolveText(settings, "venue_name"),
    clubName: resolveText(settings, "club_name"),
    league: resolveText(settings, "league_name"),
  };
}
