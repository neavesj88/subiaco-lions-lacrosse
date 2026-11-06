// =============================================================================
// AdminPages — client/src/pages/admin/pages.tsx
// =============================================================================
// The "Pages" tab: lets the club create their OWN pages (Life Members, Club
// Policies, Coaching Resources…) without a developer.
//
// The flow is deliberately two steps so a volunteer is never staring at a blank
// screen:
//   1. Pick a TEMPLATE — each one pre-fills a sensible layout with example
//      content they can overwrite.
//   2. Edit freely — after that it's the same rich text editor as news posts,
//      so nothing is locked down.
//
// They also choose where the page appears in the menu (this writes to the same
// menu as Admin -> Menu, so the two always agree), and can save it unpublished
// while it's still a work in progress.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import RichTextEditor from "@/components/rich-text-editor";
import {
  FileText, HelpCircle, Users, Link as LinkIcon, Calendar, File,
  Plus, Pencil, Trash2, ExternalLink, Info,
} from "lucide-react";
import { PAGE_TEMPLATES, getTemplate, slugify } from "@shared/page-templates";
import { dropdownNames, placeOfPage, MAIN, FOOTER, HIDDEN } from "@shared/nav";
import { useMenu } from "@/hooks/use-menu";
import type { CustomPage } from "@shared/schema";

// Template icon names → actual components
const ICONS: Record<string, any> = { FileText, HelpCircle, Users, Link: LinkIcon, Calendar, File };

/** Where a page sits, in plain English. */
function placeLabel(place: string): string {
  if (place === MAIN) return "In the top menu bar";
  if (place === FOOTER) return "In the footer only";
  if (place === HIDDEN) return "Not in any menu";
  return `In the "${place}" dropdown`;
}

export default function AdminPages() {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);      // template chooser open?
  const [editing, setEditing] = useState<Partial<CustomPage> | null>(null);
  // Where the page being edited goes in the menu. Read from the menu itself,
  // which is the one record of what appears where.
  const [menuPlace, setMenuPlace] = useState<string>(HIDDEN);
  const { menu } = useMenu();
  const dropdowns = dropdownNames(menu);
  const placeOptions = [MAIN, ...dropdowns, FOOTER, HIDDEN];

  const { data: pages = [] } = useQuery<CustomPage[]>({
    queryKey: ["/api/pages/all"],
    queryFn: () => apiRequest("GET", "/api/pages/all"),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/pages/all"] });
    qc.invalidateQueries({ queryKey: ["/api/pages"] }); // nav + public list
    // The server updates the menu along with the page.
    qc.invalidateQueries({ queryKey: ["/api/settings"] });
    qc.invalidateQueries({ queryKey: ["/api/settings/secure"] });
  };

  const openEditor = (p: Partial<CustomPage>, place: string) => {
    setMenuPlace(place);
    setEditing(p);
  };

  const save = useMutation({
    mutationFn: (p: Partial<CustomPage>) => {
      const body = { ...p, menuPlace };
      return p.id
        ? apiRequest("PUT", `/api/pages/${p.id}`, body)
        : apiRequest("POST", "/api/pages", body);
    },
    onSuccess: () => { refresh(); setEditing(null); toast({ title: "Page saved" }); },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pages/${id}`),
    onSuccess: () => { refresh(); toast({ title: "Page deleted" }); },
  });

  // Starting a new page from a template
  const startFromTemplate = (templateId: string) => {
    const t = getTemplate(templateId);
    setPicking(false);
    // A new page goes into the club's first dropdown (the "Club" menu on a
    // standard site), as it always did; the editor shows this and it can be
    // changed before saving.
    openEditor({
      title: "", slug: "", subtitle: t.subtitle, content: t.content,
      template: t.id, isPublished: true, sortOrder: 0,
    }, dropdowns[0] ?? MAIN);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Pages</h2>
        <Button size="sm" onClick={() => setPicking(true)}>
          <Plus className="h-4 w-4" /> New Page
        </Button>
      </div>

      <Card className="mb-4 bg-maroon-50 border-maroon-200">
        <CardContent className="pt-4 pb-4 text-sm text-maroon-900">
          <p className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <strong>Add your own pages to the website.</strong> Pick a template to
              start (it fills in an example layout you can overwrite), then edit it
              however you like. Choose where it appears in the menu, or keep it
              unlisted until you're ready.
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Existing pages */}
      {pages.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <FileText className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No extra pages yet</p>
          <p className="text-stone-500 text-sm mt-1 mb-4">
            The nine standard pages (Home, About, Juniors…) are always there — this is for adding your own.
          </p>
          <Button size="sm" onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" /> Create your first page
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-semibold text-stone-900">{p.title}</span>
                    {!p.isPublished && <Badge variant="secondary" className="text-xs">Draft</Badge>}
                    <Badge variant="outline" className="text-xs">
                      {placeLabel(placeOfPage(menu, p.slug))}
                    </Badge>
                  </div>
                  <a
                    href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-maroon-600 hover:underline inline-flex items-center gap-1"
                  >
                    /p/{p.slug} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEditor(p, placeOfPage(menu, p.slug))} title="Edit page" aria-label={`Edit ${p.title}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" title="Delete page" aria-label={`Delete ${p.title}`}
                    onClick={() => {
                      if (confirm(`Delete the page "${p.title}" (/p/${p.slug})?\n\nThe page and its content are removed, and it's taken out of the menu. This can't be undone.`)) {
                        remove.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1 — template chooser */}
      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>What kind of page do you need?</DialogTitle>
            <p className="text-sm text-stone-500">
              Pick the closest match — it just fills in a starting layout, and you can change anything afterwards.
            </p>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            {PAGE_TEMPLATES.map((t) => {
              const Icon = ICONS[t.icon] ?? File;
              return (
                <button
                  key={t.id}
                  onClick={() => startFromTemplate(t.id)}
                  className="text-left p-4 rounded-xl border-2 border-stone-200 hover:border-maroon-500 hover:bg-maroon-50 transition-colors"
                >
                  <Icon className="h-6 w-6 text-maroon-700 mb-2" />
                  <p className="font-semibold text-stone-900 text-sm">{t.name}</p>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">{t.description}</p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2 — the editor */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit "${editing.title}"` : "New page"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Page title *</Label>
                  <Input
                    placeholder="e.g. Life Members"
                    value={editing.title ?? ""}
                    onChange={(e) => {
                      const title = e.target.value;
                      setEditing((p) => ({
                        ...p!,
                        title,
                        // Auto-fill the web address from the title, but only for
                        // NEW pages — changing a live page's URL breaks links.
                        slug: p!.id ? p!.slug : slugify(title),
                      }));
                    }}
                  />
                  <p className="text-xs text-stone-500">Shown in the menu and as the page heading.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Web address</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-stone-500 shrink-0">/p/</span>
                    <Input
                      value={editing.slug ?? ""}
                      onChange={(e) => setEditing((p) => ({ ...p!, slug: slugify(e.target.value) }))}
                    />
                  </div>
                  <p className="text-xs text-stone-500">
                    {editing.id ? "Changing this breaks any existing links to the page." : "Filled in automatically — usually leave it."}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Subtitle (optional)</Label>
                <Input
                  placeholder="One line shown under the heading"
                  value={editing.subtitle ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p!, subtitle: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Page content</Label>
                <p className="text-xs text-stone-500 -mt-1">
                  Overwrite the example text. Use the toolbar for headings, lists, links and photos.
                </p>
                <RichTextEditor
                  value={editing.content ?? ""}
                  onChange={(html) => setEditing((p) => ({ ...p!, content: html }))}
                  minHeight="260px"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Where in the menu?</Label>
                <Select value={menuPlace} onValueChange={setMenuPlace}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {placeOptions.map((place) => (
                      <SelectItem key={place} value={place}>{placeLabel(place)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-stone-500">
                  To change the order, rename the link, or make a new dropdown, use <strong>Menu</strong> (under Club Setup).
                  {!(editing.isPublished ?? true) && " A draft page isn't shown in the menu until you make it visible."}
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border">
                <input
                  type="checkbox"
                  id="page-published"
                  className="rounded"
                  checked={editing.isPublished ?? true}
                  onChange={(e) => setEditing((p) => ({ ...p!, isPublished: e.target.checked }))}
                />
                <Label htmlFor="page-published" className="cursor-pointer font-normal">
                  Visible to visitors (uncheck to keep it as a draft)
                </Label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  disabled={save.isPending || !editing.title?.trim() || !editing.slug?.trim()}
                  onClick={() => save.mutate(editing)}
                >
                  {save.isPending ? "Saving…" : editing.id ? "Save Changes" : "Create Page"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
