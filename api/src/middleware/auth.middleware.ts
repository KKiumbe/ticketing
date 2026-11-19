import { NextFunction, Request, Response } from 'express';
import type { Role } from '../lib/types';
import { authService } from '../services/auth.service';

/** Bearer JWT from /auth/admin/login or /auth/scanner/login. ADMIN can do everything a SCANNER can. */
export const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ message: 'Sign in first' });
    return;
  }
  try {
    const user = authService.verify(token);
    if (!roles.includes(user.role) && user.role !== 'ADMIN') {
      res.status(403).json({ message: 'Not allowed' });
      return;
    }
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ message: (e as Error).name === 'TokenExpiredError' ? 'Session expired, sign in again' : 'Invalid session' });
  }
};
