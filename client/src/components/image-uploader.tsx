import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  value?: string;            // current image URL
  onChange: (url: string | undefined) => void;
  label?: string;
  className?: string;
  hint?: string;
}

export default function ImageUploader({ value, onChange, label = "Image", className, hint }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Only image files allowed (JPG, PNG, GIF, WebP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Upload failed");
      const { url } = await res.json() as { url: string };
      onChange(url);
    } catch (e: any) {
      setError(e.message ?? "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium text-stone-700">{label}</p>}

      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
          <img src={value} alt="Uploaded" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" className="bg-white" onClick={() => inputRef.current?.click()} disabled={uploading}>
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
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-stone-400">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-maroon-600 border-t-transparent" />
              <p className="text-sm">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-stone-400">
              <ImageIcon className="h-10 w-10" />
              <p className="text-sm font-medium text-stone-600">Click to upload or drag & drop</p>
              <p className="text-xs">JPG, PNG, GIF, WebP — max 8 MB</p>
            </div>
          )}
        </div>
      )}

      {hint && <p className="text-xs text-stone-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
