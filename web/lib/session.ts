import { cookies } from 'next/headers';

export const ADMIN_TOKEN_COOKIE = 'sikika_admin_token';
export const ADMIN_EVENT_COOKIE = 'sikika_admin_event';

export async function getAdminToken() {
  return (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value ?? null;
}
