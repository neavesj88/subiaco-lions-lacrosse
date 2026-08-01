import { Users, Trophy, MapPin, Mail, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePageContent } from "@/hooks/use-page-content";
import EditableSection from "@/components/editable-section";
import { useSiteText } from "@/hooks/use-site-text";
import { RichTextDisplay } from "@/components/rich-text-display";
import { useListItems } from "@/hooks/use-list-items";
import { useClubDetails, ClubMap } from "@/components/club-details";

// Accent colour for each team group's card. The team/division data itself is
// managed in Admin → Page Lists → Team Divisions (shared with the Fixtures page).
const teamColors: Record<string, string> = {
  "Men's": "bg-blue-600",
  "Women's": "bg-purple-600",
  "Juniors": "bg-green-600",
};

export default function About() {
  const t = useSiteText(); // club-configurable wording
  const { get } = usePageContent("about");
  // Address / email / map from Admin → Settings → Club Details
  const club = useClubDetails();

  // Team divisions come from the database (Admin → Page Lists → Team Divisions).
  // Rows are grouped by their "group" field (Men's / Women's / Juniors),
  // preserving the admin's chosen order — same data the Fixtures page uses.
  const { items: divisions } = useListItems("team_division");
  const teams: { category: string; divisions: string[] }[] = [];
  for (const d of divisions) {
    const cat = d.group ?? "Teams";
    let grp = teams.find((g) => g.category === cat);
    if (!grp) { grp = { category: cat, divisions: [] }; teams.push(grp); }
    grp.divisions.push(d.title);
  }

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <EditableSection page="about" section="hero_title" value={get("hero_title", t("page_about_title"))} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="about" section="hero_subtitle" value={get("hero_subtitle", t("page_about_subtitle"))} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>
        </div>
      </section>

      {/* History */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <EditableSection page="about" section="history_title" value={get("history_title", t("about_history_title"))} label="History heading">
                {(c) => <h2 className="section-title">{c}</h2>}
              </EditableSection>
              <div className="gold-bar" />
              <EditableSection page="about" section="history_body" value={get("history_body", t("about_history_body"))} label="History text" richText>
                {(c) => <RichTextDisplay html={c} className="space-y-4 text-stone-600 leading-relaxed" />}
              </EditableSection>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Trophy, label: t("about_stat1_label"), value: t("about_stat1_value") },
                { icon: Users, label: t("about_stat2_label"), value: t("about_stat2_value") },
                { icon: Shield, label: t("about_stat3_label"), value: t("about_stat3_value") },
                { icon: MapPin, label: t("about_stat4_label"), value: club.venue },
              ].map((s) => (
                <div key={s.label} className="bg-stone-50 rounded-xl p-5 text-center border">
                  <s.icon className="h-8 w-8 text-maroon-700 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-maroon-700">{s.value}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Teams */}
      <section className="py-16 px-4 bg-stone-50">
        <div className="max-w-7xl mx-auto">
          <EditableSection page="about" section="teams_title" value={get("teams_title", t("about_teams_title"))} label="Teams heading">
            {(c) => <h2 className="section-title text-center">{c}</h2>}
          </EditableSection>
          <div className="gold-bar mx-auto" />
          <EditableSection page="about" section="teams_subtitle" value={get("teams_subtitle", t("about_teams_subtitle"))} label="Teams subtitle">
            {(c) => <p className="section-subtitle text-center">{c}</p>}
          </EditableSection>
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {teams.map((t) => (
              <Card key={t.category} className="overflow-hidden">
                <div className={`${teamColors[t.category] ?? "bg-maroon-600"} h-2`} />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-maroon-700" />
                    {t.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {t.divisions.map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Location & Contact */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="section-title">{t("about_find_us_title")}</h2>
              <div className="gold-bar" />
              <div className="space-y-3 text-stone-600">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-maroon-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-stone-900">{club.venue}</p>
                    <p>{club.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-maroon-700 shrink-0" />
                  <a href={`mailto:${club.email}`} className="hover:text-maroon-700">
                    {club.email}
                  </a>
                </div>
              </div>
              <ClubMap height={220} className="mt-6" />
            </div>
            <div>
              <h2 className="section-title">Affiliated With</h2>
              <div className="gold-bar" />
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="font-semibold text-stone-900 mb-1">{t("league_name")}</p>
                    <p className="text-sm text-stone-500 mb-2">Our governing body — fixtures, results and competition rules.</p>
                    <a
                      href={t("league_url")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-maroon-600 hover:underline font-medium"
                    >
                      {t("league_name")} →
                    </a>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="font-semibold text-stone-900 mb-1">Act Belong Commit</p>
                    <p className="text-sm text-stone-500">Our club is a registered Act Belong Commit club, supporting the mental health and wellbeing of all members.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="font-semibold text-stone-900 mb-1">KidSport</p>
                    <p className="text-sm text-stone-500">Registered KidSport provider — WA Government financial assistance available for eligible junior members.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
