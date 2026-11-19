'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/admin', 'Dashboard'],
  ['/admin/orders', 'Orders'],
  ['/admin/categories', 'Ticket categories'],
  ['/admin/event', 'Event & fees'],
  ['/admin/payments', 'Unmatched payments'],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <>
      {LINKS.map(([href, label]) => {
        const on = href === '/admin' ? path === '/admin' : path.startsWith(href);
        return <Link key={href} href={href} className={on ? 'on' : ''}>{label}</Link>;
      })}
    </>
  );
}

export function EventSwitch({ events, currentId }: { events: { id: number; name: string }[]; currentId?: number }) {
  const path = usePathname();
  return (
    <>
      <input type="hidden" name="back" value={path} />
      <select name="eventId" defaultValue={currentId} aria-label="Event" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
    </>
  );
}
