import { login } from '../actions';
import { NoticeBar } from '@/components/ui';
import { noticeOf } from '@/lib/admin';

export const metadata = { title: 'Admin login – Sikika Tickets' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const notice = noticeOf(await searchParams);
  return (
    <main className="wrap" style={{ maxWidth: 400, paddingTop: 80 }}>
      <form className="card" action={login}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Sikika Tickets admin</h1>
        <NoticeBar notice={notice} />
        <label htmlFor="password">Admin password</label>
        <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" />
        <button className="btn block brand">Sign in</button>
      </form>
    </main>
  );
}
