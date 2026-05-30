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
  Pin, ImageIcon
} from "lucide-react";
import type { Event, Announcement, Registration, JuniorsContent, ContactMessage, MediaUpload } from "@shared/schema";

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
      <ImageUploader
        label="Featured Image (optional)"
        value={featuredImageUrl}
        onChange={setFeaturedImageUrl}
        hint="Shows as the post thumbnail on the homepage. Recommended: 1200×630px."
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
    if (!isLoading && !user) navigate("/admin/login");
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
                    <div key={m.id} className="group relative rounded-lg overflow-hidden border bg-stone-50 aspect-video">
                      <img src={m.url} alt={m.originalName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        <p className="text-white text-xs text-center line-clamp-2">{m.originalName}</p>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs bg-white"
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.origin + m.url);
                              toast({ title: "URL copied to clipboard" });
                            }}
                          >
                            Copy URL
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (confirm("Delete this image?")) {
                                apiRequest("DELETE", `/api/media/${m.id}`)
                                  .then(() => qc.invalidateQueries({ queryKey: ["/api/media"] }))
                                  .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
                  {[
                    { key: "hero_image_url", label: "Hero Background Image URL", help: "Paste a URL from the Media Library (upload there first, then Copy URL). Appears as the home page hero background." },
                  { key: "google_calendar_embed_url", label: "Google Calendar Embed URL", help: "In Google Calendar → Settings → your calendar → 'Integrate calendar' → copy the Embed URL (starts with https://calendar.google.com/calendar/embed?...)." },
                    { key: "behold_feed_id", label: "Behold.so Feed ID (Instagram)", help: "Create a free feed at behold.so, connect @subiacolacrosse_official, then paste the Feed ID here." },
                    { key: "store_url", label: "Online Store URL", help: "Link to your online merch store (e.g. Shopify, Redbubble, PrintFul). Leave blank to show the 'coming soon' message." },
                    { key: "instagram_handle", label: "Instagram Handle" },
                    { key: "facebook_url", label: "Facebook URL" },
                    { key: "contact_email", label: "Contact Email" },
                    { key: "location", label: "Club Location" },
                    { key: "gameday_registration_url", label: "GameDay Registration URL" },
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
                  <Button
                    onClick={() => saveSettings.mutate(settingsForm)}
                    disabled={saveSettings.isPending}
                  >
                    {saveSettings.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
