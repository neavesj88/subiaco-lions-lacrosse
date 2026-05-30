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
    enum: ["super_admin", "club_admin", "juniors_coordinator", "content_manager"],
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

// ── Zod validation schemas (used in routes for input validation) ───────────────
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertRegistrationSchema = createInsertSchema(registrations).omit({ id: true, createdAt: true, status: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export const insertSponsorSchema = createInsertSchema(sponsors).omit({ id: true, createdAt: true });
export const insertMatchResultSchema = createInsertSchema(matchResults).omit({ id: true, createdAt: true });

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).optional(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["super_admin", "club_admin", "juniors_coordinator", "content_manager"]),
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
