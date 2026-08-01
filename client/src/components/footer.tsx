import { Link } from "wouter";
import { useClubDetails } from "@/components/club-details";
import { useSettings } from "@/hooks/use-settings";
import { useSiteText } from "@/hooks/use-site-text";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CustomPage } from "@shared/schema";
import { Facebook, Instagram, Mail, MapPin } from "lucide-react";

export default function Footer() {
  // Club address, email and social links come from Admin → Settings
  const club = useClubDetails();
  const { settings } = useSettings();
  const t = useSiteText();

  // Custom pages the admin chose to list in the footer
  const { data: customPages = [] } = useQuery<CustomPage[]>({
    queryKey: ["/api/pages"],
    queryFn: () => apiRequest("GET", "/api/pages"),
    staleTime: 60_000,
  });
  const footerPages = customPages.filter((p) => p.navLocation === "footer");

  return (
    <footer className="bg-maroon-900 text-maroon-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Club info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {settings?.club_logo_url
                ? <img src={settings.club_logo_url} alt={club.clubFullName} className="w-9 h-9 object-contain" />
                : <div className="w-9 h-9 rounded-full bg-gold-500 flex items-center justify-center text-maroon-900 font-bold">{club.clubName.charAt(0)}</div>}
              <div>
                <div className="font-bold text-white">{club.clubName}</div>
                <div className="text-gold-400 text-xs">{club.clubNameSuffix}</div>
              </div>
            </div>
            <p className="text-sm text-maroon-300 leading-relaxed">
              {t("club_tagline")}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/about", label: t("nav_label_about") },
                { href: "/calendar", label: t("nav_label_calendar") },
                { href: "/juniors", label: t("nav_label_juniors") },
                { href: "/sign-up", label: t("nav_label_signup") },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-maroon-300 hover:text-gold-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
              {/* Club-created pages set to appear in the footer */}
              {footerPages.map((p) => (
                <li key={p.id}>
                  <Link href={`/p/${p.slug}`} className="text-maroon-300 hover:text-gold-400 transition-colors">
                    {p.title}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={t("league_url")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-maroon-300 hover:text-gold-400 transition-colors"
                >
                  {t("league_name")}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact & Find Us</h3>
            <div className="space-y-3 text-sm">
              <a
                href={`mailto:${club.email}`}
                className="flex items-center gap-2 text-maroon-300 hover:text-gold-400 transition-colors"
              >
                <Mail className="h-4 w-4 shrink-0" />
                {club.email}
              </a>
              <div className="flex items-start gap-2 text-maroon-300">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{club.fullAddress}</span>
              </div>
              <div className="flex gap-3 pt-2">
                <a
                  href={t("facebook_url")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-maroon-300 hover:text-gold-400 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a
                  href={`https://www.instagram.com/${t("instagram_handle")}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-maroon-300 hover:text-gold-400 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-maroon-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-maroon-400">
          <p>© {new Date().getFullYear()} {club.clubFullName}. All rights reserved.</p>
          <p>Affiliated with <a href={t("league_url")} target="_blank" rel="noopener noreferrer" className="text-gold-500 hover:underline">{t("league_name")}</a></p>
        </div>
      </div>
    </footer>
  );
}
