// =============================================================================
// Committee — client/src/pages/committee.tsx
// =============================================================================
// The public "President & Board" page. Everyone shown here is managed in
// Admin → Committee, so the club can refresh it after each AGM without code.
//
// Members are grouped (Executive, General Committee, Coaches…) and shown as a
// card grid with an optional photo, position, short bio and contact email.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { usePageContent } from "@/hooks/use-page-content";
import EditableSection from "@/components/editable-section";
import { Users, Mail } from "lucide-react";
import type { CommitteeMember } from "@shared/schema";

export default function Committee() {
  const { get } = usePageContent("committee");

  const { data: members = [], isLoading } = useQuery<CommitteeMember[]>({
    queryKey: ["/api/committee"],
    queryFn: () => apiRequest("GET", "/api/committee"),
  });

  // Group members under their section heading, preserving the admin's order.
  const groups: { name: string; people: CommitteeMember[] }[] = [];
  for (const m of members) {
    const key = m.groupName || "Committee";
    let g = groups.find((x) => x.name === key);
    if (!g) { g = { name: key, people: [] }; groups.push(g); }
    g.people.push(m);
  }

  // Initials shown when someone hasn't uploaded a photo.
  const initials = (name: string) =>
    name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Users className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <EditableSection page="committee" section="hero_title" value={get("hero_title", "President & Board")} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="committee" section="hero_subtitle" value={get("hero_subtitle", "The volunteers who run the club.")} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          {isLoading && <p className="text-center text-stone-400 py-12">Loading…</p>}

          {!isLoading && members.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-stone-200 mx-auto mb-3" />
              <p className="text-stone-400">Committee details are being updated — check back soon.</p>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.name} className="mb-12 last:mb-0">
              <h2 className="section-title text-center">{g.name}</h2>
              <div className="gold-bar mx-auto" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {g.people.map((m) => (
                  <Card key={m.id} className="text-center hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      {m.photoUrl ? (
                        <img
                          src={m.photoUrl}
                          alt={m.name}
                          className="w-24 h-24 rounded-full object-cover mx-auto mb-3 border-4 border-maroon-100"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full mx-auto mb-3 bg-maroon-700 text-white flex items-center justify-center text-2xl font-bold">
                          {initials(m.name)}
                        </div>
                      )}
                      <h3 className="font-bold text-stone-900">{m.name}</h3>
                      <p className="text-sm font-medium text-maroon-700 mb-2">{m.position}</p>
                      {m.bio && <p className="text-sm text-stone-500 leading-relaxed">{m.bio}</p>}
                      {m.email && (
                        <a
                          href={`mailto:${m.email}`}
                          className="inline-flex items-center gap-1.5 mt-3 text-xs text-maroon-600 hover:text-maroon-800"
                        >
                          <Mail className="h-3.5 w-3.5" /> {m.email}
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
