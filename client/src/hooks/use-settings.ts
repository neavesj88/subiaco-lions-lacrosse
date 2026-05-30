// =============================================================================
// useSettings hook — client/src/hooks/use-settings.ts
// =============================================================================
// Fetches site settings from /api/settings and exposes a helper to check
// whether a page/feature is enabled.
//
// The page visibility settings are stored in the database as:
//   nav_show_gallery   = "true" | "false"
//   nav_show_store     = "true" | "false"
//   nav_show_fixtures  = "true" | "false"
//   nav_show_results   = "true" | "false"
//   nav_show_sponsors  = "true" | "false"
//   nav_show_newsletter= "true" | "false"
//
// Admins toggle these in Admin → Settings → Page Visibility.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useSettings() {
  const { data: settings = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
    staleTime: 60_000, // Cache for 1 minute — settings don't change often
  });

  // pageEnabled("gallery") returns true unless the setting is explicitly "false"
  // Default is always ON so new pages are visible without needing a DB row
  const pageEnabled = (key: string) => settings[`nav_show_${key}`] !== "false";

  return { settings, isLoading, pageEnabled };
}
