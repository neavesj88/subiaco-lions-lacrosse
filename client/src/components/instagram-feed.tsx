import { useEffect, useRef } from "react";
import { Instagram } from "lucide-react";

interface InstagramFeedProps {
  feedId?: string;
  handle?: string;
}

export default function InstagramFeed({ feedId, handle = "" }: InstagramFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!feedId || !containerRef.current) return;

    // Remove any previously injected Behold script to avoid duplicates on re-render
    const existing = document.getElementById("behold-widget-script");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "behold-widget-script";
    script.src = "https://w.behold.so/widget.js";
    script.type = "module";
    script.setAttribute("data-behold-id", feedId);
    containerRef.current.appendChild(script);

    return () => {
      script.remove();
    };
  }, [feedId]);

  // No live feed set up: just a "follow us" link if there's a handle, and
  // nothing at all if not. (This used to show visitors a box of setup
  // instructions meant for the admin.)
  if (!feedId) {
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!cleanHandle) return null;
    return (
      <div className="rounded-xl border bg-stone-50 p-8 text-center">
        <Instagram className="h-12 w-12 text-maroon-700 mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm text-stone-600">
          Follow us on Instagram:{" "}
          <a
            href={`https://www.instagram.com/${encodeURIComponent(cleanHandle)}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-maroon-700 hover:underline font-medium"
          >
            @{cleanHandle}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full min-h-48">
      <div id="behold-widget-container" />
    </div>
  );
}
