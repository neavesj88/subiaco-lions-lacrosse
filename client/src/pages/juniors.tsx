import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Shield, Heart, Mail, UserPlus } from "lucide-react";
import { RichTextDisplay } from "@/components/rich-text-display";
import { useListItems } from "@/hooks/use-list-items";
import { useClubDetails } from "@/components/club-details";
import { useSiteText } from "@/hooks/use-site-text";
import type { JuniorsContent } from "@shared/schema";

export default function Juniors() {
  const { items: faqItems } = useListItems("faq"); // title=question, body=answer
  const club = useClubDetails(); // club email from Admin → Settings
  const t = useSiteText();
  const { data: contentItems = [] } = useQuery<JuniorsContent[]>({
    queryKey: ["/api/juniors-content"],
    queryFn: () => apiRequest("GET", "/api/juniors-content"),
  });

  const get = (section: string) => contentItems.find((c) => c.section === section);
  const hero = get("hero");
  const programs = get("programs");
  const kidsport = get("kidsport");
  const equipment = get("equipment");
  const contact = get("contact");

  let programList: Array<{ age: string; description: string }> = [];
  if (programs?.content) {
    try {
      programList = JSON.parse(programs.content);
    } catch {
      /* use empty array */
    }
  }

  const defaultPrograms = [
    { age: "U11", description: "Modified rules focused on fun and skill development. A perfect introduction to the game." },
    { age: "U13", description: "Building core skills with more structured competition." },
    { age: "U15", description: "Competitive play with a focus on teamwork and game strategy." },
    { age: "U17", description: "High-level junior competition preparing players for senior teams." },
  ];

  const displayPrograms = programList.length > 0 ? programList : defaultPrograms;

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-gold-400" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Star className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
            {hero?.title ?? t("page_juniors_title")}
          </h1>
          <p className="text-maroon-100 text-lg max-w-2xl mx-auto">
            {hero?.content ?? t("page_juniors_subtitle")}
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-8">
            <Link href="/sign-up">
              <Button size="lg" variant="gold">
                <UserPlus className="h-5 w-5" />
                Register Your Child
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="section-title text-center">{programs?.title ?? "Our Programs"}</h2>
          <div className="gold-bar mx-auto" />
          <p className="section-subtitle text-center">Age-appropriate programs for every stage of development</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {displayPrograms.map((p, i) => (
              <Card key={p.age} className="relative overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-2 bg-gradient-to-r from-maroon-700 to-gold-500" />
                <CardHeader>
                  <div className="w-14 h-14 rounded-full bg-maroon-700 text-white flex items-center justify-center font-bold text-lg mx-auto mb-2 shadow">
                    {p.age}
                  </div>
                  <CardTitle className="text-center text-base">{p.age} Division</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-stone-500 text-center">
                  {p.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Info cards */}
      <section className="py-16 px-4 bg-stone-50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6">
          {/* Fee help: only when the club has written something about it
              (Admin -> Juniors). There's no built-in wording, because schemes
              differ by state and a club mustn't claim one it isn't part of. */}
          {(kidsport?.content ?? "").replace(/<[^>]+>/g, "").trim() && (
            <Card className="border-l-4 border-l-gold-500">
              <CardContent className="pt-6">
                <Shield className="h-8 w-8 text-gold-500 mb-3" aria-hidden="true" />
                <h3 className="font-bold text-stone-900 mb-2">{kidsport?.title || t("subsidy_name") || "Help with fees"}</h3>
                <RichTextDisplay html={kidsport!.content} className="text-sm text-stone-500" />
              </CardContent>
            </Card>
          )}

          <Card className="border-l-4 border-l-maroon-700">
            <CardContent className="pt-6">
              <Heart className="h-8 w-8 text-maroon-700 mb-3" />
              <h3 className="font-bold text-stone-900 mb-2">{equipment?.title ?? "What to Bring"}</h3>
              <RichTextDisplay
                html={equipment?.content || `<p>${t("signup_what_to_bring")}</p>`}
                className="text-sm text-stone-500"
              />
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <Mail className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-bold text-stone-900 mb-2">{contact?.title ?? "Get in Touch"}</h3>
              <RichTextDisplay
                html={contact?.content || `<p>For all junior enquiries, ${club.email ? `email us at ${club.email}` : "get in touch"} and our Juniors Coordinator will get back to you.</p>`}
                className="text-sm text-stone-500"
              />
              <a
                href={`mailto:${club.email}`}
                className="inline-block mt-3 text-sm text-maroon-600 hover:text-maroon-800 font-medium"
              >
                {club.email} →
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-center">Common Questions</h2>
          <div className="gold-bar mx-auto" />
          <div className="space-y-4 mt-6">
            {faqItems.map((item) => (
              <details key={item.id} className="group border rounded-xl overflow-hidden">
                <summary className="cursor-pointer px-5 py-4 font-medium text-stone-900 flex justify-between items-center hover:bg-stone-50">
                  {item.title}
                  <span className="text-stone-500 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <div className="px-5 pb-4 pt-2 text-sm text-stone-500 border-t bg-stone-50">
                  {item.body}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 hero-gradient text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Your Child Started?</h2>
        <p className="text-maroon-100 mb-8 max-w-xl mx-auto">
          Register your interest and our Junior Coordinator will be in touch to welcome your family to the {t("club_short_name")}.
        </p>
        <Link href="/sign-up">
          <Button size="lg" variant="gold">
            <UserPlus className="h-5 w-5" />
            Register Now
          </Button>
        </Link>
      </section>
    </>
  );
}
