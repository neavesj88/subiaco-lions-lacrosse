import { useEffect, useState } from "react";
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
import ImageUploader from "@/components/image-uploader";
import ImagePicker from "@/components/image-picker";
import ChangePasswordDialog from "@/components/change-password-dialog";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-path";
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
  KeyRound, AlertTriangle
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ListManager from "@/components/list-manager";
import type { Event, Announcement, Registration, JuniorsContent, ContactMessage, MediaUpload, Sponsor, MatchResult, NewsletterSubscriber } from "@shared/schema";

// ── Result form ────────────────────────────────────────────────────────────────
function ResultForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: { matchDate: "", opposition: "", ourScore: "", theirScore: "", teamCategory: "mens", division: "", venue: "", isHome: true, notes: "", isPublished: true },
  });
  const mutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/results", { ...d, ourScore: d.ourScore !== "" ? parseInt(d.ourScore) : null, theirScore: d.theirScore !== "" ? parseInt(d.theirScore) : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/results/all"] }); qc.invalidateQueries({ queryKey: ["/api/results"] }); toast({ title: "Result added" }); onDone(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Date *</Label><Input type="date" {...register("matchDate", { required: true })} /></div>
        <div className="space-y-1">
          <Label>Team</Label>
          <Select onValueChange={(v) => setValue("teamCategory", v)} defaultValue="mens">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mens">Men's</SelectItem>
              <SelectItem value="womens">Women's</SelectItem>
              <SelectItem value="juniors">Juniors</SelectItem>
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
        <div className="space-y-1"><Label>Venue</Label><Input placeholder="e.g. Rosalie Park" {...register("venue")} /></div>
      </div>
      <div className="space-y-1"><Label>Notes</Label><Input placeholder="Optional notes or summary" {...register("notes")} /></div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">{mutation.isPending ? "Saving..." : "Add Result"}</Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Sponsor form ───────────────────────────────────────────────────────────────
function SponsorForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: { name: "", websiteUrl: "", tier: "partner", sortOrder: 0 },
  });
  const mutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/sponsors", { ...d, logoUrl: logoUrl ?? null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sponsors/all"] }); qc.invalidateQueries({ queryKey: ["/api/sponsors"] }); toast({ title: "Sponsor added" }); onDone(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="space-y-1"><Label>Sponsor Name *</Label><Input placeholder="e.g. Acme Pty Ltd" {...register("name", { required: true })} /></div>
      <div className="space-y-1"><Label>Website URL</Label><Input placeholder="https://..." {...register("websiteUrl")} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tier</Label>
          <Select onValueChange={(v) => setValue("tier", v)} defaultValue="partner">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gold">Gold (largest)</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
              <SelectItem value="partner">Partner (smallest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Sort order</Label><Input type="number" min="0" {...register("sortOrder")} /></div>
      </div>
      <ImagePicker
        label="Sponsor Logo"
        value={logoUrl}
        onChange={setLogoUrl}
        hint="Upload a new logo or pick one from your media library."
      />
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">{mutation.isPending ? "Saving..." : "Add Sponsor"}</Button>
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
  };
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    club_admin: "Club Admin",
    juniors_coordinator: "Juniors Coordinator",
    content_manager: "Content Manager",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[role] ?? "bg-stone-100"}`}>
      {labels[role] ?? role}
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
        <Input placeholder="Rosalie Park, Shenton Park" {...register("location")} />
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
              <SelectItem value="all">All Teams</SelectItem>
              <SelectItem value="mens">Men's</SelectItem>
              <SelectItem value="womens">Women's</SelectItem>
              <SelectItem value="juniors">Juniors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
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
        <p className="text-xs text-stone-400 -mt-1">Use the toolbar to add formatting — bold, bullet points, links etc.</p>
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
            <SelectItem value="super_admin">Super Admin (full access)</SelectItem>
            <SelectItem value="club_admin">Club Admin (events + sign-ups)</SelectItem>
            <SelectItem value="juniors_coordinator">Juniors Coordinator</SelectItem>
            <SelectItem value="content_manager">Content Manager (announcements)</SelectItem>
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

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading, logoutMutation, hasRole } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoading && !user) navigate(ADMIN_LOGIN_PATH);
  }, [user, isLoading]);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events/all"],
    queryFn: () => apiRequest("GET", "/api/events/all"),
    enabled: hasRole("club_admin"),
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements/all"],
    queryFn: () => apiRequest("GET", "/api/announcements/all"),
    enabled: hasRole("content_manager"),
  });

  const { data: registrations = [] } = useQuery<Registration[]>({
    queryKey: ["/api/registrations"],
    queryFn: () => apiRequest("GET", "/api/registrations"),
    enabled: hasRole("club_admin"),
  });

  const { data: juniorsContent = [] } = useQuery<JuniorsContent[]>({
    queryKey: ["/api/juniors-content"],
    queryFn: () => apiRequest("GET", "/api/juniors-content"),
    enabled: hasRole("juniors_coordinator"),
  });

  const { data: adminUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    enabled: hasRole("super_admin"),
  });

  const { data: mediaItems = [] } = useQuery<MediaUpload[]>({
    queryKey: ["/api/media"],
    queryFn: () => apiRequest("GET", "/api/media"),
    enabled: hasRole("content_manager"),
  });

  const { data: sponsorList = [] } = useQuery<Sponsor[]>({
    queryKey: ["/api/sponsors/all"],
    queryFn: () => apiRequest("GET", "/api/sponsors/all"),
    enabled: hasRole("club_admin"),
  });

  const { data: resultList = [] } = useQuery<MatchResult[]>({
    queryKey: ["/api/results/all"],
    queryFn: () => apiRequest("GET", "/api/results/all"),
    enabled: hasRole("club_admin"),
  });

  const { data: subscribers = [] } = useQuery<NewsletterSubscriber[]>({
    queryKey: ["/api/newsletter/subscribers"],
    queryFn: () => apiRequest("GET", "/api/newsletter/subscribers"),
    enabled: hasRole("club_admin"),
  });

  const { data: contactMsgs = [] } = useQuery<ContactMessage[]>({
    queryKey: ["/api/contact"],
    queryFn: () => apiRequest("GET", "/api/contact"),
    enabled: hasRole("club_admin"),
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
    enabled: hasRole("super_admin"),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events/all"] });
      toast({ title: "Event deleted" });
    },
  });

  const deleteAnn = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/announcements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/announcements/all"] });
      toast({ title: "Announcement deleted" });
    },
  });

  const updateRegStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/registrations/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/registrations"] }),
  });

  const saveSettings = useMutation({
    mutationFn: (data: Record<string, string>) => apiRequest("PUT", "/api/settings", data),
    onSuccess: () => {
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

  useEffect(() => {
    if (juniorsContent.length > 0) {
      const map: Record<string, { title: string; content: string }> = {};
      juniorsContent.forEach((c) => { map[c.section] = { title: c.title ?? "", content: c.content }; });
      setJuniorsEdit(map);
    }
  }, [juniorsContent]);

  const saveJuniors = async (section: string) => {
    setSavingJuniors(true);
    try {
      await apiRequest("PUT", `/api/juniors-content/${section}`, juniorsEdit[section]);
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

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center text-stone-400">Loading...</div>;
  if (!user) return null;

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
            { label: "Upcoming Events", value: events.filter((e) => new Date(e.startDate) >= new Date()).length, icon: Calendar, show: hasRole("club_admin") },
            { label: "Announcements", value: announcements.filter((a) => a.isPublished).length, icon: Megaphone, show: hasRole("content_manager") },
            { label: "New Sign-Ups", value: newRegs, icon: ClipboardList, show: hasRole("club_admin") },
            { label: "Admin Users", value: adminUsers.length, icon: Users, show: hasRole("super_admin") },
            { label: "Unread Messages", value: unreadMsgs, icon: MessageSquare, show: hasRole("club_admin") },
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

        <Tabs defaultValue={hasRole("club_admin") ? "events" : hasRole("content_manager") ? "announcements" : "juniors"}>
          <TabsList className="flex-wrap h-auto mb-6">
            {hasRole("club_admin") && <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-1" />Events</TabsTrigger>}
            {hasRole("content_manager") && <TabsTrigger value="announcements"><Megaphone className="h-4 w-4 mr-1" />News</TabsTrigger>}
            {hasRole("club_admin") && (
              <TabsTrigger value="registrations">
                <ClipboardList className="h-4 w-4 mr-1" />Sign-Ups
                {newRegs > 0 && <span className="ml-1 bg-gold-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{newRegs}</span>}
              </TabsTrigger>
            )}
            {hasRole("juniors_coordinator") && <TabsTrigger value="juniors"><Star className="h-4 w-4 mr-1" />Juniors</TabsTrigger>}
              {hasRole("club_admin") && (
              <TabsTrigger value="messages">
                <MessageSquare className="h-4 w-4 mr-1" />Messages
                {unreadMsgs > 0 && <span className="ml-1 bg-maroon-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{unreadMsgs}</span>}
              </TabsTrigger>
            )}
            {hasRole("club_admin") && <TabsTrigger value="results"><Trophy className="h-4 w-4 mr-1" />Results</TabsTrigger>}
            {hasRole("club_admin") && <TabsTrigger value="sponsors"><Heart className="h-4 w-4 mr-1" />Sponsors</TabsTrigger>}
            {hasRole("club_admin") && <TabsTrigger value="newsletter"><Mail className="h-4 w-4 mr-1" />Newsletter</TabsTrigger>}
            {hasRole("club_admin") && <TabsTrigger value="content"><ListIcon className="h-4 w-4 mr-1" />Page Lists</TabsTrigger>}
            {hasRole("content_manager") && <TabsTrigger value="media"><ImageIcon className="h-4 w-4 mr-1" />Media</TabsTrigger>}
            {hasRole("super_admin") && <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>}
            {hasRole("super_admin") && <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Settings</TabsTrigger>}
          </TabsList>

          {/* ── Events ── */}
          {hasRole("club_admin") && (
            <TabsContent value="events">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Events</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4" />Add Event</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
                    <EventForm onDone={() => {}} />
                  </DialogContent>
                </Dialog>
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
                        <p className="text-xs text-stone-400 mt-0.5">{formatDate(e.startDate)} {e.location && `· ${e.location}`}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
                            <EventForm event={e} onDone={() => {}} />
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm("Delete this event?")) deleteEvent.mutate(e.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {events.length === 0 && <p className="text-stone-400 text-center py-8">No events yet. Add one above.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Announcements ── */}
          {hasRole("content_manager") && (
            <TabsContent value="announcements">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Announcements</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4" />New Post</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
                    <AnnouncementForm onDone={() => {}} />
                  </DialogContent>
                </Dialog>
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
                          <span className="text-xs text-stone-400">{formatDate(a.createdAt)}</span>
                        </div>
                        {a.featuredImageUrl && (
                          <img src={a.featuredImageUrl} alt="" className="w-16 h-10 object-cover rounded mb-1" />
                        )}
                        <p className="font-medium text-stone-900">{a.title}</p>
                        <p className="text-sm text-stone-500 line-clamp-2 mt-0.5">{a.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader><DialogTitle>Edit Announcement</DialogTitle></DialogHeader>
                            <AnnouncementForm ann={a} onDone={() => {}} />
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm("Delete?")) deleteAnn.mutate(a.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {announcements.length === 0 && <p className="text-stone-400 text-center py-8">No announcements yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Registrations ── */}
          {hasRole("club_admin") && (
            <TabsContent value="registrations">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Sign-Up Enquiries</h2>
                <span className="text-sm text-stone-500">{registrations.length} total</span>
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
                            {r.kidsportEligible && <Badge variant="gold" className="text-xs">KidSport</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>
                            {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                            <span className="capitalize">{r.teamPreference} · {r.experienceLevel}</span>
                            <span>{formatDate(r.createdAt)}</span>
                          </div>
                          {r.isJunior && r.parentName && (
                            <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                              <User className="h-3 w-3" />Parent: {r.parentName} {r.parentEmail && `· ${r.parentEmail}`}
                            </p>
                          )}
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {registrations.length === 0 && <p className="text-stone-400 text-center py-8">No sign-up enquiries yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Juniors Content ── */}
          {hasRole("juniors_coordinator") && (
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
                          onChange={(ev) => setJuniorsEdit((p) => ({ ...p, [section]: { ...p[section], title: ev.target.value } }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Content</Label>
                        <RichTextEditor
                          value={juniorsEdit[section]?.content ?? ""}
                          onChange={(html) => setJuniorsEdit((p) => ({ ...p, [section]: { ...p[section], content: html } }))}
                          placeholder={`Content for the ${section} section...`}
                          minHeight="100px"
                        />
                      </div>
                      <Button size="sm" onClick={() => saveJuniors(section)} disabled={savingJuniors}>
                        <CheckCircle className="h-4 w-4" />Save {section}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* ── Match Results ── */}
          {hasRole("club_admin") && (
            <TabsContent value="results">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Match Results</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4" />Add Result</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Match Result</DialogTitle></DialogHeader>
                    <ResultForm onDone={() => {}} />
                  </DialogContent>
                </Dialog>
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
                            <span className="text-xs text-stone-400">{r.matchDate}</span>
                          </div>
                          <p className="font-semibold text-stone-900">{r.isHome ? "vs" : "@"} {r.opposition}</p>
                          {r.ourScore != null && r.theirScore != null && (
                            <p className={`text-sm font-bold ${win ? "text-green-700" : loss ? "text-red-600" : "text-stone-600"}`}>
                              {r.ourScore} – {r.theirScore} {win ? "Win" : loss ? "Loss" : "Draw"}
                            </p>
                          )}
                          {r.notes && <p className="text-xs text-stone-400 italic mt-0.5">{r.notes}</p>}
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteResult.mutate(r.id); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {resultList.length === 0 && <p className="text-stone-400 text-center py-8">No results yet. Add one above.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Sponsors ── */}
          {hasRole("club_admin") && (
            <TabsContent value="sponsors">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Sponsors</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4" />Add Sponsor</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Sponsor</DialogTitle></DialogHeader>
                    <SponsorForm onDone={() => {}} />
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-3">
                {sponsorList.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="pt-4 pb-4 flex items-center gap-4">
                      {s.logoUrl
                        ? <img src={s.logoUrl} alt={s.name} className="h-10 w-20 object-contain rounded" />
                        : <div className="h-10 w-20 bg-stone-100 rounded flex items-center justify-center text-xs text-stone-400">No logo</div>
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
                        <Button size="icon" variant="ghost" onClick={() => {
                          apiRequest("PUT", `/api/sponsors/${s.id}`, { isActive: !s.isActive })
                            .then(() => qc.invalidateQueries({ queryKey: ["/api/sponsors/all"] }));
                        }}>
                          <Eye className="h-4 w-4 text-stone-400" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remove ${s.name}?`)) deleteSponsor.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {sponsorList.length === 0 && (
                  <div className="text-center py-8 text-stone-400">
                    <p>No sponsors yet.</p>
                    <p className="text-xs mt-1">Upload logos via the Media tab, copy the URL, then add sponsors here.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* ── Newsletter ── */}
          {hasRole("club_admin") && (
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
                      {s.name && <span className="text-xs text-stone-400 ml-2">{s.email}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-400">{s.subscribedAt?.split("T")[0]}</span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => unsubscribe.mutate(s.id)}>Remove</Button>
                    </div>
                  </div>
                ))}
                {subscribers.length === 0 && <p className="text-stone-400 text-center py-8">No subscribers yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Page Lists (team divisions, store apparel, juniors FAQ) ── */}
          {hasRole("club_admin") && (
            <TabsContent value="content">
              <div className="space-y-8">
                <ListManager
                  listType="team_division"
                  title="Team Divisions"
                  description="Shown on the About and Fixtures pages. Group is the team (Men's, Women's, Juniors); the link opens the fixtures page for that division."
                  fields={[
                    { key: "group", label: "Team (Men's / Women's / Juniors)", placeholder: "Men's", required: true },
                    { key: "title", label: "Division name", placeholder: "Division 1", required: true },
                    { key: "url", label: "Fixtures link (optional)", placeholder: "https://lacrossewa.com.au/..." },
                  ]}
                />
                <ListManager
                  listType="store_item"
                  title="Store Apparel"
                  description="The apparel cards shown on the Store page."
                  fields={[
                    { key: "title", label: "Item name", placeholder: "Club Hoodie", required: true },
                    { key: "body", label: "Description", textarea: true, placeholder: "Premium fleece hoodie…" },
                    { key: "label", label: "Badge (optional)", placeholder: "Casual Wear" },
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
          {hasRole("content_manager") && (
            <TabsContent value="media">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Media Library</h2>
                <span className="text-sm text-stone-500">{mediaItems.length} files uploaded</span>
              </div>
              <div className="mb-4 p-4 bg-stone-50 border rounded-xl">
                <p className="text-sm font-medium text-stone-700 mb-2">Upload new image</p>
                <ImageUploader
                  onChange={async (url) => {
                    if (url) qc.invalidateQueries({ queryKey: ["/api/media"] });
                  }}
                  hint="Drag & drop or click to upload. Images appear in the grid below and can be inserted into posts."
                />
              </div>
              {mediaItems.length === 0 ? (
                <p className="text-stone-400 text-center py-8">No images uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {mediaItems.map((m) => (
                    <div key={m.id} className="rounded-lg overflow-hidden border bg-white">
                      <div className="group relative aspect-video bg-stone-50">
                        <img src={m.url} alt={m.originalName} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (confirm("Delete this image? It will disappear from the gallery and any posts using it.")) {
                                apiRequest("DELETE", `/api/media/${m.id}`)
                                  .then(() => qc.invalidateQueries({ queryKey: ["/api/media"] }))
                                  .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        </div>
                      </div>
                      {/* Caption — shown under the photo in the public gallery */}
                      <div className="p-2">
                        <Input
                          placeholder="Add a caption…"
                          defaultValue={m.caption ?? ""}
                          className="h-8 text-xs"
                          onBlur={(e) => {
                            if (e.target.value !== (m.caption ?? "")) {
                              apiRequest("PUT", `/api/media/${m.id}/caption`, { caption: e.target.value })
                                .then(() => { qc.invalidateQueries({ queryKey: ["/api/media"] }); toast({ title: "Caption saved" }); })
                                .catch((err) => toast({ title: "Error", description: err.message, variant: "destructive" }));
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* ── Contact Messages ── */}
          {hasRole("club_admin") && (
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
                            <span className="text-xs text-stone-400">{formatDate(m.createdAt)}</span>
                          </div>
                          <p className="text-xs text-stone-400 flex items-center gap-1 mb-1">
                            <Mail className="h-3 w-3" />{m.email}
                          </p>
                          <p className="text-sm font-medium text-stone-700 mb-1">{m.subject}</p>
                          <p className="text-sm text-stone-500">{m.message}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!m.isRead && (
                            <Button size="icon" variant="ghost" title="Mark as read"
                              onClick={() => markContactRead.mutate(m.id)}>
                              <Eye className="h-4 w-4 text-stone-400" />
                            </Button>
                          )}
                          <a href={`mailto:${m.email}?subject=Re: ${m.subject}`}>
                            <Button size="icon" variant="ghost" title="Reply by email">
                              <Mail className="h-4 w-4 text-maroon-600" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {contactMsgs.length === 0 && <p className="text-stone-400 text-center py-8">No contact messages yet.</p>}
              </div>
            </TabsContent>
          )}

          {/* ── Users ── */}
          {hasRole("super_admin") && (
            <TabsContent value="users">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Admin Users</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4" />Add Admin</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Create Admin User</DialogTitle></DialogHeader>
                    <UserForm onDone={() => {}} />
                  </DialogContent>
                </Dialog>
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
                        <p className="text-xs text-stone-400">@{u.username} · {u.email}</p>
                      </div>
                      {u.id !== (user as any)?.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm(`Remove ${u.name}?`)) deleteUser.mutate(u.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* ── Settings ── */}
          {hasRole("super_admin") && (
            <TabsContent value="settings">
              <h2 className="text-lg font-semibold mb-4">Site Settings</h2>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {/* Image settings — click to pick from the media library (no URL pasting) */}
                  <ImagePicker
                    label="Club Logo"
                    value={settingsForm.club_logo_url || undefined}
                    onChange={(url) => setSettingsForm((p) => ({ ...p, club_logo_url: url ?? "" }))}
                    hint="Replaces the 'L' placeholder in the navigation and home hero. Leave blank to use the default."
                  />
                  <ImagePicker
                    label="Hero Background Image"
                    value={settingsForm.hero_image_url || undefined}
                    onChange={(url) => setSettingsForm((p) => ({ ...p, hero_image_url: url ?? "" }))}
                    hint="Appears as the home page hero background with a maroon overlay."
                  />

                  {/* Text settings */}
                  {[
                    { key: "google_calendar_embed_url", label: "Google Calendar Embed URL", help: "In Google Calendar → Settings → your calendar → 'Integrate calendar' → copy the Embed URL (starts with https://calendar.google.com/calendar/embed?...)." },
                    { key: "behold_feed_id", label: "Behold.so Feed ID (Instagram)", help: "Create a free feed at behold.so, connect @subiacolacrosse_official, then paste the Feed ID here." },
                    { key: "store_url", label: "Online Store URL", help: "Link to your online merch store (e.g. Shopify, Redbubble, PrintFul). Leave blank to show the 'coming soon' message." },
                    { key: "instagram_handle", label: "Instagram Handle" },
                    { key: "facebook_url", label: "Facebook URL" },
                    { key: "contact_email", label: "Contact Email" },
                    { key: "location", label: "Club Location" },
                    { key: "gameday_registration_url", label: "GameDay Registration URL", help: "The GameDay form players use to register/pay." },
                    { key: "gameday_url", label: "GameDay Fixtures & Results URL", help: "The club's GameDay page — powers the main Fixtures & Results links across the site." },
                    { key: "lacrossewa_fixtures_url", label: "Lacrosse WA Fixtures URL", help: "League-wide fixtures page on the Lacrosse WA website." },
                  ].map(({ key, label, help }) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        value={settingsForm[key] ?? ""}
                        onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))}
                      />
                      {help && <p className="text-xs text-stone-400">{help}</p>}
                    </div>
                  ))}
                  <Button onClick={() => saveSettings.mutate(settingsForm)} disabled={saveSettings.isPending}>
                    {saveSettings.isPending ? "Saving..." : "Save Settings"}
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
                    Toggle pages on or off. When off, the page is hidden from the navigation and shows a 404 to visitors.
                    Changes take effect instantly — no rebuild needed.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: "nav_show_gallery",    label: "Photo Gallery",    desc: "The /gallery page showing uploaded photos" },
                    { key: "nav_show_fixtures",   label: "Fixtures",         desc: "The /fixtures page linking to LacrosseWA & GameDay" },
                    { key: "nav_show_store",      label: "Club Store",       desc: "The /store merchandise page" },
                    { key: "nav_show_results",    label: "Recent Results",   desc: "Match results section on the home page" },
                    { key: "nav_show_sponsors",   label: "Sponsor Strip",    desc: "Sponsor logos shown at the bottom of the home page" },
                    { key: "nav_show_newsletter", label: "Newsletter Widget",desc: "Email subscribe form on the home page" },
                    { key: "nav_show_juniors",    label: "Juniors Page",     desc: "The /juniors page in the navigation" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-stone-800 text-sm">{label}</p>
                        <p className="text-xs text-stone-400">{desc}</p>
                      </div>
                      <Switch
                        checked={settingsForm[key] !== "false"}
                        onCheckedChange={(checked) => {
                          const updated = { ...settingsForm, [key]: checked ? "true" : "false" };
                          setSettingsForm(updated);
                          saveSettings.mutate(updated);
                        }}
                      />
                    </div>
                  ))}
                <div className="pt-2 text-xs text-stone-400">Tip: You can always re-enable a page here if you want to add it back later.</div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
