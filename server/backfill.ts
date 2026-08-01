// =============================================================================
// ONE-TIME CONTENT CLEAN-UP — server/backfill.ts
// =============================================================================
// Sanitising was added to this site after it had already been running, so the
// database may hold rich text that was saved BEFORE anything was checking it.
// New content is now cleaned as it is saved (see server/sanitize.ts), but that
// does nothing for what is already stored — including a database restored from
// an old backup.
//
// So on startup this runs once over the existing content, cleans it with the
// exact same rules used for new content, and records that it has done so. It
// then never runs again, on any future restart.
//
// Using the app's own sanitiser rather than a copy of the rules is deliberate:
// there is only one definition of "safe HTML" in this project, so the two can
// never drift apart.
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "./db";
import { announcements, juniorsContent, pageContent, customPages, siteSettings } from "@shared/schema";
import { cleanHtml } from "./sanitize";

const FLAG = "content_sanitised_v1";

export function backfillSanitiseContent(): void {
  try {
    const [flag] = db.select().from(siteSettings).where(eq(siteSettings.key, FLAG)).limit(1).all();
    if (flag?.value === "done") return;

    let changed = 0;

    // Each table that stores editor HTML, with the column that holds it.
    const targets = [
      { table: announcements, column: "content" as const },
      { table: juniorsContent, column: "content" as const },
      { table: pageContent, column: "content" as const },
      { table: customPages, column: "content" as const },
    ];

    for (const { table, column } of targets) {
      const rows = db.select().from(table as any).all() as any[];
      for (const row of rows) {
        const original = row[column];
        if (typeof original !== "string" || original === "") continue;
        const cleaned = cleanHtml(original);
        if (cleaned !== original) {
          db.update(table as any).set({ [column]: cleaned }).where(eq((table as any).id, row.id)).run();
          changed++;
        }
      }
    }

    db.insert(siteSettings).values({ key: FLAG, value: "done" })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: "done" } }).run();

    if (changed > 0) {
      console.log(`[security] Cleaned unsafe markup out of ${changed} existing item(s) of saved content.`);
    }
  } catch (err) {
    // Never prevent the site starting because of this — it is a tidy-up, not a
    // requirement. Anything it misses is still made safe when next re-saved.
    console.error("[security] Content clean-up skipped:", (err as Error).message);
  }
}
