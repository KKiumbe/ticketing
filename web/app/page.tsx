import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default async function Home() {
  const config = await apiRequest<{ defaultEvent: string }>('/config');
  if (config.defaultEvent) redirect(`/e/${config.defaultEvent}`);
  return (
    <main className="wrap center">
      <h1>Sikika Tickets</h1>
      <p className="muted">No event selected. Set DEFAULT_EVENT_SLUG on the API.</p>
    </main>
  );
}
