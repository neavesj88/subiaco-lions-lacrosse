import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import EditModeBanner from "@/components/edit-mode-banner";
import SEO from "@/components/seo";
import { ADMIN_PATH, ADMIN_LOGIN_PATH } from "@/lib/admin-path";
import Home from "@/pages/home";
import About from "@/pages/about";
import Calendar from "@/pages/calendar";
import Fixtures from "@/pages/fixtures";
import Gallery from "@/pages/gallery";
import SignUp from "@/pages/sign-up";
import Juniors from "@/pages/juniors";
import Store from "@/pages/store";
import Contact from "@/pages/contact";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/index";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  // Don't apply public SEO to admin pages (they shouldn't be indexed)
  const isAdmin = location.startsWith(ADMIN_PATH);

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
          <Route path={ADMIN_LOGIN_PATH} component={AdminLogin} />
          <Route path={ADMIN_PATH} component={AdminDashboard} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
      <Toaster />
      <EditModeBanner />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
