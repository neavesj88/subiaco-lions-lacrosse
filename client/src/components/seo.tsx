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
import { getSeoForPath, SITE_NAME } from "@shared/seo";

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

export default function SEO({ path, title, description, image }: SEOProps) {
  useEffect(() => {
    const base = getSeoForPath(path);
    const finalTitle = title ?? base.title;
    const finalDesc = description ?? base.description;
    const url = window.location.origin + path;
    const ogImage = image
      ? (image.startsWith("http") ? image : window.location.origin + image)
      : window.location.origin + "/og-image.jpg";

    document.title = finalTitle;
    setMeta("name", "description", finalDesc);
    if (base.keywords) setMeta("name", "keywords", base.keywords);

    // Open Graph (Facebook, WhatsApp, LinkedIn, etc.)
    setMeta("property", "og:title", finalTitle);
    setMeta("property", "og:description", finalDesc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:image", ogImage);

    // Twitter card
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", finalTitle);
    setMeta("name", "twitter:description", finalDesc);
    setMeta("name", "twitter:image", ogImage);

    setCanonical(url);
  }, [path, title, description, image]);

  return null;
}
