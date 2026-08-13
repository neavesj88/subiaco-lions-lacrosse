// =============================================================================
// THE MENU — shared/nav.ts
// =============================================================================
// WHAT THIS IS
// Works out what appears in the top menu bar, in what order, and which items
// sit together inside a dropdown.
//
// Used by BOTH the public site (to draw the menu) and the admin panel (to edit
// it), so the two can never disagree about what the menu contains.
//
// SHOULD A CLUB EDIT THIS FILE?  No.
// Everything here is editable from Admin -> Menu, without touching code.
//
// HOW THE MENU IS STORED
// As one saved setting called "nav_menu", holding a list like this:
//
//   [ { key: "home",     label: "Home",     place: "main"   },
//     { key: "calendar", label: "Calendar", place: "Club"   },
//     { key: "gallery",  label: "Photos",   place: "Club"   },
//     { key: "store",    label: "Shop",     place: "hidden" } ]
//
// "place" is the clever bit, and deliberately simple: it is either
//
//   "main"    — a button in the top bar
//   "footer"  — a link in the footer only
//   "hidden"  — not in any menu (the page still works if you know the address)
//   anything else — the NAME OF A DROPDOWN
//
// So a club creates a dropdown just by typing a name. Give three items the
// place "Teams" and a "Teams" dropdown appears containing those three. Rename
// it on all three and the dropdown renames. There is no separate "create a
// group" step to explain, and no way to end up with an empty group.
// =============================================================================

/** One entry in the menu. */
export interface NavItem {
  /** Identifies the destination. Built-in pages use a fixed key; club-created
   *  pages use "page:<slug>". */
  key: string;
  /** What the visitor sees. Editable — a club can call Fixtures "Draw". */
  label: string;
  /** "main", "footer", "hidden", or a dropdown name. See the file header. */
  place: string;
}

/** A built-in destination the site provides out of the box. */
export interface BuiltInPage {
  key: string;
  href: string;
  /** Which club-config key holds the default label. */
  labelKey: string;
  /** Which "show this page" setting controls it, if any. */
  visibilityKey?: string;
  /** True for pages that cannot be removed without breaking the site. */
  essential?: boolean;
}

/**
 * Every page the site ships with. Order here is only the starting order — a
 * club rearranges the menu in Admin -> Menu and that is what gets saved.
 */
export const BUILT_IN_PAGES: BuiltInPage[] = [
  { key: "home",          href: "/",              labelKey: "nav_label_home",          essential: true },
  { key: "about",         href: "/about",         labelKey: "nav_label_about" },
  { key: "calendar",      href: "/calendar",      labelKey: "nav_label_calendar" },
  { key: "fixtures",      href: "/fixtures",      labelKey: "nav_label_fixtures",      visibilityKey: "fixtures" },
  { key: "gallery",       href: "/gallery",       labelKey: "nav_label_gallery",       visibilityKey: "gallery" },
  { key: "store",         href: "/store",         labelKey: "nav_label_store",         visibilityKey: "store" },
  { key: "coaches_board", href: "/coaches-board", labelKey: "nav_label_coaches_board", visibilityKey: "coaches_board" },
  { key: "committee",     href: "/committee",     labelKey: "nav_label_committee",     visibilityKey: "committee" },
  { key: "juniors",       href: "/juniors",       labelKey: "nav_label_juniors",       visibilityKey: "juniors" },
  { key: "contact",       href: "/contact",       labelKey: "nav_label_contact" },
];

/**
 * The menu a club gets before they have touched anything. Matches how the site
 * has always looked: the main pages across the bar, the rest tucked into a
 * "Club" dropdown.
 */
export function defaultMenu(labelFor: (key: string) => string): NavItem[] {
  const place: Record<string, string> = {
    home: "main", about: "main", juniors: "main", contact: "main",
    calendar: "Club", fixtures: "Club", gallery: "Club",
    store: "Club", coaches_board: "Club", committee: "Club",
  };
  return BUILT_IN_PAGES.map((p) => ({
    key: p.key,
    label: labelFor(p.labelKey),
    place: place[p.key] ?? "Club",
  }));
}

/**
 * Read the saved menu, or fall back to the default.
 *
 * In: the raw "nav_menu" setting (may be missing or corrupt) and a way to look
 * up default labels. Out: a usable menu, always.
 *
 * Never throws. A menu that fails to load would leave a club with no way to
 * navigate their own site and no obvious cause, so anything unreadable falls
 * back to the standard menu instead.
 */
export function readMenu(raw: string | undefined, labelFor: (key: string) => string): NavItem[] {
  if (!raw || !raw.trim()) return defaultMenu(labelFor);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultMenu(labelFor);
    const clean = parsed.filter(
      (i): i is NavItem =>
        !!i && typeof i.key === "string" && typeof i.label === "string" && typeof i.place === "string",
    );
    return clean.length > 0 ? clean : defaultMenu(labelFor);
  } catch {
    return defaultMenu(labelFor);
  }
}

/** A page created by the club, as the menu needs to see it. */
export interface CustomPageLike {
  slug: string;
  title: string;
}

/**
 * Add any club-created pages that the saved menu doesn't mention yet.
 *
 * In: the saved menu and the club's custom pages. Out: the menu with new pages
 * appended, hidden by default.
 *
 * New pages arrive hidden rather than in the menu on purpose: a half-written
 * page appearing in the top bar the moment it is created is worse than having
 * to switch it on deliberately when it is ready.
 */
export function withCustomPages(menu: NavItem[], pages: CustomPageLike[]): NavItem[] {
  const known = new Set(menu.map((i) => i.key));
  const additions = pages
    .filter((p) => !known.has(`page:${p.slug}`))
    .map((p) => ({ key: `page:${p.slug}`, label: p.title, place: "hidden" }));
  return [...menu, ...additions];
}

/**
 * Turn the flat saved list into what the menu bar actually draws.
 *
 * In: the menu, plus a way to resolve each key to a web address and to check
 * whether a page is switched on. Out: the top-bar buttons in order, each
 * either a single link or a dropdown with children.
 *
 * Items whose page is switched off in Settings are dropped here, so a club
 * only has to turn something off in one place. A dropdown whose items have all
 * been switched off disappears rather than opening onto nothing.
 */
export function buildMenuTree(
  menu: NavItem[],
  hrefFor: (key: string) => string | null,
  isEnabled: (key: string) => boolean,
): Array<{ label: string; href?: string; children?: Array<{ label: string; href: string }> }> {
  const visible = menu.filter((i) => i.place !== "hidden" && i.place !== "footer" && isEnabled(i.key));

  const out: Array<{ label: string; href?: string; children?: Array<{ label: string; href: string }> }> = [];
  const groupIndex = new Map<string, number>();

  for (const item of visible) {
    const href = hrefFor(item.key);
    if (!href) continue;   // a page that has since been deleted

    if (item.place === "main") {
      out.push({ label: item.label, href });
      continue;
    }

    // Anything else names a dropdown. The dropdown takes its position in the
    // bar from wherever its FIRST item appears in the list, so reordering
    // items also reorders the menus they belong to.
    let at = groupIndex.get(item.place);
    if (at === undefined) {
      at = out.length;
      groupIndex.set(item.place, at);
      out.push({ label: item.place, children: [] });
    }
    out[at].children!.push({ label: item.label, href });
  }

  return out.filter((entry) => !entry.children || entry.children.length > 0);
}

/** The items a club has put in the footer. */
export function footerItems(
  menu: NavItem[],
  hrefFor: (key: string) => string | null,
  isEnabled: (key: string) => boolean,
): Array<{ label: string; href: string }> {
  return menu
    .filter((i) => i.place === "footer" && isEnabled(i.key))
    .map((i) => ({ label: i.label, href: hrefFor(i.key) ?? "" }))
    .filter((i) => i.href !== "");
}
