// Reads .env first, so SEED_ADMIN_PASSWORD and DATABASE_URL are honoured here
// exactly as they are by the server (runtime-config and db read them on import).
import "dotenv/config";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { db } from "./db";
import { users, juniorsContent, siteSettings, announcements, events } from "@shared/schema";
import { eq } from "drizzle-orm";
import { SEED_ADMIN_PASSWORD } from "./runtime-config";

async function seed() {
  console.log("Seeding database...");

  // Default super admin — but only on a brand-new database with NO accounts.
  //
  // Checking for "a user called admin" instead (as this once did) was a trap:
  // the Docker setup runs this script on every start, so a club that sensibly
  // deleted the installer's "admin" account got it silently re-created, with
  // the starting password, at the next restart.
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length === 0) {
    const password = SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({
      username: "admin",
      passwordHash,
      name: "Club Administrator",
      email: "",
      role: "super_admin",
    });
    console.log("");
    console.log("  ┌─────────────────────────────────────────────────────────┐");
    console.log("  │  Admin account created. Write this down now:            │");
    console.log(`  │    username: admin`.padEnd(60) + "│");
    console.log(`  │    password: ${password}`.padEnd(60) + "│");
    console.log("  │  Change it once you're logged in.                        │");
    console.log("  └─────────────────────────────────────────────────────────┘");
    console.log("");
  }

  // Default site settings.
  //
  // These are deliberately BLANK. Each one points at a specific club's own
  // account on a third-party service (Instagram, Facebook, GameDay, Google
  // Calendar), so there is no sensible shared default — every club fills these
  // in during the setup wizard or in Admin -> Settings. Anything left blank
  // simply hides the feature it powers rather than showing a broken link.
  //
  // Existing installs are never touched: the loop below only inserts a key that
  // is missing, so a club that has already configured these keeps its values.
  const defaultSettings = [
    { key: "instagram_handle", value: "" },
    { key: "behold_feed_id", value: "" },
    { key: "facebook_url", value: "" },
    { key: "contact_email", value: "" },
    { key: "location", value: "" },
    { key: "gameday_registration_url", value: "" },
    { key: "gameday_url", value: "" },
    { key: "lacrossewa_fixtures_url", value: "" },
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
      title: "Juniors",
      content: "Introducing the next generation. We offer programs for boys and girls in a fun, safe and inclusive environment. Edit this in Admin → Juniors.",
    },
    {
      section: "programs",
      title: "Our Programs",
      content: JSON.stringify([
        { age: "U11", description: "Modified rules to focus on fun and skill development. A perfect introduction to the game." },
        { age: "U13", description: "Building core skills with more structured competition." },
        { age: "U15", description: "Competitive play with a focus on teamwork and game strategy." },
        { age: "U17", description: "High-level junior competition preparing players for senior teams." },
      ]),
    },
    {
      section: "kidsport",
      title: "KidSport",
      content: "If your club is a registered KidSport provider, describe it here. KidSport is a WA Government initiative providing eligible children with up to $200 per year towards club registration fees. Edit or delete this in Admin → Juniors.",
    },
    {
      section: "equipment",
      title: "What to Bring",
      content: "New players don't need to buy equipment straight away. List what the club can lend here. Just bring runners, a water bottle, and plenty of enthusiasm!",
    },
    {
      section: "contact",
      title: "Junior Coordinator",
      content: "For all junior enquiries, get in touch and our Juniors Coordinator will get back to you within 48 hours. Add your contact email in Admin → Settings.",
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
      title: "Welcome to your new club website!",
      content: "This is a sample news post so the home page isn't empty. Edit or delete it in Admin → News, then write your own — season launches, results, working bees, anything your members should see.",
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
      location: "",
      eventType: "training",
      teamCategory: "all",
      isPublished: true,
    });
  }

  console.log("Seed complete.");
}

// A failure must be visible to whatever ran this (installer, Docker, a person),
// not printed and then reported as success.
seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
