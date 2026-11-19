// Buyer-facing reads and the online checkout.
import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { env } from '../lib/env';
import { notFound } from '../lib/errors';
import type { CreateOrderBody } from '../schemas/public.schema';
import { maskPhone } from '../lib/util';
import { darajaService } from './daraja.service';
import { afterPayment, applyPayment, createOrder, eventFees, findOrderByRef, startStk, stateOf, ticketUrl } from './order.service';

async function publishedEvent(slug: string) {
  const ev = await prisma.event.findFirst({ where: { slug: slug.toLowerCase(), isPublished: true } });
  if (!ev) throw notFound('Event not found');
  return ev;
}

export const publicService = {
  config() {
    return { defaultEvent: env.defaultEventSlug, paybill: darajaService.paybill(), simulate: env.mpesa.simulate };
  },

  async event(slug: string) {
    const ev = await publishedEvent(slug);
    const cats = await prisma.ticketCategory.findMany({ where: { eventId: ev.id }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
    const categories = [];
    for (const c of cats) {
      const s = await stateOf(prisma, c, ev);
      categories.push({
        id: c.id, name: c.name, description: c.description, price: c.price,
        currentPrice: s.currentPrice, earlyBirdActive: s.earlyBirdActive, earlyBirdPrice: s.earlyBirdPrice,
        earlyBirdEndsAt: s.earlyBirdEndsAt, earlyBirdLeft: s.earlyBirdLeft, gatePrice: s.gatePrice,
        remaining: s.remaining, soldOut: s.remaining === 0, salesOpen: c.salesOpen,
        installments: s.installmentsOpen, minDeposit: c.minDeposit, installmentDeadline: c.installmentDeadline,
      });
    }
    return {
      event: {
        id: ev.id, slug: ev.slug, name: ev.name, description: ev.description, venue: ev.venue,
        startsAt: ev.startsAt, bannerUrl: ev.bannerUrl, gateMarkupPercent: Number(ev.gateMarkupPercent),
        salesClosed: ev.startsAt < new Date(),
        fees: eventFees(ev).filter((f) => f.appliesTo !== 'GATE'),
      },
      categories,
    };
  },

  async createOrder(slug: string, body: CreateOrderBody) {
    const ev = await publishedEvent(slug);
    const firstAmount = body.plan === 'INSTALLMENT' && body.amount != null ? body.amount : null;
    const { order, minFirstPayment } = await createOrder({
      eventId: ev.id, categoryId: body.categoryId, buyerName: body.buyerName, phone: body.phone,
      email: body.email, quantity: body.quantity, plan: body.plan, firstAmount,
    });
    let stk: { checkoutRequestId?: string; amount?: number; message?: string; error?: string } | null = null;
    if (order.totalAmount === 0) {
      const r = await prisma.$transaction((tx) => applyPayment(tx, order.id, 0)); // free tickets
      void afterPayment(order.id, 0, r.justPaid);
    } else {
      stk = await startStk(order, firstAmount).catch((e: Error) => ({ error: e.message }));
    }
    return {
      ref: order.ref, subtotal: order.subtotal, fees: order.feeBreakdown, total: order.totalAmount,
      earlyBird: order.isEarlyBird, minFirstPayment, stk,
    };
  },

  async order(ref: string) {
    const o = await prisma.order.findUnique({
      where: { ref: ref.trim().toUpperCase() },
      include: {
        event: true, category: true,
        payments: { orderBy: { createdAt: 'desc' } },
        tickets: { orderBy: { seq: 'asc' } },
      },
    });
    if (!o) throw notFound('Order not found');
    return {
      ref: o.ref, status: o.status, plan: o.paymentPlan, buyerName: o.buyerName, phoneMasked: maskPhone(o.phone),
      event: { name: o.event.name, slug: o.event.slug, startsAt: o.event.startsAt, venue: o.event.venue },
      category: o.category.name, quantity: o.quantity, unitPrice: o.unitPrice, earlyBird: o.isEarlyBird,
      subtotal: o.subtotal ?? o.totalAmount, fees: o.feeBreakdown, feesAmount: o.feesAmount, channel: o.saleChannel,
      total: o.totalAmount, paid: o.amountPaid, balance: Math.max(0, o.totalAmount - o.amountPaid),
      paybill: darajaService.paybill(),
      simulate: env.mpesa.simulate,
      payments: o.payments.map((p) => ({
        id: p.checkoutRequestId, channel: p.channel, amount: p.amount, status: p.status,
        receipt: p.mpesaReceipt, resultDesc: p.resultDesc, createdAt: p.createdAt,
      })),
      tickets: o.status === 'PAID'
        ? o.tickets.map((t) => ({ code: t.code, seq: t.seq, status: t.status, holderName: t.holderName, url: ticketUrl(t.code) }))
        : [],
    };
  },

  async pay(ref: string, amount?: number | null, phone?: string | null) {
    return startStk(await findOrderByRef(ref), amount, phone);
  },

  async ticket(code: string) {
    const t = await prisma.ticket.findUnique({ where: { code }, include: { order: true, event: true, category: true } });
    if (!t) throw notFound('Ticket not found');
    const qr = await QRCode.toDataURL(ticketUrl(t.code), { width: 480, margin: 1, errorCorrectionLevel: 'M' });
    return {
      code: t.code, seq: t.seq, of: t.order.quantity, status: t.status, holderName: t.holderName ?? t.order.buyerName,
      checkedInAt: t.checkedInAt, ref: t.order.ref, category: t.category.name,
      event: { name: t.event.name, startsAt: t.event.startsAt, venue: t.event.venue },
      qr,
    };
  },
};
