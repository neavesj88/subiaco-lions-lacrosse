// =============================================================================
// MediaLibrary — client/src/pages/admin/media-library.tsx
// =============================================================================
// The "Media" tab: the club's photo library.
//
// Designed to answer the questions a volunteer actually has when they open it:
//   "What IS this page?"        → a plain-English explainer at the top
//   "How do I add a photo?"     → one obvious upload box
//   "Where do these show up?"   → stated explicitly (the Gallery page)
//   "Can I crop/move them?"     → answered honestly in the help text
//   "Where's that photo from
//    the grand final?"          → search + filter by date + sort
//
// Photos are shown newest-first by default, grouped so the date is obvious.
// =============================================================================

import { useState, useMemo } from "react";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ImageUploader from "@/components/image-uploader";
import { Trash2, Search, ImageIcon, Copy, Info } from "lucide-react";
import type { MediaUpload } from "@shared/schema";

// Date-range options for the filter dropdown
type DateFilter = "all" | "7" | "30" | "90" | "365";
const DATE_LABELS: Record<DateFilter, string> = {
  all: "Any time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 3 months",
  "365": "Last year",
};

export default function MediaLibrary({
  items,
  onChanged,
}: {
  items: MediaUpload[];
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");

  // ── Apply search + date filter + sort ─────────────────────────────────────
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const cutoff =
      dateFilter === "all" ? null : Date.now() - parseInt(dateFilter) * 24 * 60 * 60 * 1000;

    const filtered = items.filter((m) => {
      if (cutoff && new Date(m.createdAt).getTime() < cutoff) return false;
      if (!term) return true;
      // Search matches the filename OR the caption
      return (
        m.originalName.toLowerCase().includes(term) ||
        (m.caption ?? "").toLowerCase().includes(term)
      );
    });

    return filtered.sort((a, b) => {
      if (sort === "name") return a.originalName.localeCompare(b.originalName);
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "newest" ? diff : -diff;
    });
  }, [items, search, dateFilter, sort]);

  const saveCaption = (m: MediaUpload, caption: string) => {
    if (caption === (m.caption ?? "")) return; // nothing changed
    apiRequest("PUT", `/api/media/${m.id}/caption`, { caption })
      .then(() => { onChanged(); toast({ title: "Caption saved" }); })
      .catch((err) => toast({ title: "Error", description: err.message, variant: "destructive" }));
  };

  const remove = (m: MediaUpload) => {
    if (!confirm(`Delete "${m.originalName}"?\n\nIt will be removed from the photo gallery. This can't be undone.`)) return;
    const done = () => { onChanged(); toast({ title: "Photo deleted" }); };
    apiRequest("DELETE", `/api/media/${m.id}`)
      .then(done)
      .catch((e) => {
        // The server refuses at first if the photo is still in use, and says
        // where, so nobody breaks the club logo by tidying up the library.
        const usedIn = e instanceof ApiError && e.status === 409 ? (e.data.usedIn as string[] | undefined) : undefined;
        if (usedIn?.length) {
          const list = usedIn.map((p) => `  • ${p}`).join("\n");
          if (!confirm(`"${m.originalName}" is still used on the site:\n\n${list}\n\nDelete it anyway? Those places will show a broken image until you choose another photo.`)) return;
          apiRequest("DELETE", `/api/media/${m.id}?force=1`)
            .then(done)
            .catch((e2) => toast({ title: "Error", description: e2.message, variant: "destructive" }));
          return;
        }
        toast({ title: "Error", description: e.message, variant: "destructive" });
      });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Photo Library</h2>
        <span className="text-sm text-stone-500">
          {visible.length === items.length
            ? `${items.length} photo${items.length === 1 ? "" : "s"}`
            : `Showing ${visible.length} of ${items.length}`}
        </span>
      </div>

      {/* Plain-English explainer — what this page is and what it can/can't do */}
      <Card className="mb-4 bg-maroon-50 border-maroon-200">
        <CardContent className="pt-4 pb-4 text-sm text-maroon-900">
          <p className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <strong>This is the club's photo library.</strong> Everything you upload
              here automatically appears on the public <strong>Photo Gallery</strong> page,
              and can be picked whenever you need an image (news post thumbnails,
              the club logo, the home page banner, sponsor logos).
            </span>
          </p>
          <p className="mt-2 pl-6 text-maroon-800">
            Photos display exactly as uploaded — there's no cropping or reordering
            here, and the gallery always shows newest first. To change how a photo
            looks or is framed, edit it on your phone or computer first, then upload it.
          </p>
        </CardContent>
      </Card>

      {/* Upload */}
      <div className="mb-4 p-4 bg-stone-50 border rounded-xl">
        <p className="text-sm font-medium text-stone-700 mb-2">Add photos</p>
        <ImageUploader
          multiple
          label=""
          onChange={(url) => { if (url) onChanged(); }}
          hint="Drag photos here or click to browse. JPG, PNG, GIF or WebP, up to 8 MB each."
        />
      </div>

      {/* Search / filter / sort — only worth showing once there are photos */}
      {items.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="h-4 w-4 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-8"
                placeholder="Filename or caption…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date added</Label>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DATE_LABELS) as DateFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>{DATE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sort by</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Filename (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Empty states — different message for "none at all" vs "none matched" */}
      {items.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <ImageIcon className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No photos yet</p>
          <p className="text-stone-500 text-sm mt-1">Upload your first one using the box above.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Search className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No photos match your filters</p>
          <Button
            variant="outline" size="sm" className="mt-3"
            onClick={() => { setSearch(""); setDateFilter("all"); }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {visible.map((m) => (
            <div key={m.id} className="rounded-lg overflow-hidden border bg-white flex flex-col">
              <div className="group relative aspect-video bg-stone-100">
                <img src={m.url} alt={m.caption || m.originalName} className="w-full h-full object-cover" />
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs bg-white"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + m.url);
                      toast({ title: "Link copied", description: "Paste it anywhere you need this photo's address." });
                    }}
                  >
                    <Copy className="h-3 w-3" /> Link
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => remove(m)}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>

              <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                {/* Date added — the thing that was missing before */}
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {new Date(m.createdAt).toLocaleDateString("en-AU", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </Badge>
                  <span className="text-[10px] text-stone-500 truncate" title={m.originalName}>
                    {m.originalName}
                  </span>
                </div>
                <Input
                  placeholder="Add a caption…"
                  defaultValue={m.caption ?? ""}
                  className="h-8 text-xs"
                  onBlur={(e) => saveCaption(m, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
