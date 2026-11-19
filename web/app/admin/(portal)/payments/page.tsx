import { assignPayment, registerC2B } from '../../actions';
import { NoticeBar } from '@/components/ui';
import { noticeOf } from '@/lib/admin';
import { adminApi } from '@/lib/api';
import { fmtShort, kes } from '@/lib/format';

type Unmatched = { id: number; accountRef: string | null; amount: number; phone: string | null; mpesaReceipt: string | null; createdAt: string };

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const notice = noticeOf(await searchParams);
  const rows = await adminApi<Unmatched[]>('/payments/unmatched');
  return (
    <>
      <h1>Unmatched Paybill payments</h1>
      <p className="muted">Payments made from the M-Pesa menu with an account number that isn&apos;t an order ref. Assign each to the right order.</p>
      <NoticeBar notice={notice} />
      <div className="card scroll">
        <table>
          <thead><tr><th>When</th><th>Account typed</th><th>Phone</th><th>Receipt</th><th className="num">Amount</th><th>Assign to order</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><small>{fmtShort(p.createdAt)}</small></td>
                <td>{p.accountRef}</td>
                <td>{p.phone}</td>
                <td>{p.mpesaReceipt}</td>
                <td className="num">{kes(p.amount)}</td>
                <td>
                  <form action={assignPayment} className="row" style={{ gap: 6 }}>
                    <input type="hidden" name="id" value={p.id} />
                    <input name="ref" required placeholder="TK…" style={{ padding: '6px 10px', maxWidth: 140 }} />
                    <button className="btn sm" style={{ flex: '0 0 auto' }}>Assign</button>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="center muted">Nothing to assign.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h2>Paybill setup</h2>
      <form action={registerC2B} className="card">
        <p style={{ marginTop: 0 }}>
          Paybill only, once per shortcode: lets top-ups made from the M-Pesa menu (account no. = order ref) credit orders automatically.
        </p>
        <button className="btn sec">Register Paybill confirmation URLs</button>
      </form>
    </>
  );
}
