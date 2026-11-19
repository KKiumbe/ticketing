import { saveCategory } from '@/app/admin/actions';
import { toNairobiInput } from '@/lib/format';
import type { AdminCategory } from '@/lib/types';

/** Add (no category) or edit a ticket category. Server-rendered form posting to a server action. */
export function CategoryForm({ eventId, c }: { eventId: number; c?: AdminCategory }) {
  const v = (x: number | string | null | undefined) => (x == null ? '' : String(x));
  return (
    <form action={saveCategory}>
      <input type="hidden" name="eventId" value={eventId} />
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid2">
        <div><label>Name</label><input name="name" required defaultValue={c?.name} /></div>
        <div><label>Description</label><input name="description" defaultValue={c?.description ?? ''} /></div>
        <div><label>Price (KES)</label><input name="price" type="number" min={0} required defaultValue={v(c?.price)} /></div>
        <div><label>Capacity</label><input name="capacity" type="number" min={0} required defaultValue={v(c?.capacity)} /></div>
        <div><label>Sort order</label><input name="sortOrder" type="number" defaultValue={v(c?.sortOrder ?? 0)} /></div>
        <div><label className="check" style={{ marginTop: 38 }}><input type="checkbox" name="salesOpen" defaultChecked={c ? c.salesOpen : true} /> Online sales open</label></div>
      </div>

      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 10, marginTop: 14 }}>
        <legend><b>Early bird</b> <small>(leave price and % empty for none)</small></legend>
        <div className="grid2">
          <div><label>Fixed price (KES)</label><input name="earlyBirdPrice" type="number" min={0} defaultValue={v(c?.earlyBirdPrice)} /></div>
          <div><label>…or discount %</label><input name="earlyBirdDiscountPercent" type="number" min={0} max={100} step="0.01" defaultValue={v(c?.earlyBirdDiscountPercent)} /></div>
          <div><label>Ends N days before event</label><input name="earlyBirdDaysBefore" type="number" min={0} defaultValue={v(c?.earlyBirdDaysBefore)} /></div>
          <div><label>…or on date (Nairobi)</label><input name="earlyBirdEndsAt" type="datetime-local" defaultValue={toNairobiInput(c?.earlyBirdEndsAt)} /></div>
          <div><label>Quota (first N tickets)</label><input name="earlyBirdQuota" type="number" min={0} placeholder="unlimited" defaultValue={v(c?.earlyBirdQuota)} /></div>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Early bird ends at whichever comes first: the days-before, the date, or the quota.</p>
      </fieldset>

      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 10, marginTop: 14 }}>
        <legend><b>Lipa pole pole</b></legend>
        <label className="check"><input type="checkbox" name="allowInstallments" defaultChecked={c?.allowInstallments} /> Allow paying in installments</label>
        <div className="grid2">
          <div><label>Minimum deposit per ticket (KES)</label><input name="minDeposit" type="number" min={0} defaultValue={v(c?.minDeposit ?? 0)} /></div>
          <div><label>Balance deadline (Nairobi)</label><input name="installmentDeadline" type="datetime-local" defaultValue={toNairobiInput(c?.installmentDeadline)} /></div>
        </div>
      </fieldset>
      <button className="btn brand" style={{ marginTop: 14 }}>{c ? 'Save category' : 'Add category'}</button>
    </form>
  );
}
