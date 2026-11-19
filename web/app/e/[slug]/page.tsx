import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Checkout } from '@/components/checkout';
import { ApiError, apiRequest } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { PublicCategory, PublicEvent } from '@/lib/types';

type Data = { event: PublicEvent; categories: PublicCategory[] };

async function load(slug: string) {
  try {
    return await apiRequest<Data>(`/events/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { event } = await load((await params).slug);
  return { title: `${event.name} – Tickets`, description: event.description ?? undefined };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { event, categories } = await load((await params).slug);
  return (
    <>
      <header className="hero">
        <div className="wrap">
          <h1>{event.name}</h1>
          <p>{fmtDate(event.startsAt)}{event.venue ? ` · ${event.venue}` : ''}</p>
        </div>
      </header>
      <main className="wrap">
        {event.description ? <p className="muted">{event.description}</p> : null}
        <Checkout event={event} categories={categories} />
      </main>
    </>
  );
}
