// Orders, seats, payments and ticket issuing. Shared by the public, gate and admin flows.
import type { Event, Order, TicketCategory } from '@prisma/client';
import prisma, { Tx } from '../lib/prisma';
import { env } from '../lib/env';
import { AppError, badRequest, conflict, notFound } from '../lib/errors';
import { categoryState, CategoryState, computeFees, minFirstPayment, PricedCategory } from '../lib/pricing';
import { ACTIVE_STATUSES, FeeRule, PaymentPlan, SaleChannel } from '../lib/types';
import { normalizePhone, orderRef, ticketCode } from '../lib/util';
import { darajaService } from './daraja.service';
import { notifyService } from './notify.service';

type Db = Tx | typeof prisma;

export const toPriced = (c: TicketCategory): PricedCategory => ({
  price: c.price,
  capacity: c.capacity,
  earlyBirdPrice: c.earlyBirdPrice,
  earlyBirdDiscountPercent: c.earlyBirdDiscountPercent == null ? null : Number(c.earlyBirdDiscountPercent),
  earlyBirdEndsAt: c.earlyBirdEndsAt,
  earlyBirdDaysBefore: c.earlyBirdDaysBefore,
  earlyBirdQuota: c.earlyBirdQuota,
  allowInstallments: c.allowInstallments,
  installmentDeadline: c.installmentDeadline,
});

export const eventFees = (e: Pick<Event, 'fees'>): FeeRule[] => (Array.isArray(e.fees) ? (e.fees as unknown as FeeRule[]) : []);

/** Live price and availability for a category */
export async function stateOf(db: Db, cat: TicketCategory, event: Pick<Event, 'startsAt' | 'gateMarkupPercent'>): Promise<CategoryState> {
  const where = { categoryId: cat.id, status: { in: ACTIVE_STATUSES } };
  const [all, eb] = await Promise.all([
    db.order.aggregate({ where, _sum: { quantity: true } }),
    db.order.aggregate({ where: { ...where, isEarlyBird: true }, _sum: { quantity: true } }),
  ]);
  return categoryState(toPriced(cat), {
    sold: all._sum.quantity ?? 0,
    earlyBirdSold: eb._sum.quantity ?? 0,
    eventStartsAt: event.startsAt,
    gateMarkupPercent: Number(event.gateMarkupPercent),
  });
}

export type CreateOrderInput = {
  eventId: number;
  categoryId: number;
  buyerName: string;
  phone: string;
  email?: string | null;
  quantity: number;
  plan: PaymentPlan;
  firstAmount?: number | null;
  channel?: SaleChannel;
  soldBy?: string | null;
};

/** ONLINE: early bird / pole pole apply. GATE: regular price + gate markup, paid in full. */
export async function createOrder(input: CreateOrderInput) {
  const channel = input.channel ?? 'ONLINE';
  const gate = channel === 'GATE';
  return prisma.$transaction(async (tx) => {
    // Lock the category row so two buyers can't take the last seat or last early-bird slot
    await tx.$queryRaw`SELECT id FROM ticket_categories WHERE id = ${input.categoryId} FOR UPDATE`;
    const cat = await tx.ticketCategory.findFirst({ where: { id: input.categoryId, eventId: input.eventId }, include: { event: true } });
    if (!cat) throw notFound('Ticket category not found');
    if (!gate && !cat.salesOpen) throw badRequest('Online sales for this category are closed');
    if (!gate && cat.event.startsAt < new Date()) throw badRequest('Online sales have closed. Tickets are available at the gate');

    const st = await stateOf(tx, cat, cat.event);
    if (input.quantity > st.remaining) throw conflict(st.remaining ? `Only ${st.remaining} tickets left` : 'Sold out');

    let plan = input.plan;
    let earlyBird = false;
    let unit: number;
    if (gate) {
      plan = 'FULL';
      unit = st.gatePrice;
    } else {
      // Early bird only if the whole order fits in what's left of the early-bird quota
      earlyBird = st.earlyBirdActive && (st.earlyBirdLeft === null || input.quantity <= st.earlyBirdLeft);
      unit = earlyBird && st.earlyBirdPrice != null ? st.earlyBirdPrice : cat.price;
    }
    const subtotal = unit * input.quantity;
    const fees = computeFees(eventFees(cat.event), subtotal, input.quantity, channel);
    const total = subtotal + fees.total;

    if (plan === 'INSTALLMENT' && !st.installmentsOpen) throw badRequest('Lipa pole pole is not available for this ticket');
    const minFirst = plan === 'INSTALLMENT' ? minFirstPayment(total, cat.minDeposit, input.quantity) : total;
    if (plan === 'INSTALLMENT' && input.firstAmount != null) {
      if (input.firstAmount < minFirst) throw badRequest(`Minimum deposit is KES ${minFirst}`);
      if (input.firstAmount > total) throw badRequest(`Total is only KES ${total}`);
    }

    const order = await tx.order.create({
      data: {
        ref: orderRef(gate ? 'GT' : 'TK'),
        eventId: input.eventId,
        categoryId: input.categoryId,
        buyerName: input.buyerName,
        phone: input.phone,
        email: input.email || null,
        quantity: input.quantity,
        unitPrice: unit,
        subtotal,
        feesAmount: fees.total,
        feeBreakdown: fees.lines,
        totalAmount: total,
        isEarlyBird: earlyBird,
        paymentPlan: plan,
        saleChannel: channel,
        gateMarkupPercent: gate ? cat.event.gateMarkupPercent : null,
        soldBy: input.soldBy ?? null,
      },
    });
    return { order, minFirstPayment: minFirst };
  });
}

/** Amount for the next STK push */
export async function validatePaymentAmount(order: Order, requested?: number | null): Promise<number> {
  const balance = order.totalAmount - order.amountPaid;
  if (balance <= 0) throw badRequest('This order is already fully paid');
  if (order.paymentPlan === 'FULL') return balance;
  const amt = Math.round(Number(requested) || balance);
  if (amt < 1) throw badRequest('Invalid amount');
  if (amt > balance) throw badRequest(`Balance is only KES ${balance}`);
  if (order.amountPaid === 0) {
    const cat = await prisma.ticketCategory.findUniqueOrThrow({ where: { id: order.categoryId } });
    const minFirst = minFirstPayment(balance, cat.minDeposit, order.quantity);
    if (amt < minFirst) throw badRequest(`Minimum deposit is KES ${minFirst}`);
  }
  return amt;
}

/**
 * Credit money to an order (STK callback, C2B confirmation, cash/manual entry).
 * Must run inside a transaction. Issues tickets when the order becomes fully paid.
 */
export async function applyPayment(tx: Tx, orderId: number, amount: number) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const paid = o.amountPaid + amount;
  let status = o.status;
  let justPaid = false;
  if (paid >= o.totalAmount) {
    justPaid = o.status !== 'PAID';
    status = 'PAID';
  } else if (paid > 0) {
    status = 'PARTIAL'; // also revives an EXPIRED order when money arrives late
  }
  const order = await tx.order.update({
    where: { id: orderId },
    data: { amountPaid: paid, status, ...(justPaid ? { paidAt: new Date() } : {}) },
  });
  if (justPaid) await issueTickets(tx, order);
  return { order, justPaid };
}

async function issueTickets(tx: Tx, order: Order) {
  // Gate buyers are standing at the door, so their tickets are checked in straight away
  const gate = order.saleChannel === 'GATE';
  const existing = new Set((await tx.ticket.findMany({ where: { orderId: order.id }, select: { seq: true } })).map((t) => t.seq));
  for (let seq = 1; seq <= order.quantity; seq++) {
    if (existing.has(seq)) continue;
    await tx.ticket.create({
      data: {
        orderId: order.id,
        eventId: order.eventId,
        categoryId: order.categoryId,
        code: ticketCode(),
        seq,
        holderName: seq === 1 ? order.buyerName : null,
        status: gate ? 'CHECKED_IN' : 'VALID',
        checkedInAt: gate ? new Date() : null,
        checkedInBy: gate ? `Gate sale${order.soldBy ? ` – ${order.soldBy}` : ''}` : null,
      },
    });
  }
}

/** After commit: tell the buyer. Never throws. */
export async function afterPayment(orderId: number, amount: number, justPaid: boolean) {
  try {
    const o = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { event: true, category: true, tickets: { orderBy: { seq: 'asc' } } },
    });
    const n = { ...o, eventName: o.event.name, categoryName: o.category.name };
    if (justPaid || o.status === 'PAID') await notifyService.ticketsIssued(n, o.tickets.map((t) => t.code));
    else await notifyService.installmentReceived(n, amount);
  } catch (e) {
    console.error('[notify] after payment failed', (e as Error).message);
  }
}

export async function findOrderByRef(ref: string) {
  const order = await prisma.order.findUnique({ where: { ref: String(ref).trim().toUpperCase() } });
  if (!order) throw notFound('Order not found');
  return order;
}

/** Send an STK push for this order and record the pending payment */
export async function startStk(order: Order, amount?: number | null, phoneOverride?: string | null) {
  if (order.status === 'CANCELLED') throw badRequest('This order was cancelled');
  const amt = await validatePaymentAmount(order, amount);
  const phone = normalizePhone(phoneOverride) || order.phone;
  const resp = await darajaService.stkPush({
    phone,
    amount: amt,
    accountRef: order.ref,
    description: `${order.saleChannel === 'GATE' ? 'Gate' : 'Ticket'} ${order.ref}`,
  });
  await prisma.payment.create({
    data: {
      orderId: order.id,
      channel: 'STK',
      amount: amt,
      phone,
      merchantRequestId: resp.MerchantRequestID,
      checkoutRequestId: resp.CheckoutRequestID,
      status: 'PENDING',
    },
  });
  return { checkoutRequestId: resp.CheckoutRequestID, amount: amt, message: 'Check your phone and enter your M-Pesa PIN' };
}

/** Record a cash / bank / complimentary payment */
export async function recordManualPayment(orderId: number, amount: number, note: string) {
  if (!(amount >= 0)) throw badRequest('Invalid amount');
  const result = await prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { orderId, channel: 'MANUAL', amount, status: 'SUCCESS', resultDesc: note, completedAt: new Date() } });
    return applyPayment(tx, orderId, amount);
  });
  return result;
}

export const ticketUrl = (code: string) => `${env.webBaseUrl}/t/${code}`;
export const orderUrl = (ref: string) => `${env.webBaseUrl}/o/${ref}`;

export function assertFound<T>(v: T | null | undefined, msg: string): T {
  if (v == null) throw new AppError(404, msg);
  return v;
}
