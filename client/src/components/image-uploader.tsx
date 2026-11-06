import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shrinkImage, formatBytes } from "@/lib/resize-image";

interface ImageUploaderProps {
  value?: string;            // current image URL
  onChange: (url: string | undefined) => void;
  label?: string;
  className?: string;
  hint?: string;
  /** Accept several photos at once (the photo library). Each one that uploads
   *  is passed to onChange in turn. */
  multiple?: boolean;
}

export default function ImageUploader({ value, onChange, label = "Image", className, hint, multiple }: ImageUploaderProps) {
  const [uploading, setUploading] = useState<string | null>(null);   // progress text while busy
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Upload one photo; returns its address, or throws with a readable reason. */
  const uploadOne = async (file: File): Promise<{ url: string; saved: number }> => {
    if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo (JPG, PNG, GIF or WebP).`);
    // Size is checked after resizing, since a large photo is usually rescued
    // by it — refusing first would reject pictures the site can happily take.
    // Shrinking a phone photo before it goes anywhere also makes the upload
    // itself quicker.
    const upload = await shrinkImage(file);
    const fd = new FormData();
    fd.append("file", upload);
    const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) {
      const reason = (await res.json().catch(() => ({}))).message ?? "Upload failed";
      throw new Error(`${file.name}: ${reason}`);
    }
    const { url } = await res.json() as { url: string };
    return { url, saved: file.size - upload.size };
  };

  /** One photo or many, one after another, carrying on past any that fail. */
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setNote(null);
    const failures: string[] = [];
    let done = 0, saved = 0;
    for (const [n, file] of files.entries()) {
      setUploading(files.length > 1 ? `Uploading ${n + 1} of ${files.length}…` : "Uploading…");
      try {
        const result = await uploadOne(file);
        saved += Math.max(0, result.saved);
        done++;
        onChange(result.url);
      } catch (e: any) {
        failures.push(e.message ?? `${file.name}: upload failed`);
      }
    }
    setUploading(null);
    if (failures.length > 0) setError(failures.join(" · "));
    if (done > 0) {
      const what = files.length > 1 ? `${done} of ${files.length} photos uploaded.` : "";
      const shrunk = saved > 0 ? ` Resized to save ${formatBytes(saved)}, so pages load quickly.` : "";
      if (what || shrunk) setNote((what + shrunk).trim());
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium text-stone-700">{label}</p>}

      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
          <img src={value} alt="Uploaded" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" className="bg-white" onClick={() => inputRef.current?.click()} disabled={!!uploading}>
              <Upload className="h-4 w-4" /> Change
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onChange(undefined)}>
              <X className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-stone-300 rounded-lg p-6 text-center cursor-pointer hover:border-maroon-400 hover:bg-maroon-50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (uploading) return;
            const dropped = Array.from(e.dataTransfer.files);
            handleFiles(multiple ? dropped : dropped.slice(0, 1));
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-stone-500" role="status">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-maroon-600 border-t-transparent" />
              <p className="text-sm">{uploading}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-stone-500">
              <ImageIcon className="h-10 w-10" />
              <p className="text-sm font-medium text-stone-600">
                {multiple ? "Click to choose photos, or drag them here" : "Click to upload or drag & drop"}
              </p>
              <p className="text-xs">JPG, PNG, GIF, WebP — max 8 MB</p>
            </div>
          )}
        </div>
      )}

      {hint && <p className="text-xs text-stone-500">{hint}</p>}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {note && <p className="text-xs text-green-700" role="status">{note}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
