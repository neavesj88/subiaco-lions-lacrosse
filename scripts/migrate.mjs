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

// ── v4: page_content CMS table + logo setting ─────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS page_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(page, section)
  )
`);

addSetting('club_logo_url', '');  // Upload a logo in Media Library, paste URL here
// GameDay is the third-party that hosts the club's fixtures & results.
// Admins can update this in Admin → Settings if the club ID ever changes.
addSetting('gameday_url', 'https://websites.mygameday.app/club_info.cgi?clubID=139526&c=0-4051-0-0-0');
addSetting('lacrossewa_fixtures_url', 'https://lacrossewa.com.au/fixtures-results/club-fixtures/');

// ── v5: list_items table (team divisions, store apparel, juniors FAQ) ─────────
db.exec(`
  CREATE TABLE IF NOT EXISTS list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_type TEXT NOT NULL,
    "group" TEXT,
    title TEXT NOT NULL,
    body TEXT,
    label TEXT,
    url TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed the list_items table once (only if completely empty) so admins start
// with the existing content already populated and editable.
const listCount = db.prepare('SELECT COUNT(*) AS n FROM list_items').get().n;
if (listCount === 0) {
  const ins = db.prepare(
    'INSERT INTO list_items (list_type, "group", title, body, label, url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Divisions link to GameDay (the third-party that hosts fixtures & results).
  // Left as NULL so each row falls back to the club-wide gameday_url setting,
  // which means changing the GameDay URL in Settings updates every division link.
  const divisions = [
    ["Men's", "State League"], ["Men's", "Division 1"], ["Men's", "Division 2"], ["Men's", "Division 3"],
    ["Women's", "State League"], ["Women's", "Division 1"], ["Women's", "Division 2"],
    ["Juniors", "Under 11"], ["Juniors", "Under 13"], ["Juniors", "Under 15"], ["Juniors", "Under 17"],
  ];
  divisions.forEach(([group, name], i) => ins.run("team_division", group, name, null, null, null, i));

  // Store apparel items (title = name, body = description, label = badge)
  const apparel = [
    ["Club Playing Jersey", "Official maroon and gold match jersey. Available in men's, women's and junior sizes.", "Playing Kit"],
    ["Training Singlet", "Lightweight training singlet in club colours. Perfect for pre-season and training sessions.", "Training"],
    ["Club Hoodie", "Premium fleece hoodie with embroidered Lions crest. Great for sideline days.", "Casual Wear"],
    ["Supporter Cap", "Structured cap in maroon with gold Lions embroidery.", "Supporter Gear"],
    ["Junior Playing Kit", "Full junior playing kit including jersey and shorts. Sized for U11-U17 divisions.", "Juniors"],
    ["Lacrosse Stick Bag", "Club-branded stick bag fits up to 3 sticks. Perfect for training days.", "Equipment"],
  ];
  apparel.forEach(([title, body, label], i) => ins.run("store_item", null, title, body, label, null, i));

  // Juniors FAQ (title = question, body = answer)
  const faqs = [
    ["What age can my child start?", "We welcome players from age 8 upwards. Our U11 program is designed as a gentle introduction with modified rules."],
    ["Do they need to know how to play?", "Not at all! Most of our junior players start as complete beginners. Our coaches will teach everything from scratch."],
    ["Is lacrosse safe?", "Field lacrosse is a contact sport for older age groups, but junior divisions use modified, non-contact rules. All players wear helmets and protective equipment."],
    ["What about KidSport?", "We're a registered KidSport club. Eligible WA families can receive up to $200 per child per year to help cover registration fees. Ask us at sign-up."],
    ["When is training?", "Training schedules vary by division. Check the Club Calendar for current sessions, or ask us when you register."],
  ];
  faqs.forEach(([title, body], i) => ins.run("faq", null, title, body, null, null, i));

  console.log("  Seeded list_items (divisions, apparel, FAQ)");
}

db.close();
console.log('Migration complete.');
