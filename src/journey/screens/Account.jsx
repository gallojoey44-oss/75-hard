import { useState } from 'react';
import { Shell, Card, Notice, Confirm, useAction } from '../ui';
import { nameOf, partnerOf } from '../config';

/** Who you are here, what is shared, and the ways out. */
export default function Account({ j, go, profileName, onExit }) {
  const { snap, session } = j;
  const me = snap.me;
  const journey = snap.journey;
  const partner = partnerOf(snap);
  const [name, setName] = useState(me.display_name || '');
  const [username, setUsername] = useState(me.username);
  const [confirm, setConfirm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, error, run] = useAction();

  const save = () => run(async () => {
    await j.act('forge_claim_username', { p_username: username, p_display_name: name || null });
    setSaved(true);
  });

  return (
    <Shell title="You & privacy" onBack={() => go('home')} testid="journey-account">
      <Card title="Your account">
        <p className="jr-fine">Signed in as <strong>{session?.user?.email}</strong> on the <strong>{profileName}</strong> profile of this phone.</p>
        <form className="jr-form" onSubmit={e => { e.preventDefault(); save(); }}>
          <label className="jr-label" htmlFor="jr-acc-username">Username</label>
          <div className="jr-at">
            <span aria-hidden="true">@</span>
            <input id="jr-acc-username" className="jr-input" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20}
              value={username} onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setSaved(false); }} />
          </div>
          <label className="jr-label" htmlFor="jr-acc-name">Your name <span className="jr-optional">optional</span></label>
          <input id="jr-acc-name" className="jr-input" maxLength={40} value={name} onChange={e => { setName(e.target.value); setSaved(false); }} />
          <button type="submit" className="btn btn-ghost btn-full" disabled={busy || username.length < 3}>Save</button>
          {saved && <p className="jr-notice ok" role="status">Saved.</p>}
        </form>
      </Card>

      <Card title="What is shared" className="jr-privacy" testid="journey-privacy">
        <ul className="jr-promise">
          <li><strong>Friends</strong> see your username and name. Nothing else.</li>
          <li><strong>{journey?.status === 'active' ? nameOf(partner) : 'Your Journey partner'}</strong> sees only what either of you adds to your Journey: shared goals and contributions, Our Future plans and check-ins.</li>
          <li><strong>Never shared:</strong> your habits, XP and rank, Daily Logs, mood, stress and energy ratings, notes, letters, health data and challenge history. They stay on this phone and are never sent to the Journey server.</li>
          <li>There are no public profiles, no search beyond an exact username, and no leaderboards.</li>
        </ul>
      </Card>

      {journey && (
        <Card title={journey.status === 'active' ? 'Leave this Journey' : 'Your invitation'}>
          <p className="jr-text">
            {journey.status === 'active'
              ? `Leaving ends the Journey for both of you and permanently deletes its goals, contributions, Our Future plans and check-ins. You and ${nameOf(partner)} stay friends.`
              : `Your invitation to ${nameOf(partner)} is waiting. Withdrawing it shares nothing.`}
          </p>
          <button type="button" className="btn btn-full jr-btn-danger" onClick={() => setConfirm('leave')} data-testid="journey-leave">
            {journey.status === 'active' ? 'Leave Journey' : 'Withdraw invitation'}
          </button>
        </Card>
      )}

      <Card title="Sign out">
        <p className="jr-text">Signs this profile out on this phone. Your friends and Journey stay as they are; sign in again any time.</p>
        <button type="button" className="btn btn-ghost btn-full" onClick={async () => { await j.signOut(); onExit(); }} data-testid="journey-signout">Sign out</button>
      </Card>
      <Notice text={error} />

      {confirm === 'leave' && (
        <Confirm
          title={journey?.status === 'active' ? 'Leave this Journey?' : 'Withdraw your invitation?'}
          body={journey?.status === 'active'
            ? `This can’t be undone. ${nameOf(partner)} will see that the Journey has ended. Your personal Forge data isn’t affected.`
            : null}
          confirmLabel={journey?.status === 'active' ? 'Leave and delete' : 'Withdraw'}
          danger
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => { await j.act('forge_leave_journey', { p_journey: journey.id }); setConfirm(null); go('home'); })}
        />
      )}
    </Shell>
  );
}
