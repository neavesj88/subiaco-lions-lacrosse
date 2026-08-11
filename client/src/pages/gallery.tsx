import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageContent } from "@/hooks/use-page-content";
import EditableSection from "@/components/editable-section";
import { useSiteText } from "@/hooks/use-site-text";
import type { MediaUpload } from "@shared/schema";

export default function Gallery() {
  const t = useSiteText(); // club-configurable wording
  const [selected, setSelected] = useState<number | null>(null);
  const { get } = usePageContent("gallery");

  const { data: images = [], isLoading } = useQuery<MediaUpload[]>({
    queryKey: ["/api/media"],
    queryFn: () => apiRequest("GET", "/api/media"),
  });

  // Only show images (filter out any non-image uploads)
  const photos = images.filter((i) => i.mimeType.startsWith("image/"));

  const selectedPhoto = selected !== null ? photos[selected] : null;

  const prev = () => setSelected((s) => (s !== null && s > 0 ? s - 1 : s));
  const next = () => setSelected((s) => (s !== null && s < photos.length - 1 ? s + 1 : s));

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <ImageIcon className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <EditableSection page="gallery" section="hero_title" value={get("hero_title", t("page_gallery_title"))} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="gallery" section="hero_subtitle" value={get("hero_subtitle", t("page_gallery_subtitle"))} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading && (
            <div className="text-center py-20 text-stone-500">Loading photos...</div>
          )}

          {!isLoading && photos.length === 0 && (
            <div className="text-center py-20">
              <ImageIcon className="h-16 w-16 text-stone-200 mx-auto mb-4" />
              <p className="text-stone-500 text-lg">No photos yet — check back soon!</p>
            </div>
          )}

          {/* Responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setSelected(idx)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-stone-100 focus:outline-none focus:ring-2 focus:ring-maroon-500"
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? photo.originalName}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {photo.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-xs line-clamp-2">{photo.caption}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl w-full p-2 bg-black/95 border-none">
          <div className="relative flex items-center justify-center min-h-[60vh]">
            {selectedPhoto && (
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption ?? selectedPhoto.originalName}
                className="max-h-[80vh] max-w-full object-contain rounded-lg"
              />
            )}

            {/* Navigation arrows */}
            {selected !== null && selected > 0 && (
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {selected !== null && selected < photos.length - 1 && (
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Close */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Caption + counter */}
          {selectedPhoto && (
            <div className="text-center py-2">
              {selectedPhoto.caption && (
                <p className="text-white/80 text-sm">{selectedPhoto.caption}</p>
              )}
              <p className="text-white/40 text-xs mt-1">
                {selected !== null ? selected + 1 : 0} / {photos.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
