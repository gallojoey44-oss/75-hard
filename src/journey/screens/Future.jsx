import { useMemo, useState } from 'react';
import { Shell, Card, Notice, Confirm, useAction, formatDay } from '../ui';
import { nameOf, partnerOf } from '../config';

const AREAS = ['Travel', 'Adventure', 'Health', 'Learning', 'Home', 'Money', 'Family', 'Growth'];

/** Add or edit one plan. Every field but the title is optional. */
function PlanForm({ j, item = null, onDone }) {
  const [title, setTitle] = useState(item?.title || '');
  const [area, setArea] = useState(item?.area || '');
  const [date, setDate] = useState(item?.target_date || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [busy, error, run] = useAction();

  const save = () => run(async () => {
    const args = { p_title: title, p_area: area || null, p_target_date: date || null, p_notes: notes || null };
    if (item) await j.act('forge_update_future_item', { p_item: item.id, ...args });
    else await j.act('forge_add_future_item', args);
    onDone();
  });

  return (
    <form className="jr-form" onSubmit={e => { e.preventDefault(); save(); }} data-testid="journey-plan-form">
      <label className="jr-label" htmlFor="jr-plan-title">{item ? 'Plan' : 'Something to work toward together'}</label>
      <input id="jr-plan-title" className="jr-input" maxLength={80} placeholder="Visit Japan, run a half marathon…"
        value={title} onChange={e => setTitle(e.target.value)} />
      <span className="jr-label">Area <span className="jr-optional">optional — any word works</span></span>
      <div className="jr-chips tight">
        {AREAS.map(a => (
          <button key={a} type="button" className={`jr-chip${area === a ? ' on' : ''}`} onClick={() => setArea(area === a ? '' : a)}>{a}</button>
        ))}
      </div>
      <input className="jr-input" maxLength={30} placeholder="Or your own" aria-label="Area" value={area} onChange={e => setArea(e.target.value)} />
      <label className="jr-label" htmlFor="jr-plan-date">By when <span className="jr-optional">optional</span></label>
      <input id="jr-plan-date" className="jr-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <label className="jr-label" htmlFor="jr-plan-notes">Notes <span className="jr-optional">optional</span></label>
      <textarea id="jr-plan-notes" className="jr-input jr-textarea" rows={2} maxLength={1000}
        placeholder="First steps, why it matters" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="jr-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>{item ? 'Save' : 'Add to Our Future'}</button>
        <button type="button" className="btn btn-ghost" onClick={onDone} disabled={busy}>Cancel</button>
      </div>
      <Notice text={error} />
    </form>
  );
}

export default function Future({ j, go }) {
  const { snap } = j;
  const me = snap.me;
  const partner = partnerOf(snap);
  const items = snap.journey?.future || [];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, error, run] = useAction();

  const open = items.filter(f => !f.done);
  const achieved = items.filter(f => f.done).sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  // Grouped by the words the two of them chose, not a fixed list.
  const groups = useMemo(() => {
    const by = new Map();
    for (const f of open) {
      const key = f.area || 'Plans';
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(f);
    }
    for (const list of by.values()) list.sort((a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999'));
    return [...by.entries()].sort(([a], [b]) => (a === 'Plans') - (b === 'Plans') || a.localeCompare(b));
  }, [open]);

  const who = (uid) => (uid === me.user_id ? 'you' : nameOf(partner));

  return (
    <Shell title="Our Future" lede="The places, skills and milestones you’re building toward. Add what matters to you both, in your own words."
      onBack={() => go('home')} testid="journey-future">
      {adding ? (
        <Card><PlanForm j={j} onDone={() => setAdding(false)} /></Card>
      ) : (
        <button type="button" className="btn btn-primary btn-full jr-gap" onClick={() => setAdding(true)} data-testid="journey-plan-add">Add a plan</button>
      )}

      {open.length === 0 && !adding && (
        <Card><p className="jr-empty">Nothing here yet. Trips, skills, a home, a race, a savings milestone — whatever you’re dreaming toward.</p></Card>
      )}

      {groups.map(([area, list]) => (
        <Card key={area} title={area} meta={`${list.length}`} testid="journey-plan-group">
          <ul className="jr-list">
            {list.map(f => (
              <li key={f.id} className="jr-plan">
                {editing === f.id ? (
                  <PlanForm j={j} item={f} onDone={() => setEditing(null)} />
                ) : (
                  <>
                    <button type="button" className="jr-check" aria-label={`Mark ${f.title} as achieved`} disabled={busy}
                      onClick={() => run(() => j.act('forge_set_future_item_done', { p_item: f.id, p_done: true }))} />
                    <button type="button" className="jr-plan-body" onClick={() => setEditing(f.id)}>
                      <span className="jr-plan-title">{f.title}</span>
                      {f.notes && <span className="jr-plan-notes">{f.notes}</span>}
                      <span className="jr-plan-meta">
                        {f.target_date ? `By ${formatDay(f.target_date)} · ` : ''}added by {who(f.created_by)}
                      </span>
                    </button>
                    <button type="button" className="jr-link danger" onClick={() => setConfirm(f)} aria-label={`Remove ${f.title}`}>Remove</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {achieved.length > 0 && (
        <Card title="Achieved" meta={`${achieved.length}`} className="jr-achieved" testid="journey-plan-achieved">
          <ul className="jr-list">
            {achieved.map(f => (
              <li key={f.id} className="jr-plan done">
                <button type="button" className="jr-check on" aria-label={`Mark ${f.title} as not achieved`} disabled={busy}
                  onClick={() => run(() => j.act('forge_set_future_item_done', { p_item: f.id, p_done: false }))}>✓</button>
                <span className="jr-plan-body static">
                  <span className="jr-plan-title">{f.title}</span>
                  <span className="jr-plan-meta">Achieved {formatDay(f.completed_at)}{f.completed_by ? ` · marked by ${who(f.completed_by)}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Notice text={error} />
      {confirm && (
        <Confirm
          title={`Remove “${confirm.title}”?`}
          body="It is removed from Our Future for both of you."
          confirmLabel="Remove"
          danger
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => { await j.act('forge_remove_future_item', { p_item: confirm.id }); setConfirm(null); })}
        />
      )}
    </Shell>
  );
}
