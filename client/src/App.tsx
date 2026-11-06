// =============================================================================
// App — client/src/App.tsx
// =============================================================================
// The root of the React app: sets up routing, data fetching, SEO and the
// global error safety-net.
//
// PERFORMANCE — lazy-loaded routes:
//   Only the Home page is bundled into the initial download. Every other page
//   (and especially the admin panel, which includes the heavy rich-text
//   editor) is split into its own file that the browser fetches on demand.
//   This keeps the first visit fast on phones — important for a club site
//   where most visitors arrive from an Instagram/Facebook link.
//
// To add a new page:
//   1. Create it in client/src/pages/
//   2. Add a lazy import below (copy an existing line)
//   3. Add a <Route> for it inside <Switch>
//   4. Add its SEO entry in shared/seo.ts and nav link in navigation.tsx
// =============================================================================

import { useEffect, lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import EditModeBanner from "@/components/edit-mode-banner";
import ErrorBoundary from "@/components/error-boundary";
import SEO from "@/components/seo";
import { useTheme } from "@/hooks/use-theme";
import { useSettings } from "@/hooks/use-settings";
import { ADMIN_PATH, ADMIN_LOGIN_PATH } from "@/lib/admin-path";

// Home is loaded eagerly — it's the page most visitors land on first.
import Home from "@/pages/home";

/**
 * Load a page's code on demand, recovering from a site update.
 *
 * After the site is updated, the page already open in someone's browser still
 * asks for the OLD code files, which no longer exist, and the visitor got the
 * "Something went wrong" screen. Reloading fetches the new site, so that is
 * done once, automatically. Only once per visit, so a genuinely broken
 * connection shows the error rather than reloading forever.
 */
function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => load().catch((err) => {
    const key = "reloaded-for-site-update";
    let already = true;
    try {
      already = sessionStorage.getItem(key) === "1";
      if (!already) sessionStorage.setItem(key, "1");
    } catch { /* storage blocked: don't risk a reload loop */ }
    if (!already) {
      window.location.reload();
      return new Promise<{ default: T }>(() => {});   // the reload takes over
    }
    throw err;
  }));
}

// Everything else loads on demand (see PERFORMANCE note above).
const About = lazyPage(() => import("@/pages/about"));
const Calendar = lazyPage(() => import("@/pages/calendar"));
const Fixtures = lazyPage(() => import("@/pages/fixtures"));
const Gallery = lazyPage(() => import("@/pages/gallery"));
const SignUp = lazyPage(() => import("@/pages/sign-up"));
const Juniors = lazyPage(() => import("@/pages/juniors"));
const Store = lazyPage(() => import("@/pages/store"));
const StoreCheckout = lazyPage(() => import("@/pages/store-checkout"));
const StoreThankYou = lazyPage(() => import("@/pages/store-result").then((m) => ({ default: m.StoreThankYou })));
const StoreCancelled = lazyPage(() => import("@/pages/store-result").then((m) => ({ default: m.StoreCancelled })));
const Contact = lazyPage(() => import("@/pages/contact"));
const CoachesBoard = lazyPage(() => import("@/pages/coaches-board"));
// Pages the club creates themselves in Admin → Pages, served at /p/<slug>
const CustomPage = lazyPage(() => import("@/pages/custom-page"));
const Committee = lazyPage(() => import("@/pages/committee"));
const News = lazyPage(() => import("@/pages/news"));
const AdminLogin = lazyPage(() => import("@/pages/admin/login"));
const AdminDashboard = lazyPage(() => import("@/pages/admin/index"));
const NotFound = lazyPage(() => import("@/pages/not-found"));

// Shown for the brief moment a lazy page's code is being downloaded.
function PageLoading() {
  return (
    <div className="flex items-center justify-center py-32" aria-label="Loading page">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-maroon-200 border-t-maroon-700" />
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  // Applies the club's chosen colours (Admin → Settings → Club Colours)
  useTheme();
  // Don't apply public SEO to admin pages (they shouldn't be indexed)
  const isAdmin = location.startsWith(ADMIN_PATH);
  // The Coaches Board is a full-screen tool — no footer / edit banner there.
  const isBoard = location === "/coaches-board";

  // A page switched off under Admin -> Settings -> Page Visibility shows "page
  // not found" (the server also answers 404 for it), rather than staying
  // reachable to anyone who knows or bookmarked the address.
  const { pageEnabled } = useSettings();
  const gated = (visibility: string, Page: ComponentType<any>) => (pageEnabled(visibility) ? Page : NotFound);

  // Tell search engines never to index the admin area, even if its URL is found.
  useEffect(() => {
    const id = "admin-noindex";
    const existing = document.getElementById(id);
    if (isAdmin && !existing) {
      const m = document.createElement("meta");
      m.id = id;
      m.name = "robots";
      m.content = "noindex, nofollow";
      document.head.appendChild(m);
    } else if (!isAdmin && existing) {
      existing.remove();
    }
  }, [isAdmin]);

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <SEO path={location} />}
      <Navigation />
      {/* Keyboard-only visitors land on this first. It stays invisible until
          focused, then lets them jump past the navigation straight to the page
          content instead of tabbing through every menu item on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-stone-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)]"
      >
        Skip to main content
      </a>

      <main id="main-content" className="flex-1">
        {/* One page failing shows the error in place of that page only, with
            the menu still there, and clears when the visitor moves on. */}
        <ErrorBoundary key={location}>
        <Suspense fallback={<PageLoading />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/about" component={About} />
            <Route path="/calendar" component={Calendar} />
            <Route path="/fixtures" component={gated("fixtures", Fixtures)} />
            <Route path="/gallery" component={gated("gallery", Gallery)} />
            <Route path="/sign-up" component={SignUp} />
            <Route path="/juniors" component={gated("juniors", Juniors)} />
            <Route path="/store" component={gated("store", Store)} />
            <Route path="/store/checkout" component={gated("store", StoreCheckout)} />
            <Route path="/store/thank-you" component={StoreThankYou} />
            <Route path="/store/cancelled" component={StoreCancelled} />
            <Route path="/contact" component={Contact} />
            <Route path="/coaches-board" component={gated("coaches_board", CoachesBoard)} />
            <Route path="/committee" component={gated("committee", Committee)} />
            <Route path="/news" component={News} />
            <Route path="/p/:slug" component={CustomPage} />
            <Route path={ADMIN_LOGIN_PATH} component={AdminLogin} />
            <Route path={ADMIN_PATH} component={AdminDashboard} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
        </ErrorBoundary>
      </main>
      {!isBoard && <Footer />}
      <Toaster />
      {!isBoard && <EditModeBanner />}
    </div>
  );
}

export default function App() {
  return (
    // ErrorBoundary = if a page crashes, show a friendly message instead of a
    // blank white screen. See components/error-boundary.tsx.
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
