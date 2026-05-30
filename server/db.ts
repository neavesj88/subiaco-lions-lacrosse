// =============================================================================
// DATABASE CONNECTION — server/db.ts
// =============================================================================
// What this file does:
//   Opens a connection to the SQLite database file and sets it up for use
//   with Drizzle ORM throughout the server.
//
// Why SQLite?
//   Unlike the personal portfolio (neaves.au) which uses PostgreSQL, this site
//   uses SQLite — a single file database. For a club website this is ideal:
//   - No separate database server to install or maintain
//   - The entire database is one file: data/club.db
//   - Easy to back up: just copy the file
//   - Handles hundreds of concurrent users fine (more than enough for a club)
//
// Where is the database?
//   Default: ./data/club.db  (relative to the project root)
//   Override: set DATABASE_URL in your .env file
//
// If the data/ folder doesn't exist it's created automatically on startup.
// =============================================================================

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import { mkdirSync } from "fs";

// Get the database file path from the environment, defaulting to ./data/club.db
const dbPath = process.env.DATABASE_URL ?? "./data/club.db";

// Create the data directory if it doesn't exist yet
const dbDir = path.dirname(dbPath);
mkdirSync(dbDir, { recursive: true });

// Open the database file (creates it if it doesn't exist)
const sqlite = new Database(dbPath);

// WAL mode: makes reads and writes faster and less likely to lock each other
// (especially important if the admin panel and public site hit the DB at the same time)
sqlite.pragma("journal_mode = WAL");

// Enforce foreign key constraints — without this SQLite ignores them by default
sqlite.pragma("foreign_keys = ON");

// Export the Drizzle ORM instance — used everywhere in routes.ts
export const db = drizzle(sqlite, { schema });
