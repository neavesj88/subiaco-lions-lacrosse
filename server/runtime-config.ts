// =============================================================================
// RUNTIME CONFIG INJECTION — server/runtime-config.ts
// =============================================================================
// Some settings need to reach the (static) frontend at runtime rather than
// being baked in at build time. The main one is the SECRET ADMIN PATH.
//
// Why a secret admin path?
//   "/admin" is the first URL anyone (or any bot) tries. Moving the admin login
//   to a non-obvious path set in .env means it's not guessable and isn't even
//   present in the public GitHub repo. This is "security through obscurity" — a
//   useful EXTRA layer on top of the real password protection, not a replacement.
//
// How it works:
//   The server injects `window.__ADMIN_PATH__ = "/your-secret"` into the HTML
//   <head> before sending it. The React app reads that global to set up its
//   admin routes. Change ADMIN_PATH in .env and restart — done.
// =============================================================================

// Returns the configured admin path, normalised to start with "/" and have no
// trailing slash. Defaults to "/manage" (still better than "/admin", but you
// SHOULD set your own secret value in .env).
export function getAdminPath(): string {
  let p = (process.env.ADMIN_PATH || "/manage").trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

// Injects the runtime config <script> into the HTML head.
export function injectRuntimeConfig(html: string): string {
  const cfg = { adminPath: getAdminPath() };
  const tag = `<script>window.__ADMIN_PATH__=${JSON.stringify(cfg.adminPath)};</script>`;
  if (html.includes("<!--RUNTIME-CONFIG-->")) {
    return html.replace("<!--RUNTIME-CONFIG-->", tag);
  }
  // Fallback: place it just before </head>
  return html.replace("</head>", `  ${tag}\n  </head>`);
}

// =============================================================================
// SEEDED ADMIN PASSWORD
// =============================================================================
// The password given to the "admin" account created by `npm run db:seed` on a
// brand new install. Set SEED_ADMIN_PASSWORD in .env before seeding to choose
// your own; otherwise the generic default below is used.
//
// Whatever it is, it's only ever a starting point: the admin panel shows a
// prominent warning banner until the account's password has been changed.
export const SEED_ADMIN_PASSWORD =
  (process.env.SEED_ADMIN_PASSWORD || "").trim() || "changeme123!";

// Passwords that count as "still the factory default" for that warning banner.
// "lions2024!" is the historical default shipped to the first club — kept here
// so their site keeps nagging them until it's changed.
const LEGACY_DEFAULT_PASSWORDS = ["lions2024!"];

/** True if `hash` matches any known factory-default password. */
export async function isDefaultPassword(
  hash: string | null | undefined,
  compare: (plain: string, hash: string) => Promise<boolean>,
): Promise<boolean> {
  if (!hash) return false;
  for (const pw of [SEED_ADMIN_PASSWORD, ...LEGACY_DEFAULT_PASSWORDS]) {
    if (await compare(pw, hash)) return true;
  }
  return false;
}
