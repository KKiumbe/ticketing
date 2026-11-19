import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap center">
      <h1>Not found</h1>
      <p className="muted">That event, order or ticket doesn&apos;t exist.</p>
      <Link href="/">Back to tickets</Link>
    </main>
  );
}
