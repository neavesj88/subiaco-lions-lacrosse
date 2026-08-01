// =============================================================================
// SESSION STORE — server/session-store.ts
// =============================================================================
// Remembers who is logged in, so admins stay logged in across a restart.
//
// Sessions live in their own small SQLite file (data/sessions.db), separate
// from the club's real data, so clearing them can never touch club content.
//
// WHY THIS IS HAND-WRITTEN RATHER THAN A LIBRARY
//   The obvious library (connect-sqlite3) depends on a SECOND copy of SQLite —
//   a different one to the `better-sqlite3` this site already uses everywhere
//   else. That meant the club's computer had to compile two native database
//   libraries at install time. Compiling native code is by far the most common
//   reason `npm install` fails on a fresh Linux machine, and that second copy
//   also carried a string of published security advisories in its build tools.
//
//   A session store is a genuinely small thing — save, load, delete, expire —
//   so it is written out here against the database library the site already
//   has. One less native dependency, a faster and more reliable install, and
//   nothing hidden.
//
// Old sessions are deleted automatically as they expire.
// =============================================================================

import { Store, type SessionData } from "express-session";
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";

export class SqliteSessionStore extends Store {
  private db: Database.Database;

  constructor(file = "./data/sessions.db") {
    super();
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");

    // A site upgrading from the previous session library already has a
    // "sessions" table, but with different column names. CREATE TABLE IF NOT
    // EXISTS would quietly leave that old table in place and everything after
    // it would fail. So check the shape first, and if it isn't ours, throw the
    // table away and build it properly.
    //
    // Discarding it is safe and deliberate: sessions are only "who is currently
    // logged in". The worst possible consequence is that admins sign in again
    // once after the upgrade. No club content lives here.
    const columns = this.db.pragma("table_info(sessions)") as { name: string }[];
    const isOurs =
      columns.length > 0 && ["sid", "data", "expires_at"].every((c) => columns.some((col) => col.name === c));

    if (columns.length > 0 && !isOurs) {
      this.db.exec("DROP TABLE sessions");
      console.log("[sessions] Upgraded the session store — admins will need to sign in again once.");
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid        TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);
    `);

    // Clear out anything already expired at startup, then hourly.
    this.clearExpired();
    setInterval(() => this.clearExpired(), 60 * 60 * 1000).unref();
  }

  private clearExpired(): void {
    try {
      this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
    } catch {
      /* housekeeping only — never worth interrupting the site for */
    }
  }

  /** When does this session expire? Falls back to 24h if the cookie says nothing. */
  private expiryOf(session: SessionData): number {
    const cookieExpiry = session?.cookie?.expires;
    if (cookieExpiry) return new Date(cookieExpiry).getTime();
    const maxAge = session?.cookie?.maxAge;
    return Date.now() + (typeof maxAge === "number" ? maxAge : 24 * 60 * 60 * 1000);
  }

  get(sid: string, cb: (err?: any, session?: SessionData | null) => void): void {
    try {
      const row = this.db
        .prepare("SELECT data, expires_at FROM sessions WHERE sid = ?")
        .get(sid) as { data: string; expires_at: number } | undefined;

      // Missing or expired → "not logged in", which is the safe answer.
      if (!row || row.expires_at <= Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.data) as SessionData);
    } catch (err) {
      cb(err);
    }
  }

  set(sid: string, session: SessionData, cb?: (err?: any) => void): void {
    try {
      this.db
        .prepare(
          `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`,
        )
        .run(sid, JSON.stringify(session), this.expiryOf(session));
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  destroy(sid: string, cb?: (err?: any) => void): void {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  /** Called on each request when "rolling" sessions are on — pushes the expiry out. */
  touch(sid: string, session: SessionData, cb?: (err?: any) => void): void {
    try {
      this.db
        .prepare("UPDATE sessions SET expires_at = ? WHERE sid = ?")
        .run(this.expiryOf(session), sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  /** Log everyone out (used by the admin "sign out all devices" action). */
  clear(cb?: (err?: any) => void): void {
    try {
      this.db.prepare("DELETE FROM sessions").run();
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  length(cb: (err: any, length?: number) => void): void {
    try {
      const row = this.db
        .prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?")
        .get(Date.now()) as { n: number };
      cb(null, row.n);
    } catch (err) {
      cb(err);
    }
  }
}
