import { useState } from 'react';
import { Shell, Card, Avatar, Progress, Notice, Confirm, useAction, formatDay, timeAgo } from '../ui';
import { nameOf, partnerOf, weekStartOf, ymd } from '../config';
import { goalLine, milestonesOf } from './JourneyHome';

const EXAMPLES = [
  { label: 'Four workouts together', kind: 'count', target: 4, unit: 'workouts', when: 'week' },
  { label: 'Read and discuss a chapter', kind: 'milestone', when: 'week' },
  { label: 'An outdoor adventure', kind: 'milestone', when: 'month' },
  { label: 'Save toward something', kind: 'count', target: 1000, unit: 'dollars', when: 'none' },
];

function range(when, date) {
  const today = new Date();
  if (when === 'week') {
    const start = weekStartOf(today);
    const end = new Date(`${start}T00:00:00`); end.setDate(end.getDate() + 6);
    return { starts: start, ends: ymd(end) };
  }
  if (when === 'month') {
    return { starts: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), ends: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
  }
  if (when === 'date' && date) return { starts: ymd(today), ends: date };
  return { starts: null, ends: null };
}

/** Suggest a goal (or change one). Short, with examples to start from. */
export function GoalForm({ j, go, goal = null }) {
  const editing = !!goal;
  const [title, setTitle] = useState(goal?.title || '');
  const [kind, setKind] = useState(goal?.kind || 'count');
  const [target, setTarget] = useState(goal?.target ? String(goal.target) : '4');
  const [unit, setUnit] = useState(goal?.unit || '');
  const [when, setWhen] = useState(goal ? (goal.ends_on ? 'date' : 'none') : 'week');
  const [date, setDate] = useState(goal?.ends_on || '');
  const [details, setDetails] = useState(goal?.details || '');
  const [busy, error, run] = useAction();
  const partner = partnerOf(j.snap);

  const applyExample = (ex) => {
    setTitle(ex.label); setKind(ex.kind); setTarget(String(ex.target || 4)); setUnit(ex.unit || ''); setWhen(ex.when);
  };

  const save = () => run(async () => {
    const { starts, ends } = editing && when === 'date' ? { starts: goal.starts_on, ends: date } : range(when, date);
    const args = {
      p_title: title, p_target: kind === 'count' ? Number(target) : null, p_unit: kind === 'count' ? unit : null,
      p_starts_on: starts, p_ends_on: ends, p_details: details || null,
    };
    if (editing) {
      await j.act('forge_update_goal', { p_goal: goal.id, ...args });
      go('goal', { id: goal.id });
    } else {
      const created = await j.act('forge_create_goal', { ...args, p_kind: kind });
      go('goal', { id: created.id });
    }
  });

  return (
    <Shell title={editing ? 'Edit goal' : 'Suggest a shared goal'}
      lede={editing ? null : `${nameOf(partner)} agrees before it starts. Keep it simple and doable.`}
      onBack={() => (editing ? go('goal', { id: goal.id }) : go('home'))} testid="journey-goal-form">
      {!editing && (
        <div className="jr-chips" aria-label="Examples">
          {EXAMPLES.map(ex => (
            <button key={ex.label} type="button" className="jr-chip" onClick={() => applyExample(ex)}>{ex.label}</button>
          ))}
        </div>
      )}
      <Card>
        <form className="jr-form" onSubmit={e => { e.preventDefault(); save(); }}>
          <label className="jr-label" htmlFor="jr-goal-title">Goal</label>
          <input id="jr-goal-title" className="jr-input" maxLength={80} placeholder="What will you do together?"
            value={title} onChange={e => setTitle(e.target.value)} />

          {!editing && (
            <div className="jr-seg" role="radiogroup" aria-label="Kind of goal">
              <button type="button" role="radio" aria-checked={kind === 'count'} className={kind === 'count' ? 'on' : ''} onClick={() => setKind('count')}>A number to reach</button>
              <button type="button" role="radio" aria-checked={kind === 'milestone'} className={kind === 'milestone' ? 'on' : ''} onClick={() => setKind('milestone')}>Done once</button>
            </div>
          )}

          {kind === 'count' && (
            <div className="jr-target">
              <div>
                <label className="jr-label" htmlFor="jr-goal-target">Target</label>
                <input id="jr-goal-target" className="jr-input" type="number" inputMode="numeric" min={1} max={1000000}
                  value={target} onChange={e => setTarget(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div>
                <label className="jr-label" htmlFor="jr-goal-unit">Of what <span className="jr-optional">optional</span></label>
                <input id="jr-goal-unit" className="jr-input" maxLength={24} placeholder="workouts"
                  value={unit} onChange={e => setUnit(e.target.value)} />
              </div>
            </div>
          )}

          <span className="jr-label">When</span>
          <div className="jr-seg four" role="radiogroup" aria-label="Timeframe">
            {[['week', 'This week'], ['month', 'This month'], ['date', 'By a date'], ['none', 'No end']].map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={when === k} className={when === k ? 'on' : ''} onClick={() => setWhen(k)}>{label}</button>
            ))}
          </div>
          {when === 'date' && (
            <input className="jr-input" type="date" aria-label="End date" value={date} onChange={e => setDate(e.target.value)} />
          )}

          <label className="jr-label" htmlFor="jr-goal-details">Details <span className="jr-optional">optional</span></label>
          <textarea id="jr-goal-details" className="jr-input jr-textarea" rows={2} maxLength={500}
            placeholder="Why it matters, or how you’ll do it" value={details} onChange={e => setDetails(e.target.value)} />

          <button type="submit" className="btn btn-primary btn-full" disabled={busy || !title.trim() || (kind === 'count' && !(Number(target) > 0)) || (when === 'date' && !date)}>
            {busy ? 'Saving…' : editing ? 'Save changes' : `Suggest to ${nameOf(partner)}`}
          </button>
          <Notice text={error} />
        </form>
      </Card>
    </Shell>
  );
}

export function GoalDetail({ j, go, id }) {
  const { snap } = j;
  const me = snap.me;
  const partner = partnerOf(snap);
  const goal = snap.journey?.goals?.find(g => g.id === id);
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, error, run] = useAction();

  if (!goal) {
    return (
      <Shell title="Goal" onBack={() => go('home')} testid="journey-goal">
        <Card><p className="jr-text">This goal is no longer here.</p></Card>
      </Shell>
    );
  }

  const mineProposal = goal.status === 'proposed' && goal.created_by === me.user_id;
  const theirProposal = goal.status === 'proposed' && goal.created_by !== me.user_id;
  const who = (uid) => (uid === me.user_id ? 'You' : nameOf(partner));
  const unit = goal.unit || '';

  const add = () => run(async () => {
    await j.act('forge_add_contribution', { p_goal: goal.id, p_amount: amount, p_note: note || null });
    setNote('');
    setAmount(1);
  });

  return (
    <Shell title={goal.title} onBack={() => go('home')} testid="journey-goal">
      {theirProposal && (
        <Card className="jr-ask" testid="journey-goal-proposal">
          <p className="jr-text"><strong>{nameOf(partner)}</strong> suggested this goal. Agree to start it together.</p>
          <div className="jr-actions">
            <button type="button" className="btn btn-primary" disabled={busy} data-testid="journey-goal-agree"
              onClick={() => run(() => j.act('forge_agree_goal', { p_goal: goal.id }))}>Agree</button>
            <button type="button" className="btn btn-ghost" disabled={busy}
              onClick={() => setConfirm({ kind: 'decline' })}>Not now</button>
          </div>
        </Card>
      )}
      {mineProposal && (
        <Card className="jr-ask">
          <p className="jr-text">Waiting for <strong>{nameOf(partner)}</strong> to agree. It starts once they do.</p>
          <div className="jr-actions">
            <button type="button" className="btn btn-ghost" onClick={() => go('editGoal', { id: goal.id })}>Edit</button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm({ kind: 'withdraw' })}>Withdraw</button>
          </div>
        </Card>
      )}

      <Card testid="journey-goal-progress">
        {goal.kind === 'count' ? (
          <>
            <div className="jr-big">
              <span className="jr-big-n" data-testid="journey-goal-total">{goal.progress}</span>
              <span className="jr-big-of">of {goal.target}{unit ? ` ${unit}` : ''}</span>
            </div>
            <Progress value={goal.progress} target={goal.target} />
            <p className="jr-fine">Together{goal.ends_on ? ` · by ${formatDay(goal.ends_on)}` : ''}{goal.status === 'completed' ? ` · completed ${formatDay(goal.completed_at)} 🎉` : ''}</p>
          </>
        ) : (
          <p className="jr-text">
            {goal.status === 'completed'
              ? <>Done {formatDay(goal.completed_at)} 🎉 — marked by {who(goal.completed_by)}.</>
              : <>A one-time milestone{goal.ends_on ? `, by ${formatDay(goal.ends_on)}` : ''}.</>}
          </p>
        )}
        {goal.details && <p className="jr-text jr-details">{goal.details}</p>}

        {goal.status !== 'proposed' && goal.kind === 'count' && (
          <form className="jr-add" onSubmit={e => { e.preventDefault(); add(); }} data-testid="journey-add-form">
            <div className="jr-stepper" aria-label="Amount">
              <button type="button" onClick={() => setAmount(a => Math.max(1, a - 1))} aria-label="Less">−</button>
              <input type="number" inputMode="numeric" min={1} max={100000} value={amount} aria-label="Amount"
                onChange={e => setAmount(Math.max(1, Math.min(100000, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
              <button type="button" onClick={() => setAmount(a => Math.min(100000, a + 1))} aria-label="More">+</button>
            </div>
            <input className="jr-input" maxLength={200} placeholder="Add a note (optional)" value={note} onChange={e => setNote(e.target.value)} aria-label="Note" />
            <button type="submit" className="btn btn-primary btn-full" disabled={busy} data-testid="journey-add-btn">
              Add {amount}{unit ? ` ${amount === 1 ? unit.replace(/s$/, '') : unit}` : ''}
            </button>
          </form>
        )}
        {goal.status !== 'proposed' && goal.kind === 'milestone' && (
          goal.status === 'completed'
            ? <button type="button" className="btn btn-ghost btn-full" disabled={busy} onClick={() => run(() => j.act('forge_set_goal_done', { p_goal: goal.id, p_done: false }))}>Mark as not done</button>
            : <button type="button" className="btn btn-primary btn-full" disabled={busy} data-testid="journey-goal-done" onClick={() => run(() => j.act('forge_set_goal_done', { p_goal: goal.id, p_done: true }))}>Mark as done</button>
        )}
        <Notice text={error} />
      </Card>

      {goal.kind === 'count' && goal.contributions.length > 0 && (
        <Card title="Along the way" testid="journey-contributions">
          <ul className="jr-list">
            {goal.contributions.map(c => (
              <li key={c.id} className="jr-contrib">
                <Avatar person={c.user_id === me.user_id ? me : partner} me={c.user_id === me.user_id} size={30} />
                <span className="jr-contrib-body">
                  <span className="jr-contrib-line"><strong>{who(c.user_id)}</strong> added {c.amount}{unit ? ` ${c.amount === 1 ? unit.replace(/s$/, '') : unit}` : ''}</span>
                  {c.note && <span className="jr-contrib-note">“{c.note}”</span>}
                  <span className="jr-contrib-when">{timeAgo(c.created_at)}</span>
                </span>
                {c.user_id === me.user_id && (
                  <button type="button" className="jr-link" disabled={busy}
                    onClick={() => run(() => j.act('forge_remove_contribution', { p_contribution: c.id }))}>Undo</button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {goal.status !== 'proposed' && (
        <div className="jr-row-links">
          <button type="button" className="jr-link" onClick={() => go('editGoal', { id: goal.id })}>Edit goal</button>
          <button type="button" className="jr-link danger" onClick={() => setConfirm({ kind: 'remove' })}>Remove goal</button>
        </div>
      )}

      {confirm && (
        <Confirm
          title={confirm.kind === 'decline' ? 'Not now?' : confirm.kind === 'withdraw' ? 'Withdraw this goal?' : 'Remove this goal?'}
          body={confirm.kind === 'remove'
            ? `It is removed for both of you, with everything added to it.`
            : `It is removed for both of you. You can always suggest another.`}
          confirmLabel={confirm.kind === 'decline' ? 'Decline' : confirm.kind === 'withdraw' ? 'Withdraw' : 'Remove'}
          danger={confirm.kind === 'remove'}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => { await j.act('forge_remove_goal', { p_goal: goal.id }); setConfirm(null); go('home'); })}
        />
      )}
    </Shell>
  );
}

export function Milestones({ j, go }) {
  const { snap } = j;
  const me = snap.me;
  const partner = partnerOf(snap);
  const all = milestonesOf(snap.journey);
  return (
    <Shell title="Milestones" lede="Everything you’ve finished together." onBack={() => go('home')} testid="journey-all-milestones">
      <Card>
        {all.length === 0 ? <p className="jr-empty">Nothing yet — your first will be here.</p> : (
          <ul className="jr-list">
            {all.map(m => (
              <li key={m.key} className="jr-milestone">
                <span aria-hidden="true">{m.kind === 'goal' ? '🏁' : '🌅'}</span>
                <span className="jr-milestone-title">{m.title}<span className="jr-person-sub">{m.by === me.user_id ? 'You' : nameOf(partner)}</span></span>
                <span className="jr-milestone-when">{formatDay(m.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
