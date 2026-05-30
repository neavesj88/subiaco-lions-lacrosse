import bcrypt from "bcrypt";
import { db } from "./db";
import { users, juniorsContent, siteSettings, announcements, events } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Default super admin
  const existing = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash("lions2024!", 12);
    await db.insert(users).values({
      username: "admin",
      passwordHash,
      name: "Club Administrator",
      email: "subiacolacrosseclub@outlook.com",
      role: "super_admin",
    });
    console.log("Created default admin: admin / lions2024!");
    console.log("IMPORTANT: Change the admin password immediately after first login.");
  }

  // Default site settings
  const defaultSettings = [
    { key: "instagram_handle", value: "subiacolacrosse_official" },
    { key: "behold_feed_id", value: "" },
    { key: "facebook_url", value: "https://www.facebook.com/SubiacoLacrosse/" },
    { key: "contact_email", value: "subiacolacrosseclub@outlook.com" },
    { key: "location", value: "Rosalie Park, Shenton Park WA 6008" },
    { key: "gameday_registration_url", value: "https://membership.mygameday.app/regoform.cgi?formID=101320" },
    { key: "google_calendar_embed_url", value: "" },
    { key: "store_url", value: "" },
  ];

  for (const setting of defaultSettings) {
    const exists = await db.select().from(siteSettings).where(eq(siteSettings.key, setting.key)).limit(1);
    if (exists.length === 0) {
      await db.insert(siteSettings).values(setting);
    }
  }

  // Juniors page default content
  const juniorsDefaults = [
    {
      section: "hero",
      title: "Juniors Lacrosse",
      content: "Introducing the next generation of Lions. We offer programs for boys and girls aged 8-17 in a fun, safe and inclusive environment.",
    },
    {
      section: "programs",
      title: "Our Programs",
      content: JSON.stringify([
        { age: "U11", description: "Modified rules to focus on fun and skill development. Perfect introduction to lacrosse." },
        { age: "U13", description: "Building core lacrosse skills with more structured competition." },
        { age: "U15", description: "Competitive play with a focus on teamwork and game strategy." },
        { age: "U17", description: "High-level junior competition preparing players for senior lacrosse." },
      ]),
    },
    {
      section: "kidsport",
      title: "KidSport",
      content: "Subiaco Lions Lacrosse is registered with KidSport, a WA Government initiative providing eligible children with up to $200 per year to help cover club registration fees. Ask us about eligibility at signup.",
    },
    {
      section: "equipment",
      title: "What to Bring",
      content: "New players don't need to buy equipment straight away. The club provides loan sticks and helmets for your first few sessions. Just bring runners, a water bottle, and plenty of enthusiasm!",
    },
    {
      section: "contact",
      title: "Junior Coordinator",
      content: "For all junior enquiries, email us at subiacolacrosseclub@outlook.com and our Juniors Coordinator will get back to you within 48 hours.",
    },
  ];

  for (const content of juniorsDefaults) {
    const exists = await db.select().from(juniorsContent).where(eq(juniorsContent.section, content.section)).limit(1);
    if (exists.length === 0) {
      await db.insert(juniorsContent).values(content);
    }
  }

  // Sample announcement
  const annCount = await db.select().from(announcements).limit(1);
  if (annCount.length === 0) {
    await db.insert(announcements).values({
      title: "Welcome to the 2025 Season!",
      content: "The Subiaco Lions Lacrosse Club is excited to kick off another great season. Training begins this Saturday at Rosalie Park. All new players welcome — no experience necessary.",
      isPublished: true,
    });
  }

  // Sample event
  const evtCount = await db.select().from(events).limit(1);
  if (evtCount.length === 0) {
    const nextSat = new Date();
    nextSat.setDate(nextSat.getDate() + ((6 - nextSat.getDay() + 7) % 7 || 7));
    await db.insert(events).values({
      title: "Saturday Morning Training",
      description: "Open training session for all teams. New players welcome. Loan equipment available.",
      startDate: nextSat.toISOString().split("T")[0],
      location: "Rosalie Park, Shenton Park",
      eventType: "training",
      teamCategory: "all",
      isPublished: true,
    });
  }

  console.log("Seed complete.");
}

seed().catch(console.error);
