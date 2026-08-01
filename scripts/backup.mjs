// =============================================================================
// BACKUP — scripts/backup.mjs
// =============================================================================
// Makes a safe, complete copy of everything the club cannot afford to lose:
//
//   1. data/club.db        every page, post, event, member and setting
//   2. public/uploads/     every photo and logo anyone has ever uploaded
//
// Both matter. A database restored without its uploads gives you a website
// where every picture is a broken icon.
//
// WHY NOT JUST `cp club.db backup.db`?
//   Because it can quietly give you a damaged or out-of-date copy. The database
//   runs in "WAL mode", which means recent changes are written to a SEPARATE
//   file (club.db-wal) and folded into the main file later. Copying only
//   club.db while the site is running can therefore miss the newest posts, and
//   can catch the file mid-write.
//
//   The nasty part is that the copy still LOOKS fine. You would only find out
//   the day you actually needed it — which is the worst possible day to find
//   out. This script instead asks SQLite itself to produce the copy, using its
//   built-in online backup. That is guaranteed complete and consistent even
//   while people are using the site.
//
// USAGE
//   node scripts/backup.mjs              → back up into data/backups/
//   BACKUP_DIR=/mnt/usb node scripts/backup.mjs
//                                        → back up somewhere else (recommended:
//                                          a USB stick or network drive, so a
//                                          dead disk doesn't take the backups
//                                          with it)
//
// Old backups are pruned automatically; the most recent 30 are kept.
// =============================================================================

import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, rmSync, cpSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = process.env.DATABASE_URL ?? path.join(projectDir, "data", "club.db");
const uploadsDir = path.join(projectDir, "public", "uploads");
const backupRoot = process.env.BACKUP_DIR ?? path.join(projectDir, "data", "backups");
const KEEP = parseInt(process.env.BACKUP_KEEP ?? "30", 10);

// Timestamp like 20250801_143005 — sorts correctly as plain text.
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
const targetDir = path.join(backupRoot, `backup_${stamp}`);

if (!existsSync(dbPath)) {
  console.error(`ERROR: database not found at ${dbPath}`);
  console.error("Has the site been set up yet? Run: node scripts/migrate.mjs");
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

// ── 1. The database ─────────────────────────────────────────────────────────
const db = new Database(dbPath, { readonly: true });
try {
  // SQLite's own online backup: consistent even with the site running.
  await db.backup(path.join(targetDir, "club.db"));
  const size = statSync(path.join(targetDir, "club.db")).size;
  console.log(`  ✓ database  (${(size / 1024 / 1024).toFixed(1)} MB)`);
} finally {
  db.close();
}

// ── 2. The uploaded photos ──────────────────────────────────────────────────
if (existsSync(uploadsDir)) {
  cpSync(uploadsDir, path.join(targetDir, "uploads"), { recursive: true });
  const count = readdirSync(path.join(targetDir, "uploads")).length;
  console.log(`  ✓ uploads   (${count} file${count === 1 ? "" : "s"})`);
} else {
  console.log("  · uploads   (none yet)");
}

console.log(`\nBackup complete: ${targetDir}`);

// ── 3. Prune old backups ────────────────────────────────────────────────────
const existing = readdirSync(backupRoot)
  .filter((name) => name.startsWith("backup_"))
  .sort()
  .reverse();

if (existing.length > KEEP) {
  for (const old of existing.slice(KEEP)) {
    rmSync(path.join(backupRoot, old), { recursive: true, force: true });
  }
  console.log(`Pruned ${existing.length - KEEP} old backup(s); keeping the newest ${KEEP}.`);
}
