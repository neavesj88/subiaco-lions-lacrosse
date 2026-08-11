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
  ListChecks, Settings, Users, ShieldAlert, LifeBuoy, PenTool, Palette, FilePlus, UserCheck,
  ShoppingBag, CreditCard, Receipt, Boxes,
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
    title: "Page Lists — divisions and FAQ",
    intro:
      "Some content is a list rather than a paragraph. The Page Lists tab manages these: the team divisions (shown on About and Fixtures) and the Juniors page FAQ. Things you SELL are no longer here — they live under Shop.",
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
      "Under the Club menu there's a full tactical whiteboard for coaches — a playing field where you drag players around, draw plays and plan set pieces. It's a tool, not a page you edit: there's nothing to manage in this panel.",
    tips: [
      "It works great on phones and tablets on the sideline — and even keeps working with no internet.",
      "Saved plays live on each coach's own device, not on the website.",
      "Don't want it in the menu? Turn it off under Settings → Page Visibility.",
    ],
  },
  {
    icon: ShoppingBag,
    title: "The Shop — what you sell",
    intro:
      "The Shop tab decides how the store page behaves, and lists what's for sale. You can run it four ways, and switch whenever you like: Closed (hidden), Enquiries only (items listed, people email to order — this is how it starts), Link to another shop, or Take card payments.",
    steps: [
      "Open Shop and pick how you want it to work at the top.",
      "Click 'Add product'. Give it a name, a price, and a photo from your Photos library.",
      "Add the sizes underneath. Every product needs at least one — leave the single 'One size' row if it doesn't come in sizes.",
      "Type how many you have of each size. LEAVE IT BLANK for made-to-order things that never run out.",
      "Save. It appears on the store page straight away.",
    ],
    tips: [
      "A product priced at $0 can't be bought. That's on purpose — it stops a half-finished item selling for nothing by accident.",
      "When a size runs out it shows as crossed out and can't be ordered. You don't have to do anything.",
      "Untick 'Show in the shop' to hide something for the off-season without deleting it and losing the details.",
      "Turn 'Needs posting' off for things like memberships or event tickets, so buyers aren't asked for a delivery address.",
      "Only Super Admins and Club Admins see the Shop. A Social Media Manager can't touch prices or orders.",
    ],
  },
  {
    icon: CreditCard,
    title: "Taking card payments (Stripe)",
    intro:
      "To take money on the site you need a free Stripe account in the club's name. Your website never sees anyone's card — people type their card on Stripe's own page. There's a full walkthrough in SETUP_SHOP.md, and this is the short version.",
    steps: [
      "Sign up at stripe.com in the club's name and finish their ID checks.",
      "In Stripe: Developers → API keys. Copy the Secret key into Shop → Stripe secret key here.",
      "In Stripe: Developers → Webhooks → Add endpoint. Paste the address shown in the Shop tab (there's a copy button), and tick the three events it lists.",
      "Copy that endpoint's Signing secret into Shop → Webhook signing secret here.",
      "Do a test purchase first — see the tips below.",
    ],
    tips: [
      "START WITH TEST KEYS. A key beginning sk_test_ puts a bright 'Test mode' banner on the shop and no real money moves. Use card number 4242 4242 4242 4242 with any future expiry and any 3-digit code.",
      "The webhook step is the one people skip. Without it, orders stay stuck on 'Pending' forever, because the site refuses to believe a payment happened until Stripe itself confirms it.",
      "The Shop tab tells you exactly what's still missing — read the coloured status line at the top.",
      "Test mode and live mode have SEPARATE webhooks and separate signing secrets. When you go live you must redo both keys.",
      "Stripe takes a small fee from each payment, and pays the rest into the club's bank account every few days.",
    ],
  },
  {
    icon: Receipt,
    title: "Orders — getting things to people",
    intro:
      "The Orders tab is your working list. It shows what was bought, in which size, whether they're collecting it or having it posted, their address, and anything they told you.",
    steps: [
      "Open Orders. Anything marked 'Paid' is money received and needs handing over.",
      "Get the order ready, hand it over or post it.",
      "Click 'Mark as handed over'. It moves to 'Fulfilled' and drops off your to-do count.",
    ],
    tips: [
      "'Pending' means someone started paying and didn't finish. Nothing was charged and there's nothing to do — those tidy themselves up.",
      "Stock comes down by itself when a payment succeeds. You don't need to adjust it after a sale.",
      "To refund someone, do it in your Stripe dashboard. This page updates itself once Stripe confirms it.",
      "The club and the customer both get an email the moment an order is paid for.",
      "Use the search box to find an order by its reference, the member's name or their email — handy when someone rings up asking about theirs.",
      "'Export' downloads every order as a spreadsheet, one row per item. That's the file to hand the treasurer for reconciling against the Stripe payouts.",
    ],
  },
  {
    icon: Boxes,
    title: "Stock — counting what's left",
    intro:
      "The Stock tab is one screen for every size you sell, so counting up after a delivery doesn't mean opening each product in turn. Tracking stock is entirely OPTIONAL — leave a box empty and that item is treated as made to order, never sells out, and is never chased.",
    steps: [
      "Open Stock. Anything sold out or running low is listed at the top.",
      "Use + and − after selling something at the clubhouse.",
      "Or type the real number straight in after a count — it saves when you click away.",
      "Set 'Warn me at or below' to whatever number gives you enough time to reorder.",
    ],
    tips: [
      "Online sales reduce stock automatically. You only need to adjust it here for things sold in person.",
      "The 'Sell it' switch beside each size takes that size off sale without deleting it — useful when a size is away being reprinted.",
      "Empty box = made to order. Use it for anything you order in on demand.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Emergency stops (Security tab)",
    intro:
      "At the top of the Security tab are two switches that stop things immediately: outgoing email, and card payments. Use them first if something is going wrong, then work out what happened.",
    steps: [
      "Open Security. The two switches are at the top under 'Emergency stops'.",
      "Switch off whatever needs stopping. It takes effect straight away.",
      "Sort out the problem, then switch it back on.",
    ],
    tips: [
      "Nothing is lost either way. With email off, form submissions and orders are still saved — you just read them in the tabs instead of getting an email.",
      "With payments off, the shop still shows everything; only the checkout is refused.",
      "Neither switch loses any settings, so turning it back on restores exactly what was there before.",
      "IMPORTANT: these only stop NEW activity. To refund someone, or to stop payouts, use the club's Stripe dashboard.",
      "A red banner stays on the page while anything is switched off, so it can't be forgotten.",
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
    icon: UserCheck,
    title: "The President & Board page",
    intro:
      "The Committee tab manages the people shown on the public President & Board page — ideal to refresh after each AGM.",
    steps: [
      "Go to Committee → Add Person.",
      "Enter their name and position (e.g. President), and pick a Section — Executive, General Committee, Coaches, or type your own.",
      "Optionally add a short bio, a public email and a photo. Without a photo their initials are shown.",
      "Use the up/down arrows to control the order they appear in.",
    ],
    tips: [
      "Untick 'Show on the public page' to hide someone without deleting them — handy between AGMs.",
      "Only add an email address if that person is happy for it to be public.",
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
              <span className="text-stone-500 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
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

      <p className="text-xs text-stone-500 mt-6 text-center">
        A printable version of this guide lives in the project as <code>HANDOVER.md</code>.
        For server / hosting matters, contact your technical administrator.
      </p>
    </div>
  );
}
