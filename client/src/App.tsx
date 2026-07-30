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

import { useEffect, lazy, Suspense } from "react";
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
import { ADMIN_PATH, ADMIN_LOGIN_PATH } from "@/lib/admin-path";

// Home is loaded eagerly — it's the page most visitors land on first.
import Home from "@/pages/home";

// Everything else loads on demand (see PERFORMANCE note above).
const About = lazy(() => import("@/pages/about"));
const Calendar = lazy(() => import("@/pages/calendar"));
const Fixtures = lazy(() => import("@/pages/fixtures"));
const Gallery = lazy(() => import("@/pages/gallery"));
const SignUp = lazy(() => import("@/pages/sign-up"));
const Juniors = lazy(() => import("@/pages/juniors"));
const Store = lazy(() => import("@/pages/store"));
const Contact = lazy(() => import("@/pages/contact"));
const CoachesBoard = lazy(() => import("@/pages/coaches-board"));
// Pages the club creates themselves in Admin → Pages, served at /p/<slug>
const CustomPage = lazy(() => import("@/pages/custom-page"));
const AdminLogin = lazy(() => import("@/pages/admin/login"));
const AdminDashboard = lazy(() => import("@/pages/admin/index"));
const NotFound = lazy(() => import("@/pages/not-found"));

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
      <main className="flex-1">
        <Suspense fallback={<PageLoading />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/about" component={About} />
            <Route path="/calendar" component={Calendar} />
            <Route path="/fixtures" component={Fixtures} />
            <Route path="/gallery" component={Gallery} />
            <Route path="/sign-up" component={SignUp} />
            <Route path="/juniors" component={Juniors} />
            <Route path="/store" component={Store} />
            <Route path="/contact" component={Contact} />
            <Route path="/coaches-board" component={CoachesBoard} />
            <Route path="/p/:slug" component={CustomPage} />
            <Route path={ADMIN_LOGIN_PATH} component={AdminLogin} />
            <Route path={ADMIN_PATH} component={AdminDashboard} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
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
