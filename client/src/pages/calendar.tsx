import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { CalendarDays, MapPin, Clock, ExternalLink } from "lucide-react";
import type { Event } from "@shared/schema";

type Category = "all" | "mens" | "womens" | "juniors";
type EventType = "all" | "game" | "training" | "social" | "meeting" | "other";

const categoryLabels: Record<string, string> = {
  all: "All Teams",
  mens: "Men's",
  womens: "Women's",
  juniors: "Juniors",
};

const typeLabels: Record<string, string> = {
  all: "All Types",
  game: "Games",
  training: "Training",
  social: "Social",
  meeting: "Meetings",
  other: "Other",
};

function GoogleCalendarEmbed({ embedUrl }: { embedUrl: string }) {
  return (
    <div className="rounded-xl overflow-hidden border shadow-sm bg-white">
      <iframe
        src={embedUrl}
        style={{ border: 0 }}
        width="100%"
        height="600"
        frameBorder="0"
        scrolling="no"
        title="Subiaco Lions Club Calendar"
        className="w-full"
      />
      <div className="px-4 py-3 bg-stone-50 border-t flex items-center justify-between">
        <p className="text-xs text-stone-400">Powered by Google Calendar</p>
        <a
          href={embedUrl.replace("/embed?", "/r/week?")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-maroon-600 hover:text-maroon-800 font-medium flex items-center gap-1"
        >
          Open in Google Calendar <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default function Calendar() {
  const [categoryFilter, setCategoryFilter] = useState<Category>("all");
  const [typeFilter, setTypeFilter] = useState<EventType>("all");
  const [view, setView] = useState<"list" | "google">("list");

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: () => apiRequest("GET", "/api/events"),
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
  });

  const googleCalendarUrl = settings?.google_calendar_embed_url;

  const filtered = events.filter((e) => {
    const catMatch = categoryFilter === "all" || e.teamCategory === categoryFilter || e.teamCategory === "all";
    const typeMatch = typeFilter === "all" || e.eventType === typeFilter;
    return catMatch && typeMatch;
  });

  const grouped = filtered.reduce<Record<string, Event[]>>((acc, e) => {
    const month = new Date(e.startDate).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    acc[month] = [...(acc[month] ?? []), e];
    return acc;
  }, {});

  return (
    <>
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <CalendarDays className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <h1 className="text-4xl font-extrabold mb-4">Club Calendar</h1>
          <p className="text-maroon-100 text-lg">Games, training and social events for all teams.</p>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* View toggle (only show if Google Calendar is configured) */}
          {googleCalendarUrl && (
            <div className="flex gap-2 mb-6">
              <Button
                size="sm"
                variant={view === "list" ? "default" : "outline"}
                onClick={() => setView("list")}
              >
                List View
              </Button>
              <Button
                size="sm"
                variant={view === "google" ? "default" : "outline"}
                onClick={() => setView("google")}
              >
                <CalendarDays className="h-4 w-4" />
                Google Calendar
              </Button>
            </div>
          )}

          {/* Google Calendar embed */}
          {view === "google" && googleCalendarUrl && (
            <GoogleCalendarEmbed embedUrl={googleCalendarUrl} />
          )}

          {/* List view */}
          {view === "list" && (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-8">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(categoryLabels) as Category[]).map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant={categoryFilter === c ? "default" : "outline"}
                      onClick={() => setCategoryFilter(c)}
                    >
                      {categoryLabels[c]}
                    </Button>
                  ))}
                </div>
                <div className="w-px bg-stone-200 hidden sm:block" />
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(typeLabels) as EventType[]).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={typeFilter === t ? "gold" : "outline"}
                      onClick={() => setTypeFilter(t)}
                    >
                      {typeLabels[t]}
                    </Button>
                  ))}
                </div>
              </div>

              {isLoading && <div className="text-center py-16 text-stone-400">Loading events...</div>}

              {!isLoading && filtered.length === 0 && (
                <div className="text-center py-16">
                  <CalendarDays className="h-12 w-12 text-stone-200 mx-auto mb-3" />
                  <p className="text-stone-400">No upcoming events found.</p>
                  {googleCalendarUrl && (
                    <p className="text-stone-400 text-sm mt-2">
                      Try{" "}
                      <button onClick={() => setView("google")} className="text-maroon-600 hover:underline">
                        Google Calendar view
                      </button>{" "}
                      for the full schedule.
                    </p>
                  )}
                </div>
              )}

              {Object.entries(grouped).map(([month, monthEvents]) => (
                <div key={month} className="mb-10">
                  <h2 className="text-lg font-bold text-maroon-700 mb-4 flex items-center gap-2">
                    <span className="h-px flex-1 bg-maroon-100" />
                    {month}
                    <span className="h-px flex-1 bg-maroon-100" />
                  </h2>
                  <div className="space-y-3">
                    {monthEvents.map((e) => (
                      <Card key={e.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start gap-4">
                            <div className="bg-maroon-700 text-white rounded-lg px-3 py-2 text-center min-w-[60px] shrink-0">
                              <div className="text-xs uppercase tracking-wide font-medium">
                                {new Date(e.startDate).toLocaleDateString("en-AU", { weekday: "short" })}
                              </div>
                              <div className="text-2xl font-bold leading-none">
                                {new Date(e.startDate).getDate()}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant={e.eventType as any} className="text-xs capitalize">
                                  {e.eventType}
                                </Badge>
                                {e.teamCategory !== "all" && (
                                  <Badge variant="secondary" className="text-xs capitalize">
                                    {categoryLabels[e.teamCategory] ?? e.teamCategory}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-semibold text-stone-900">{e.title}</h3>
                              {e.description && (
                                <p className="text-sm text-stone-500 mt-0.5">{e.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-2 text-xs text-stone-400">
                                {e.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {e.location}
                                  </span>
                                )}
                                {e.endDate && e.endDate !== e.startDate && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Until {formatDate(e.endDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
