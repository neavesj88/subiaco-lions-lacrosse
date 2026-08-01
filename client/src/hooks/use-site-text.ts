// =============================================================================
// useSiteText — client/src/hooks/use-site-text.ts
// =============================================================================
// The one hook every page uses to get club-specific wording.
//
//   const t = useSiteText();
//   t("nav_label_juniors")        → "Juniors" (or whatever the club renamed it)
//   t("page_about_title")         → "About the Club"
//   t.teamLabel("mens")           → "Men's" (or "Seniors", etc.)
//
// It resolves in this order:
//   1. the admin's saved setting  (Settings tab / setup wizard)
//   2. the default in shared/club-config.ts
//
// Because every default lives in club-config.ts, nothing club-specific should
// ever be typed directly into a page component again.
// =============================================================================

import { useSettings } from "@/hooks/use-settings";
import { CLUB_DEFAULTS, resolveText, renderTemplate, seoTemplateValues } from "@shared/club-config";

export function useSiteText() {
  const { settings } = useSettings();

  // t("key") — the main lookup.
  const t = (key: keyof typeof CLUB_DEFAULTS | string): string =>
    resolveText(settings, String(key));

  // Team category labels. The database stores fixed codes so old records never
  // break; only the displayed label is configurable.
  t.teamLabel = (code: string): string =>
    resolveText(settings, `team_label_${code}`) || code;

  // Fill {club}/{sport}/{region} placeholders — used by SEO and any copy that
  // wants the club name inline.
  t.template = (template: string): string =>
    renderTemplate(template, seoTemplateValues(settings));

  // Convenience: the club's full name, e.g. "Subiaco Lions Lacrosse Club".
  t.clubFullName = [
    resolveText(settings, "club_name"),
    resolveText(settings, "club_name_suffix"),
  ].filter(Boolean).join(" ");

  return t;
}
