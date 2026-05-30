import { Link } from "wouter";
import { Facebook, Instagram, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-maroon-900 text-maroon-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Club info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-gold-500 flex items-center justify-center text-maroon-900 font-bold">L</div>
              <div>
                <div className="font-bold text-white">Subiaco Lions</div>
                <div className="text-gold-400 text-xs">Lacrosse Club</div>
              </div>
            </div>
            <p className="text-sm text-maroon-300 leading-relaxed">
              Perth's home of lacrosse since 1940. Men's, Women's and Junior teams competing across all divisions of Lacrosse WA.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/about", label: "About the Club" },
                { href: "/calendar", label: "Club Calendar" },
                { href: "/juniors", label: "Juniors Program" },
                { href: "/sign-up", label: "Sign Up to Play" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-maroon-300 hover:text-gold-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://lacrossewa.com.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-maroon-300 hover:text-gold-400 transition-colors"
                >
                  Lacrosse WA
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact & Find Us</h3>
            <div className="space-y-3 text-sm">
              <a
                href="mailto:subiacolacrosseclub@outlook.com"
                className="flex items-center gap-2 text-maroon-300 hover:text-gold-400 transition-colors"
              >
                <Mail className="h-4 w-4 shrink-0" />
                subiacolacrosseclub@outlook.com
              </a>
              <div className="flex items-start gap-2 text-maroon-300">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Rosalie Park, Shenton Park WA 6008</span>
              </div>
              <div className="flex gap-3 pt-2">
                <a
                  href="https://www.facebook.com/SubiacoLacrosse/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-maroon-300 hover:text-gold-400 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a
                  href="https://www.instagram.com/subiacolacrosse_official/"
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
          <p>© {new Date().getFullYear()} Subiaco Lions Lacrosse Club. All rights reserved.</p>
          <p>Affiliated with <a href="https://lacrossewa.com.au" target="_blank" rel="noopener noreferrer" className="text-gold-500 hover:underline">Lacrosse WA</a></p>
        </div>
      </div>
    </footer>
  );
}
