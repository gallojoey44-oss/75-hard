import { useCallback, useEffect, useState } from 'react';
import './journey.css';
import { journeyConfigured, seenKey, takePendingInvite } from './config';
import { useJourney } from './useJourney';
import { Shell, Card, Notice, Celebration } from './ui';
import { SignIn, ChooseUsername, NotConfigured } from './screens/Welcome';
import JourneyHome from './screens/JourneyHome';
import Friends from './screens/Friends';
import { GoalForm, GoalDetail, Milestones } from './screens/Goals';
import Future from './screens/Future';
import CheckIn from './screens/CheckIn';
import Account from './screens/Account';

/**
 * Our Journey — the shared space, reached from Home.
 *
 * Loaded only when opened (see App.jsx), so personal Forge never downloads it
 * otherwise. Everything here comes from, and goes to, the Journey server; none
 * of it reads or writes personal Forge data.
 */
export default function JourneyApp({ slot, profileName, onExit }) {
  if (!journeyConfigured()) return <NotConfigured onExit={onExit} />;
  return <Journey slot={slot} profileName={profileName} onExit={onExit} />;
}

function readSeen(slot) {
  try { const v = JSON.parse(localStorage.getItem(seenKey(slot)) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; }
}
function writeSeen(slot, list) {
  try { localStorage.setItem(seenKey(slot), JSON.stringify(list.slice(-400))); } catch { /* celebrations are a nicety */ }
}

function Journey({ slot, profileName, onExit }) {
  const j = useJourney(slot);
  // Opened from a friend's invite link: go straight to the question in Friends.
  const [screen, setScreen] = useState(() => ({ name: takePendingInvite() ? 'friends' : 'home' }));
  const [celebration, setCelebration] = useState(null);
  const closeCelebration = useCallback(() => setCelebration(null), []);
  const go = useCallback((name, params = {}) => {
    setScreen({ name, ...params });
    try { window.scrollTo(0, 0); } catch { /* jsdom */ }
  }, []);

  // Celebrate each completed goal and achieved plan once on this phone — the
  // first time this phone sees it, whoever finished it.
  useEffect(() => {
    const journey = j.snap?.journey;
    if (!journey || journey.status !== 'active') return;
    const done = [
      ...journey.goals.filter(g => g.status === 'completed').map(g => ({ key: `g:${g.id}:${g.completed_at}`, title: g.title, kind: 'goal', g })),
      ...journey.future.filter(f => f.done).map(f => ({ key: `f:${f.id}:${f.completed_at}`, title: f.title, kind: 'plan' })),
    ];
    const seen = readSeen(slot);
    if (seen === null) { writeSeen(slot, done.map(d => d.key)); return; }   // first visit: nothing is "new"
    const fresh = done.filter(d => !seen.includes(d.key));
    if (!fresh.length) return;
    writeSeen(slot, [...seen, ...fresh.map(d => d.key)]);
    const top = fresh[fresh.length - 1];
    setCelebration(top.kind === 'goal'
      ? { title: `Goal complete: ${top.title}`, detail: top.g.kind === 'count' ? `${top.g.progress} of ${top.g.target}${top.g.unit ? ` ${top.g.unit}` : ''} — together.` : 'Done, together.' }
      : { title: `Achieved: ${top.title}`, detail: 'One more piece of Our Future, done.' });
  }, [j.snap, slot]);

  if (j.session === undefined) {
    return <Shell title="Our Journey" onBack={onExit} backLabel="Home"><Card><p className="jr-empty">Opening…</p></Card></Shell>;
  }
  if (!j.session) return <SignIn client={j.client} profileName={profileName} onExit={onExit} />;
  if (!j.snap) {
    return (
      <Shell title="Our Journey" onBack={onExit} backLabel="Home">
        <Card>
          {j.offline
            ? <p className="jr-text">You’re offline. Our Journey needs a connection the first time it opens on this profile.</p>
            : j.error ? <Notice text={j.error} /> : <p className="jr-empty">Opening…</p>}
          {(j.offline || j.error) && <button type="button" className="btn btn-ghost btn-full" onClick={j.refresh}>Try again</button>}
        </Card>
      </Shell>
    );
  }
  if (!j.snap.me) return <ChooseUsername j={j} onExit={onExit} email={j.session.user?.email} />;

  const props = { j, go, onExit };
  let body;
  switch (screen.name) {
    case 'friends': body = <Friends {...props} />; break;
    case 'account': body = <Account {...props} profileName={profileName} />; break;
    case 'newGoal': body = j.snap.journey?.status === 'active' ? <GoalForm {...props} /> : <JourneyHome {...props} />; break;
    case 'editGoal': {
      const goal = j.snap.journey?.goals?.find(g => g.id === screen.id);
      body = goal ? <GoalForm {...props} goal={goal} /> : <JourneyHome {...props} />;
      break;
    }
    case 'goal': body = j.snap.journey?.status === 'active' ? <GoalDetail {...props} id={screen.id} /> : <JourneyHome {...props} />; break;
    case 'milestones': body = <Milestones {...props} />; break;
    case 'future': body = j.snap.journey?.status === 'active' ? <Future {...props} /> : <JourneyHome {...props} />; break;
    case 'checkin': body = j.snap.journey?.status === 'active' ? <CheckIn {...props} /> : <JourneyHome {...props} />; break;
    default: body = <JourneyHome {...props} />;
  }

  return (
    <>
      {body}
      {celebration && <Celebration title={celebration.title} detail={celebration.detail} onClose={closeCelebration} />}
    </>
  );
}

