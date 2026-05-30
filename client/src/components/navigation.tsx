import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/calendar", label: "Calendar" },
  { href: "/juniors", label: "Juniors" },
  { href: "/sign-up", label: "Sign Up" },
];

export default function Navigation() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <nav className="bg-maroon-700 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-maroon-900 font-bold text-lg shadow-md">
              L
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm sm:text-base">Subiaco Lions</div>
              <div className="text-gold-300 text-xs">Lacrosse Club</div>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
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
            ))}

            {user ? (
              <Link href="/admin" className="ml-2">
                <Button size="sm" variant="gold" className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </Button>
              </Link>
            ) : null}
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
            {navLinks.map((l) => (
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
            {user && (
              <Link href="/admin" onClick={() => setOpen(false)}>
                <Button size="sm" variant="gold" className="w-full mt-2 gap-1.5">
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
