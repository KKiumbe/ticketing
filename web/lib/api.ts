// Server-side API client (server components, server actions, route handlers).
import 'server-only';
import { redirect } from 'next/navigation';
import { getAdminToken } from './session';

export const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function rawApiRequest(path: string, init: RequestInit = {}, auth = false) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (auth) {
    const token = await getAdminToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers, cache: 'no-store' });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const res = await rawApiRequest(path, init, auth);
  if (res.status === 401 && auth) redirect('/admin/login?error=Session%20expired');
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  if (!res.ok) throw new ApiError(typeof data?.message === 'string' ? data.message : `Request failed (${res.status})`, res.status);
  return data as T;
}

/** Admin calls (Bearer token from the httpOnly cookie) */
export const adminApi = <T>(path: string, init: RequestInit = {}) => apiRequest<T>(`/admin${path}`, init, true);
