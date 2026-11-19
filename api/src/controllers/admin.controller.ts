import { NextFunction, Request, Response } from 'express';
import {
  AssignPaymentSchema, CategorySchema, EventSchema, HolderNameSchema, ManualPaymentSchema, UpdateCategorySchema, UpdateEventSchema,
} from '../schemas/admin.schema';
import { adminService } from '../services/admin.service';

type H = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: H) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res); } catch (e) { next(e); }
};
const id = (req: Request) => +req.params.id;

export const events = wrap(async (_req, res) => res.json(await adminService.events()));
export const event = wrap(async (req, res) => res.json(await adminService.event(id(req))));
export const createEvent = wrap(async (req, res) => res.status(201).json(await adminService.createEvent(EventSchema.parse(req.body))));
export const updateEvent = wrap(async (req, res) => res.json(await adminService.updateEvent(id(req), UpdateEventSchema.parse(req.body))));

export const categories = wrap(async (req, res) => res.json(await adminService.categories(id(req))));
export const createCategory = wrap(async (req, res) =>
  res.status(201).json(await adminService.createCategory(id(req), CategorySchema.parse(req.body))));
export const updateCategory = wrap(async (req, res) => res.json(await adminService.updateCategory(id(req), UpdateCategorySchema.parse(req.body))));

export const stats = wrap(async (req, res) => res.json(await adminService.stats(id(req))));
export const orders = wrap(async (req, res) =>
  res.json(await adminService.orders(id(req), req.query.q as string | undefined, (req.query.status as string) || undefined)));
export const attendeesCsv = wrap(async (req, res) => {
  res.type('text/csv').attachment('attendees.csv').send(await adminService.attendeesCsv(id(req)));
});

export const order = wrap(async (req, res) => res.json(await adminService.order(req.params.ref)));
export const manualPayment = wrap(async (req, res) => {
  const b = ManualPaymentSchema.parse(req.body);
  res.json(await adminService.manualPayment(req.params.ref, b.amount, b.note));
});
export const resend = wrap(async (req, res) => res.json(await adminService.resend(req.params.ref)));
export const cancel = wrap(async (req, res) => res.json(await adminService.cancel(req.params.ref)));
export const setHolderName = wrap(async (req, res) =>
  res.json(await adminService.setHolderName(req.params.code, HolderNameSchema.parse(req.body).holderName)));

export const unmatchedPayments = wrap(async (_req, res) => res.json(await adminService.unmatchedPayments()));
export const assignPayment = wrap(async (req, res) => res.json(await adminService.assignPayment(id(req), AssignPaymentSchema.parse(req.body).ref)));
export const registerC2B = wrap(async (_req, res) => res.json(await adminService.registerC2B()));
