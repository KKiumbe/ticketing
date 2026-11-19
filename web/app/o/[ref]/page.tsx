import { notFound } from 'next/navigation';
import { OrderViewClient } from '@/components/order-view';
import { ApiError, apiRequest } from '@/lib/api';
import type { OrderView } from '@/lib/types';

export const metadata = { title: 'Your order – Sikika Tickets' };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ waiting?: string; err?: string }>;
}) {
  const { ref } = await params;
  const sp = await searchParams;
  let order: OrderView;
  try {
    order = await apiRequest<OrderView>(`/orders/${encodeURIComponent(ref)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return <OrderViewClient initial={order} waiting={sp.waiting === '1'} initialError={sp.err} />;
}
