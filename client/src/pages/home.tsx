import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import InstagramFeed from "@/components/instagram-feed";
import { formatDate } from "@/lib/utils";
import { CalendarDays, UserPlus, MapPin, Megaphone } from "lucide-react";
import { RichTextDisplay } from "@/components/rich-text-editor";
import type { Announcement, Event, SiteSetting } from "@shared/schema";

const categoryBadge: Record<string, "game" | "training" | "social" | "meeting" | "other"> = {
  game: "game",
  training: "training",
  social: "social",
  meeting: "meeting",
  other: "other",
};

export default function Home() {
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    queryFn: () => apiRequest("GET", "/api/announcements"),
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: () => apiRequest("GET", "/api/events"),
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
  });

  const upcomingEvents = events.slice(0, 3);
  const latestAnnouncements = announcements.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-gold-400" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gold-300" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-500 text-maroon-900 font-black text-4xl shadow-xl mb-6">
            L
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
            Subiaco Lions<br />
            <span className="text-gold-400">Lacrosse Club</span>
          </h1>
          <p className="text-lg sm:text-xl text-maroon-100 mb-8 max-w-2xl mx-auto">
            Perth's home of lacrosse since 1940. Men's, Women's and Junior teams competing across all divisions at Rosalie Park, Shenton Park.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" variant="gold" className="shadow-lg">
                <UserPlus className="h-5 w-5" />
                Join the Lions
              </Button>
            </Link>
            <Link href="/calendar">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <CalendarDays className="h-5 w-5" />
                View Calendar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick info strip */}
      <section className="bg-gold-500 text-white py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> Rosalie Park, Shenton Park WA
          </span>
          <span>Men's · Women's · Juniors U11–U17</span>
          <span>All skill levels welcome · Loan equipment available</span>
        </div>
      </section>

      {/* Announcements */}
      {latestAnnouncements.length > 0 && (
        <section className="py-16 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="h-5 w-5 text-gold-500" />
                <h2 className="section-title mb-0">Club News</h2>
              </div>
              <div className="gold-bar" />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {latestAnnouncements.map((a) => (
                <Card key={a.id} className="border-l-4 border-l-maroon-700">
                  <CardHeader>
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

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <section className="py-16 px-4 bg-stone-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="section-title">Upcoming Events</h2>
                <div className="gold-bar" />
              </div>
              <Link href="/calendar" className="text-sm text-maroon-600 hover:text-maroon-800 font-medium">
                View all →
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {upcomingEvents.map((e) => (
                <Card key={e.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="bg-maroon-700 text-white rounded-lg px-3 py-2 text-center min-w-[56px] shrink-0">
                        <div className="text-xs uppercase tracking-wide">
                          {new Date(e.startDate).toLocaleDateString("en-AU", { month: "short" })}
                        </div>
                        <div className="text-2xl font-bold leading-none">
                          {new Date(e.startDate).getDate()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Badge variant={categoryBadge[e.eventType] ?? "other"} className="mb-1.5 text-xs capitalize">
                          {e.eventType}
                        </Badge>
                        <h3 className="font-semibold text-stone-900 text-sm leading-snug">{e.title}</h3>
                        {e.location && (
                          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {e.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Instagram */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="section-title text-center">Follow Us on Instagram</h2>
          <p className="section-subtitle text-center">
            Stay up to date with club news, game highlights and behind-the-scenes moments
          </p>
          <InstagramFeed
            feedId={settings?.behold_feed_id || ""}
            handle={settings?.instagram_handle || "subiacolacrosse_official"}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 hero-gradient text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Join the Lions?</h2>
          <p className="text-maroon-100 mb-8 text-lg">
            No experience needed. All ages welcome. Loan equipment available for new players.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" variant="gold">Join Now</Button>
            </Link>
            <Link href="/juniors">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Junior Programs
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
