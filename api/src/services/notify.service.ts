// Ticket links / balance updates by email (SMTP) and/or webhook (your WhatsApp or SMS gateway).
import nodemailer from 'nodemailer';
import { env } from '../lib/env';

const transport = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
  : null;

const kes = (n: number) => `KES ${Number(n).toLocaleString('en-KE')}`;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function send(p: { to?: string | null; phone?: string; subject: string; text: string; html: string; meta: Record<string, unknown> }) {
  console.log(`[notify] ${p.phone ?? ''} ${p.to ?? ''} :: ${p.subject}\n${p.text}\n`);
  const jobs: Promise<unknown>[] = [];
  if (transport && p.to) jobs.push(transport.sendMail({ from: env.smtp.from, to: p.to, subject: p.subject, text: p.text, html: p.html }));
  if (env.notifyWebhook.url && p.phone) {
    jobs.push(
      fetch(env.notifyWebhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.notifyWebhook.token}` },
        body: JSON.stringify({ phone: p.phone, message: p.text, ...p.meta }),
      }),
    );
  }
  for (const r of await Promise.allSettled(jobs)) if (r.status === 'rejected') console.error('[notify] failed:', (r.reason as Error)?.message);
}

export type NotifyOrder = {
  ref: string; buyerName: string; phone: string; email: string | null; quantity: number;
  amountPaid: number; totalAmount: number; eventName: string; categoryName: string;
};

export const notifyService = {
  async ticketsIssued(o: NotifyOrder, codes: string[]) {
    const links = codes.map((c) => `${env.webBaseUrl}/t/${c}`);
    const text =
      `Hi ${o.buyerName}, payment received. Your ${o.quantity} x ${o.categoryName} ticket(s) for ${o.eventName}:\n` +
      `${links.join('\n')}\nShow the QR code at the entrance. Order ${o.ref}.`;
    const html =
      `<p>Hi ${escapeHtml(o.buyerName)},</p><p>Payment of ${kes(o.amountPaid)} received. Your tickets for <b>${escapeHtml(o.eventName)}</b>:</p>` +
      `<ul>${links.map((l, i) => `<li><a href="${l}">Ticket ${i + 1} (${escapeHtml(o.categoryName)})</a></li>`).join('')}</ul>` +
      `<p>Open the link and show the QR code at the entrance.</p><p>Order ref: ${o.ref}</p>`;
    await send({ to: o.email, phone: o.phone, subject: `Your tickets – ${o.eventName}`, text, html, meta: { type: 'tickets', ref: o.ref, links } });
  },

  async installmentReceived(o: NotifyOrder, amount: number) {
    const balance = o.totalAmount - o.amountPaid;
    const link = `${env.webBaseUrl}/o/${o.ref}`;
    const text =
      `Hi ${o.buyerName}, we've received ${kes(amount)} for ${o.eventName} (order ${o.ref}). ` +
      `Paid ${kes(o.amountPaid)} of ${kes(o.totalAmount)}. Balance ${kes(balance)}. ` +
      `Pay the rest any time: ${link} or Paybill, account ${o.ref}. Your ticket is sent once fully paid.`;
    await send({ to: o.email, phone: o.phone, subject: `Payment received – balance ${kes(balance)}`, text, html: `<p>${escapeHtml(text)}</p>`, meta: { type: 'installment', ref: o.ref, link } });
  },
};
