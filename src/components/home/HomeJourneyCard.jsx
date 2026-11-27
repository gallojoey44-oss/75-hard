import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  journeyConfigured, hasSession, readCache, homeSummary, nameOf, CACHE_EVENT,
} from '../../journey/config';

// When each profile's summary was last refreshed in the background.
const lastRefresh = {};

/**
 * The way into Our Journey from Home.
 *
 * Drawn from the last snapshot this profile saw, so Home never waits on the
 * network. If this profile is signed in, a quiet refresh runs in the
 * background (at most once a minute); if it is not, the Journey code is never
 * loaded at all. On a build without a Journey server the card is not shown.
 */
export default function HomeJourneyCard({ onOpen }) {
  const { activeProfile } = useApp();
  const [, setTick] = useState(0);

  useEffect(() => {
    const onCache = (e) => { if (!e?.detail?.slot || e.detail.slot === activeProfile) setTick(t => t + 1); };
    window.addEventListener(CACHE_EVENT, onCache);
    return () => window.removeEventListener(CACHE_EVENT, onCache);
  }, [activeProfile]);

  useEffect(() => {
    if (!journeyConfigured() || !hasSession(activeProfile)) return;
    const now = Date.now();
    if (now - (lastRefresh[activeProfile] || 0) < 60000) return;
    lastRefresh[activeProfile] = now;
    import('../../journey/client')
      .then(m => m.fetchSnapshot(activeProfile))
      .catch(() => { /* offline, or signed out elsewhere: the card keeps what it had */ });
  }, [activeProfile]);

  if (!journeyConfigured()) return null;
  const signedIn = hasSession(activeProfile);
  const cached = signedIn ? readCache(activeProfile) : null;
  const s = cached ? homeSummary(cached.snap) : null;

  let line;
  let meta = null;
  if (!signedIn) {
    line = 'Grow together with someone you trust: shared goals, plans for your future and a weekly check-in — private to the two of you.';
  } else if (!s || s.state === 'setup') {
    line = 'Finish setting up to add a friend and start a Journey.';
  } else if (s.state === 'active') {
    meta = `You & ${nameOf(s.partner)}`;
    const bits = [];
    bits.push(s.goals === 0 ? 'No shared goals yet' : `${s.goals} shared goal${s.goals === 1 ? '' : 's'} in progress`);
    if (s.awaiting) bits.push(`${s.awaiting} waiting for you to agree`);
    bits.push(s.checkedIn ? 'checked in this week' : 'weekly check-in open');
    line = `${bits.join(' · ')}.`;
  } else if (s.state === 'invited') {
    line = `${nameOf(s.from)} invited you to start a Journey together.`;
  } else if (s.state === 'waiting') {
    line = `Waiting for ${nameOf(s.partner)} to accept your invitation.`;
  } else {
    line = s.friends > 0 ? 'Invite a friend to start a Journey together.' : 'Add a friend to begin a Journey together.';
  }
  const waiting = s?.requests || 0;

  return (
    <section className="f41-card jr-home" data-testid="home-journey">
      <div className="f41-card-head">
        <h3 className="f41-card-title">Our Journey</h3>
        {meta && <span className="f41-card-meta">{meta}</span>}
      </div>
      <p className="jr-home-text">{line}</p>
      <button type="button" className="btn btn-primary jr-home-btn" onClick={onOpen}>
        Open Our Journey{waiting > 0 ? ` · ${waiting} request${waiting === 1 ? '' : 's'}` : ''}
      </button>
    </section>
  );
}
