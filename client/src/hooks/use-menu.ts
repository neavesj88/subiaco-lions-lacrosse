// =============================================================================
// THE MENU, READY TO DRAW — client/src/hooks/use-menu.ts
// =============================================================================
// WHAT THIS IS
// One place that works out the club's menu, so the top bar, the mobile menu
// and the footer all show the same thing. Before this existed each of them had
// its own hardcoded list, which is how they drifted apart.
//
// SHOULD A CLUB EDIT THIS FILE?  No. Edit your menu in Admin -> Menu.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSettings } from "@/hooks/use-settings";
import { useSiteText } from "@/hooks/use-site-text";
import {
  BUILT_IN_PAGES, readMenu, withCustomPages, buildMenuTree, footerItems,
  type NavItem,
} from "@shared/nav";
import type { CustomPage } from "@shared/schema";

export function useMenu() {
  const { settings, pageEnabled } = useSettings();
  const t = useSiteText();

  const { data: customPages = [] } = useQuery<CustomPage[]>({
    queryKey: ["/api/pages"],
    queryFn: () => apiRequest("GET", "/api/pages"),
    staleTime: 60_000,
  });

  // Saved menu, plus any pages the club has created since it was last saved.
  const menu: NavItem[] = withCustomPages(
    readMenu(settings?.nav_menu, (key) => t(key)),
    customPages.map((p) => ({ slug: p.slug, title: p.title })),
  );

  /** Where does this menu entry lead? null if the page no longer exists. */
  const hrefFor = (key: string): string | null => {
    if (key.startsWith("page:")) {
      const slug = key.slice(5);
      return customPages.some((p) => p.slug === slug) ? `/p/${slug}` : null;
    }
    return BUILT_IN_PAGES.find((p) => p.key === key)?.href ?? null;
  };

  /** Is this page switched on? Club-created pages are on if they're published. */
  const isEnabled = (key: string): boolean => {
    if (key.startsWith("page:")) return true;   // unpublished ones never reach us
    const page = BUILT_IN_PAGES.find((p) => p.key === key);
    if (!page) return false;
    return page.visibilityKey ? pageEnabled(page.visibilityKey) : true;
  };

  return {
    menu,
    /** Top-bar entries: single links and dropdowns, in the club's own order. */
    tree: buildMenuTree(menu, hrefFor, isEnabled),
    /** Everything in the top bar, flattened — what the mobile menu shows.
     *  Footer-only links stay in the footer, as they do on a computer. */
    flat: menu
      .filter((i) => i.place !== "hidden" && i.place !== "footer" && isEnabled(i.key))
      .map((i) => ({ label: i.label, href: hrefFor(i.key) ?? "" }))
      .filter((i) => i.href !== ""),
    footer: footerItems(menu, hrefFor, isEnabled),
    hrefFor,
    isEnabled,
  };
}
