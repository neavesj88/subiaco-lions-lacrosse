// =============================================================================
// PAGE TEMPLATES — shared/page-templates.ts
// =============================================================================
// Starter content for admin-created pages.
//
// The point: a blank page is intimidating and usually produces a bad page.
// Picking "Committee / People" instead gives the volunteer a ready-made layout
// with example rows already filled in — they just overwrite the examples with
// real details. After that they can edit anything freely with the rich text
// editor, so the template is a starting point, never a cage.
//
// TO ADD A TEMPLATE: add an entry below. `content` is plain HTML matching what
// the TipTap editor produces (h2/h3, p, ul/li, table, hr). Nothing else to change.
// =============================================================================

export interface PageTemplate {
  id: string;
  name: string;         // shown on the template card
  description: string;  // one line explaining when to use it
  icon: string;         // lucide icon name, resolved in the admin UI
  subtitle: string;     // default banner subtitle
  content: string;      // starter HTML
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "info",
    name: "Simple Information",
    description: "A straightforward page of text with headings — club policies, history, general info.",
    icon: "FileText",
    subtitle: "Information for members",
    content: `
<h2>About this page</h2>
<p>Replace this with your introduction. Explain in a sentence or two what this page is for, so members know they're in the right place.</p>
<h3>First section</h3>
<p>Write your first section here. You can make text <strong>bold</strong>, add <em>emphasis</em>, or include <a href="/contact">links to other pages</a>.</p>
<h3>Second section</h3>
<p>Add as many sections as you need. Use the toolbar above to add headings, lists, links and photos.</p>
<ul><li>Bullet points are good for short lists</li><li>Keep each point to one idea</li><li>Delete any you don't need</li></ul>
`.trim(),
  },
  {
    id: "faq",
    name: "Questions & Answers",
    description: "A list of common questions with answers — great for parents and new players.",
    icon: "HelpCircle",
    subtitle: "Answers to common questions",
    content: `
<p>Below are answers to the questions we're asked most often. If yours isn't here, please <a href="/contact">get in touch</a>.</p>
<h3>What is the first question?</h3>
<p>Write the answer here. Keep it short and friendly — a couple of sentences is usually plenty.</p>
<h3>What is the second question?</h3>
<p>Write the answer here.</p>
<h3>What is the third question?</h3>
<p>Write the answer here. Delete any questions you don't need, and copy an existing one to add more.</p>
`.trim(),
  },
  {
    id: "people",
    name: "People / Committee",
    description: "A list of people with their roles and contact details — committee, coaches, life members.",
    icon: "Users",
    subtitle: "Meet the team behind the club",
    content: `
<p>Introduce the group here — for example, "Our committee volunteers their time to keep the club running. Feel free to say hello at the ground."</p>
<h3>Jane Smith — President</h3>
<p>A sentence about their role or how long they've been involved. Add an email if they're happy to be contacted.</p>
<h3>John Citizen — Secretary</h3>
<p>A sentence about their role.</p>
<h3>Alex Taylor — Treasurer</h3>
<p>A sentence about their role. Copy one of these blocks to add more people, or delete the ones you don't need.</p>
`.trim(),
  },
  {
    id: "links",
    name: "Links & Resources",
    description: "A tidy list of useful links — registration forms, governing bodies, partner clubs.",
    icon: "Link",
    subtitle: "Handy links for members",
    content: `
<p>Useful links for players, parents and volunteers.</p>
<h3>For players and parents</h3>
<ul>
<li><a href="#">Your league or governing body</a> — fixtures, results and competition info (replace this link)</li>
<li><a href="/sign-up">Join the club</a> — register to play with us</li>
<li>Add another link by typing the text, selecting it, and clicking the link button</li>
</ul>
<h3>For volunteers and coaches</h3>
<ul>
<li><a href="/coaches-board">Coaches Board</a> — our tactical whiteboard</li>
<li>Add your own links here</li>
</ul>
`.trim(),
  },
  {
    id: "schedule",
    name: "Schedule / Timetable",
    description: "Training times, season dates or a weekly timetable laid out in a table.",
    icon: "Calendar",
    subtitle: "Times and dates",
    content: `
<p>Current times are below. These can change during the season — we'll update this page when they do.</p>
<h3>Weekly training</h3>
<table>
<tbody>
<tr><th>Team</th><th>Day</th><th>Time</th><th>Where</th></tr>
<tr><td>Seniors</td><td>Tuesday</td><td>6:00pm – 7:30pm</td><td>Main oval</td></tr>
<tr><td>Juniors</td><td>Thursday</td><td>4:30pm – 5:30pm</td><td>Main oval</td></tr>
</tbody>
</table>
<h3>Important dates</h3>
<ul><li>Season starts — add the date</li><li>Finals — add the date</li><li>Presentation night — add the date</li></ul>
`.trim(),
  },
  {
    id: "blank",
    name: "Blank Page",
    description: "Start completely empty. Best if you already know exactly what you want.",
    icon: "File",
    subtitle: "",
    content: "<p></p>",
  },
];

export function getTemplate(id: string): PageTemplate {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[PAGE_TEMPLATES.length - 1];
}

// Turns "Life Members!" into "life-members" for the URL.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // drop punctuation
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse repeats
    .slice(0, 60)
    .replace(/^-|-$/g, "");          // trim stray hyphens
}
