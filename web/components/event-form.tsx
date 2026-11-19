import { createEvent, updateEvent } from '@/app/admin/actions';
import { toNairobiInput } from '@/lib/format';
import type { AdminEvent, FeeRule } from '@/lib/types';

function FeeRow({ f }: { f?: FeeRule }) {
  return (
    <tr>
      <td><input name="feeName" defaultValue={f?.name ?? ''} placeholder="e.g. Processing fee" /></td>
      <td>
        <select name="feeType" defaultValue={f?.type ?? 'percent'}>
          <option value="percent">%</option>
          <option value="fixed">KES</option>
        </select>
      </td>
      <td><input name="feeValue" type="number" step="0.01" min={0} defaultValue={f?.value ?? ''} /></td>
      <td>
        <select name="feePerTicket" defaultValue={f?.perTicket ? 'yes' : 'no'}>
          <option value="no">per order</option>
          <option value="yes">per ticket</option>
        </select>
      </td>
      <td>
        <select name="feeAppliesTo" defaultValue={f?.appliesTo ?? 'ALL'}>
          <option value="ALL">Online + gate</option>
          <option value="ONLINE">Online only</option>
          <option value="GATE">Gate only</option>
        </select>
      </td>
    </tr>
  );
}

export function EventForm({ e }: { e?: AdminEvent }) {
  const fees = e?.fees ?? [];
  return (
    <form action={e ? updateEvent : createEvent}>
      {e ? <input type="hidden" name="id" value={e.id} /> : null}
      <div className="grid2">
        {!e ? (
          <div><label>URL slug</label><input name="slug" required pattern="[a-z0-9-]+" placeholder="business-meets-tech" /></div>
        ) : null}
        <div><label>Name</label><input name="name" required defaultValue={e?.name} /></div>
        <div><label>Starts (Nairobi time)</label><input name="startsAt" type="datetime-local" required defaultValue={toNairobiInput(e?.startsAt)} /></div>
        <div><label>Venue</label><input name="venue" defaultValue={e?.venue ?? ''} /></div>
        <div><label>Gate markup %</label><input name="gateMarkupPercent" type="number" min={0} step="0.01" defaultValue={e?.gateMarkupPercent ?? 20} /></div>
        <div><label>Banner image URL</label><input name="bannerUrl" type="url" defaultValue={e?.bannerUrl ?? ''} /></div>
      </div>
      <label>Description</label>
      <textarea name="description" rows={3} defaultValue={e?.description ?? ''} />
      <label className="check"><input type="checkbox" name="isPublished" defaultChecked={e ? e.isPublished : true} /> Published (visible on the sales page)</label>

      <h3>Fees charged to the buyer</h3>
      <p className="muted" style={{ marginTop: 0 }}>Shown at checkout and stored on each order. Empty rows are ignored. Changing fees doesn&apos;t affect existing orders.</p>
      <div className="scroll">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Charged</th><th>Applies to</th></tr></thead>
          <tbody>
            {fees.map((f, i) => <FeeRow key={i} f={f} />)}
            <FeeRow />
            <FeeRow />
          </tbody>
        </table>
      </div>
      <button className="btn brand" style={{ marginTop: 14 }}>{e ? 'Save event' : 'Create event'}</button>
    </form>
  );
}
