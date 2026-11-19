'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { fmtDate, fmtDay, kes } from '@/lib/format';
import { feeLines } from '@/lib/pricing';
import type { PublicCategory, PublicEvent } from '@/lib/types';

type CreateOrderResponse = { ref: string; total: number; stk: { checkoutRequestId?: string; error?: string } | null };

export function Checkout({ event, categories }: { event: PublicEvent; categories: PublicCategory[] }) {
  const router = useRouter();
  const [selId, setSelId] = useState<number | null>(null);
  const [plan, setPlan] = useState<'FULL' | 'INSTALLMENT'>('FULL');
  const [qty, setQty] = useState(1);
  const [deposit, setDeposit] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [findRef, setFindRef] = useState('');

  const sel = categories.find((c) => c.id === selId) ?? null;
  const q = Math.max(1, Math.min(20, qty || 1));
  const calc = useMemo(() => {
    if (!sel) return null;
    const subtotal = sel.currentPrice * q;
    const fees = feeLines(event.fees, subtotal, q);
    const total = subtotal + fees.reduce((a, l) => a + l.amount, 0);
    const minDeposit = Math.min(total, sel.minDeposit * q);
    return { subtotal, fees, total, minDeposit };
  }, [sel, q, event.fees]);

  const payingNow = plan === 'INSTALLMENT' && calc ? Math.max(calc.minDeposit, Number(deposit) || calc.minDeposit) : calc?.total ?? 0;

  function pick(c: PublicCategory) {
    setSelId(c.id);
    if (!c.installments) setPlan('FULL');
    setDeposit('');
    setError('');
    setTimeout(() => document.getElementById('buy')?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sel || !calc) return;
    setError('');
    if (plan === 'INSTALLMENT' && (payingNow < calc.minDeposit || payingNow > calc.total)) {
      setError(`Pay between ${kes(calc.minDeposit)} and ${kes(calc.total)} now`);
      return;
    }
    setBusy(true);
    try {
      const r = await clientApi<CreateOrderResponse>(`/events/${event.slug}/orders`, {
        body: { categoryId: sel.id, buyerName: name, phone, email, quantity: q, plan, amount: plan === 'INSTALLMENT' ? payingNow : undefined },
      });
      const qs = r.stk?.error ? `?err=${encodeURIComponent(r.stk.error)}` : r.stk ? '?waiting=1' : '';
      router.push(`/o/${r.ref}${qs}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      router.refresh(); // prices/availability may have changed
    }
  }

  if (event.salesClosed) {
    return (
      <div className="card center">
        <h2 style={{ marginTop: 0 }}>Online sales have closed</h2>
        <p className="muted">Tickets are available at the gate.</p>
      </div>
    );
  }

  return (
    <>
      <h2>1. Choose your ticket</h2>
      {categories.map((c) => {
        const off = c.soldOut || !c.salesOpen;
        return (
          <button key={c.id} type="button" className={`card cat ${selId === c.id ? 'sel' : ''}`} disabled={off} onClick={() => pick(c)}>
            <div>
              <h3>{c.name}</h3>
              {c.description ? <small>{c.description}</small> : null}
              <div>
                {c.earlyBirdActive ? (
                  <span className="badge eb">
                    Early bird{c.earlyBirdEndsAt ? ` till ${fmtDay(c.earlyBirdEndsAt)}` : ''}{c.earlyBirdLeft != null ? ` · ${c.earlyBirdLeft} left` : ''}
                  </span>
                ) : null}
                {c.installments ? <span className="badge pp">Lipa pole pole</span> : null}
                {!c.soldOut && event.gateMarkupPercent > 0 ? <span className="badge">At the gate {kes(c.gatePrice)}</span> : null}
                {c.soldOut ? <span className="badge bad">Sold out</span> : !c.salesOpen ? <span className="badge bad">Closed</span> : c.remaining <= 20 ? <span className="badge bad">Only {c.remaining} left</span> : null}
              </div>
            </div>
            <div className="price">
              {c.earlyBirdActive ? <s>{kes(c.price)}</s> : null}
              <b>{kes(c.currentPrice)}</b>
            </div>
          </button>
        );
      })}

      {sel && calc ? (
        <form id="buy" className="card" onSubmit={submit} autoComplete="on">
          <h2 style={{ marginTop: 0 }}>2. Your details</h2>
          <label htmlFor="name">Full name</label>
          <input id="name" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="row">
            <div>
              <label htmlFor="phone">M-Pesa number</label>
              <input id="phone" required inputMode="tel" placeholder="0712 345 678" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div style={{ maxWidth: 120 }}>
              <label htmlFor="qty">Tickets</label>
              <input id="qty" type="number" min={1} max={Math.min(20, sel.remaining)} value={qty} onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)} />
            </div>
          </div>
          <label htmlFor="email">Email (optional, we&apos;ll send your tickets here too)</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

          {sel.installments ? (
            <>
              <label>3. How do you want to pay?</label>
              <div className="seg">
                <button type="button" className={plan === 'FULL' ? 'on' : ''} onClick={() => setPlan('FULL')}>Pay in full</button>
                <button type="button" className={plan === 'INSTALLMENT' ? 'on' : ''} onClick={() => setPlan('INSTALLMENT')}>Lipa pole pole</button>
              </div>
              {plan === 'INSTALLMENT' ? (
                <>
                  <p className="muted">
                    Pay at least {kes(calc.minDeposit)} now and the rest in any amounts later.
                    {sel.earlyBirdActive ? ' Your early bird price is locked in.' : ''}
                    {sel.installmentDeadline ? ` Clear the balance by ${fmtDate(sel.installmentDeadline)}.` : ''} Your ticket QR is sent once fully paid.
                  </p>
                  <label htmlFor="deposit">Amount to pay now (KES)</label>
                  <input id="deposit" type="number" min={calc.minDeposit} max={calc.total} placeholder={String(calc.minDeposit)} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                </>
              ) : null}
            </>
          ) : null}

          {calc.fees.length ? (
            <div style={{ marginTop: 14 }}>
              <div className="line"><span>{q} × {sel.name}{sel.earlyBirdActive ? ' (early bird)' : ''}</span><span>{kes(calc.subtotal)}</span></div>
              {calc.fees.map((f) => (
                <div key={f.name} className="line muted"><span>{f.name}{f.type === 'percent' ? ` (${f.value}%)` : ''}</span><span>{kes(f.amount)}</span></div>
              ))}
            </div>
          ) : null}
          <div className="total"><span>Total</span><b>{kes(calc.total)}</b></div>
          {plan === 'INSTALLMENT' ? <div className="line"><span>Paying now</span><b>{kes(payingNow)}</b></div> : null}

          <button className="btn block" disabled={busy}>{busy ? 'Sending M-Pesa prompt…' : `Pay ${kes(payingNow)} with M-Pesa`}</button>
          {error ? <div className="err" role="alert">{error}</div> : null}
        </form>
      ) : null}

      <form className="center muted" style={{ marginTop: 30 }} onSubmit={(e) => { e.preventDefault(); if (findRef.trim()) router.push(`/o/${findRef.trim().toUpperCase()}`); }}>
        <p>Already bought? Open your order with its ref:</p>
        <div className="row" style={{ maxWidth: 340, margin: '0 auto' }}>
          <input placeholder="e.g. TK7KQ2MX" value={findRef} onChange={(e) => setFindRef(e.target.value)} />
          <button className="btn sec" style={{ flex: '0 0 auto' }}>Open</button>
        </div>
      </form>
    </>
  );
}
