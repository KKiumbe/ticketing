// M-Pesa results: STK callback, STK query fallback, Paybill (C2B), dev simulator.
import prisma from '../lib/prisma';
import { env } from '../lib/env';
import { notFound } from '../lib/errors';
import { darajaService, StkCallback } from './daraja.service';
import { afterPayment, applyPayment } from './order.service';

type Credited = { orderId: number; amount: number; justPaid: boolean } | null;

export const paymentService = {
  /** Idempotent: Safaricom retries callbacks, and the query fallback may race the callback */
  async handleStkResult(cb: StkCallback, opts: { fromQuery?: boolean } = {}): Promise<Credited> {
    const meta = darajaService.parseStkMetadata(cb);
    const result = await prisma.$transaction(async (tx): Promise<Credited> => {
      await tx.$queryRaw`SELECT id FROM payments WHERE checkout_request_id = ${cb.CheckoutRequestID} FOR UPDATE`;
      const p = await tx.payment.findUnique({ where: { checkoutRequestId: cb.CheckoutRequestID } });
      if (!p || p.status !== 'PENDING' || p.orderId == null) return null;

      if (Number(cb.ResultCode) !== 0) {
        await tx.payment.update({
          where: { id: p.id },
          data: { status: 'FAILED', resultDesc: cb.ResultDesc, raw: cb as object, completedAt: new Date() },
        });
        return null;
      }
      const amount = Math.round(Number(meta.Amount ?? p.amount));
      const receipt = meta.MpesaReceiptNumber ? String(meta.MpesaReceiptNumber) : null;

      // Same receipt already recorded via C2B? Don't credit twice.
      if (receipt && (await tx.payment.findUnique({ where: { mpesaReceipt: receipt } }))) {
        await tx.payment.update({
          where: { id: p.id },
          data: { status: 'SUCCESS', resultDesc: 'Duplicate of C2B record', raw: cb as object, completedAt: new Date() },
        });
        return null;
      }
      await tx.payment.update({
        where: { id: p.id },
        data: {
          status: 'SUCCESS', amount, mpesaReceipt: receipt, raw: cb as object, completedAt: new Date(),
          resultDesc: cb.ResultDesc + (opts.fromQuery ? ' (via query)' : ''),
        },
      });
      const { justPaid } = await applyPayment(tx, p.orderId, amount);
      return { orderId: p.orderId, amount, justPaid };
    });
    if (result) void afterPayment(result.orderId, result.amount, result.justPaid);
    return result;
  },

  /** If a callback never arrived, ask Safaricom directly about STK pushes older than 30s */
  async checkPending(orderId: number) {
    if (env.mpesa.simulate) return { checked: 0 };
    const pending = await prisma.payment.findMany({
      where: {
        orderId, channel: 'STK', status: 'PENDING',
        createdAt: { lt: new Date(Date.now() - 30_000), gt: new Date(Date.now() - 24 * 3600_000) },
      },
    });
    let checked = 0;
    for (const p of pending) {
      try {
        const q = await darajaService.stkQuery(p.checkoutRequestId!);
        if (q.ResultCode !== undefined && q.ResultCode !== null) {
          await this.handleStkResult(
            { CheckoutRequestID: p.checkoutRequestId!, ResultCode: Number(q.ResultCode), ResultDesc: q.ResultDesc ?? '' },
            { fromQuery: true },
          );
          checked++;
        }
      } catch {
        /* still processing on Safaricom's side */
      }
    }
    return { checked };
  },

  async c2bValidate(billRef: string) {
    const ref = billRef.trim().toUpperCase();
    const o = await prisma.order.findUnique({ where: { ref } });
    return Boolean(o && o.status !== 'CANCELLED' && o.amountPaid < o.totalAmount);
  },

  /** Customer paid from the M-Pesa menu with the order ref as account number */
  async c2bConfirm(b: { BillRefNumber?: string; TransAmount?: string | number; MSISDN?: string | number; TransID?: string }) {
    const ref = String(b.BillRefNumber ?? '').trim().toUpperCase();
    const amount = Math.round(Number(b.TransAmount));
    if (!b.TransID || !(amount > 0)) return;
    const result = await prisma.$transaction(async (tx): Promise<Credited> => {
      if (await tx.payment.findUnique({ where: { mpesaReceipt: b.TransID } })) return null;
      const order = await tx.order.findUnique({ where: { ref } });
      await tx.payment.create({
        data: {
          orderId: order?.id ?? null, accountRef: ref, channel: 'C2B', amount, phone: String(b.MSISDN ?? ''),
          mpesaReceipt: b.TransID, status: 'SUCCESS', resultDesc: order ? 'Paybill' : 'UNMATCHED account number',
          raw: b as object, completedAt: new Date(),
        },
      });
      if (!order) return null;
      const { justPaid } = await applyPayment(tx, order.id, amount);
      return { orderId: order.id, amount, justPaid };
    });
    if (result) void afterPayment(result.orderId, result.amount, result.justPaid);
  },

  /** Dev only: complete a simulated STK push */
  async simulate(checkoutId: string, success: boolean) {
    const p = await prisma.payment.findUnique({ where: { checkoutRequestId: checkoutId } });
    if (!p) throw notFound('Payment not found');
    const cb: StkCallback = success
      ? {
          CheckoutRequestID: checkoutId, ResultCode: 0, ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: { Item: [
            { Name: 'Amount', Value: p.amount },
            { Name: 'MpesaReceiptNumber', Value: `SIM${Date.now().toString(36).toUpperCase()}` },
            { Name: 'PhoneNumber', Value: Number(p.phone) },
          ] },
        }
      : { CheckoutRequestID: checkoutId, ResultCode: 1032, ResultDesc: 'Request cancelled by user' };
    return this.handleStkResult(cb);
  },
};
