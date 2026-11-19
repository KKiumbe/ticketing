import Link from 'next/link';
import type { Notice } from '@/lib/admin';

export function NoticeBar({ notice }: { notice: Notice }) {
  if (notice.error) return <div className="notice bad" role="alert">{notice.error}</div>;
  if (notice.ok) return <div className="notice ok">{notice.ok}</div>;
  return null;
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
      {hint ? <div className="muted" style={{ fontSize: 12 }}>{hint}</div> : null}
    </div>
  );
}

/** A destructive action that needs a second click: the button only appears once the summary is opened */
export function ConfirmButton({ label, confirmLabel, className = 'btn sm danger' }: { label: string; confirmLabel: string; className?: string }) {
  return (
    <details style={{ display: 'inline-block' }}>
      <summary className="btn sm sec" style={{ listStyle: 'none' }}>{label}</summary>
      <button className={className} style={{ marginTop: 8 }}>{confirmLabel}</button>
    </details>
  );
}

export function NoEvent() {
  return (
    <div className="card center" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>No events yet</h2>
      <Link className="btn brand" href="/admin/event">Create your first event</Link>
    </div>
  );
}
