import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Turn a date from the server into a Date, the way it was meant.
 *
 *  "2026-11-04"           a calendar day (an event's date): midnight HERE.
 *                         Plain `new Date()` reads it as midnight in London,
 *                         which is the day before anywhere west of it.
 *  "2026-11-04 03:15:00"  SQLite's CURRENT_TIMESTAMP, which is UTC with no
 *                         zone marked. Plain `new Date()` reads it as local
 *                         time, putting order times 8 hours out in Perth.
 *  anything else          passed straight through.
 */
export function parseDate(value: string): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return new Date(+day[1], +day[2] - 1, +day[3]);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) return new Date(value.replace(" ", "T") + "Z");
  return new Date(value);
}

/** A server timestamp as a local date and time, e.g. "4 Nov 2026, 11:15 am". */
export function formatDateTime(value: string) {
  return parseDate(value).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function formatDate(dateStr: string) {
  return parseDate(dateStr).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateStr: string) {
  return parseDate(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
