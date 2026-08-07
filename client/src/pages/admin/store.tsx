// =============================================================================
// AdminStore — client/src/pages/admin/store.tsx
// =============================================================================
// Two admin sections:
//
//   AdminStore   what's for sale — products, sizes, stock, prices — plus every
//                shop setting (how it takes money, postage, wording).
//   AdminOrders  what people have bought, and whether it's been handed over.
//
// Prices are typed in dollars here but stored in whole cents, which is the only
// safe way to keep money in a database (see shared/schema.ts).
// =============================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImagePicker from "@/components/image-picker";
import {
  Plus, Pencil, Trash2, Info, ArrowUp, ArrowDown, ShoppingBag,
  CreditCard, CheckCircle, AlertTriangle, Package, PackageX, PackageCheck, Copy, Download,
} from "lucide-react";
import type { Product, ProductVariant, ProductWithVariants, OrderWithItems } from "@shared/schema";

// ── Money helpers ────────────────────────────────────────────────────────────
const toDollars = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

/** "24.50" → 2450. Anything unparseable becomes 0 rather than NaN. */
const toCents = (dollars: string): number => {
  const n = Math.round(parseFloat(String(dollars).replace(/[^0-9.]/g, "")) * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// =============================================================================
// PRODUCTS + SHOP SETTINGS
// =============================================================================
export default function AdminStore() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ProductWithVariants> | null>(null);

  // The club sets their own currency symbol, so never format with a fixed one.
  const { data: publicConfig } = useQuery<{ currencySymbol: string }>({
    queryKey: ["/api/store/config"],
    queryFn: () => apiRequest("GET", "/api/store/config"),
  });
  const symbol = publicConfig?.currencySymbol ?? "$";

  const { data: products = [] } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/admin/products"],
    queryFn: () => apiRequest("GET", "/api/admin/products"),
  });
  const { data: status } = useQuery<{ mode: string; canPay: boolean; testMode: boolean; message: string; webhookPath: string }>({
    queryKey: ["/api/admin/store-status"],
    queryFn: () => apiRequest("GET", "/api/admin/store-status"),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/store-status"] });
  };

  const save = useMutation({
    mutationFn: (p: Partial<Product>) =>
      p.id ? apiRequest("PUT", `/api/admin/products/${p.id}`, p)
           : apiRequest("POST", "/api/admin/products", p),
    onSuccess: () => { refresh(); toast({ title: "Saved" }); },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/products/${id}`),
    onSuccess: () => { refresh(); toast({ title: "Deleted" }); },
  });

  const move = (p: ProductWithVariants, dir: -1 | 1) => {
    const idx = products.findIndex((x) => x.id === p.id);
    const other = products[idx + dir];
    if (!other) return;
    save.mutate({ id: p.id, sortOrder: other.sortOrder });
    save.mutate({ id: other.id, sortOrder: p.sortOrder });
  };

  return (
    <div className="space-y-8">
      <StoreSettings status={status} onSaved={refresh} />

      {/* Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-stone-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-maroon-700" /> What's for sale
          </h3>
          <Button size="sm" onClick={() => setEditing({ isActive: true, maxPerOrder: 10, requiresShipping: true, variants: [] })}>
            <Plus className="h-4 w-4" /> Add product
          </Button>
        </div>

        {products.length === 0 && (
          <p className="text-sm text-stone-500 border rounded-xl p-6 text-center">
            Nothing added yet. Click "Add product" to list your first item.
          </p>
        )}

        <div className="space-y-3">
          {products.map((p) => {
            // Counted sizes and "made to order" sizes are reported separately —
            // saying only "made to order" would hide that three jerseys are
            // physically left, which is what someone restocking needs to know.
            const counted = p.variants.filter((v) => v.stock !== null && v.stock !== undefined);
            const unlimited = p.variants.length - counted.length;
            const totalStock = counted.reduce((n, v) => n + (v.stock ?? 0), 0);
            const stockText = counted.length === 0
              ? "made to order"
              : unlimited > 0
                ? `${totalStock} in stock, ${unlimited} made to order`
                : `${totalStock} in stock`;
            return (
              <Card key={p.id} className={p.isActive ? "" : "opacity-60"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                      : <div className="w-16 h-16 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                          <ShoppingBag className="h-6 w-6 text-stone-300" />
                        </div>}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-stone-900">{p.name}</p>
                        {p.badge && <Badge variant="secondary" className="text-xs">{p.badge}</Badge>}
                        {!p.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                        {p.soldOut && (
                          <Badge className="text-xs bg-red-100 text-red-800">Sold out</Badge>
                        )}
                        {p.variants.some((v) => v.isActive === false) && (
                          <Badge variant="secondary" className="text-xs">Some sizes off</Badge>
                        )}
                        {p.priceCents === 0 && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">No price set</Badge>
                        )}
                      </div>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {symbol}{(p.priceCents / 100).toFixed(2)}
                        {" · "}
                        {p.variants.length} size{p.variants.length === 1 ? "" : "s"}
                        {" · "}
                        {stockText}
                        {counted.some((v) => (v.stock ?? 0) === 0) && (
                          <span className="text-amber-600"> · some sold out</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => move(p, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => move(p, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline"
                        title={p.soldOut ? "Put back on sale" : "Mark as sold out"}
                        onClick={() => save.mutate({ id: p.id, soldOut: !p.soldOut })}>
                        {p.soldOut ? <PackageCheck className="h-3.5 w-3.5" /> : <PackageX className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600"
                        onClick={() => { if (confirm(`Delete "${p.name}"? Past orders keep their record of it.`)) remove.mutate(p.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { refresh(); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ── Shop settings ────────────────────────────────────────────────────────────
function StoreSettings({ status, onSaved }: { status?: { canPay: boolean; testMode: boolean; message: string; webhookPath: string }; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/secure"],
    queryFn: () => apiRequest("GET", "/api/settings/secure"),
  });

  useEffect(() => {
    if (settings && !loaded) { setForm(settings); setLoaded(true); }
  }, [settings, loaded]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body: Record<string, string>) => apiRequest("PUT", "/api/settings", body),
    onSuccess: () => { onSaved(); toast({ title: "Shop settings saved" }); },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}${status?.webhookPath ?? "/api/store/webhook"}`
    : "";

  const mode = form.store_mode ?? "enquiry";

  return (
    <Card>
      <CardContent className="pt-5 space-y-5">
        <h3 className="font-semibold text-stone-900 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-maroon-700" /> How the shop works
        </h3>

        {/* Mode */}
        <div className="space-y-2">
          <Label>What should the shop page do?</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { v: "off", t: "Closed", d: "Hide the shop entirely." },
              { v: "enquiry", t: "Enquiries only", d: "List items; people email to order. No payments." },
              { v: "external", t: "Link to another shop", d: "Send people to a shop you run elsewhere." },
              { v: "checkout", t: "Take card payments", d: "A real cart, paid by card through Stripe." },
            ].map((o) => (
              <button key={o.v} type="button" onClick={() => set("store_mode", o.v)}
                className={`text-left border rounded-lg p-3 transition-colors ${
                  mode === o.v ? "border-maroon-600 bg-maroon-50" : "border-stone-200 hover:border-stone-300"
                }`}>
                <p className="text-sm font-medium text-stone-900">{o.t}</p>
                <p className="text-xs text-stone-500 mt-0.5">{o.d}</p>
              </button>
            ))}
          </div>
        </div>

        {mode === "external" && (
          <div className="space-y-1.5">
            <Label htmlFor="store_url">Your shop's web address</Label>
            <Input id="store_url" value={form.store_url ?? ""} onChange={(e) => set("store_url", e.target.value)}
              placeholder="https://..." />
          </div>
        )}

        {mode === "checkout" && (
          <>
            {/* Live status — tells the club exactly what's still missing */}
            <div className={`rounded-lg p-3 flex items-start gap-2 text-sm ${
              status?.canPay
                ? status.testMode ? "bg-amber-50 text-amber-900 border border-amber-200"
                                  : "bg-green-50 text-green-900 border border-green-200"
                : "bg-stone-100 text-stone-700 border"
            }`}>
              {status?.canPay ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{status?.message}</span>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium mb-1 flex items-center gap-1.5"><Info className="h-4 w-4" /> Setting up Stripe</p>
              <ol className="list-decimal ml-5 space-y-1 text-xs leading-relaxed">
                <li>Create a free account at <strong>stripe.com</strong> and finish their verification.</li>
                <li>In Stripe: Developers → API keys. Copy the <strong>Secret key</strong> below.</li>
                <li>In Stripe: Developers → Webhooks → Add endpoint. Paste the address below,
                    choose the events <code>checkout.session.completed</code>,
                    <code>checkout.session.expired</code> and <code>charge.refunded</code>,
                    then copy its <strong>Signing secret</strong> below.</li>
                <li>Start with Stripe's <strong>test</strong> keys and place a test order first.</li>
              </ol>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-xs bg-white border rounded px-2 py-1 flex-1 truncate">{webhookUrl}</code>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard?.writeText(webhookUrl);
                  toast({ title: "Address copied" });
                }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sk">Stripe secret key</Label>
                <Input id="sk" type="password" value={form.stripe_secret_key ?? ""}
                  onChange={(e) => set("stripe_secret_key", e.target.value)} placeholder="sk_test_… or sk_live_…" />
                <p className="text-xs text-stone-400">Stored on your server and never shown again once saved.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whsec">Webhook signing secret</Label>
                <Input id="whsec" type="password" value={form.stripe_webhook_secret ?? ""}
                  onChange={(e) => set("stripe_webhook_secret", e.target.value)} placeholder="whsec_…" />
                <p className="text-xs text-stone-400">Without this, paid orders can never be confirmed.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cur">Currency</Label>
                <Input id="cur" value={form.store_currency ?? "AUD"} onChange={(e) => set("store_currency", e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sym">Symbol</Label>
                <Input id="sym" value={form.store_currency_symbol ?? "$"} onChange={(e) => set("store_currency_symbol", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notify">Send order emails to</Label>
                <Input id="notify" type="email" value={form.store_order_notify_email ?? ""}
                  onChange={(e) => set("store_order_notify_email", e.target.value)} placeholder="shop@yourclub.org.au" />
              </div>
            </div>

            {/* Delivery */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow collection at the club</Label>
                  <p className="text-xs text-stone-500">Members pick their order up at training.</p>
                </div>
                <Switch checked={form.store_pickup_enabled !== "false"}
                  onCheckedChange={(c) => set("store_pickup_enabled", c ? "true" : "false")} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Offer postage</Label>
                  <p className="text-xs text-stone-500">Charge a flat rate to post orders out.</p>
                </div>
                <Switch checked={form.store_shipping_enabled === "true"}
                  onCheckedChange={(c) => set("store_shipping_enabled", c ? "true" : "false")} />
              </div>

              {form.store_shipping_enabled === "true" && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="shiplabel">Call it</Label>
                    <Input id="shiplabel" value={form.store_shipping_label ?? "Postage"}
                      onChange={(e) => set("store_shipping_label", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="shipcost">Postage cost</Label>
                    <Input id="shipcost" inputMode="decimal" value={toDollars(parseInt(form.store_shipping_cents ?? "0", 10))}
                      onChange={(e) => set("store_shipping_cents", String(toCents(e.target.value)))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="freeover">Free over (blank = never)</Label>
                    <Input id="freeover" inputMode="decimal"
                      value={form.store_free_shipping_over_cents ? toDollars(parseInt(form.store_free_shipping_over_cents, 10)) : ""}
                      onChange={(e) => set("store_free_shipping_over_cents", e.target.value ? String(toCents(e.target.value)) : "")} />
                  </div>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="tax">Tax note (shown under prices)</Label>
                <Input id="tax" value={form.store_tax_note ?? ""} onChange={(e) => set("store_tax_note", e.target.value)}
                  placeholder="All prices include GST" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terms">Returns / terms note</Label>
                <Input id="terms" value={form.store_terms ?? ""} onChange={(e) => set("store_terms", e.target.value)}
                  placeholder="Exchanges available at training." />
              </div>
            </div>
          </>
        )}

        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save shop settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Product editor (with sizes) ──────────────────────────────────────────────
function ProductEditor({
  product, onClose, onSaved,
}: { product: Partial<ProductWithVariants>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Product>>({
    name: "", description: "", priceCents: 0, badge: "", imageUrl: "",
    isActive: true, soldOut: false, maxPerOrder: 10, requiresShipping: true, sortOrder: 0,
    ...product,
  });
  const [variants, setVariants] = useState<Partial<ProductVariant>[]>(
    product.variants?.length ? product.variants : [{ label: "One size", stock: null }],
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Product, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.name?.trim()) { toast({ title: "Give the product a name", variant: "destructive" }); return; }
    if (variants.length === 0 || variants.every((v) => !v.label?.trim())) {
      toast({ title: "Add at least one size", description: "Use \"One size\" if it doesn't come in sizes.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const saved: Product = form.id
        ? await apiRequest("PUT", `/api/admin/products/${form.id}`, form)
        : await apiRequest("POST", "/api/admin/products", form);

      // Sizes are saved one at a time against the product they belong to.
      const existingIds = new Set((product.variants ?? []).map((v) => v.id));
      for (const [i, v] of variants.entries()) {
        if (!v.label?.trim()) continue;
        const payload = {
          productId: saved.id, label: v.label.trim(), sku: v.sku ?? null,
          priceCents: v.priceCents ?? null, stock: v.stock ?? null,
          isActive: v.isActive ?? true, sortOrder: i,
        };
        if (v.id) { await apiRequest("PUT", `/api/admin/variants/${v.id}`, payload); existingIds.delete(v.id); }
        else await apiRequest("POST", "/api/admin/variants", payload);
      }
      // Anything the admin removed from the list gets deleted.
      for (const goneId of existingIds) await apiRequest("DELETE", `/api/admin/variants/${goneId}`);

      toast({ title: "Product saved" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Name *</Label>
              <Input id="pname" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pprice">Price *</Label>
              <Input id="pprice" inputMode="decimal" value={toDollars(form.priceCents)}
                onChange={(e) => set("priceCents", toCents(e.target.value))} placeholder="0.00" />
              <p className="text-xs text-stone-400">A product priced at 0 can't be bought.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdesc">Description</Label>
            <Textarea id="pdesc" rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pbadge">Badge (optional)</Label>
              <Input id="pbadge" value={form.badge ?? ""} onChange={(e) => set("badge", e.target.value)} placeholder="New / Playing Kit" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pmax">Most one person can buy</Label>
              <Input id="pmax" type="number" min={1} value={form.maxPerOrder ?? 10}
                onChange={(e) => set("maxPerOrder", parseInt(e.target.value) || 1)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Photo</Label>
            <ImagePicker value={form.imageUrl ?? ""} onChange={(url) => set("imageUrl", url)} />
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <Label>Show in the shop</Label>
              <p className="text-xs text-stone-500">Turn off to hide it without deleting it.</p>
            </div>
            <Switch checked={form.isActive !== false} onCheckedChange={(c) => set("isActive", c)} />
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <Label>Sold out</Label>
              <p className="text-xs text-stone-500">
                Keeps it on the page, clearly unavailable, so members know you
                normally stock it. Use this rather than hiding it when you're
                just waiting on more.
              </p>
            </div>
            <Switch checked={form.soldOut === true} onCheckedChange={(c) => set("soldOut", c)} />
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <Label>Needs posting</Label>
              <p className="text-xs text-stone-500">Turn off for things collected only (e.g. event tickets).</p>
            </div>
            <Switch checked={form.requiresShipping !== false} onCheckedChange={(c) => set("requiresShipping", c)} />
          </div>

          {/* Sizes */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <Label>Sizes &amp; stock</Label>
                <p className="text-xs text-stone-500">Leave stock blank for "made to order" (never sells out).</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setVariants([...variants, { label: "", stock: null, isActive: true }])}>
                <Plus className="h-3.5 w-3.5" /> Add size
              </Button>
            </div>

            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    {i === 0 && <p className="text-xs text-stone-500">Size name</p>}
                    <Input value={v.label ?? ""} placeholder="Small"
                      onChange={(e) => setVariants(variants.map((x, n) => n === i ? { ...x, label: e.target.value } : x))} />
                  </div>
                  <div className="w-24 space-y-1">
                    {i === 0 && <p className="text-xs text-stone-500">In stock</p>}
                    <Input inputMode="numeric" placeholder="∞"
                      value={v.stock ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const stock = raw === "" ? null : Math.max(0, parseInt(raw) || 0);
                        setVariants(variants.map((x, n) => n === i ? { ...x, stock } : x));
                      }} />
                  </div>
                  <div className="w-28 space-y-1">
                    {i === 0 && <p className="text-xs text-stone-500">Price override</p>}
                    <Input inputMode="decimal" placeholder="same"
                      value={toDollars(v.priceCents)}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const priceCents = raw === "" ? null : toCents(raw);
                        setVariants(variants.map((x, n) => n === i ? { ...x, priceCents } : x));
                      }} />
                  </div>
                  <div className="flex flex-col items-center gap-1 mb-0.5">
                    {i === 0 && <p className="text-xs text-stone-500">Sell it</p>}
                    <Switch
                      checked={v.isActive !== false}
                      onCheckedChange={(c) => setVariants(variants.map((x, n) => n === i ? { ...x, isActive: c } : x))}
                      aria-label={`Available: ${v.label || "size"}`}
                    />
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-600 mb-0.5"
                    onClick={() => setVariants(variants.filter((_, n) => n !== i))} aria-label="Remove size">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save product"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// ORDERS
// =============================================================================
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-stone-100 text-stone-700",
  paid: "bg-green-100 text-green-800",
  fulfilled: "bg-blue-100 text-blue-800",
  cancelled: "bg-stone-100 text-stone-500",
  refunded: "bg-amber-100 text-amber-800",
};

export function AdminOrders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: orders = [] } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: () => apiRequest("GET", "/api/admin/orders"),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: number; status?: string; adminNotes?: string }) =>
      apiRequest("PUT", `/api/admin/orders/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order updated" });
    },
  });

  const byStatus = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  // Search covers the things someone actually has to hand when a member rings
  // up: the reference they were emailed, their name, or their email address.
  const needle = search.trim().toLowerCase();
  const shown = needle === "" ? byStatus : byStatus.filter((o) =>
    [o.reference, o.customerName, o.customerEmail, o.customerPhone]
      .some((f) => (f ?? "").toLowerCase().includes(needle)));
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;

  // Money actually taken — pending and cancelled orders were never charged.
  const takings = orders
    .filter((o) => o.status === "paid" || o.status === "fulfilled")
    .reduce((n, o) => n + o.totalCents, 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-stone-500">Paid orders</p>
          <p className="text-2xl font-bold text-stone-900">
            {orders.filter((o) => o.status === "paid" || o.status === "fulfilled").length}
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-stone-500">Total taken</p>
          <p className="text-2xl font-bold text-green-700">{money(takings)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-stone-500">Waiting to hand over</p>
          <p className="text-2xl font-bold text-blue-700">{orders.filter((o) => o.status === "paid").length}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", "paid", "fulfilled", "pending", "cancelled", "refunded"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}
            className="capitalize">{f}</Button>
        ))}
        <div className="flex-1 min-w-[180px]">
          <Input placeholder="Search reference, name or email…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="h-9" />
        </div>
        <a href="/api/admin/orders/export" download>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </a>
      </div>

      {shown.length === 0 && (
        <p className="text-sm text-stone-500 border rounded-xl p-6 text-center">
          {needle ? `Nothing matching "${search}".` : "No orders here yet."}
        </p>
      )}

      <div className="space-y-3">
        {shown.map((o) => (
          <Card key={o.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-stone-900">{o.reference}</span>
                    <Badge className={`text-xs capitalize ${STATUS_STYLES[o.status] ?? ""}`}>{o.status}</Badge>
                    <Badge variant="secondary" className="text-xs">
                      {o.fulfilmentMethod === "shipping" ? "Post" : "Collect"}
                    </Badge>
                  </div>
                  <p className="text-sm text-stone-600 mt-1">
                    {o.customerName} · <a href={`mailto:${o.customerEmail}`} className="text-maroon-600 hover:underline">{o.customerEmail}</a>
                    {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {new Date(o.createdAt).toLocaleString("en-AU")}
                  </p>
                </div>
                <p className="text-lg font-bold text-stone-900">{money(o.totalCents)}</p>
              </div>

              <div className="mt-3 border-t pt-3 space-y-1">
                {o.items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-stone-600">
                      {i.quantity} × {i.productName}
                      {i.variantLabel && i.variantLabel !== "One size" && (
                        <span className="text-stone-400"> ({i.variantLabel})</span>
                      )}
                    </span>
                    <span className="text-stone-500">{money(i.unitPriceCents * i.quantity)}</span>
                  </div>
                ))}
                {o.shippingCents > 0 && (
                  <div className="flex justify-between text-sm text-stone-500">
                    <span>Postage</span><span>{money(o.shippingCents)}</span>
                  </div>
                )}
              </div>

              {o.fulfilmentMethod === "shipping" && o.shippingAddress && (
                <p className="text-sm text-stone-600 mt-3 bg-stone-50 rounded-lg p-2.5">
                  <strong>Post to:</strong> {o.shippingAddress}
                </p>
              )}
              {o.notes && (
                <p className="text-sm text-stone-600 mt-2 bg-stone-50 rounded-lg p-2.5">
                  <strong>Their note:</strong> {o.notes}
                </p>
              )}

              <div className="flex gap-2 mt-3 flex-wrap">
                {o.status === "paid" && (
                  <Button size="sm" onClick={() => update.mutate({ id: o.id, status: "fulfilled" })}>
                    Mark as handed over
                  </Button>
                )}
                {o.status === "fulfilled" && (
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: o.id, status: "paid" })}>
                    Undo hand-over
                  </Button>
                )}
                {o.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: o.id, status: "cancelled" })}>
                    Cancel this unpaid order
                  </Button>
                )}
              </div>

              {(o.status === "paid" || o.status === "fulfilled") && (
                <p className="text-xs text-stone-400 mt-2">
                  To refund, do it in your Stripe dashboard — this page updates itself when Stripe confirms it.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
