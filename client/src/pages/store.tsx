// =============================================================================
// CLUB SHOP — client/src/pages/store.tsx
// =============================================================================
// The page adapts to however the club has set the shop up (Admin → Shop):
//
//   off       the page says the shop is closed
//   enquiry   items are listed, ordering is by email (the original behaviour)
//   external  items are listed, buttons point at the club's other shop
//   checkout  a real cart, paid for by card through Stripe
//
// A club that never sets up payments loses nothing — the page keeps working
// exactly as it did before.
// =============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingBag, ExternalLink, Mail, Shirt, Plus, Minus, X, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageContent } from "@/hooks/use-page-content";
import EditableSection from "@/components/editable-section";
import { useSiteText } from "@/hooks/use-site-text";
import { useClubDetails } from "@/components/club-details";
import { useCart, formatMoney } from "@/hooks/use-cart";
import type { ProductWithVariants } from "@shared/schema";

interface StoreConfig {
  mode: "off" | "enquiry" | "external" | "checkout";
  currencySymbol: string;
  canPay: boolean;
  testMode: boolean;
  taxNote: string;
  externalUrl: string;
}

export default function Store() {
  const t = useSiteText();
  const club = useClubDetails();
  const { get } = usePageContent("store");
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useCart();

  const { data: config } = useQuery<StoreConfig>({
    queryKey: ["/api/store/config"],
    queryFn: () => apiRequest("GET", "/api/store/config"),
  });
  const { data: products = [], isLoading } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiRequest("GET", "/api/products"),
  });

  const symbol = config?.currencySymbol ?? "$";
  const canBuy = config?.mode === "checkout" && config.canPay;
  const externalUrl = config?.externalUrl;

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <ShoppingBag className="h-12 w-12 text-gold-400 mx-auto mb-4" />
          <EditableSection page="store" section="hero_title" value={get("hero_title", t("page_store_title"))} label="Hero heading">
            {(c) => <h1 className="text-4xl font-extrabold mb-4">{c}</h1>}
          </EditableSection>
          <EditableSection page="store" section="hero_subtitle" value={get("hero_subtitle", t("page_store_subtitle"))} label="Hero subtitle">
            {(c) => <p className="text-maroon-100 text-lg">{c}</p>}
          </EditableSection>

          {config?.mode === "external" && externalUrl && (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-6">
              <Button size="lg" variant="gold" className="gap-2">
                <ShoppingBag className="h-5 w-5" /> Shop Online <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}

          {canBuy && cart.itemCount > 0 && (
            <Button size="lg" variant="gold" className="gap-2 mt-6" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-5 w-5" />
              {t("store_cart_title")} ({cart.itemCount}) · {formatMoney(cart.subtotalCents, symbol)}
            </Button>
          )}
        </div>
      </section>

      {/* A club testing their payment setup should never wonder whether a
          payment was real — say so plainly, on the page. */}
      {config?.testMode && canBuy && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-3 text-center">
          <p className="text-amber-900 text-sm font-medium">
            Test mode — this shop is not taking real payments yet. Cards will not be charged.
          </p>
        </div>
      )}

      {config?.mode === "off" && (
        <section className="py-8 px-4 bg-stone-100 border-b">
          <p className="max-w-4xl mx-auto text-center text-stone-600 font-medium">{t("store_closed_note")}</p>
        </section>
      )}

      {config?.mode === "enquiry" && (
        <section className="py-8 px-4 bg-gold-50 border-b border-gold-200">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-gold-800 font-medium">
              {t("store_enquiry_note")}{" "}
              <a href={`mailto:${club.email}`} className="underline hover:text-gold-900">Email us</a>
            </p>
          </div>
        </section>
      )}

      {/* Products */}
      {config?.mode !== "off" && (
        <section className="py-16 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <h2 className="section-title">{t("store_apparel_title")}</h2>
            <div className="gold-bar" />

            {isLoading && <p className="text-center text-stone-400 py-12">Loading…</p>}

            {!isLoading && products.length === 0 && (
              <p className="text-center text-stone-500 py-12">
                Nothing is listed in the shop just yet — check back soon.
              </p>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  symbol={symbol}
                  canBuy={canBuy}
                  externalUrl={config?.mode === "external" ? externalUrl : undefined}
                  clubEmail={club.email}
                  onAdd={(variantId) => { cart.add(product, variantId); setCartOpen(true); }}
                  t={t}
                />
              ))}
            </div>

            {config?.taxNote && (
              <p className="text-center text-xs text-stone-400 mt-8">{config.taxNote}</p>
            )}
          </div>
        </section>
      )}

      {/* Ordering info — the club can edit every word of this */}
      <section className="py-12 px-4 bg-stone-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-stone-900 mb-6 text-center">{t("store_ordering_title")}</h2>
          <div className="text-center">
            <p className="text-stone-500 text-sm mb-3">Questions about sizing or an order?</p>
            <a href={`mailto:${club.email}?subject=Store Enquiry`}>
              <Button variant="default" className="gap-2"><Mail className="h-4 w-4" /> Contact Us</Button>
            </a>
          </div>
        </div>
      </section>

      {/* Cart */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("store_cart_title")}</DialogTitle></DialogHeader>

          {cart.lines.length === 0 ? (
            <p className="text-stone-500 py-6 text-center">{t("store_cart_empty")}</p>
          ) : (
            <>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {cart.lines.map((line) => (
                  <div key={line.variantId} className="flex items-center gap-3 border rounded-lg p-3">
                    {line.imageUrl && (
                      <img src={line.imageUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-stone-900 truncate">{line.productName}</p>
                      {line.variantLabel && line.variantLabel !== "One size" && (
                        <p className="text-xs text-stone-500">{line.variantLabel}</p>
                      )}
                      <p className="text-xs text-stone-500">{formatMoney(line.unitPriceCents, symbol)} each</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                        onClick={() => cart.setQuantity(line.variantId, line.quantity - 1)}
                        aria-label="Reduce quantity">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium">{line.quantity}</span>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                        disabled={line.maxQuantity != null && line.quantity >= line.maxQuantity}
                        onClick={() => cart.setQuantity(line.variantId, line.quantity + 1)}
                        aria-label="Increase quantity">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-stone-400"
                        onClick={() => cart.remove(line.variantId)} aria-label="Remove">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {cart.lines.some((l) => l.maxQuantity != null && l.quantity >= l.maxQuantity) && (
                <p className="text-xs text-amber-600">
                  You've reached the most we have available of one of these.
                </p>
              )}

              <div className="flex justify-between items-center pt-3 border-t font-semibold">
                <span>{t("store_subtotal")}</span>
                <span>{formatMoney(cart.subtotalCents, symbol)}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setCartOpen(false)}>
                  {t("store_cart_continue")}
                </Button>
                <Link href="/store/checkout" className="flex-1">
                  <Button className="w-full" onClick={() => setCartOpen(false)}>
                    {t("store_cart_checkout")}
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── One product ──────────────────────────────────────────────────────────────
function ProductCard({
  product, symbol, canBuy, externalUrl, clubEmail, onAdd, t,
}: {
  product: ProductWithVariants;
  symbol: string;
  canBuy: boolean;
  externalUrl?: string;
  clubEmail: string;
  onAdd: (variantId: number) => void;
  t: ReturnType<typeof useSiteText>;
}) {
  // A size can be unavailable for two different reasons — the club switched it
  // off, or it ran out. Customers don't care which, so both look the same.
  const isAvailable = (v: { isActive?: boolean | null; stock?: number | null }) =>
    v.isActive !== false && (v.stock === null || v.stock === undefined || v.stock > 0);

  const buyable = product.variants.filter(isAvailable);
  // The whole product is unavailable if an admin marked it sold out, or if
  // every single size is unavailable.
  const soldOut = product.soldOut === true || buyable.length === 0;
  const [selected, setSelected] = useState<number | null>(buyable[0]?.id ?? null);
  // If the chosen size became unavailable, fall back to one that isn't.
  const chosenStillOk = selected !== null && buyable.some((v) => v.id === selected);
  const effectiveSelected = chosenStillOk ? selected : (buyable[0]?.id ?? null);

  // A single "One size" option isn't a choice — don't make people pick it.
  const hasRealSizes = product.variants.length > 1 || product.variants[0]?.label !== "One size";
  const chosen = product.variants.find((v) => v.id === effectiveSelected);
  const price = chosen?.priceCents ?? product.priceCents;

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-48 bg-stone-100 flex items-center justify-center">
          <Shirt className="h-10 w-10 text-stone-300" />
        </div>
      )}

      <CardContent className="pt-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-stone-900 leading-snug">{product.name}</h3>
          {product.badge && <Badge variant="secondary" className="text-xs shrink-0">{product.badge}</Badge>}
        </div>

        {product.description && (
          <p className="text-xs text-stone-500 leading-relaxed mb-3">{product.description}</p>
        )}

        <p className="text-lg font-bold text-maroon-700 mb-3">{formatMoney(price, symbol)}</p>

        {/* Sizes */}
        {canBuy && hasRealSizes && !soldOut && (
          <div className="mb-3">
            <p className="text-xs text-stone-500 mb-1.5">{t("store_choose_size")}</p>
            <div className="flex flex-wrap gap-1.5">
              {product.variants.map((v) => {
                const out = !isAvailable(v);
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={out}
                    onClick={() => setSelected(v.id)}
                    className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                      out
                        ? "border-stone-200 text-stone-300 line-through cursor-not-allowed"
                        : effectiveSelected === v.id
                          ? "border-maroon-600 bg-maroon-600 text-white"
                          : "border-stone-300 text-stone-700 hover:border-maroon-400"
                    }`}
                    title={out ? t("store_out_of_stock_size") : undefined}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            {chosen && isAvailable(chosen) && chosen.stock !== null && chosen.stock !== undefined && chosen.stock > 0 && chosen.stock <= 3 && (
              <p className="text-xs text-amber-600 mt-1.5">
                {t("store_low_stock").replace("{n}", String(chosen.stock))}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-2">
          {soldOut ? (
            <Button size="sm" variant="outline" className="w-full" disabled>{t("store_sold_out")}</Button>
          ) : canBuy ? (
            <Button size="sm" className="w-full gap-1.5" disabled={!effectiveSelected}
              onClick={() => effectiveSelected && onAdd(effectiveSelected)}>
              <ShoppingCart className="h-3.5 w-3.5" /> {t("store_add_to_cart")}
            </Button>
          ) : externalUrl ? (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="w-full gap-1.5">
                View in Store <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          ) : (
            <a href={`mailto:${clubEmail}?subject=${encodeURIComponent("Order enquiry: " + product.name)}`}>
              <Button size="sm" variant="outline" className="w-full gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Enquire to Order
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
