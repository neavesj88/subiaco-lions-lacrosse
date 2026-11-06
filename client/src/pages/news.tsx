// =============================================================================
// News — client/src/pages/news.tsx
// =============================================================================
// Every published news post, in full, newest first (pinned posts at the top).
//
// The home page shows the latest three as short cards; this is where a visitor
// reads the rest, and where "Read more" on those cards leads. Each post has
// its own anchor (/news#post-12), so a link to one post can be shared.
//
// SHOULD A CLUB EDIT THIS FILE?  No. Posts are written in Admin -> News.
// =============================================================================

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { useSiteText } from "@/hooks/use-site-text";
import { RichTextDisplay } from "@/components/rich-text-display";
import type { Announcement } from "@shared/schema";

export default function News() {
  const t = useSiteText();
  const { data: posts = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements", "all"],
    queryFn: () => apiRequest("GET", "/api/announcements?limit=200"),
  });

  // Arriving from a "Read more" link: scroll to that post once it's on screen.
  useEffect(() => {
    if (posts.length === 0 || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [posts.length]);

  return (
    <>
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Megaphone className="h-12 w-12 text-gold-400 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-4xl font-extrabold mb-2">{t("home_news_heading")}</h1>
        </div>
      </section>

      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto space-y-10">
          {isLoading && <p className="text-center text-stone-500">Loading…</p>}
          {!isLoading && posts.length === 0 && (
            <p className="text-center text-stone-500 py-12">No news yet — check back soon.</p>
          )}
          {posts.map((post) => (
            <article key={post.id} id={`post-${post.id}`} className="scroll-mt-24 border-b pb-10 last:border-0">
              {post.featuredImageUrl && (
                <img src={post.featuredImageUrl} alt="" className="w-full max-h-96 object-cover rounded-xl mb-5" />
              )}
              <p className="text-sm text-stone-500 mb-1">
                {post.isPinned && <span className="font-semibold text-gold-700 mr-2">📌 Pinned</span>}
                <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
              </p>
              <h2 className="text-2xl font-bold text-stone-900 mb-4">{post.title}</h2>
              <RichTextDisplay html={post.content} className="space-y-4 text-stone-700 leading-relaxed" />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
