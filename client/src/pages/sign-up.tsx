import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, UserPlus, Zap, Heart, Shield } from "lucide-react";
import { useSiteText } from "@/hooks/use-site-text";
import { useClubDetails } from "@/components/club-details";

const formSchema = z
  .object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    email: z.string().email("Valid email required"),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
    isJunior: z.boolean().default(false),
    parentName: z.string().optional(),
    parentEmail: z.string().optional(),
    parentPhone: z.string().optional(),
    teamPreference: z.enum(["mens", "womens", "juniors", "unsure"]).default("unsure"),
    experienceLevel: z.enum(["beginner", "intermediate", "experienced"]).default("beginner"),
    kidsportEligible: z.boolean().default(false),
    howHeard: z.string().optional(),
    message: z.string().optional(),
    // Required. This form collects children's names, ages and their parents'
    // contact details, so the person filling it in has to have read what the
    // club will do with them and confirm they may provide them.
    privacyConsent: z.literal(true, {
      errorMap: () => ({ message: "Please confirm you've read how we use these details." }),
    }),
  })
  .refine(
    (d) => !d.isJunior || d.parentName,
    { message: "Parent/guardian name is required for junior registrations", path: ["parentName"] }
  );

type FormData = z.infer<typeof formSchema>;

export default function SignUp() {
  const [submitted, setSubmitted] = useState(false);
  const [isJunior, setIsJunior] = useState(false);
  const t = useSiteText(); // club-configurable wording
  const club = useClubDetails(); // club email, for the privacy notice

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(formSchema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/registrations", data),
    onSuccess: () => {
      setSubmitted(true);
      reset();
      // The junior section follows this, so it must go back to unticked with
      // the form; otherwise "Submit another" showed the parent fields for an
      // adult sign-up.
      setIsJunior(false);
    },
    onError: (e) => {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Welcome to the {t("club_short_name")}!</h2>
          <p className="text-stone-600 mb-6">
            Thanks for your interest. One of our team will be in touch within 48 hours with next steps.
          </p>
          <Button onClick={() => setSubmitted(false)}>Submit Another</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <UserPlus className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <h1 className="text-4xl font-extrabold mb-4">{t("page_signup_title")}</h1>
          <p className="text-maroon-100 text-lg">
            {t("page_signup_subtitle")}
          </p>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-8">
          {/* Info cards */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardContent className="pt-5">
                <Zap className="h-7 w-7 text-gold-500 mb-2" />
                <h3 className="font-semibold mb-1">What to Bring</h3>
                <p className="text-sm text-stone-500">{t("signup_what_to_bring")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <Heart className="h-7 w-7 text-maroon-600 mb-2" />
                <h3 className="font-semibold mb-1">All Welcome</h3>
                <p className="text-sm text-stone-500">{t("signup_all_welcome")}</p>
              </CardContent>
            </Card>
            {/* Only for a club that takes part in a fee-help scheme (Admin ->
                Settings -> Wording). Schemes differ by state, so this was
                wrongly promising WA's KidSport to every club. */}
            {t("subsidy_name") && (
              <Card>
                <CardContent className="pt-5">
                  <Shield className="h-7 w-7 text-green-600 mb-2" />
                  <h3 className="font-semibold mb-1">{t("subsidy_name")}</h3>
                  <p className="text-sm text-stone-500">Eligible junior members may be able to get help with fees through {t("subsidy_name")}. Tick the box on the form and we'll send you the details.</p>
                </CardContent>
              </Card>
            )}

            {settings?.gameday_registration_url && (
              <Card className="border-gold-300 bg-gold-50">
                <CardContent className="pt-5">
                  <h3 className="font-semibold mb-1 text-gold-800">Already decided?</h3>
                  <p className="text-sm text-gold-700 mb-3">
                    Register directly through {t("fixtures_provider_name")} to get your membership sorted immediately.
                  </p>
                  <a
                    href={settings.gameday_registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="gold" size="sm" className="w-full">Register on {t("fixtures_provider_name")} →</Button>
                  </a>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Expression of Interest</CardTitle>
              <p className="text-sm text-stone-500">Fill in the form and we'll be in touch to get you started.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" {...register("firstName")} />
                    {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" {...register("lastName")} />
                    {errors.lastName && <p className="text-xs text-red-600">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" {...register("phone")} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="teamPreference">Team Preference</Label>
                    <Select onValueChange={(v) => setValue("teamPreference", v as any)} defaultValue="unsure">
                      <SelectTrigger id="teamPreference">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* The club's own team names (Admin -> Settings -> Wording) */}
                        <SelectItem value="mens">{t("team_label_mens")}</SelectItem>
                        <SelectItem value="womens">{t("team_label_womens")}</SelectItem>
                        <SelectItem value="juniors">{t("team_label_juniors")}</SelectItem>
                        <SelectItem value="unsure">Not sure yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="experienceLevel">Experience Level</Label>
                  <Select onValueChange={(v) => setValue("experienceLevel", v as any)} defaultValue="beginner">
                    <SelectTrigger id="experienceLevel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner — never played before</SelectItem>
                      <SelectItem value="intermediate">Intermediate — played before</SelectItem>
                      <SelectItem value="experienced">Experienced — played competitively</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Junior toggle */}
                <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border">
                  <Checkbox
                    id="isJunior"
                    onCheckedChange={(checked) => {
                      const v = checked === true;
                      setIsJunior(v);
                      setValue("isJunior", v);
                    }}
                  />
                  <Label htmlFor="isJunior" className="cursor-pointer">
                    This is a junior registration (under 18)
                  </Label>
                </div>

                {isJunior && (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-800">Parent / Guardian Details</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="parentName">Parent / Guardian Name *</Label>
                        <Input id="parentName" {...register("parentName")} />
                        {errors.parentName && <p className="text-xs text-red-600">{errors.parentName.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="parentEmail">Parent Email</Label>
                        <Input id="parentEmail" type="email" {...register("parentEmail")} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="parentPhone">Parent Phone</Label>
                      <Input id="parentPhone" type="tel" {...register("parentPhone")} />
                    </div>
                    {t("subsidy_name") && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="kidsportEligible"
                          onCheckedChange={(c) => setValue("kidsportEligible", c === true)}
                        />
                        <Label htmlFor="kidsportEligible" className="cursor-pointer text-sm">
                          I'd like information about {t("subsidy_name")} help with fees
                        </Label>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="howHeard">How did you hear about us?</Label>
                  <Input id="howHeard" placeholder="Social media, friend, school..." {...register("howHeard")} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Anything else you'd like us to know?</Label>
                  <Textarea id="message" rows={3} {...register("message")} />
                </div>

                {/* Placed here, right before submitting, so it's read at the
                    moment the details are actually handed over. */}
                <div className="space-y-3 p-4 bg-stone-50 rounded-lg border">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {t("privacy_signup_notice").replace("{email}", club.email || "the club")}
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="privacyConsent"
                      onCheckedChange={(c) => setValue("privacyConsent", (c === true) as true)}
                    />
                    <Label htmlFor="privacyConsent" className="cursor-pointer text-sm font-normal leading-snug">
                      {t("privacy_consent_label")} *
                    </Label>
                  </div>
                  {errors.privacyConsent && (
                    <p className="text-xs text-red-600">{errors.privacyConsent.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={mutation.isPending}>
                  {mutation.isPending ? "Submitting..." : "Submit Expression of Interest"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
