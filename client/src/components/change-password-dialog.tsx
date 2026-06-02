// =============================================================================
// ChangePasswordDialog — client/src/components/change-password-dialog.tsx
// =============================================================================
// Lets ANY logged-in admin change their own password (no super-admin needed).
// Used from the admin top bar. Also the action behind the "default password"
// warning banner. Calls POST /api/auth/change-password.
// =============================================================================

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound } from "lucide-react";

export default function ChangePasswordDialog({
  trigger,
  onChanged,
}: {
  trigger: React.ReactNode;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      }),
    onSuccess: () => {
      toast({ title: "Password changed", description: "Use your new password next time you log in." });
      setOpen(false);
      setCurrent(""); setNext(""); setConfirm("");
      onChanged?.();
    },
    onError: (e: any) => toast({ title: "Couldn't change password", description: e.message, variant: "destructive" }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
    if (next !== confirm) return toast({ title: "Passwords don't match", variant: "destructive" });
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-maroon-700" /> Change Your Password
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Current password</Label>
            <Input id="cp-current" type="password" autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New password</Label>
            <Input id="cp-new" type="password" autoComplete="new-password" placeholder="At least 8 characters"
              value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input id="cp-confirm" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Update Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
