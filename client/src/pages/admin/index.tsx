import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/rich-text-editor";
import ImagePicker from "@/components/image-picker";
import ChangePasswordDialog from "@/components/change-password-dialog";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-path";
import { useSessionKeepalive } from "@/hooks/use-session-keepalive";
import { useSiteText } from "@/hooks/use-site-text";
import { checkTextOnColour } from "@shared/contrast";
import { checkEmail, checkUrl, checkColour } from "@shared/validate";
import FieldWarning from "@/components/field-warning";
import AdminHelp from "@/pages/admin/help";
import AdminSecurity from "@/pages/admin/security";
import MediaLibrary from "@/pages/admin/media-library";
import AdminPages from "@/pages/admin/pages";
import AdminCommittee from "@/pages/admin/committee";
import AdminStore, { AdminOrders } from "@/pages/admin/store";
import AdminStock from "@/pages/admin/stock";
import AdminMenu from "@/pages/admin/menu";
import { ADMIN_GROUPS, ALL_SECTIONS } from "@/pages/admin/nav-config";
import { ROLES, ROLE_INFO } from "@shared/roles";
import SetupWizard from "@/pages/admin/setup-wizard";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  LogOut, Plus, Pencil, Trash2, Settings, Users, Calendar, Megaphone,
  ClipboardList, Star, CheckCircle, Phone, Mail, User, MessageSquare, Eye,
  Pin, ImageIcon, Trophy, Heart, Download, ToggleLeft, List as ListIcon,
  KeyRound, AlertTriangle, HelpCircle, Shield, Palette, FileText, UserCog,
  ShoppingBag, Receipt, Boxes,
} from "lucide-react";

// Sidebar icon names (from nav-config.ts) → the actual components
const ADMIN_ICONS: Record<string, any> = {
  Megaphone, ImageIcon, FileText, Star, ListIcon, Calendar, Trophy, Heart,
  Users, ClipboardList, MessageSquare, Mail, Settings, UserCog, Shield,
  ShoppingBag, Receipt, Boxes,
};
import { Switch } from "@/components/ui/switch";
import ListManager from "@/components/list-manager";
import type { Event, Announcement, Registration, JuniorsContent, ContactMessage, MediaUpload, Sponsor, MatchResult, NewsletterSubscriber } from "@shared/schema";

// ── A dialog holding a form ────────────────────────────────────────────────────
// The form closes itself when it has saved (or Cancel is pressed), and starts
// empty again each time it opens. Clicking outside it does NOT close it: that
// is far too easy to do by accident halfway through writing a post, and it
// threw away everything typed.
function FormDialog({ trigger, title, wide, children }: {
  trigger: ReactNode;
  title: string;
  wide?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={wide ? "max-w-2xl" : "max-w-md"} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {open && children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

/** The team choices, in the club's own words (Admin -> Settings -> Wording). */
function useTeamOptions(withAll: boolean) {
  const t = useSiteText();
  const teams = [
    { value: "mens", label: t("team_label_mens") },
    { value: "womens", label: t("team_label_womens") },
    { value: "juniors", label: t("team_label_juniors") },
  ];
  return withAll ? [{ value: "all", label: t("team_label_all") }, ...teams] : teams;
}

/** "www.acme.com" -> "https://www.acme.com", so a link works when clicked
 *  instead of being treated as a page on this site. Blank stays blank. */
function normaliseLink(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
}

/** Plain text from editor HTML, for short previews in lists. */
function previewText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// ── Result form ────────────────────────────────────────────────────────────────
function ResultForm({ result, onDone }: { result?: MatchResult; onDone: () => void }) {
  const qc = useQueryClient();
  const teams = useTeamOptions(false);
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      matchDate: result?.matchDate ?? "", opposition: result?.opposition ?? "",
      ourScore: result?.ourScore != null ? String(result.ourScore) : "",
      theirScore: result?.theirScore != null ? String(result.theirScore) : "",
      teamCategory: result?.teamCategory ?? "mens", division: result?.division ?? "",
      venue: result?.venue ?? "", isHome: result?.isHome ?? true, notes: result?.notes ?? "",
      isPublished: result?.isPublished ?? true,
    },
  });
  const score = (v: string) => (v !== "" && Number.isFinite(parseInt(v)) ? parseInt(v) : null);
  const mutation = useMutation({
    mutationFn: (d: any) => {
      const body = { ...d, ourScore: score(d.ourScore), theirScore: score(d.theirScore) };
      return result ? apiRequest("PUT", `/api/results/${result.id}`, body) : apiRequest("POST", "/api/results", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/results/all"] }); qc.invalidateQueries({ queryKey: ["/api/results"] }); toast({ title: result ? "Result updated" : "Result added" }); onDone(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Date *</Label><Input type="date" {...register("matchDate", { required: true })} /></div>
        <div className="space-y-1">
          <Label>Team</Label>
          <Select onValueChange={(v) => setValue("teamCategory", v as any)} defaultValue={watch("teamCategory")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {teams.map((tm) => <SelectItem key={tm.value} value={tm.value}>{tm.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1"><Label>Opposition *</Label><Input placeholder="e.g. Wembley LC" {...register("opposition", { required: true })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Our Score</Label><Input type="number" min="0" {...register("ourScore")} /></div>
        <div className="space-y-1"><Label>Their Score</Label><Input type="number" min="0" {...register("theirScore")} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Division</Label><Input placeholder="e.g. State League" {...register("division")} /></div>
        <div className="space-y-1"><Label>Venue</Label><Input placeholder="e.g. your home ground" {...register("venue")} /></div>
      </div>
      <div className="space-y-1"><Label>Notes</Label><Input placeholder="Optional notes or summary" {...register("notes")} /></div>
      <div className="flex flex-col gap-2 p-3 bg-stone-50 rounded-lg border text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register("isHome")} /> Home game (shown as "vs"; away games show "@")
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register("isPublished")} /> Show on the website (untick to keep as a draft)
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">{mutation.isPending ? "Saving..." : result ? "Save Changes" : "Add Result"}</Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Sponsor form ───────────────────────────────────────────────────────────────
function SponsorForm({ sponsor, onDone }: { sponsor?: Sponsor; onDone: () => void }) {
  const qc = useQueryClient();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(sponsor?.logoUrl ?? undefined);
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      name: sponsor?.name ?? "", websiteUrl: sponsor?.websiteUrl ?? "",
      tier: sponsor?.tier ?? "partner", sortOrder: sponsor?.sortOrder ?? 0,
    },
  });
  const mutation = useMutation({
    mutationFn: (d: any) => {
      // The number box hands back text once edited; the server wants a number.
      const body = { ...d, sortOrder: Number(d.sortOrder) || 0, websiteUrl: normaliseLink(d.websiteUrl), logoUrl: logoUrl ?? null };
      return sponsor ? apiRequest("PUT", `/api/sponsors/${sponsor.id}`, body) : apiRequest("POST", "/api/sponsors", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sponsors/all"] }); qc.invalidateQueries({ queryKey: ["/api/sponsors"] }); toast({ title: sponsor ? "Sponsor updated" : "Sponsor added" }); onDone(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="space-y-1"><Label>Sponsor Name *</Label><Input placeholder="e.g. Acme Pty Ltd" {...register("name", { required: true })} /></div>
      <div className="space-y-1">
        <Label>Website URL</Label>
        <Input placeholder="https://..." {...register("websiteUrl")} />
        <FieldWarning message={checkUrl(watch("websiteUrl") ?? "")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tier</Label>
          <Select onValueChange={(v) => setValue("tier", v as any)} defaultValue={watch("tier")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gold">Gold (largest)</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
              <SelectItem value="partner">Partner (smallest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Sort order</Label><Input type="number" min="0" {...register("sortOrder")} /><p className="text-xs text-stone-500">Lower numbers show first.</p></div>
      </div>
      <ImagePicker
        label="Sponsor Logo"
        value={logoUrl}
        onChange={setLogoUrl}
        hint="Upload a new logo or pick one from your media library."
      />
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">{mutation.isPending ? "Saving..." : sponsor ? "Save Changes" : "Add Sponsor"}</Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    super_admin: "bg-red-100 text-red-800",
    club_admin: "bg-blue-100 text-blue-800",
    juniors_coordinator: "bg-green-100 text-green-800",
    content_manager: "bg-yellow-100 text-yellow-800",
    social_media: "bg-purple-100 text-purple-800",
  };
  // Names come from shared/roles.ts, the one list of roles, so a role added
  // there is never shown here as its raw code name.
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[role] ?? "bg-stone-100"}`}>
      {ROLE_INFO[role as keyof typeof ROLE_INFO]?.label ?? role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-800",
    contacted: "bg-yellow-100 text-yellow-800",
    registered: "bg-green-100 text-green-800",
    declined: "bg-stone-100 text-stone-500",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${map[status] ?? "bg-stone-100"}`}>
      {status}
    </span>
  );
}

// ── Event form ─────────────────────────────────────────────────────────────────

function EventForm({ event, onDone }: { event?: Event; onDone: () => void }) {
  const qc = useQueryClient();
  const teams = useTeamOptions(true);
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      title: event?.title ?? "",
      description: event?.description ?? "",
      startDate: event?.startDate ?? "",
      endDate: event?.endDate ?? "",
      location: event?.location ?? "",
      eventType: event?.eventType ?? "training",
      teamCategory: event?.teamCategory ?? "all",
      isPublished: event?.isPublished ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: unknown) =>
      event
        ? apiRequest("PUT", `/api/events/${event.id}`, data)
        : apiRequest("POST", "/api/events", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      qc.invalidateQueries({ queryKey: ["/api/events/all"] });
      toast({ title: event ? "Event updated" : "Event created" });
      onDone();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title *</Label>
        <Input {...register("title", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={3} {...register("description")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start Date *</Label>
          <Input type="date" {...register("startDate", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>End Date</Label>
          <Input type="date" {...register("endDate")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Location</Label>
        <Input placeholder="Ground name, suburb" {...register("location")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select onValueChange={(v) => setValue("eventType", v as any)} defaultValue={watch("eventType")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["game", "training", "social", "meeting", "other"].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Team</Label>
          <Select onValueChange={(v) => setValue("teamCategory", v as any)} defaultValue={watch("teamCategory")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {teams.map((tm) => <SelectItem key={tm.value} value={tm.value}>{tm.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border text-sm cursor-pointer">
        <input type="checkbox" className="rounded" {...register("isPublished")} />
        Show on the website (untick to keep as a draft)
      </label>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">
          {mutation.isPending ? "Saving..." : event ? "Update Event" : "Create Event"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Announcement form ──────────────────────────────────────────────────────────

function AnnouncementForm({ ann, onDone }: { ann?: Announcement; onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(ann?.title ?? "");
  const [content, setContent] = useState(ann?.content ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | undefined>(ann?.featuredImageUrl ?? undefined);
  const [isPinned, setIsPinned] = useState(ann?.isPinned ?? false);
  const [isPublished, setIsPublished] = useState(ann?.isPublished ?? true);

  const mutation = useMutation({
    mutationFn: (data: unknown) =>
      ann
        ? apiRequest("PUT", `/api/announcements/${ann.id}`, data)
        : apiRequest("POST", "/api/announcements", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/announcements"] });
      qc.invalidateQueries({ queryKey: ["/api/announcements/all"] });
      toast({ title: ann ? "Announcement updated" : "Announcement posted" });
      onDone();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || content === "<p></p>") {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    mutation.mutate({ title, content, featuredImageUrl: featuredImageUrl ?? null, isPinned, isPublished });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Season kick-off Saturday!" />
      </div>
      <div className="space-y-1.5">
        <Label>Content *</Label>
        <p className="text-xs text-stone-500 -mt-1">Use the toolbar to add formatting — bold, bullet points, links etc.</p>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Write your announcement here..."
          minHeight="160px"
        />
      </div>
      <ImagePicker
        label="Featured Image (optional)"
        value={featuredImageUrl}
        onChange={setFeaturedImageUrl}
        hint="Shows as the post thumbnail on the homepage. Pick from your library or upload. Recommended: 1200×630px."
      />

      <div className="flex flex-col gap-2 p-3 bg-stone-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ann-pinned"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="ann-pinned" className="cursor-pointer font-normal">
            📌 Pin this post (shows first, highlighted in gold)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ann-published"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="ann-published" className="cursor-pointer font-normal">
            Publish immediately (uncheck to save as draft)
          </Label>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">
          {mutation.isPending ? "Saving..." : ann ? "Update Announcement" : "Post Announcement"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── User form ──────────────────────────────────────────────────────────────────

function UserForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: { username: "", password: "", name: "", email: "", role: "content_manager" as const },
  });

  const mutation = useMutation({
    mutationFn: (data: unknown) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Admin user created" });
      onDone();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Full Name *</Label>
          <Input {...register("name", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Username *</Label>
          <Input {...register("username", { required: true })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email *</Label>
        <Input type="email" {...register("email", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Password *</Label>
        <Input type="password" placeholder="Min 8 characters" {...register("password", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select onValueChange={(v) => setValue("role", v as any)} defaultValue="content_manager">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_INFO[r].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">
          {mutation.isPending ? "Creating..." : "Create Admin User"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Edit an existing admin ─────────────────────────────────────────────────────
// Name, email and role. Passwords are reset from Security, where the person
// doing it can see what they are doing.
function UserEditForm({ account, isSelf, onDone }: {
  account: { id: number; name: string; email: string; role: string; isActive: boolean };
  isSelf: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email ?? "");
  const [role, setRole] = useState(account.role);
  const mutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/users/${account.id}`, { name, email, ...(isSelf ? {} : { role }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Account updated" }); onDone(); },
    onError: (e) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="space-y-1.5"><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FieldWarning message={checkEmail(email)} />
        <p className="text-xs text-stone-500">Must match their Google account if they sign in with Google.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={role} onValueChange={setRole} disabled={isSelf}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_INFO[r].label}</SelectItem>)}
          </SelectContent>
        </Select>
        {isSelf && <p className="text-xs text-stone-500">You can't change your own role — ask another Super Admin.</p>}
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={mutation.isPending || !name.trim()} className="flex-1">
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// The settings that make up the club's own wording and details. Shown as one
// card in Settings so everything the setup wizard asked about (and the privacy
// wording the sign-up form shows) can be changed again later.
const WORDING_FIELDS: Array<{ key: string; label: string; help?: string; long?: boolean }> = [
  { key: "club_short_name", label: "Short name", help: "Used in casual wording, e.g. \"Join the Sharks\"." },
  { key: "club_founded", label: "Year founded", help: "Shown on the About page. Leave blank to hide it." },
  { key: "sport_name", label: "Sport (lowercase)", help: "e.g. netball — used mid-sentence." },
  { key: "sport_name_title", label: "Sport (capitalised)", help: "e.g. Netball — used in headings." },
  { key: "venue_word", label: "What you call your venue", help: "ground, court, pitch, rink…" },
  { key: "region_name", label: "City / region", help: "e.g. Perth. Used in page titles for search engines." },
  { key: "region_state", label: "State", help: "e.g. WA" },
  { key: "league_name", label: "League or association", help: "Leave blank if you're not affiliated." },
  { key: "league_url", label: "League website" },
  { key: "team_label_mens", label: "Name for the men's team(s)" },
  { key: "team_label_womens", label: "Name for the women's team(s)" },
  { key: "team_label_juniors", label: "Name for the junior team(s)" },
  { key: "team_label_all", label: "Name for \"all teams\"" },
  { key: "subsidy_name", label: "Junior fee-help scheme", help: "The name of a government scheme that helps families with fees, e.g. KidSport in WA. Leave blank if there isn't one: the sign-up form then doesn't mention one." },
  { key: "about_stat2_label", label: "About page fact 2 — label", help: "The About page shows up to four quick facts. Leave a value blank to hide that fact." },
  { key: "about_stat2_value", label: "About page fact 2 — value" },
  { key: "about_stat3_label", label: "About page fact 3 — label" },
  { key: "about_stat3_value", label: "About page fact 3 — value" },
  { key: "privacy_signup_notice", label: "Privacy notice on the sign-up form", long: true, help: "What the club does with the details people give. Check it matches your privacy policy." },
  { key: "privacy_consent_label", label: "Privacy tick-box wording", long: true },
  { key: "privacy_contact_notice", label: "Privacy note on the contact form", long: true },
];

// ── Main Dashboard ─────────────────────────────────────────────────────────────

/**
 * Pick the right check for a settings box, from its name.
 * In: the setting key and what was typed. Out: a warning, or null.
 * Keyed on the name so a new email or link setting is covered automatically
 * rather than being forgotten.
 */
function checkSettingValue(key: string, value: string): string | null {
  if (key.endsWith("_email") || key === "contact_email") return checkEmail(value);
  if (key.endsWith("_url")) return checkUrl(value);
  if (key.startsWith("theme_") && key !== "theme_gradient_angle") return checkColour(value);
  return null;
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading, isError, logoutMutation, can } = useAuth();
  const qc = useQueryClient();
  // Club-configurable wording, so admin labels match the club's own terms
  // (e.g. their league's name) instead of hardcoded lacrosse ones.
  const t = useSiteText();

  // Keeps an ACTIVE admin logged in past the 2h idle timeout (pings the server
  // while they're working), while an abandoned session still expires.
  useSessionKeepalive(!!user);

  // Which admin sections this person may use. Anything they lack permission
  // for simply isn't rendered — a Social Media Manager sees News and Photos
  // and nothing else, rather than a wall of greyed-out tabs.
  const visibleGroups = ADMIN_GROUPS
    .map((g) => ({ ...g, sections: g.sections.filter((sec) => can(sec.permission)) }))
    .filter((g) => g.sections.length > 0);

  // Open the first section they're allowed to see (falls back to Help).
  const firstSection = visibleGroups[0]?.sections[0]?.id ?? "help";
  const [activeTab, setActiveTab] = useState(firstSection);
  // On a fresh page load the account isn't known yet when the line above
  // runs, so it always fell back to Help. Once it is known, open the first
  // section this person can use — unless they've already picked one.
  const pickedTab = useRef(false);
  useEffect(() => {
    if (user && !pickedTab.current) setActiveTab(firstSection);
  }, [user?.id, firstSection]);
  const [wizardDone, setWizardDone] = useState(false);
  const currentSection = ALL_SECTIONS.find((sec) => sec.id === activeTab);


  useEffect(() => {
    // null = the server said "not logged in". (undefined with an error just
    // means the server couldn't be reached; that is shown below instead.)
    if (!isLoading && user === null) navigate(ADMIN_LOGIN_PATH);
  }, [user, isLoading]);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events/all"],
    queryFn: () => apiRequest("GET", "/api/events/all"),
    enabled: can("events"),
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements/all"],
    queryFn: () => apiRequest("GET", "/api/announcements/all"),
    enabled: can("news"),
  });

  const { data: registrations = [] } = useQuery<Registration[]>({
    queryKey: ["/api/registrations"],
    queryFn: () => apiRequest("GET", "/api/registrations"),
    enabled: can("signups"),
  });

  const { data: juniorsContent = [] } = useQuery<JuniorsContent[]>({
    queryKey: ["/api/juniors-content"],
    queryFn: () => apiRequest("GET", "/api/juniors-content"),
    enabled: can("juniors"),
  });

  const { data: adminUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    enabled: can("users"),
  });

  // (Login lockouts now live in the Security tab — see pages/admin/security.tsx)

  const { data: mediaItems = [] } = useQuery<MediaUpload[]>({
    queryKey: ["/api/media"],
    queryFn: () => apiRequest("GET", "/api/media"),
    enabled: can("media"),
  });

  const { data: sponsorList = [] } = useQuery<Sponsor[]>({
    queryKey: ["/api/sponsors/all"],
    queryFn: () => apiRequest("GET", "/api/sponsors/all"),
    enabled: can("sponsors"),
  });

  const { data: resultList = [] } = useQuery<MatchResult[]>({
    queryKey: ["/api/results/all"],
    queryFn: () => apiRequest("GET", "/api/results/all"),
    enabled: can("results"),
  });

  const { data: subscribers = [] } = useQuery<NewsletterSubscriber[]>({
    queryKey: ["/api/newsletter/subscribers"],
    queryFn: () => apiRequest("GET", "/api/newsletter/subscribers"),
    enabled: can("newsletter"),
  });

  const { data: contactMsgs = [] } = useQuery<ContactMessage[]>({
    queryKey: ["/api/contact"],
    queryFn: () => apiRequest("GET", "/api/contact"),
    enabled: can("messages"),
  });

  const { data: settings } = useQuery<Record<string, string>>({
    // The SECURE endpoint — the public /api/settings hides the mail fields, so
    // the Settings form has to read them from here (password comes back masked).
    queryKey: ["/api/settings/secure"],
    queryFn: () => apiRequest("GET", "/api/settings/secure"),
    enabled: can("settings"),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events/all"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event deleted" });
    },
  });

  const deleteRegistration = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/registrations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/registrations"] }); toast({ title: "Sign-up deleted" }); },
  });

  const deleteMessage = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contact/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/contact"] }); toast({ title: "Message deleted" }); },
  });

  const deleteAnn = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/announcements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/announcements/all"] });
      qc.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement deleted" });
    },
  });

  const updateRegStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/registrations/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/registrations"] }),
  });

  const saveSettings = useMutation({
    // Only what actually changed is sent. Sending the whole form (as this
    // once did) quietly put back old values for anything changed elsewhere
    // since the page loaded — the Shop tab's Stripe keys, the Menu — because
    // this form was still holding the old copy.
    mutationFn: (data: Record<string, string>) => {
      const changed = Object.fromEntries(
        Object.entries(data).filter(([key, value]) => (settings?.[key] ?? "") !== value),
      );
      return Object.keys(changed).length > 0 ? apiRequest("PUT", "/api/settings", changed) : Promise.resolve({ ok: true });
    },
    onSuccess: () => {
      // Refresh both: the secure copy (this form) and the public one (drives
      // the live site colours, logo etc. via useTheme/useSettings).
      qc.invalidateQueries({ queryKey: ["/api/settings/secure"] });
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
  });

  const deleteSponsor = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sponsors/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sponsors/all"] }); toast({ title: "Sponsor removed" }); },
  });

  const deleteResult = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/results/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/results/all"] }); toast({ title: "Result deleted" }); },
  });

  const unsubscribe = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/newsletter/subscribers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/newsletter/subscribers"] }),
  });

  const markContactRead = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/contact/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/contact"] }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User removed" });
    },
  });

  // Juniors content editing
  const [juniorsEdit, setJuniorsEdit] = useState<Record<string, { title: string; content: string }>>({});
  const [savingJuniors, setSavingJuniors] = useState(false);
  // Sections with unsaved typing. Fresh data from the server only replaces
  // sections that AREN'T in here, so saving one section can't wipe what
  // someone has typed (and not yet saved) in another.
  const [juniorsDirty, setJuniorsDirty] = useState<Set<string>>(new Set());
  const editJuniors = (section: string, change: Partial<{ title: string; content: string }>) => {
    setJuniorsEdit((p) => ({ ...p, [section]: { ...{ title: "", content: "" }, ...p[section], ...change } }));
    setJuniorsDirty((d) => new Set(d).add(section));
  };

  useEffect(() => {
    if (juniorsContent.length > 0) {
      setJuniorsEdit((prev) => {
        const map = { ...prev };
        juniorsContent.forEach((c) => {
          if (!juniorsDirty.has(c.section)) map[c.section] = { title: c.title ?? "", content: c.content };
        });
        return map;
      });
    }
  }, [juniorsContent]);

  const saveJuniors = async (section: string) => {
    setSavingJuniors(true);
    try {
      await apiRequest("PUT", `/api/juniors-content/${section}`, juniorsEdit[section]);
      setJuniorsDirty((d) => { const n = new Set(d); n.delete(section); return n; });
      qc.invalidateQueries({ queryKey: ["/api/juniors-content"] });
      toast({ title: "Juniors content updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingJuniors(false);
    }
  };

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  useEffect(() => { if (settings) setSettingsForm(settings); }, [settings]);

  // First-run wizard: only on a brand-new install where setup was never done.
  const showWizard =
    !wizardDone && can("settings") && settings?.setup_completed === "false";

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center text-stone-500">Loading...</div>;
  if (!user) {
    return isError ? (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-stone-700 font-medium">Can't reach the website's server right now.</p>
        <p className="text-sm text-stone-500">Check the internet connection, then try again.</p>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["/api/auth/me"] })}>Try again</Button>
      </div>
    ) : null;
  }

  // FIRST RUN: a brand-new install shows the setup wizard instead of the panel.
  // Sites that already have content are marked setup_completed=true by the
  // migration, so they never see this. Only super admins get it, and it can
  // be skipped.
  if (showWizard) {
    return <SetupWizard onDone={() => setWizardDone(true)} />;
  }

  const newRegs = registrations.filter((r) => r.status === "new").length;
  const unreadMsgs = contactMsgs.filter((m) => !m.isRead).length;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top bar */}
      <div className="bg-maroon-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <span className="font-bold">Admin Panel</span>
          <span className="text-maroon-300 text-sm ml-3">— {user.name}</span>
          <RoleBadge role={user.role} />
        </div>
        <div className="flex items-center gap-2">
          <ChangePasswordDialog
            onChanged={() => qc.invalidateQueries({ queryKey: ["/api/auth/me"] })}
            trigger={
              <Button size="sm" variant="outline" className="border-maroon-400 text-white hover:bg-maroon-600">
                <KeyRound className="h-4 w-4" />
                Password
              </Button>
            }
          />
          <Button
            size="sm"
            variant="outline"
            className="border-maroon-400 text-white hover:bg-maroon-600"
            onClick={() => logoutMutation.mutate(undefined, { onSuccess: () => navigate("/") })}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Default-password warning — shown until the admin changes it.
          Critical for a gifted site so it never sits on the public default. */}
      {user.usingDefaultPassword && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-3 text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm flex-1">
              <strong>Security warning:</strong> you're still using the default password.
              Anyone who knows it can log in. Please change it now.
            </p>
            <ChangePasswordDialog
              onChanged={() => qc.invalidateQueries({ queryKey: ["/api/auth/me"] })}
              trigger={<Button size="sm" variant="gold"><KeyRound className="h-4 w-4" />Change Password</Button>}
            />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Upcoming Events", value: events.filter((e) => new Date(e.startDate) >= new Date()).length, icon: Calendar, show: can("events") },
            { label: "Announcements", value: announcements.filter((a) => a.isPublished).length, icon: Megaphone, show: can("news") },
            { label: "New Sign-Ups", value: newRegs, icon: ClipboardList, show: can("signups") },
            { label: "Admin Users", value: adminUsers.length, icon: Users, show: can("users") },
            { label: "Unread Messages", value: unreadMsgs, icon: MessageSquare, show: can("messages") },
          ]
            .filter((s) => s.show)
            .map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <s.icon className="h-7 w-7 text-maroon-600" />
                  <div>
                    <div className="text-2xl font-bold text-stone-900">{s.value}</div>
                    <div className="text-xs text-stone-500">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { pickedTab.current = true; setActiveTab(v); }} orientation="vertical"
              className="flex flex-col md:flex-row gap-6 items-start">
          {/* Grouped sidebar — only shows sections this person may use */}
          <TabsList className="w-full md:w-56 shrink-0 flex-col h-auto bg-transparent p-0 gap-4 items-stretch">
            {visibleGroups.map((group) => (
              <div key={group.name}>
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  {group.name}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.sections.map((sec) => {
                    const Icon = ADMIN_ICONS[sec.icon] ?? FileText;
                    const badge = sec.id === "signups" ? newRegs : sec.id === "messages" ? unreadMsgs : 0;
                    return (
                      <TabsTrigger
                        key={sec.id}
                        value={sec.id}
                        className="justify-start gap-2 px-3 py-2 h-auto text-sm data-[state=active]:bg-maroon-700 data-[state=active]:text-white rounded-md"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left">{sec.label}</span>
                        {badge > 0 && (
                          <span className="bg-gold-500 text-on-accent text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                            {badge}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Help is available to everyone — it's the built-in user guide */}
            <div>
              <div className="flex flex-col gap-0.5 pt-2 border-t">
                <TabsTrigger value="help"
                  className="justify-start gap-2 px-3 py-2 h-auto text-sm data-[state=active]:bg-maroon-700 data-[state=active]:text-white rounded-md">
                  <HelpCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Help &amp; Guide</span>
                </TabsTrigger>
              </div>
            </div>
          </TabsList>

          {/* Panel — heading describes the current section */}
          <div className="flex-1 min-w-0 w-full">
            {currentSection && (
              <div className="mb-5 pb-4 border-b">
                <h1 className="text-xl font-bold text-stone-900">{currentSection.label}</h1>
                <p className="text-sm text-stone-500 mt-0.5">{currentSection.description}</p>
              </div>
            )}

          {/* ── Events ── */}
          {can("events") && (
            <TabsContent value="events">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Events</h2>
                <FormDialog title="New Event" trigger={<Button size="sm"><Plus className="h-4 w-4" />Add Event</Button>}>
                  {(close) => <EventForm onDone={close} />}
                </FormDialog>
              </div>
              <div className="space-y-3">
                {events.map((e) => (
                  <Card key={e.id}>
                    <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={e.eventType as any} className="text-xs capitalize">{e.eventType}</Badge>
                          {!e.isPublished && <Badge variant="secondary" className="text-xs">Draft</Badge>}
                        </div>
                        <p className="font-medium text-stone-900">{e.title}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{formatDate(e.startDate)} {e.location && `· ${e.location}`}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <FormDialog title="Edit Event" trigger={<Button size="icon" variant="ghost" aria-label={`Edit ${e.title}`}><Pencil className="h-4 w-4" /></Button>}>
                          {(close) => <EventForm event={e} onDone={close} />}
                        </FormDialog>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${e.title}`}
                          onClick={() => { if (confirm(`Delete the event "${e.title}" (${formatDate(e.startDate)})?\n\nThis can't be undone.`)) deleteEvent.mutate(e.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {events.length === 0 && <p className="text-stone-500 text-center py-8">No events yet. Add one above.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Announcements ── */}
          {can("news") && (
            <TabsContent value="news">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Announcements</h2>
                <FormDialog wide title="New Announcement" trigger={<Button size="sm"><Plus className="h-4 w-4" />New Post</Button>}>
                  {(close) => <AnnouncementForm onDone={close} />}
                </FormDialog>
              </div>
              <div className="space-y-3">
                {announcements.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {a.isPinned && <Badge variant="gold" className="text-xs">📌 Pinned</Badge>}
                          {a.isPublished
                            ? <Badge variant="default" className="text-xs">Published</Badge>
                            : <Badge variant="secondary" className="text-xs">Draft</Badge>}
                          <span className="text-xs text-stone-500">{formatDate(a.createdAt)}</span>
                        </div>
                        {a.featuredImageUrl && (
                          <img src={a.featuredImageUrl} alt="" className="w-16 h-10 object-cover rounded mb-1" />
                        )}
                        <p className="font-medium text-stone-900">{a.title}</p>
                        <p className="text-sm text-stone-500 line-clamp-2 mt-0.5">{previewText(a.content)}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <FormDialog wide title="Edit Announcement" trigger={<Button size="icon" variant="ghost" aria-label={`Edit ${a.title}`}><Pencil className="h-4 w-4" /></Button>}>
                          {(close) => <AnnouncementForm ann={a} onDone={close} />}
                        </FormDialog>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${a.title}`}
                          onClick={() => { if (confirm(`Delete the post "${a.title}"?\n\nThis can't be undone.`)) deleteAnn.mutate(a.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {announcements.length === 0 && <p className="text-stone-500 text-center py-8">No announcements yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Registrations ── */}
          {can("signups") && (
            <TabsContent value="signups">
              <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">Sign-Up Enquiries</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-500">{registrations.length} total</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href="/api/registrations/export" download><Download className="h-4 w-4" />Export CSV</a>
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {registrations.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-stone-900">{r.firstName} {r.lastName}</span>
                            <StatusBadge status={r.status} />
                            {r.isJunior && <Badge variant="secondary" className="text-xs">Junior</Badge>}
                            {r.kidsportEligible && <Badge variant="gold" className="text-xs">{t("subsidy_name") || "Fee help"} info</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>
                            {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                            {r.dateOfBirth && <span>Born {r.dateOfBirth}</span>}
                            <span className="capitalize">{r.teamPreference} · {r.experienceLevel}</span>
                            <span>{formatDate(r.createdAt)}</span>
                          </div>
                          {r.isJunior && (r.parentName || r.parentEmail || r.parentPhone) && (
                            <p className="text-xs text-stone-500 mt-1 flex items-center gap-1 flex-wrap">
                              <User className="h-3 w-3" />Parent: {[r.parentName, r.parentEmail, r.parentPhone].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {r.howHeard && <p className="text-xs text-stone-500 mt-1">Heard about us: {r.howHeard}</p>}
                          {r.message && <p className="text-xs text-stone-500 mt-1 italic">"{r.message}"</p>}
                        </div>
                        <Select
                          defaultValue={r.status}
                          onValueChange={(v) => updateRegStatus.mutate({ id: r.id, status: v })}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="registered">Registered</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon" variant="ghost" aria-label={`Delete the sign-up from ${r.firstName} ${r.lastName}`}
                          onClick={() => {
                            if (confirm(`Delete the sign-up from ${r.firstName} ${r.lastName}?\n\nAll their details are removed from the website for good. Do this when they ask you to, or once you've moved them into your registration system.`)) {
                              deleteRegistration.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {registrations.length === 0 && <p className="text-stone-500 text-center py-8">No sign-up enquiries yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Juniors Content ── */}
          {can("juniors") && (
            <TabsContent value="juniors">
              <h2 className="text-lg font-semibold mb-4">Juniors Page Content</h2>
              <div className="space-y-4">
                {["hero", "kidsport", "equipment", "contact"].map((section) => (
                  <Card key={section}>
                    <CardHeader>
                      <CardTitle className="text-sm capitalize text-maroon-700">{section} section</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Heading</Label>
                        <Input
                          value={juniorsEdit[section]?.title ?? ""}
                          onChange={(ev) => editJuniors(section, { title: ev.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Content</Label>
                        {section === "hero" ? (
                          // The hero line sits under the page heading as plain
                          // text; formatted text there showed up as raw <p> tags.
                          <Textarea
                            rows={2}
                            value={previewText(juniorsEdit[section]?.content ?? "")}
                            onChange={(ev) => editJuniors(section, { content: ev.target.value })}
                            placeholder="One or two sentences under the Juniors heading"
                          />
                        ) : (
                          <RichTextEditor
                            value={juniorsEdit[section]?.content ?? ""}
                            onChange={(html) => editJuniors(section, { content: html })}
                            placeholder={`Content for the ${section} section...`}
                            minHeight="100px"
                          />
                        )}
                      </div>
                      <Button size="sm" onClick={() => saveJuniors(section)} disabled={savingJuniors}>
                        <CheckCircle className="h-4 w-4" />Save {section}
                        {juniorsDirty.has(section) && <span className="text-[10px] ml-1">(unsaved)</span>}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* ── Match Results ── */}
          {can("results") && (
            <TabsContent value="results">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Match Results</h2>
                <FormDialog title="Add Match Result" trigger={<Button size="sm"><Plus className="h-4 w-4" />Add Result</Button>}>
                  {(close) => <ResultForm onDone={close} />}
                </FormDialog>
              </div>
              <div className="space-y-3">
                {resultList.map((r) => {
                  const win = r.ourScore != null && r.theirScore != null && r.ourScore > r.theirScore;
                  const loss = r.ourScore != null && r.theirScore != null && r.ourScore < r.theirScore;
                  return (
                    <Card key={r.id}>
                      <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <Badge variant="secondary" className="text-xs capitalize">{r.teamCategory}</Badge>
                            {r.division && <Badge variant="secondary" className="text-xs">{r.division}</Badge>}
                            {!r.isPublished && <Badge variant="outline" className="text-xs">Draft</Badge>}
                            <span className="text-xs text-stone-500">{r.matchDate}</span>
                          </div>
                          <p className="font-semibold text-stone-900">{r.isHome ? "vs" : "@"} {r.opposition}</p>
                          {r.ourScore != null && r.theirScore != null && (
                            <p className={`text-sm font-bold ${win ? "text-green-700" : loss ? "text-red-600" : "text-stone-600"}`}>
                              {r.ourScore} – {r.theirScore} {win ? "Win" : loss ? "Loss" : "Draw"}
                            </p>
                          )}
                          {r.notes && <p className="text-xs text-stone-500 italic mt-0.5">{r.notes}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <FormDialog title="Edit Match Result" trigger={<Button size="icon" variant="ghost" aria-label={`Edit the result against ${r.opposition}`}><Pencil className="h-4 w-4" /></Button>}>
                            {(close) => <ResultForm result={r} onDone={close} />}
                          </FormDialog>
                          <Button size="icon" variant="ghost" aria-label={`Delete the result against ${r.opposition}`}
                            onClick={() => { if (confirm(`Delete the result against ${r.opposition} (${r.matchDate})?`)) deleteResult.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {resultList.length === 0 && <p className="text-stone-500 text-center py-8">No results yet. Add one above.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Sponsors ── */}
          {can("sponsors") && (
            <TabsContent value="sponsors">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Sponsors</h2>
                <FormDialog title="Add Sponsor" trigger={<Button size="sm"><Plus className="h-4 w-4" />Add Sponsor</Button>}>
                  {(close) => <SponsorForm onDone={close} />}
                </FormDialog>
              </div>
              <div className="space-y-3">
                {sponsorList.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="pt-4 pb-4 flex items-center gap-4">
                      {s.logoUrl
                        ? <img src={s.logoUrl} alt={s.name} className="h-10 w-20 object-contain rounded" />
                        : <div className="h-10 w-20 bg-stone-100 rounded flex items-center justify-center text-xs text-stone-500">No logo</div>
                      }
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-stone-900">{s.name}</span>
                          <Badge variant="gold" className="text-xs capitalize">{s.tier}</Badge>
                          {!s.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                        </div>
                        {s.websiteUrl && <p className="text-xs text-maroon-600 hover:underline"><a href={s.websiteUrl} target="_blank" rel="noopener noreferrer">{s.websiteUrl}</a></p>}
                      </div>
                      <div className="flex gap-1">
                        <FormDialog title="Edit Sponsor" trigger={<Button size="icon" variant="ghost" aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></Button>}>
                          {(close) => <SponsorForm sponsor={s} onDone={close} />}
                        </FormDialog>
                        <Button size="icon" variant="ghost" title={s.isActive ? "Hide from the website" : "Show on the website"}
                          aria-label={s.isActive ? `Hide ${s.name}` : `Show ${s.name}`}
                          onClick={() => {
                            apiRequest("PUT", `/api/sponsors/${s.id}`, { isActive: !s.isActive })
                              .then(() => { qc.invalidateQueries({ queryKey: ["/api/sponsors/all"] }); qc.invalidateQueries({ queryKey: ["/api/sponsors"] }); })
                              .catch((e) => toast({ title: "Couldn't change that", description: e.message, variant: "destructive" }));
                          }}>
                          <Eye className="h-4 w-4 text-stone-500" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remove ${s.name}?`)) deleteSponsor.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {sponsorList.length === 0 && (
                  <div className="text-center py-8 text-stone-500">
                    <p>No sponsors yet.</p>
                    <p className="text-xs mt-1">Press Add Sponsor, then upload their logo or pick one from your photo library.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* ── Newsletter ── */}
          {can("newsletter") && (
            <TabsContent value="newsletter">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Newsletter Subscribers</h2>
                <div className="flex gap-2">
                  <span className="text-sm text-stone-500">{subscribers.length} active</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href="/api/newsletter/export" download>
                      <Download className="h-4 w-4" />Export CSV
                    </a>
                  </Button>
                </div>
              </div>
              <Card className="mb-4 bg-stone-50">
                <CardContent className="pt-4 pb-4 text-sm text-stone-600">
                  <p>Subscribers opt in via the newsletter widget on the home page. Export to CSV to import into Mailchimp or any email platform.</p>
                </CardContent>
              </Card>
              <div className="space-y-2">
                {subscribers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 rounded-lg border bg-white">
                    <div>
                      <span className="font-medium text-stone-900 text-sm">{s.name || s.email}</span>
                      {s.name && <span className="text-xs text-stone-500 ml-2">{s.email}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-500">{s.subscribedAt?.split("T")[0]}</span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => { if (confirm(`Remove ${s.email} from the list?\n\nTheir address is deleted from the website.`)) unsubscribe.mutate(s.id); }}>Remove</Button>
                    </div>
                  </div>
                ))}
                {subscribers.length === 0 && <p className="text-stone-500 text-center py-8">No subscribers yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Page Lists (team divisions, juniors FAQ) ── */}
          {/* Things you sell are NOT here — they live under Shop, which has
              prices, sizes and stock. */}
          {can("lists") && (
            <TabsContent value="lists">
              <div className="space-y-8">
                <ListManager
                  listType="team_division"
                  title="Team Divisions"
                  description="Shown on the About and Fixtures pages. Group is the team (Men's, Women's, Juniors); the link opens the fixtures page for that division."
                  fields={[
                    { key: "group", label: "Team (Men's / Women's / Juniors)", placeholder: "Men's", required: true },
                    { key: "title", label: "Division name", placeholder: "Division 1", required: true },
                    { key: "url", label: "Fixtures link (optional)", placeholder: "https://..." },
                  ]}
                />
                <ListManager
                  listType="affiliation"
                  title="Affiliations & programs"
                  description="Cards on the About page under 'Affiliated With', after your league. For example a wellbeing program the club is part of, or a junior fee-help scheme you're a registered provider for. Leave empty if there are none."
                  fields={[
                    { key: "title", label: "Name", placeholder: "e.g. Act Belong Commit", required: true },
                    { key: "body", label: "What it means for members", textarea: true, placeholder: "One or two sentences" },
                    { key: "url", label: "Website (optional)", placeholder: "https://..." },
                  ]}
                />
                <ListManager
                  listType="faq"
                  title="Juniors FAQ"
                  description="The questions & answers in the Juniors page accordion."
                  fields={[
                    { key: "title", label: "Question", placeholder: "What age can my child start?", required: true },
                    { key: "body", label: "Answer", textarea: true, placeholder: "We welcome players from age 8…" },
                  ]}
                />
              </div>
            </TabsContent>
          )}

          {/* ── Media Library ── */}
          {can("media") && (
            <TabsContent value="media">
              <MediaLibrary items={mediaItems} onChanged={() => qc.invalidateQueries({ queryKey: ["/api/media"] })} />
            </TabsContent>
          )}

          {/* ── Pages — admin-created custom pages ── */}
          {can("pages") && (
            <TabsContent value="pages">
              <AdminPages />
            </TabsContent>
          )}

          {/* ── Contact Messages ── */}
          {can("messages") && (
            <TabsContent value="messages">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Contact Messages</h2>
                <span className="text-sm text-stone-500">{contactMsgs.length} total · {unreadMsgs} unread</span>
              </div>
              <div className="space-y-3">
                {contactMsgs.map((m) => (
                  <Card key={m.id} className={m.isRead ? "opacity-70" : "border-maroon-200"}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-stone-900">{m.name}</span>
                            {!m.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                            <span className="text-xs text-stone-500">{formatDate(m.createdAt)}</span>
                          </div>
                          <p className="text-xs text-stone-500 flex items-center gap-1 mb-1">
                            <Mail className="h-3 w-3" />{m.email}
                          </p>
                          <p className="text-sm font-medium text-stone-700 mb-1">{m.subject}</p>
                          <p className="text-sm text-stone-500 whitespace-pre-line">{m.message}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!m.isRead && (
                            <Button size="icon" variant="ghost" title="Mark as read"
                              onClick={() => markContactRead.mutate(m.id)}>
                              <Eye className="h-4 w-4 text-stone-500" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Reply by email" aria-label={`Reply to ${m.name} by email`} asChild>
                            <a href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>
                              <Mail className="h-4 w-4 text-maroon-600" />
                            </a>
                          </Button>
                          <Button size="icon" variant="ghost" title="Delete message" aria-label={`Delete the message from ${m.name}`}
                            onClick={() => { if (confirm(`Delete the message from ${m.name} ("${m.subject}")?`)) deleteMessage.mutate(m.id); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {contactMsgs.length === 0 && <p className="text-stone-500 text-center py-8">No contact messages yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Users ── */}
          {can("users") && (
            <TabsContent value="users">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Admin Users</h2>
                <FormDialog title="Create Admin User" trigger={<Button size="sm"><Plus className="h-4 w-4" />Add Admin</Button>}>
                  {(close) => <UserForm onDone={close} />}
                </FormDialog>
              </div>
              <div className="space-y-3">
                {adminUsers.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-stone-900">{u.name}</span>
                          <RoleBadge role={u.role} />
                          {!u.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                        </div>
                        <p className="text-xs text-stone-500">@{u.username} · {u.email}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <FormDialog title={`Edit ${u.name}`} trigger={<Button size="icon" variant="ghost" aria-label={`Edit ${u.name}`}><Pencil className="h-4 w-4" /></Button>}>
                          {(close) => <UserEditForm account={u} isSelf={u.id === (user as any)?.id} onDone={close} />}
                        </FormDialog>
                        {u.id !== (user as any)?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Remove ${u.name}`}
                            onClick={() => { if (confirm(`Remove ${u.name} (@${u.username})?\n\nThey won't be able to log in. Their posts and photos stay on the site.`)) deleteUser.mutate(u.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* ── Settings ── */}
          {can("settings") && (
            <TabsContent value="settings">
              <h2 className="text-lg font-semibold mb-4">Site Settings</h2>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {/* Club identity — the name shown in the nav, footer and page titles */}
                  {[
                    { key: "club_name", label: "Club name", help: "Main name in the logo and footer, e.g. Riverside Rovers." },
                    { key: "club_name_suffix", label: "Club name — second line", help: "The smaller line beneath it, e.g. Lacrosse Club." },
                    { key: "club_tagline", label: "Footer tagline", help: "The short description in the footer." },
                  ].map(({ key, label, help }) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        value={settingsForm[key] ?? ""}
                        onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))}
                      />
                      <p className="text-xs text-stone-500">{help}</p>
                    </div>
                  ))}

                  {/* Image settings — click to pick from the media library (no URL pasting) */}
                  <ImagePicker
                    label="Club Logo"
                    value={settingsForm.club_logo_url || undefined}
                    onChange={(url) => setSettingsForm((p) => ({ ...p, club_logo_url: url ?? "" }))}
                    hint="Shown in the menu bar and on the home page. Leave blank to show the club's initial instead."
                  />
                  <ImagePicker
                    label="Hero Background Image"
                    value={settingsForm.hero_image_url || undefined}
                    onChange={(url) => setSettingsForm((p) => ({ ...p, hero_image_url: url ?? "" }))}
                    hint="The big photo behind the home page heading (shown under a tint of your primary colour). Also used as the picture when the site is shared on social media."
                  />

                  {/* Text settings */}
                  {[
                    { key: "google_calendar_embed_url", label: "Google Calendar Embed URL", help: "In Google Calendar → Settings → your calendar → 'Integrate calendar' → copy the Embed URL (starts with https://calendar.google.com/calendar/embed?...)." },
                    { key: "behold_feed_id", label: "Behold.so Feed ID (Instagram)", help: "Create a free feed at behold.so, connect your club’s Instagram account, then paste the Feed ID here." },
                    { key: "store_url", label: "Online Store URL", help: "Link to your online merch store (e.g. Shopify, Redbubble, PrintFul). Leave blank to show the 'coming soon' message." },
                    { key: "venue_name", label: "Home ground name", help: "Your home ground or venue name. Shown on About, Contact, the home page strip and the footer." },
                    { key: "venue_address", label: "Ground address", help: "Street address or suburb, postcode and state. Displayed under the ground name." },
                    { key: "map_query", label: "Map location", help: "What to show on the embedded maps — an address, place name or coordinates. Leave blank to hide the map." },
                    { key: "contact_email", label: "Club email address", help: "Every 'email us' link on the site points here." },
                    { key: "instagram_handle", label: "Instagram Handle" },
                    { key: "facebook_url", label: "Facebook URL" },
                    { key: "gameday_registration_url", label: "GameDay Registration URL", help: "The GameDay form players use to register/pay." },
                    { key: "gameday_url", label: "GameDay Fixtures & Results URL", help: "The club's GameDay page — powers the main Fixtures & Results links across the site." },
                    { key: "lacrossewa_fixtures_url", label: `${t("league_name") || "League"} Fixtures URL`, help: "League-wide fixtures page on your governing body’s website. Leave blank to hide the link." },
                  ].map(({ key, label, help }) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        value={settingsForm[key] ?? ""}
                        onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))}
                      />
                      {/* Warn, never block. Someone may have a perfectly good
                          address we don't recognise, and losing their typing
                          would be far worse than showing an unnecessary note. */}
                      <FieldWarning message={checkSettingValue(key, settingsForm[key] ?? "")} />
                      {help && <p className="text-xs text-stone-500">{help}</p>}
                    </div>
                  ))}
                  <Button onClick={() => saveSettings.mutate(settingsForm)} disabled={saveSettings.isPending}>
                    {saveSettings.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </CardContent>
              </Card>

              {/* ── Wording & club details ── */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-maroon-700" />
                    Wording &amp; club details
                  </CardTitle>
                  <p className="text-sm text-stone-500">
                    The words the site uses about your club. Everything the setup wizard asked about is
                    here too, so it can be changed again. Leave a box empty to use the standard wording.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {WORDING_FIELDS.map(({ key, label, help, long }) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`wording-${key}`}>{label}</Label>
                      {long ? (
                        <Textarea id={`wording-${key}`} rows={3} placeholder={t(key)}
                          value={settingsForm[key] ?? ""}
                          onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))} />
                      ) : (
                        <Input id={`wording-${key}`} placeholder={t(key)}
                          value={settingsForm[key] ?? ""}
                          onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))} />
                      )}
                      <FieldWarning message={checkSettingValue(key, settingsForm[key] ?? "")} />
                      {help && <p className="text-xs text-stone-500">{help}</p>}
                    </div>
                  ))}
                  <Button onClick={() => saveSettings.mutate(settingsForm)} disabled={saveSettings.isPending}>
                    {saveSettings.isPending ? "Saving..." : "Save Wording"}
                  </Button>
                </CardContent>
              </Card>

              {/* ── Page Visibility ── */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ToggleLeft className="h-5 w-5 text-maroon-700" />
                    Page Visibility
                  </CardTitle>
                  <p className="text-sm text-stone-500">
                    Toggle pages on or off. When off, the page disappears from the menu, footer and search
                    engines, and its address shows "page not found". Changes take effect instantly.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: "nav_show_gallery",    label: "Photo Gallery",    desc: "The /gallery page showing uploaded photos" },
                    { key: "nav_show_fixtures",   label: "Fixtures",         desc: "The /fixtures page linking to your league & fixtures provider" },
                    { key: "nav_show_store",      label: "Club Store",       desc: "The /store merchandise page" },
                    { key: "nav_show_coaches_board", label: "Coaches Board", desc: "The tactical whiteboard app for coaches (under the Club menu)" },
                    { key: "nav_show_committee", label: "President & Board", desc: "The committee page listing your club's office bearers" },
                    { key: "nav_show_results",    label: "Recent Results",   desc: "Match results section on the home page" },
                    { key: "nav_show_sponsors",   label: "Sponsor Strip",    desc: "Sponsor logos shown at the bottom of the home page" },
                    { key: "nav_show_newsletter", label: "Newsletter Widget",desc: "Email subscribe form on the home page" },
                    { key: "nav_show_juniors",    label: "Juniors Page",     desc: "The /juniors page in the navigation" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-stone-800 text-sm">{label}</p>
                        <p className="text-xs text-stone-500">{desc}</p>
                      </div>
                      <Switch
                        checked={settingsForm[key] !== "false"}
                        aria-label={label}
                        onCheckedChange={(checked) => {
                          const value = checked ? "true" : "false";
                          setSettingsForm((p) => ({ ...p, [key]: value }));
                          // Just this one switch: never the rest of the form,
                          // which may hold unsaved typing.
                          saveSettings.mutate({ ...(settings ?? {}), [key]: value });
                        }}
                      />
                    </div>
                  ))}
                <div className="pt-2 text-xs text-stone-500">Tip: You can always re-enable a page here if you want to add it back later.</div>
                </CardContent>
              </Card>

              {/* ── Club Colours ── */}
              {/* These drive the CSS variables in index.css, so changing one
                  instantly restyles every banner, heading, button and accent. */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-maroon-700" />
                    Club Colours
                  </CardTitle>
                  <p className="text-sm text-stone-500">
                    Change the colours used across the whole site — page banners,
                    headings, buttons and accent bars. Pick a colour or paste a hex
                    code. Changes apply the moment you save.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: "theme_primary", label: "Primary colour", fallback: "#7B1E32",
                      help: "Banners, buttons and headings. This is the club's main colour." },
                    { key: "theme_primary_dark", label: "Banner shadow colour", fallback: "#3A0C17",
                      help: "The darker shade the banner fades into. Usually a deeper version of the primary." },
                    { key: "theme_accent", label: "Accent colour", fallback: "#C5942A",
                      help: "Gold bars under headings, highlight buttons and pinned posts." },
                  ].map(({ key, label, fallback, help }) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-9 w-14 rounded border cursor-pointer bg-white p-0.5"
                          value={settingsForm[key] || fallback}
                          onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))}
                        />
                        <Input
                          className="font-mono"
                          placeholder={fallback}
                          value={settingsForm[key] ?? ""}
                          onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))}
                        />
                      </div>
                      {/* Is it a colour at all? Caught first, because a
                          contrast check on "#zzz" would be meaningless. */}
                      <FieldWarning message={checkColour(settingsForm[key] ?? "")} />

                      {/* Only the PRIMARY colour is checked for readability.
                          It is the banner behind white text on every page, so
                          a pale choice there makes the site genuinely unusable.
                          The accent is only used for the bar under headings and
                          for buttons that carry DARK text, and the dark shade
                          is just the far end of a gradient — warning about
                          those would be a false alarm, and warnings people
                          learn to ignore are worse than none. */}
                      {key === "theme_primary" && (() => {
                        const check = checkTextOnColour(settingsForm[key] || fallback);
                        if (check.ok) return null;
                        return (
                          <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5"
                             title={check.message} role="status">
                            <span>
                              {check.message}
                              {check.ratio !== null && ` (currently ${check.ratio.toFixed(1)}:1, needs 4.5:1)`}
                            </span>
                          </p>
                        );
                      })()}
                      <p className="text-xs text-stone-500">{help}</p>
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <Label>Banner gradient direction</Label>
                    <Select
                      value={settingsForm.theme_gradient_angle || "135deg"}
                      onValueChange={(v) => setSettingsForm((p) => ({ ...p, theme_gradient_angle: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="135deg">Diagonal (default)</SelectItem>
                        <SelectItem value="90deg">Left to right</SelectItem>
                        <SelectItem value="180deg">Top to bottom</SelectItem>
                        <SelectItem value="45deg">Diagonal (other way)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Live preview so admins see the result before saving */}
                  <div>
                    <Label className="mb-1.5 block">Preview</Label>
                    <div
                      className="rounded-xl p-6 text-center text-white shadow-sm"
                      style={{
                        background: `linear-gradient(${settingsForm.theme_gradient_angle || "135deg"}, ${settingsForm.theme_primary || "#7B1E32"} 0%, ${settingsForm.theme_primary_dark || "#3A0C17"} 100%)`,
                      }}
                    >
                      <p className="text-xl font-extrabold">{settingsForm.club_name || t("club_name")}</p>
                      <div
                        className="h-1 w-16 mx-auto mt-2 rounded-full"
                        style={{ background: settingsForm.theme_accent || "#C5942A" }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => saveSettings.mutate(settingsForm)} disabled={saveSettings.isPending}>
                      {saveSettings.isPending ? "Saving..." : "Save Colours"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const colours = {
                          theme_primary: "#7B1E32", theme_primary_dark: "#3A0C17",
                          theme_accent: "#C5942A", theme_gradient_angle: "135deg" };
                        if (!confirm("Put the colours back to the starting maroon and gold?")) return;
                        setSettingsForm((p) => ({ ...p, ...colours }));
                        saveSettings.mutate({ ...(settings ?? {}), ...colours });
                      }}
                    >
                      Reset colours
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ── Email server ── */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-maroon-700" />
                    Email (SMTP) Settings
                  </CardTitle>
                  <p className="text-sm text-stone-500">
                    Used to email the club when someone signs up or sends a message.
                    Leave blank to keep using the server's <code>.env</code> settings.
                    Test it and switch it on/off in the <strong>Security</strong> tab.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: "mail_user", label: "Sending email address", type: "email",
                      help: "The full address emails are sent from, e.g. contact@mail.yourclub.com.au — also used as the SMTP username." },
                    { key: "mail_pass", label: "SMTP password", type: "password",
                      help: "From your email provider (e.g. Mailgun). Stored securely and never shown again once saved." },
                    { key: "mail_notify", label: "Send club notifications to", type: "email",
                      help: "Where sign-up and contact alerts are delivered. Usually the club's main inbox." },
                    { key: "mail_host", label: "SMTP server (optional)", type: "text",
                      help: "Leave blank to detect automatically from the address above. Override only if your provider requires it." },
                    { key: "mail_port", label: "SMTP port (optional)", type: "text",
                      help: "Usually 587. Use 465 only if your provider requires implicit TLS." },
                  ].map(({ key, label, type, help }) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        type={type}
                        autoComplete={type === "password" ? "new-password" : "off"}
                        value={settingsForm[key] ?? ""}
                        onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))}
                      />
                      <p className="text-xs text-stone-500">{help}</p>
                    </div>
                  ))}
                  <Button onClick={() => saveSettings.mutate(settingsForm)} disabled={saveSettings.isPending}>
                    {saveSettings.isPending ? "Saving..." : "Save Email Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ── Security — email kill-switch, password resets, lockouts ── */}
          {can("security") && (
            <TabsContent value="security">
              <AdminSecurity currentUserId={user.id} />
            </TabsContent>
          )}

          {/* ── Committee / Board ── */}
          {can("committee") && (
            <TabsContent value="committee">
              <AdminCommittee />
            </TabsContent>
          )}

          {/* ── Shop ── */}
          {can("store") && (
            <TabsContent value="shop">
              <AdminStore />
            </TabsContent>
          )}
          {can("settings") && (
            <TabsContent value="menu">
              <AdminMenu />
            </TabsContent>
          )}

          {can("store") && (
            <TabsContent value="stock">
              <AdminStock />
            </TabsContent>
          )}
          {can("store") && (
            <TabsContent value="orders">
              <AdminOrders />
            </TabsContent>
          )}

          {/* ── Help — the built-in admin user guide (all roles) ── */}
          <TabsContent value="help">
            <AdminHelp />
          </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
