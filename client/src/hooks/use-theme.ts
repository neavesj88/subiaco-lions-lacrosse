// =============================================================================
// useTheme — client/src/hooks/use-theme.ts
// =============================================================================
// Applies the club's colours (stored in Admin → Settings → Club Colours) to
// the whole site at runtime.
//
// How it works:
//   The CSS in index.css doesn't hardcode maroon and gold — it reads CSS
//   variables (--brand-primary, --brand-accent, etc). This hook fetches the
//   admin's saved colours and writes them onto <html>, which instantly
//   restyles every banner, heading, button and accent bar.
//
//   If a colour hasn't been set, the fallback values already in index.css
//   apply, so the site always looks right.
//
// Called once from App.tsx — nothing else needs to use it.
// =============================================================================

import { useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";

// Setting key → the CSS variable it controls
const COLOUR_VARS: Record<string, string> = {
  theme_primary: "--brand-primary",
  theme_primary_dark: "--brand-primary-dark",
  theme_accent: "--brand-accent",
  theme_gradient_angle: "--brand-gradient-angle",
};

export function useTheme() {
  const { settings } = useSettings();

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    for (const [settingKey, cssVar] of Object.entries(COLOUR_VARS)) {
      const value = settings[settingKey];
      // Only override when the admin has actually set something — otherwise
      // leave the default from index.css in place.
      if (value && value.trim()) {
        root.style.setProperty(cssVar, value.trim());
      } else {
        root.style.removeProperty(cssVar);
      }
    }
  }, [settings]);
}
