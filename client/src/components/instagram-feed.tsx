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

  if (!feedId) {
    return (
      <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-8 text-center">
        <Instagram className="h-12 w-12 text-stone-300 mx-auto mb-3" />
        <p className="font-semibold text-stone-600 mb-1">Instagram Feed</p>
        <p className="text-sm text-stone-500 mb-3">
          Follow us{" "}
          <a
            href={`https://www.instagram.com/${handle}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-maroon-600 hover:underline font-medium"
          >
            @{handle}
          </a>
        </p>
        <p className="text-xs text-stone-500">
          (Admin: add your Behold.so Feed ID in Site Settings to display the live feed here)
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
