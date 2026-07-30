import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingBag, ExternalLink, Mail, Shirt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageContent } from "@/hooks/use-page-content";
import { useListItems } from "@/hooks/use-list-items";
import EditableSection from "@/components/editable-section";
import { useClubDetails } from "@/components/club-details";

export default function Store() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
  });

  const storeUrl = settings?.store_url;
  const { get } = usePageContent("store");
  const { items: apparel } = useListItems("store_item"); // title=name, body=description, label=badge
  const club = useClubDetails(); // club email from Admin → Settings

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <ShoppingBag className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <EditableSection page="store" section="hero_title" value={get("hero_title", "Club Store")} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="store" section="hero_subtitle" value={get("hero_subtitle", "Official Subiaco Lions Lacrosse Club apparel and equipment.")} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>
          {storeUrl && (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-6">
              <Button size="lg" variant="gold" className="gap-2">
                <ShoppingBag className="h-5 w-5" />
                Shop Online <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </section>

      {/* Store status */}
      {!storeUrl && (
        <section className="py-8 px-4 bg-gold-50 border-b border-gold-200">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-gold-800 font-medium">
              Our online store is coming soon!{" "}
              <a href={`mailto:${club.email}`} className="underline hover:text-gold-900">
                Email us
              </a>{" "}
              to order club apparel in the meantime.
            </p>
          </div>
        </section>
      )}

      {/* Apparel grid */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="section-title">Available Apparel</h2>
          <div className="gold-bar" />
          <p className="section-subtitle">
            {storeUrl
              ? "Browse and purchase through our online store."
              : "Contact us to order. Full online store launching soon."}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {apparel.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-maroon-100 flex items-center justify-center shrink-0 group-hover:bg-maroon-700 transition-colors">
                      <Shirt className="h-6 w-6 text-maroon-700 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-stone-900 text-sm leading-snug">{item.title}</h3>
                        {item.label && <Badge variant="secondary" className="text-xs shrink-0">{item.label}</Badge>}
                      </div>
                      <p className="text-xs text-stone-500 leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    {storeUrl ? (
                      <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="w-full gap-1.5">
                          View in Store <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    ) : (
                      <a href={`mailto:${club.email}?subject=Apparel Enquiry`}>
                        <Button size="sm" variant="outline" className="w-full gap-1.5">
                          <Mail className="h-3.5 w-3.5" /> Enquire to Order
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sizing & ordering info */}
      <section className="py-12 px-4 bg-stone-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-stone-900 mb-6 text-center">Ordering Information</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            {[
              { title: "Custom Sizing", desc: "All playing kit is available in men's, women's and junior sizes. Contact us for custom orders." },
              { title: "Bulk Orders", desc: "Team kit orders for full squads. Talk to us about bulk pricing for clubs and group orders." },
              { title: "Delivery", desc: "Perth metro delivery or pickup at Rosalie Park on training days. Contact us to arrange." },
            ].map((info) => (
              <div key={info.title} className="bg-white rounded-xl p-5 border">
                <h3 className="font-semibold text-maroon-700 mb-2 text-sm">{info.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{info.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-stone-500 text-sm mb-3">Questions about apparel or kit orders?</p>
            <a href={`mailto:${club.email}?subject=Store Enquiry`}>
              <Button variant="default" className="gap-2">
                <Mail className="h-4 w-4" />
                Contact Us
              </Button>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
