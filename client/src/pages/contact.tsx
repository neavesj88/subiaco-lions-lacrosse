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

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Please provide a bit more detail"),
});

type FormData = z.infer<typeof schema>;

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

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
          <h1 className="text-4xl font-extrabold mb-4">Contact Us</h1>
          <p className="text-maroon-100 text-lg">
            Questions about joining, junior programs, sponsorship or anything else — we'd love to hear from you.
          </p>
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
                href="mailto:subiacolacrosseclub@outlook.com"
                className="flex items-start gap-3 p-4 rounded-xl border bg-white hover:border-maroon-300 transition-colors group"
              >
                <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-maroon-700 transition-colors">
                  <Mail className="h-5 w-5 text-maroon-700 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Email</p>
                  <p className="text-sm text-stone-900 font-medium">subiacolacrosseclub@outlook.com</p>
                </div>
              </a>

              <div className="flex items-start gap-3 p-4 rounded-xl border bg-white">
                <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-maroon-700" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Home Ground</p>
                  <p className="text-sm text-stone-900 font-medium">Rosalie Park</p>
                  <p className="text-sm text-stone-500">Shenton Park WA 6008</p>
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
              <p className="text-sm font-semibold text-stone-700 mb-3">Follow the Lions</p>
              <div className="flex gap-3">
                <a
                  href="https://www.facebook.com/SubiacoLacrosse/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-medium"
                >
                  <Facebook className="h-4 w-4" /> Facebook
                </a>
                <a
                  href="https://www.instagram.com/subiacolacrosse_official/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:border-pink-400 hover:text-pink-600 transition-colors text-sm font-medium"
                >
                  <Instagram className="h-4 w-4" /> Instagram
                </a>
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
          <h2 className="text-xl font-bold text-stone-900 mb-4">Find Us — Rosalie Park, Shenton Park</h2>
          <div className="rounded-xl overflow-hidden border shadow-sm">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3385.1!2d115.8!3d-31.95!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2a32bafc5c3b8e2b%3A0x5a6c1d4d8c9f1f8d!2sRosalie%20Park%2C%20Shenton%20Park%20WA%206008!5e0!3m2!1sen!2sau!4v1"
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Rosalie Park map"
            />
          </div>
        </div>
      </section>
    </>
  );
}
