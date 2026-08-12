// =============================================================================
// EMERGENCY ADMIN RESET — scripts/reset-admin.mjs
// =============================================================================
// The "break glass in case of emergency" tool. Use this when nobody can log in
// — e.g. the only admin forgot their password, or an account got locked out.
//
// It works directly on the database file, so it ALWAYS works even if email
// isn't set up and you're completely locked out of the website.
//
// Run it on the server, from the project folder:
//
//   node scripts/reset-admin.mjs                 → reset the "admin" account to
//                                                   a new random password (printed)
//   node scripts/reset-admin.mjs mypassword123   → set the "admin" password to
//                                                   exactly "mypassword123"
//   node scripts/reset-admin.mjs mypass username  → reset a specific username
//
// Whatever account you reset is also re-activated and promoted to Super Admin,
// guaranteeing you can get back in and fix everything else from the web UI.
// =============================================================================

// Reads .env so the admin address printed below is the club's real one.
import "dotenv/config";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import crypto from "crypto";

const dbPath = process.env.DATABASE_URL ?? "./data/club.db";
const args = process.argv.slice(2);

// Password: use the one given, or generate a readable random one
const password = args[0] && args[0].length >= 8
  ? args[0]
  : crypto.randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "") + "1!";
const username = args[1] ?? "admin";

const db = new Database(dbPath);

const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username);
const hash = await bcrypt.hash(password, 12);

if (user) {
  // Reset existing account: new password, re-activate, ensure super_admin
  db.prepare(
    "UPDATE users SET password_hash = ?, is_active = 1, role = 'super_admin' WHERE username = ?"
  ).run(hash, username);
  console.log(`\n✓ Reset existing account "${username}".`);
} else {
  // No such user — recreate a fresh super admin so the club is never locked out
  db.prepare(
    "INSERT INTO users (username, password_hash, name, email, role, is_active) VALUES (?, ?, ?, ?, 'super_admin', 1)"
  ).run(username, hash, "Club Administrator", "admin@example.com");
  console.log(`\n✓ Created new Super Admin "${username}".`);
}

db.close();

console.log("  Role:     super_admin (full access)");
console.log("  Username: " + username);
console.log("  Password: " + password);
// The login page is NOT at /admin. Each club gets its own hard-to-guess
// address, set by ADMIN_PATH in .env. Printing the wrong one here would strand
// the very person this script exists to rescue.
const adminPath = (process.env.ADMIN_PATH || "/manage").trim().replace(/\/+$/, "");
console.log(`\nLog in at ${adminPath}/login, then change this password under Admin → Password.\n`);
