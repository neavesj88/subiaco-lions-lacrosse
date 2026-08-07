# Selling things on the website

The club shop can work in four ways. Pick the one that suits, in
**Admin → Shop**. You can change your mind at any time.

| Mode | What people see | Money handled by |
|---|---|---|
| **Closed** | The shop page says the shop is closed | — |
| **Enquiries only** | Items listed, "email us to order" | You, however you already do |
| **Link to another shop** | Items listed, buttons go to your existing shop | Your other shop |
| **Take card payments** | A real cart, paid by card on the site | Stripe |

New sites start on **Enquiries only**, so nothing changes until you decide to
set up payments.

---

## Before you start taking card payments

Taking money online makes the club a merchant, with a few real-world
obligations. None are difficult, but they are the club's, not the website's:

- **A Stripe account in the club's name**, with the club's bank account and
  (in Australia) its ABN. Stripe verifies this before paying out.
- **Someone responsible for refunds.** Refunds are issued from the Stripe
  dashboard, not from this website.
- **Stripe's fee** comes out of each payment — currently around 1.7% + 30c for
  Australian cards. Check stripe.com/au/pricing for today's rates.
- **GST**, if the club is registered for it. The website doesn't calculate tax;
  set your prices GST-inclusive and use the "tax note" field to say so.

**Your website never sees anyone's card.** Customers type their card details on
Stripe's own payment page, not yours. This is deliberate: it keeps the club out
of scope for the card industry's security rules, and means that even if the
clubhouse PC were stolen, no one's card details could be on it.

---

## Setting it up

### 1. Create the Stripe account

Sign up at [stripe.com](https://stripe.com) in the club's name and complete
their verification. You can do everything below in **test mode** first,
without finishing verification.

### 2. Copy your secret key in

In Stripe: **Developers → API keys**. Copy the **Secret key**.

In your website: **Admin → Shop → Stripe secret key**, paste, and save.

> Start with the key beginning `sk_test_`. The shop then shows an obvious
> "Test mode" banner and no real money moves. Switch to the `sk_live_` key when
> you're happy.

### 3. Set up the payment confirmation (important)

This is the step people skip, and without it **orders never get marked as paid**
— because the website deliberately refuses to believe a payment happened just
because the customer's browser said so.

In Stripe: **Developers → Webhooks → Add endpoint**.

- **Endpoint URL:** copy it from Admin → Shop (there's a copy button). It looks
  like `https://yourclub.org.au/api/store/webhook`
- **Events to send:** select these three
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
- Save, then click into the endpoint and copy its **Signing secret**
  (starts `whsec_`).

Paste that into **Admin → Shop → Webhook signing secret** and save.

Admin → Shop will now say **"Working in Stripe TEST mode"** or
**"Card payment is live"**. If it says something is missing, it tells you what.

> **Running the site from the clubhouse PC?** This works fine — the Cloudflare
> Tunnel gives you a proper public web address, which is all Stripe needs. You
> do not need a fixed IP or any router changes. See `CLUBHOUSE_SETUP.md`.

### 4. Add what you're selling

**Admin → Shop → Add product.** For each item:

- **Name and price.** A product priced at $0 can't be bought — that's the
  safety catch that stops half-finished items being sold by accident.
- **Photo**, chosen from your existing photo library.
- **Sizes.** Every product needs at least one. If it doesn't come in sizes,
  leave the single "One size" row alone.
- **In stock.** A number counts down as things sell, and the size shows as
  sold out at zero. **Leave it blank** for made-to-order items that never run
  out.
- **Price override** on a size, only if that size costs more (e.g. XXL).

Untick **Show in the shop** to hide something without deleting it.

### 5. Choose how people get their order

Under Admin → Shop:

- **Collection at the club** — they pick it up at training. Free.
- **Postage** — a flat rate you set, with an optional "free over $X".

At least one must be on, or nobody can check out.

### 6. Do a test purchase

With a `sk_test_` key, buy something using Stripe's test card:

```
Card number  4242 4242 4242 4242
Expiry       any future date
CVC          any 3 digits
```

Then check that:

1. **Admin → Orders** shows the order as **Paid**
2. The stock for that size went down by one
3. The club received an order email, and so did the "customer"

If the order stays on **Pending**, the webhook (step 3) isn't working. In
Stripe, open **Developers → Webhooks**, click your endpoint, and look at recent
deliveries — it will show you exactly what went wrong.

### 7. Go live

Swap both values for the live ones: the `sk_live_` secret key, and the signing
secret from a webhook endpoint created while Stripe is in live mode. (Test and
live mode have **separate** webhook endpoints and separate signing secrets —
this catches everyone out once.)

---

## Running the shop day to day

**Admin → Orders** is the working list.

- **Paid** — money received, needs handing over or posting
- **Mark as handed over** once you've given it to them (it becomes *Fulfilled*)
- **Pending** — someone started paying and didn't finish. Nothing was charged.
  These tidy themselves up when Stripe reports the attempt as expired.
- **Refunded** — appears automatically after you refund someone in Stripe

Each order shows the sizes ordered, whether it's collection or post, the
delivery address, and any note the customer left.

**Refunds** are done in the Stripe dashboard. The website updates itself when
Stripe confirms it — you don't need to change anything here.

**Payouts** go to the club's bank account on Stripe's schedule (typically a few
days). The website has no access to the club's money at any point.

---

## Stopping everything in a hurry

**Admin → Security → Emergency stops** has two switches:

- **Outgoing email** — stops every email the site sends
- **Card payments** — stops anyone being charged

Both take effect immediately, and neither loses any settings, so switching back
on restores exactly what was there before. With payments off the shop still
lists everything; only the checkout is refused. With email off, orders and
messages are still saved — you just read them in the admin panel.

Use them if you spot a pricing mistake, a flood of spam sign-ups, or anything
you don't understand yet. Stop first, work it out afterwards.

**They only stop NEW activity.** To refund a payment already taken, or to halt
payouts entirely, use the club's Stripe dashboard.

---

## Keeping stock straight

**Admin → Stock** is one screen listing every size, so counting up after a
delivery doesn't mean opening each product.

- **+ / −** after selling something at the clubhouse
- Or type the real number in after a count
- Anything sold out or low is listed at the top
- **Warn me at or below** sets when something counts as "low"

Online sales reduce stock by themselves — you only adjust it here for sales
made in person.

**Tracking stock is optional.** Leave a box empty and that size is treated as
made to order: it never sells out and never appears in the restock list. A club
that orders everything in on demand can leave every box empty and ignore this
screen completely.

To take a size off sale without deleting it, use the **Sell it** switch beside
it. To take a whole item off sale but leave it on display, tick **Sold out** in
the product editor — better than hiding it, because members can still see it's
something you normally stock.

---

## Common questions

**Can two people buy the last one?**
Stock is only reduced once a payment is actually confirmed, so in theory two
people could pay for the last jersey seconds apart. In practice this is rare at
club volumes, and the alternative — holding stock for anyone who opens a
checkout page — means abandoned carts quietly make sizes unbuyable. If it
happens, refund one of them in Stripe.

**Someone says the price was wrong.**
The price charged always comes from what's in Admin → Shop at that moment, never
from the customer's browser. The order record keeps its own copy of the name,
size and price as they were at the time, so old orders stay accurate even after
you change a price.

**Do I need an SSL certificate?**
No. Cloudflare provides HTTPS automatically.

**Can I sell memberships or event tickets?**
Yes — add them as products and turn **Needs posting** off, so nobody is asked
for a delivery address.

**What if I want to stop selling for a while?**
Set the mode to **Enquiries only** or **Closed**. Your products stay exactly as
they are, ready for next season.
