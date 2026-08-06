// =============================================================================
// THE SHOP — server/store.ts
// =============================================================================
// Turning a shopping cart into a real order, safely.
//
// THE ONE THING THIS FILE EXISTS TO GUARANTEE
//   The cart arrives from the customer's browser, so every single thing in it
//   is suspect: the prices, the quantities, whether the item is even for sale.
//   Nothing sent by the browser is used as-is. Only the product and size IDs
//   are taken from it, and everything else — name, price, availability — is
//   looked up fresh from the database here.
//
//   Concretely: if the browser claims the $95 jersey costs 1 cent, that claim
//   is simply ignored, because the price is never read from the request.
// =============================================================================

import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "./db";
import { products, productVariants, orders, orderItems } from "@shared/schema";
import { getSettingsSync } from "./site-settings";
import type { CheckoutLine } from "./payments";

// What the browser is allowed to tell us: which thing, and how many.
export interface CartLineInput {
  productId: number;
  variantId: number;
  quantity: number;
}

export interface PricedCart {
  lines: CheckoutLine[];
  items: Array<{
    productId: number;
    variantId: number;
    productName: string;
    variantLabel: string;
    unitPriceCents: number;
    quantity: number;
  }>;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  requiresShipping: boolean;
}

export class CartError extends Error {}

/**
 * Price a cart from the database, rejecting anything that isn't genuinely for
 * sale. Throws CartError with a message meant to be shown to the customer.
 */
export function priceCart(input: CartLineInput[], fulfilmentMethod: string): PricedCart {
  if (!Array.isArray(input) || input.length === 0) {
    throw new CartError("Your cart is empty.");
  }
  if (input.length > 50) {
    throw new CartError("That's too many different items for one order.");
  }

  const variantIds = [...new Set(input.map((l) => Number(l.variantId)).filter(Number.isInteger))];
  if (variantIds.length === 0) throw new CartError("Your cart is empty.");

  const variantRows = db.select().from(productVariants)
    .where(inArray(productVariants.id, variantIds)).all();
  const productRows = db.select().from(products)
    .where(inArray(products.id, [...new Set(variantRows.map((v) => v.productId))])).all();

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const variantById = new Map(variantRows.map((v) => [v.id, v]));

  const items: PricedCart["items"] = [];
  let subtotalCents = 0;
  let requiresShipping = false;

  // Merge duplicate lines first, so "2 + 3 of the same size" is checked against
  // stock as 5, not as two separate lots of stock that each look available.
  const merged = new Map<number, number>();
  for (const line of input) {
    const variantId = Number(line.variantId);
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isInteger(variantId) || !Number.isInteger(qty) || qty < 1) {
      throw new CartError("There's something wrong with your cart. Please empty it and try again.");
    }
    merged.set(variantId, (merged.get(variantId) ?? 0) + qty);
  }

  for (const [variantId, quantity] of merged) {
    const variant = variantById.get(variantId);
    if (!variant || !variant.isActive) {
      throw new CartError("One of the items in your cart is no longer available.");
    }
    const product = productById.get(variant.productId);
    if (!product || !product.isActive) {
      throw new CartError("One of the items in your cart is no longer available.");
    }

    if (quantity > product.maxPerOrder) {
      throw new CartError(`You can order at most ${product.maxPerOrder} of "${product.name}" at a time.`);
    }

    // stock === null means made to order / never runs out.
    if (variant.stock !== null && variant.stock !== undefined) {
      if (variant.stock <= 0) {
        throw new CartError(`"${product.name} — ${variant.label}" has sold out.`);
      }
      if (quantity > variant.stock) {
        throw new CartError(
          `Only ${variant.stock} left of "${product.name} — ${variant.label}". Please reduce the quantity.`,
        );
      }
    }

    // THE PRICE COMES FROM HERE — never from the request.
    const unitPriceCents = variant.priceCents ?? product.priceCents;
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new CartError(`"${product.name}" isn't priced correctly. Please contact the club.`);
    }
    if (unitPriceCents === 0) {
      throw new CartError(`"${product.name}" isn't on sale yet.`);
    }

    if (product.requiresShipping) requiresShipping = true;
    subtotalCents += unitPriceCents * quantity;

    items.push({
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      variantLabel: variant.label,
      unitPriceCents,
      quantity,
    });
  }

  const shippingCents = fulfilmentMethod === "shipping"
    ? shippingCostFor(subtotalCents, requiresShipping)
    : 0;

  return {
    lines: items.map((i) => ({
      name: i.variantLabel && i.variantLabel !== "One size"
        ? `${i.productName} — ${i.variantLabel}`
        : i.productName,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
    })),
    items,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    requiresShipping,
  };
}

/** Postage cost, honouring the club's "free over $X" threshold if they set one. */
export function shippingCostFor(subtotalCents: number, requiresShipping: boolean): number {
  if (!requiresShipping) return 0;
  const s = getSettingsSync();
  if (s.store_shipping_enabled !== "true") return 0;

  const freeOver = parseInt(s.store_free_shipping_over_cents ?? "", 10);
  if (Number.isInteger(freeOver) && freeOver > 0 && subtotalCents >= freeOver) return 0;

  const flat = parseInt(s.store_shipping_cents ?? "0", 10);
  return Number.isInteger(flat) && flat > 0 ? flat : 0;
}

/** A short, readable order reference the club can quote to a member. */
export function generateOrderReference(): string {
  const s = getSettingsSync();
  // Initials of the club name, e.g. "Subiaco Lions" -> "SL". Falls back to "ORD".
  const initials = (s.club_name ?? "")
    .split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "ORD";
  return `${initials}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Reduce stock for a paid order. Called once, when payment is confirmed.
 *
 * Stock is only ever reduced on CONFIRMED PAYMENT, not when the cart is
 * created. Reserving stock at checkout time sounds tidier but means an
 * abandoned cart quietly makes a size unbuyable until someone notices, which
 * for a club shop is worse than the rare case of two people paying for the
 * last jersey seconds apart.
 */
export function decrementStockForOrder(orderId: number): void {
  const lines = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();

  // All the stock changes for one order succeed or fail together, so an error
  // partway through can never leave some sizes decremented and others not.
  db.transaction((tx) => {
    for (const line of lines) {
      if (!line.variantId) continue;
      const [variant] = tx.select().from(productVariants)
        .where(eq(productVariants.id, line.variantId)).limit(1).all();
      if (!variant || variant.stock === null || variant.stock === undefined) continue;
      const remaining = Math.max(0, variant.stock - line.quantity);
      tx.update(productVariants).set({ stock: remaining })
        .where(eq(productVariants.id, line.variantId)).run();
    }
  });
}

/** Every product with its sizes attached. `activeOnly` for the public page. */
export function listProducts(activeOnly: boolean) {
  const productRows = activeOnly
    ? db.select().from(products).where(eq(products.isActive, true)).all()
    : db.select().from(products).all();

  const variantRows = db.select().from(productVariants).all();

  return productRows
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((p) => ({
      ...p,
      variants: variantRows
        .filter((v) => v.productId === p.id && (!activeOnly || v.isActive))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    }))
    // A product with no sizes can't be bought, so don't show it to customers.
    .filter((p) => !activeOnly || p.variants.length > 0);
}

/** One order with its lines, for the admin screen and confirmation emails. */
export function getOrderWithItems(orderId: number) {
  const [order] = db.select().from(orders).where(eq(orders.id, orderId)).limit(1).all();
  if (!order) return null;
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
  return { ...order, items };
}
