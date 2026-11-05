// =============================================================================
// CHECKING WHAT THE PUBLIC SENDS — server/input.ts
// =============================================================================
// The sign-up, contact, newsletter and shop forms are open to the whole
// internet. Anything they send is checked here before it is saved or used to
// address an email.
//
// SHOULD A CLUB EDIT THIS FILE?  No.
// =============================================================================

/**
 * Is this one plausible email address?
 *
 * In: anything from a request. Out: true only for a single address.
 *
 * The length is checked BEFORE the pattern, on purpose. An earlier check ran
 * the pattern first on text of any length, and a pattern like that can take
 * minutes on a carefully built string of "a@a@a@…" — long enough to freeze the
 * whole website for every visitor, from one request.
 *
 * Commas, semicolons and angle brackets are refused because the mail library
 * reads "a@x.com, b@y.com" as TWO recipients: without this, the sign-up
 * form's automatic reply could be pointed at strangers.
 */
export function isEmailAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 3 || v.length > 200) return false;
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(v);
}
