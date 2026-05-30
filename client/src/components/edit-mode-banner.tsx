// =============================================================================
// EditModeBanner — client/src/components/edit-mode-banner.tsx
// =============================================================================
// A small floating pill shown at the bottom-left of public pages when an admin
// is logged in. It reminds them that editable text shows a pencil on hover.
// Hidden on the admin dashboard itself (only shows on public-facing pages).
// =============================================================================

import { useLocation } from "wouter";
import { Pencil } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function EditModeBanner() {
  const { user } = useAuth();
  const [location] = useLocation();

  // Only show for logged-in admins, and not on the admin dashboard/login
  if (!user) return null;
  if (location.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-4 left-4 z-30 bg-maroon-700 text-white text-xs rounded-full pl-3 pr-4 py-2 shadow-lg flex items-center gap-2 max-w-[280px]">
      <Pencil className="h-3.5 w-3.5 shrink-0 text-gold-400" />
      <span>Edit mode — hover over text to edit it inline</span>
    </div>
  );
}
