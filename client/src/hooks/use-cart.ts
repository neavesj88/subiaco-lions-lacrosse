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
  // Whether this item needs posting. Lets the checkout work out postage the
  // same way the server will: no postage unless something needs posting.
  requiresShipping?: boolean;
  // The most of this ITEM one person may buy, across all its sizes (the
  // product's "Most one person can buy"). The server enforces it per item.
  maxPerProduct?: number | null;
}

/** How many of this product are already in the cart in OTHER sizes. */
function otherSizes(lines: CartLine[], productId: number, variantId: number): number {
  return lines.filter((l) => l.productId === productId && l.variantId !== variantId)
    .reduce((n, l) => n + l.quantity, 0);
}

const STORAGE_KEY = "club-store-cart";

/** The order this browser last sent to the payment page, so it can be
 *  released if the customer comes back without paying (store-checkout.tsx). */
export const PENDING_ORDER_KEY = "club-store-pending-order";

// A tiny broadcast so every component using this hook updates together —
// the cart button in the header and the cart panel must never disagree.
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

// The cart as last written, kept in memory as well. Some browsers (private
// windows, strict settings) refuse to store anything; without this copy,
// every change was read back from that empty storage and lost at once, so the
// cart simply didn't work there. It now works for the visit, just not across
// visits.
let memory: CartLine[] = [];
let storageWorks = true;

function read(): CartLine[] {
  if (!storageWorks) return memory.map((l) => ({ ...l }));
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
  memory = lines.map((l) => ({ ...l }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    storageWorks = true;
  } catch {
    storageWorks = false;   // keep going from the in-memory copy (see above)
  }
  notify();
}

/**
 * Bring the cart up to date with the shop as it is now.
 *
 * In: the current products from the server. Out: plain-English notes about
 * anything that changed (empty if nothing did).
 *
 * A cart can sit in a browser for days. Prices change, sizes sell out, items
 * get taken down. Without this the cart and the Pay button showed the old
 * price, and Stripe then charged the new one — a total that changes between
 * the button and the payment page.
 */
export function syncCartWithShop(products: ProductWithVariants[]): string[] {
  const notes: string[] = [];
  const next: CartLine[] = [];
  for (const line of read()) {
    const product = products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    const label = line.variantLabel && line.variantLabel !== "One size" ? `${line.productName} (${line.variantLabel})` : line.productName;
    if (!product || !variant || !product.isActive || product.soldOut || variant.isActive === false
        || (variant.stock !== null && variant.stock !== undefined && variant.stock <= 0)) {
      notes.push(`${label} is no longer available, so it was taken out of your cart.`);
      continue;
    }
    const price = variant.priceCents ?? product.priceCents;
    if (price !== line.unitPriceCents) {
      notes.push(`The price of ${label} has changed.`);
    }
    const ceiling = Math.min(product.maxPerOrder, variant.stock ?? Number.MAX_SAFE_INTEGER);
    // The item's limit counts every size together.
    const alreadyKept = next.filter((l) => l.productId === product.id).reduce((n, l) => n + l.quantity, 0);
    const quantity = Math.min(line.quantity, ceiling, product.maxPerOrder - alreadyKept);
    if (quantity < 1) {
      notes.push(`You can order at most ${product.maxPerOrder} of ${product.name}, so ${label} was taken out.`);
      continue;
    }
    if (quantity < line.quantity) notes.push(`Only ${quantity} of ${label} can be ordered now.`);
    next.push({
      ...line,
      productName: product.name,
      variantLabel: variant.label,
      unitPriceCents: price,
      quantity,
      imageUrl: product.imageUrl,
      maxQuantity: Number.isFinite(ceiling) ? ceiling : null,
      requiresShipping: product.requiresShipping,
      maxPerProduct: product.maxPerOrder,
    });
  }
  if (JSON.stringify(next) !== JSON.stringify(read())) write(next);
  return notes;
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

    // Never let the cart exceed what's actually in stock, or the per-order cap
    // (which counts every size of the item together).
    const ceiling = Math.min(
      product.maxPerOrder,
      variant.stock ?? Number.MAX_SAFE_INTEGER,
    );
    const room = product.maxPerOrder - otherSizes(current, product.id, variantId);
    if (room < 1) return;   // already at the most one person can buy
    const wanted = (existing?.quantity ?? 0) + quantity;
    const finalQty = Math.max(1, Math.min(wanted, ceiling, room));

    if (existing) {
      existing.quantity = finalQty;
      existing.unitPriceCents = unitPriceCents;
      existing.maxQuantity = Number.isFinite(ceiling) ? ceiling : null;
      existing.maxPerProduct = product.maxPerOrder;
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
        requiresShipping: product.requiresShipping,
        maxPerProduct: product.maxPerOrder,
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
    const room = (line.maxPerProduct ?? Number.MAX_SAFE_INTEGER) - otherSizes(current, line.productId, variantId);
    line.quantity = Math.max(1, Math.min(quantity, ceiling, room));
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
