// =============================================================================
// ROLES & PERMISSIONS — shared/roles.ts
// =============================================================================
// One place that decides who can do what. Used by BOTH the server (to enforce
// access) and the admin UI (to decide which tabs to show), so they can never
// disagree.
//
// Two kinds of role:
//
//   LADDER ROLES — each level includes everything below it. Good for the
//   traditional "the president can do more than the secretary" structure.
//       content_manager  <  juniors_coordinator  <  club_admin  <  super_admin
//
//   RESTRICTED ROLES — sit OUTSIDE the ladder and unlock only specific areas.
//   A Social Media Manager logs in and sees ONLY News and Media — nothing else,
//   no matter what. This is impossible with a ladder, because a ladder role
//   automatically inherits every lower level.
//
// TO ADD A PERMISSION: add it to the Permission list, then grant it in
// ROLE_PERMISSIONS. Nothing else needs changing.
// =============================================================================

export const ROLES = [
  "super_admin",
  "club_admin",
  "juniors_coordinator",
  "content_manager",
  "social_media",
] as const;

export type Role = (typeof ROLES)[number];

// Every distinct thing an admin can be allowed to do.
export type Permission =
  | "news"        // write/edit news posts
  | "media"       // upload and manage photos
  | "events"      // club calendar
  | "results"     // match results
  | "signups"     // view sign-up enquiries (personal data)
  | "messages"    // contact form messages
  | "sponsors"    // sponsor logos
  | "newsletter"  // subscriber list
  | "juniors"     // juniors page content
  | "committee"   // president & board page
  | "pages"       // create/edit custom pages
  | "lists"       // team divisions, store items, FAQ
  | "store"       // shop products, prices, stock and customer orders
  | "settings"    // club details, colours, email config
  | "users"       // manage admin accounts
  | "security";   // email kill-switch, lockouts, password resets

// Exactly what each role can do. Ladder roles are written out in full rather
// than computed, so it's obvious at a glance who gets what.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Full access to everything.
  super_admin: [
    "news", "media", "events", "results", "signups", "messages", "sponsors",
    "newsletter", "juniors", "committee", "pages", "lists", "store", "settings",
    "users", "security",
  ],

  // Runs the club day to day. Everything except user management and security.
  club_admin: [
    "news", "media", "events", "results", "signups", "messages", "sponsors",
    "newsletter", "juniors", "committee", "pages", "lists", "store", "settings",
  ],

  // Looks after the juniors program, plus general content.
  juniors_coordinator: ["news", "media", "juniors"],

  // Writes news and manages photos.
  content_manager: ["news", "media"],

  // RESTRICTED: social posts only. Deliberately identical to content_manager
  // today, but kept separate so the club can widen or narrow one without
  // affecting the other (e.g. later giving social media access to the gallery
  // but not club news).
  social_media: ["news", "media"],
};

// Friendly labels + descriptions for the admin UI.
export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  super_admin: {
    label: "Super Admin",
    description: "Full access, including admin accounts, security and all settings.",
  },
  club_admin: {
    label: "Club Admin",
    description: "Runs the site day to day — events, results, sign-ups, sponsors, pages, the shop and club settings.",
  },
  juniors_coordinator: {
    label: "Juniors Coordinator",
    description: "Manages the Juniors page, plus news posts and photos.",
  },
  content_manager: {
    label: "Content Manager",
    description: "Writes news posts and manages the photo library.",
  },
  social_media: {
    label: "Social Media Manager",
    description: "Posts news and manages photos only — sees nothing else in the admin panel.",
  },
};

/** Does this role have this permission? The single source of truth. */
export function roleHas(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  return !!perms && perms.includes(permission);
}
