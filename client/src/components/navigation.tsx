import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Shield, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMIN_PATH } from "@/lib/admin-path";
import { useClubDetails } from "@/components/club-details";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CustomPage } from "@shared/schema";

export default function Navigation() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [clubOpen, setClubOpen] = useState(false);
  const { user } = useAuth();
  const { pageEnabled, settings } = useSettings();
  const club = useClubDetails(); // club name from Admin → Settings

  // Pages the club created themselves (Admin → Pages). Each one chooses whether
  // it appears in the main bar, the Club dropdown, the footer, or nowhere.
  const { data: customPages = [] } = useQuery<CustomPage[]>({
    queryKey: ["/api/pages"],
    queryFn: () => apiRequest("GET", "/api/pages"),
    staleTime: 60_000,
  });
  const customIn = (where: string) =>
    customPages.filter((p) => p.navLocation === where);

  // "Club" dropdown — only shows items that are enabled in Admin → Settings
  const clubItems = [
    { href: "/calendar",      label: "Calendar",       key: "calendar"      },
    { href: "/fixtures",      label: "Fixtures",       key: "fixtures"      },
    { href: "/gallery",       label: "Photo Gallery",  key: "gallery"       },
    { href: "/store",         label: "Store",          key: "store"         },
    { href: "/coaches-board", label: "Coaches Board",  key: "coaches_board" },
    { href: "/committee",     label: "President & Board", key: "committee"  },
  ]
    .filter((item) => item.key === "calendar" || pageEnabled(item.key))
    // Custom pages set to "In the Club menu" join the same dropdown
    .concat(customIn("club_menu").map((p) => ({
      href: `/p/${p.slug}`, label: p.title, key: `custom_${p.id}`,
    })));
  // Calendar is always shown — it's core club functionality

  const clubActive = clubItems.some((i) => location === i.href);

  return (
    <nav className="bg-maroon-700 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            {settings?.club_logo_url ? (
              <img src={settings.club_logo_url} alt={club.clubFullName} className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-maroon-900 font-bold text-lg shadow-md">
                L
              </div>
            )}
            <div className="leading-tight hidden sm:block">
              <div className="font-bold text-sm">{club.clubName}</div>
              <div className="text-gold-300 text-xs">{club.clubNameSuffix}</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">

            <Link href="/" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location === "/" ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600")}>
              Home
            </Link>

            <Link href="/about" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location === "/about" ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600")}>
              About
            </Link>

            {/* Club dropdown */}
            {clubItems.length > 0 && (
              <div className="relative" onMouseLeave={() => setClubOpen(false)}>
                <button
                  className={cn("flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors", clubActive ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600")}
                  onMouseEnter={() => setClubOpen(true)}
                  onClick={() => setClubOpen((p) => !p)}
                >
                  Club <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", clubOpen && "rotate-180")} />
                </button>
                {clubOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-xl border py-1 z-50">
                    {clubItems.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setClubOpen(false)}
                        className={cn("block px-4 py-2 text-sm transition-colors", location === item.href ? "text-maroon-700 font-semibold bg-maroon-50" : "text-stone-700 hover:bg-stone-50 hover:text-maroon-700")}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pageEnabled("juniors") && (
              <Link href="/juniors" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location === "/juniors" ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600")}>
                Juniors
              </Link>
            )}

            <Link href="/contact" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location === "/contact" ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600")}>
              Contact
            </Link>

            {/* Custom pages the admin chose to put in the main menu bar */}
            {customIn("main").map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location === `/p/${p.slug}` ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600")}
              >
                {p.title}
              </Link>
            ))}

            <Link href="/sign-up" className="ml-1">
              <Button size="sm" variant="gold">Join Up</Button>
            </Link>

            {user && (
              <Link href={ADMIN_PATH} className="ml-1">
                <Button size="sm" variant="outline" className="border-maroon-400 text-white hover:bg-maroon-600 gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Admin
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile burger */}
          <button className="md:hidden p-2 rounded-md text-maroon-100 hover:bg-maroon-600" onClick={() => setOpen(!open)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-maroon-800 border-t border-maroon-600">
          <div className="px-4 py-3 flex flex-col gap-1">
            {[
              { href: "/",        label: "Home",          show: true },
              { href: "/about",   label: "About",         show: true },
              { href: "/calendar",label: "Calendar",      show: true },
              { href: "/fixtures",label: "Fixtures",      show: pageEnabled("fixtures") },
              { href: "/gallery", label: "Photo Gallery", show: pageEnabled("gallery") },
              { href: "/store",   label: "Store",         show: pageEnabled("store") },
              { href: "/coaches-board", label: "Coaches Board", show: pageEnabled("coaches_board") },
              { href: "/committee", label: "President & Board", show: pageEnabled("committee") },
              { href: "/juniors", label: "Juniors",       show: pageEnabled("juniors") },
              { href: "/contact", label: "Contact",       show: true },
              // Custom pages listed anywhere except "hidden" appear on mobile,
              // where there's no separate dropdown/footer distinction.
              ...customPages
                .filter((p) => p.navLocation !== "hidden")
                .map((p) => ({ href: `/p/${p.slug}`, label: p.title, show: true })),
            ].filter((l) => l.show).map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={cn("block px-3 py-2.5 rounded-md text-sm font-medium transition-colors", location === l.href ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-700")}>
                {l.label}
              </Link>
            ))}
            <Link href="/sign-up" onClick={() => setOpen(false)}>
              <Button size="sm" variant="gold" className="w-full mt-1">Join Up</Button>
            </Link>
            {user && (
              <Link href={ADMIN_PATH} onClick={() => setOpen(false)}>
                <Button size="sm" variant="outline" className="w-full mt-1 border-maroon-400 text-white gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Admin Panel
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
