import Link from 'next/link';
import { NoEvent } from '@/components/ui';
import { currentEvent } from '@/lib/admin';
import { adminApi } from '@/lib/api';
import { fmtShort, kes } from '@/lib/format';
import type { AdminOrderRow } from '@/lib/types';

const STATUSES = ['', 'PAID', 'PARTIAL', 'PENDING', 'EXPIRED', 'CANCELLED'];

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = '', status = '' } = await searchParams;
  const { event } = await currentEvent();
  if (!event) return <NoEvent />;
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) }).toString();
  const orders = await adminApi<AdminOrderRow[]>(`/events/${event.id}/orders${qs ? `?${qs}` : ''}`);
  const href = (s: string) => `/admin/orders?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) })}`;
  return (
    <>
      <h1>Orders</h1>
      <form className="filters">
        <input name="q" defaultValue={q} placeholder="Ref, name, phone or email" />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button className="btn sm brand">Search</button>
        {STATUSES.map((s) => <Link key={s} href={href(s)} className={s === status ? 'on' : ''}>{s || 'All'}</Link>)}
      </form>
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Ref</th><th>Buyer</th><th>Category</th><th className="num">Qty</th><th className="num">Total</th><th className="num">Paid</th><th>Status</th><th>Created</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.ref}>
                <td><Link href={`/admin/orders/${o.ref}`}><b>{o.ref}</b></Link></td>
                <td>{o.buyerName}<br /><small>{o.phone}{o.email ? ` · ${o.email}` : ''}</small></td>
                <td>
                  {o.category.name}
                  {o.isEarlyBird ? <span className="badge eb">EB</span> : null}
                  {o.paymentPlan === 'INSTALLMENT' ? <span className="badge pp">Pole pole</span> : null}
                  {o.saleChannel === 'GATE' ? <span className="badge">Gate{o.soldBy ? ` · ${o.soldBy}` : ''}</span> : null}
                </td>
                <td className="num">{o.quantity}</td>
                <td className="num">{kes(o.totalAmount)}</td>
                <td className="num">{kes(o.amountPaid)}</td>
                <td className={`st-${o.status}`}>{o.status}</td>
                <td><small>{fmtShort(o.createdAt)}</small></td>
              </tr>
            ))}
            {!orders.length ? <tr><td colSpan={8} className="center muted">No orders match.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {orders.length === 500 ? <p className="muted">Showing the latest 500. Search to narrow down.</p> : null}
    </>
  );
}
