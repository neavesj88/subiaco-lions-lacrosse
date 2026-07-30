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
  ListChecks, Settings, Users, ShieldAlert, LifeBuoy, PenTool, Palette, FilePlus,
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
      "Use the Search, 'Date added' and 'Sort by' boxes to find an old photo quickly.",
      "Wherever you see 'Choose image' (logo, hero background, sponsor logos, post thumbnails), you can pick from this library or upload on the spot.",
    ],
    tips: [
      "Photos appear exactly as uploaded — there's no cropping or re-ordering in the library, and the gallery always shows newest first. Edit a photo on your phone/computer BEFORE uploading if you need it framed differently.",
      "'Link' copies a photo's web address, handy if you need to paste it somewhere.",
      "Deleting a photo removes it from the gallery AND from any post using it — delete carefully.",
      "Don't want a public gallery? Turn the page off under Settings → Page Visibility.",
    ],
  },
  {
    icon: FilePlus,
    title: "Adding your own pages",
    intro:
      "The Pages tab lets you add pages the site didn't come with — Life Members, Club Policies, Coaching Resources, anything you like. You never start from a blank screen.",
    steps: [
      "Go to Pages → New Page.",
      "Pick the template closest to what you need (Simple Information, Questions & Answers, People/Committee, Links & Resources, Schedule, or Blank).",
      "Give it a title — the web address fills in automatically.",
      "Overwrite the example content with your own. It's the same editor as news posts, so you can add headings, lists, links and photos.",
      "Choose where it appears: the Club menu, the main menu bar, the footer, or nowhere.",
      "Untick 'Visible to visitors' if you want to keep working on it privately, then Create Page.",
    ],
    tips: [
      "The template only fills in a starting layout — you can change or delete anything in it afterwards.",
      "Every page lives at /p/its-name, so it can never clash with the built-in pages.",
      "Changing the web address of a live page breaks any links people have saved — best to leave it alone once published.",
    ],
  },
  {
    icon: Palette,
    title: "Changing the club's colours",
    intro:
      "Settings → Club Colours controls the look of the entire site — the coloured banner at the top of every page, headings, buttons and the little accent bars.",
    steps: [
      "Go to Settings and scroll to Club Colours.",
      "Click a colour swatch to pick a colour, or type a hex code (like #7B1E32) if you know it.",
      "Watch the Preview box update as you choose.",
      "Click Save Colours — the whole site changes instantly.",
    ],
    tips: [
      "'Primary' is the club's main colour, 'Banner shadow' is the darker shade the banner fades into, and 'Accent' is the gold used for highlights.",
      "Got it wrong? 'Reset to club defaults' puts the original maroon and gold back in one click.",
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
    icon: PenTool,
    title: "The Coaches Board (tactical whiteboard)",
    intro:
      "Under the Club menu there's a full tactical whiteboard for coaches — a lacrosse field where you drag players around, draw plays and plan set pieces. It's a tool, not a page you edit: there's nothing to manage in this panel.",
    tips: [
      "It works great on phones and tablets on the sideline — and even keeps working with no internet.",
      "Saved plays live on each coach's own device, not on the website.",
      "Don't want it in the menu? Turn it off under Settings → Page Visibility.",
    ],
  },
  {
    icon: Settings,
    title: "Settings & turning pages on/off",
    intro:
      "The Settings tab (Super Admins only) holds the club-wide options: logo, hero photo, club colours, Instagram feed, GameDay links, and the email (SMTP) server. Each field explains itself.",
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
    title: "The Security tab (Super Admins)",
    intro:
      "One place for the emergency jobs — everything here used to need a technical person with server access.",
    steps: [
      "Email sending — a master ON/OFF switch for every email the site sends. Turning it off loses nothing: sign-ups and messages still save, you just read them in their tabs.",
      "Send a test email — proves your email settings actually work, and tells you exactly what's wrong if they don't.",
      "Reset an Admin's Password — for the 'I've forgotten mine' phone call. Set a temporary one and pass it on.",
      "Admin Access — Lock someone out without deleting them (their posts and history stay). Unlock anytime.",
      "Login Lockouts — the site auto-blocks a device after repeated wrong passwords (5 minutes after 3 tries, longer if it persists). Unblock a genuine admin here.",
    ],
    tips: [
      "Locked yourself out with typos? Wait 5 minutes, use another device, or ask another Super Admin to clear it.",
      "The site won't let you lock or delete the last Super Admin — that's deliberate, so the club can never be locked out entirely.",
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
