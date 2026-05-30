// =============================================================================
// EditableSection — client/src/components/editable-section.tsx
// =============================================================================
// A wrapper component that shows an edit pencil button on hover when an admin
// is logged in. Clicking it opens a modal with a rich text editor.
//
// Usage (on any public page):
//   const { get, save } = usePageContent("about");
//
//   <EditableSection page="about" section="history_1" value={get("history_1", DEFAULT)}>
//     {(content) => <p>{content}</p>}           ← plain text
//   </EditableSection>
//
//   <EditableSection page="about" section="history_1" value={get("history_1", DEFAULT)} richText>
//     {(content) => <RichTextDisplay html={content} />}   ← HTML
//   </EditableSection>
//
// When NOT logged in as admin, renders exactly as if the wrapper isn't there.
// When logged in, a pencil button appears on hover at the top-right corner.
// =============================================================================

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePageContent } from "@/hooks/use-page-content";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor, { RichTextDisplay } from "@/components/rich-text-editor";
import { toast } from "@/components/ui/toaster";

interface EditableSectionProps {
  page: string;
  section: string;
  value: string;           // Current saved value (from usePageContent)
  richText?: boolean;      // true = TipTap editor, false = plain textarea
  label?: string;          // Label shown in the edit modal title
  children: (content: string) => React.ReactNode;
}

export default function EditableSection({
  page, section, value, richText = false, label, children,
}: EditableSectionProps) {
  const { user } = useAuth();
  const { save } = usePageContent(page);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(section, draft);
      toast({ title: "Section saved" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Non-admin: render children transparently
  if (!user) return <>{children(value)}</>;

  return (
    <>
      {/* Wrapper with hover edit button */}
      <div className="group relative">
        {children(value)}

        {/* Edit button — visible on hover */}
        <button
          onClick={() => { setDraft(value); setOpen(true); }}
          className="absolute -top-2 -right-2 z-20 opacity-0 group-hover:opacity-100 transition-all bg-maroon-700 text-white rounded-full p-1.5 shadow-lg hover:bg-maroon-800 focus:opacity-100"
          title={`Edit: ${label ?? section}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>

      {/* Edit modal */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-maroon-700" />
              Edit: {label ?? section}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {richText ? (
              <RichTextEditor
                value={draft}
                onChange={setDraft}
                placeholder="Enter content..."
                minHeight="180px"
              />
            ) : (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className="font-sans"
                placeholder="Enter text..."
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Check className="h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
