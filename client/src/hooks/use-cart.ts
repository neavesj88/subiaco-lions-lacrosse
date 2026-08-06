// =============================================================================
// THE SHOPPING CART — client/src/hooks/use-cart.ts
// =============================================================================
// Holds what the customer has picked, and remembers it if they close the tab.
//
// IMPORTANT: this is only a convenience for the shopper. It lives in their own
// browser, so it can be edited by anyone who cares to. Nothing here is trusted
// by the site. When they check out, only the product and size IDs are sent, and
// the server prices the whole order again from the database (server/store.ts).
// The prices kept here are purely so we can show a running total.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import type { ProductWithVariants } from "@shared/schema";

export interface CartLine {
  productId: number;
  variantId: number;
  productName: string;
  variantLabel: string;
  unitPriceCents: number;   // for display only — the server decides the real price
  quantity: number;
  imageUrl?: string | null;
  // The most of this size a person may order — the smaller of what's in stock
  // and the product's per-order cap. Purely to keep the +/- buttons honest;
  // the server checks stock again for real at checkout, because this number
  // was captured when the item was added and someone else may have bought the
  // last one since.
  maxQuantity?: number | null;
}

const STORAGE_KEY = "club-store-cart";

// A tiny broadcast so every component using this hook updates together —
// the cart button in the header and the cart panel must never disagree.
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidLine) : [];
  } catch {
    return []; // corrupted or unavailable storage — start empty rather than crash
  }
}

function isValidLine(l: unknown): l is CartLine {
  const line = l as CartLine;
  return !!line && Number.isInteger(line.productId) && Number.isInteger(line.variantId)
    && Number.isInteger(line.quantity) && line.quantity > 0;
}

function write(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* private browsing can refuse storage — the cart still works this session */
  }
  notify();
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(read);

  useEffect(() => {
    const refresh = () => setLines(read());
    listeners.add(refresh);
    // Also follow changes made in another tab of the same site.
    window.addEventListener("storage", refresh);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const add = useCallback((product: ProductWithVariants, variantId: number, quantity = 1) => {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const current = read();
    const existing = current.find((l) => l.variantId === variantId);
    const unitPriceCents = variant.priceCents ?? product.priceCents;

    // Never let the cart exceed what's actually in stock, or the per-order cap.
    const ceiling = Math.min(
      product.maxPerOrder,
      variant.stock ?? Number.MAX_SAFE_INTEGER,
    );
    const wanted = (existing?.quantity ?? 0) + quantity;
    const finalQty = Math.max(1, Math.min(wanted, ceiling));

    if (existing) {
      existing.quantity = finalQty;
      existing.unitPriceCents = unitPriceCents;
      existing.maxQuantity = Number.isFinite(ceiling) ? ceiling : null;
    } else {
      current.push({
        productId: product.id,
        variantId,
        productName: product.name,
        variantLabel: variant.label,
        unitPriceCents,
        quantity: finalQty,
        imageUrl: product.imageUrl,
        maxQuantity: Number.isFinite(ceiling) ? ceiling : null,
      });
    }
    write(current);
  }, []);

  const setQuantity = useCallback((variantId: number, quantity: number) => {
    const current = read();
    const line = current.find((l) => l.variantId === variantId);
    if (!line) return;
    if (quantity < 1) {
      write(current.filter((l) => l.variantId !== variantId));
      return;
    }
    // Never let the buttons take someone past what's actually available —
    // better to stop here than to let them reach checkout and be rejected.
    const ceiling = line.maxQuantity ?? Number.MAX_SAFE_INTEGER;
    line.quantity = Math.min(quantity, ceiling);
    write(current);
  }, []);

  const remove = useCallback((variantId: number) => {
    write(read().filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => write([]), []);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);

  return { lines, add, setQuantity, remove, clear, itemCount, subtotalCents };
}

/** Turn 2450 into "$24.50". */
export function formatMoney(cents: number, symbol = "$"): string {
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
