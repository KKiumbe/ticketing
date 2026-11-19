import crypto from 'crypto';

/** 0712345678 / 712345678 / +254712345678 / 0112345678 -> 254712345678 (null if invalid) */
export function normalizePhone(input: unknown): string | null {
  const d = String(input ?? '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return '254' + d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return '254' + d;
  return null;
}

export const maskPhone = (p: string) => p.replace(/^(\d{6})\d{3}/, '$1***');

// No confusing chars (0/O, 1/I). Used as the M-Pesa account number (max 12 chars).
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function orderRef(prefix: 'TK' | 'GT' = 'TK'): string {
  let s = '';
  for (const b of crypto.randomBytes(6)) s += ALPHA[b % ALPHA.length];
  return prefix + s;
}

/** Unguessable ticket token for the QR (128 bits) */
export const ticketCode = () => crypto.randomBytes(16).toString('base64url');

/** Accepts a bare code or a full ticket URL (…/t/<code>) */
export function extractTicketCode(input: string): string {
  const s = String(input || '').trim();
  const m = s.match(/\/t\/([A-Za-z0-9_-]+)/);
  return (m ? m[1] : s).slice(0, 64);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
