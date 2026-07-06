// =============================================================================
// RichTextDisplay — client/src/components/rich-text-display.tsx
// =============================================================================
// Renders rich-text HTML (saved by the admin editor) on the PUBLIC pages.
//
// Why is this a separate file from rich-text-editor.tsx?
//   The editor pulls in TipTap, which is a large library (~300 KB). Public
//   visitors never edit anything — they only need to *display* saved HTML,
//   which this tiny component does with no dependencies. Keeping it separate
//   means the public site loads fast and TipTap is only downloaded when an
//   admin actually opens an edit dialog (see editable-section.tsx).
//
// Safety note:
//   The HTML rendered here is only ever authored by logged-in club admins via
//   the TipTap editor — it is not user-submitted content, so rendering it
//   directly is acceptable for this site.
// =============================================================================

import { cn } from "@/lib/utils";

export function RichTextDisplay({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return (
    <div
      // "prose" classes come from @tailwindcss/typography and give the saved
      // HTML sensible default styling (headings, lists, links, spacing).
      className={cn("prose prose-stone prose-sm max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default RichTextDisplay;
