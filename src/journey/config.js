/**
 * Our Journey — what the rest of Forge may know about it.
 *
 * This file is deliberately tiny and imports nothing from the Supabase client,
 * so Home can show its card, and a profile's local data can be cleared, without
 * loading the shared-journey code at all. Personal Forge never waits on it.
 *
 * ── Accounts are not profiles ────────────────────────────────────────────────
 * The Male/Female slots on a device are local profiles. A Forge account is a
 * person, signed in with their email. Each local profile remembers its own
 * sign-in (under its own storage key), so on a shared phone one person's
 * account never appears under the other's profile, and switching profile never
 * signs anyone in or out.
 *
 * ── Nothing here is personal Forge data ─────────────────────────────────────
 * These keys hold the sign-in session and a copy of the last Journey snapshot
 * (for offline viewing). They are not part of a Forge backup and a backup
 * restore never touches them.
 */

// Vite fills `import.meta.env` at build time. Code that imports this file
// outside Vite (the unit tests, bundled with esbuild) has no env at all —
// which reads, correctly, as "not configured".
const ENV = import.meta.env || {};
export const JOURNEY_URL = ENV.VITE_SUPABASE_URL || '';
export const JOURNEY_KEY = ENV.VITE_SUPABASE_ANON_KEY || '';

/** True when this build was given a Supabase project to talk to. */
export function journeyConfigured() {
  return !!(JOURNEY_URL && JOURNEY_KEY);
}

export const authKey = (slot) => `forge-journey-auth-${slot}`;
export const cacheKey = (slot) => `forge-journey-cache-${slot}`;
export const seenKey = (slot) => `forge-journey-seen-${slot}`;
/** An invite code from a link, held until its owner can be asked about it. */
export const PENDING_INVITE_KEY = 'forge-journey-invite';

export const CACHE_EVENT = 'forge-journey-cache';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Whether this profile has a stored sign-in (it may still have expired). */
export function hasSession(slot) {
  return !!read(authKey(slot));
}

/** The last snapshot this profile saw: `{ snap, at }`, or null. */
export function readCache(slot) {
  try {
    const raw = read(cacheKey(slot));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && parsed.snap ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCache(slot, snap) {
  try {
    if (snap) localStorage.setItem(cacheKey(slot), JSON.stringify({ snap, at: Date.now() }));
    else localStorage.removeItem(cacheKey(slot));
  } catch { /* storage full or blocked: the live view still works */ }
  try { window.dispatchEvent(new CustomEvent(CACHE_EVENT, { detail: { slot } })); } catch { /* old browsers */ }
}

/** Forget this profile's sign-in and cached Journey on this device. */
export function clearJourneyLocal(slot) {
  for (const key of [authKey(slot), `${authKey(slot)}-code-verifier`, `${authKey(slot)}-user`, cacheKey(slot), seenKey(slot)]) {
    try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
  }
  try { window.dispatchEvent(new CustomEvent(CACHE_EVENT, { detail: { slot } })); } catch { /* old browsers */ }
}

export function takePendingInvite() {
  const code = read(PENDING_INVITE_KEY);
  return code || null;
}

export function setPendingInvite(code) {
  try {
    if (code) localStorage.setItem(PENDING_INVITE_KEY, code);
    else localStorage.removeItem(PENDING_INVITE_KEY);
  } catch { /* the code can still be typed in */ }
}

/** "4F2A9-C81BE" — easier to read aloud or type. */
export function formatCode(code) {
  const c = String(code || '').toUpperCase();
  return c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

export function inviteLink(code) {
  try { return `${window.location.origin}/?friend=${encodeURIComponent(code)}`; } catch { return ''; }
}

// ── Reading a snapshot ──────────────────────────────────────────────────────

export const nameOf = (person) => person?.display_name || (person?.username ? `@${person.username}` : 'Someone');

/** The other member of an active or pending Journey. */
export function partnerOf(snap) {
  const me = snap?.me?.user_id;
  return snap?.journey?.members?.find(m => m.user_id !== me) || null;
}

/** Monday of the week containing `date`, local time, as YYYY-MM-DD. */
export function weekStartOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** One short line for the Home card, from whatever was last seen. */
export function homeSummary(snap) {
  if (!snap?.me) return { state: 'setup' };
  const invites = snap.journey_invites?.length || 0;
  const requests = snap.incoming_requests?.length || 0;
  const j = snap.journey;
  if (j?.status === 'active') {
    const partner = partnerOf(snap);
    const goals = (j.goals || []).filter(g => g.status !== 'completed');
    const awaiting = goals.filter(g => g.status === 'proposed' && g.created_by !== snap.me.user_id).length;
    const week = weekStartOf();
    const checkedIn = (j.checkins || []).some(c => c.user_id === snap.me.user_id && c.week_start === week);
    return { state: 'active', partner, goals: goals.length, awaiting, checkedIn, requests };
  }
  if (j?.status === 'pending') return { state: 'waiting', partner: partnerOf(snap), requests };
  if (invites) return { state: 'invited', from: snap.journey_invites[0].from, requests };
  return { state: 'ready', friends: snap.friends?.length || 0, requests };
}
