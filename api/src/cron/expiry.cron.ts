// Frees seats held by abandoned orders and closes overdue lipa pole pole orders. Runs every minute.
import cron from 'node-cron';
import prisma from '../lib/prisma';
import { env } from '../lib/env';

export async function runExpiry() {
  const cutoff = new Date(Date.now() - env.pendingOrderTtlMin * 60_000);
  const recentStk = new Date(Date.now() - 5 * 60_000);
  // Unpaid orders past the TTL release their seats (incl. early-bird slots),
  // unless an STK push is still in flight
  const a = await prisma.order.updateMany({
    where: {
      status: 'PENDING', amountPaid: 0, createdAt: { lt: cutoff },
      payments: { none: { status: 'PENDING', createdAt: { gt: recentStk } } },
    },
    data: { status: 'EXPIRED' },
  });
  // Pole pole orders not cleared by the category deadline. Money paid stays on the order.
  const b = await prisma.order.updateMany({
    where: { status: 'PARTIAL', category: { installmentDeadline: { lt: new Date() } } },
    data: { status: 'EXPIRED' },
  });
  if (a.count || b.count) console.log(`[expiry] pending→expired: ${a.count}, overdue pole pole: ${b.count}`);
}

export function startExpiryCron() {
  const tick = () => runExpiry().catch((e) => console.error('[expiry]', (e as Error).message));
  void tick();
  return cron.schedule('* * * * *', tick);
}
