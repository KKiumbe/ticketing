export const kes = (n: number | null | undefined) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const TZ = 'Africa/Nairobi';
export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '';
export const fmtShort = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '';
export const fmtDay = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: TZ }) : '';

/** ISO -> value for <input type="datetime-local">, in Nairobi time (UTC+3, no DST) */
export function toNairobiInput(d: string | null | undefined) {
  if (!d) return '';
  return new Date(new Date(d).getTime() + 3 * 3600_000).toISOString().slice(0, 16);
}
/** datetime-local value (Nairobi) -> ISO string, '' stays '' */
export const fromNairobiInput = (v: string) => (v ? new Date(`${v}:00+03:00`).toISOString() : '');
