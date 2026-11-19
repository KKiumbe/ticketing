// Mirrors api/src/lib/pricing.ts computeFees so the checkout shows the same total the server charges.
import type { FeeLine, FeeRule } from './types';

export function feeLines(fees: FeeRule[], subtotal: number, quantity: number, channel: 'ONLINE' | 'GATE' = 'ONLINE'): FeeLine[] {
  return fees
    .filter((f) => !f.appliesTo || f.appliesTo === 'ALL' || f.appliesTo === channel)
    .map((f) => ({
      name: f.name, type: f.type, value: f.value,
      amount: f.type === 'percent' ? Math.round((subtotal * f.value) / 100) : Math.round(f.value * (f.perTicket ? quantity : 1)),
    }))
    .filter((l) => l.amount > 0);
}
