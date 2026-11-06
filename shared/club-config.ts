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
  club_name_suffix: "",                  // e.g. "Netball Club" — the smaller second line
  club_short_name: "Club",               // used in casual copy, e.g. "Join the Club"
  club_tagline: "[[{region}'s ]]home of {sport}. Teams competing across all divisions.",
  club_founded: "",                      // year the club started (blank = not shown)

  // ── The sport ─────────────────────────────────────────────────────────────
  // Swapping these makes the site read as netball, hockey, football, etc.
  sport_name: "sport",                   // lowercase, used mid-sentence
  sport_name_title: "Sport",             // capitalised, used in headings
  venue_word: "ground",                  // "ground" / "court" / "pitch" / "rink"

  // ── Where the club plays ──────────────────────────────────────────────────
  venue_name: "",                        // e.g. "Kingsford Oval" (blank = hidden)
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
  nav_label_news: "News",
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
  page_about_subtitle: "[[{region}'s ]]{sport} club — proud history, strong community.",
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
  home_hero_tagline: "[[{region}'s ]]home of {sport}. Men's, Women's and Junior teams[[ playing out of {venue}]].",
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
  // A plain starter that reads as real copy, not instructions: visitors see it
  // until the club writes its own story (by clicking the pencil on this text
  // while logged in). Each club's own history lives in their database.
  about_history_body:
    "<p>{club} is a community {sport} club[[ based at {venue}]]. New players and families are always welcome — whether you've played before or never picked up the game.</p>",
  about_teams_title: "Our Teams",
  about_teams_subtitle: "[[Competing across all divisions of {league}. ]]New players welcome at every level.",
  about_find_us_title: "Find Us",
  // Quick facts on the About page. A fact with no value isn't shown, so these
  // start blank: a new club must never display another club's founding year.
  // Fact 1 shows the "Year founded" from the setup wizard when left blank.
  about_stat1_label: "Founded",
  about_stat1_value: "",
  about_stat2_label: "Teams",
  about_stat2_value: "",
  about_stat3_label: "Divisions",
  about_stat3_value: "",
  about_stat4_label: "Home Ground",
  // The name of a government scheme that helps families with junior fees
  // (KidSport in WA, Active Kids in NSW…). Blank: no scheme is mentioned on
  // the sign-up form, the Juniors page or in emails.
  subsidy_name: "",

  // ── Store page ────────────────────────────────────────────────────────────
  store_apparel_title: "Available Apparel",
  store_ordering_title: "Ordering Information",

  // ── Shop wording ──────────────────────────────────────────────────────────
  // Every word a customer sees while buying. All editable so a club can talk
  // about "merch", "kit" or "uniform" in their own voice.
  // ── Privacy wording ───────────────────────────────────────────────────────
  // Shown on the sign-up form, which collects children's names, dates of birth
  // and their parents' contact details. Australian privacy expectations (and
  // most clubs' own child-safe policies) require telling people what you
  // collect and why BEFORE they hand it over. Edit the wording to match your
  // club's policy; do not delete it.
  privacy_signup_notice:
    "We collect these details only to contact you about joining {club} and to register players with our league. " +
    "For junior players we ask for a parent or guardian's details so we always have a responsible adult to contact. " +
    "We do not sell or share your details with anyone else, and you can ask us to delete them at any time by emailing {email}.",
  privacy_consent_label:
    "I understand how {club} will use these details, and if this is for a child under 18 I am their parent or guardian.",
  privacy_contact_notice:
    "We use your details only to reply to this message.",

  store_add_to_cart: "Add to cart",
  store_sold_out: "Sold out",
  store_out_of_stock_size: "Out of stock",
  store_low_stock: "Only {n} left",
  store_choose_size: "Choose a size",
  store_cart_title: "Your order",
  store_cart_empty: "Nothing in your order yet.",
  store_cart_checkout: "Checkout",
  store_cart_continue: "Keep shopping",
  store_subtotal: "Subtotal",
  store_shipping_line: "Postage",
  store_total: "Total",
  store_checkout_title: "Checkout",
  store_checkout_subtitle: "Just your details, then you'll be taken to our payment provider.",
  store_pickup_option: "Collect at the club",
  store_pickup_note: "We'll let you know when it's ready to collect.",
  store_shipping_option: "Post it to me",
  store_pay_button: "Pay securely",
  store_secure_note: "Payment is handled by Stripe. Your card details never touch this website.",
  store_thanks_title: "Thanks — your order is confirmed",
  store_thanks_body: "We've emailed you a confirmation. Your order reference is {ref}.",
  store_cancelled_title: "Payment cancelled",
  store_cancelled_body: "Nothing has been charged. Your order is still here if you'd like to try again.",
  store_enquiry_note: "Contact us to order — full online ordering is coming soon.",
  store_closed_note: "The club shop is closed at the moment.",

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme_primary: "#7B1E32",
  theme_primary_dark: "#3A0C17",
  theme_accent: "#C5942A",
  theme_gradient_angle: "135deg",

  // ── SEO ───────────────────────────────────────────────────────────────────
  // {club}, {sport}, {region} are replaced at runtime — so SEO stays correct
  // for any club without anyone editing meta tags.
  seo_title_suffix: "{club}",
  seo_home_title: "{club}[[ | {region} {sportTitle} Club]]",
  seo_default_description:
    "{club} — {sport}[[ in {region}, {state}]]. Men's, Women's and Junior teams. New players welcome.",
  seo_keywords:
    "{club}, {sport} {region}, {sport} club, junior {sport} {region}, play {sport}",
};

/** Fill {club}/{sport}/{region} style placeholders from resolved settings. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  // Anything wrapped in [[double brackets]] is dropped completely when a
  // placeholder inside it has no value. This exists because every club detail
  // is optional, and without it a club that hasn't entered their ground gets
  // sentences like "Teams playing out of ." on their own home page.
  //
  // For a club editing this wording in the admin panel: put the words that
  // only make sense WITH the detail inside the brackets.
  //   "[[{region}'s ]]home of {sport}"
  //     region filled in -> "Perth's home of lacrosse"
  //     region blank     -> "home of lacrosse"
  const withOptionals = template.replace(/\[\[(.*?)\]\]/g, (_m, segment: string) => {
    const placeholders = segment.match(/\{(\w+)\}/g) ?? [];
    const anyMissing = placeholders.some((ph) => !(values[ph.slice(1, -1)] ?? "").trim());
    return anyMissing ? "" : segment;
  });

  // Only placeholders this function knows are filled (blank if empty). Any
  // other {word} is left as it is, because the page using the text fills it
  // in itself: {email} in the privacy notice, {n} "left in stock", {ref} on
  // the thank-you page. Blanking those here left sentences ending "by
  // emailing ." and "Only  left".
  const filled = withOptionals.replace(/\{(\w+)\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] ?? "" : m);

  // Tidy up after any placeholder outside a bracketed segment that came out
  // empty, so nothing reaches a browser tab or a Google result looking broken.
  return filled
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([|–—-])\s*+/g, "$1")
    .replace(/^[\s|–—-]+|[\s|–—-]+$/g, "")
    .trim();
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

// Keys that FEED the placeholders. Their values are returned exactly as
// written, because filling {club} in from club_name — which is itself one of
// these — would chase its own tail.
//
// The consequence, and it has bitten once: a default in this list must NEVER
// contain a {placeholder}, because nothing will ever replace it and the raw
// text appears on the live site. club_name_suffix defaulted to
// "{sportTitle} Club", so every brand-new club's page title read
// "Our Club {sportTitle} Club" until they finished the setup wizard.
// assertNoPlaceholders() at the bottom of this file stops the server
// starting if it happens again, so it is caught before anyone sees the site.
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

// Runs once when this file is first loaded — which on the server means the
// moment it starts up, so a bad default stops the site booting rather than
// reaching a club's visitors. Verified by deliberately breaking a default and
// confirming the server refuses to start.
//
// Note this is a STARTUP check, not a build-time one: the bundler never
// executes the module, so `npm run build` will not catch it.
(function assertNoPlaceholders() {
  for (const key of IDENTITY_KEYS) {
    const value = CLUB_DEFAULTS[key];
    if (typeof value === "string" && value.includes("{")) {
      throw new Error(
        `club-config: the default for "${key}" contains a {placeholder}, but ` +
        `identity keys are never templated, so it would appear literally on ` +
        `the live site. Write it out in full, or leave it blank.`,
      );
    }
  }
})();
