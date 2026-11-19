import { NextFunction, Request, Response } from 'express';
import { AdminLoginSchema, ScannerLoginSchema } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';

export const adminLogin = (req: Request, res: Response, next: NextFunction) => {
  try { res.json(authService.adminLogin(AdminLoginSchema.parse(req.body).password)); } catch (e) { next(e); }
};
export const scannerLogin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin, gate } = ScannerLoginSchema.parse(req.body);
    res.json(authService.scannerLogin(pin, gate));
  } catch (e) { next(e); }
};
export const me = (req: Request, res: Response) => res.json(req.user);
