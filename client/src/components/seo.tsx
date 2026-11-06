// =============================================================================
// SEO component — client/src/components/seo.tsx
// =============================================================================
// Updates the document <title> and meta tags whenever the user navigates to a
// different page (client-side routing doesn't reload the HTML, so without this
// every page would keep the title of the first page loaded).
//
// The SERVER also injects these same tags into the initial HTML (see
// server/seo-inject.ts) so crawlers/social scrapers that don't run JavaScript
// still get the right metadata. This component keeps things correct for real
// users clicking around the site.
//
// Usage on any page:
//   <SEO path="/about" />
// or override per-page (e.g. a news article):
//   <SEO title="My News Post" description="..." path="/news/123" />
// =============================================================================

import { useEffect } from "react";
import { getSeoForPath, getSiteName } from "@shared/seo";
import { useSettings } from "@/hooks/use-settings";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SEOProps {
  path: string;
  title?: string;
  description?: string;
  image?: string; // absolute or root-relative image URL for social previews
}

// Helper: set (or create) a <meta> tag by name or property
function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Remove a meta tag (used when there's no share picture to point at). */
function removeMeta(attr: "name" | "property", key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

export default function SEO({ path, title, description, image }: SEOProps) {
  const { settings } = useSettings();

  // A page the club made (/p/<slug>) uses its own title and subtitle, the
  // same as the server gives it (server/seo-inject.ts), instead of the home
  // page's. Same query as the page itself, so it costs no extra request.
  const slug = /^\/p\/([^/?#]+)/.exec(path)?.[1] ?? "";
  const { data: custom } = useQuery<{ title: string; subtitle: string | null }>({
    queryKey: [`/api/pages/${slug}`],
    queryFn: () => apiRequest("GET", `/api/pages/${slug}`),
    enabled: !!slug,
    retry: false,
  });

  useEffect(() => {
    const base = getSeoForPath(path, settings);
    const siteName = getSiteName(settings);
    const customTitle = slug && custom ? (siteName ? `${custom.title} | ${siteName}` : custom.title) : undefined;
    const finalTitle = title ?? customTitle ?? base.title;
    const finalDesc = description ?? ((slug && custom?.subtitle) || base.description);
    // One address per page: no trailing slash.
    const cleanPath = path !== "/" ? path.replace(/\/+$/, "") || "/" : "/";
    const url = window.location.origin + cleanPath;
    // The share picture: the home page photo, else the logo, else none at all
    // (rather than a picture that doesn't exist). Matches the server.
    const absolute = (u: string) => (u.startsWith("http") ? u : u.startsWith("/") ? window.location.origin + u : "");
    const shareImage = absolute(image ?? settings?.hero_image_url ?? "") || absolute(settings?.club_logo_url ?? "");
    const largeCard = !!(image || settings?.hero_image_url);

    document.title = finalTitle;
    setMeta("name", "description", finalDesc);
    if (base.keywords) setMeta("name", "keywords", base.keywords);

    // Open Graph (Facebook, WhatsApp, LinkedIn, etc.)
    setMeta("property", "og:title", finalTitle);
    setMeta("property", "og:description", finalDesc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", siteName);
    if (shareImage) setMeta("property", "og:image", shareImage);
    else removeMeta("property", "og:image");

    // Twitter card
    setMeta("name", "twitter:card", largeCard ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", finalTitle);
    setMeta("name", "twitter:description", finalDesc);
    if (shareImage) setMeta("name", "twitter:image", shareImage);
    else removeMeta("name", "twitter:image");

    setCanonical(url);
  }, [path, title, description, image, settings, custom, slug]);

  return null;
}
