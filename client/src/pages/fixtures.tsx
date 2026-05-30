import { ExternalLink, Trophy, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

const LACROSSEWA_FIXTURES = "https://lacrossewa.com.au/fixtures-results/club-fixtures/";
const GAMEDAY_CLUB = "https://websites.mygameday.app/club_info.cgi?clubID=139526&c=0-4051-0-0-0";

const teams = [
  {
    category: "Men's",
    color: "bg-blue-600",
    divisions: [
      { name: "State League", url: LACROSSEWA_FIXTURES },
      { name: "Division 1", url: LACROSSEWA_FIXTURES },
      { name: "Division 2", url: LACROSSEWA_FIXTURES },
      { name: "Division 3", url: LACROSSEWA_FIXTURES },
    ],
  },
  {
    category: "Women's",
    color: "bg-purple-600",
    divisions: [
      { name: "State League", url: LACROSSEWA_FIXTURES },
      { name: "Division 1", url: LACROSSEWA_FIXTURES },
      { name: "Division 2", url: LACROSSEWA_FIXTURES },
    ],
  },
  {
    category: "Juniors",
    color: "bg-green-600",
    divisions: [
      { name: "Under 11", url: LACROSSEWA_FIXTURES },
      { name: "Under 13", url: LACROSSEWA_FIXTURES },
      { name: "Under 15", url: LACROSSEWA_FIXTURES },
      { name: "Under 17", url: LACROSSEWA_FIXTURES },
    ],
  },
];

export default function Fixtures() {
  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Trophy className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <h1 className="text-4xl font-extrabold mb-4">Fixtures & Results</h1>
          <p className="text-maroon-100 text-lg">
            Game schedules and results for all Subiaco Lions teams, hosted by Lacrosse WA.
          </p>
        </div>
      </section>

      {/* Primary links */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            <a href={LACROSSEWA_FIXTURES} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="border-2 border-maroon-200 hover:border-maroon-500 hover:shadow-lg transition-all h-full group">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="w-14 h-14 bg-maroon-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-maroon-800 transition-colors">
                    <Trophy className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">Lacrosse WA Fixtures</h3>
                  <p className="text-stone-500 text-sm mb-4">Official fixtures and results for all Lacrosse WA competitions</p>
                  <Button variant="default" size="sm" className="gap-1.5">
                    View Fixtures <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </a>

            <a href={GAMEDAY_CLUB} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="border-2 border-gold-200 hover:border-gold-500 hover:shadow-lg transition-all h-full group">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gold-600 transition-colors">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">GameDay — Subiaco</h3>
                  <p className="text-stone-500 text-sm mb-4">Club profile, team rosters and season fixtures on GameDay</p>
                  <Button variant="gold" size="sm" className="gap-1.5">
                    View on GameDay <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </a>
          </div>

          {/* Teams breakdown */}
          <h2 className="section-title">Our Teams</h2>
          <div className="gold-bar" />
          <p className="section-subtitle">Click your team to view its fixtures on the Lacrosse WA website.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.category} className="overflow-hidden">
                <div className={`${team.color} h-2`} />
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
          <h2 className="text-xl font-bold text-stone-900 mb-2">Training Schedule</h2>
          <p className="text-stone-500 mb-4">
            Training times and non-fixture club events are managed in our club calendar.
          </p>
          <Link href="/calendar">
            <Button variant="outline">View Club Calendar</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
