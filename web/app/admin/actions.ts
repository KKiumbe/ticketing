'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminApi, apiRequest } from '@/lib/api';
import { fromNairobiInput } from '@/lib/format';
import { ADMIN_EVENT_COOKIE, ADMIN_TOKEN_COOKIE } from '@/lib/session';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const bool = (f: FormData, k: string) => f.get(k) === 'on' || f.get(k) === 'true';
const withNotice = (path: string, kind: 'ok' | 'error', msg: string) =>
  `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`;

/** Run an API call, then redirect back with a success or error notice */
async function act(path: string, okMsg: string, fn: () => Promise<unknown>): Promise<never> {
  let target: string;
  try {
    await fn();
    target = withNotice(path, 'ok', okMsg);
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e; // let Next redirects through
    target = withNotice(path, 'error', (e as Error).message);
  }
  redirect(target);
}

// ---------- Session ----------
export async function login(form: FormData) {
  let token: string | null = null;
  let error = '';
  try {
    const r = await apiRequest<{ accessToken: string; expiresIn: number }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: str(form, 'password') }),
    });
    token = r.accessToken;
    (await cookies()).set(ADMIN_TOKEN_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: r.expiresIn, secure: process.env.NODE_ENV === 'production',
    });
  } catch (e) {
    error = (e as Error).message;
  }
  redirect(token ? '/admin' : withNotice('/admin/login', 'error', error));
}

export async function logout() {
  (await cookies()).delete(ADMIN_TOKEN_COOKIE);
  redirect('/admin/login');
}

export async function switchEvent(form: FormData) {
  (await cookies()).set(ADMIN_EVENT_COOKIE, str(form, 'eventId'), { path: '/', sameSite: 'lax', maxAge: 365 * 86400 });
  redirect(str(form, 'back') || '/admin');
}

// ---------- Events ----------
function feesFrom(form: FormData) {
  const names = form.getAll('feeName').map(String);
  return names
    .map((name, i) => ({
      name: name.trim(),
      type: String(form.getAll('feeType')[i]),
      value: Number(form.getAll('feeValue')[i]),
      perTicket: String(form.getAll('feePerTicket')[i]) === 'yes',
      appliesTo: String(form.getAll('feeAppliesTo')[i]),
    }))
    .filter((f) => f.name && f.value > 0);
}

function eventBody(form: FormData) {
  return {
    name: str(form, 'name'),
    description: str(form, 'description') || null,
    venue: str(form, 'venue') || null,
    startsAt: fromNairobiInput(str(form, 'startsAt')),
    bannerUrl: str(form, 'bannerUrl') || null,
    isPublished: bool(form, 'isPublished'),
    gateMarkupPercent: Number(str(form, 'gateMarkupPercent') || 0),
    fees: feesFrom(form),
  };
}

export async function updateEvent(form: FormData) {
  const id = str(form, 'id');
  await act('/admin/event', 'Event saved', () => adminApi(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(eventBody(form)) }));
}

export async function createEvent(form: FormData) {
  await act('/admin/event', 'Event created', async () => {
    const created = await adminApi<{ id: number }>('/events', { method: 'POST', body: JSON.stringify({ ...eventBody(form), slug: str(form, 'slug') }) });
    (await cookies()).set(ADMIN_EVENT_COOKIE, String(created.id), { path: '/', sameSite: 'lax', maxAge: 365 * 86400 });
  });
}

// ---------- Categories ----------
export async function saveCategory(form: FormData) {
  const id = str(form, 'id');
  const eventId = str(form, 'eventId');
  const body = {
    name: str(form, 'name'),
    description: str(form, 'description') || null,
    price: str(form, 'price'),
    capacity: str(form, 'capacity'),
    earlyBirdPrice: str(form, 'earlyBirdPrice'),
    earlyBirdDiscountPercent: str(form, 'earlyBirdDiscountPercent'),
    earlyBirdDaysBefore: str(form, 'earlyBirdDaysBefore'),
    earlyBirdEndsAt: fromNairobiInput(str(form, 'earlyBirdEndsAt')),
    earlyBirdQuota: str(form, 'earlyBirdQuota'),
    allowInstallments: bool(form, 'allowInstallments'),
    minDeposit: str(form, 'minDeposit') || 0,
    installmentDeadline: fromNairobiInput(str(form, 'installmentDeadline')),
    salesOpen: bool(form, 'salesOpen'),
    sortOrder: str(form, 'sortOrder') || 0,
  };
  await act('/admin/categories', id ? 'Category saved' : 'Category added', () =>
    id
      ? adminApi(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : adminApi(`/events/${eventId}/categories`, { method: 'POST', body: JSON.stringify(body) }),
  );
}

// ---------- Orders ----------
export async function manualPayment(form: FormData) {
  const ref = str(form, 'ref');
  await act(`/admin/orders/${ref}`, 'Payment recorded', () =>
    adminApi(`/orders/${ref}/manual-payment`, { method: 'POST', body: JSON.stringify({ amount: str(form, 'amount'), note: str(form, 'note') || undefined }) }));
}

export async function resendTickets(form: FormData) {
  const ref = str(form, 'ref');
  await act(`/admin/orders/${ref}`, 'Message sent again', () => adminApi(`/orders/${ref}/resend`, { method: 'POST', body: '{}' }));
}

export async function cancelOrder(form: FormData) {
  const ref = str(form, 'ref');
  await act(`/admin/orders/${ref}`, 'Order cancelled, QR codes voided', () => adminApi(`/orders/${ref}/cancel`, { method: 'POST', body: '{}' }));
}

export async function setHolderName(form: FormData) {
  const ref = str(form, 'ref');
  await act(`/admin/orders/${ref}`, 'Name saved', () =>
    adminApi(`/tickets/${encodeURIComponent(str(form, 'code'))}`, { method: 'PATCH', body: JSON.stringify({ holderName: str(form, 'holderName') || null }) }));
}

// ---------- Payments ----------
export async function assignPayment(form: FormData) {
  await act('/admin/payments', 'Payment assigned', () =>
    adminApi(`/payments/${str(form, 'id')}/assign`, { method: 'POST', body: JSON.stringify({ ref: str(form, 'ref') }) }));
}

export async function registerC2B() {
  await act('/admin/payments', 'Paybill confirmation URLs registered with Safaricom', () => adminApi('/mpesa/register-c2b', { method: 'POST', body: '{}' }));
}
