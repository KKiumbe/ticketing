import { NextFunction, Request, Response } from 'express';
import { CreateOrderSchema, PayOrderSchema } from '../schemas/public.schema';
import { findOrderByRef } from '../services/order.service';
import { paymentService } from '../services/payment.service';
import { publicService } from '../services/public.service';

type H = (req: Request, res: Response) => Promise<unknown> | unknown;
const wrap = (fn: H) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

export const config = wrap((_req, res) => res.json(publicService.config()));
export const event = wrap(async (req, res) => res.json(await publicService.event(req.params.slug)));
export const createOrder = wrap(async (req, res) =>
  res.status(201).json(await publicService.createOrder(req.params.slug, CreateOrderSchema.parse(req.body))));
export const order = wrap(async (req, res) => res.json(await publicService.order(req.params.ref)));
export const pay = wrap(async (req, res) => {
  const b = PayOrderSchema.parse(req.body ?? {});
  res.json(await publicService.pay(req.params.ref, b.amount, b.phone));
});
export const check = wrap(async (req, res) => res.json(await paymentService.checkPending((await findOrderByRef(req.params.ref)).id)));
export const ticket = wrap(async (req, res) => res.json(await publicService.ticket(req.params.code)));
