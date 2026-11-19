import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { logout, switchEvent } from '../actions';
import { AdminNav, EventSwitch } from '@/components/admin-nav';
import { currentEvent } from '@/lib/admin';
import { getAdminToken } from '@/lib/session';

export const metadata = { title: 'Admin – Sikika Tickets', robots: { index: false } };

export default async function PortalLayout({ children }: { children: ReactNode }) {
  if (!(await getAdminToken())) redirect('/admin/login');
  const { events, event } = await currentEvent();
  return (
    <>
      <nav className="topbar">
        <div className="wrap wide">
          <span className="brandname">Sikika Tickets</span>
          <AdminNav />
          <form action={switchEvent}>
            {events.length ? <EventSwitch events={events} currentId={event?.id} /> : null}
          </form>
          <form action={logout} style={{ marginLeft: 0 }}>
            <button className="btn sm sec">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="wrap wide">{children}</main>
    </>
  );
}
