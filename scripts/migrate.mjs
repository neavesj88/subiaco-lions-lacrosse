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

// Respect DATABASE_URL exactly like the server does (server/db.ts), so the
// migration can never run against a different file than the app uses.
import path from 'path';
const dbPath = process.env.DATABASE_URL ?? './data/club.db';
mkdirSync(path.dirname(dbPath), { recursive: true });
mkdirSync('./public/uploads', { recursive: true });
mkdirSync('./data/backups', { recursive: true });

const db = new Database(dbPath);

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

// ── v0: base tables ──────────────────────────────────────────────────────────
// These six tables are the original core of the site. On an existing install
// they already exist and every statement below does nothing.
//
// They are listed here because a brand-new club installing from a fresh clone
// has an empty database, and the ALTER/seed steps further down all assume these
// tables are present (adding a column to a table that doesn't exist throws
// "no such table: users"). Keep these in sync with shared/schema.ts — see rule 1
// in CLAUDE.md.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    google_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'content_manager',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    featured_image_url TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    location TEXT,
    event_type TEXT NOT NULL DEFAULT 'other',
    team_category TEXT NOT NULL DEFAULT 'all',
    is_published INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS juniors_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL UNIQUE,
    title TEXT,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    date_of_birth TEXT,
    is_junior INTEGER NOT NULL DEFAULT 0,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    team_preference TEXT DEFAULT 'unsure',
    experience_level TEXT NOT NULL DEFAULT 'beginner',
    kidsport_eligible INTEGER NOT NULL DEFAULT 0,
    how_heard TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Is this a brand-new install, or an existing club's database?
//
// This MUST be measured here — before the migration seeds any of its own
// default settings below — otherwise the script's own writes make every
// database look "established" and a new club never sees the setup wizard.
const isNewInstall =
  db.prepare('SELECT COUNT(*) AS n FROM site_settings').get().n === 0 &&
  db.prepare('SELECT COUNT(*) AS n FROM announcements').get().n === 0 &&
  db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;

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
addSetting('nav_show_coaches_board', 'true');   // Coaches Board tactical whiteboard page

// ── v5: club contact details (used on About, Contact, Juniors, Footer) ───────
// Previously hardcoded in the page files — now editable in Admin → Settings.
// Venue details also come from club-config defaults on a fresh install.

// ── v8: first-run setup wizard flag ──────────────────────────────────────────
// The wizard only shows on a BRAND NEW install. If this database already has
// content (an existing club like Subiaco), mark setup as complete so they are
// never interrupted by a setup screen for a site they've already been running.
addSetting('setup_completed', isNewInstall ? 'false' : 'true');
console.log(isNewInstall
  ? '  (new install — setup wizard will run on first admin login)'
  : '  (existing install detected — setup wizard disabled)');

// ── v7: club branding (name shown across the site) + committee ───────────────
// The club name used to be hardcoded in the nav, footer and page titles.
// NOTE: club name/tagline are deliberately NOT seeded here. Existing installs
// already have their own rows (untouched), and a brand-new club should inherit
// the templated defaults from shared/club-config.ts rather than Subiaco's copy.
addSetting('nav_show_committee', 'true');            // the /committee page

db.exec(`
  CREATE TABLE IF NOT EXISTS committee_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'Executive',
    bio TEXT,
    email TEXT,
    photo_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── v6: admin-created custom pages ───────────────────────────────────────────
// Lets the club add their own pages (Life Members, Policies, etc.) from the
// admin panel. They live at /p/<slug> so they can never clash with a built-in
// route or the secret admin path.
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    content TEXT NOT NULL DEFAULT '',
    template TEXT NOT NULL DEFAULT 'blank',
    nav_location TEXT NOT NULL DEFAULT 'club_menu',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── v5: admin-editable theme colours ─────────────────────────────────────────
// Drive the CSS variables in client/src/index.css. Blank = use the built-in
// default, so the site always looks right even before an admin picks colours.
addSetting('theme_primary', '#7B1E32');        // banners, buttons, headings
addSetting('theme_primary_dark', '#3A0C17');   // deep end of banner gradients
addSetting('theme_accent', '#C5942A');         // gold bars, highlights
addSetting('theme_gradient_angle', '135deg');  // banner gradient direction

// ── v5: admin-editable mail server (overrides .env when set) ─────────────────
// Lets the club change their email provider from the admin panel instead of
// editing .env on the server. mail_enabled is the kill-switch.
addSetting('mail_enabled', 'true');
addSetting('mail_host', '');       // e.g. smtp.eu.mailgun.org (blank = auto-detect from user)
addSetting('mail_port', '587');
addSetting('mail_user', '');       // full sending address
addSetting('mail_pass', '');       // SMTP password (stored in the DB, admin-only)
addSetting('mail_from', '');       // "From" address if different to mail_user
addSetting('mail_notify', '');     // where club notifications go (blank = CLUB_NOTIFY_EMAIL)
// Fixtures links are per-club accounts on third-party sites, so they start
// blank and each club enters its own in Admin → Settings (or the setup wizard).
// Existing clubs already have their values stored and are not affected.
addSetting('gameday_url', '');
addSetting('lacrossewa_fixtures_url', '');

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

  // Starter team divisions — a common shape for an Australian club. Every club
  // renames, adds or deletes these in Admin → Teams.
  //
  // The URL is left as NULL so each row falls back to the club-wide fixtures
  // URL setting, which means updating that one setting re-points every
  // division link at once.
  const divisions = [
    ["Men's", "State League"], ["Men's", "Division 1"], ["Men's", "Division 2"], ["Men's", "Division 3"],
    ["Women's", "State League"], ["Women's", "Division 1"], ["Women's", "Division 2"],
    ["Juniors", "Under 11"], ["Juniors", "Under 13"], ["Juniors", "Under 15"], ["Juniors", "Under 17"],
  ];
  divisions.forEach(([group, name], i) => ins.run("team_division", group, name, null, null, null, i));

  // Store apparel items (title = name, body = description, label = badge).
  // Generic starters so the Store page isn't empty — every club edits these in
  // Admin → Store to match what they actually sell.
  const apparel = [
    ["Club Playing Jersey", "Official match jersey in club colours. Available in senior and junior sizes.", "Playing Kit"],
    ["Training Singlet", "Lightweight training singlet in club colours. Perfect for pre-season and training sessions.", "Training"],
    ["Club Hoodie", "Premium fleece hoodie with the embroidered club crest. Great for sideline days.", "Casual Wear"],
    ["Supporter Cap", "Structured cap with embroidered club logo.", "Supporter Gear"],
    ["Junior Playing Kit", "Full junior playing kit including jersey and shorts.", "Juniors"],
    ["Club Kit Bag", "Club-branded kit bag, roomy enough for a full set of gear.", "Equipment"],
  ];
  apparel.forEach(([title, body, label], i) => ins.run("store_item", null, title, body, label, null, i));

  // Juniors FAQ (title = question, body = answer)
  const faqs = [
    ["What age can my child start?", "We welcome players from age 8 upwards. Our U11 program is designed as a gentle introduction with modified rules."],
    ["Do they need to know how to play?", "Not at all! Most of our junior players start as complete beginners. Our coaches will teach everything from scratch."],
    ["Is it safe?", "Junior divisions use modified rules appropriate to their age group, and our coaches are accredited. Describe your club's safety approach and any protective equipment required here."],
    ["What about KidSport?", "If your club is a registered KidSport provider, say so here. Eligible WA families can receive up to $200 per child per year towards registration fees."],
    ["When is training?", "Training schedules vary by division. Check the Club Calendar for current sessions, or ask us when you register."],
  ];
  faqs.forEach(([title, body], i) => ins.run("faq", null, title, body, null, null, i));

  console.log("  Seeded list_items (divisions, apparel, FAQ)");
}

// ── v9: the shop (products, sizes, orders) ───────────────────────────────────
// Money is stored in CENTS as whole numbers throughout — see the note in
// shared/schema.ts for why.
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    badge TEXT,
    category TEXT,
    requires_shipping INTEGER NOT NULL DEFAULT 1,
    max_per_order INTEGER NOT NULL DEFAULT 10,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sku TEXT,
    price_cents INTEGER,
    stock INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants (product_id);

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    fulfilment_method TEXT NOT NULL DEFAULT 'pickup',
    shipping_address TEXT,
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    shipping_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AUD',
    payment_provider TEXT NOT NULL DEFAULT 'stripe',
    payment_ref TEXT,
    payment_intent TEXT,
    notes TEXT,
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TEXT
  );
  CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
  -- Looking an order up by the payment provider's id happens on every webhook,
  -- and must be unique so a repeated webhook can't create a second order.
  CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_ref_idx ON orders (payment_ref)
    WHERE payment_ref IS NOT NULL;

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    variant_id INTEGER REFERENCES product_variants(id),
    product_name TEXT NOT NULL,
    variant_label TEXT,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
`);

// Shop settings. All blank/off by default: a club that never sets up payments
// simply keeps the "enquire by email" store page it already had.
addSetting('store_mode', 'enquiry');       // off | enquiry | external | checkout
addSetting('store_currency', 'AUD');
addSetting('store_currency_symbol', '$');
addSetting('stripe_publishable_key', '');
addSetting('stripe_secret_key', '');       // SECRET — never sent to the browser
addSetting('stripe_webhook_secret', '');   // SECRET — never sent to the browser
addSetting('store_pickup_enabled', 'true');
addSetting('store_shipping_enabled', 'false');
addSetting('store_shipping_label', 'Postage');
addSetting('store_shipping_cents', '1200');
addSetting('store_free_shipping_over_cents', '');
addSetting('store_order_notify_email', '');
addSetting('store_tax_note', '');
addSetting('store_terms', '');

// Carry the old brochure-style store items over into real products, so a club
// that had listed apparel keeps it rather than opening the page to an empty
// shop. They arrive priced at zero and switched OFF, so nothing can be bought
// for $0 by accident — the club sets a price and ticks "available" when ready.
{
  const alreadyMigrated = db.prepare("SELECT value FROM site_settings WHERE key = 'store_items_migrated'").get();
  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;

  if (!alreadyMigrated && productCount === 0) {
    const legacy = db.prepare(
      "SELECT title, body, label, sort_order FROM list_items WHERE list_type = 'store_item' ORDER BY sort_order"
    ).all();

    if (legacy.length > 0) {
      const insertProduct = db.prepare(
        `INSERT INTO products (name, description, badge, price_cents, is_active, sort_order)
         VALUES (?, ?, ?, 0, 0, ?)`
      );
      const insertVariant = db.prepare(
        "INSERT INTO product_variants (product_id, label, sort_order) VALUES (?, 'One size', 0)"
      );
      const migrate = db.transaction((rows) => {
        for (const row of rows) {
          const res = insertProduct.run(row.title, row.body ?? null, row.label ?? null, row.sort_order ?? 0);
          insertVariant.run(res.lastInsertRowid);
        }
      });
      migrate(legacy);
      console.log(`  Copied ${legacy.length} old store item(s) into the new shop (hidden until priced)`);
    }
    addSetting('store_items_migrated', 'true');
  }
}

db.close();
console.log('Migration complete.');
