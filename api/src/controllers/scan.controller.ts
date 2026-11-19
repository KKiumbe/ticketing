import { NextFunction, Request, Response } from 'express';
import { GateSaleSchema, ValidateTicketSchema } from '../schemas/scan.schema';
import { scanService } from '../services/scan.service';

type H = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: H) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res); } catch (e) { next(e); }
};
const gateOf = (req: Request) => req.user?.gate ?? (req.user?.role === 'ADMIN' ? 'Admin' : null);

export const events = wrap(async (_req, res) => res.json(await scanService.events()));
export const validate = wrap(async (req, res) => {
  const b = ValidateTicketSchema.parse(req.body);
  res.json(await scanService.validate(b.code, b.eventId, gateOf(req)));
});
export const gatePrices = wrap(async (req, res) => res.json(await scanService.gatePrices(+req.params.id)));
export const sell = wrap(async (req, res) => res.status(201).json(await scanService.sell(GateSaleSchema.parse(req.body), gateOf(req))));
