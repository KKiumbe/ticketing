import { NextRequest, NextResponse } from 'next/server';
import { rawApiRequest } from '@/lib/api';

export async function GET(req: NextRequest) {
  const eventId = Number(req.nextUrl.searchParams.get('event'));
  if (!eventId) return NextResponse.json({ message: 'event is required' }, { status: 400 });
  const res = await rawApiRequest(`/admin/events/${eventId}/attendees.csv`, {}, true);
  if (res.status === 401) return NextResponse.redirect(new URL('/admin/login', req.url));
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="attendees-${eventId}.csv"` },
  });
}
