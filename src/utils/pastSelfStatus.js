/**
 * What the server last said it is holding for each profile's past-self
 * messages — kept in memory so the delivery screen can state it as a fact.
 *
 * The scheduler in App.jsx does the syncing; the settings screen only reads.
 * A tiny external store rather than React context, because the two live in
 * different parts of the tree and nothing else needs to know.
 *
 *   state: 'idle'        nothing attempted yet this session
 *          'syncing'     a request is in flight
 *          'ok'          the server answered: `stored`, `contentStored`
 *          'error'       the request failed — the server may still hold what
 *                        it held before, which is exactly what must be said
 *          'unavailable' this build has no push backend; nothing is uploaded
 */

const byProfile = new Map();
const listeners = new Set();
const EMPTY = Object.freeze({ state: 'idle', stored: false, contentStored: 0, at: null });

export function getPastSelfStatus(profileId) {
  return byProfile.get(profileId) || EMPTY;
}

export function setPastSelfStatus(profileId, patch) {
  byProfile.set(profileId, { ...getPastSelfStatus(profileId), ...patch, at: Date.now() });
  for (const fn of listeners) fn();
}

export function subscribePastSelfStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Ask the scheduler to sync again now — used by "Retry" on the delivery
 * screen. The scheduler listens for this; the screen never talks to the server
 * itself, so there is one writer.
 */
const retryListeners = new Set();
export function requestPastSelfSync() {
  for (const fn of retryListeners) fn();
}
export function onPastSelfSyncRequested(fn) {
  retryListeners.add(fn);
  return () => retryListeners.delete(fn);
}
