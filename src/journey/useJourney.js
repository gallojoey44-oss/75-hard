import { useCallback, useEffect, useRef, useState } from 'react';
import { journeyClient, rpc, JourneyError } from './client';
import { readCache, writeCache, clearJourneyLocal } from './config';

/** How often an open Journey screen checks for the other person's changes. */
export const POLL_MS = 8000;

/**
 * Session and snapshot for one local profile.
 *
 * The snapshot is everything the screens show, read in one call. It is
 * refreshed when the screen opens, every few seconds while it is visible, when
 * the app comes back to the foreground or back online, and after every change
 * this person makes — so both phones converge within seconds without either
 * one holding a connection open. The last snapshot is kept on the device so an
 * offline phone can still show the Journey (read-only).
 */
export function useJourney(slot) {
  const client = journeyClient(slot);
  const cached = readCache(slot);
  const [session, setSession] = useState(undefined);          // undefined: still checking
  const [snap, setSnap] = useState(cached?.snap || null);
  const [updatedAt, setUpdatedAt] = useState(cached?.at || null);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const inFlight = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    client.auth.getSession().then(({ data }) => { if (alive.current) setSession(data?.session || null); });
    const { data: sub } = client.auth.onAuthStateChange((_event, s) => { if (alive.current) setSession(s || null); });
    return () => { alive.current = false; sub?.subscription?.unsubscribe(); };
  }, [client]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      try {
        const data = await rpc(client, 'forge_snapshot');
        if (!alive.current) return data;
        setSnap(data);
        setUpdatedAt(Date.now());
        setError(null);
        setOffline(false);
        writeCache(slot, data);
        return data;
      } catch (err) {
        if (!alive.current) return null;
        if (err.code === 'offline') setOffline(true);
        else if (err.code === 'not_signed_in') {
          // The session is gone (signed out elsewhere, or expired for good).
          await client.auth.signOut({ scope: 'local' }).catch(() => {});
        } else setError(err.message);
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [client, slot]);

  // Keep both phones in step while a Journey screen is open.
  useEffect(() => {
    if (!session) return undefined;
    refresh();
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const id = setInterval(tick, POLL_MS);
    const goOnline = () => { setOffline(false); refresh(); };
    const goOffline = () => setOffline(true);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [session, refresh]);

  /** Make a change, then re-read, so the screen shows what the server holds. */
  const act = useCallback(async (fn, args = {}) => {
    if (offline) throw new JourneyError('offline', 'You’re offline. Try again when you’re connected.');
    const data = await rpc(client, fn, args);
    await refresh();
    return data;
  }, [client, refresh, offline]);

  const signOut = useCallback(async () => {
    await client.auth.signOut({ scope: 'local' }).catch(() => {});
    clearJourneyLocal(slot);
    setSnap(null);
    setUpdatedAt(null);
  }, [client, slot]);

  return { client, session, snap, updatedAt, error, offline, refresh, act, signOut };
}
