import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';

mkdirSync('./data', { recursive: true });
const db = new Database('./data/club.db');

// Add google_id to users
const cols = db.pragma('table_info(users)').map(c => c.name);
if (!cols.includes('google_id')) {
  db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  console.log('Added google_id to users');
} else {
  console.log('google_id already present');
}

// Create contact_messages
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
console.log('contact_messages table ready');

// Add new site settings
const insert = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
insert.run('google_calendar_embed_url', '');
insert.run('store_url', '');
console.log('New settings added');

db.close();
console.log('Migration complete');
