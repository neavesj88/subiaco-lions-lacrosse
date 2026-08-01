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
import { useSiteText } from "@/hooks/use-site-text";

// Accent colour per team group. Keys are matched case-insensitively against the
// "group" stored in list_items, so a club that renames its teams still gets a
// sensible colour, and anything unrecognised falls back to the club's primary.
const teamColors: Record<string, string> = {
  men: "bg-blue-600",
  women: "bg-purple-600",
  junior: "bg-green-600",
};

function teamColor(category: string): string {
  const key = category.toLowerCase();
  const match = Object.keys(teamColors).find((k) => key.includes(k));
  return match ? teamColors[match] : "bg-maroon-600";
}

export default function Fixtures() {
  const t = useSiteText(); // club-configurable wording
  const { get } = usePageContent("fixtures");
  const { items: divisions } = useListItems("team_division");

  // GameDay is the third-party host for fixtures & results — editable in Settings
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
  });
  // Both are blank until a club fills them in (Admin → Settings), and each
  // link card below is hidden while its URL is empty so there are never any
  // dead links on a newly set-up site.
  const gamedayUrl = settings?.gameday_url || t("gameday_url");
  const lacrosseWaUrl = settings?.lacrossewa_fixtures_url || t("lacrossewa_fixtures_url");

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
          <EditableSection page="fixtures" section="hero_title" value={get("hero_title", t("page_fixtures_title"))} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="fixtures" section="hero_subtitle" value={get("hero_subtitle", t("page_fixtures_subtitle"))} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>
        </div>
      </section>

      {/* Primary links */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className={`grid gap-4 mb-12 ${gamedayUrl && lacrosseWaUrl ? "sm:grid-cols-2" : ""}`}>
            {gamedayUrl && <a href={gamedayUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="border-2 border-maroon-200 hover:border-maroon-500 hover:shadow-lg transition-all h-full group">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="w-14 h-14 bg-maroon-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-maroon-800 transition-colors">
                    <Trophy className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">Fixtures & Results on {t("fixtures_provider_name")}</h3>
                  <p className="text-stone-500 text-sm mb-4">Live game schedules, scores and ladders for all our teams</p>
                  <Button variant="default" size="sm" className="gap-1.5">
                    View on {t("fixtures_provider_name")} <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </a>}

            {lacrosseWaUrl && <a href={lacrosseWaUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="border-2 border-gold-200 hover:border-gold-500 hover:shadow-lg transition-all h-full group">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gold-600 transition-colors">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">{t("league_name")}</h3>
                  <p className="text-stone-500 text-sm mb-4">League-wide fixtures, results and competition info</p>
                  <Button variant="gold" size="sm" className="gap-1.5">
                    View {t("league_name")} <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </a>}
          </div>

          {/* Teams breakdown */}
          <h2 className="section-title">Our Teams</h2>
          <div className="gold-bar" />
          <p className="section-subtitle">Click your team to view its fixtures and results on {t("fixtures_provider_name")}.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {teamGroups.map((team) => (
              <Card key={team.category} className="overflow-hidden">
                <div className={`${teamColor(team.category)} h-2`} />
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
