'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { fmtDate, fmtShort, kes } from '@/lib/format';
import type { OrderView } from '@/lib/types';

const POLL_MS = 4000;
const STK_QUERY_AFTER_MS = 35_000;

export function OrderViewClient({ initial, waiting, initialError }: { initial: OrderView; waiting: boolean; initialError?: string }) {
  const [o, setO] = useState(initial);
  const [error, setError] = useState(initialError ?? '');
  const [info, setInfo] = useState(waiting ? 'Check your phone and enter your M-Pesa PIN.' : '');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitingSince, setWaitingSince] = useState<number | null>(waiting ? Date.now() : null);
  const queried = useRef(false);

  const pendingStk = o.payments.find((p) => p.channel === 'STK' && p.status === 'PENDING');
  const done = o.status === 'PAID' || o.status === 'CANCELLED';

  const refresh = useCallback(async () => {
    const next = await clientApi<OrderView>(`/orders/${o.ref}`);
    setO(next);
    return next;
  }, [o.ref]);

  // Poll while an STK push is in flight; ask Safaricom directly if no callback after ~35s
  useEffect(() => {
    if (done || (!pendingStk && !waitingSince)) return;
    const t = setInterval(async () => {
      try {
        if (waitingSince && !queried.current && Date.now() - waitingSince > STK_QUERY_AFTER_MS) {
          queried.current = true;
          await clientApi(`/orders/${o.ref}/check`, { method: 'POST', body: {} });
        }
        const next = await refresh();
        const latest = next.payments[0];
        if (latest && latest.status !== 'PENDING') {
          setWaitingSince(null);
          if (latest.status === 'FAILED') { setInfo(''); setError(latest.resultDesc || 'Payment was not completed'); }
          else setInfo(next.status === 'PAID' ? '' : `Received ${kes(latest.amount)}. Thank you!`);
        }
      } catch { /* keep polling */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [done, pendingStk, waitingSince, o.ref, refresh]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await clientApi<{ message: string }>(`/orders/${o.ref}/pay`, {
        body: { amount: o.plan === 'INSTALLMENT' && amount ? Number(amount) : undefined, phone: phone || undefined },
      });
      setInfo(r.message);
      queried.current = false;
      setWaitingSince(Date.now());
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function simulate(id: string, success: boolean) {
    await clientApi(`/pay/simulate/${id}`, { body: { success } });
    await refresh();
  }

  const pct = o.total ? Math.min(100, Math.round((o.paid / o.total) * 100)) : 100;

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <h1>{o.event.name}</h1>
          <p>{fmtDate(o.event.startsAt)}{o.event.venue ? ` · ${o.event.venue}` : ''}</p>
        </div>
      </header>
      <main className="wrap">
        <div className="card">
          <div className="spread">
            <div>
              <small>Order</small>
              <h2 style={{ margin: 0 }}>{o.ref}</h2>
            </div>
            <span className={`badge ${o.status === 'PAID' ? 'ok' : o.status === 'PARTIAL' ? 'eb' : o.status === 'PENDING' ? '' : 'bad'}`}>
              {o.status === 'PARTIAL' ? 'Lipa pole pole' : o.status}
            </span>
          </div>
          <p>
            {o.quantity} × {o.category}{o.earlyBird ? ' (early bird)' : ''} · {o.buyerName} · {o.phoneMasked}
          </p>
          <div className="line"><span>Tickets</span><span>{kes(o.subtotal)}</span></div>
          {o.fees.map((f) => <div key={f.name} className="line muted"><span>{f.name}</span><span>{kes(f.amount)}</span></div>)}
          <div className="total"><span>Total</span><b>{kes(o.total)}</b></div>
          <div className="line"><span>Paid</span><span>{kes(o.paid)}</span></div>
          {o.balance > 0 ? <div className="line"><b>Balance</b><b>{kes(o.balance)}</b></div> : null}
          {o.plan === 'INSTALLMENT' && o.balance > 0 ? <div className="bar" aria-label={`${pct}% paid`}><i style={{ width: `${pct}%` }} /></div> : null}
        </div>

        {info && !done ? (
          <div className="card center">
            {waitingSince ? <div className="spinner" /> : null}
            <p style={{ margin: 0 }}>{info}</p>
          </div>
        ) : null}
        {error ? <div className="notice bad" role="alert">{error}</div> : null}

        {o.simulate && pendingStk?.id ? (
          <div className="card sim">
            <b>Dev mode: M-Pesa is simulated</b>
            <p className="muted" style={{ margin: '4px 0 10px' }}>No prompt is sent to a phone. Complete the pending {kes(pendingStk.amount)} payment here:</p>
            <div className="row">
              <button className="btn" type="button" onClick={() => simulate(pendingStk.id!, true)}>Simulate PIN entered</button>
              <button className="btn sec" type="button" onClick={() => simulate(pendingStk.id!, false)}>Simulate cancel</button>
            </div>
          </div>
        ) : null}

        {o.status === 'PAID' ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Your tickets</h2>
            <p className="muted">One QR per person. Forward a link to each guest; it&apos;s also been sent to you by SMS/email.</p>
            <div className="stack">
              {o.tickets.map((t) => (
                <div key={t.code} className="spread">
                  <span>Ticket {t.seq} of {o.quantity}{t.holderName ? ` · ${t.holderName}` : ''} <span className={`st-${t.status}`}>{t.status === 'CHECKED_IN' ? '· used' : ''}</span></span>
                  <Link className="btn sm brand" href={`/t/${t.code}`}>Open QR</Link>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {o.balance > 0 && o.status !== 'CANCELLED' ? (
          <form className="card" onSubmit={pay}>
            <h2 style={{ marginTop: 0 }}>{o.paid > 0 ? 'Pay the balance' : 'Complete payment'}</h2>
            {o.status === 'EXPIRED' ? <p className="notice info">This order expired, but paying now revives it if seats are still available.</p> : null}
            {o.plan === 'INSTALLMENT' ? (
              <>
                <label htmlFor="amt">Amount (KES)</label>
                <input id="amt" type="number" min={1} max={o.balance} placeholder={String(o.balance)} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </>
            ) : null}
            <label htmlFor="ph">M-Pesa number (leave empty to use {o.phoneMasked})</label>
            <input id="ph" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="btn block" disabled={busy || Boolean(waitingSince)}>
              {busy ? 'Sending prompt…' : `Pay ${kes(o.plan === 'INSTALLMENT' && amount ? Number(amount) : o.balance)} with M-Pesa`}
            </button>
            {o.paybill ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Or pay from your M-Pesa menu: Paybill <b>{o.paybill}</b>, account <b>{o.ref}</b>.
              </p>
            ) : null}
          </form>
        ) : null}

        {o.payments.length ? (
          <details className="card">
            <summary>Payment history</summary>
            <table style={{ marginTop: 10 }}>
              <tbody>
                {o.payments.map((p, i) => (
                  <tr key={i}>
                    <td>{fmtShort(p.createdAt)}</td>
                    <td>{p.channel === 'STK' ? 'M-Pesa' : p.channel === 'C2B' ? 'Paybill' : 'Manual'}</td>
                    <td className="num">{kes(p.amount)}</td>
                    <td className={`st-${p.status}`}>{p.status === 'SUCCESS' ? p.receipt ?? 'OK' : p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}

        <p className="center"><Link href={`/e/${o.event.slug}`}>Buy more tickets</Link></p>
      </main>
    </>
  );
}
