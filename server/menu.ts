// =============================================================================
// THE SAVED MENU, ON THE SERVER — server/menu.ts
// =============================================================================
// Reading and writing the club's menu (the "nav_menu" setting) from server
// code, so that creating, renaming or deleting a page in Admin -> Pages keeps
// the menu in step in the same request. The rules for what the menu means
// live in shared/nav.ts, used by the browser too, so the two never disagree.
//
// SHOULD A CLUB EDIT THIS FILE?  No.
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "./db";
import { customPages, siteSettings } from "@shared/schema";
import { readMenu, placePage, dropdownNames, defaultMenu, type NavItem } from "@shared/nav";
import { getSettingsSync, getSiteText, invalidateSettingsCache } from "./site-settings";

/** The club's menu as it stands (the starting menu if never saved). */
export function readSavedMenu(): NavItem[] {
  const t = getSiteText();
  return readMenu(getSettingsSync().nav_menu, (key) => t(key));
}

/** Save the menu. */
export function saveMenu(menu: NavItem[]): void {
  const value = JSON.stringify(menu);
  db.insert(siteSettings).values({ key: "nav_menu", value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date().toISOString() } })
    .run();
  invalidateSettingsCache();
}

/**
 * Where an old-style page setting ("club_menu", "main", "footer", "hidden")
 * belongs in the menu. "club_menu" means the dropdown the Calendar is in —
 * the club's own "Club" menu, whatever they now call it.
 */
function placeForOldSetting(navLocation: string | null, menu: NavItem[]): string {
  if (navLocation === "main" || navLocation === "footer" || navLocation === "hidden") return navLocation;
  const calendar = menu.find((i) => i.key === "calendar");
  if (calendar && !["main", "footer", "hidden"].includes(calendar.place)) return calendar.place;
  const t = getSiteText();
  return dropdownNames(menu)[0] ?? defaultMenu((k) => t(k)).find((i) => i.key === "calendar")!.place;
}

// =============================================================================
// ONE-TIME MOVE: pages made before the menu editor existed
// =============================================================================
// Pages used to carry their own "show it in the Club menu / main bar / footer"
// setting. The menu is now one list edited in Admin -> Menu, and a page that
// isn't in that list isn't shown — so without this, every page a club had
// already put in its menu would have silently vanished from it on upgrade.
// This copies each old setting into the menu once, then never runs again.
// =============================================================================
const FLAG = "menu_pages_placed_v1";

export function placePagesFromOldSettings(): void {
  try {
    const [flag] = db.select().from(siteSettings).where(eq(siteSettings.key, FLAG)).limit(1).all();
    if (flag?.value === "done") return;

    const pages = db.select().from(customPages).all()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    let menu = readSavedMenu();
    let placed = 0;
    for (const page of pages) {
      if (menu.some((i) => i.key === `page:${page.slug}`)) continue;
      const place = placeForOldSetting(page.navLocation, menu);
      if (place === "hidden") continue;
      menu = placePage(menu, page.slug, page.title, place);
      placed++;
    }
    if (placed > 0) saveMenu(menu);

    db.insert(siteSettings).values({ key: FLAG, value: "done" })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: "done" } }).run();
    if (placed > 0) console.log(`[menu] Added ${placed} existing page(s) to the menu where they used to appear.`);
  } catch (err) {
    console.error("[menu] Couldn't move old page menu settings:", (err as Error).message);
  }
}
