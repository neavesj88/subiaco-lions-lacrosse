// =============================================================================
// CustomPage — client/src/pages/custom-page.tsx
// =============================================================================
// Renders a page the club created themselves in Admin → Pages.
//
// All custom pages live at /p/<slug> (e.g. /p/life-members). The /p/ prefix
// means an admin can never accidentally create a page that collides with a
// built-in route like /about, /contact or the secret admin path.
//
// The page's HTML comes from the rich text editor, so it's styled by the same
// "prose" rules used for news posts — headings, lists, links, tables and images
// all look consistent with the rest of the site without the admin doing anything.
// =============================================================================

import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RichTextDisplay } from "@/components/rich-text-display";
import NotFound from "@/pages/not-found";
import type { CustomPage as CustomPageType } from "@shared/schema";

export default function CustomPage() {
  const [, params] = useRoute("/p/:slug");
  const slug = params?.slug ?? "";

  const { data: page, isLoading, isError } = useQuery<CustomPageType>({
    queryKey: [`/api/pages/${slug}`],
    queryFn: () => apiRequest("GET", `/api/pages/${slug}`),
    enabled: !!slug,
    retry: false, // a 404 is a real answer, not a transient failure
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-maroon-200 border-t-maroon-700" />
      </div>
    );
  }

  // Unknown slug, or the admin unpublished it → show the normal 404 page.
  if (isError || !page) return <NotFound />;

  return (
    <>
      {/* Banner — same style as every other page, using the club's colours */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold mb-4">{page.title}</h1>
          {page.subtitle && <p className="text-maroon-100 text-lg">{page.subtitle}</p>}
        </div>
      </section>

      {/* Body */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <RichTextDisplay
            html={page.content}
            className="prose-base prose-headings:text-maroon-700 prose-a:text-maroon-600"
          />
        </div>
      </section>
    </>
  );
}
