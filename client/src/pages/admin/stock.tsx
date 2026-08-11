// =============================================================================
// AdminStock — client/src/pages/admin/stock.tsx
// =============================================================================
// One screen for counting stock, instead of opening every product in turn.
//
// Why this exists separately from the product editor: the two jobs are
// different. Setting a product up (name, photo, price, description) happens
// once. Counting what's in the cupboard after a delivery, or on a Saturday
// morning, happens constantly — and doing it through a dialog per product is
// painful enough that people stop bothering, and then the website's stock is
// wrong, which is worse than not tracking it at all.
//
// So this is a flat list of every size with a number box and +/- buttons, and
// anything low or sold out floated to the top where it can't be missed.
//
// STOCK TRACKING IS OPTIONAL. A blank box means "made to order" — that size
// never sells out and is never chased here. Clubs that don't want to count
// anything simply leave every box blank and can ignore this screen entirely.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Minus, AlertTriangle, PackageX, Infinity as InfinityIcon, Save } from "lucide-react";
import type { ProductWithVariants, ProductVariant } from "@shared/schema";

export default function AdminStock() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<number, string>>({});

  const { data: products = [] } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/admin/products"],
    queryFn: () => apiRequest("GET", "/api/admin/products"),
  });
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings"),
  });

  const threshold = parseInt(settings?.store_low_stock_threshold ?? "3", 10) || 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
  };

  const saveVariant = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<ProductVariant>) =>
      apiRequest("PUT", `/api/admin/variants/${id}`, body),
    onSuccess: () => refresh(),
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const saveThreshold = useMutation({
    mutationFn: (value: string) => apiRequest("PUT", "/api/settings", { store_low_stock_threshold: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Low-stock level saved" });
    },
  });

  // Every tracked size, flattened, with its product for context.
  const rows = products.flatMap((p) =>
    p.variants.map((v) => ({ product: p, variant: v })));

  const tracked = rows.filter((r) => r.variant.stock !== null && r.variant.stock !== undefined);
  const soldOut = tracked.filter((r) => (r.variant.stock ?? 0) <= 0);
  const low = tracked.filter((r) => {
    const s = r.variant.stock ?? 0;
    return threshold > 0 && s > 0 && s <= threshold;
  });

  const adjust = (v: ProductVariant, delta: number) => {
    if (v.stock === null || v.stock === undefined) return;   // made to order
    const next = Math.max(0, v.stock + delta);
    saveVariant.mutate({ id: v.id, stock: next });
  };

  const commit = (v: ProductVariant) => {
    const raw = edits[v.id];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    // Blank means "stop counting this one" — it becomes made-to-order again.
    const stock = trimmed === "" ? null : Math.max(0, parseInt(trimmed, 10) || 0);
    saveVariant.mutate({ id: v.id, stock });
    setEdits((e) => { const n = { ...e }; delete n[v.id]; return n; });
  };

  return (
    <div className="space-y-6">
      {/* Anything needing attention, first */}
      {(soldOut.length > 0 || low.length > 0) && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-5 space-y-2">
            <p className="font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Needs restocking
            </p>
            {soldOut.map(({ product, variant }) => (
              <div key={variant.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-800">
                  <strong>{product.name}</strong>
                  {variant.label !== "One size" && <span className="text-stone-500"> — {variant.label}</span>}
                </span>
                <Badge className="bg-red-100 text-red-800 text-xs">Sold out</Badge>
              </div>
            ))}
            {low.map(({ product, variant }) => (
              <div key={variant.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-800">
                  <strong>{product.name}</strong>
                  {variant.label !== "One size" && <span className="text-stone-500"> — {variant.label}</span>}
                </span>
                <Badge className="bg-amber-100 text-amber-800 text-xs">{variant.stock} left</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* The counting screen */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h3 className="font-semibold text-stone-900">Stock count</h3>
              <p className="text-sm text-stone-500">
                Use +/− after a sale at the clubhouse, or type the real number
                straight in after counting. Changes save as you go.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="thr" className="text-xs">Warn me at or below</Label>
                <Input id="thr" className="w-20" inputMode="numeric"
                  defaultValue={String(threshold)}
                  onBlur={(e) => saveThreshold.mutate(String(Math.max(0, parseInt(e.target.value, 10) || 0)))} />
              </div>
            </div>
          </div>

          {rows.length === 0 && (
            <p className="text-sm text-stone-500 border rounded-xl p-6 text-center">
              Nothing to count yet — add a product under Shop first.
            </p>
          )}

          <div className="space-y-4">
            {products.map((p) => (
              <div key={p.id} className={p.isActive ? "" : "opacity-60"}>
                <p className="text-sm font-medium text-stone-900 mb-1.5 flex items-center gap-2">
                  {p.name}
                  {!p.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  {p.soldOut && <Badge className="text-xs bg-red-100 text-red-800">Sold out</Badge>}
                </p>

                <div className="space-y-1.5">
                  {p.variants.map((v) => {
                    const untracked = v.stock === null || v.stock === undefined;
                    const value = edits[v.id] ?? (untracked ? "" : String(v.stock));
                    const isLow = !untracked && threshold > 0 && (v.stock ?? 0) > 0 && (v.stock ?? 0) <= threshold;
                    const isOut = !untracked && (v.stock ?? 0) <= 0;

                    return (
                      <div key={v.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                        <span className="flex-1 text-sm text-stone-700 min-w-0 truncate">
                          {v.label}
                          {v.isActive === false && (
                            <Badge variant="secondary" className="ml-2 text-xs">Not for sale</Badge>
                          )}
                        </span>

                        {untracked ? (
                          <span className="text-xs text-stone-500 flex items-center gap-1 mr-1">
                            <InfinityIcon className="h-3.5 w-3.5" /> made to order
                          </span>
                        ) : (
                          <>
                            {isOut && <PackageX className="h-4 w-4 text-red-500" />}
                            {isLow && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                              onClick={() => adjust(v, -1)} aria-label={`One fewer ${v.label}`}>
                              <Minus className="h-3 w-3" />
                            </Button>
                          </>
                        )}

                        <Input
                          className={`w-20 h-8 text-center ${isOut ? "border-red-300" : isLow ? "border-amber-300" : ""}`}
                          inputMode="numeric"
                          placeholder="∞"
                          value={value}
                          onChange={(e) => setEdits((s) => ({ ...s, [v.id]: e.target.value }))}
                          onBlur={() => commit(v)}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        />

                        {!untracked && (
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                            onClick={() => adjust(v, 1)} aria-label={`One more ${v.label}`}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}

                        {edits[v.id] !== undefined && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => commit(v)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <div className="flex items-center gap-1.5 pl-2 border-l ml-1">
                          <span className="text-xs text-stone-500 hidden sm:inline">Sell it</span>
                          <Switch
                            checked={v.isActive !== false}
                            onCheckedChange={(c) => saveVariant.mutate({ id: v.id, isActive: c })}
                            aria-label={`Available for sale: ${v.label}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-stone-500 mt-4 leading-relaxed">
            Leave a box empty for items you make or order in — those never sell
            out and are never chased above. Stock comes down automatically when
            an online order is paid for, so you only need to adjust it here for
            sales made in person.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
