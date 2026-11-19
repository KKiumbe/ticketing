// Pure pricing rules. No DB access, so they are unit-tested in pricing.spec.ts
// and mirrored on the web checkout (web/lib/pricing.ts) for the live total.
import type { FeeLine, FeeRule, SaleChannel } from './types';

const DAY = 24 * 3600 * 1000;

export type PricedCategory = {
  price: number;
  capacity: number;
  earlyBirdPrice: number | null;
  earlyBirdDiscountPercent: number | null;
  earlyBirdEndsAt: Date | null;
  earlyBirdDaysBefore: number | null;
  earlyBirdQuota: number | null;
  allowInstallments: boolean;
  installmentDeadline: Date | null;
};

/** Earliest of the fixed date and "N days before the event" */
export function earlyBirdEndsAt(cat: PricedCategory, eventStartsAt: Date): Date | null {
  const ends: number[] = [];
  if (cat.earlyBirdEndsAt) ends.push(cat.earlyBirdEndsAt.getTime());
  if (cat.earlyBirdDaysBefore != null) ends.push(eventStartsAt.getTime() - cat.earlyBirdDaysBefore * DAY);
  return ends.length ? new Date(Math.min(...ends)) : null;
}

/** Fixed early-bird price wins; otherwise regular price minus discount % */
export function earlyBirdPrice(cat: PricedCategory): number | null {
  if (cat.earlyBirdPrice != null) return cat.earlyBirdPrice;
  if (cat.earlyBirdDiscountPercent != null && cat.earlyBirdDiscountPercent > 0)
    return Math.round(cat.price * (1 - cat.earlyBirdDiscountPercent / 100));
  return null;
}

/** Regular price + markup %, rounded to the shilling */
export const gatePrice = (price: number, markupPercent: number) => Math.round(price * (1 + (markupPercent || 0) / 100));

export function computeFees(fees: FeeRule[], subtotal: number, quantity: number, channel: SaleChannel) {
  const lines: FeeLine[] = [];
  for (const f of Array.isArray(fees) ? fees : []) {
    const applies = !f.appliesTo || f.appliesTo === 'ALL' || f.appliesTo === channel;
    const value = Number(f.value);
    if (!applies || !(value > 0)) continue;
    const amount = f.type === 'percent' ? Math.round((subtotal * value) / 100) : Math.round(value * (f.perTicket ? quantity : 1));
    if (amount > 0) lines.push({ name: f.name || 'Fee', type: f.type, value, amount });
  }
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0) };
}

export type CategoryState = {
  sold: number;
  remaining: number;
  earlyBirdActive: boolean;
  earlyBirdLeft: number | null;
  earlyBirdEndsAt: Date | null;
  earlyBirdPrice: number | null;
  currentPrice: number;
  gatePrice: number;
  installmentsOpen: boolean;
};

export function categoryState(
  cat: PricedCategory,
  ctx: { sold: number; earlyBirdSold: number; eventStartsAt: Date; gateMarkupPercent: number; now?: Date },
): CategoryState {
  const now = ctx.now ?? new Date();
  const ebPrice = earlyBirdPrice(cat);
  const ebEnds = earlyBirdEndsAt(cat, ctx.eventStartsAt);
  const ebLeft = cat.earlyBirdQuota == null ? null : Math.max(0, cat.earlyBirdQuota - ctx.earlyBirdSold);
  const earlyBirdActive = ebPrice != null && (!ebEnds || now < ebEnds) && (ebLeft === null || ebLeft > 0);
  return {
    sold: ctx.sold,
    remaining: Math.max(0, cat.capacity - ctx.sold),
    earlyBirdActive,
    earlyBirdLeft: ebLeft,
    earlyBirdEndsAt: ebEnds,
    earlyBirdPrice: ebPrice,
    currentPrice: earlyBirdActive && ebPrice != null ? ebPrice : cat.price,
    gatePrice: gatePrice(cat.price, ctx.gateMarkupPercent),
    installmentsOpen: cat.allowInstallments && (!cat.installmentDeadline || now < cat.installmentDeadline),
  };
}

/** Minimum first payment for a pole pole order */
export const minFirstPayment = (total: number, minDepositPerTicket: number, quantity: number) =>
  Math.min(total, minDepositPerTicket * quantity);
