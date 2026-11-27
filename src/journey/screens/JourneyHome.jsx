import { useState } from 'react';
import { Shell, Card, Avatar, Progress, Notice, Confirm, useAction, formatDay } from '../ui';
import { nameOf, partnerOf, weekStartOf } from '../config';

/** Goals waiting on someone, then the ones in progress, oldest first. */
function goalOrder(goals, myId) {
  const rank = (g) => (g.status === 'proposed' ? (g.created_by === myId ? 1 : 0) : 2);
  return [...goals].sort((a, b) => rank(a) - rank(b) || String(a.created_at).localeCompare(String(b.created_at)));
}

export function goalLine(g) {
  if (g.kind === 'milestone') return g.status === 'completed' ? 'Done' : 'One-time milestone';
  return `${g.progress} of ${g.target}${g.unit ? ` ${g.unit}` : ''}`;
}

/** Recently completed goals and achieved plans, newest first. */
export function milestonesOf(journey) {
  const goals = (journey?.goals || []).filter(g => g.status === 'completed')
    .map(g => ({ key: `g:${g.id}`, kind: 'goal', id: g.id, title: g.title, at: g.completed_at, by: g.completed_by }));
  const plans = (journey?.future || []).filter(f => f.done)
    .map(f => ({ key: `f:${f.id}`, kind: 'future', id: f.id, title: f.title, at: f.completed_at, by: f.completed_by }));
  return [...goals, ...plans].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export default function JourneyHome({ j, go, onExit }) {
  const { snap } = j;
  const me = snap.me;
  const journey = snap.journey;
  const pending = (snap.incoming_requests?.length || 0) + (snap.journey_invites?.length || 0);

  const friendsButton = (
    <button type="button" className="jr-head-btn" onClick={() => go('friends')} data-testid="journey-friends-btn">
      Friends{pending > 0 && <span className="jr-badge" aria-label={`${pending} waiting`}>{pending}</span>}
    </button>
  );

  return (
    <Shell
      title={journey?.status === 'active' ? journey.title : 'Our Journey'}
      onBack={onExit}
      backLabel="Home"
      action={friendsButton}
      testid="journey-home"
    >
      {j.offline && <Notice tone="info" text="You’re offline. This is what you last saw; changes wait until you’re connected." />}
      {journey?.status === 'active'
        ? <ActiveJourney j={j} go={go} />
        : <NoJourneyYet j={j} go={go} />}
      <p className="jr-fine jr-center jr-foot">
        Signed in as <strong>@{me.username}</strong> ·{' '}
        <button type="button" className="jr-inline" onClick={() => go('account')} data-testid="journey-account-btn">You &amp; privacy</button>
      </p>
    </Shell>
  );
}

function NoJourneyYet({ j, go }) {
  const { snap } = j;
  const journey = snap.journey;
  const [busy, error, run] = useAction();
  const [confirm, setConfirm] = useState(null);
  const invites = snap.journey_invites || [];
  const friends = snap.friends || [];

  return (
    <>
      {journey?.status === 'pending' && (
        <Card title="Invitation sent" testid="journey-waiting">
          <p className="jr-text">
            Waiting for <strong>{nameOf(partnerOf(snap))}</strong> to accept. Nothing is shared until they do.
          </p>
          <button type="button" className="btn btn-ghost btn-full" disabled={busy}
            onClick={() => run(() => j.act('forge_cancel_journey_invite', { p_journey: journey.id }))}>
            Cancel invitation
          </button>
        </Card>
      )}

      {invites.map(inv => (
        <Card key={inv.journey_id} title={`${nameOf(inv.from)} invited you`} className="jr-invite" testid="journey-invite">
          <p className="jr-text">
            Start <strong>{inv.title}</strong> together: shared goals, plans for the future and an optional weekly check-in.
            Only what either of you adds to it is shared — never your personal Forge data.
          </p>
          <div className="jr-actions">
            <button type="button" className="btn btn-primary" disabled={busy}
              onClick={() => run(() => j.act('forge_respond_journey_invite', { p_journey: inv.journey_id, p_accept: true }))}>
              Accept
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy}
              onClick={() => run(() => j.act('forge_respond_journey_invite', { p_journey: inv.journey_id, p_accept: false }))}>
              Decline
            </button>
          </div>
        </Card>
      ))}

      {!journey && friends.length > 0 && (
        <Card title="Start a Journey" testid="journey-start">
          <p className="jr-text">Choose who to grow with. They’ll be asked to agree first.</p>
          <ul className="jr-list">
            {friends.map(f => (
              <li key={f.user_id} className="jr-person">
                <Avatar person={f} size={36} />
                <span className="jr-person-name">{nameOf(f)}<span className="jr-person-sub">@{f.username}</span></span>
                <button type="button" className="btn btn-primary jr-small" disabled={busy}
                  onClick={() => setConfirm(f)}>Invite</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!journey && friends.length === 0 && invites.length === 0 && (
        <Card title="Grow together" className="jr-hero" testid="journey-empty">
          <p className="jr-text">
            Our Journey is a private space for two people. Add someone you trust as a friend, then invite them to start a Journey.
          </p>
          <button type="button" className="btn btn-primary btn-full" onClick={() => go('friends')}>Add a friend</button>
        </Card>
      )}

      <Notice text={error} />

      {confirm && (
        <Confirm
          title={`Invite ${nameOf(confirm)}?`}
          body={`${nameOf(confirm)} will be asked to agree. Until they do, nothing is shared. You can have one Journey at a time.`}
          confirmLabel="Send invitation"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => { await j.act('forge_invite_to_journey', { p_friend: confirm.user_id }); setConfirm(null); })}
        />
      )}
    </>
  );
}

function ActiveJourney({ j, go }) {
  const { snap } = j;
  const me = snap.me;
  const journey = snap.journey;
  const partner = partnerOf(snap);
  const week = weekStartOf();
  const mine = journey.checkins.find(c => c.user_id === me.user_id && c.week_start === week);
  const theirs = journey.checkins.find(c => c.user_id === partner?.user_id && c.week_start === week);
  const open = goalOrder(journey.goals.filter(g => g.status !== 'completed'), me.user_id);
  const milestones = milestonesOf(journey).slice(0, 3);
  const plans = journey.future.filter(f => !f.done);
  const nextPlan = plans.filter(f => f.target_date).sort((a, b) => a.target_date.localeCompare(b.target_date))[0] || plans[0];

  return (
    <>
      <Card className="jr-together" testid="journey-members">
        <div className="jr-pair">
          <Avatar person={me} me size={48} />
          <span className="jr-pair-amp" aria-hidden="true">&amp;</span>
          <Avatar person={partner} size={48} />
        </div>
        <div className="jr-pair-names">You &amp; {nameOf(partner)}</div>
        <div className="jr-pair-since">Together on this Journey since {formatDay(journey.started_at)}</div>
      </Card>

      <Card title="Shared goals" meta={open.length ? `${open.length} open` : null} testid="journey-goals">
        {open.length === 0 && <p className="jr-empty">No shared goals yet. Suggest one — {nameOf(partner)} agrees before it starts.</p>}
        <ul className="jr-list">
          {open.map(g => (
            <li key={g.id}>
              <button type="button" className="jr-goal" onClick={() => go('goal', { id: g.id })} data-testid="journey-goal-row">
                <span className="jr-goal-top">
                  <span className="jr-goal-title">{g.title}</span>
                  <span className="jr-goal-meta">{goalLine(g)}</span>
                </span>
                {g.status === 'proposed' ? (
                  <span className={`jr-tag ${g.created_by === me.user_id ? '' : 'ask'}`}>
                    {g.created_by === me.user_id ? `Waiting for ${nameOf(partner)} to agree` : `${nameOf(partner)} suggested this · Tap to agree`}
                  </span>
                ) : g.kind === 'count' ? (
                  <Progress value={g.progress} target={g.target} />
                ) : null}
                {g.ends_on && g.status !== 'proposed' && <span className="jr-goal-when">By {formatDay(g.ends_on)}</span>}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary btn-full" onClick={() => go('newGoal')} data-testid="journey-new-goal">
          Suggest a shared goal
        </button>
      </Card>

      <Card title="This week’s check-in" meta="Optional" testid="journey-checkin-card">
        <div className="jr-check-status">
          <span className={mine ? 'done' : ''}>{mine ? '✓' : '○'} You</span>
          <span className={theirs ? 'done' : ''}>{theirs ? '✓' : '○'} {nameOf(partner)}</span>
        </div>
        <p className="jr-fine">A few minutes to look back and ahead together, whenever it helps. There’s no streak to keep.</p>
        <button type="button" className="btn btn-ghost btn-full" onClick={() => go('checkin')} data-testid="journey-checkin-btn">
          {mine ? 'View check-ins' : 'Check in'}
        </button>
      </Card>

      <Card title="Our Future" meta={plans.length ? `${plans.length} plan${plans.length === 1 ? '' : 's'}` : null} className="jr-future-card" testid="journey-future-card">
        <p className="jr-text">
          {nextPlan
            ? <>Next: <strong>{nextPlan.title}</strong>{nextPlan.target_date ? ` · ${formatDay(nextPlan.target_date)}` : ''}</>
            : 'The places, skills and milestones you want to reach together.'}
        </p>
        <button type="button" className="btn btn-ghost btn-full" onClick={() => go('future')} data-testid="journey-future-btn">Open Our Future</button>
      </Card>

      <Card title="Recent milestones" testid="journey-milestones">
        {milestones.length === 0
          ? <p className="jr-empty">Completed goals and achieved plans will gather here.</p>
          : (
            <ul className="jr-list">
              {milestones.map(m => (
                <li key={m.key} className="jr-milestone">
                  <span aria-hidden="true">{m.kind === 'goal' ? '🏁' : '🌅'}</span>
                  <span className="jr-milestone-title">{m.title}</span>
                  <span className="jr-milestone-when">{formatDay(m.at)}</span>
                </li>
              ))}
            </ul>
          )}
        {milestonesOf(journey).length > 3 && (
          <button type="button" className="jr-link" onClick={() => go('milestones')}>All milestones</button>
        )}
      </Card>

    </>
  );
}
