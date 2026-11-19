import jwt from 'jsonwebtoken';
import { env } from '../lib/env';
import { AppError } from '../lib/errors';
import type { Role } from '../lib/types';
import { safeEqual } from '../lib/util';

export type TokenPayload = { role: Role; gate?: string };

const TTL: Record<Role, number> = { ADMIN: 12 * 3600, SCANNER: 18 * 3600 };

function issue(payload: TokenPayload) {
  const expiresIn = TTL[payload.role];
  return { accessToken: jwt.sign(payload, env.jwtSecret, { expiresIn }), role: payload.role, gate: payload.gate ?? null, expiresIn };
}

export const authService = {
  adminLogin(password: string) {
    if (!env.adminPassword || !safeEqual(password, env.adminPassword)) throw new AppError(401, 'Wrong password');
    return issue({ role: 'ADMIN' });
  },

  scannerLogin(pin: string, gate?: string) {
    const ok = (env.scannerPin && safeEqual(pin, env.scannerPin)) || (env.adminPassword && safeEqual(pin, env.adminPassword));
    if (!ok) throw new AppError(401, 'Wrong PIN');
    return issue({ role: 'SCANNER', gate: gate || 'Gate' });
  },

  verify(token: string): TokenPayload {
    return jwt.verify(token, env.jwtSecret) as TokenPayload;
  },
};
