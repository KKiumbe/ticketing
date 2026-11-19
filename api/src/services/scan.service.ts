// Gate: check-in and walk-in sales.
import prisma from '../lib/prisma';
import { badRequest } from '../lib/errors';
import type { ScanResult } from '../lib/types';
import { extractTicketCode, normalizePhone } from '../lib/util';
import { createOrder, eventFees, recordManualPayment, startStk, stateOf } from './order.service';

export const scanService = {
  async events() {
    const events = await prisma.event.findMany({ orderBy: { startsAt: 'desc' }, take: 20 });
    return Promise.all(
      events.map(async (e) => ({
        id: e.id, name: e.name, startsAt: e.startsAt, venue: e.venue,
        issued: await prisma.ticket.count({ where: { eventId: e.id, status: { not: 'VOID' } } }),
        checkedIn: await prisma.ticket.count({ where: { eventId: e.id, status: 'CHECKED_IN' } }),
      })),
    );
  },

  async validate(rawCode: string, eventId: number | undefined, gate: string | null) {
    const code = extractTicketCode(rawCode);
    const t = await prisma.ticket.findUnique({ where: { code }, include: { category: true, order: true, event: true } });
    const log = (result: ScanResult, ticketId: number | null = null) =>
      prisma.scanLog.create({ data: { code, ticketId, result, gate } });

    if (!t) {
      await log('INVALID');
      return { ok: false, result: 'INVALID' as const, message: 'Ticket not found' };
    }
    const info = {
      category: t.category.name, name: t.holderName ?? t.order.buyerName, ref: t.order.ref,
      seq: t.seq, of: t.order.quantity, event: t.event.name,
    };
    if (eventId && t.eventId !== eventId) {
      await log('WRONG_EVENT', t.id);
      return { ok: false, result: 'WRONG_EVENT' as const, message: `Ticket is for ${t.event.name}`, ...info };
    }
    if (t.status === 'VOID') {
      await log('VOID', t.id);
      return { ok: false, result: 'VOID' as const, message: 'Ticket cancelled', ...info };
    }
    // Atomic: only one scan can flip VALID -> CHECKED_IN, even with two gates at once
    const up = await prisma.ticket.updateMany({
      where: { id: t.id, status: 'VALID' },
      data: { status: 'CHECKED_IN', checkedInAt: new Date(), checkedInBy: gate },
    });
    if (up.count) {
      await log('OK', t.id);
      return { ok: true, result: 'OK' as const, message: 'Welcome!', ...info };
    }
    const fresh = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    await log('ALREADY_USED', t.id);
    return {
      ok: false, result: 'ALREADY_USED' as const, message: 'Already checked in',
      checkedInAt: fresh.checkedInAt, checkedInBy: fresh.checkedInBy, ...info,
    };
  },

  async gatePrices(eventId: number) {
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    const cats = await prisma.ticketCategory.findMany({ where: { eventId }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
    const fees = eventFees(ev).filter((f) => f.appliesTo !== 'ONLINE');
    return Promise.all(
      cats.map(async (c) => {
        const s = await stateOf(prisma, c, ev);
        return { id: c.id, name: c.name, regularPrice: c.price, gatePrice: s.gatePrice, remaining: s.remaining, markupPercent: Number(ev.gateMarkupPercent), fees };
      }),
    );
  },

  async sell(b: { eventId: number; categoryId: number; quantity: number; buyerName?: string; phone?: string; method: 'MPESA' | 'CASH' }, gate: string | null) {
    const phone = normalizePhone(b.phone) || (b.method === 'CASH' ? '254700000000' : null);
    if (!phone) throw badRequest('Enter a valid M-Pesa number');
    const { order } = await createOrder({
      eventId: b.eventId, categoryId: b.categoryId, buyerName: b.buyerName || 'Walk-in', phone,
      quantity: b.quantity, plan: 'FULL', channel: 'GATE', soldBy: gate,
    });
    if (b.method === 'CASH') {
      const r = await recordManualPayment(order.id, order.totalAmount, `Cash at gate${gate ? ` – ${gate}` : ''}`);
      return { ref: order.ref, total: order.totalAmount, quantity: order.quantity, status: r.order.status };
    }
    const stk = await startStk(order);
    return { ref: order.ref, total: order.totalAmount, quantity: order.quantity, status: order.status, checkoutRequestId: stk.checkoutRequestId };
  },
};
