import '../load-env';

const str = (k: string, d = ''): string => {
  const v = process.env[k];
  return v !== undefined && v !== '' ? v : d;
};
const num = (k: string, d: number): number => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && process.env[k] !== '' ? n : d;
};
const trimSlash = (s: string) => s.replace(/\/+$/, '');

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  port: num('PORT', 4000),
  /** Public URL of this API. Safaricom callbacks are sent here. */
  apiPublicUrl: trimSlash(str('API_PUBLIC_URL', 'http://localhost:4000')),
  /** Public URL of the Next.js site. Ticket (/t/:code) and order (/o/:ref) links point here. */
  webBaseUrl: trimSlash(str('WEB_BASE_URL', 'http://localhost:3000')),
  corsOrigins: str('CORS_ORIGINS', '').split(',').map((s) => s.trim()).filter(Boolean),
  defaultEventSlug: str('DEFAULT_EVENT_SLUG', ''),
  pendingOrderTtlMin: num('PENDING_ORDER_TTL_MIN', 30),

  jwtSecret: str('JWT_SECRET', ''),
  adminPassword: str('ADMIN_PASSWORD', ''),
  scannerPin: str('SCANNER_PIN', ''),

  mpesa: {
    env: str('MPESA_ENV', 'sandbox') as 'sandbox' | 'production',
    consumerKey: str('MPESA_CONSUMER_KEY'),
    consumerSecret: str('MPESA_CONSUMER_SECRET'),
    /** Paybill number, or the store/head-office number for a Till */
    shortcode: str('MPESA_SHORTCODE', '174379'),
    /** Set for Buy Goods; empty for Paybill */
    tillNumber: str('MPESA_TILL_NUMBER'),
    passkey: str('MPESA_PASSKEY'),
    callbackSecret: str('MPESA_CALLBACK_SECRET', 'change-me'),
    /** Dev only: no Safaricom calls, complete payments via POST /api/v1/pay/simulate/:checkoutId */
    simulate: str('MPESA_SIMULATE', 'false') === 'true',
  },

  smtp: {
    host: str('SMTP_HOST'),
    port: num('SMTP_PORT', 465),
    user: str('SMTP_USER'),
    pass: str('SMTP_PASS'),
    from: str('SMTP_FROM', 'Sikika Tickets <tickets@sikika-ke.co.ke>'),
  },

  /** Your WhatsApp/SMS gateway. Receives POST {phone, message, type, ref, links} */
  notifyWebhook: { url: str('NOTIFY_WEBHOOK_URL'), token: str('NOTIFY_WEBHOOK_TOKEN') },
};

export function assertEnv() {
  const missing = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_PASSWORD', 'SCANNER_PIN'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
  if (env.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  if (env.nodeEnv === 'production' && env.mpesa.simulate) throw new Error('MPESA_SIMULATE must be false in production');
  if (env.nodeEnv === 'production' && env.mpesa.callbackSecret === 'change-me') throw new Error('Set MPESA_CALLBACK_SECRET');
}
