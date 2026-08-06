// =============================================================================
// ADMIN NAVIGATION CONFIG — client/src/pages/admin/nav-config.ts
// =============================================================================
// Defines every section of the admin panel, grouped into meaningful categories.
//
// Why grouped: the panel grew to 14 tabs crammed into one flat row, which made
// it hard to scan and hid things like Settings behind a wrap. Grouping them
// under headings ("Content", "People & Enquiries", "Club Setup") means a
// volunteer can find the thing they want by category instead of hunting.
//
// Each section declares the PERMISSION it needs. The sidebar only renders
// sections the signed-in person is allowed to use — so a Social Media Manager
// literally sees two items, not fourteen greyed-out ones.
//
// TO ADD A SECTION: add an entry here and a matching <TabsContent> in index.tsx.
// =============================================================================

import type { Permission } from "@shared/roles";

export interface AdminSection {
  id: string;            // matches the TabsContent value
  label: string;         // sidebar label
  icon: string;          // lucide icon name, resolved in index.tsx
  permission: Permission;
  description: string;   // shown as the heading subtitle
}

export interface AdminGroup {
  name: string;
  sections: AdminSection[];
}

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    name: "Content",
    sections: [
      { id: "news", label: "News", icon: "Megaphone", permission: "news",
        description: "Announcements shown on the home page." },
      { id: "media", label: "Photos", icon: "ImageIcon", permission: "media",
        description: "The club's photo library, also shown in the public gallery." },
      { id: "pages", label: "Pages", icon: "FileText", permission: "pages",
        description: "Create and edit your own pages." },
      { id: "juniors", label: "Juniors", icon: "Star", permission: "juniors",
        description: "Text shown on the Juniors page." },
      { id: "lists", label: "Page Lists", icon: "ListIcon", permission: "lists",
        description: "Team divisions, store items and the juniors FAQ." },
    ],
  },
  {
    name: "Club Activity",
    sections: [
      { id: "events", label: "Events", icon: "Calendar", permission: "events",
        description: "The club calendar and upcoming events." },
      { id: "results", label: "Results", icon: "Trophy", permission: "results",
        description: "Match scores shown on the home page." },
      { id: "sponsors", label: "Sponsors", icon: "Heart", permission: "sponsors",
        description: "Sponsor logos shown on the home page." },
      { id: "committee", label: "Committee", icon: "Users", permission: "committee",
        description: "The President & Board page." },
    ],
  },
  {
    name: "Shop",
    sections: [
      { id: "shop", label: "Shop", icon: "ShoppingBag", permission: "store",
        description: "What's for sale, sizes, stock and how the shop takes money." },
      { id: "orders", label: "Orders", icon: "Receipt", permission: "store",
        description: "What people have bought, and what still needs handing over." },
    ],
  },
  {
    name: "People & Enquiries",
    sections: [
      { id: "signups", label: "Sign-Ups", icon: "ClipboardList", permission: "signups",
        description: "People who want to join the club." },
      { id: "messages", label: "Messages", icon: "MessageSquare", permission: "messages",
        description: "Enquiries from the contact form." },
      { id: "newsletter", label: "Newsletter", icon: "Mail", permission: "newsletter",
        description: "Email subscribers, and CSV export." },
    ],
  },
  {
    name: "Club Setup",
    sections: [
      { id: "settings", label: "Settings", icon: "Settings", permission: "settings",
        description: "Club name, colours, contact details and integrations." },
      { id: "users", label: "Admin Users", icon: "UserCog", permission: "users",
        description: "Who can log in, and what they're allowed to do." },
      { id: "security", label: "Security", icon: "Shield", permission: "security",
        description: "Email switch, password resets and lockouts." },
    ],
  },
];

// Flat list, handy for lookups.
export const ALL_SECTIONS = ADMIN_GROUPS.flatMap((g) => g.sections);
