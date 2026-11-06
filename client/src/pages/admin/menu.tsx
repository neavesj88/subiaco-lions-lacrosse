// =============================================================================
// AdminMenu — client/src/pages/admin/menu.tsx
// =============================================================================
// The screen where a club arranges its own top menu: what appears, what it is
// called, what order it is in, and which items sit together in a dropdown.
//
// Before this existed, "Home", "About", "Juniors" and "Contact" were fixed in
// code and a club could only rename them. Now everything is theirs.
//
// HOW THE DROPDOWNS WORK, because it is the one idea to understand:
// there is no "create a dropdown" button. Every row has a "Where" box. Type
// the same word into two or more rows — say "Teams" — and a "Teams" dropdown
// appears containing them. Clear the word and they go back to being ordinary
// buttons. Nothing to create, nothing to delete, and no way to end up with an
// empty dropdown sitting in the menu.
// =============================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Info, RotateCcw, Eye, EyeOff, Trash2 } from "lucide-react";
import { useSiteText } from "@/hooks/use-site-text";
import { useMenu } from "@/hooks/use-menu";
import {
  defaultMenu, BUILT_IN_PAGES, normalisePlace, isDropdown, dropdownNames,
  MAIN, FOOTER, HIDDEN, type NavItem,
} from "@shared/nav";
import { checkMenuGroupName, checkLabel } from "@shared/validate";
import FieldWarning from "@/components/field-warning";
import type { CustomPage } from "@shared/schema";

export default function AdminMenu() {
  const qc = useQueryClient();
  const t = useSiteText();
  const { menu: liveMenu } = useMenu();
  const [items, setItems] = useState<NavItem[]>([]);
  const [dirty, setDirty] = useState(false);
  // What the admin literally typed into each "Where" box, by item, kept
  // separately from where the item ended up. Two reasons:
  //  - the box must show exactly what's being typed. Tidying it on every key
  //    press removed the space after "Our", so "Our Club" couldn't be typed;
  //  - typing "hidden" DOES hide the item (probably what they meant), and that
  //    deserves a word of explanation rather than happening silently.
  // Keyed by the item, not its row number, so moving rows keeps each note on
  // its own row.
  const [typedPlace, setTypedPlace] = useState<Record<string, string>>({});

  const { data: customPages = [] } = useQuery<CustomPage[]>({
    queryKey: ["/api/pages/all"],
    queryFn: () => apiRequest("GET", "/api/pages/all"),
  });

  // Load once, then leave the admin's edits alone until they save.
  useEffect(() => {
    if (items.length === 0 && liveMenu.length > 0) setItems(liveMenu);
  }, [liveMenu, items.length]);

  const save = useMutation({
    mutationFn: (next: NavItem[]) =>
      apiRequest("PUT", "/api/settings", { nav_menu: JSON.stringify(next) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/secure"] });
      setDirty(false);
      toast({ title: "Menu saved", description: "Have a look at your site to see it." });
    },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const update = (index: number, changes: Partial<NavItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...changes } : it)));
    setDirty(true);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setDirty(true);
  };

  /**
   * What to say about what someone typed in the "Where" box.
   * In: the raw text they typed (if any) and where the item ended up.
   * Out: a short explanation, or null when there is nothing to say.
   */
  const wherePlaceWarning = (typed: string | undefined, place: string): string | null => {
    const raw = (typed ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    // They typed a word that means something specific here. It still works —
    // it just did something other than making a dropdown, so say so.
    if (raw === HIDDEN) return "Typing \"hidden\" hides this item rather than making a dropdown called Hidden.";
    if (raw === FOOTER) return "Typing \"footer\" moves this to the footer rather than making a dropdown called Footer.";
    if (raw === MAIN) return "Typing \"main\" puts this in the top bar rather than making a dropdown called Main.";
    if (place === MAIN || place === FOOTER || place === HIDDEN) return null;
    return checkMenuGroupName(place);
  };

  /** A friendly description of where something currently sits. */
  const placeLabel = (place: string) => {
    if (place === MAIN) return "Top bar";
    if (place === FOOTER) return "Footer only";
    if (place === HIDDEN) return "Hidden";
    return `In the "${place}" dropdown`;
  };

  /** The dropdowns that exist right now, for the quick-pick buttons. */
  const existingGroups = dropdownNames(items);

  /** A page the club made that has since been deleted. */
  const isMissing = (key: string) =>
    key.startsWith("page:") && !customPages.some((p) => p.slug === key.slice(5));

  /** Pages the site can't do without. Home can't be hidden. */
  const isEssential = (key: string) => !!BUILT_IN_PAGES.find((p) => p.key === key)?.essential;

  const describe = (key: string) => {
    if (key.startsWith("page:")) {
      const slug = key.slice(5);
      const page = customPages.find((p) => p.slug === slug);
      if (!page) return `This page has been deleted — remove it from the menu`;
      return page.isPublished ? `Your page — /p/${slug}` : `Your page — /p/${slug} (a draft: not shown until it's visible)`;
    }
    const built = BUILT_IN_PAGES.find((p) => p.key === key);
    return built ? built.href : key;
  };

  const removeRow = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    setDirty(true);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-medium mb-1 flex items-center gap-1.5"><Info className="h-4 w-4" /> How this works</p>
        <ul className="list-disc ml-5 space-y-1 text-xs leading-relaxed">
          <li><strong>Name</strong> is what visitors see. Call Fixtures "Draw" if that's your word for it.</li>
          <li><strong>Where</strong> decides if it's a button in the top bar, inside a dropdown, in the footer, or hidden.</li>
          <li>To make a <strong>dropdown</strong>, type the same name into the "Where" box on two or more rows —
              for example "Teams". They'll group together under a "Teams" button. There's nothing else to set up.</li>
          <li>The <strong>arrows</strong> set the order. A dropdown appears in the bar wherever its first item sits.</li>
          <li>Pages you create under <strong>Pages</strong> appear here too. The "Where in the menu" box in the
              page editor and this screen change the same menu, so they always agree.</li>
          <li><strong>Home</strong> can't be hidden — every page links back to it.</li>
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-stone-600">
          {items.length} item{items.length === 1 ? "" : "s"}
          {existingGroups.length > 0 && ` · dropdowns: ${existingGroups.join(", ")}`}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!confirm("Put the menu back to how it started? Your pages are not deleted.")) return;
              setItems(defaultMenu((k) => t(k)));
              setDirty(true);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start again
          </Button>
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(items)}>
            {save.isPending ? "Saving…" : dirty ? "Save menu" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => {
          const hiddenRow = item.place === HIDDEN;
          return (
            <Card key={item.key} className={hiddenRow ? "opacity-70" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">

                  <div className="flex flex-col gap-1 pt-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => move(index, -1)} aria-label={`Move ${item.label} up`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => move(index, 1)} aria-label={`Move ${item.label} down`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex-1 min-w-[180px] space-y-1">
                    <Label className="text-xs">Name shown to visitors</Label>
                    <Input value={item.label} onChange={(e) => update(index, { label: e.target.value })} />
                    <FieldWarning message={checkLabel(item.label, "name")} />
                    <p className="text-xs text-stone-500">{describe(item.key)}</p>
                  </div>

                  <div className="flex-1 min-w-[180px] space-y-1">
                    <Label className="text-xs">Where</Label>
                    <Input
                      value={typedPlace[item.key] ?? (isDropdown(item.place) ? item.place : "")}
                      placeholder="Top bar (or type a dropdown name)"
                      aria-label={`Where ${item.label} goes`}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setTypedPlace((p) => ({ ...p, [item.key]: raw }));
                        const place = normalisePlace(raw);
                        // Home can't be hidden: everything else on the site
                        // links back to it.
                        update(index, { place: place === HIDDEN && isEssential(item.key) ? item.place : place });
                      }}
                    />
                    <FieldWarning message={
                      isEssential(item.key) && normalisePlace(typedPlace[item.key]) === HIDDEN
                        ? "Home can't be hidden — every page links back to it."
                        : wherePlaceWarning(typedPlace[item.key], item.place)
                    } />
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {/* A quick pick also clears what was typed, so the box
                          shows the new place rather than the old text. */}
                      {[
                        { place: MAIN, label: "Top bar" },
                        ...existingGroups.map((g) => ({ place: g, label: g })),
                        { place: FOOTER, label: "Footer" },
                      ].map(({ place, label }) => (
                        <Button key={place} size="sm" variant={item.place === place ? "default" : "outline"}
                          className="h-6 text-xs px-2"
                          onClick={() => { setTypedPlace((p) => { const n = { ...p }; delete n[item.key]; return n; }); update(index, { place }); }}>
                          {label}
                        </Button>
                      ))}
                      <Button size="sm" variant={item.place === HIDDEN ? "default" : "outline"}
                        className="h-6 text-xs px-2" disabled={isEssential(item.key)}
                        title={isEssential(item.key) ? "Home can't be hidden — every page links back to it." : undefined}
                        onClick={() => { setTypedPlace((p) => { const n = { ...p }; delete n[item.key]; return n; }); update(index, { place: HIDDEN }); }}>
                        {hiddenRow ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} Hide
                      </Button>
                    </div>
                  </div>

                  <div className="pt-5 shrink-0 flex flex-col items-end gap-2">
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      {placeLabel(item.place)}
                    </Badge>
                    {isMissing(item.key) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600"
                        onClick={() => removeRow(item.key)}>
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => save.mutate(items)} disabled={save.isPending} className="shadow-lg">
            {save.isPending ? "Saving…" : "Save menu"}
          </Button>
        </div>
      )}
    </div>
  );
}
