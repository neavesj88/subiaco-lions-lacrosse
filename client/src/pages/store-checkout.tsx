// =============================================================================
// CHECKOUT — client/src/pages/store-checkout.tsx
// =============================================================================
// Collects who the order is for and how they want it, then hands over to the
// payment provider's own page.
//
// There is deliberately NO card field anywhere on this page, and there never
// should be. The customer types their card on Stripe's site, not the club's.
// That is what keeps the club out of scope for card-security rules, and means
// a break-in on the clubhouse PC could never expose anyone's card.
// =============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ShoppingCart, AlertCircle } from "lucide-react";
import { useSiteText } from "@/hooks/use-site-text";
import { useCart, formatMoney } from "@/hooks/use-cart";

interface StoreConfig {
  mode: string;
  currencySymbol: string;
  canPay: boolean;
  testMode: boolean;
  pickupEnabled: boolean;
  shippingEnabled: boolean;
  shippingCents: number;
  freeShippingOverCents: number;
  taxNote: string;
  terms: string;
}

export default function StoreCheckout() {
  const t = useSiteText();
  const cart = useCart();
  const [, navigate] = useLocation();

  const { data: config } = useQuery<StoreConfig>({
    queryKey: ["/api/store/config"],
    queryFn: () => apiRequest("GET", "/api/store/config"),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"pickup" | "shipping">("pickup");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const symbol = config?.currencySymbol ?? "$";

  // Shown so the total matches what they'll see on the payment page. The
  // server works this out again independently — this is display only.
  const freeOver = config?.freeShippingOverCents ?? 0;
  const shippingCents =
    method === "shipping" && config?.shippingEnabled
      ? (freeOver > 0 && cart.subtotalCents >= freeOver ? 0 : config.shippingCents)
      : 0;
  const totalCents = cart.subtotalCents + shippingCents;

  async function pay() {
    setError("");
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/store/checkout", {
        cart: cart.lines.map((l) => ({
          productId: l.productId, variantId: l.variantId, quantity: l.quantity,
        })),
        customer: { name, email, phone, address },
        fulfilmentMethod: method,
        notes,
      });
      if (res?.url) {
        // Leave the cart intact: if they abandon the payment page and come
        // back, their order is still there rather than silently emptied.
        window.location.href = res.url;
      } else {
        setError("Couldn't start the payment. Please try again.");
        setBusy(false);
      }
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <ShoppingCart className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500 mb-6">{t("store_cart_empty")}</p>
          <Link href="/store"><Button>{t("store_cart_continue")}</Button></Link>
        </div>
      </div>
    );
  }

  if (config && !config.canPay) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <p className="text-stone-600 mb-6">
            Online payment isn't switched on at the moment. Please contact the club to order.
          </p>
          <Link href="/store"><Button variant="outline">Back to the shop</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="hero-gradient text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">{t("store_checkout_title")}</h1>
          <p className="text-maroon-100">{t("store_checkout_subtitle")}</p>
        </div>
      </section>

      {config?.testMode && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-3 text-center">
          <p className="text-amber-900 text-sm font-medium">
            Test mode — no real payment will be taken.
          </p>
        </div>
      )}

      <section className="py-10 px-4">
        <div className="max-w-4xl mx-auto grid lg:grid-cols-5 gap-8">
          {/* Details */}
          <div className="lg:col-span-3 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>

            {/* How they want it */}
            <div className="space-y-2">
              <Label>How would you like it?</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                {config?.pickupEnabled && (
                  <button type="button" onClick={() => setMethod("pickup")}
                    className={`text-left border rounded-xl p-4 transition-colors ${
                      method === "pickup" ? "border-maroon-600 bg-maroon-50" : "border-stone-200 hover:border-stone-300"
                    }`}>
                    <p className="font-medium text-sm text-stone-900">{t("store_pickup_option")}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{t("store_pickup_note")}</p>
                    <p className="text-xs font-medium text-green-700 mt-1">Free</p>
                  </button>
                )}
                {config?.shippingEnabled && (
                  <button type="button" onClick={() => setMethod("shipping")}
                    className={`text-left border rounded-xl p-4 transition-colors ${
                      method === "shipping" ? "border-maroon-600 bg-maroon-50" : "border-stone-200 hover:border-stone-300"
                    }`}>
                    <p className="font-medium text-sm text-stone-900">{t("store_shipping_option")}</p>
                    <p className="text-xs text-stone-500 mt-0.5">Posted to your address</p>
                    <p className="text-xs font-medium text-stone-700 mt-1">
                      {freeOver > 0 && cart.subtotalCents >= freeOver
                        ? "Free"
                        : formatMoney(config.shippingCents, symbol)}
                    </p>
                  </button>
                )}
              </div>
            </div>

            {method === "shipping" && (
              <div className="space-y-1.5">
                <Label htmlFor="address">Postal address *</Label>
                <Textarea id="address" rows={3} value={address}
                  onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes">Anything we should know? (optional)</Label>
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-2">
            <Card className="sticky top-24">
              <CardContent className="pt-6 space-y-3">
                <h2 className="font-semibold text-stone-900">{t("store_cart_title")}</h2>

                {cart.lines.map((l) => (
                  <div key={l.variantId} className="flex justify-between gap-3 text-sm">
                    <span className="text-stone-600">
                      {l.quantity} × {l.productName}
                      {l.variantLabel && l.variantLabel !== "One size" && (
                        <span className="text-stone-400"> ({l.variantLabel})</span>
                      )}
                    </span>
                    <span className="shrink-0">{formatMoney(l.unitPriceCents * l.quantity, symbol)}</span>
                  </div>
                ))}

                <div className="border-t pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>{t("store_subtotal")}</span><span>{formatMoney(cart.subtotalCents, symbol)}</span>
                  </div>
                  {method === "shipping" && (
                    <div className="flex justify-between text-stone-600">
                      <span>{t("store_shipping_line")}</span><span>{formatMoney(shippingCents, symbol)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-stone-900 text-base pt-1">
                    <span>{t("store_total")}</span><span>{formatMoney(totalCents, symbol)}</span>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>
                )}

                <Button className="w-full gap-2" size="lg" disabled={busy} onClick={pay}>
                  <Lock className="h-4 w-4" />
                  {busy ? "Taking you to payment…" : `${t("store_pay_button")} · ${formatMoney(totalCents, symbol)}`}
                </Button>

                <p className="text-xs text-stone-400 text-center leading-relaxed">{t("store_secure_note")}</p>
                {config?.taxNote && <p className="text-xs text-stone-400 text-center">{config.taxNote}</p>}
                {config?.terms && <p className="text-xs text-stone-400 text-center">{config.terms}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
