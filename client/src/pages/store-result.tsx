// =============================================================================
// AFTER PAYMENT — client/src/pages/store-result.tsx
// =============================================================================
// The two pages Stripe sends people back to.
//
// Note what the "thank you" page does NOT do: it does not mark anything as
// paid. Anyone can type this URL in. The order only becomes paid when Stripe
// tells the SERVER so, over a signed webhook. This page just looks up what the
// server already believes and reports it.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useSiteText } from "@/hooks/use-site-text";
import { useCart, formatMoney, PENDING_ORDER_KEY } from "@/hooks/use-cart";

interface OrderSummary {
  reference: string;
  status: string;
  totalCents: number;
  fulfilmentMethod: string;
  items: Array<{ productName: string; variantLabel?: string | null; quantity: number; unitPriceCents: number }>;
}

function useReference(): string {
  const [ref] = useState(() => new URLSearchParams(window.location.search).get("ref") ?? "");
  return ref;
}

export function StoreThankYou() {
  const t = useSiteText();
  const reference = useReference();
  const cart = useCart();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [checking, setChecking] = useState(true);
  const { data: shop } = useQuery<{ currencySymbol?: string }>({
    queryKey: ["/api/store/config"],
    queryFn: () => apiRequest("GET", "/api/store/config"),
  });
  const symbol = shop?.currencySymbol || "$";

  // Empty the cart only once the payment is CONFIRMED. Anyone can open this
  // page's address; it used to empty the cart (and say "payment received")
  // whether or not anything had been paid.
  const confirmedNow = order?.status === "paid" || order?.status === "fulfilled";
  useEffect(() => {
    if (confirmedNow) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedNow]);

  useEffect(() => {
    if (!reference) { setChecking(false); return; }
    let attempts = 0;
    let cancelled = false;

    // The confirmation webhook usually lands within a second or two, but it
    // races the customer's browser coming back here, and Stripe retries a
    // late one. Check quickly at first, then more slowly for a few minutes,
    // and again whenever they come back to this tab, so the page (and the
    // cart) catch up even with a slow confirmation.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const data = await apiRequest("GET", `/api/store/order/${encodeURIComponent(reference)}`);
        if (cancelled) return;
        setOrder(data);
        if (data.status === "paid" || data.status === "fulfilled") { setChecking(false); return; }
      } catch { /* try again below */ }
      attempts++;
      if (attempts >= 6) setChecking(false);          // stop the spinner; keep checking
      if (attempts < 40) timer = setTimeout(poll, attempts < 6 ? 1500 : 5000);
    };
    poll();
    const onFocus = () => { if (!cancelled) poll(); };
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("focus", onFocus); };
  }, [reference]);

  const confirmed = confirmedNow;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 pb-8 text-center">
          {confirmed ? (
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          ) : (
            <Clock className="h-14 w-14 text-amber-400 mx-auto mb-4" />
          )}

          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            {confirmed ? t("store_thanks_title") : reference ? "Checking your payment" : "No order to show"}
          </h1>

          <p className="text-stone-600 mb-6">
            {!reference
              ? "This page shows an order after you've paid for it. Your cart is still saved if you want to go back to it."
              : confirmed
                ? t("store_thanks_body").replace("{ref}", reference)
                : checking
                  ? "Just confirming with the payment provider…"
                  : `We're still confirming this one. Your reference is ${reference} — if you don't get an email shortly, contact the club and quote it.`}
          </p>

          {order && order.items.length > 0 && (
            <div className="text-left border rounded-xl p-4 mb-6 space-y-1.5">
              {order.items.map((i, n) => (
                <div key={n} className="flex justify-between text-sm">
                  <span className="text-stone-600">
                    {i.quantity} × {i.productName}
                    {i.variantLabel && i.variantLabel !== "One size" && (
                      <span className="text-stone-500"> ({i.variantLabel})</span>
                    )}
                  </span>
                  <span>{formatMoney(i.unitPriceCents * i.quantity, symbol)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-2 border-t text-sm">
                <span>{t("store_total")}</span><span>{formatMoney(order.totalCents, symbol)}</span>
              </div>
              <p className="text-xs text-stone-500 pt-2">
                {order.fulfilmentMethod === "shipping"
                  ? "We'll post this out to you."
                  : t("store_pickup_note")}
              </p>
            </div>
          )}

          <Link href="/store"><Button variant="outline">{t("store_cart_continue")}</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function StoreCancelled() {
  const t = useSiteText();
  // They pressed Cancel on the payment page: release what it was holding.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) apiRequest("POST", `/api/store/order/${encodeURIComponent(ref)}/release`).catch(() => {});
    try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* storage blocked */ }
  }, []);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <XCircle className="h-14 w-14 text-stone-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-900 mb-2">{t("store_cancelled_title")}</h1>
          <p className="text-stone-600 mb-6">{t("store_cancelled_body")}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/store"><Button variant="outline">{t("store_cart_continue")}</Button></Link>
            <Link href="/store/checkout"><Button>Try again</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
