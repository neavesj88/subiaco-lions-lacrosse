import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, Facebook, Instagram, CheckCircle, Clock } from "lucide-react";
import { usePageContent } from "@/hooks/use-page-content";
import EditableSection from "@/components/editable-section";
import { useSiteText } from "@/hooks/use-site-text";
import { useClubDetails, ClubMap } from "@/components/club-details";
import { useSettings } from "@/hooks/use-settings";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Please provide a bit more detail"),
});

type FormData = z.infer<typeof schema>;

export default function Contact() {
  const t = useSiteText(); // club-configurable wording
  const [submitted, setSubmitted] = useState(false);
  const { get } = usePageContent("contact");
  // Club address / email / map come from Admin → Settings → Club Details
  const club = useClubDetails();
  const { settings } = useSettings();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/contact", data),
    onSuccess: () => {
      setSubmitted(true);
      reset();
    },
    onError: (e) => toast({ title: "Couldn't send message", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Mail className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <EditableSection page="contact" section="hero_title" value={get("hero_title", t("page_contact_title"))} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="contact" section="hero_subtitle" value={get("hero_subtitle", t("page_contact_subtitle"))} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-10">
          {/* Contact details */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="section-title">Get in Touch</h2>
              <div className="gold-bar" />
            </div>

            <div className="space-y-4">
              <a
                href={`mailto:${club.email}`}
                className="flex items-start gap-3 p-4 rounded-xl border bg-white hover:border-maroon-300 transition-colors group"
              >
                <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-maroon-700 transition-colors">
                  <Mail className="h-5 w-5 text-maroon-700 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Email</p>
                  <p className="text-sm text-stone-900 font-medium">{club.email}</p>
                </div>
              </a>

              <div className="flex items-start gap-3 p-4 rounded-xl border bg-white">
                <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-maroon-700" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Home Ground</p>
                  <p className="text-sm text-stone-900 font-medium">{club.venue}</p>
                  <p className="text-sm text-stone-500">{club.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl border bg-white">
                <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-maroon-700" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Response Time</p>
                  <p className="text-sm text-stone-900 font-medium">Within 48 hours</p>
                  <p className="text-sm text-stone-500">We'll get back to you as soon as possible</p>
                </div>
              </div>
            </div>

            {/* Social */}
            <div>
              <p className="text-sm font-semibold text-stone-700 mb-3">Follow {t("club_short_name")}</p>
              <div className="flex gap-3">
                {(settings?.facebook_url || t("facebook_url")) && <a
                  href={settings?.facebook_url || t("facebook_url")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-medium"
                >
                  <Facebook className="h-4 w-4" /> Facebook
                </a>}
                {(settings?.instagram_handle || t("instagram_handle")) && <a
                  href={`https://www.instagram.com/${settings?.instagram_handle || t("instagram_handle")}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:border-pink-400 hover:text-pink-600 transition-colors text-sm font-medium"
                >
                  <Instagram className="h-4 w-4" /> Instagram
                </a>}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">Message Sent!</h3>
                  <p className="text-stone-500 mb-6">Thanks for getting in touch. We'll reply within 48 hours.</p>
                  <Button onClick={() => setSubmitted(false)} variant="outline">Send Another</Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-stone-900 text-lg mb-4">Send a Message</h3>
                  <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Your Name *</Label>
                        <Input id="name" {...register("name")} />
                        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input id="email" type="email" {...register("email")} />
                        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input id="subject" placeholder="e.g. Joining the club, Sponsorship, Junior enquiry..." {...register("subject")} />
                      {errors.subject && <p className="text-xs text-red-600">{errors.subject.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="message">Message *</Label>
                      <Textarea id="message" rows={5} placeholder="Tell us how we can help..." {...register("message")} />
                      {errors.message && <p className="text-xs text-red-600">{errors.message.message}</p>}
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
                      {mutation.isPending ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-stone-900 mb-4">Find Us — {club.fullAddress}</h2>
          <ClubMap height={300} />
        </div>
      </section>
    </>
  );
}
