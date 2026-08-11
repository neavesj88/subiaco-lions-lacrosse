// =============================================================================
// Club contact details — client/src/components/club-details.tsx
// =============================================================================
// The club's address, email and map all used to be hardcoded into About,
// Contact, Juniors and the Footer. If the club ever moved grounds or changed
// their email, someone had to edit four files.
//
// Now they come from Admin → Settings → Club Details, via these small shared
// helpers. Everything falls back to the current real values, so nothing breaks
// if a setting is blank.
// =============================================================================

import { useSettings } from "@/hooks/use-settings";
import { resolveText } from "@shared/club-config";


/** Reads the club's contact details from Settings, with safe defaults. */
export function useClubDetails() {
  const { settings } = useSettings();
  return {
    venue: resolveText(settings, "venue_name"),
    address: resolveText(settings, "venue_address"),
    email: resolveText(settings, "contact_email"),
    mapQuery: resolveText(settings, "map_query"),
    // e.g. "Kingsford Oval, Riverside NSW 2000" — for one-line displays
    fullAddress: [
      resolveText(settings, "venue_name"),
      resolveText(settings, "venue_address"),
    ].filter(Boolean).join(", "),

    // Club branding — used in the nav logo, footer and page titles so the club
    // can rename itself (or another club can reuse the site) without code.
    clubName: resolveText(settings, "club_name"),
    clubNameSuffix: resolveText(settings, "club_name_suffix"),
    clubTagline: resolveText(settings, "club_tagline"),
    // "Riverside Rovers Netball Club"
    clubFullName: [
      resolveText(settings, "club_name"),
      resolveText(settings, "club_name_suffix"),
    ].filter(Boolean).join(" "),
  };
}

/**
 * An embedded Google Map of the club's ground.
 *
 * Uses the plain `?q=` embed form so it works with whatever address an admin
 * types — no API key, and no fragile pre-baked coordinates like the old
 * hardcoded embed URL had.
 */
export function ClubMap({ height = 220, className = "" }: { height?: number; className?: string }) {
  const { mapQuery, venue } = useClubDetails();
  return (
    <div className={`rounded-xl overflow-hidden border shadow-sm ${className}`}>
      <iframe
        src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
        width="100%"
        height={height}
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Map of ${venue}`}
      />
    </div>
  );
}
