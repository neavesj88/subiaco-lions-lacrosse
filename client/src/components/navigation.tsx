import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Shield, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  {
    label: "Club",
    children: [
      { href: "/calendar", label: "Calendar" },
      { href: "/fixtures", label: "Fixtures" },
      { href: "/store", label: "Store" },
    ],
  },
  { href: "/juniors", label: "Juniors" },
  { href: "/contact", label: "Contact" },
];

export default function Navigation() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [clubOpen, setClubOpen] = useState(false);
  const { user } = useAuth();

  const isClubActive = ["/calendar", "/fixtures", "/store"].includes(location);

  return (
    <nav className="bg-maroon-700 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-maroon-900 font-bold text-lg shadow-md">
              L
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-bold text-sm">Subiaco Lions</div>
              <div className="text-gold-300 text-xs">Lacrosse Club</div>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((l) => {
              if ("children" in l) {
                return (
                  <div key={l.label} className="relative" onMouseLeave={() => setClubOpen(false)}>
                    <button
                      className={cn(
                        "flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isClubActive ? "bg-maroon-900 text-white" : "text-maroon-100 hover:bg-maroon-600 hover:text-white"
                      )}
                      onMouseEnter={() => setClubOpen(true)}
                      onClick={() => setClubOpen((p) => !p)}
                    >
                      {l.label}
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", clubOpen && "rotate-180")} />
                    </button>
                    {clubOpen && (
                      <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-xl border py-1 z-50">
                        {l.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setClubOpen(false)}
                            className={cn(
                              "block px-4 py-2 text-sm transition-colors",
                              location === child.href
                                ? "text-maroon-700 font-semibold bg-maroon-50"
                                : "text-stone-700 hover:bg-stone-50 hover:text-maroon-700"
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location === l.href
                      ? "bg-maroon-900 text-white"
                      : "text-maroon-100 hover:bg-maroon-600 hover:text-white"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}

            <Link href="/sign-up" className="ml-1">
              <Button size="sm" variant="gold">Join Up</Button>
            </Link>

            {user && (
              <Link href="/admin" className="ml-1">
                <Button size="sm" variant="outline" className="border-maroon-400 text-white hover:bg-maroon-600 gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-md text-maroon-100 hover:bg-maroon-600"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-maroon-800 border-t border-maroon-600">
          <div className="px-4 py-3 flex flex-col gap-1">
            {[
              { href: "/", label: "Home" },
              { href: "/about", label: "About" },
              { href: "/calendar", label: "Calendar" },
              { href: "/fixtures", label: "Fixtures" },
              { href: "/store", label: "Store" },
              { href: "/juniors", label: "Juniors" },
              { href: "/contact", label: "Contact" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  location === l.href
                    ? "bg-maroon-900 text-white"
                    : "text-maroon-100 hover:bg-maroon-700"
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link href="/sign-up" onClick={() => setOpen(false)}>
              <Button size="sm" variant="gold" className="w-full mt-1">Join Up</Button>
            </Link>
            {user && (
              <Link href="/admin" onClick={() => setOpen(false)}>
                <Button size="sm" variant="outline" className="w-full mt-1 border-maroon-400 text-white gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Admin Panel
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
