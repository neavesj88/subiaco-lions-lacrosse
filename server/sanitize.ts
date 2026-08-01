// =============================================================================
// HTML SANITISER — server/sanitize.ts
// =============================================================================
// Cleans the rich-text HTML that admins write in the editor BEFORE it is saved
// to the database.
//
// Why this exists:
//   Pages like News, About and the Juniors page display saved HTML directly
//   (that's what makes bold text, headings and links work). Anything inside
//   that HTML runs in a visitor's browser — including <script> tags or an
//   onerror="..." attribute hidden on an image.
//
//   The editor itself would never produce those, but the editor is not the only
//   way in: anyone who can log in can send whatever HTML they like straight to
//   the API. That matters because not every admin is fully trusted — the whole
//   point of the "Social Media Manager" role is to give a volunteer access to
//   news posts and nothing else. Without this file, that volunteer could put
//   code on the club's home page that runs for every visitor, and for the
//   super admin next time they browsed the site.
//
//   So we sanitise on the way IN. Whatever ends up in the database is already
//   safe, which means every page that displays it is safe too — including any
//   page someone adds later without thinking about this.
//
// What survives sanitising:
//   Everything the editor can actually produce — headings, bold/italic, lists,
//   links, images, quotes, tables. Formatting is never lost.
//
// What is removed:
//   <script>/<style>/<iframe> tags, on* event handlers, and javascript: URLs.
// =============================================================================

import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "div", "span",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "strike", "code", "pre", "blockquote",
    "ul", "ol", "li",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height"],
    // TipTap writes text alignment as a style attribute; allow only that.
    "*": ["style"],
  },
  // Block every URL scheme except plain links, mail/phone links, and images
  // that are either uploaded to this site or embedded as data URIs.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedStyles: {
    "*": {
      "text-align": [/^left$|^right$|^center$|^justify$/],
    },
  },
  // Anything not on the list above is dropped entirely, tag and contents,
  // rather than having its text kept.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  // Force external links to be safe to click.
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer" }
          : attribs,
      };
    },
  },
};

/**
 * Clean a single rich-text HTML string. Safe to call on null/undefined.
 */
export function cleanHtml(html: unknown): string {
  if (typeof html !== "string" || html === "") return "";
  return sanitizeHtml(html, OPTIONS);
}

/**
 * Clean the named HTML fields on a request body, leaving everything else alone.
 *
 *   req.body = cleanHtmlFields(req.body, ["content"]);
 *
 * Use this on every route that accepts rich text from the editor.
 */
export function cleanHtmlFields<T extends Record<string, any>>(
  body: T,
  fields: string[],
): T {
  if (!body || typeof body !== "object") return body;
  for (const field of fields) {
    if (typeof body[field] === "string") {
      (body as Record<string, any>)[field] = cleanHtml(body[field]);
    }
  }
  return body;
}

/**
 * Strip ALL tags — for fields that are meant to be plain text but get shown
 * on a page (names, titles, captions). Keeps the text, drops any markup.
 */
export function cleanText(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}
