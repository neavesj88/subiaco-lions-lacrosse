// =============================================================================
// CHECKING WHAT SOMEONE TYPED — shared/validate.ts
// =============================================================================
// WHAT THIS IS
// Small checks that turn a mistake into a short, plain-English explanation.
//
// THE RULE THESE FOLLOW
// Nothing here ever blocks, throws, or clears what someone typed. A club
// volunteer editing their website at 9pm should never lose their work or hit a
// dead end. The worst that happens is an amber note appearing under the box
// telling them what looks wrong, which they can act on or ignore.
//
// Each message says what is wrong AND what to do instead, because "invalid
// input" helps nobody.
//
// SHOULD A CLUB EDIT THIS FILE?  No.
// =============================================================================

/** A problem worth mentioning. `null` means it's fine. */
export type Warning = string | null;

/**
 * Is this a usable web address?
 * In: whatever was typed. Out: a warning, or null.
 * Blank is always fine — every link on this site is optional.
 */
export function checkUrl(value: string): Warning {
  const v = value.trim();
  if (!v) return null;
  if (/^www\./i.test(v)) return "Add https:// to the front, e.g. https://" + v;
  if (!/^https?:\/\//i.test(v)) return "Web addresses need to start with https://";
  try {
    const url = new URL(v);
    if (!url.hostname.includes(".")) return "That doesn't look like a complete address — check for a typo.";
    return null;
  } catch {
    return "That doesn't look like a web address. Copy it from your browser's address bar.";
  }
}

/** Is this a usable email address? Blank is fine. */
export function checkEmail(value: string): Warning {
  const v = value.trim();
  if (!v) return null;
  if (v.includes(" ")) return "Email addresses can't contain spaces.";
  if (!v.includes("@")) return "Missing the @ — for example secretary@yourclub.org.au";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Check this address — it looks incomplete.";
  return null;
}

/**
 * Is this a sensible whole number?
 * In: the text, and the range that makes sense. Out: a warning, or null.
 */
export function checkNumber(value: string, opts: { min?: number; max?: number; label?: string } = {}): Warning {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d+$/.test(v)) return "Use digits only, with no letters or symbols.";
  const n = parseInt(v, 10);
  if (opts.min !== undefined && n < opts.min) return `${opts.label ?? "This"} can't be less than ${opts.min}.`;
  if (opts.max !== undefined && n > opts.max) return `${opts.label ?? "This"} can't be more than ${opts.max}.`;
  return null;
}

/** Is this a colour the browser will understand? Blank is fine. */
export function checkColour(value: string): Warning {
  const v = value.trim();
  if (!v) return null;
  if (!v.startsWith("#")) return "Colours start with # — for example #7B1E32";
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return "A colour is # followed by 3 or 6 letters/numbers, e.g. #7B1E32";
  return null;
}

/**
 * Names that mean something specific to the menu, so a dropdown can't use them.
 * Without this, calling a dropdown "hidden" would make its items vanish and
 * look like a bug rather than a naming clash.
 */
const RESERVED_MENU_NAMES = ["main", "footer", "hidden"];

/** Is this a usable name for a menu dropdown? */
export function checkMenuGroupName(value: string): Warning {
  const v = value.trim();
  if (!v) return null;
  if (RESERVED_MENU_NAMES.includes(v.toLowerCase())) {
    return `"${v}" has a special meaning here. Pick another word, like "Teams" or "Info".`;
  }
  if (v.length > 24) return "That's long for a menu button — under about 20 characters fits best.";
  return null;
}

/** Is there something to show visitors? */
export function checkLabel(value: string, what = "name"): Warning {
  const v = value.trim();
  if (!v) return `Give this a ${what} or visitors will see an empty button.`;
  if (v.length > 40) return "Very long menu names wrap awkwardly on phones.";
  return null;
}
