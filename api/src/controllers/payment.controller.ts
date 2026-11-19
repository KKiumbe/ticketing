// Safaricom callbacks. Always ack fast with ResultCode 0, then process.
import { NextFunction, Request, Response } from 'express';
import { env } from '../lib/env';
import { safeEqual } from '../lib/util';
import { paymentService } from '../services/payment.service';

export const checkSecret = (req: Request, res: Response, next: NextFunction) =>
  safeEqual(req.params.secret ?? '', env.mpesa.callbackSecret) ? next() : res.status(404).end();

export const stkCallback = async (req: Request, res: Response) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  const cb = req.body?.Body?.stkCallback;
  if (!cb) return;
  try { await paymentService.handleStkResult(cb); } catch (e) { console.error('[stk-callback]', e); }
};

export const c2bValidate = async (req: Request, res: Response) => {
  const ok = await paymentService.c2bValidate(String(req.body?.BillRefNumber ?? '')).catch(() => false);
  res.json(ok ? { ResultCode: '0', ResultDesc: 'Accepted' } : { ResultCode: 'C2B00012', ResultDesc: 'Rejected' });
};

export const c2bConfirm = async (req: Request, res: Response) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  try { await paymentService.c2bConfirm(req.body ?? {}); } catch (e) { console.error('[c2b-confirm]', e); }
};

export const simulate = async (req: Request, res: Response, next: NextFunction) => {
  if (!env.mpesa.simulate) return res.status(404).end();
  try { res.json({ result: await paymentService.simulate(req.params.checkoutId, req.body?.success !== false) }); } catch (e) { next(e); }
};
