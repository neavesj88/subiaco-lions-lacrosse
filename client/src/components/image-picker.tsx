// =============================================================================
// ImagePicker — client/src/components/image-picker.tsx
// =============================================================================
// A click-to-select image field, modelled on the neaves.au photo manager.
//
// Instead of making admins upload an image elsewhere and paste a URL, this
// component shows the current image and a "Choose image" button. Clicking it
// opens a modal where you can either:
//   1. Drag & drop / click to upload a new image (uploads immediately), OR
//   2. Click any image already in the Media Library to select it
//
// Used anywhere the site needs an image chosen: club logo, hero background,
// sponsor logos, etc. Replaces the old "paste a /uploads/... URL" inputs.
//
// Usage:
//   <ImagePicker value={logoUrl} onChange={(url) => setLogoUrl(url)} label="Club Logo" />
// =============================================================================

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaUpload } from "@shared/schema";

interface ImagePickerProps {
  value?: string;                       // Current image URL (or empty)
  onChange: (url: string | undefined) => void;
  label?: string;
  hint?: string;
  className?: string;
  /** Show a compact thumbnail instead of a full-width preview */
  compact?: boolean;
}

export default function ImagePicker({ value, onChange, label, hint, className, compact }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Load all images already in the Media Library
  const { data: media = [] } = useQuery<MediaUpload[]>({
    queryKey: ["/api/media"],
    queryFn: () => apiRequest("GET", "/api/media"),
    enabled: open, // Only fetch when the picker modal is open
  });

  const images = media.filter((m) => m.mimeType.startsWith("image/"));

  // Upload a brand-new file, then auto-select it
  const handleUpload = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Only image files allowed."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Image must be under 8 MB."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Upload failed");
      const { url } = await res.json() as { url: string };
      qc.invalidateQueries({ queryKey: ["/api/media"] }); // Refresh the grid
      onChange(url);   // Auto-select the new image
      setOpen(false);  // Close the picker
    } catch (e: any) {
      setError(e.message ?? "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium text-stone-700">{label}</p>}

      {/* Current selection preview */}
      <div className="flex items-center gap-3">
        {value ? (
          <div className={cn("relative group rounded-lg overflow-hidden border border-stone-200 bg-stone-50 shrink-0", compact ? "h-16 w-16" : "h-24 w-40")}>
            <img src={value} alt="Selected" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className={cn("rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-stone-300 shrink-0", compact ? "h-16 w-16" : "h-24 w-40")}>
            <ImageIcon className={compact ? "h-6 w-6" : "h-8 w-8"} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            <ImageIcon className="h-4 w-4" /> {value ? "Change image" : "Choose image"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="text-red-500 h-7" onClick={() => onChange(undefined)}>
              <X className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>

      {hint && <p className="text-xs text-stone-500">{hint}</p>}

      {/* Picker modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose an image</DialogTitle>
          </DialogHeader>

          {/* Upload new */}
          <div
            className="border-2 border-dashed border-stone-300 rounded-lg p-4 text-center cursor-pointer hover:border-maroon-400 hover:bg-maroon-50 transition-colors mb-4"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-stone-500 py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-maroon-600 border-t-transparent" />
                Uploading...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-stone-500 py-2">
                <Upload className="h-5 w-5" />
                <span className="text-sm font-medium">Upload a new image</span>
                <span className="text-xs text-stone-500">— or pick one below</span>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-600 -mt-2 mb-2">{error}</p>}

          {/* Existing media grid */}
          {images.length === 0 ? (
            <p className="text-center text-sm text-stone-500 py-8">No images yet — upload your first one above.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
              {images.map((img) => {
                const selected = value === img.url;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => { onChange(img.url); setOpen(false); }}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none",
                      selected ? "border-maroon-600 ring-2 ring-maroon-300" : "border-transparent hover:border-maroon-300"
                    )}
                    title={img.originalName}
                  >
                    <img src={img.url} alt={img.originalName} className="w-full h-full object-cover" />
                    {selected && (
                      <div className="absolute top-1 right-1 bg-maroon-600 text-white rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
