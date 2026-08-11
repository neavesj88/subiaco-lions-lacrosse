// =============================================================================
// SPREADSHEET EXPORTS — server/csv.ts
// =============================================================================
// Building a CSV looks like it should be one line of string joining. It isn't,
// for two reasons that both bite in practice:
//
//   QUOTES. A value containing a double quote — a name like O"Brien, or an
//   address with inches in it — breaks a naively quoted field and shifts every
//   column after it. The CSV standard's answer is to double the quote.
//
//   SPREADSHEET FORMULA INJECTION. Excel and Google Sheets treat a cell whose
//   text starts with = + - or @ as a FORMULA rather than text. Anyone who can
//   type into a form on this site — the contact form, a shop order name —
//   could put =HYPERLINK("http://evil","click me") in it, and it would run when
//   a club treasurer opened the exported file. Prefixing an apostrophe forces
//   the spreadsheet to treat it as plain text.
//
// So all exports go through here rather than assembling strings by hand.
// =============================================================================

import { getSettingsSync } from "./site-settings";

/** One safely-escaped CSV cell, always quoted. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const risky = /^[=+\-@\t\r]/.test(text);
  const safe = risky ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A whole row from an array of values. */
export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

/** Join a header and rows into a downloadable file body. */
export function csvFile(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\n");
}

/**
 * A filename based on the club's own name and today's date, e.g.
 * "riverside-rovers-orders-2026-08-07.csv".
 */
export function csvFilename(kind: string): string {
  const club = (getSettingsSync().club_name ?? "club")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "club";
  return `${club}-${kind}-${new Date().toISOString().split("T")[0]}.csv`;
}
