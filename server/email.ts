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
//     CLUB_NOTIFY_EMAIL=subiacolacrosseclub@outlook.com
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

// ---------------------------------------------------------------------------
// buildTransporter — creates a nodemailer SMTP connection
// ---------------------------------------------------------------------------
// Design Decision: We recreate the transporter per-request rather than caching
// it globally. This is slightly slower but avoids stale connection issues on
// long-running servers. For a club site with low traffic this is fine.
// ---------------------------------------------------------------------------
function buildTransporter() {
  const user = process.env.CONTACT_EMAIL_USER;
  const pass = process.env.CONTACT_EMAIL_PASS;

  if (!user || !pass) return null; // No credentials → caller handles gracefully

  // Auto-detect SMTP host from the email address — same logic as neaves.au
  let host = "smtp.eu.mailgun.org"; // Default: Mailgun European server
  let port = 587;

  if (user.includes("@gmail.com")) {
    host = "smtp.gmail.com";
    port = 587;
  } else if (user.includes("@outlook.com") || user.includes("@hotmail.com")) {
    host = "smtp-mail.outlook.com";
    port = 587;
  } else if (user.includes("@yahoo.com")) {
    host = "smtp.mail.yahoo.com";
    port = 587;
  }
  // Any other domain (e.g. mail.yourdomain.com.au) → Mailgun European server

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // TLS via STARTTLS on port 587
    auth: { user, pass },
    connectionTimeout: 8000, // 8 seconds — prevents the form hanging forever
    greetingTimeout: 8000,
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
  const transporter = buildTransporter();
  const from = process.env.CONTACT_EMAIL_USER;

  if (!transporter || !from) {
    console.warn(
      "[email] No SMTP credentials set — skipping email. " +
      "Set CONTACT_EMAIL_USER and CONTACT_EMAIL_PASS in .env to enable."
    );
    return false;
  }

  try {
    await transporter.sendMail({ from, ...opts });
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
  const clubEmail = process.env.CLUB_NOTIFY_EMAIL ?? "subiacolacrosseclub@outlook.com";

  return sendEmail({
    to: clubEmail,
    subject: `Contact form: ${data.subject} — from ${data.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#7B1E32">New contact message — Subiaco Lions</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;width:100px">Name</td><td style="padding:6px 0;font-weight:bold">${data.name}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#666">Subject</td><td style="padding:6px 0">${data.subject}</td></tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#f5f5f5;border-radius:8px;white-space:pre-wrap">${data.message}</div>
        <p style="margin-top:20px;color:#888;font-size:12px">
          Reply directly to this email to respond to ${data.name}.<br>
          Message also saved in your <a href="/admin">admin panel → Messages</a>.
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
  const clubEmail = process.env.CLUB_NOTIFY_EMAIL ?? "subiacolacrosseclub@outlook.com";
  const fullName = `${data.firstName} ${data.lastName}`;

  // --- 1. Notify the club ---
  await sendEmail({
    to: clubEmail,
    subject: `New sign-up enquiry: ${fullName}${data.isJunior ? " (Junior)" : ""}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#7B1E32">New sign-up enquiry — Subiaco Lions</h2>
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
        <p style="margin-top:20px">
          <a href="/admin" style="background:#7B1E32;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
            View in Admin Panel →
          </a>
        </p>
        <p style="margin-top:16px;color:#888;font-size:12px">Update their status (Contacted → Registered) in Admin → Sign-Ups.</p>
      </div>
    `,
    text: `New sign-up: ${fullName}\nEmail: ${data.email}\n${data.phone ? `Phone: ${data.phone}\n` : ""}Junior: ${data.isJunior ? "Yes" : "No"}\nExperience: ${data.experienceLevel}\n\n${data.message ?? ""}`,
  });

  // --- 2. Auto-reply to the registrant ---
  // This confirms receipt and sets expectations — same pattern neaves.au uses
  const replyTo = data.isJunior && data.parentEmail ? data.parentEmail : data.email;
  await sendEmail({
    to: replyTo,
    subject: "Thanks for your interest — Subiaco Lions Lacrosse",
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <div style="background:#7B1E32;padding:24px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:#C5942A;margin:0;font-size:24px">Subiaco Lions</h1>
          <p style="color:#f5dde2;margin:4px 0 0">Lacrosse Club</p>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p>Hi ${data.firstName},</p>
          <p>Thanks for your interest in joining the Subiaco Lions Lacrosse Club!</p>
          <p>We've received your enquiry and one of our team will be in touch within <strong>48 hours</strong> with everything you need to get started.</p>
          ${data.isJunior ? `<p>As a junior enquiry, we'll also have info about our <strong>KidSport</strong> subsidy available.</p>` : ""}
          <p>In the meantime, feel free to check out:</p>
          <ul>
            <li>Our <a href="/juniors" style="color:#7B1E32">Juniors page</a> for program info</li>
            <li>Our <a href="/calendar" style="color:#7B1E32">Club Calendar</a> for upcoming training sessions</li>
            <li>Follow us on <a href="https://www.instagram.com/subiacolacrosse_official/" style="color:#7B1E32">Instagram</a> for the latest news</li>
          </ul>
          <p>See you on the field! 🥍</p>
          <p><strong>Subiaco Lions Lacrosse Club</strong><br>
          Rosalie Park, Shenton Park WA<br>
          <a href="mailto:subiacolacrosseclub@outlook.com" style="color:#7B1E32">subiacolacrosseclub@outlook.com</a></p>
        </div>
      </div>
    `,
    text: `Hi ${data.firstName},\n\nThanks for your interest in the Subiaco Lions Lacrosse Club!\n\nWe'll be in touch within 48 hours.\n\nSubiaco Lions Lacrosse Club\nRosalie Park, Shenton Park WA\nsubiacolacrosseclub@outlook.com`,
  });
}
