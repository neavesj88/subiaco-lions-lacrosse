// =============================================================================
// AdminHelp — client/src/pages/admin/help.tsx
// =============================================================================
// The "Help" tab inside the admin panel: a plain-English user guide built into
// the site itself, so club volunteers never need to hunt for a manual.
//
// TO EDIT THE GUIDE: just change the text in the GUIDE array below. Each entry
// becomes one expandable section. Plain strings become paragraphs; entries in
// "steps" become a numbered list. No other code needs touching.
// =============================================================================

import {
  Rocket, Pencil, Megaphone, ImageIcon, Calendar, ClipboardList, Trophy,
  ListChecks, Settings, Users, ShieldAlert, LifeBuoy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface GuideSection {
  icon: any;                // lucide icon shown next to the title
  title: string;            // section heading
  intro?: string;           // optional paragraph shown before the steps
  steps?: string[];         // optional numbered how-to list
  tips?: string[];          // optional bullet-point tips shown after the steps
}

const GUIDE: GuideSection[] = [
  {
    icon: Rocket,
    title: "Getting started — your first login",
    intro:
      "Everything on the website is managed from this admin panel. You never need to touch code, and every change is live the moment you save it — there's no separate 'publish' step.",
    steps: [
      "Bookmark the admin login page (its address is private — ask whoever gave you access).",
      "If you see a yellow 'Security warning' bar, click Change Password straight away and pick your own.",
      "Have a click around each tab — nothing breaks by looking, and this guide explains each one.",
    ],
    tips: [
      "You're automatically logged out after about 2 hours of inactivity — just log back in.",
      "Change your own password anytime with the Password button in the top-right corner.",
    ],
  },
  {
    icon: Pencil,
    title: "Editing text on the public pages",
    intro:
      "While you're logged in, browse the normal website (Home, About, Fixtures…) and hover your mouse over headings and paragraphs. A small maroon pencil appears on anything you can edit.",
    steps: [
      "Open the public page you want to change (a small 'Edit mode' pill shows bottom-left as a reminder).",
      "Hover over the text until the pencil button appears, and click it.",
      "Make your changes in the popup — some sections give you a full editor with bold, lists and links.",
      "Click Save Changes. The page updates instantly for everyone.",
    ],
  },
  {
    icon: Megaphone,
    title: "News posts",
    intro:
      "The News tab manages the announcements shown on the home page. Posts support formatting, photos, and can be pinned to the top.",
    steps: [
      "Go to News → New Post.",
      "Write your post — use the toolbar for bold, headings, bullet points, links, and the photo button to add images inside the post.",
      "Optionally add a Featured Image (the thumbnail shown on the home page card).",
      "Tick '📌 Pin this post' for big announcements — pinned posts show first with a gold border.",
      "Leave 'Publish immediately' ticked, or untick it to save a draft only admins can see.",
    ],
  },
  {
    icon: ImageIcon,
    title: "Photos, the Media library and the Gallery",
    intro:
      "The Media tab is the club's photo library. Upload once, use anywhere — every uploaded photo automatically appears on the public Gallery page too.",
    steps: [
      "Go to Media and drag photos onto the upload box (or click it to browse). Up to 8 MB each.",
      "Add a caption under any photo — captions show in the public gallery.",
      "Wherever you see 'Choose image' (logo, hero background, sponsor logos, post thumbnails), you can pick from this library or upload on the spot.",
    ],
    tips: [
      "Deleting a photo removes it from the gallery AND from any post using it — delete carefully.",
      "Don't want a public gallery? Turn the page off under Settings → Page Visibility.",
    ],
  },
  {
    icon: Calendar,
    title: "Events & the club calendar",
    intro:
      "The Events tab feeds the public Calendar page and the 'Upcoming Events' section on the home page.",
    steps: [
      "Go to Events → Add Event.",
      "Give it a title, date, location, a type (game / training / social / meeting) and which team it's for.",
      "Save — it appears on the public calendar immediately.",
    ],
    tips: [
      "Already run a club Google Calendar? Paste its embed link under Settings → Google Calendar Embed URL and visitors get a 'Google Calendar' view too.",
    ],
  },
  {
    icon: ClipboardList,
    title: "Sign-ups and contact messages",
    intro:
      "When someone fills in the Sign Up or Contact form, it lands in the Sign-Ups or Messages tab (and emails the club, if email is set up).",
    steps: [
      "Check the Sign-Ups tab — new enquiries are marked 'New'.",
      "Contact the person (their email and phone are on the card), then use the dropdown to move them to Contacted → Registered so the committee can see who's been handled.",
      "Messages works the same way: read, click the envelope to reply by email, and mark as read.",
    ],
  },
  {
    icon: Trophy,
    title: "Results, sponsors and the newsletter list",
    intro:
      "Three smaller tabs that feed the home page:",
    steps: [
      "Results — enter match scores after game day; the latest four show on the home page (wins green, losses red).",
      "Sponsors — add each sponsor's name, logo and website. Gold-tier logos display biggest. They appear in the sponsor strip on the home page.",
      "Newsletter — people subscribe via the home page widget. Export the list as a CSV file anytime to use with Mailchimp or plain email.",
    ],
  },
  {
    icon: ListChecks,
    title: "Page Lists — divisions, store items, FAQ",
    intro:
      "Some content is a list rather than a paragraph. The Page Lists tab manages these: the team divisions (shown on About and Fixtures), the Store's apparel cards, and the Juniors page FAQ.",
    steps: [
      "Open Page Lists and pick the list you want.",
      "Add, edit, remove or re-order rows with the arrows.",
      "Changes appear on the public pages immediately.",
    ],
  },
  {
    icon: Settings,
    title: "Settings & turning pages on/off",
    intro:
      "The Settings tab (Super Admins only) holds the club-wide options: logo, hero photo, Instagram feed, GameDay links, contact email and more. Each field explains itself.",
    tips: [
      "Page Visibility switches let you hide whole pages (Store, Gallery, etc.) until you're ready — flip the switch and it vanishes from the menu instantly, flip it back anytime.",
      "The club logo and hero image use 'Choose image' — upload via the Media library, no web addresses needed.",
    ],
  },
  {
    icon: Users,
    title: "Admin accounts & roles",
    intro:
      "The Users tab (Super Admins only) controls who can log in and what they can touch. Four roles: Super Admin (everything), Club Admin (events, results, sign-ups, sponsors), Juniors Coordinator (juniors page), Content Manager (news & photos).",
    steps: [
      "Give each committee member their OWN login — don't share one password around.",
      "When someone leaves the committee, delete their account.",
    ],
    tips: [
      "GOLDEN RULE: always keep at least TWO Super Admins (e.g. President + Secretary). The site refuses to remove the last one — that's deliberate, so you can never lock yourselves out.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Login security & lockouts",
    intro:
      "The login page locks out a device after repeated wrong passwords (5 minutes after 3 tries, longer if it keeps happening). This blocks password-guessing bots.",
    tips: [
      "Locked yourself out with typos? Just wait 5 minutes, or use another device.",
      "Super Admins can see and clear any lockouts under Settings → Login Security.",
      "The admin area lives at a private address on purpose — don't post the link publicly.",
    ],
  },
  {
    icon: LifeBuoy,
    title: "If something goes wrong",
    intro:
      "Nothing you do in this panel can break the website's code — worst case, some text or a photo looks wrong and you edit it again. For bigger problems:",
    steps: [
      "Nobody can log in at all → whoever manages the server runs the emergency reset (it's in the HANDOVER guide) and gets a fresh password.",
      "The site is down → contact your technical person; it usually just needs a restart.",
      "Something looks broken on a page → try a hard refresh (Ctrl+Shift+R) first, then report what page and what you clicked.",
    ],
    tips: [
      "The database is backed up nightly on the server. Content you deleted by accident can usually be recovered from last night's backup — ask your technical person.",
    ],
  },
];

// ── The rendered Help tab ─────────────────────────────────────────────────────
export default function AdminHelp() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Help & How-To Guide</h2>
      </div>

      <Card className="mb-4 bg-maroon-50 border-maroon-200">
        <CardContent className="pt-4 pb-4 text-sm text-maroon-900">
          <p>
            <strong>New here? Start with the first section below.</strong> Everything on the
            website is managed from this panel — changes go live instantly, and nothing you
            do here can break the site itself. Click any section to expand it.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {GUIDE.map((s) => (
          <details key={s.title} className="group border rounded-xl overflow-hidden bg-white">
            <summary className="cursor-pointer px-5 py-4 font-medium text-stone-900 flex items-center gap-3 hover:bg-stone-50">
              <s.icon className="h-5 w-5 text-maroon-700 shrink-0" />
              <span className="flex-1">{s.title}</span>
              <span className="text-stone-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
            </summary>
            <div className="px-5 pb-5 pt-1 border-t bg-stone-50 space-y-3">
              {s.intro && <p className="text-sm text-stone-600 leading-relaxed">{s.intro}</p>}
              {s.steps && (
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-stone-600">
                  {s.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              )}
              {s.tips && (
                <ul className="space-y-1.5 text-sm text-stone-500">
                  {s.tips.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="text-gold-600 shrink-0">💡</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs text-stone-400 mt-6 text-center">
        A printable version of this guide lives in the project as <code>HANDOVER.md</code>.
        For server / hosting matters, contact your technical administrator.
      </p>
    </div>
  );
}
