// =============================================================================
// SETTINGS CACHE — server/site-settings.ts
// =============================================================================
// Loads the club's settings for server-side use, mainly so the SEO tags
// injected into the HTML use the right club name, sport and region.
//
// Why cached: every page request needs these, but they change rarely (only
// when an admin saves Settings). A short cache avoids a database read on every
// single page load while still picking changes up quickly.
// =============================================================================

import { db } from "./db";
import { siteSettings } from "@shared/schema";
import { resolveText } from "@shared/club-config";

let cache: Record<string, string> | null = null;
let cachedAt = 0;
const TTL_MS = 30_000; // refresh at most every 30 seconds

/** All settings as a plain key/value map. Falls back to {} if the DB errors. */
export function getSettingsSync(): Record<string, string> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;
  try {
    const rows = db.select().from(siteSettings).all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    cache = map;
    cachedAt = now;
    return map;
  } catch {
    return cache ?? {};
  }
}

/** Call after an admin saves settings so changes appear immediately. */
export function invalidateSettingsCache(): void {
  cache = null;
}

/**
 * The server-side twin of the client's useSiteText() hook.
 *
 * Use it anywhere the server produces text a person will read — email
 * templates especially — so those read as the club's own name, sport and
 * venue instead of hardcoded ones.
 *
 *   const t = getSiteText();
 *   t("club_name")   → "Subiaco Lions"
 *   t.clubFullName   → "Subiaco Lions Lacrosse Club"
 */
export function getSiteText() {
  const settings = getSettingsSync();
  const t = (key: string) => resolveText(settings, key);
  t.clubFullName = [resolveText(settings, "club_name"), resolveText(settings, "club_name_suffix")]
    .filter(Boolean)
    .join(" ");
  return t;
}
