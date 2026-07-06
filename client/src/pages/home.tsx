import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import InstagramFeed from "@/components/instagram-feed";
import { RichTextDisplay } from "@/components/rich-text-display";
import { usePageContent } from "@/hooks/use-page-content";
import EditableSection from "@/components/editable-section";
import { formatDate, formatDateShort } from "@/lib/utils";
import { CalendarDays, UserPlus, MapPin, Megaphone, Trophy, Mail } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import type { Announcement, Event, Sponsor, MatchResult } from "@shared/schema";

// Result colour coding — green=win, red=loss, grey=draw
function ResultBadge({ our, their }: { our?: number | null; their?: number | null }) {
  if (our == null || their == null) return <span className="text-xs text-stone-400">TBD</span>;
  const isWin = our > their;
  const isDraw = our === their;
  return (
    <div className={`text-center px-3 py-1 rounded-lg font-bold text-sm ${isWin ? "bg-green-100 text-green-800" : isDraw ? "bg-stone-100 text-stone-600" : "bg-red-100 text-red-700"}`}>
      {our} – {their}
      <div className="text-xs font-normal">{isWin ? "Win" : isDraw ? "Draw" : "Loss"}</div>
    </div>
  );
}

// Tier label + size for sponsor strip
const tierSize: Record<string, string> = {
  gold: "h-16 px-6",
  silver: "h-12 px-4",
  bronze: "h-10 px-3",
  partner: "h-10 px-3",
};

export default function Home() {
  const [subEmail, setSubEmail] = useState("");
  const [subName, setSubName] = useState("");
  const [subDone, setSubDone] = useState(false);
  const { settings, pageEnabled } = useSettings();
  const { get } = usePageContent("home");

  // Default hero text — editable by admins, saved to DB once changed
  const HERO_TITLE = "Subiaco Lions";
  const HERO_TAGLINE = "Perth's home of lacrosse since 1940. Men's, Women's and Junior teams competing across all divisions at Rosalie Park, Shenton Park.";

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    queryFn: () => apiRequest("GET", "/api/announcements"),
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: () => apiRequest("GET", "/api/events"),
  });

  const { data: sponsorList = [] } = useQuery<Sponsor[]>({
    queryKey: ["/api/sponsors"],
    queryFn: () => apiRequest("GET", "/api/sponsors"),
    enabled: pageEnabled("sponsors"),
  });

  const { data: results = [] } = useQuery<MatchResult[]>({
    queryKey: ["/api/results"],
    queryFn: () => apiRequest("GET", "/api/results"),
    enabled: pageEnabled("results"),
  });

  const subscribeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/newsletter/subscribe", { email: subEmail, name: subName }),
    onSuccess: () => setSubDone(true),
    onError: () => toast({ title: "Couldn't subscribe. Try again.", variant: "destructive" }),
  });

  const upcomingEvents = events.slice(0, 3);
  const latestAnnouncements = announcements.slice(0, 3);
  const recentResults = results.slice(0, 4);

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section
        className="hero-gradient text-white py-24 px-4 relative overflow-hidden"
        style={settings?.hero_image_url
          ? { backgroundImage: `linear-gradient(rgba(123,30,50,0.82),rgba(58,12,23,0.88)), url(${settings.hero_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
        }
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-gold-400" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gold-300" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          {settings?.club_logo_url ? (
            <img src={settings.club_logo_url} alt="Club logo" className="h-20 w-20 object-contain mx-auto mb-6 drop-shadow-xl" />
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-500 text-maroon-900 font-black text-4xl shadow-xl mb-6">L</div>
          )}
          <EditableSection page="home" section="hero_title" value={get("hero_title", HERO_TITLE)} label="Hero club name">
            {(c) => (
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
                {c}<br />
                <span className="text-gold-400">Lacrosse Club</span>
              </h1>
            )}
          </EditableSection>
          <EditableSection page="home" section="hero_tagline" value={get("hero_tagline", HERO_TAGLINE)} label="Hero tagline">
            {(c) => <p className="text-lg sm:text-xl text-maroon-100 mb-8 max-w-2xl mx-auto">{c}</p>}
          </EditableSection>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" variant="gold" className="shadow-lg">
                <UserPlus className="h-5 w-5" /> Join the Lions
              </Button>
            </Link>
            <Link href="/calendar">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <CalendarDays className="h-5 w-5" /> View Calendar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Info strip ──────────────────────────────────────────────── */}
      <section className="bg-gold-500 text-white py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-medium">
          <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Rosalie Park, Shenton Park WA</span>
          <span>Men's · Women's · Juniors U11–U17</span>
          <span>All skill levels welcome · Loan equipment available</span>
        </div>
      </section>

      {/* ── News announcements ───────────────────────────────────────── */}
      {latestAnnouncements.length > 0 && (
        <section className="py-16 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone className="h-5 w-5 text-gold-500" />
                  <h2 className="section-title mb-0">Club News</h2>
                </div>
                <div className="gold-bar" />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {latestAnnouncements.map((a) => (
                <Card key={a.id} className={a.isPinned ? "border-2 border-gold-400 shadow-md" : "border-l-4 border-l-maroon-700"}>
                  {a.featuredImageUrl && (
                    <div className="overflow-hidden rounded-t-xl">
                      <img src={a.featuredImageUrl} alt={a.title} className="w-full h-40 object-cover" />
                    </div>
                  )}
                  <CardHeader className={a.featuredImageUrl ? "pt-4" : undefined}>
                    {a.isPinned && <span className="text-xs font-semibold text-gold-600 flex items-center gap-1 mb-1">📌 Pinned</span>}
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <p className="text-xs text-stone-400">{formatDate(a.createdAt)}</p>
                  </CardHeader>
                  <CardContent>
                    <RichTextDisplay html={a.content} className="text-sm text-stone-600 line-clamp-4 [&_*]:text-sm" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Upcoming events ──────────────────────────────────────────── */}
      {upcomingEvents.length > 0 && (
        <section className="py-16 px-4 bg-stone-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="section-title">Upcoming Events</h2>
                <div className="gold-bar" />
              </div>
              <Link href="/calendar" className="text-sm text-maroon-600 hover:text-maroon-800 font-medium">View all →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {upcomingEvents.map((e) => (
                <Card key={e.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="bg-maroon-700 text-white rounded-lg px-3 py-2 text-center min-w-[56px] shrink-0">
                        <div className="text-xs uppercase tracking-wide">{new Date(e.startDate).toLocaleDateString("en-AU", { month: "short" })}</div>
                        <div className="text-2xl font-bold leading-none">{new Date(e.startDate).getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Badge variant={e.eventType as any} className="mb-1.5 text-xs capitalize">{e.eventType}</Badge>
                        <h3 className="font-semibold text-stone-900 text-sm leading-snug">{e.title}</h3>
                        {e.location && <p className="text-xs text-stone-400 mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Recent Results ───────────────────────────────────────────── */}
      {pageEnabled("results") && recentResults.length > 0 && (
        <section className="py-16 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-gold-500" />
                  <h2 className="section-title mb-0">Recent Results</h2>
                </div>
                <div className="gold-bar" />
              </div>
              <a
                href={settings?.gameday_url || "https://websites.mygameday.app/club_info.cgi?clubID=139526&c=0-4051-0-0-0"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-maroon-600 hover:text-maroon-800 font-medium"
              >
                All fixtures on GameDay →
              </a>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentResults.map((r) => (
                <Card key={r.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Badge variant="secondary" className="text-xs mb-1 capitalize">{r.teamCategory}</Badge>
                        <p className="font-semibold text-sm text-stone-900 truncate">
                          {r.isHome ? "vs" : "@"} {r.opposition}
                        </p>
                        <p className="text-xs text-stone-400">{formatDateShort(r.matchDate)}</p>
                        {r.division && <p className="text-xs text-stone-400">{r.division}</p>}
                      </div>
                      <ResultBadge our={r.ourScore} their={r.theirScore} />
                    </div>
                    {r.notes && <p className="text-xs text-stone-400 mt-2 italic">{r.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Instagram ────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-stone-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="section-title text-center">Follow Us on Instagram</h2>
          <p className="section-subtitle text-center">Stay up to date with club news, game highlights and behind-the-scenes moments</p>
          <InstagramFeed feedId={settings?.behold_feed_id || ""} handle={settings?.instagram_handle || "subiacolacrosse_official"} />
        </div>
      </section>

      {/* ── Sponsors ─────────────────────────────────────────────────── */}
      {pageEnabled("sponsors") && sponsorList.length > 0 && (
        <section className="py-12 px-4 bg-white border-t">
          <div className="max-w-7xl mx-auto">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-stone-400 mb-8">Our Sponsors</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {sponsorList.map((s) => (
                <a
                  key={s.id}
                  href={s.websiteUrl ?? undefined}
                  target={s.websiteUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-70 hover:opacity-100 ${tierSize[s.tier] ?? "h-10 px-3"}`}
                  title={s.name}
                >
                  {s.logoUrl
                    ? <img src={s.logoUrl} alt={s.name} className="h-full w-auto object-contain max-w-[160px]" />
                    : <span className="text-stone-600 font-semibold text-sm">{s.name}</span>
                  }
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Newsletter subscribe ──────────────────────────────────────── */}
      {pageEnabled("newsletter") && (
        <section className="py-16 px-4 bg-maroon-50">
          <div className="max-w-xl mx-auto text-center">
            <Mail className="h-10 w-10 text-maroon-700 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-maroon-800 mb-2">Stay in the Loop</h2>
            <p className="text-stone-500 mb-6">Get club updates, event reminders and news straight to your inbox.</p>
            {subDone ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <p className="text-green-700 font-semibold">✓ You're subscribed! Welcome to the Lions community.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); if (subEmail) subscribeMutation.mutate(); }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                />
                <input
                  type="email"
                  placeholder="Your email address"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  required
                  className="flex-1 h-10 px-3 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                />
                <Button type="submit" disabled={subscribeMutation.isPending} className="shrink-0">
                  {subscribeMutation.isPending ? "..." : "Subscribe"}
                </Button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 hero-gradient text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Join the Lions?</h2>
          <p className="text-maroon-100 mb-8 text-lg">No experience needed. All ages welcome. Loan equipment available for new players.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/sign-up"><Button size="lg" variant="gold">Join Now</Button></Link>
            {pageEnabled("juniors") && (
              <Link href="/juniors"><Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">Junior Programs</Button></Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
