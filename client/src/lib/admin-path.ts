// =============================================================================
// ADMIN PATH (client) — client/src/lib/admin-path.ts
// =============================================================================
// The admin section lives at a secret path configured server-side (ADMIN_PATH
// in .env) and injected into the page as window.__ADMIN_PATH__ — see
// server/runtime-config.ts. Every client reference to the admin area reads from
// here so changing the path in .env is the only change needed.
// =============================================================================

declare global {
  interface Window {
    __ADMIN_PATH__?: string;
  }
}

// The base admin path, e.g. "/manage" (falls back to "/admin" only if the
// server somehow didn't inject the global — shouldn't happen in practice).
export const ADMIN_PATH =
  (typeof window !== "undefined" && window.__ADMIN_PATH__) || "/admin";

// The login page lives under the admin path, e.g. "/manage/login".
export const ADMIN_LOGIN_PATH = `${ADMIN_PATH}/login`;
