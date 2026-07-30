// =============================================================================
// AdminSecurity — client/src/pages/admin/security.tsx
// =============================================================================
// The "Security" tab (Super Admins only). One place for the emergency /
// account-control jobs that used to need SSH access to the server:
//
//   • Email kill-switch — stop all outgoing email instantly
//   • Send a test email — prove the mail settings actually work
//   • Reset another admin's password — for the "I forgot mine" call
//   • Lock / unlock admin accounts — revoke access without deleting history
//   • Login lockouts — see and clear IPs blocked by brute-force protection
//
// Everything here is deliberately explicit and confirms destructive actions,
// because the people using it are club volunteers, not sysadmins.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Mail, MailX, KeyRound, Lock, Unlock, ShieldAlert, Send } from "lucide-react";

interface AdminUser {
  id: number; name: string; username: string; email: string;
  role: string; isActive: boolean;
}

export default function AdminSecurity({ currentUserId }: { currentUserId: number }) {
  const qc = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────
  // Mail settings come from the SECURE endpoint (the public one hides them).
  const { data: secure = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/secure"],
    queryFn: () => apiRequest("GET", "/api/settings/secure"),
  });

  const { data: adminUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
  });

  const { data: loginAttempts = [] } = useQuery<
    { ip: string; attempts: number; lastAttempt: string; status: string }[]
  >({
    queryKey: ["/api/security/login-attempts"],
    queryFn: () => apiRequest("GET", "/api/security/login-attempts"),
    refetchInterval: 30_000,
  });

  const mailOn = secure.mail_enabled !== "false";

  // ── Local form state ──────────────────────────────────────────────────────
  const [testTo, setTestTo] = useState("");
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  // ── Actions ───────────────────────────────────────────────────────────────
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/settings/secure"] });
    qc.invalidateQueries({ queryKey: ["/api/settings"] });
    qc.invalidateQueries({ queryKey: ["/api/users"] });
  };

  const toggleMail = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PUT", "/api/settings", { mail_enabled: enabled ? "true" : "false" }),
    onSuccess: (_d, enabled) => {
      refreshAll();
      toast({ title: enabled ? "Email sending switched ON" : "Email sending switched OFF" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testEmail = useMutation({
    mutationFn: () => apiRequest("POST", "/api/security/test-email", { to: testTo }),
    onSuccess: (r: any) => toast({ title: "Test sent", description: r?.message }),
    onError: (e: any) =>
      toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const resetPw = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/security/reset-user-password", {
        userId: parseInt(resetUserId), newPassword: resetPassword,
      }),
    onSuccess: (r: any) => {
      toast({ title: "Password reset", description: r?.message });
      setResetPassword(""); setResetUserId("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setActive = useMutation({
    mutationFn: (v: { userId: number; isActive: boolean }) =>
      apiRequest("POST", "/api/security/set-user-active", v),
    onSuccess: (r: any) => { refreshAll(); toast({ title: r?.message ?? "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unblock = useMutation({
    mutationFn: (ip: string) => apiRequest("POST", "/api/security/unblock", { ip }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/security/login-attempts"] });
      toast({ title: "IP unblocked" });
    },
  });

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Security & Email Controls</h2>

      {/* Email kill-switch + test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mailOn ? <Mail className="h-5 w-5 text-maroon-700" /> : <MailX className="h-5 w-5 text-red-600" />}
            Email Sending
          </CardTitle>
          <p className="text-sm text-stone-500">
            Master switch for every email the site sends (sign-up alerts, contact
            messages, confirmations). Turning it off does <strong>not</strong> lose
            anything — form submissions still save, you just read them in the
            Sign-Ups and Messages tabs.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-2 border-b">
            <div>
              <p className="font-medium text-stone-800 text-sm">
                Email is currently {mailOn ? "ON" : "OFF"}
              </p>
              <p className="text-xs text-stone-400">
                {mailOn
                  ? "The site will send notifications normally."
                  : "All outgoing email is blocked until you switch this back on."}
              </p>
            </div>
            <Switch checked={mailOn} onCheckedChange={(v) => toggleMail.mutate(v)} />
          </div>

          <div className="space-y-1.5">
            <Label>Send a test email</Label>
            <p className="text-xs text-stone-400">
              Confirms your email settings work. Configure them in Settings → Email.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="your.name@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <Button
                onClick={() => testEmail.mutate()}
                disabled={testEmail.isPending || !testTo}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
                {testEmail.isPending ? "Sending…" : "Send Test"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset another admin's password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-maroon-700" />
            Reset an Admin's Password
          </CardTitle>
          <p className="text-sm text-stone-500">
            For when a committee member forgets theirs. Set a temporary password,
            tell them what it is, and ask them to change it via the Password button
            once they're in.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Which admin?</Label>
              <Select value={resetUserId} onValueChange={setResetUserId}>
                <SelectTrigger><SelectValue placeholder="Choose a person…" /></SelectTrigger>
                <SelectContent>
                  {adminUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} (@{u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <Input
                type="text"
                placeholder="At least 8 characters"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={() => {
              const who = adminUsers.find((u) => String(u.id) === resetUserId);
              if (confirm(`Reset the password for ${who?.name}?`)) resetPw.mutate();
            }}
            disabled={resetPw.isPending || !resetUserId || resetPassword.length < 8}
          >
            {resetPw.isPending ? "Resetting…" : "Reset Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Lock / unlock accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-maroon-700" />
            Admin Access
          </CardTitle>
          <p className="text-sm text-stone-500">
            Lock an account to stop someone logging in without deleting them —
            their posts and history stay intact, and you can unlock them anytime.
            Use this when a committee member steps down.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {adminUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-stone-50">
              <div className="min-w-0">
                <span className="font-medium text-stone-800 text-sm">{u.name}</span>
                <span className="text-xs text-stone-400 ml-2">@{u.username}</span>
                {!u.isActive && <Badge variant="secondary" className="ml-2 text-xs">Locked</Badge>}
                {u.id === currentUserId && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
              </div>
              {u.id !== currentUserId && (
                <Button
                  size="sm"
                  variant={u.isActive ? "outline" : "default"}
                  className="h-7 text-xs shrink-0"
                  onClick={() => {
                    const verb = u.isActive ? "Lock out" : "Unlock";
                    if (confirm(`${verb} ${u.name}?`)) {
                      setActive.mutate({ userId: u.id, isActive: !u.isActive });
                    }
                  }}
                >
                  {u.isActive ? <><Lock className="h-3 w-3" /> Lock</> : <><Unlock className="h-3 w-3" /> Unlock</>}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Brute-force lockouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-maroon-700" />
            Login Lockouts
          </CardTitle>
          <p className="text-sm text-stone-500">
            The login page automatically blocks a device after repeated wrong
            passwords (5 minutes after 3 tries, longer if it keeps going). Blocked
            addresses appear here — unblock one if a genuine admin locked themselves
            out with typos.
          </p>
        </CardHeader>
        <CardContent>
          {loginAttempts.length === 0 ? (
            <p className="text-sm text-stone-400 py-2">No failed login attempts. All clear. ✓</p>
          ) : (
            <div className="space-y-2">
              {loginAttempts.map((a) => (
                <div key={a.ip} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-stone-50">
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-stone-800">{a.ip}</span>
                    <span className="text-xs text-stone-400 ml-2">
                      {a.attempts} failed · {new Date(a.lastAttempt).toLocaleString("en-AU")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={a.status === "Blocked" ? "default" : "secondary"} className="text-xs">
                      {a.status}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => unblock.mutate(a.ip)}>
                      Unblock
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
