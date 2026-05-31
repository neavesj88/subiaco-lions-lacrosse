// =============================================================================
// useListItems hook — client/src/hooks/use-list-items.ts
// =============================================================================
// Fetches the active rows for a given list type from /api/list-items/:type.
// Used by public pages to render admin-managed lists:
//   "team_division" → team divisions (About, Fixtures)
//   "store_item"    → store apparel cards
//   "faq"           → juniors FAQ
//
// Returns { items, isLoading }. If the DB has no rows the page can fall back
// to its own hardcoded defaults.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ListItem } from "@shared/schema";

export function useListItems(listType: string) {
  const { data: items = [], isLoading } = useQuery<ListItem[]>({
    queryKey: [`/api/list-items/${listType}`],
    queryFn: () => apiRequest("GET", `/api/list-items/${listType}`),
    staleTime: 30_000,
  });
  return { items, isLoading };
}
