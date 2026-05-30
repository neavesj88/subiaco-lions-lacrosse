// =============================================================================
// DATABASE MIGRATION SCRIPT — scripts/migrate.mjs
// =============================================================================
// Run this whenever the schema changes: node scripts/migrate.mjs
// It's safe to run multiple times — every operation uses IF NOT EXISTS or checks
// for the column before adding it.
//
// Why not drizzle-kit push?
//   SQLite doesn't support all ALTER TABLE operations, and drizzle-kit push
//   can fail on existing indexes. This script uses direct SQL which is safer.
// =============================================================================

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';

mkdirSync('./data', { recursive: true });
mkdirSync('./public/uploads', { recursive: true });
mkdirSync('./data/backups', { recursive: true });

const db = new Database('./data/club.db');

// Helper: add a column only if it doesn't already exist
function addCol(table, column, definition) {
  const cols = db.pragma(`table_info(${table})`).map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  + ${table}.${column}`);
  }
}

// Helper: add a setting key with default value (skips if already set)
function addSetting(key, value) {
  db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)').run(key, value);
}

console.log('Running migrations...');

// ── v1: google_id on users, contact_messages table ───────────────────────────
addCol('users', 'google_id', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── v2: image uploads + post pinning ─────────────────────────────────────────
addCol('announcements', 'featured_image_url', 'TEXT');
addCol('announcements', 'is_pinned', 'INTEGER NOT NULL DEFAULT 0');

db.exec(`
  CREATE TABLE IF NOT EXISTS media_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── v3: sponsors, match results, newsletter, gallery caption ──────────────────
addCol('media_uploads', 'caption', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    tier TEXT NOT NULL DEFAULT 'partner',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS match_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_date TEXT NOT NULL,
    opposition TEXT NOT NULL,
    venue TEXT,
    is_home INTEGER NOT NULL DEFAULT 1,
    our_score INTEGER,
    their_score INTEGER,
    team_category TEXT NOT NULL DEFAULT 'mens',
    division TEXT,
    notes TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Settings: page visibility toggles + new feature settings ─────────────────
// Set to "true" to show the page, "false" to hide it from the nav
addSetting('google_calendar_embed_url', '');
addSetting('store_url', '');
addSetting('hero_image_url', '');
addSetting('nav_show_gallery',   'true');   // Photo gallery page
addSetting('nav_show_fixtures',  'true');   // Fixtures & Results page
addSetting('nav_show_store',     'true');   // Club Store page
addSetting('nav_show_results',   'true');   // Recent results on home page
addSetting('nav_show_sponsors',  'true');   // Sponsor strip on home page
addSetting('nav_show_newsletter','true');   // Newsletter subscribe widget

db.close();
console.log('Migration complete.');
