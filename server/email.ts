// =============================================================================
// EMAIL SERVICE — server/email.ts
// =============================================================================
// What this file does:
//   Sends email notifications via SMTP (Mailgun recommended, same as neaves.au).
//   Used in two places:
//     1. Contact form → notifies the club that someone got in touch
//     2. Sign-up form → notifies the club + sends confirmation to the registrant
//
// How to configure:
//   Copy .env.example to .env and fill in:
//     CONTACT_EMAIL_USER=contact@mail.yourdomain.com.au
//     CONTACT_EMAIL_PASS=your_mailgun_smtp_password
//     CLUB_NOTIFY_EMAIL=committee@yourclub.org.au
//
//   If these vars are missing, emails are silently skipped and a warning is
//   printed — the form submissions still save to the database, nothing is lost.
//
// Mailgun setup (same as neaves.au — cheapest option, free tier is fine):
//   1. Sign up at mailgun.com
//   2. Add your domain and verify it (follow their DNS guide)
//   3. SMTP settings → European server: smtp.eu.mailgun.org port 587
//   4. Username: the full sending email address
//   5. Password: the SMTP password from the Mailgun dashboard
//
// Fallback behaviour:
//   If no SMTP credentials are set, email is skipped but the form data is still
//   saved to the database. Admins can check the admin panel manually.
// =============================================================================

import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { getSiteText } from "./site-settings";
import { siteSettings } from "@shared/schema";

// ---------------------------------------------------------------------------
// getMailConfig — where the email settings come from
// ---------------------------------------------------------------------------
// Two sources, database first:
//   1. Admin → Settings → Email (stored in site_settings) — so the club can
//      change providers themselves without SSH-ing into the server.
//   2. The .env file — the original method, still used as a fallback.
//
// Also reads the kill-switch (Admin → Security → "Email sending"), which lets
// a super admin stop all outgoing email instantly, e.g. if an address starts
// bouncing or the club is being spammed.
// ---------------------------------------------------------------------------
async function getMailConfig() {
  let dbSettings: Record<string, string> = {};
  try {
    const rows = await db.select().from(siteSettings);
    for (const r of rows) dbSettings[r.key] = r.value;
  } catch {
    // DB unavailable — fall back to .env entirely
  }

  const pick = (dbKey: string, envKey?: string) =>
    (dbSettings[dbKey]?.trim() || (envKey ? process.env[envKey]?.trim() : "") || "");

  return {
    // Kill-switch: only "false" disables it, so email works by default.
    enabled: dbSettings.mail_enabled !== "false",
    host: pick("mail_host"),
    port: parseInt(pick("mail_port") || "587", 10),
    user: pick("mail_user", "CONTACT_EMAIL_USER"),
    pass: pick("mail_pass", "CONTACT_EMAIL_PASS"),
    from: pick("mail_from") || pick("mail_user", "CONTACT_EMAIL_USER"),
    notify: pick("mail_notify", "CLUB_NOTIFY_EMAIL") || getSiteText()("contact_email"),
  };
}

// ---------------------------------------------------------------------------
// emailBrand — the club's identity and colours for use in email templates
// ---------------------------------------------------------------------------
// Every string a member reads in an email comes from the club's own settings,
// so a club that renames itself (or a different club reusing this site) never
// has to touch these templates. Blank values simply drop the line they're on.
// ---------------------------------------------------------------------------
function emailBrand() {
  const t = getSiteText();
  return {
    t,
    clubName: t("club_name"),
    clubFullName: t.clubFullName,
    suffix: t("club_name_suffix"),
    email: t("contact_email"),
    venueLine: [t("venue_name"), t("venue_address")].filter(Boolean).join(", "),
    instagram: t("instagram_handle"),
    primary: t("theme_primary") || "#7B1E32",
    accent: t("theme_accent") || "#C5942A",
  };
}

// ---------------------------------------------------------------------------
// buildTransporter — creates a nodemailer SMTP connection
// ---------------------------------------------------------------------------
// Design Decision: We recreate the transporter per-request rather than caching
// it globally. This is slightly slower but avoids stale connection issues on
// long-running servers. For a club site with low traffic this is fine.
// ---------------------------------------------------------------------------
function buildTransporter(cfg: { host: string; port: number; user: string; pass: string }) {
  if (!cfg.user || !cfg.pass) return null; // No credentials → caller handles gracefully

  // If the admin didn't specify a host, auto-detect it from the email address
  // — same logic as neaves.au, so most clubs never need to think about it.
  let host = cfg.host;
  let port = cfg.port;

  if (!host) {
    host = "smtp.eu.mailgun.org"; // Default: Mailgun European server
    if (cfg.user.includes("@gmail.com")) host = "smtp.gmail.com";
    else if (cfg.user.includes("@outlook.com") || cfg.user.includes("@hotmail.com")) host = "smtp-mail.outlook.com";
    else if (cfg.user.includes("@yahoo.com")) host = "smtp.mail.yahoo.com";
  }

  return nodemailer.createTransport({
    host,
    port: port || 587,
    secure: (port || 587) === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 8000, // 8 seconds — prevents the form hanging forever
    greetingTimeout: 8000,
  });
}

// Exposed so the Security tab's "Send test email" button can verify the
// settings actually work. Throws on failure so the UI can show the reason.
export async function sendTestEmail(to: string): Promise<void> {
  const cfg = await getMailConfig();
  if (!cfg.enabled) throw new Error("Email sending is switched OFF in Admin → Security.");
  const transporter = buildTransporter(cfg);
  if (!transporter) throw new Error("No email credentials configured (Admin → Settings → Email).");

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject: `Test email — ${emailBrand().clubName} website`,
    text: "This is a test email from your club website. If you're reading this, email is working correctly.",
    html: `<div style="font-family:sans-serif">
      <h2 style="color:${emailBrand().primary}">Email is working ✓</h2>
      <p>This is a test message from your club website. If you're reading this,
      your email settings are correct and the site can send notifications.</p>
    </div>`,
  });
}

// ---------------------------------------------------------------------------
// sendEmail — generic internal helper
// ---------------------------------------------------------------------------
// Returns true if sent, false if skipped or failed.
// Never throws — email failure should never crash the server or lose form data.
// ---------------------------------------------------------------------------
async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const cfg = await getMailConfig();

  // Kill-switch (Admin → Security). Form data is still saved to the DB.
  if (!cfg.enabled) {
    console.warn("[email] Sending is switched OFF in Admin → Security — skipping.");
    return false;
  }

  const transporter = buildTransporter(cfg);
  if (!transporter || !cfg.from) {
    console.warn(
      "[email] No SMTP credentials set — skipping email. " +
      "Configure them in Admin → Settings → Email, or in .env."
    );
    return false;
  }

  try {
    await transporter.sendMail({ from: cfg.from, ...opts });
    console.log(`[email] Sent → ${opts.to}: ${opts.subject}`);
    return true;
  } catch (err: any) {
    // Log the error but don't throw — form data is already saved to DB
    console.error("[email] Failed to send:", err.message ?? err);
    return false;
  }
}

// =============================================================================
// PUBLIC FUNCTIONS — called from server/routes.ts
// =============================================================================

// ---------------------------------------------------------------------------
// notifyContactMessage
// ---------------------------------------------------------------------------
// Called when someone submits the Contact page form.
// Sends one email to the club: who wrote, their email, subject, and message.
// Admin can reply directly from their email client.
// ---------------------------------------------------------------------------
export async function notifyContactMessage(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const clubEmail = (await getMailConfig()).notify;

  return sendEmail({
    to: clubEmail,
    subject: `Contact form: ${data.subject} — from ${data.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:${emailBrand().primary}">New contact message — ${emailBrand().clubName}</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;width:100px">Name</td><td style="padding:6px 0;font-weight:bold">${data.name}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#666">Subject</td><td style="padding:6px 0">${data.subject}</td></tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#f5f5f5;border-radius:8px;white-space:pre-wrap">${data.message}</div>
        <p style="margin-top:20px;color:#888;font-size:12px">
          Reply directly to this email to respond to ${data.name}.<br>
          This message is also saved in your admin panel under Messages.
        </p>
      </div>
    `,
    text: `New contact message from ${data.name} <${data.email}>\n\nSubject: ${data.subject}\n\n${data.message}`,
  });
}

// ---------------------------------------------------------------------------
// notifyNewRegistration
// ---------------------------------------------------------------------------
// Called when someone submits the Sign Up / Expression of Interest form.
// Sends TWO emails:
//   1. To the club: full details of the new enquiry so you can follow up
//   2. To the registrant: a friendly confirmation so they know we got it
// ---------------------------------------------------------------------------
export async function notifyNewRegistration(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  isJunior: boolean;
  parentName?: string | null;
  parentEmail?: string | null;
  teamPreference?: string | null;
  experienceLevel: string;
  kidsportEligible: boolean;
  howHeard?: string | null;
  message?: string | null;
}) {
  const clubEmail = (await getMailConfig()).notify;
  const brand = emailBrand();
  const fullName = `${data.firstName} ${data.lastName}`;

  // --- 1. Notify the club ---
  await sendEmail({
    to: clubEmail,
    subject: `New sign-up enquiry: ${fullName}${data.isJunior ? " (Junior)" : ""}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:${emailBrand().primary}">New sign-up enquiry — ${emailBrand().clubName}</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;width:160px">Name</td><td style="padding:6px 0;font-weight:bold">${fullName}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          ${data.phone ? `<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${data.phone}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#666">Junior?</td><td style="padding:6px 0">${data.isJunior ? "Yes" : "No"}</td></tr>
          ${data.parentName ? `<tr><td style="padding:6px 0;color:#666">Parent/Guardian</td><td style="padding:6px 0">${data.parentName}${data.parentEmail ? ` &lt;${data.parentEmail}&gt;` : ""}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#666">Team preference</td><td style="padding:6px 0;text-transform:capitalize">${data.teamPreference ?? "Not specified"}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Experience</td><td style="padding:6px 0;text-transform:capitalize">${data.experienceLevel}</td></tr>
          ${data.kidsportEligible ? `<tr><td style="padding:6px 0;color:#666">KidSport</td><td style="padding:6px 0;color:#16a34a;font-weight:bold">Requested info</td></tr>` : ""}
          ${data.howHeard ? `<tr><td style="padding:6px 0;color:#666">How they heard</td><td style="padding:6px 0">${data.howHeard}</td></tr>` : ""}
        </table>
        ${data.message ? `<div style="margin-top:16px;padding:16px;background:#f5f5f5;border-radius:8px"><strong>Their message:</strong><br><br>${data.message}</div>` : ""}
        <p style="margin-top:16px;color:#888;font-size:12px">Log in to your admin panel to update their status (Contacted → Registered) under Sign-Ups.</p>
      </div>
    `,
    text: `New sign-up: ${fullName}\nEmail: ${data.email}\n${data.phone ? `Phone: ${data.phone}\n` : ""}Junior: ${data.isJunior ? "Yes" : "No"}\nExperience: ${data.experienceLevel}\n\n${data.message ?? ""}`,
  });

  // --- 2. Auto-reply to the registrant ---
  // This confirms receipt and sets expectations — same pattern neaves.au uses
  const replyTo = data.isJunior && data.parentEmail ? data.parentEmail : data.email;
  await sendEmail({
    to: replyTo,
    subject: `Thanks for your interest — ${brand.clubFullName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <div style="background:${brand.primary};padding:24px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:${brand.accent};margin:0;font-size:24px">${brand.clubName}</h1>
          ${brand.suffix ? `<p style="color:#f0e6e8;margin:4px 0 0">${brand.suffix}</p>` : ""}
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p>Hi ${data.firstName},</p>
          <p>Thanks for your interest in joining ${brand.clubFullName}!</p>
          <p>We've received your enquiry and one of our team will be in touch within <strong>48 hours</strong> with everything you need to get started.</p>
          ${data.isJunior ? `<p>As a junior enquiry, we'll also have info about our <strong>KidSport</strong> subsidy available.</p>` : ""}
          <p>In the meantime, feel free to check out:</p>
          <ul>
            <li>Our <a href="/juniors" style="color:${brand.primary}">Juniors page</a> for program info</li>
            <li>Our <a href="/calendar" style="color:${brand.primary}">Club Calendar</a> for upcoming training sessions</li>
            ${brand.instagram ? `<li>Follow us on <a href="https://www.instagram.com/${brand.instagram}/" style="color:${brand.primary}">Instagram</a> for the latest news</li>` : ""}
          </ul>
          <p>See you at training!</p>
          <p><strong>${brand.clubFullName}</strong><br>
          ${brand.venueLine ? `${brand.venueLine}<br>` : ""}
          ${brand.email ? `<a href="mailto:${brand.email}" style="color:${brand.primary}">${brand.email}</a>` : ""}</p>
        </div>
      </div>
    `,
    text: `Hi ${data.firstName},

Thanks for your interest in ${brand.clubFullName}!

We'll be in touch within 48 hours.

${brand.clubFullName}
${brand.venueLine}
${brand.email}`,
  });
}
