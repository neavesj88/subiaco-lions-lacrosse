// =============================================================================
// useSessionKeepalive — client/src/hooks/use-session-keepalive.ts
// =============================================================================
// Works together with the server's 2-hour sliding idle timeout (see the
// session setup in server/routes.ts).
//
// The problem it solves:
//   The server logs an admin out after 2 hours with no requests. But an admin
//   might spend a long time typing a news post WITHOUT triggering any requests
//   (typing happens purely in the browser). Without this hook they could hit
//   "Save" after 2 hours and be told they're logged out — losing their draft.
//
// What it does:
//   1. Listens for real human activity (mouse, keyboard, scroll, touch).
//   2. Every 10 minutes, IF there was activity since the last check, it pings
//      the server (/api/auth/me). That ping slides the session window forward,
//      so an actively-working admin stays logged in indefinitely.
//   3. If there was NO activity, it does nothing — so a login abandoned on a
//      shared laptop still expires after 2 idle hours, as intended.
//   4. If a ping discovers the session already expired, the auth state
//      refreshes and the admin page's existing redirect sends them to login.
// =============================================================================

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const PING_INTERVAL_MS = 10 * 60 * 1000; // check every 10 minutes

export function useSessionKeepalive(enabled: boolean) {
  const qc = useQueryClient();
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    // Record that the human is present. "passive" = never slows scrolling.
    const markActive = () => { lastActivity.current = Date.now(); };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const timer = setInterval(async () => {
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs > PING_INTERVAL_MS) return; // idle — let the session run down

      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) {
          // Session expired server-side (e.g. server restarted). Refresh the
          // cached auth state — the admin page redirects to login on null user.
          qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }
      } catch {
        // Network hiccup — ignore; next interval will try again.
      }
    }, PING_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      clearInterval(timer);
    };
  }, [enabled, qc]);
}
