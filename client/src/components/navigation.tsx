// =============================================================================
// THE TOP MENU BAR — client/src/components/navigation.tsx
// =============================================================================
// WHAT THIS IS
// The bar across the top of every public page: the club's logo, the menu, and
// the join button.
//
// SHOULD A CLUB EDIT THIS FILE?  No.
// What appears in the menu, what it is called, what order it is in and which
// items sit inside a dropdown are all set in Admin -> Menu. This file only
// draws whatever that says.
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Shield, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMIN_PATH } from "@/lib/admin-path";
import { useClubDetails } from "@/components/club-details";
import { useSiteText } from "@/hooks/use-site-text";
import { useMenu } from "@/hooks/use-menu";

export default function Navigation() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { user } = useAuth();
  const { settings } = useSettings();
  const club = useClubDetails();
  const t = useSiteText();
  const { tree, flat } = useMenu();

  // Close an open dropdown when the visitor clicks elsewhere or presses Escape.
  // Without this a menu opened by tapping stays open until something else is
  // clicked inside it, which on a phone feels stuck.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openDropdown) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Put keyboard focus back on the dropdown's own button. The menu links
      // disappear as it closes, and without this focus fell back to the top
      // of the page, so a keyboard user had to tab through everything again.
      const trigger = navRef.current?.querySelector<HTMLButtonElement>(
        `[data-dropdown="${CSS.escape(openDropdown)}"]`);
      setOpenDropdown(null);
      trigger?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openDropdown]);

  // Close the menus after moving to another page.
  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [location]);

  const linkClass = (active: boolean) =>
    cn("px-3 py-2 rounded-md text-sm font-medium transition-colors",
      active ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600");

  return (
    <nav ref={navRef} className="bg-maroon-700 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            {settings?.club_logo_url ? (
              <img src={settings.club_logo_url} alt={club.clubFullName} className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-maroon-900 font-bold text-lg shadow-md">
                {club.clubName.charAt(0)}
              </div>
            )}
            <div className="leading-tight hidden sm:block">
              <div className="font-bold text-sm">{club.clubName}</div>
              <div className="text-gold-300 text-xs">{club.clubNameSuffix}</div>
            </div>
          </Link>

          {/* Desktop menu, entirely from Admin -> Menu */}
          <div className="hidden md:flex items-center gap-0.5">
            {tree.map((entry) =>
              entry.children ? (
                <div
                  key={entry.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(entry.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                  // Tabbing out of the dropdown closes it, rather than leaving
                  // it open over the page.
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenDropdown(null); }}
                >
                  <button
                    data-dropdown={entry.label}
                    className={cn("flex items-center gap-1", linkClass(
                      entry.children.some((c) => c.href === location)))}
                    aria-expanded={openDropdown === entry.label}
                    aria-haspopup="true"
                    onClick={() => setOpenDropdown((p) => (p === entry.label ? null : entry.label))}
                  >
                    {entry.label}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform",
                      openDropdown === entry.label && "rotate-180")} />
                  </button>

                  {openDropdown === entry.label && (
                    // pt-1 on the wrapper instead of mt-1 on the panel is the
                    // whole fix for "the menu vanishes before I can click it".
                    // A margin leaves a few pixels of dead space between the
                    // button and the menu; the mouse crosses it, the wrapper
                    // sees the pointer leave, and the menu shuts under the
                    // cursor. Padding keeps that strip inside the wrapper, so
                    // the pointer never actually leaves.
                    <div className="absolute top-full left-0 pt-1 z-50">
                      <div className="w-52 bg-white rounded-lg shadow-xl border py-1">
                        {entry.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpenDropdown(null)}
                            className={cn("block px-4 py-2 text-sm transition-colors",
                              location === child.href
                                ? "text-maroon-700 font-semibold bg-maroon-50"
                                : "text-stone-700 hover:bg-stone-50 hover:text-maroon-700")}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link key={entry.href} href={entry.href!} className={linkClass(location === entry.href)}>
                  {entry.label}
                </Link>
              ),
            )}

            {/* A link styled as a button (asChild), not a button inside a link:
                one thing to tab to, and announced correctly as a link. */}
            <Button asChild size="sm" variant="gold" className="ml-1">
              <Link href="/sign-up">{t("nav_label_signup")}</Link>
            </Button>

            {user && (
              <Button asChild size="sm" variant="outline" className="ml-1 border-maroon-400 text-white hover:bg-maroon-600 gap-1.5">
                <Link href={ADMIN_PATH}><Shield className="h-3.5 w-3.5" aria-hidden="true" /> Admin</Link>
              </Button>
            )}
          </div>

          {/* Mobile burger. 44px square so it's a comfortable thumb target. */}
          <button
            className="md:hidden p-2 min-w-[44px] min-h-[44px] rounded-md text-maroon-100 hover:bg-maroon-600"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — one flat list, since there's no room for dropdowns */}
      {mobileOpen && (
        <div className="md:hidden bg-maroon-800 border-t border-maroon-600">
          <div className="px-4 py-3 flex flex-col gap-1">
            {flat.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn("block px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  location === item.href ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-700")}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild size="sm" variant="gold" className="w-full mt-1">
              <Link href="/sign-up" onClick={() => setMobileOpen(false)}>{t("nav_label_signup")}</Link>
            </Button>
            {user && (
              <Button asChild size="sm" variant="outline" className="w-full mt-1 border-maroon-400 text-white gap-1.5">
                <Link href={ADMIN_PATH} onClick={() => setMobileOpen(false)}>
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" /> Admin Panel
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
