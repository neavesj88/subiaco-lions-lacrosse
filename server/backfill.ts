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
import {
  announcements, juniorsContent, pageContent, customPages, siteSettings, products, orders,
} from "@shared/schema";
import { cleanHtml, unescapeSavedText, RICH_TEXT_SETTINGS } from "./sanitize";

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

// =============================================================================
// ONE-TIME REPAIR: "&amp;" showing on the site
// =============================================================================
// Earlier versions ran plain-text fields (page headings, product descriptions,
// customers' names and addresses) through the HTML cleaner, which stores "&"
// as "&amp;" and an apostrophe as "&#39;". The site then showed those codes
// literally: "Fish &amp; Chips", "O&#39;Brien". New saves no longer do this
// (server/sanitize.ts); this turns what is already stored back into the text
// that was typed, once.
//
// Only values with no HTML tags in them are touched, so formatted text written
// in the editor (which always has tags) is left exactly as it is. The same
// pass also cleans the settings that are displayed as formatted text, which
// were not being cleaned at all before.
// =============================================================================

const FLAG_TEXT = "plain_text_repaired_v1";

export function backfillPlainText(): void {
  try {
    const [flag] = db.select().from(siteSettings).where(eq(siteSettings.key, FLAG_TEXT)).limit(1).all();
    if (flag?.value === "done") return;

    let changed = 0;
    const repair = (table: any, columns: string[]) => {
      const rows = db.select().from(table).all() as any[];
      for (const row of rows) {
        const set: Record<string, string> = {};
        for (const column of columns) {
          const before = row[column];
          if (typeof before !== "string" || before === "") continue;
          const after = unescapeSavedText(before);
          if (after !== before) set[column] = after;
        }
        if (Object.keys(set).length > 0) {
          db.update(table).set(set).where(eq(table.id, row.id)).run();
          changed++;
        }
      }
    };

    repair(pageContent, ["content"]);
    repair(juniorsContent, ["title", "content"]);
    repair(products, ["name", "description"]);
    repair(orders, ["customerName", "customerPhone", "shippingAddress", "notes", "adminNotes"]);

    for (const key of RICH_TEXT_SETTINGS) {
      const [row] = db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1).all();
      if (row && row.value) {
        const cleaned = cleanHtml(row.value);
        if (cleaned !== row.value) {
          db.update(siteSettings).set({ value: cleaned }).where(eq(siteSettings.key, key)).run();
          changed++;
        }
      }
    }

    db.insert(siteSettings).values({ key: FLAG_TEXT, value: "done" })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: "done" } }).run();

    if (changed > 0) console.log(`[content] Repaired ${changed} item(s) of text that showed "&amp;"-style codes.`);
  } catch (err) {
    console.error("[content] Text repair skipped:", (err as Error).message);
  }
}
