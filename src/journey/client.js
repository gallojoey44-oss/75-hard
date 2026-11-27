import { createClient } from '@supabase/supabase-js';
import { JOURNEY_URL, JOURNEY_KEY, authKey, writeCache } from './config';

/**
 * The connection to the shared-journey server.
 *
 * Only this file (and what imports it) loads the Supabase library, and it is
 * reached through a lazy import, so personal Forge never downloads it unless
 * Our Journey is opened.
 *
 * The client holds the public "anon" key. That key is meant to be public: on
 * its own it can do nothing here, because every Journey function refuses
 * signed-out callers and checks, on the server, what the signed-in person may
 * see or change. No privileged key exists anywhere in the app.
 */

const clients = new Map();

/** One client per local profile, each remembering its own sign-in. */
export function journeyClient(slot) {
  if (!clients.has(slot)) {
    clients.set(slot, createClient(JOURNEY_URL, JOURNEY_KEY, {
      auth: {
        storageKey: authKey(slot),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }));
  }
  return clients.get(slot);
}

const MESSAGES = {
  not_signed_in: 'Please sign in again.',
  no_username: 'Choose a username first.',
  username_invalid: 'Use 3–20 lowercase letters, numbers or _, starting with a letter.',
  username_reserved: 'That username is reserved. Try another.',
  username_taken: 'That username is taken. Try another.',
  display_name_too_long: 'Keep your name to 40 characters.',
  user_not_found: 'No one has that username or invite code.',
  cannot_friend_self: 'That’s you.',
  too_many_requests: 'You have a lot of requests waiting. Cancel some first.',
  request_not_found: 'That request is no longer waiting.',
  not_friends: 'You can only do that with a friend.',
  journey_exists: 'You already have a Journey, or an invitation waiting. One at a time for now.',
  invite_not_found: 'That invitation is no longer waiting.',
  journey_not_found: 'That Journey has ended.',
  no_active_journey: 'This needs an active Journey.',
  title_too_long: 'That name is too long.',
  title_required: 'Give it a name.',
  goal_invalid: 'Check the goal’s details.',
  target_invalid: 'Choose a target between 1 and 1,000,000.',
  goal_not_found: 'That goal is no longer here.',
  goal_not_proposed: 'That goal has already been agreed.',
  cannot_agree_own_goal: 'Your partner agrees to the goals you suggest.',
  only_proposer_can_edit: 'Only the person who suggested it can change it before it’s agreed.',
  goal_not_agreed: 'This goal starts once you’ve both agreed to it.',
  goal_not_milestone: 'This goal is counted, not ticked.',
  goal_not_count: 'This goal is a one-time milestone.',
  amount_invalid: 'Add a whole number from 1 to 100,000.',
  note_too_long: 'Keep notes to 200 characters.',
  contribution_not_found: 'That entry is no longer here.',
  too_many_goals: 'That’s a lot of goals. Remove some first.',
  item_not_found: 'That plan is no longer here.',
  item_invalid: 'Check the plan’s details.',
  too_many_items: 'That’s a lot of plans. Remove some first.',
  week_invalid: 'Check-ins are for this week or a recent one.',
  checkin_too_long: 'Keep each answer to 1,000 characters.',
};

export class JourneyError extends Error {
  constructor(code, friendly) {
    super(friendly);
    this.code = code;
  }
}

function friendly(error) {
  const code = error?.message || '';
  if (MESSAGES[code]) return new JourneyError(code, MESSAGES[code]);
  if (error?.code === '42501' || /JWT|token/i.test(code)) return new JourneyError('not_signed_in', MESSAGES.not_signed_in);
  if (/fetch|network|Failed to fetch|load failed/i.test(code)) return new JourneyError('offline', 'You’re offline. Try again when you’re connected.');
  return new JourneyError('unknown', 'Something went wrong. Try again.');
}

/** Call a Journey function; resolve with its data or throw a JourneyError. */
export async function rpc(client, fn, args = {}) {
  let result;
  try {
    result = await client.rpc(fn, args);
  } catch (err) {
    throw friendly(err);
  }
  if (result.error) throw friendly(result.error);
  return result.data;
}

/** Fetch and cache the current snapshot for a profile. */
export async function fetchSnapshot(slot) {
  const client = journeyClient(slot);
  const { data } = await client.auth.getSession();
  if (!data?.session) return null;
  const snap = await rpc(client, 'forge_snapshot');
  writeCache(slot, snap);
  return snap;
}
