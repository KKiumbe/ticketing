import { categoryState, computeFees, earlyBirdEndsAt, earlyBirdPrice, gatePrice, PricedCategory } from './pricing';

const base: PricedCategory = {
  price: 1500, capacity: 100, earlyBirdPrice: 1000, earlyBirdDiscountPercent: null, earlyBirdEndsAt: null,
  earlyBirdDaysBefore: 3, earlyBirdQuota: 40, allowInstallments: true, installmentDeadline: null,
};
const event = new Date('2026-12-04T11:00:00Z');

describe('pricing', () => {
  it('ends early bird N days before the event, or at the fixed date if earlier', () => {
    expect(earlyBirdEndsAt(base, event)?.toISOString()).toBe('2026-12-01T11:00:00.000Z');
    const fixed = { ...base, earlyBirdEndsAt: new Date('2026-11-20T00:00:00Z') };
    expect(earlyBirdEndsAt(fixed, event)?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('uses a fixed early-bird price before a discount %', () => {
    expect(earlyBirdPrice({ ...base, earlyBirdDiscountPercent: 50 })).toBe(1000);
    expect(earlyBirdPrice({ ...base, earlyBirdPrice: null, earlyBirdDiscountPercent: 20 })).toBe(1200);
    expect(earlyBirdPrice({ ...base, earlyBirdPrice: null })).toBeNull();
  });

  it('adds the gate markup', () => expect(gatePrice(1500, 20)).toBe(1800));

  it('computes percent, fixed and per-ticket fees for the right channel', () => {
    const fees = computeFees(
      [
        { name: 'Processing', type: 'percent', value: 2.5, appliesTo: 'ALL' },
        { name: 'Service', type: 'fixed', value: 50, perTicket: true, appliesTo: 'ONLINE' },
        { name: 'Door', type: 'fixed', value: 100, appliesTo: 'GATE' },
      ],
      3000, 2, 'ONLINE',
    );
    expect(fees.lines.map((l) => l.amount)).toEqual([75, 100]);
    expect(fees.total).toBe(175);
  });

  it('turns early bird off when the quota is used up or the date passes', () => {
    const ctx = { sold: 50, earlyBirdSold: 10, eventStartsAt: event, gateMarkupPercent: 20, now: new Date('2026-11-19T00:00:00Z') };
    const s = categoryState(base, ctx);
    expect(s).toMatchObject({ earlyBirdActive: true, currentPrice: 1000, earlyBirdLeft: 30, remaining: 50, gatePrice: 1800 });
    expect(categoryState(base, { ...ctx, earlyBirdSold: 40 }).currentPrice).toBe(1500);
    expect(categoryState(base, { ...ctx, now: new Date('2026-12-02T00:00:00Z') }).earlyBirdActive).toBe(false);
  });
});
