import { NextFunction, Request, Response } from 'express';

/** Tiny in-memory limiter for login endpoints (a gate PIN is short, so cap guesses per IP). */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.resetAt < now) hits.set(key, { count: 1, resetAt: now + windowMs });
    else if (++h.count > max) {
      res.status(429).json({ message: 'Too many attempts. Try again in a few minutes' });
      return;
    }
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    next();
  };
}
