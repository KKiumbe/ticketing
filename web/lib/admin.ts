import 'server-only';
import { cookies } from 'next/headers';
import { adminApi } from './api';
import { ADMIN_EVENT_COOKIE } from './session';
import type { AdminEvent } from './types';

/** Events + the one selected in the admin event switcher (cookie), defaulting to the latest */
export async function currentEvent() {
  const events = await adminApi<AdminEvent[]>('/events');
  const wanted = Number((await cookies()).get(ADMIN_EVENT_COOKIE)?.value);
  const event = events.find((e) => e.id === wanted) ?? events[0] ?? null;
  return { events, event };
}

export type Notice = { ok?: string; error?: string };
export const noticeOf = (sp: Record<string, string | string[] | undefined>): Notice => ({
  ok: typeof sp.ok === 'string' ? sp.ok : undefined,
  error: typeof sp.error === 'string' ? sp.error : undefined,
});
