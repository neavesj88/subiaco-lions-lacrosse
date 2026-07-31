// =============================================================================
// AdminCommittee — client/src/pages/admin/committee.tsx
// =============================================================================
// The "Committee" tab: manages the people shown on the public /committee page
// (President & Board). Designed to be re-done easily after each AGM.
//
// Each person has a name, position, section (Executive / General Committee /
// Coaches), an optional photo, short bio and public email.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImagePicker from "@/components/image-picker";
import { Plus, Pencil, Trash2, Users, Info, ArrowUp, ArrowDown } from "lucide-react";
import type { CommitteeMember } from "@shared/schema";

// Suggested sections. Admins can type their own instead.
const GROUPS = ["Executive", "General Committee", "Coaches", "Life Members"];

export default function AdminCommittee() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<CommitteeMember> | null>(null);

  const { data: members = [] } = useQuery<CommitteeMember[]>({
    queryKey: ["/api/committee/all"],
    queryFn: () => apiRequest("GET", "/api/committee/all"),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/committee/all"] });
    qc.invalidateQueries({ queryKey: ["/api/committee"] });
  };

  const save = useMutation({
    mutationFn: (m: Partial<CommitteeMember>) =>
      m.id ? apiRequest("PUT", `/api/committee/${m.id}`, m)
           : apiRequest("POST", "/api/committee", m),
    onSuccess: () => { refresh(); setEditing(null); toast({ title: "Saved" }); },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/committee/${id}`),
    onSuccess: () => { refresh(); toast({ title: "Removed" }); },
  });

  // Swap sort order with the neighbour to move someone up/down the page.
  const move = (m: CommitteeMember, dir: -1 | 1) => {
    const idx = members.findIndex((x) => x.id === m.id);
    const other = members[idx + dir];
    if (!other) return;
    save.mutate({ id: m.id, sortOrder: other.sortOrder });
    save.mutate({ id: other.id, sortOrder: m.sortOrder });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Committee & Board</h2>
        <Button size="sm" onClick={() => setEditing({
          name: "", position: "", groupName: "Executive",
          isActive: true, sortOrder: members.length,
        })}>
          <Plus className="h-4 w-4" /> Add Person
        </Button>
      </div>

      <Card className="mb-4 bg-maroon-50 border-maroon-200">
        <CardContent className="pt-4 pb-4 text-sm text-maroon-900">
          <p className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              These people appear on the public <strong>President &amp; Board</strong> page.
              After an AGM, edit the names and positions here rather than creating a new page.
              Use <strong>Section</strong> to split the Executive from the general committee.
            </span>
          </p>
        </CardContent>
      </Card>

      {members.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Users className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No committee members added yet</p>
          <p className="text-stone-400 text-sm mt-1">Add your President first, then the rest of the board.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m, i) => (
            <Card key={m.id}>
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                {m.photoUrl
                  ? <img src={m.photoUrl} alt={m.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                  : <div className="w-11 h-11 rounded-full bg-maroon-100 text-maroon-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
                    </div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-stone-900">{m.name}</span>
                    <Badge variant="secondary" className="text-xs">{m.groupName}</Badge>
                    {!m.isActive && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                  </div>
                  <p className="text-sm text-maroon-700">{m.position}</p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0}
                    onClick={() => move(m, -1)} title="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === members.length - 1}
                    onClick={() => move(m, 1)} title="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(m)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Remove"
                    onClick={() => { if (confirm(`Remove ${m.name} from the committee page?`)) remove.mutate(m.id); }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${editing.name}` : "Add committee member"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={editing.name ?? ""} placeholder="Jane Smith"
                    onChange={(e) => setEditing((p) => ({ ...p!, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Position *</Label>
                  <Input value={editing.position ?? ""} placeholder="President"
                    onChange={(e) => setEditing((p) => ({ ...p!, position: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Section</Label>
                <Input list="committee-groups" value={editing.groupName ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p!, groupName: e.target.value }))} />
                <datalist id="committee-groups">
                  {GROUPS.map((g) => <option key={g} value={g} />)}
                </datalist>
                <p className="text-xs text-stone-400">Groups people under a heading. Pick a suggestion or type your own.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Short bio (optional)</Label>
                <Textarea rows={3} value={editing.bio ?? ""}
                  placeholder="A sentence or two about their role or club involvement."
                  onChange={(e) => setEditing((p) => ({ ...p!, bio: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>Public email (optional)</Label>
                <Input type="email" value={editing.email ?? ""}
                  placeholder="president@club.com.au"
                  onChange={(e) => setEditing((p) => ({ ...p!, email: e.target.value }))} />
                <p className="text-xs text-stone-400">Only add this if they're happy for it to be public.</p>
              </div>

              <ImagePicker
                label="Photo (optional)"
                value={editing.photoUrl ?? undefined}
                onChange={(url) => setEditing((p) => ({ ...p!, photoUrl: url ?? null }))}
                hint="A headshot looks best. Without one, their initials are shown."
                compact
              />

              <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border">
                <input type="checkbox" id="cm-active" className="rounded"
                  checked={editing.isActive ?? true}
                  onChange={(e) => setEditing((p) => ({ ...p!, isActive: e.target.checked }))} />
                <Label htmlFor="cm-active" className="cursor-pointer font-normal">
                  Show on the public page
                </Label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" disabled={save.isPending || !editing.name?.trim() || !editing.position?.trim()}
                  onClick={() => save.mutate(editing)}>
                  {save.isPending ? "Saving…" : editing.id ? "Save Changes" : "Add Person"}
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
