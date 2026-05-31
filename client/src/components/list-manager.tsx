// =============================================================================
// ListManager — client/src/components/list-manager.tsx
// =============================================================================
// A reusable admin editor for the flexible list_items table. Renders an
// add/edit/delete UI for one list type. Used in the admin panel for:
//   - Team divisions  (fields: group + title)
//   - Store apparel   (fields: title + body + label)
//   - Juniors FAQ     (fields: title + body)
//
// You declare which fields to show via the `fields` prop, so the same
// component drives all three lists with the right labels.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { ListItem } from "@shared/schema";

type FieldKey = "group" | "title" | "body" | "label" | "url";

interface ListManagerProps {
  listType: string;
  title: string;
  description?: string;
  /** Which columns to show in the add/edit form, with their labels */
  fields: { key: FieldKey; label: string; textarea?: boolean; placeholder?: string; required?: boolean }[];
}

export default function ListManager({ listType, title, description, fields }: ListManagerProps) {
  const qc = useQueryClient();
  const queryKey = [`/api/list-items/${listType}/all`];

  const { data: items = [] } = useQuery<ListItem[]>({
    queryKey,
    queryFn: () => apiRequest("GET", `/api/list-items/${listType}/all`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: [`/api/list-items/${listType}`] });
  };

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/list-items/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Item removed" }); },
  });

  const reorder = useMutation({
    mutationFn: ({ id, sortOrder }: { id: number; sortOrder: number }) =>
      apiRequest("PUT", `/api/list-items/${id}`, { sortOrder }),
    onSuccess: invalidate,
  });

  // Swap sort order with the neighbour (move up/down)
  const move = (index: number, dir: -1 | 1) => {
    const a = items[index];
    const b = items[index + dir];
    if (!a || !b) return;
    reorder.mutate({ id: a.id, sortOrder: b.sortOrder });
    reorder.mutate({ id: b.id, sortOrder: a.sortOrder });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <ItemDialog listType={listType} fields={fields} onDone={invalidate} nextSort={items.length} />
      </div>
      {description && <p className="text-sm text-stone-500 mb-4">{description}</p>}

      <div className="space-y-2">
        {items.map((item, i) => (
          <Card key={item.id}>
            <CardContent className="pt-3 pb-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.group && <span className="text-xs font-semibold text-maroon-700">{item.group}</span>}
                  <span className="font-medium text-stone-900 text-sm">{item.title}</span>
                  {item.label && <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">{item.label}</span>}
                </div>
                {item.body && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{item.body}</p>}
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <ItemDialog listType={listType} fields={fields} item={item} onDone={invalidate} nextSort={item.sortOrder}
                  trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Remove this item?")) del.mutate(item.id); }}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-stone-400 text-center py-8 text-sm">No items yet — add one above.</p>}
      </div>
    </div>
  );
}

// ── Add/Edit dialog ──────────────────────────────────────────────────────────
function ItemDialog({
  listType, fields, item, onDone, nextSort, trigger,
}: {
  listType: string;
  fields: ListManagerProps["fields"];
  item?: ListItem;
  onDone: () => void;
  nextSort: number;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach((f) => { init[f.key] = (item?.[f.key] as string) ?? ""; });
    return init;
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, listType, sortOrder: item?.sortOrder ?? nextSort };
      return item
        ? apiRequest("PUT", `/api/list-items/${item.id}`, payload)
        : apiRequest("POST", "/api/list-items", payload);
    },
    onSuccess: () => { onDone(); toast({ title: item ? "Item updated" : "Item added" }); setOpen(false); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm"><Plus className="h-4 w-4" />Add</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}{f.required && " *"}</Label>
              {f.textarea ? (
                <Textarea
                  rows={3}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              ) : (
                <Input
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={save.isPending} className="flex-1">
              {save.isPending ? "Saving..." : item ? "Update" : "Add"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
