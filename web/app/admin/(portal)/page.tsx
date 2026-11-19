import Link from 'next/link';
import { NoEvent, Stat } from '@/components/ui';
import { currentEvent } from '@/lib/admin';
import { adminApi } from '@/lib/api';
import { fmtDate, kes } from '@/lib/format';
import type { Stats } from '@/lib/types';

export default async function Dashboard() {
  const { event } = await currentEvent();
  if (!event) return <NoEvent />;
  const s = await adminApi<Stats>(`/events/${event.id}/stats`);
  const t = s.totals;
  const sold = (t.paidTickets ?? 0) + (t.polePoleTickets ?? 0);
  return (
    <>
      <div className="spread">
        <div>
          <h1 style={{ marginBottom: 0 }}>{event.name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{fmtDate(event.startsAt)}{event.venue ? ` · ${event.venue}` : ''}{event.isPublished ? '' : ' · unpublished'}</p>
        </div>
        <div className="row" style={{ flex: '0 0 auto' }}>
          <Link className="btn sec sm" href={`/e/${event.slug}`} target="_blank">Open sales page</Link>
          <a className="btn sec sm" href={`/admin/attendees?event=${event.id}`}>Attendee CSV</a>
        </div>
      </div>

      <div className="stats" style={{ marginTop: 16 }}>
        <Stat label="Tickets paid" value={t.paidTickets} hint={`of ${t.capacity} capacity`} />
        <Stat label="Lipa pole pole (in progress)" value={t.polePoleTickets} />
        <Stat label="Early bird sold" value={t.earlyBirdTickets} />
        <Stat label="Sold at gate" value={t.gateTickets} />
        <Stat label="Checked in" value={t.checkedIn} hint={sold ? `${Math.round((t.checkedIn / Math.max(1, t.paidTickets)) * 100)}% of paid` : undefined} />
        <Stat label="Collected" value={kes(t.collected)} hint={`incl. ${kes(t.feesCollected)} fees`} />
        <Stat label="Outstanding (pole pole)" value={kes(t.outstanding)} />
        <Stat label="Awaiting payment" value={t.pendingTickets} hint="seats held, not yet paid" />
      </div>

      {s.unmatchedPayments.count ? (
        <p className="notice info">
          {s.unmatchedPayments.count} Paybill payment(s) ({kes(s.unmatchedPayments.amount)}) used a wrong account number.{' '}
          <Link href="/admin/payments">Assign them</Link>
        </p>
      ) : null}

      <h2>By category</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Category</th><th className="num">Paid</th><th className="num">Pole pole</th><th className="num">Pending</th><th className="num">Early bird</th><th className="num">Gate</th><th className="num">Checked in</th><th className="num">Capacity</th><th className="num">Collected</th><th className="num">Outstanding</th></tr>
          </thead>
          <tbody>
            {s.categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="num">{c.paidTickets}</td>
                <td className="num">{c.polePoleTickets}</td>
                <td className="num">{c.pendingTickets}</td>
                <td className="num">{c.earlyBirdTickets}</td>
                <td className="num">{c.gateTickets}</td>
                <td className="num">{c.checkedIn}</td>
                <td className="num">{c.capacity}</td>
                <td className="num">{kes(c.collected)}</td>
                <td className="num">{kes(c.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
