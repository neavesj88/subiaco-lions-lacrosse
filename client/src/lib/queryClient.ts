import { QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      // Any save, delete or toggle that fails and doesn't handle the failure
      // itself still says so. Without this, a refused save looked exactly like
      // a successful one: nothing happened, and the change was quietly lost.
      onError: (err: unknown) => {
        toast({
          title: "That didn't save",
          description: err instanceof Error ? err.message : "Something went wrong. Try again.",
          variant: "destructive",
        });
      },
    },
  },
});

// The club's settings arrive inside the page (server/runtime-config.ts). Put
// them straight into the cache every page reads them from, so the very first
// paint already has the club's name and wording instead of the defaults.
declare global {
  interface Window { __SETTINGS__?: Record<string, string> }
}
if (typeof window !== "undefined" && window.__SETTINGS__) {
  queryClient.setQueryData(["/api/settings"], window.__SETTINGS__);
}

/** An error from the server, carrying its HTTP status and any extra detail. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown>) {
    super(message);
  }
}

export async function apiRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(err.message ?? "Request failed", res.status, err);
  }

  return res.json();
}
