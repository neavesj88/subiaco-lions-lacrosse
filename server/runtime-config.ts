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
export function injectRuntimeConfig(html: string, nonce?: string): string {
  const cfg = { adminPath: getAdminPath() };
  // The nonce marks this script as one WE wrote, so the Content Security
  // Policy in server/index.ts allows it to run while still blocking any script
  // an attacker manages to inject. Without it the admin address never reaches
  // the browser and the admin panel cannot be opened.
  const nonceAttr = nonce ? ` nonce="${nonce}"` : "";
  const tag = `<script${nonceAttr}>window.__ADMIN_PATH__=${JSON.stringify(cfg.adminPath)};</script>`;
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
// brand new install. The clubhouse installer writes a random one into .env as
// SEED_ADMIN_PASSWORD and prints it at the end; if it is blank, the seed
// script makes up a random one and prints that instead. There is deliberately
// no fixed default any more: a password written in a public repository is a
// password every bot already knows.
//
// Whatever it is, it's only ever a starting point: the admin panel shows a
// prominent warning banner until the account's password has been changed.
export const SEED_ADMIN_PASSWORD = (process.env.SEED_ADMIN_PASSWORD || "").trim();

// Passwords that count as "still the factory default" for that warning banner.
// These are the fixed defaults earlier versions shipped ("lions2024!" to the
// first club, then "changeme123!"), kept so those sites keep nagging until
// the password is changed.
const LEGACY_DEFAULT_PASSWORDS = ["changeme123!", "lions2024!"];

// Checking a password deliberately takes a fifth of a second, and the admin
// panel asks "is this still the default?" on every page load. The answer only
// changes when the password does (which changes the hash), so remember it per
// hash instead of re-checking every time.
const defaultCheckCache = new Map<string, boolean>();

/** True if `hash` matches any known factory-default password. */
export async function isDefaultPassword(
  hash: string | null | undefined,
  compare: (plain: string, hash: string) => Promise<boolean>,
): Promise<boolean> {
  if (!hash) return false;
  const known = defaultCheckCache.get(hash);
  if (known !== undefined) return known;

  let result = false;
  for (const pw of [SEED_ADMIN_PASSWORD, ...LEGACY_DEFAULT_PASSWORDS]) {
    if (pw && (await compare(pw, hash))) { result = true; break; }
  }
  if (defaultCheckCache.size > 100) defaultCheckCache.clear();
  defaultCheckCache.set(hash, result);
  return result;
}
