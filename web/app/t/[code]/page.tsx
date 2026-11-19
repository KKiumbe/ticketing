import { notFound } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { fmtDate, fmtShort } from '@/lib/format';
import type { TicketView } from '@/lib/types';

export const metadata = { title: 'Your ticket – Sikika Tickets', robots: { index: false } };

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let t: TicketView;
  try {
    t = await apiRequest<TicketView>(`/tickets/${encodeURIComponent(code)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return (
    <main className="wrap center" style={{ maxWidth: 460 }}>
      <div className="card">
        <small>{t.event.name}</small>
        <h1 style={{ margin: '4px 0' }}>{t.category}</h1>
        <p style={{ margin: 0 }}><b>{t.holderName}</b></p>
        <p className="muted" style={{ marginTop: 4 }}>Ticket {t.seq} of {t.of} · Order {t.ref}</p>
        {t.status === 'VOID' ? (
          <p className="notice bad">This ticket was cancelled.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="qr" src={t.qr} alt={`QR code for ticket ${t.seq}`} style={{ opacity: t.status === 'CHECKED_IN' ? 0.35 : 1 }} />
        )}
        {t.status === 'CHECKED_IN' ? <p className="notice info">Checked in {fmtShort(t.checkedInAt)}</p> : null}
        <p>{fmtDate(t.event.startsAt)}{t.event.venue ? <><br />{t.event.venue}</> : null}</p>
        <p className="muted" style={{ fontSize: 14 }}>Show this QR at the entrance. Turn your screen brightness up. Each QR admits one person, once.</p>
      </div>
    </main>
  );
}
