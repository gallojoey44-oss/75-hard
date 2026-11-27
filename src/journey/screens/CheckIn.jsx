import { useMemo, useState } from 'react';
import { Shell, Card, Notice, useAction, formatDay } from '../ui';
import { nameOf, partnerOf, weekStartOf } from '../config';

const PROMPTS = [
  ['went_well', 'What went well this week?'],
  ['improving', 'What are you working to improve?'],
  ['appreciate', 'What do you appreciate about {partner}?'],
  ['support', 'How can you support each other next week?'],
];

function Answers({ checkin, partnerName }) {
  return (
    <dl className="jr-answers">
      {PROMPTS.filter(([k]) => checkin[k]).map(([k, q]) => (
        <div key={k}>
          <dt>{q.replace('{partner}', partnerName)}</dt>
          <dd>{checkin[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** An optional weekly reflection. Shared with your partner once saved. */
export default function CheckIn({ j, go }) {
  const { snap } = j;
  const me = snap.me;
  const partner = partnerOf(snap);
  const pName = nameOf(partner);
  const week = weekStartOf();
  const all = snap.journey?.checkins || [];
  const mine = all.find(c => c.user_id === me.user_id && c.week_start === week);
  const theirs = all.find(c => c.user_id === partner?.user_id && c.week_start === week);
  const [draft, setDraft] = useState(() => Object.fromEntries(PROMPTS.map(([k]) => [k, mine?.[k] || ''])));
  const [saved, setSaved] = useState(false);
  const [busy, error, run] = useAction();

  const earlier = useMemo(() => {
    const weeks = new Map();
    for (const c of all) {
      if (c.week_start === week) continue;
      if (!weeks.has(c.week_start)) weeks.set(c.week_start, []);
      weeks.get(c.week_start).push(c);
    }
    return [...weeks.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [all, week]);

  const save = () => run(async () => {
    await j.act('forge_save_checkin', {
      p_week_start: week, p_went_well: draft.went_well, p_improving: draft.improving,
      p_appreciate: draft.appreciate, p_support: draft.support,
    });
    setSaved(true);
  });

  return (
    <Shell title="Weekly check-in" lede={`Week of ${formatDay(week)}. Answer any, all or none — it’s here when it helps.`}
      onBack={() => go('home')} testid="journey-checkin">
      <Card title="Your check-in" testid="journey-checkin-mine">
        <form className="jr-form" onSubmit={e => { e.preventDefault(); save(); }}>
          {PROMPTS.map(([k, q]) => (
            <label key={k} className="jr-prompt">
              <span className="jr-label">{q.replace('{partner}', pName)}</span>
              <textarea className="jr-input jr-textarea" rows={2} maxLength={1000} value={draft[k]}
                onChange={e => { setDraft(d => ({ ...d, [k]: e.target.value })); setSaved(false); }} />
            </label>
          ))}
          <p className="jr-fine">{pName} can read what you save. Nothing from your personal Forge is included.</p>
          <button type="submit" className="btn btn-primary btn-full" disabled={busy} data-testid="journey-checkin-save">
            {busy ? 'Saving…' : mine ? 'Update check-in' : 'Save and share'}
          </button>
          {saved && <p className="jr-notice ok" role="status">Saved. {pName} can see it now.</p>}
          <Notice text={error} />
        </form>
      </Card>

      <Card title={`${pName}’s check-in`} testid="journey-checkin-theirs">
        {theirs ? <Answers checkin={theirs} partnerName="you" /> : <p className="jr-empty">{pName} hasn’t checked in this week. No pressure either way.</p>}
      </Card>

      {earlier.length > 0 && (
        <Card title="Earlier weeks">
          {earlier.map(([w, list]) => (
            <details key={w} className="jr-week">
              <summary>Week of {formatDay(w)} · {list.map(c => (c.user_id === me.user_id ? 'You' : pName)).join(' & ')}</summary>
              {list.map(c => (
                <div key={c.id} className="jr-week-entry">
                  <div className="jr-week-who">{c.user_id === me.user_id ? 'You' : pName}</div>
                  <Answers checkin={c} partnerName={c.user_id === me.user_id ? pName : 'you'} />
                </div>
              ))}
            </details>
          ))}
        </Card>
      )}
    </Shell>
  );
}
