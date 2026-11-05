import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, List, ListOrdered, Link2, Link2Off,
  Heading2, Heading3, Minus, Undo, Redo, ImagePlus,
} from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useCallback } from "react";
import { shrinkImage } from "@/lib/resize-image";

interface RichTextEditorProps {
  value?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "p-1.5 rounded text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors",
        active && "bg-maroon-100 text-maroon-700"
      )}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Write something...",
  className,
  minHeight = "120px",
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-maroon-600 underline hover:text-maroon-800" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-2" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[var(--editor-min-height)] px-3 py-2 prose prose-stone prose-sm max-w-none focus:outline-none",
      },
    },
  });

  // Sync external value changes (e.g. form reset). emitUpdate:false stops the
  // sync itself firing onChange (TipTap v3 options-object signature).
  // A destroyed editor (StrictMode's double mount, or a re-created editor)
  // throws on getHTML(), so skip it; the replacement editor re-runs this.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const handleImageUpload = async (file: File) => {
    if (!editor) return;
    const fd = new FormData();
    // Photos pasted or dropped into a post get the same treatment as anywhere
    // else, otherwise a single news article can weigh more than the whole site.
    fd.append("file", await shrinkImage(file));
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      alert("Image upload failed. Please try again.");
    }
  };

  if (!editor) return null;

  return (
    <div
      className={cn("rounded-md border border-stone-300 overflow-hidden focus-within:ring-2 focus-within:ring-maroon-500 focus-within:border-transparent bg-white", className)}
      style={{ "--editor-min-height": minHeight } as React.CSSProperties}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-stone-200 bg-stone-50">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-4 bg-stone-300 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Subheading">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-4 bg-stone-300 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider line">
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-4 bg-stone-300 mx-1" />

        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Add link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
            <Link2Off className="h-4 w-4" />
          </ToolbarButton>
        )}

        <div className="w-px h-4 bg-stone-300 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-4 bg-stone-300 mx-1" />

        {/* Image upload */}
        <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Insert image">
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}

// RichTextDisplay used to live here, but that dragged the huge TipTap editor
// library into the PUBLIC pages just to display saved HTML. It now lives in
// its own lightweight file (rich-text-display.tsx). This re-export keeps any
// old imports working, but new code should import from rich-text-display.
export { RichTextDisplay } from "@/components/rich-text-display";
