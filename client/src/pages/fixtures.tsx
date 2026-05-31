import { ExternalLink, Trophy, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePageContent } from "@/hooks/use-page-content";
import { useListItems } from "@/hooks/use-list-items";
import EditableSection from "@/components/editable-section";

// Fallback URLs if the settings haven't been configured yet
const DEFAULT_GAMEDAY = "https://websites.mygameday.app/club_info.cgi?clubID=139526&c=0-4051-0-0-0";
const DEFAULT_LACROSSEWA = "https://lacrossewa.com.au/fixtures-results/club-fixtures/";

// Colour per team group (key matches the "group" stored in list_items)
const teamColors: Record<string, string> = {
  "Men's": "bg-blue-600",
  "Women's": "bg-purple-600",
  "Juniors": "bg-green-600",
};

export default function Fixtures() {
  const { get } = usePageContent("fixtures");
  const { items: divisions } = useListItems("team_division");

  // GameDay is the third-party host for fixtures & results — editable in Settings
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
  });
  const gamedayUrl = settings?.gameday_url || DEFAULT_GAMEDAY;
  const lacrosseWaUrl = settings?.lacrossewa_fixtures_url || DEFAULT_LACROSSEWA;

  // Group division rows by their team (group field), preserving order.
  // Each division links to GameDay by default (or its own custom link if set).
  const teamGroups: { category: string; divisions: { name: string; url: string }[] }[] = [];
  for (const d of divisions) {
    const cat = d.group ?? "Teams";
    let grp = teamGroups.find((g) => g.category === cat);
    if (!grp) { grp = { category: cat, divisions: [] }; teamGroups.push(grp); }
    grp.divisions.push({ name: d.title, url: d.url || gamedayUrl });
  }

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Trophy className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <EditableSection page="fixtures" section="hero_title" value={get("hero_title", "Fixtures & Results")} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="fixtures" section="hero_subtitle" value={get("hero_subtitle", "Game schedules and results for all Subiaco Lions teams, hosted on GameDay.")} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>
        </div>
      </section>

      {/* Primary links */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            <a href={gamedayUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="border-2 border-maroon-200 hover:border-maroon-500 hover:shadow-lg transition-all h-full group">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="w-14 h-14 bg-maroon-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-maroon-800 transition-colors">
                    <Trophy className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">Fixtures & Results on GameDay</h3>
                  <p className="text-stone-500 text-sm mb-4">Live game schedules, scores and ladders for all Subiaco Lions teams</p>
                  <Button variant="default" size="sm" className="gap-1.5">
                    View on GameDay <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </a>

            <a href={lacrosseWaUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="border-2 border-gold-200 hover:border-gold-500 hover:shadow-lg transition-all h-full group">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gold-600 transition-colors">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">Lacrosse WA</h3>
                  <p className="text-stone-500 text-sm mb-4">League-wide fixtures, results and competition info</p>
                  <Button variant="gold" size="sm" className="gap-1.5">
                    View Lacrosse WA <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </a>
          </div>

          {/* Teams breakdown */}
          <h2 className="section-title">Our Teams</h2>
          <div className="gold-bar" />
          <p className="section-subtitle">Click your team to view its fixtures and results on GameDay.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {teamGroups.map((team) => (
              <Card key={team.category} className="overflow-hidden">
                <div className={`${teamColors[team.category] ?? "bg-maroon-600"} h-2`} />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-maroon-700" />
                    {team.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {team.divisions.map((div) => (
                    <a
                      key={div.name}
                      href={div.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-50 hover:bg-maroon-50 hover:text-maroon-700 transition-colors group"
                    >
                      <span className="text-sm font-medium">{div.name}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-stone-400 group-hover:text-maroon-500" />
                    </a>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Training reminder */}
      <section className="py-10 px-4 bg-stone-50 border-t">
        <div className="max-w-3xl mx-auto text-center">
          <Calendar className="h-8 w-8 text-gold-500 mx-auto mb-3" />
          <EditableSection page="fixtures" section="training_title" value={get("training_title", "Training Schedule")} label="Training heading">
            {(c) => <h2 className="text-xl font-bold text-stone-900 mb-2">{c}</h2>}
          </EditableSection>
          <EditableSection page="fixtures" section="training_text" value={get("training_text", "Training times and non-fixture club events are managed in our club calendar.")} label="Training text">
            {(c) => <p className="text-stone-500 mb-4">{c}</p>}
          </EditableSection>
          <Link href="/calendar">
            <Button variant="outline">View Club Calendar</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
