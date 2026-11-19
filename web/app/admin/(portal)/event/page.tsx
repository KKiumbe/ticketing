import { EventForm } from '@/components/event-form';
import { NoticeBar } from '@/components/ui';
import { currentEvent, noticeOf } from '@/lib/admin';

export default async function EventSettings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const notice = noticeOf(await searchParams);
  const { event } = await currentEvent();
  return (
    <>
      <h1>Event &amp; fees</h1>
      <NoticeBar notice={notice} />
      {event ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{event.name} <small>/e/{event.slug}</small></h2>
          <EventForm e={event} />
        </div>
      ) : null}
      <details className="card" open={!event}>
        <summary>+ Create a new event</summary>
        <EventForm />
      </details>
    </>
  );
}
