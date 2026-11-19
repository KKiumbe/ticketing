// Safaricom Daraja: STK push, STK query, C2B URL registration.
import { env } from '../lib/env';
import { AppError } from '../lib/errors';

const m = env.mpesa;
const BASE = m.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const auth = Buffer.from(`${m.consumerKey}:${m.consumerSecret}`).toString('base64');
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new AppError(502, `M-Pesa auth failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in?: string };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (Number(data.expires_in || 3599) - 60) * 1000;
  return cachedToken;
}

/** YYYYMMDDHHmmss in Nairobi time */
function timestamp() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}
const password = (ts: string) => Buffer.from(`${m.shortcode}${m.passkey}${ts}`).toString('base64');

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AppError(502, `M-Pesa: ${data.errorMessage || data.ResponseDescription || res.status}`);
  return data as T;
}

// Safaricom rejects callback URLs containing "mpesa"/"safaricom", so they live under /api/v1/pay/...
const callbackBase = () => `${env.apiPublicUrl}/api/v1/pay`;

export type StkPushResponse = { MerchantRequestID: string; CheckoutRequestID: string; ResponseCode: string; CustomerMessage?: string };
export type StkCallback = {
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] };
};

export const darajaService = {
  isSimulated: () => m.simulate,
  paybill: () => (m.tillNumber ? null : m.shortcode),

  async stkPush(p: { phone: string; amount: number; accountRef: string; description: string }): Promise<StkPushResponse> {
    if (m.simulate) {
      const id = `ws_CO_SIM_${Date.now()}${Math.floor(Math.random() * 1000)}`;
      return { MerchantRequestID: `SIM-${id}`, CheckoutRequestID: id, ResponseCode: '0', CustomerMessage: 'Simulated' };
    }
    const ts = timestamp();
    const isTill = Boolean(m.tillNumber);
    return post<StkPushResponse>('/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: m.shortcode,
      Password: password(ts),
      Timestamp: ts,
      TransactionType: isTill ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
      Amount: Math.round(p.amount),
      PartyA: p.phone,
      PartyB: isTill ? m.tillNumber : m.shortcode,
      PhoneNumber: p.phone,
      CallBackURL: `${callbackBase()}/stk-callback/${m.callbackSecret}`,
      AccountReference: p.accountRef.slice(0, 12),
      TransactionDesc: p.description.slice(0, 13),
    });
  },

  async stkQuery(checkoutRequestId: string) {
    const ts = timestamp();
    return post<{ ResultCode?: string | number; ResultDesc?: string }>('/mpesa/stkpushquery/v1/query', {
      BusinessShortCode: m.shortcode,
      Password: password(ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    });
  },

  /** One-off: where Safaricom sends Paybill payments made from the M-Pesa menu */
  registerC2BUrls() {
    return post('/mpesa/c2b/v1/registerurl', {
      ShortCode: m.shortcode,
      ResponseType: 'Completed',
      ConfirmationURL: `${callbackBase()}/c2b/confirm/${m.callbackSecret}`,
      ValidationURL: `${callbackBase()}/c2b/validate/${m.callbackSecret}`,
    });
  },

  parseStkMetadata(cb: StkCallback): Record<string, string | number | undefined> {
    const out: Record<string, string | number | undefined> = {};
    for (const item of cb.CallbackMetadata?.Item ?? []) out[item.Name] = item.Value;
    return out;
  },
};
