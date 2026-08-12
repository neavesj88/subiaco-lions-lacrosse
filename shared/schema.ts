// =============================================================================
// DATABASE SCHEMA — shared/schema.ts
// =============================================================================
// What this file does:
//   Defines every database table using Drizzle ORM.
//   Shared between the server (reads/writes) and client (TypeScript types).
//
// Tables:
//   users                Admin users with roles
//   events               Club calendar events
//   registrations        Sign-up enquiries from the public form
//   announcements        News/posts with rich text, images, pinning
//   juniors_content      Editable text sections on the Juniors page
//   site_settings        Key-value store: Instagram ID, store URL, page toggles, etc.
//   contact_messages     Messages from the Contact page
//   media_uploads        Every image uploaded via the Media Library
//   sponsors             Club sponsors shown on the home page
//   match_results        Manually-entered match scores shown on home page
//   newsletter_subscribers  Email list for future newsletters
//
// How to add a new column:
//   1. Add it to the table definition below
//   2. Add ALTER TABLE to scripts/migrate.mjs
//   3. Run: node scripts/migrate.mjs
//
// How to add a new table:
//   1. Define it here with sqliteTable(...)
//   2. Add CREATE TABLE IF NOT EXISTS to scripts/migrate.mjs
//   3. Run: node scripts/migrate.mjs
// =============================================================================

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Admin Users ───────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  googleId: text("google_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", {
    // Keep in sync with ROLES in shared/roles.ts, which defines what each can do.
    enum: ["super_admin", "club_admin", "juniors_coordinator", "content_manager", "social_media"],
  }).notNull().default("content_manager"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Calendar Events ───────────────────────────────────────────────────────────
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  location: text("location"),
  eventType: text("event_type", {
    enum: ["game", "training", "social", "meeting", "other"],
  }).notNull().default("other"),
  teamCategory: text("team_category", {
    enum: ["mens", "womens", "juniors", "all"],
  }).notNull().default("all"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Sign-Up Registrations ─────────────────────────────────────────────────────
export const registrations = sqliteTable("registrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  isJunior: integer("is_junior", { mode: "boolean" }).notNull().default(false),
  parentName: text("parent_name"),
  parentEmail: text("parent_email"),
  parentPhone: text("parent_phone"),
  teamPreference: text("team_preference", {
    enum: ["mens", "womens", "juniors", "unsure"],
  }).default("unsure"),
  experienceLevel: text("experience_level", {
    enum: ["beginner", "intermediate", "experienced"],
  }).notNull().default("beginner"),
  kidsportEligible: integer("kidsport_eligible", { mode: "boolean" }).notNull().default(false),
  howHeard: text("how_heard"),
  message: text("message"),
  status: text("status", {
    enum: ["new", "contacted", "registered", "declined"],
  }).notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── News / Announcements ──────────────────────────────────────────────────────
export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),           // HTML from TipTap rich text editor
  featuredImageUrl: text("featured_image_url"),  // Optional thumbnail shown on home page card
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false), // Pinned = shows first with gold border
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Juniors Page Content ──────────────────────────────────────────────────────
// Stores the editable text sections shown on the /juniors page.
// Sections: hero, programs, kidsport, equipment, contact
export const juniorsContent = sqliteTable("juniors_content", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  section: text("section").notNull().unique(),
  title: text("title"),
  content: text("content").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: integer("updated_by").references(() => users.id),
});

// ── Site Settings ─────────────────────────────────────────────────────────────
// Key-value store for admin-configurable site options.
// Keys include: behold_feed_id, store_url, google_calendar_embed_url,
//               hero_image_url, nav_show_gallery, nav_show_store, etc.
// Manage all of these in Admin → Settings.
export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Contact Messages ──────────────────────────────────────────────────────────
export const contactMessages = sqliteTable("contact_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Media Uploads ─────────────────────────────────────────────────────────────
// Every image uploaded via Admin → Media Library.
// Files stored on disk at public/uploads/, served at /uploads/*.
export const mediaUploads = sqliteTable("media_uploads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  caption: text("caption"),              // Optional — shown in the gallery page
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Sponsors ──────────────────────────────────────────────────────────────────
// Club sponsors shown in a strip on the home page.
// Tiers: gold (large), silver (medium), bronze/partner (small).
// Sort order controls the left-to-right display order.
export const sponsors = sqliteTable("sponsors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),                     // Upload via Media Library, paste URL here
  websiteUrl: text("website_url"),               // Clicking the logo opens this URL
  tier: text("tier", {
    enum: ["gold", "silver", "bronze", "partner"],
  }).notNull().default("partner"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0), // Lower = further left
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Match Results ─────────────────────────────────────────────────────────────
// Manually-entered match scores. Shown as "Recent Results" on the home page.
// Not auto-pulled from LacrosseWA — admins enter these after each game.
export const matchResults = sqliteTable("match_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchDate: text("match_date").notNull(),
  opposition: text("opposition").notNull(),
  venue: text("venue"),
  isHome: integer("is_home", { mode: "boolean" }).notNull().default(true),
  ourScore: integer("our_score"),
  theirScore: integer("their_score"),
  teamCategory: text("team_category", {
    enum: ["mens", "womens", "juniors"],
  }).notNull().default("mens"),
  division: text("division"),
  notes: text("notes"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Newsletter Subscribers ────────────────────────────────────────────────────
// Email addresses collected from the subscribe widget on the home/footer.
// Admin can view and export from Admin → Newsletter.
// No sending functionality built in — export the list to Mailchimp etc.
export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  subscribedAt: text("subscribed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Page Content (CMS) ────────────────────────────────────────────────────────
// Every editable text block on every public page is stored here.
// page + section together are unique (e.g. page="about", section="history_1").
// Admins edit these via inline edit buttons that appear when logged in,
// or via Admin → Pages tab.
// If no DB row exists, the page falls back to the default hardcoded text.
export const pageContent = sqliteTable("page_content", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  page: text("page").notNull(),      // e.g. "home", "about", "contact"
  section: text("section").notNull(),// e.g. "hero_title", "history_1"
  content: text("content").notNull(),// HTML (from TipTap) or plain text
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: integer("updated_by").references(() => users.id),
});

// ── List Items (flexible repeating content) ───────────────────────────────────
// One table powers several "list" sections that admins can add/edit/remove rows in:
//   listType="team_division" → About & Fixtures team divisions (title=team, label=division)
//   (things you sell live in the products table, not here)
//   listType="faq"           → Juniors FAQ (title=question, body=answer)
// Generic columns keep it simple; not every column is used by every list type.
export const listItems = sqliteTable("list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listType: text("list_type").notNull(),  // which list this row belongs to
  group: text("group"),                    // optional grouping (e.g. "Men's" team)
  title: text("title").notNull(),          // question / item name / division name
  body: text("body"),                      // answer / description
  label: text("label"),                    // badge text / extra tag
  url: text("url"),                         // optional link (e.g. fixtures URL)
  icon: text("icon"),                       // optional icon name
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Custom Pages (admin-created) ──────────────────────────────────────────────
// Pages the club creates themselves from the admin panel — e.g. "Life Members",
// "Coaching Resources", "Club Policies". Distinct from the nine built-in pages,
// whose text lives in page_content.
//
// An admin picks a TEMPLATE (which pre-fills sensible starter content), then
// edits it freely with the rich text editor. They also choose where it appears
// in the navigation.
export const customPages = sqliteTable("custom_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // URL slug, e.g. "life-members" → the page lives at /p/life-members.
  // The /p/ prefix guarantees a custom page can never collide with a built-in
  // route like /about or the secret admin path.
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),          // shown in the nav and as the page heading
  subtitle: text("subtitle"),              // optional line under the heading in the banner
  content: text("content").notNull().default(""), // HTML from the rich text editor
  template: text("template").notNull().default("blank"), // which template it started from
  // Where the link appears: main nav, inside the Club dropdown, footer, or
  // nowhere (the page still works if you know the link — handy for drafts).
  navLocation: text("nav_location", {
    enum: ["main", "club_menu", "footer", "hidden"],
  }).notNull().default("club_menu"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Committee / Board members ─────────────────────────────────────────────────
// The people running the club, shown on the public /committee page.
// Managed in Admin → Committee, so it can be refreshed after each AGM without
// touching code. Grouped so "Executive" (President, Secretary…) can be listed
// above "General Committee" and "Coaches".
export const committeeMembers = sqliteTable("committee_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  position: text("position").notNull(),      // e.g. "President"
  groupName: text("group_name").notNull().default("Executive"), // section heading
  bio: text("bio"),                           // optional short paragraph
  email: text("email"),                       // optional public contact
  photoUrl: text("photo_url"),                // optional headshot (media library)
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});


// ── Store: products ──────────────────────────────────────────────────────────
// The club's shop. A product is a thing for sale (a jersey); a VARIANT is the
// specific version someone actually buys (that jersey in Medium). Every product
// has at least one variant, even if it's a one-size item.
//
// MONEY IS ALWAYS STORED IN CENTS, as a whole number. Never store money as a
// decimal: 0.1 + 0.2 does not equal 0.3 in any programming language, and those
// tiny errors turn into real ones once you're totalling an order. $24.50 is
// stored as 2450 and only ever turned into "$24.50" for display.
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  // Base price in cents. A variant may override it (e.g. XXL costs more).
  priceCents: integer("price_cents").notNull().default(0),
  imageUrl: text("image_url"),                 // from the media library
  badge: text("badge"),                        // small tag, e.g. "New" / "Playing Kit"
  category: text("category"),                  // optional grouping on the page
  // Postage only applies to things that physically ship. A membership or a
  // ticket doesn't, so this decides whether an address is asked for.
  requiresShipping: integer("requires_shipping", { mode: "boolean" }).notNull().default(true),
  maxPerOrder: integer("max_per_order").notNull().default(10),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  // "Sold out" is deliberately separate from "hidden". Hiding removes the item
  // from the page entirely; marking it sold out leaves it on display, clearly
  // unavailable, so members can still see it's something the club sells and
  // will be back. It also works for made-to-order items, which have no stock
  // count to drop to zero.
  soldOut: integer("sold_out", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── Store: product variants (sizes) ──────────────────────────────────────────
export const productVariants = sqliteTable("product_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull(),              // "Small", "Youth 12", "One size"
  sku: text("sku"),                            // optional club stock code
  // Blank = charge the product's own price. Set it to charge something different.
  priceCents: integer("price_cents"),
  // NULL means "we never run out" (made to order). A number is a real stock
  // count and is reduced when an order is paid for.
  stock: integer("stock"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Store: orders ────────────────────────────────────────────────────────────
// One row per attempted purchase. A row is created BEFORE the customer is sent
// to pay, with status "pending", so nothing is ever lost if they close the tab
// mid-payment. It only becomes "paid" when the payment provider confirms it —
// never because the browser said so.
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),   // human-friendly, e.g. "SLC-4F2A9C"
  status: text("status", {
    enum: ["pending", "paid", "fulfilled", "cancelled", "refunded"],
  }).notNull().default("pending"),

  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),

  // "pickup" (collect at training) or "shipping" (posted out).
  fulfilmentMethod: text("fulfilment_method").notNull().default("pickup"),
  shippingAddress: text("shipping_address"),

  subtotalCents: integer("subtotal_cents").notNull().default(0),
  shippingCents: integer("shipping_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  currency: text("currency").notNull().default("AUD"),

  paymentProvider: text("payment_provider").notNull().default("stripe"),
  paymentRef: text("payment_ref"),                   // provider's session id
  paymentIntent: text("payment_intent"),             // provider's payment id (for refunds)

  notes: text("notes"),                              // customer's note at checkout
  adminNotes: text("admin_notes"),                   // club's own note
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  paidAt: text("paid_at"),
});

// ── Store: order lines ───────────────────────────────────────────────────────
// The product name, size and price are COPIED onto each line rather than only
// linked. If the club later renames a product or changes its price, last
// season's orders must still show what was actually bought and paid.
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  variantId: integer("variant_id").references(() => productVariants.id),
  productName: text("product_name").notNull(),
  variantLabel: text("variant_label"),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

// ── Zod validation schemas (used in routes for input validation) ───────────────
export const insertCommitteeMemberSchema = createInsertSchema(committeeMembers).omit({ id: true, createdAt: true });
export const insertCustomPageSchema = createInsertSchema(customPages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertListItemSchema = createInsertSchema(listItems).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertRegistrationSchema = createInsertSchema(registrations).omit({ id: true, createdAt: true, status: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export const insertSponsorSchema = createInsertSchema(sponsors).omit({ id: true, createdAt: true });
export const insertMatchResultSchema = createInsertSchema(matchResults).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductVariantSchema = createInsertSchema(productVariants).omit({ id: true });

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).optional(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["super_admin", "club_admin", "juniors_coordinator", "content_manager", "social_media"]),
});

// ── TypeScript types (exported for use in client and server) ──────────────────
export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type JuniorsContent = typeof juniorsContent.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type MediaUpload = typeof mediaUploads.$inferSelect;
export type Sponsor = typeof sponsors.$inferSelect;
export type MatchResult = typeof matchResults.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type PageContent = typeof pageContent.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type CustomPage = typeof customPages.$inferSelect;
export type CommitteeMember = typeof committeeMembers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

/** A product with its sizes attached — what the store page and admin both use. */
export type ProductWithVariants = Product & { variants: ProductVariant[] };
/** An order with its lines attached — what the admin orders screen uses. */
export type OrderWithItems = Order & { items: OrderItem[] };
