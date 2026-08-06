// =============================================================================
// TAKING PAYMENTS — server/payments.ts
// =============================================================================
// Everything to do with charging a customer lives behind this one file, so the
// rest of the site never has to know which payment company the club uses.
// Stripe is what's built in today; adding another later means adding one object
// here and nothing else.
//
// THE TWO RULES THAT MATTER
//
//   1. Card numbers never come anywhere near this website.
//      We don't show card fields. We ask Stripe for a checkout page, send the
//      customer there, and they type their card into Stripe's own site. That
//      is what keeps the club out of scope for the card-industry security
//      rules (PCI DSS) — a club cannot realistically comply with those, so the
//      only safe design is never to handle the card at all.
//
//   2. The price is decided HERE, never by the browser.
//      The shopping cart lives in the customer's browser, so anything it sends
//      can be edited by anyone. Prices are always looked up fresh from the
//      database (see server/store.ts) and the total is recalculated before a
//      payment is created. Otherwise someone could simply tell the site the
//      jersey costs 1 cent — the single most common way online shops get
//      robbed.
//
// HOW WE KNOW A PAYMENT REALLY HAPPENED
//   Not because the browser came back saying so — anyone can visit the
//   "thanks for your order" page. Stripe sends the site a separate,
//   cryptographically signed message (a "webhook") confirming the payment.
//   Only that marks an order as paid.
// =============================================================================

import Stripe from "stripe";
import { getSettingsSync } from "./site-settings";

// ── What the rest of the site passes in ─────────────────────────────────────

export interface CheckoutLine {
  name: string;            // "Club Playing Jersey — Medium"
  unitPriceCents: number;  // whole cents, already verified against the database
  quantity: number;
}

export interface CheckoutRequest {
  reference: string;       // our own order reference, e.g. "SLC-4F2A9C"
  currency: string;        // "AUD"
  lines: CheckoutLine[];
  shippingCents: number;   // 0 for pickup
  shippingLabel: string;   // what to call it on the payment page
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

/** A payment event, reduced to only what this site cares about. */
export interface PaymentEvent {
  kind: "paid" | "expired" | "refunded" | "ignored";
  paymentRef?: string;      // the checkout session id we stored on the order
  paymentIntent?: string;   // used later if the club issues a refund
  amountTotalCents?: number;
  customerEmail?: string;
  customerName?: string;
  shippingAddress?: string;
}

// ── Configuration (admin panel first, .env as a fallback) ────────────────────
// Same approach as email: a club should be able to paste their keys into the
// admin panel without editing files on the server or restarting anything.

export interface StoreConfig {
  mode: "off" | "enquiry" | "external" | "checkout";
  currency: string;
  currencySymbol: string;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

export function getStoreConfig(): StoreConfig {
  const s = getSettingsSync();
  const pick = (key: string, envKey?: string) =>
    (s[key]?.trim() || (envKey ? process.env[envKey]?.trim() : "") || "");

  const mode = (s.store_mode?.trim() || "enquiry") as StoreConfig["mode"];
  return {
    mode,
    currency: (s.store_currency?.trim() || "AUD").toUpperCase(),
    currencySymbol: s.store_currency_symbol?.trim() || "$",
    secretKey: pick("stripe_secret_key", "STRIPE_SECRET_KEY"),
    publishableKey: pick("stripe_publishable_key", "STRIPE_PUBLISHABLE_KEY"),
    webhookSecret: pick("stripe_webhook_secret", "STRIPE_WEBHOOK_SECRET"),
  };
}

/**
 * Can the site actually charge a card right now?
 *
 * Card payment needs BOTH a secret key (to create the payment) and a webhook
 * secret (to trust the confirmation). Without the webhook secret we could never
 * safely know an order was paid, so we treat that as "not set up" rather than
 * limping along in a state where orders silently never complete.
 */
export function canTakePayments(cfg = getStoreConfig()): boolean {
  return cfg.mode === "checkout" && !!cfg.secretKey && !!cfg.webhookSecret;
}

/** A one-line explanation for the admin panel of what's still missing. */
export function paymentSetupStatus(cfg = getStoreConfig()): string {
  if (cfg.mode !== "checkout") return "Card payment is switched off for this store.";
  if (!cfg.secretKey) return "Add your Stripe secret key to take payments.";
  if (!cfg.webhookSecret) return "Add your Stripe webhook signing secret — without it, paid orders can never be confirmed.";
  if (cfg.secretKey.startsWith("sk_test_")) return "Working in Stripe TEST mode — no real money will change hands.";
  return "Card payment is live.";
}

/** True when the club is still using Stripe's test keys. */
export function isTestMode(cfg = getStoreConfig()): boolean {
  return cfg.secretKey.startsWith("sk_test_");
}

// ── Stripe ───────────────────────────────────────────────────────────────────

function stripeClient(cfg: StoreConfig): Stripe {
  if (!cfg.secretKey) throw new Error("No Stripe secret key configured.");
  // Deliberately not pinning apiVersion: the installed library and the account
  // agree on a default, and pinning a version this code was never tested
  // against is how integrations quietly break years later.
  return new Stripe(cfg.secretKey);
}

/**
 * Create a hosted payment page and return the URL to send the customer to.
 * The amounts passed in must already have been verified against the database.
 */
export async function createCheckout(req: CheckoutRequest): Promise<{ url: string; paymentRef: string }> {
  const cfg = getStoreConfig();
  const stripe = stripeClient(cfg);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = req.lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: req.currency.toLowerCase(),
      unit_amount: line.unitPriceCents,
      product_data: { name: line.name },
    },
  }));

  // Postage is charged as just another line, which keeps the total on Stripe's
  // page identical to the total we showed in the cart.
  if (req.shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: req.currency.toLowerCase(),
        unit_amount: req.shippingCents,
        product_data: { name: req.shippingLabel },
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
    // Our own order reference travels with the payment, so the confirmation
    // that comes back can be matched to the right order.
    client_reference_id: req.reference,
    metadata: { order_reference: req.reference },
    ...(req.customerEmail ? { customer_email: req.customerEmail } : {}),
  });

  if (!session.url) throw new Error("Stripe did not return a payment page URL.");
  return { url: session.url, paymentRef: session.id };
}

/**
 * Check that a webhook really came from Stripe, and reduce it to a
 * PaymentEvent the rest of the site understands.
 *
 * `rawBody` must be the EXACT bytes Stripe sent. If the JSON has been parsed
 * and re-serialised anywhere along the way, the signature will not match and
 * this will (correctly) reject it.
 */
export async function verifyWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent> {
  const cfg = getStoreConfig();
  if (!cfg.webhookSecret) throw new Error("No webhook signing secret configured.");

  const stripe = stripeClient(cfg);
  // Throws if the signature is wrong or the message is too old to trust.
  const event = await stripe.webhooks.constructEventAsync(rawBody, signature, cfg.webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // A session can complete while the payment is still processing (some bank
      // transfers). Only "paid" means the money is actually there.
      if (session.payment_status !== "paid") return { kind: "ignored" };
      return {
        kind: "paid",
        paymentRef: session.id,
        paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        amountTotalCents: session.amount_total ?? undefined,
        customerEmail: session.customer_details?.email ?? session.customer_email ?? undefined,
        customerName: session.customer_details?.name ?? undefined,
        shippingAddress: formatAddress(session.customer_details?.address),
      };
    }

    // The customer abandoned the payment page. Lets us tidy up the pending
    // order rather than leaving it hanging around forever.
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      return { kind: "expired", paymentRef: session.id };
    }

    // The club refunded someone from their Stripe dashboard — reflect that in
    // the site so the orders list doesn't disagree with reality.
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      return {
        kind: "refunded",
        paymentIntent: typeof charge.payment_intent === "string" ? charge.payment_intent : undefined,
      };
    }

    default:
      return { kind: "ignored" };
  }
}

function formatAddress(address: Stripe.Address | null | undefined): string | undefined {
  if (!address) return undefined;
  return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter(Boolean)
    .join(", ") || undefined;
}

/** Turn 2450 into "$24.50" for display. */
export function formatMoney(cents: number, symbol = "$"): string {
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
