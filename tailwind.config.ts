import type { Config } from "tailwindcss";

// The two colour families used across the site ("maroon" for the club's
// primary colour, "gold" for its accent) are built from the club's own
// colours at runtime, not fixed to the first club's maroon and gold. Every
// shade is a mix of the club colour (a CSS variable set from Admin -> Settings
// -> Club Colours) with white, or with a darker shade. Change the colour in
// the admin panel and the menu bar, footer, buttons, badges and links all
// follow — before, only the page banners did.
//
// The names stay "maroon" and "gold" so no page has to change; read them as
// "primary" and "accent".
const mix = (variable: string, percent: number, other: string) =>
  `color-mix(in srgb, var(${variable}) ${percent}%, ${other})`;

const primary = {
  DEFAULT: "var(--brand-primary)",
  50: mix("--brand-primary", 5, "white"),
  100: mix("--brand-primary", 14, "white"),
  200: mix("--brand-primary", 32, "white"),
  300: mix("--brand-primary", 52, "white"),
  400: mix("--brand-primary", 70, "white"),
  500: mix("--brand-primary", 84, "white"),
  600: mix("--brand-primary", 93, "white"),
  700: "var(--brand-primary)",
  800: mix("--brand-primary", 55, "var(--brand-primary-dark)"),
  900: "var(--brand-primary-dark)",
};

const accent = {
  DEFAULT: "var(--brand-accent)",
  50: mix("--brand-accent", 8, "white"),
  100: mix("--brand-accent", 22, "white"),
  200: mix("--brand-accent", 45, "white"),
  300: mix("--brand-accent", 68, "white"),
  400: mix("--brand-accent", 85, "white"),
  500: "var(--brand-accent)",
  600: mix("--brand-accent", 82, "black"),
  700: mix("--brand-accent", 63, "black"),
  800: mix("--brand-accent", 44, "black"),
  900: mix("--brand-accent", 25, "black"),
};

export default {
  content: ["./client/src/**/*.{ts,tsx}", "./client/index.html"],
  theme: {
    extend: {
      colors: {
        maroon: primary,
        gold: accent,
        // Text that sits on the accent colour ("text-on-accent").
        "on-accent": "var(--brand-accent-text)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      typography: {
        stone: {
          css: {
            "--tw-prose-links": "var(--brand-primary)",
            "--tw-prose-bold": "#1c1917",
            "--tw-prose-headings": "#1c1917",
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
