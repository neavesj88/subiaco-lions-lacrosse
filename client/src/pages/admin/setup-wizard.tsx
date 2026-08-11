// =============================================================================
// SetupWizard — client/src/pages/admin/setup-wizard.tsx
// =============================================================================
// The first-run experience for a NEW club installing this site.
//
// It walks a non-technical admin through the handful of things that make the
// site "theirs" — name, sport, home ground, contact details, colours — and
// writes them straight to Settings. Everything it sets can be changed later in
// Settings; the wizard just means nobody has to hunt for it on day one.
//
// IMPORTANT — a site that already has content never sees this. The migration marks
// setup_completed = "true" for any database that already has content, so an
// established club is never interrupted.
//
// Anything skipped simply keeps the default from shared/club-config.ts, so a
// club can finish in 60 seconds and refine later.
// =============================================================================

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, ArrowRight, ArrowLeft, Check, Palette } from "lucide-react";
import { CLUB_DEFAULTS } from "@shared/club-config";
import { checkTextOnColour } from "@shared/contrast";

/** One field the wizard asks about. */
interface Field {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  type?: "text" | "email" | "color";
}

interface Step {
  title: string;
  intro: string;
  fields: Field[];
}

const STEPS: Step[] = [
  {
    title: "Your club",
    intro: "Let's start with the basics. This is what appears in the header, footer and browser tab.",
    fields: [
      { key: "club_name", label: "Club name", placeholder: "e.g. Fremantle Sharks",
        help: "The main name shown in the logo area." },
      { key: "club_name_suffix", label: "Second line", placeholder: "e.g. Netball Club",
        help: "The smaller line beneath it. Together they make your full club name." },
      { key: "club_short_name", label: "Short name", placeholder: "e.g. Sharks",
        help: "Used in casual wording like \"Join the Sharks\"." },
      { key: "club_founded", label: "Year founded", placeholder: "e.g. 1975" },
    ],
  },
  {
    title: "Your sport",
    intro: "Used throughout the site's wording and in search-engine descriptions, so it reads naturally for your sport.",
    fields: [
      { key: "sport_name", label: "Sport (lowercase)", placeholder: "e.g. netball",
        help: "Used mid-sentence, e.g. \"junior netball in Perth\"." },
      { key: "sport_name_title", label: "Sport (capitalised)", placeholder: "e.g. Netball",
        help: "Used in headings." },
      { key: "venue_word", label: "What you call your venue", placeholder: "ground / court / pitch / rink" },
    ],
  },
  {
    title: "Where you play",
    intro: "Shown on the Contact and About pages, and used for the embedded map.",
    fields: [
      { key: "venue_name", label: "Home ground name", placeholder: "e.g. Gilbert Fraser Reserve" },
      { key: "venue_address", label: "Address", placeholder: "e.g. North Fremantle WA 6159" },
      { key: "map_query", label: "Map search", placeholder: "e.g. Gilbert Fraser Reserve, North Fremantle",
        help: "What to search for on Google Maps. Usually the ground name plus suburb." },
      { key: "region_name", label: "City / region", placeholder: "e.g. Perth",
        help: "Used in search descriptions, e.g. \"netball in Perth\"." },
      { key: "region_state", label: "State", placeholder: "e.g. WA" },
    ],
  },
  {
    title: "Contact & social",
    intro: "Where enquiries go, and which social accounts to link.",
    fields: [
      { key: "contact_email", label: "Club email", type: "email", placeholder: "info@yourclub.com.au",
        help: "Every \"email us\" link on the site points here." },
      { key: "facebook_url", label: "Facebook page URL", placeholder: "https://facebook.com/yourclub" },
      { key: "instagram_handle", label: "Instagram handle", placeholder: "yourclub (without the @)" },
      { key: "league_name", label: "Your league / association", placeholder: "e.g. Netball WA" },
      { key: "league_url", label: "League website", placeholder: "https://..." },
    ],
  },
  {
    title: "Club colours",
    intro: "Your colours are used for banners, buttons and headings across the whole site.",
    fields: [
      { key: "theme_primary", label: "Primary colour", type: "color",
        help: "Your main club colour — banners, buttons and headings." },
      { key: "theme_primary_dark", label: "Darker shade", type: "color",
        help: "The deeper colour banners fade into. Usually a darker version of the primary." },
      { key: "theme_accent", label: "Accent colour", type: "color",
        help: "Highlights, underlines and pinned posts." },
    ],
  },
];

export default function SetupWizard({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  // Start from the current defaults so nothing is ever blank/broken.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    STEPS.forEach((s) => s.fields.forEach((f) => { v[f.key] = CLUB_DEFAULTS[f.key] ?? ""; }));
    return v;
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, string>) => apiRequest("PUT", "/api/settings", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/secure"] });
    },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const finish = (skipped = false) => {
    save.mutate({ ...values, setup_completed: "true" }, {
      onSuccess: () => {
        toast({
          title: skipped ? "Setup skipped" : "Your site is ready!",
          description: skipped
            ? "You can change everything anytime in Settings."
            : "Everything here can be changed later in Settings.",
        });
        onDone();
      },
    });
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header + progress */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-maroon-700 text-white flex items-center justify-center mx-auto mb-3">
            <Rocket className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Welcome — let's set up your site</h1>
          <p className="text-sm text-stone-500 mt-1">
            Five quick steps. Everything can be changed later in Settings.
          </p>
        </div>

        <div className="flex gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.title}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-maroon-700" : "bg-stone-200"}`}
              title={s.title} />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="text-lg font-bold text-stone-900 mt-0.5">{current.title}</h2>
              <p className="text-sm text-stone-500 mt-1">{current.intro}</p>
            </div>

            {current.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                {f.type === "color" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-14 rounded border cursor-pointer bg-white p-0.5"
                      value={values[f.key] || "#000000"}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                    <Input
                      className="font-mono"
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  </div>
                ) : (
                  <Input
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
                {f.help && <p className="text-xs text-stone-500">{f.help}</p>}
              </div>
            ))}

            {/* Live colour preview on the last step */}
            {isLast && (
              <div>
                <Label className="mb-1.5 block flex items-center gap-1.5">
                  <Palette className="h-4 w-4" /> Preview
                </Label>
                <div
                  className="rounded-xl p-6 text-center text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${values.theme_primary} 0%, ${values.theme_primary_dark} 100%)` }}
                >
                  <p className="text-xl font-extrabold">{values.club_name || "Your Club"}</p>
                  <p className="text-sm opacity-80">{values.club_name_suffix}</p>
                  <div className="h-1 w-16 mx-auto mt-2 rounded-full" style={{ background: values.theme_accent }} />
                </div>

                {/* Caught here rather than after launch: this banner carries
                    white text on every page of the finished site. */}
                {(() => {
                  const check = checkTextOnColour(values.theme_primary || "#7B1E32");
                  if (check.ok) return null;
                  return (
                    <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                      {check.message}
                    </p>
                  );
                })()}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="ghost" className="text-stone-500" onClick={() => finish(true)}
                disabled={save.isPending}>
                Skip setup
              </Button>
              {isLast ? (
                <Button onClick={() => finish(false)} disabled={save.isPending}>
                  <Check className="h-4 w-4" /> {save.isPending ? "Saving…" : "Finish"}
                </Button>
              ) : (
                <Button onClick={() => setStep((s) => s + 1)}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-stone-500 text-center mt-4">
          Skipping is fine — the site works straight away and every one of these
          lives in Settings.
        </p>
      </div>
    </div>
  );
}
