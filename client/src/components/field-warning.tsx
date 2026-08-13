// =============================================================================
// FieldWarning — client/src/components/field-warning.tsx
// =============================================================================
// WHAT THIS IS
// The small amber note that appears under a box when something looks wrong.
//
// WHY IT LOOKS LIKE THIS
// It never blocks anything. A club volunteer editing the site on a Sunday
// evening should never be stopped from saving, and should never lose what they
// typed. So a mistake gets a short explanation of what is wrong and what to do
// about it, and the Save button keeps working. If they know better than us —
// an unusual address, a deliberate choice — they can carry on.
//
// The same text is also attached as a tooltip, so hovering the warning icon
// repeats it, and screen readers announce it.
//
// SHOULD A CLUB EDIT THIS FILE?  No.
// =============================================================================

import { AlertTriangle } from "lucide-react";

/**
 * Show a gentle warning under a form field.
 * In: the message (or null when there's nothing wrong). Out: the note, or
 * nothing at all — so it can be dropped into any form unconditionally.
 */
export default function FieldWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5"
      title={message}
      role="status"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
