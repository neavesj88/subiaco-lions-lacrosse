import { Users, Trophy, MapPin, Mail, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const teams = [
  {
    category: "Men's",
    color: "bg-blue-600",
    divisions: ["State League", "Division 1", "Division 2", "Division 3"],
  },
  {
    category: "Women's",
    color: "bg-purple-600",
    divisions: ["State League", "Division 1", "Division 2"],
  },
  {
    category: "Juniors",
    color: "bg-green-600",
    divisions: ["Under 11", "Under 13", "Under 15", "Under 17"],
  },
];

export default function About() {
  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold mb-4">About the Club</h1>
          <p className="text-maroon-100 text-lg">Perth's longest-running lacrosse club — over 80 years of Lions pride.</p>
        </div>
      </section>

      {/* History */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="section-title">Our History</h2>
              <div className="gold-bar" />
              <div className="space-y-4 text-stone-600 leading-relaxed">
                <p>
                  Subiaco Lacrosse Club was formed in 1940 by Mr J.L. Carden, drawing from the foundations of the Nedlands Lacrosse Club established in 1930. After World War II, Nedlands fielded only senior men while Subiaco had a large group of junior boys graduating to senior lacrosse — the two clubs merged to create the strong, unified club we know today.
                </p>
                <p>
                  Based at Rosalie Park in Shenton Park, the Lions have been a cornerstone of lacrosse in Western Australia for over eight decades. The club is known for its ANZAC Day lacrosse traditions and has consistently developed players who go on to represent at national and international level.
                </p>
                <p>
                  Today, Subiaco fields teams and develops players across all levels of the Women's and Men's competitions, including Modcrosse — fostering a love for lacrosse through inclusivity, sportsmanship and community.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Trophy, label: "Founded", value: "1940" },
                { icon: Users, label: "Teams", value: "10+" },
                { icon: Shield, label: "Divisions", value: "State to Div 3" },
                { icon: MapPin, label: "Home Ground", value: "Rosalie Park" },
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
          <h2 className="section-title text-center">Our Teams</h2>
          <div className="gold-bar mx-auto" />
          <p className="section-subtitle text-center">
            Competing across all divisions of Lacrosse WA. New players welcome at every level.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {teams.map((t) => (
              <Card key={t.category} className="overflow-hidden">
                <div className={`${t.color} h-2`} />
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
              <h2 className="section-title">Find Us</h2>
              <div className="gold-bar" />
              <div className="space-y-3 text-stone-600">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-maroon-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-stone-900">Rosalie Park</p>
                    <p>Shenton Park WA 6008</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-maroon-700 shrink-0" />
                  <a href="mailto:subiacolacrosseclub@outlook.com" className="hover:text-maroon-700">
                    subiacolacrosseclub@outlook.com
                  </a>
                </div>
              </div>
              <div className="mt-6 rounded-xl overflow-hidden border shadow-sm">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3385.1!2d115.8!3d-31.95!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2a32bafc5c3b8e2b%3A0x5a6c1d4d8c9f1f8d!2sRosalie%20Park%2C%20Shenton%20Park%20WA%206008!5e0!3m2!1sen!2sau!4v1"
                  width="100%"
                  height="220"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Rosalie Park location"
                />
              </div>
            </div>
            <div>
              <h2 className="section-title">Affiliated With</h2>
              <div className="gold-bar" />
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="font-semibold text-stone-900 mb-1">Lacrosse WA</p>
                    <p className="text-sm text-stone-500 mb-2">Western Australia's governing body for lacrosse. Fixtures, results and rules.</p>
                    <a
                      href="https://lacrossewa.com.au"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-maroon-600 hover:underline font-medium"
                    >
                      lacrossewa.com.au →
                    </a>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="font-semibold text-stone-900 mb-1">Act Belong Commit</p>
                    <p className="text-sm text-stone-500">Subiaco Lions is a registered Act Belong Commit club, supporting the mental health and wellbeing of all members.</p>
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
