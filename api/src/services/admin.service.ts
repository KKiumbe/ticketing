import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { badRequest, conflict, notFound } from '../lib/errors';
import type { z } from 'zod';
import type { CategorySchema, EventSchema, UpdateCategorySchema, UpdateEventSchema } from '../schemas/admin.schema';
import { darajaService } from './daraja.service';
import { afterPayment, applyPayment, findOrderByRef, recordManualPayment, stateOf, ticketUrl } from './order.service';

const n = (v: Prisma.Decimal | null) => (v == null ? null : Number(v));

const serializeEvent = <T extends { gateMarkupPercent: Prisma.Decimal }>(e: T) => ({ ...e, gateMarkupPercent: Number(e.gateMarkupPercent) });

export const adminService = {
  // ---------- Events ----------
  async events() {
    return (await prisma.event.findMany({ orderBy: { startsAt: 'desc' } })).map(serializeEvent);
  },

  async event(id: number) {
    const e = await prisma.event.findUnique({ where: { id } });
    if (!e) throw notFound('Event not found');
    return serializeEvent(e);
  },

  async createEvent(d: z.infer<typeof EventSchema>) {
    if (await prisma.event.findUnique({ where: { slug: d.slug } })) throw conflict('That slug is already used');
    return serializeEvent(await prisma.event.create({ data: { ...d, fees: d.fees } }));
  },

  async updateEvent(id: number, d: z.infer<typeof UpdateEventSchema>) {
    await this.event(id);
    return serializeEvent(await prisma.event.update({ where: { id }, data: { ...d, ...(d.fees ? { fees: d.fees } : {}) } }));
  },

  // ---------- Categories ----------
  async categories(eventId: number) {
    const ev = await prisma.event.findUnique({ where: { id: eventId } });
    if (!ev) throw notFound('Event not found');
    const cats = await prisma.ticketCategory.findMany({ where: { eventId }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
    return Promise.all(
      cats.map(async (c) => ({ ...c, earlyBirdDiscountPercent: n(c.earlyBirdDiscountPercent), state: await stateOf(prisma, c, ev) })),
    );
  },

  async createCategory(eventId: number, d: z.infer<typeof CategorySchema>) {
    await this.event(eventId);
    const c = await prisma.ticketCategory.create({ data: { ...d, eventId } });
    return { ...c, earlyBirdDiscountPercent: n(c.earlyBirdDiscountPercent) };
  },

  async updateCategory(id: number, d: z.infer<typeof UpdateCategorySchema>) {
    if (!Object.keys(d).length) throw badRequest('Nothing to update');
    if (!(await prisma.ticketCategory.findUnique({ where: { id } }))) throw notFound('Category not found');
    const c = await prisma.ticketCategory.update({ where: { id }, data: d });
    return { ...c, earlyBirdDiscountPercent: n(c.earlyBirdDiscountPercent) };
  },

  // ---------- Dashboard ----------
  async stats(eventId: number) {
    const categories = await prisma.$queryRaw<Record<string, number | string>[]>`
      SELECT tc.id, tc.name, tc.capacity, tc.price,
        COALESCE(SUM(o.quantity) FILTER (WHERE o.status='PAID'),0)::int AS "paidTickets",
        COALESCE(SUM(o.quantity) FILTER (WHERE o.status='PARTIAL'),0)::int AS "polePoleTickets",
        COALESCE(SUM(o.quantity) FILTER (WHERE o.status='PENDING'),0)::int AS "pendingTickets",
        COALESCE(SUM(o.quantity) FILTER (WHERE o.is_early_bird AND o.status IN ('PAID','PARTIAL')),0)::int AS "earlyBirdTickets",
        COALESCE(SUM(o.quantity) FILTER (WHERE o.sale_channel='GATE' AND o.status='PAID'),0)::int AS "gateTickets",
        COALESCE(SUM(o.amount_paid) FILTER (WHERE o.status <> 'CANCELLED'),0)::int AS "collected",
        COALESCE(SUM(o.total_amount - o.amount_paid) FILTER (WHERE o.status='PARTIAL'),0)::int AS "outstanding",
        COALESCE(SUM(o.fees_amount) FILTER (WHERE o.status='PAID'),0)::int AS "feesCollected",
        (SELECT count(*) FROM tickets t WHERE t.category_id=tc.id AND t.status='CHECKED_IN')::int AS "checkedIn"
      FROM ticket_categories tc LEFT JOIN orders o ON o.category_id=tc.id
      WHERE tc.event_id=${eventId} GROUP BY tc.id ORDER BY tc.sort_order, tc.price`;
    const keys = ['capacity', 'paidTickets', 'polePoleTickets', 'pendingTickets', 'earlyBirdTickets', 'gateTickets', 'collected', 'outstanding', 'feesCollected', 'checkedIn'] as const;
    const totals = Object.fromEntries(keys.map((k) => [k, categories.reduce((a, c) => a + Number(c[k]), 0)]));
    const unmatched = await prisma.payment.aggregate({ where: { orderId: null }, _count: true, _sum: { amount: true } });
    return { categories, totals, unmatchedPayments: { count: unmatched._count, amount: unmatched._sum.amount ?? 0 } };
  },

  // ---------- Orders ----------
  async orders(eventId: number, q?: string, status?: string) {
    const term = q?.trim();
    return prisma.order.findMany({
      where: {
        eventId,
        ...(status ? { status } : {}),
        ...(term ? { OR: ['ref', 'buyerName', 'phone', 'email'].map((f) => ({ [f]: { contains: term, mode: 'insensitive' } })) } : {}),
      },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  },

  async order(ref: string) {
    const o = await prisma.order.findUnique({
      where: { ref: ref.trim().toUpperCase() },
      include: { category: true, event: true, payments: { orderBy: { createdAt: 'desc' } }, tickets: { orderBy: { seq: 'asc' } } },
    });
    if (!o) throw notFound('Order not found');
    return {
      ...o,
      gateMarkupPercent: n(o.gateMarkupPercent),
      event: serializeEvent(o.event),
      category: { ...o.category, earlyBirdDiscountPercent: n(o.category.earlyBirdDiscountPercent) },
      payments: o.payments.map(({ raw: _raw, ...p }) => p),
      tickets: o.tickets.map((t) => ({ ...t, url: ticketUrl(t.code) })),
    };
  },

  async attendeesCsv(eventId: number) {
    const tickets = await prisma.ticket.findMany({
      where: { eventId },
      include: { order: true, category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { order: { ref: 'asc' } }, { seq: 'asc' }],
    });
    const cols = ['ref', 'category', 'name', 'phone', 'email', 'seq', 'status', 'checkedInAt', 'earlyBird', 'plan', 'channel'];
    const esc = (v: unknown) => `"${String(v instanceof Date ? v.toISOString() : (v ?? '')).replace(/"/g, '""')}"`;
    const rows = tickets.map((t) =>
      [t.order.ref, t.category.name, t.holderName ?? t.order.buyerName, t.order.phone, t.order.email, t.seq, t.status,
        t.checkedInAt, t.order.isEarlyBird, t.order.paymentPlan, t.order.saleChannel].map(esc).join(','),
    );
    return [cols.join(','), ...rows].join('\n');
  },

  async manualPayment(ref: string, amount: number, note?: string) {
    const o = await findOrderByRef(ref);
    if (o.status === 'CANCELLED') throw badRequest('Order is cancelled');
    const r = await recordManualPayment(o.id, amount, note || 'Manual entry');
    await afterPayment(o.id, amount, r.justPaid);
    return r.order;
  },

  async resend(ref: string) {
    const o = await findOrderByRef(ref);
    if (o.amountPaid === 0 && o.status !== 'PAID') throw badRequest('Nothing paid yet, so there is nothing to resend');
    await afterPayment(o.id, 0, false);
    return { ok: true };
  },

  async cancel(ref: string) {
    const o = await findOrderByRef(ref);
    await prisma.$transaction([
      prisma.order.update({ where: { id: o.id }, data: { status: 'CANCELLED' } }),
      prisma.ticket.updateMany({ where: { orderId: o.id, status: 'VALID' }, data: { status: 'VOID' } }),
    ]);
    return { ok: true, note: o.amountPaid ? `KES ${o.amountPaid} was paid. Refund manually if needed` : undefined };
  },

  async setHolderName(code: string, holderName: string | null) {
    const t = await prisma.ticket.findUnique({ where: { code } });
    if (!t) throw notFound('Ticket not found');
    return prisma.ticket.update({ where: { code }, data: { holderName: holderName || null }, select: { code: true, holderName: true } });
  },

  // ---------- Payments ----------
  unmatchedPayments() {
    return prisma.payment.findMany({
      where: { orderId: null },
      select: { id: true, accountRef: true, amount: true, phone: true, mpesaReceipt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Customer typed a wrong account number on Paybill. Attach it to the right order. */
  async assignPayment(paymentId: number, ref: string) {
    const o = await findOrderByRef(ref);
    const r = await prisma.$transaction(async (tx) => {
      const up = await tx.payment.updateMany({ where: { id: paymentId, orderId: null }, data: { orderId: o.id } });
      if (!up.count) throw badRequest('Payment not found or already assigned');
      const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      return { ...(await applyPayment(tx, o.id, p.amount)), amount: p.amount };
    });
    await afterPayment(o.id, r.amount, r.justPaid);
    return r.order;
  },

  registerC2B: () => darajaService.registerC2BUrls(),
};
