import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cancelOrder, manualPayment, resendTickets, setHolderName } from '../../../actions';
import { ConfirmButton, NoticeBar } from '@/components/ui';
import { noticeOf } from '@/lib/admin';
import { adminApi, ApiError } from '@/lib/api';
import { fmtShort, kes } from '@/lib/format';
import type { AdminOrder } from '@/lib/types';

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string>> }) {
  const { ref } = await params;
  const notice = noticeOf(await searchParams);
  let o: AdminOrder;
  try {
    o = await adminApi<AdminOrder>(`/orders/${encodeURIComponent(ref)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const balance = o.totalAmount - o.amountPaid;
  return (
    <>
      <p><Link href="/admin/orders">← Orders</Link></p>
      <div className="spread">
        <h1 style={{ margin: 0 }}>{o.ref} <span className={`st-${o.status}`} style={{ fontSize: 18 }}>{o.status}</span></h1>
        <Link className="btn sec sm" href={`/o/${o.ref}`} target="_blank">Buyer&apos;s order page</Link>
      </div>
      <NoticeBar notice={notice} />

      <div className="row" style={{ alignItems: 'flex-start', marginTop: 12 }}>
        <div className="card" style={{ flex: '2 1 360px' }}>
          <p style={{ marginTop: 0 }}><b>{o.buyerName}</b><br />{o.phone}{o.email ? ` · ${o.email}` : ''}</p>
          <p>
            {o.quantity} × {o.category.name} at {kes(o.unitPrice)}
            {o.isEarlyBird ? <span className="badge eb">Early bird</span> : null}
            {o.paymentPlan === 'INSTALLMENT' ? <span className="badge pp">Pole pole</span> : null}
            {o.saleChannel === 'GATE' ? <span className="badge">Gate sale{o.soldBy ? ` · ${o.soldBy}` : ''}</span> : null}
          </p>
          <div className="line"><span>Tickets</span><span>{kes(o.subtotal ?? o.totalAmount)}</span></div>
          {o.feeBreakdown.map((f) => <div key={f.name} className="line muted"><span>{f.name}</span><span>{kes(f.amount)}</span></div>)}
          <div className="total"><span>Total</span><b>{kes(o.totalAmount)}</b></div>
          <div className="line"><span>Paid</span><span>{kes(o.amountPaid)}</span></div>
          <div className="line"><b>Balance</b><b>{kes(Math.max(0, balance))}</b></div>
          <p className="muted" style={{ marginBottom: 0 }}>Created {fmtShort(o.createdAt)}{o.paidAt ? ` · paid ${fmtShort(o.paidAt)}` : ''}</p>
        </div>

        <div className="card" style={{ flex: '1 1 280px' }}>
          <h3 style={{ marginTop: 0 }}>Actions</h3>
          {o.status !== 'CANCELLED' && balance > 0 ? (
            <form action={manualPayment}>
              <input type="hidden" name="ref" value={o.ref} />
              <label htmlFor="amount">Record cash / bank payment (KES)</label>
              <input id="amount" name="amount" type="number" min={0} defaultValue={balance} required />
              <input name="note" placeholder="Note, e.g. Bank transfer ref" style={{ marginTop: 8 }} />
              <button className="btn sm" style={{ marginTop: 8 }}>Record payment</button>
            </form>
          ) : null}
          <div className="row" style={{ marginTop: 16 }}>
            {o.amountPaid > 0 || o.status === 'PAID' ? (
              <form action={resendTickets} style={{ flex: '0 0 auto' }}>
                <input type="hidden" name="ref" value={o.ref} />
                <button className="btn sm sec">{o.status === 'PAID' ? 'Resend tickets' : 'Resend balance reminder'}</button>
              </form>
            ) : null}
            {o.status !== 'CANCELLED' ? (
              <form action={cancelOrder} style={{ flex: '0 0 auto' }}>
                <input type="hidden" name="ref" value={o.ref} />
                <ConfirmButton label="Cancel order…" confirmLabel="Yes, cancel and void QR codes" />
              </form>
            ) : null}
          </div>
        </div>
      </div>

      {o.tickets.length ? (
        <>
          <h2>Tickets</h2>
          <div className="card scroll">
            <table>
              <thead><tr><th>#</th><th>Holder name</th><th>Status</th><th>Checked in</th><th /></tr></thead>
              <tbody>
                {o.tickets.map((t) => (
                  <tr key={t.code}>
                    <td>{t.seq}</td>
                    <td>
                      <form action={setHolderName} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="ref" value={o.ref} />
                        <input type="hidden" name="code" value={t.code} />
                        <input name="holderName" defaultValue={t.holderName ?? ''} placeholder="Guest name" style={{ padding: '6px 10px' }} />
                        <button className="btn sm sec" style={{ flex: '0 0 auto' }}>Save</button>
                      </form>
                    </td>
                    <td className={`st-${t.status}`}>{t.status}</td>
                    <td><small>{t.checkedInAt ? `${fmtShort(t.checkedInAt)} · ${t.checkedInBy ?? ''}` : ''}</small></td>
                    <td><Link href={`/t/${t.code}`} target="_blank">QR</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h2>Payments</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>When</th><th>Channel</th><th className="num">Amount</th><th>Phone</th><th>Receipt</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>
            {o.payments.map((p) => (
              <tr key={p.id}>
                <td><small>{fmtShort(p.createdAt)}</small></td>
                <td>{p.channel}</td>
                <td className="num">{kes(p.amount)}</td>
                <td>{p.phone}</td>
                <td>{p.mpesaReceipt}</td>
                <td className={`st-${p.status}`}>{p.status}</td>
                <td><small>{p.resultDesc}</small></td>
              </tr>
            ))}
            {!o.payments.length ? <tr><td colSpan={7} className="muted center">No payments yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
