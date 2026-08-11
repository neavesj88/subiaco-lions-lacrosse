// =============================================================================
// COLOUR READABILITY CHECK — shared/contrast.ts
// =============================================================================
// WHAT THIS IS
// Works out whether text will actually be readable on top of a colour the club
// has chosen, and warns them if it will not.
//
// WHY IT EXISTS
// The club picks its own colours in Admin -> Settings, and those colours are
// used as the background of every banner and button with white text on top.
// A club that picks a bright yellow or a pale sky blue gets a site that looks
// fine to someone who chose it and is genuinely unreadable to anyone with
// less-than-perfect eyesight, in sunlight at a ground, or on a cheap phone.
// Nobody choosing club colours is thinking about contrast ratios, so the site
// has to do that thinking for them.
//
// The numbers come from the international accessibility standard (WCAG 2.2).
// 4.5 is the minimum for ordinary text; 3.0 is allowed for large headings.
//
// SHOULD A CLUB EDIT THIS FILE?  No. Change your colours in Admin -> Settings.
// =============================================================================

/**
 * Turn "#7B1E32" into its red, green and blue parts.
 * In: a hex colour, with or without the #. Out: [r,g,b], or null if the text
 * isn't a colour we understand (a half-typed value, for instance).
 */
function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  // Accept both the short form (#abc) and the long form (#aabbcc), because
  // colour pickers and hand-typed values both turn up here.
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** How bright a colour is to the human eye, on the scale the standard defines. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const n = v / 255;
    // The standard's own curve. It is not a plain average because human eyes
    // are far more sensitive to green than to blue.
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * How different two colours are, as the standard's ratio.
 * In: two hex colours. Out: a number from 1 (identical, invisible) to 21
 * (black on white). Returns null if either colour can't be read.
 */
export function contrastRatio(colourA: string, colourB: string): number | null {
  const a = parseHex(colourA);
  const b = parseHex(colourB);
  if (!a || !b) return null;
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Plain-English verdict on a colour a club has chosen for a banner or button
 * that will have WHITE text on it.
 *
 * In: the chosen hex colour. Out: whether it's fine, and a sentence to show
 * them if it isn't. Exists so the settings screen can warn at the moment of
 * choosing, rather than the club finding out from a member who can't read it.
 */
export function checkTextOnColour(background: string): {
  ok: boolean;
  ratio: number | null;
  message: string;
} {
  const ratio = contrastRatio("#FFFFFF", background);

  if (ratio === null) {
    return { ok: false, ratio: null, message: "That doesn't look like a colour. Use a value like #7B1E32." };
  }
  if (ratio >= 4.5) {
    return { ok: true, ratio, message: "White text reads clearly on this colour." };
  }
  if (ratio >= 3) {
    return {
      ok: false,
      ratio,
      message:
        "Large headings will be readable on this colour, but smaller white text will be hard to read. " +
        "A darker shade would be safer.",
    };
  }
  return {
    ok: false,
    ratio,
    message:
      "White text will be very hard to read on this colour, especially outdoors or for anyone with " +
      "impaired vision. Pick a noticeably darker shade of the same colour.",
  };
}
