// =============================================================================
// usePageContent hook — client/src/hooks/use-page-content.ts
// =============================================================================
// Fetches all editable text sections for a given page from the database.
//
// Usage:
//   const { get } = usePageContent("about");
//   <p>{get("history_1", "Default text if nothing saved yet")}</p>
//
// The get() function always returns something — either the saved DB value or
// the fallback default you provide. This means pages work even before any
// admin has touched the content.
// =============================================================================

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function usePageContent(page: string) {
  const qc = useQueryClient();

  const { data: content = {} } = useQuery<Record<string, string>>({
    queryKey: [`/api/page-content/${page}`],
    queryFn: () => apiRequest("GET", `/api/page-content/${page}`),
    staleTime: 30_000,
  });

  // get(section, fallback) — returns saved content or the fallback default
  const get = (section: string, fallback = "") => content[section] ?? fallback;

  // save(section, value) — persists a section to the database
  const save = async (section: string, value: string) => {
    await apiRequest("PUT", `/api/page-content/${page}/${section}`, { content: value });
    qc.invalidateQueries({ queryKey: [`/api/page-content/${page}`] });
  };

  return { content, get, save };
}
