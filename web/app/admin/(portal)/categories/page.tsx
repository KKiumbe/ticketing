import { CategoryForm } from '@/components/category-form';
import { NoEvent, NoticeBar } from '@/components/ui';
import { currentEvent, noticeOf } from '@/lib/admin';
import { adminApi } from '@/lib/api';
import { fmtShort, kes } from '@/lib/format';
import type { AdminCategory } from '@/lib/types';

export default async function Categories({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const notice = noticeOf(await searchParams);
  const { event } = await currentEvent();
  if (!event) return <NoEvent />;
  const cats = await adminApi<AdminCategory[]>(`/events/${event.id}/categories`);
  return (
    <>
      <h1>Ticket categories</h1>
      <NoticeBar notice={notice} />
      {cats.map((c) => (
        <details key={c.id} className="card">
          <summary>
            <span style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span>{c.name}</span>
              <span className="muted" style={{ fontWeight: 400 }}>
                {kes(c.state.currentPrice)}{c.state.earlyBirdActive ? ` early bird (then ${kes(c.price)})` : ''} · gate {kes(c.state.gatePrice)} · {c.state.sold}/{c.capacity} sold
              </span>
              {c.state.earlyBirdActive ? (
                <span className="badge eb">EB{c.state.earlyBirdEndsAt ? ` till ${fmtShort(c.state.earlyBirdEndsAt)}` : ''}{c.state.earlyBirdLeft != null ? ` · ${c.state.earlyBirdLeft} left` : ''}</span>
              ) : null}
              {c.state.installmentsOpen ? <span className="badge pp">Pole pole</span> : null}
              {!c.salesOpen ? <span className="badge bad">Closed</span> : null}
            </span>
          </summary>
          <CategoryForm eventId={event.id} c={c} />
        </details>
      ))}
      <details className="card" open={!cats.length}>
        <summary>+ Add ticket category</summary>
        <CategoryForm eventId={event.id} />
      </details>
    </>
  );
}
