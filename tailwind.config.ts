import type { Config } from "tailwindcss";

export default {
  content: ["./client/src/**/*.{ts,tsx}", "./client/index.html"],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: "#7B1E32",
          50: "#FCF3F5",
          100: "#F5DDE2",
          200: "#E9B5BF",
          300: "#D9828F",
          400: "#C65567",
          500: "#A83347",
          600: "#8C2439",
          700: "#7B1E32",
          800: "#5A1424",
          900: "#3A0C17",
        },
        gold: {
          DEFAULT: "#C5942A",
          50: "#FBF4E6",
          100: "#F5E4C0",
          200: "#EBD090",
          300: "#DCBA5A",
          400: "#CFA534",
          500: "#C5942A",
          600: "#A47821",
          700: "#7D5B19",
          800: "#574011",
          900: "#31240A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      typography: {
        stone: {
          css: {
            "--tw-prose-links": "#7B1E32",
            "--tw-prose-bold": "#1c1917",
            "--tw-prose-headings": "#1c1917",
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
