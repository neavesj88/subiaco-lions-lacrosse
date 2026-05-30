import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", {
    enum: ["super_admin", "club_admin", "juniors_coordinator", "content_manager"],
  })
    .notNull()
    .default("content_manager"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  location: text("location"),
  eventType: text("event_type", {
    enum: ["game", "training", "social", "meeting", "other"],
  })
    .notNull()
    .default("other"),
  teamCategory: text("team_category", {
    enum: ["mens", "womens", "juniors", "all"],
  })
    .notNull()
    .default("all"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

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
  })
    .notNull()
    .default("beginner"),
  kidsportEligible: integer("kidsport_eligible", { mode: "boolean" }).notNull().default(false),
  howHeard: text("how_heard"),
  message: text("message"),
  status: text("status", {
    enum: ["new", "contacted", "registered", "declined"],
  })
    .notNull()
    .default("new"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const juniorsContent = sqliteTable("juniors_content", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  section: text("section").notNull().unique(),
  title: text("title"),
  content: text("content").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Zod schemas for validation
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertRegistrationSchema = createInsertSchema(registrations).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["super_admin", "club_admin", "juniors_coordinator", "content_manager"]),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;
export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = typeof registrations.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;
export type JuniorsContent = typeof juniorsContent.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
