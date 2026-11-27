/**
 * Friends and Our Journey — the server's rules, tried against the real thing.
 *
 * Runs on a local Supabase stack (tests/journey/stack.mjs: Supabase Postgres,
 * Supabase Auth, PostgREST, Mailpit) with the migration applied fresh. Every
 * person signs in the way a person does — a code read from a real email — and
 * every call goes through the Data API with their own session, so what this
 * proves is what the deployed database will enforce.
 *
 * Three people: Alex and Blair, who become friends and share a Journey, and
 * Casey, who is not part of it and tries everything they should not be able to.
 *
 *   1. Signing in, usernames and the rules on them
 *   2. Finding people: exact username or invite code, nothing more
 *   3. Friend requests: ask, decline, accept, cancel, ask-back, revoke links
 *   4. What friends can and cannot see of each other
 *   5. Journey invitations: nothing shared until both agree; one at a time
 *   6. Shared goals: propose, agree, contribute, complete, undo
 *   7. Our Future
 *   8. Weekly check-ins
 *   9. Going around the API: tables, helpers, forged and missing sessions
 *  10. Leaving, removing a friend, deleting an account
 *
 * Needs Docker. Run directly: node tests/journey-api-e2e-test.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { bootStack, latestCode, psql, ANON_KEY, SUPABASE_URL, dockerAvailable } from './journey/stack.mjs';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

if (!dockerAvailable()) {
  console.log('FAIL  Docker is required for this suite and is not available');
  process.exit(1);
}

const { gateway } = await bootStack();
const newClient = () => createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(email) {
  const client = newClient();
  const since = Date.now() - 1000;
  let sent = await client.auth.signInWithOtp({ email });
  // One code per address per interval, as on a hosted project (1s here).
  for (let i = 0; i < 5 && sent.error && /only request this after/.test(sent.error.message); i++) {
    await new Promise(r => setTimeout(r, 1200));
    sent = await client.auth.signInWithOtp({ email });
  }
  if (sent.error) throw new Error(`otp: ${sent.error.message}`);
  const code = await latestCode(email, { after: since });
  const verified = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  if (verified.error) throw new Error(`verify: ${verified.error.message}`);
  return { client, id: verified.data.user.id, email };
}
const call = async (who, fn, args = {}) => {
  const { data, error } = await who.client.rpc(fn, args);
  return { data, error: error?.message || null, code: error?.code || null };
};
const snap = async (who) => (await call(who, 'forge_snapshot')).data;
const failsWith = (r, msg) => r.error === msg;

// ══ 1: signing in and usernames ═══════════════════════════════════════════════
const anon = { client: newClient() };
// Each function called with its real parameter names, so the only thing that
// can stop it is the permission check.
const Z = '00000000-0000-0000-0000-000000000000';
const ALL_FUNCTIONS = {
  forge_snapshot: {}, forge_claim_username: { p_username: 'anon_user' }, forge_find_user: { p_username: 'alex' },
  forge_lookup_invite: { p_code: 'AAAAAAAAAA' }, forge_send_friend_request: { p_username: 'alex' },
  forge_respond_friend_request: { p_request: Z, p_accept: true }, forge_cancel_friend_request: { p_request: Z },
  forge_remove_friend: { p_user: Z }, forge_rotate_invite_code: {}, forge_invite_to_journey: { p_friend: Z },
  forge_respond_journey_invite: { p_journey: Z, p_accept: true }, forge_cancel_journey_invite: { p_journey: Z },
  forge_leave_journey: { p_journey: Z }, forge_create_goal: { p_title: 'x', p_kind: 'milestone' },
  forge_agree_goal: { p_goal: Z }, forge_update_goal: { p_goal: Z, p_title: 'x' }, forge_remove_goal: { p_goal: Z },
  forge_set_goal_done: { p_goal: Z, p_done: true }, forge_add_contribution: { p_goal: Z, p_amount: 1 },
  forge_remove_contribution: { p_contribution: Z }, forge_add_future_item: { p_title: 'x' },
  forge_update_future_item: { p_item: Z, p_title: 'x' }, forge_set_future_item_done: { p_item: Z, p_done: true },
  forge_remove_future_item: { p_item: Z }, forge_save_checkin: { p_week_start: '2026-11-23' },
};
const anonResults = [];
for (const [fn, args] of Object.entries(ALL_FUNCTIONS)) anonResults.push([fn, (await call(anon, fn, args)).code]);
check('1: signed out, every Journey function is refused',
  anonResults.every(([, code]) => code === '42501'),
  anonResults.filter(([, c]) => c !== '42501').map(([f, c]) => `${f}:${c}`).join(' ') || `${anonResults.length} refused`);

const wrong = newClient();
await wrong.auth.signInWithOtp({ email: 'alex@example.test' });
const badCode = await wrong.auth.verifyOtp({ email: 'alex@example.test', token: '000000', type: 'email' });
check('1: a wrong code does not sign in', !!badCode.error && !badCode.data?.session);

const alex = await signIn('alex@example.test');
const blair = await signIn('blair@example.test');
const casey = await signIn('casey@example.test');
check('1: three people sign in with the code from their email', !!(alex.id && blair.id && casey.id));
check('1: before choosing a username there is nothing but an empty account', (await snap(alex)).me === null);
check('1: and nothing social works yet',
  failsWith(await call(alex, 'forge_send_friend_request', { p_username: 'anyone' }), 'no_username'));

const bad = [];
for (const u of ['ab', '1abc', 'with space', 'a'.repeat(21), 'dash-ed', '']) {
  const r = await call(alex, 'forge_claim_username', { p_username: u });
  if (r.error !== 'username_invalid') bad.push(`${u}:${r.error}`);
}
check('1: usernames are 3–20 letters, numbers or _, starting with a letter', bad.length === 0, bad.join(' '));
check('1: reserved names are refused', failsWith(await call(alex, 'forge_claim_username', { p_username: 'admin' }), 'username_reserved'));
check('1: display names are short', failsWith(await call(alex, 'forge_claim_username', { p_username: 'alex', p_display_name: 'x'.repeat(41) }), 'display_name_too_long'));
const claimed = await call(alex, 'forge_claim_username', { p_username: '  Alex ', p_display_name: ' Alex ' });
check('1: a username is stored trimmed and lowercase',
  claimed.data?.username === 'alex' && claimed.data?.display_name === 'Alex' && /^[0-9A-F]{10}$/.test(claimed.data?.invite_code || ''),
  JSON.stringify(claimed.data));
check('1: and is unique whatever the case',
  failsWith(await call(blair, 'forge_claim_username', { p_username: 'ALEX' }), 'username_taken'));
await call(blair, 'forge_claim_username', { p_username: 'blair', p_display_name: 'Blair' });
await call(casey, 'forge_claim_username', { p_username: 'casey', p_display_name: 'Casey' });
check('1: changing your own username keeps your account',
  (await call(casey, 'forge_claim_username', { p_username: 'casey_c', p_display_name: 'Casey' })).data?.user_id === casey.id
    && (await snap(casey)).me.username === 'casey_c');

// ══ 2: finding people ═══════════════════════════════════════════════════════
const found = await call(casey, 'forge_find_user', { p_username: 'ALEX' });
check('2: an exact username finds someone — their name and nothing else',
  JSON.stringify(Object.keys(found.data || {}).sort()) === JSON.stringify(['display_name', 'relation', 'username'])
    && found.data.username === 'alex' && found.data.relation === 'none', JSON.stringify(found.data));
check('2: part of a username finds nobody', (await call(casey, 'forge_find_user', { p_username: 'ale' })).data === null);
check('2: nor does a made-up one', (await call(casey, 'forge_find_user', { p_username: 'nobody_here' })).data === null);
const alexCode = (await snap(alex)).me.invite_code;
const byCode = await call(casey, 'forge_lookup_invite', { p_code: `${alexCode.slice(0, 5).toLowerCase()}-${alexCode.slice(5)}` });
check('2: an invite code, however it is typed, says whose it is', byCode.data?.username === 'alex' && !('user_id' in byCode.data));
check('2: a wrong code says nothing', (await call(casey, 'forge_lookup_invite', { p_code: '0000000000' })).data === null);

// ══ 3: friend requests ═══════════════════════════════════════════════════════
check('3: you cannot befriend yourself', failsWith(await call(alex, 'forge_send_friend_request', { p_username: 'alex' }), 'cannot_friend_self'));
check('3: an unknown username is not found', failsWith(await call(alex, 'forge_send_friend_request', { p_username: 'ghost' }), 'user_not_found'));
check('3: Alex asks Blair', (await call(alex, 'forge_send_friend_request', { p_username: 'blair' })).data?.status === 'requested');
check('3: asking twice changes nothing', (await call(alex, 'forge_send_friend_request', { p_username: 'blair' })).data?.status === 'already_requested');
let req = (await snap(blair)).incoming_requests;
check('3: Blair sees the request, from Alex', req.length === 1 && req[0].username === 'alex');
check('3: Alex sees it waiting', (await snap(alex)).outgoing_requests.map(r => r.username).join() === 'blair');
check('3: Casey cannot answer a request meant for Blair',
  failsWith(await call(casey, 'forge_respond_friend_request', { p_request: req[0].id, p_accept: true }), 'request_not_found'));
check('3: nor cancel it', failsWith(await call(casey, 'forge_cancel_friend_request', { p_request: req[0].id }), 'request_not_found'));
check('3: the sender cannot accept their own request',
  failsWith(await call(alex, 'forge_respond_friend_request', { p_request: req[0].id, p_accept: true }), 'request_not_found'));
check('3: Blair can decline', (await call(blair, 'forge_respond_friend_request', { p_request: req[0].id, p_accept: false })).data?.status === 'declined');
check('3: …and it is simply gone, for both',
  (await snap(blair)).incoming_requests.length === 0 && (await snap(alex)).outgoing_requests.length === 0 && (await snap(alex)).friends.length === 0);
await call(alex, 'forge_send_friend_request', { p_username: 'blair' });
req = (await snap(blair)).incoming_requests;
check('3: asked again, Blair accepts', (await call(blair, 'forge_respond_friend_request', { p_request: req[0].id, p_accept: true })).data?.status === 'accepted');
check('3: they are friends on both sides',
  (await snap(alex)).friends.map(f => f.username).join() === 'blair' && (await snap(blair)).friends.map(f => f.username).join() === 'alex');
check('3: a request by invite code works', (await call(casey, 'forge_send_friend_request', { p_code: alexCode })).data?.status === 'requested');
const caseyReq = (await snap(casey)).outgoing_requests[0];
check('3: and the sender can withdraw it', (await call(casey, 'forge_cancel_friend_request', { p_request: caseyReq.id })).data?.status === 'cancelled'
  && (await snap(alex)).incoming_requests.length === 0);
await call(casey, 'forge_send_friend_request', { p_username: 'blair' });
check('3: if they had already asked you, asking back is agreeing',
  (await call(blair, 'forge_send_friend_request', { p_username: 'casey_c' })).data?.status === 'accepted'
    && (await snap(blair)).friends.map(f => f.username).sort().join() === 'alex,casey_c');
const newCode = (await call(alex, 'forge_rotate_invite_code')).data;
check('3: a new invite code revokes the old link',
  /^[0-9A-F]{10}$/.test(newCode || '') && newCode !== alexCode
    && (await call(casey, 'forge_lookup_invite', { p_code: alexCode })).data === null
    && failsWith(await call(casey, 'forge_send_friend_request', { p_code: alexCode }), 'user_not_found')
    && (await call(casey, 'forge_lookup_invite', { p_code: newCode })).data?.username === 'alex');

// ══ 4: what friends see ═════════════════════════════════════════════════════
const blairView = await snap(blair);
const alexView = await snap(alex);
check('4: Alex does not see Blair\'s other friends', alexView.friends.map(f => f.username).join() === 'blair');
check('4: a friend is a name, not a profile',
  JSON.stringify(Object.keys(alexView.friends[0]).sort()) === JSON.stringify(['display_name', 'since', 'user_id', 'username']));
check('4: nobody\'s email address appears anywhere in what others receive',
  !/@example\.test/.test(JSON.stringify(alexView.friends) + JSON.stringify(blairView.friends) + JSON.stringify(blairView.incoming_requests))
    && !/alex@example/.test(JSON.stringify(await snap(casey))));
check('4: Casey, who is not Alex\'s friend, sees nothing of Alex', !/"alex"/.test(JSON.stringify(await snap(casey))));
check('4: another person\'s invite code is never handed out', !JSON.stringify(blairView).includes(newCode));

// ══ 5: Journey invitations ══════════════════════════════════════════════════
check('5: only a friend can be invited', failsWith(await call(alex, 'forge_invite_to_journey', { p_friend: casey.id }), 'not_friends'));
const inv = await call(alex, 'forge_invite_to_journey', { p_friend: blair.id, p_title: 'Our Journey' });
check('5: Alex invites Blair', inv.data?.status === 'invited');
let a = await snap(alex), b = await snap(blair);
check('5: Alex sees it waiting for Blair',
  a.journey?.status === 'pending' && a.journey.members.map(m => `${m.username}:${m.status}`).join() === 'alex:joined,blair:invited');
check('5: Blair sees an invitation — not a Journey yet', b.journey === null && b.journey_invites.length === 1 && b.journey_invites[0].from.username === 'alex');
check('5: nothing can be written into it before Blair agrees',
  failsWith(await call(alex, 'forge_create_goal', { p_title: 'x', p_kind: 'milestone' }), 'no_active_journey')
    && failsWith(await call(blair, 'forge_add_future_item', { p_title: 'x' }), 'no_active_journey'));
check('5: one invitation at a time', failsWith(await call(alex, 'forge_invite_to_journey', { p_friend: blair.id }), 'journey_exists'));
check('5: Casey cannot accept it', failsWith(await call(casey, 'forge_respond_journey_invite', { p_journey: inv.data.journey_id, p_accept: true }), 'invite_not_found'));
check('5: nor leave or cancel it',
  failsWith(await call(casey, 'forge_leave_journey', { p_journey: inv.data.journey_id }), 'journey_not_found')
    && failsWith(await call(casey, 'forge_cancel_journey_invite', { p_journey: inv.data.journey_id }), 'invite_not_found'));
check('5: Alex can withdraw it', (await call(alex, 'forge_cancel_journey_invite', { p_journey: inv.data.journey_id })).data?.status === 'cancelled'
  && (await snap(blair)).journey_invites.length === 0 && (await snap(alex)).journey === null);
const inv2 = await call(alex, 'forge_invite_to_journey', { p_friend: blair.id });
check('5: Blair can decline, and it is gone for both',
  (await call(blair, 'forge_respond_journey_invite', { p_journey: inv2.data.journey_id, p_accept: false })).data?.status === 'declined'
    && (await snap(alex)).journey === null);
const inv3 = await call(alex, 'forge_invite_to_journey', { p_friend: blair.id, p_title: 'Our Journey' });
const accepted = await call(blair, 'forge_respond_journey_invite', { p_journey: inv3.data.journey_id, p_accept: true });
a = await snap(alex); b = await snap(blair);
check('5: Blair accepts and the Journey begins for both',
  accepted.data?.status === 'active' && a.journey?.status === 'active' && b.journey?.id === a.journey.id
    && a.journey.members.every(m => m.status === 'joined') && !!a.journey.started_at);
const JID = a.journey.id;
check('5: someone in a Journey cannot start another',
  failsWith(await call(blair, 'forge_invite_to_journey', { p_friend: casey.id }), 'journey_exists'));
const caseyInv = await call(casey, 'forge_invite_to_journey', { p_friend: blair.id });
check('5: …or accept one while theirs is active',
  caseyInv.data?.status === 'invited'
    && failsWith(await call(blair, 'forge_respond_journey_invite', { p_journey: caseyInv.data.journey_id, p_accept: true }), 'journey_exists'));
check('5: Alex learns nothing about Casey\'s invitation to Blair', !JSON.stringify(await snap(alex)).includes('casey'));
await call(casey, 'forge_cancel_journey_invite', { p_journey: caseyInv.data.journey_id });

// ══ 6: shared goals ═════════════════════════════════════════════════════════
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const monday = (() => { const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; })();
const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);

const g1 = await call(alex, 'forge_create_goal', {
  p_title: 'Four workouts together', p_kind: 'count', p_target: 4, p_unit: 'workouts',
  p_starts_on: iso(monday), p_ends_on: iso(sunday),
});
check('6: Alex proposes a goal', g1.data?.status === 'proposed' && g1.data.target === 4 && g1.data.progress === 0, JSON.stringify(g1.error));
const G1 = g1.data.id;
check('6: Blair sees the proposal', (await snap(blair)).journey.goals.some(g => g.id === G1 && g.status === 'proposed'));
check('6: nobody can agree to their own proposal', failsWith(await call(alex, 'forge_agree_goal', { p_goal: G1 }), 'cannot_agree_own_goal'));
check('6: nothing counts until it is agreed', failsWith(await call(alex, 'forge_add_contribution', { p_goal: G1, p_amount: 1 }), 'goal_not_agreed'));
check('6: a proposal is the proposer\'s to change',
  failsWith(await call(blair, 'forge_update_goal', { p_goal: G1, p_title: 'Five', p_target: 5 }), 'only_proposer_can_edit')
    && (await call(alex, 'forge_update_goal', { p_goal: G1, p_title: 'Four workouts together', p_target: 4, p_unit: 'workouts', p_starts_on: iso(monday), p_ends_on: iso(sunday) })).data?.target === 4);
check('6: Blair agrees and the goal is active', (await call(blair, 'forge_agree_goal', { p_goal: G1 })).data?.status === 'active');
const c1 = await call(alex, 'forge_add_contribution', { p_goal: G1, p_amount: 1, p_note: 'Morning run' });
const c2 = await call(blair, 'forge_add_contribution', { p_goal: G1, p_amount: 2 });
check('6: each records their own part', c1.data?.progress === 1 && c2.data?.progress === 3 && c2.data.just_completed === false);
let g = (await snap(alex)).journey.goals.find(x => x.id === G1);
check('6: both see the combined progress and who added what',
  g.progress === 3 && g.contributions.length === 2 && g.contributions.some(c => c.user_id === alex.id && c.note === 'Morning run')
    && g.contributions.some(c => c.user_id === blair.id && c.amount === 2));
check('6: Casey cannot see it, add to it, agree to it or remove it',
  (await snap(casey)).journey === null
    && failsWith(await call(casey, 'forge_add_contribution', { p_goal: G1, p_amount: 1 }), 'goal_not_found')
    && failsWith(await call(casey, 'forge_agree_goal', { p_goal: G1 }), 'goal_not_found')
    && failsWith(await call(casey, 'forge_remove_goal', { p_goal: G1 }), 'goal_not_found')
    && failsWith(await call(casey, 'forge_update_goal', { p_goal: G1, p_title: 'Hacked', p_target: 1 }), 'goal_not_found'));
const c3 = await call(blair, 'forge_add_contribution', { p_goal: G1, p_amount: 1 });
check('6: reaching the target completes it, once', c3.data?.status === 'completed' && c3.data.just_completed === true && !!c3.data.completed_at);
check('6: Alex sees it completed', (await snap(alex)).journey.goals.find(x => x.id === G1).status === 'completed');
check('6: only your own contribution can be taken back',
  failsWith(await call(alex, 'forge_remove_contribution', { p_contribution: c3.data.contributions[0].id }), 'contribution_not_found'));
const undo = await call(blair, 'forge_remove_contribution', { p_contribution: c3.data.contributions[0].id });
check('6: taking one back below the target reopens the goal', undo.data?.status === 'active' && undo.data.progress === 3 && undo.data.completed_at === null);
const m1 = await call(blair, 'forge_create_goal', { p_title: 'Hike Mount Tam', p_kind: 'milestone', p_details: 'Sunrise trail' });
await call(alex, 'forge_agree_goal', { p_goal: m1.data.id });
const done = await call(alex, 'forge_set_goal_done', { p_goal: m1.data.id, p_done: true });
check('6: a one-time milestone is marked done by either', done.data?.status === 'completed' && done.data.just_completed === true && done.data.completed_by === alex.id);
check('6: and can be un-marked', (await call(blair, 'forge_set_goal_done', { p_goal: m1.data.id, p_done: false })).data?.status === 'active');
check('6: milestones are not counted, counts are not ticked',
  failsWith(await call(alex, 'forge_add_contribution', { p_goal: m1.data.id, p_amount: 1 }), 'goal_not_count')
    && failsWith(await call(alex, 'forge_set_goal_done', { p_goal: G1, p_done: true }), 'goal_not_milestone'));
const invalid = [
  ['no title', { p_title: '  ', p_kind: 'milestone' }, 'title_required'],
  ['bad kind', { p_title: 'x', p_kind: 'race' }, 'goal_invalid'],
  ['no target', { p_title: 'x', p_kind: 'count' }, 'target_invalid'],
  ['zero target', { p_title: 'x', p_kind: 'count', p_target: 0 }, 'target_invalid'],
  ['ends first', { p_title: 'x', p_kind: 'milestone', p_starts_on: '2026-12-10', p_ends_on: '2026-12-01' }, 'goal_invalid'],
  ['long title', { p_title: 'x'.repeat(81), p_kind: 'milestone' }, 'goal_invalid'],
];
const wrongs = [];
for (const [label, args, msg] of invalid) { const r = await call(alex, 'forge_create_goal', args); if (r.error !== msg) wrongs.push(`${label}:${r.error}`); }
check('6: a goal needs a title, a kind, and a target if it counts', wrongs.length === 0, wrongs.join(' '));
check('6: amounts are whole numbers within reason',
  failsWith(await call(alex, 'forge_add_contribution', { p_goal: G1, p_amount: 0 }), 'amount_invalid')
    && failsWith(await call(alex, 'forge_add_contribution', { p_goal: G1, p_amount: 100001 }), 'amount_invalid'));

// ══ 7: Our Future ═══════════════════════════════════════════════════════════
const f1 = await call(alex, 'forge_add_future_item', { p_title: 'Visit Japan', p_area: 'Travel', p_target_date: '2027-04-01', p_notes: 'Cherry blossoms' });
check('7: Alex adds a plan for later', f1.data?.title === 'Visit Japan' && f1.data.area === 'Travel' && f1.data.done === false);
check('7: Blair sees it', (await snap(blair)).journey.future.some(x => x.id === f1.data.id));
check('7: Blair edits it', (await call(blair, 'forge_update_future_item', { p_item: f1.data.id, p_title: 'Visit Japan', p_area: 'Travel', p_notes: 'Kyoto first', p_target_date: '2027-04-01' })).data?.notes === 'Kyoto first');
const fd = await call(blair, 'forge_set_future_item_done', { p_item: f1.data.id, p_done: true });
check('7: and marks it achieved', fd.data?.done === true && fd.data.completed_by === blair.id);
check('7: Alex sees who did, and can undo it',
  (await snap(alex)).journey.future.find(x => x.id === f1.data.id).completed_by === blair.id
    && (await call(alex, 'forge_set_future_item_done', { p_item: f1.data.id, p_done: false })).data?.done === false);
check('7: Casey cannot touch it',
  failsWith(await call(casey, 'forge_update_future_item', { p_item: f1.data.id, p_title: 'x' }), 'item_not_found')
    && failsWith(await call(casey, 'forge_remove_future_item', { p_item: f1.data.id }), 'item_not_found')
    && failsWith(await call(casey, 'forge_set_future_item_done', { p_item: f1.data.id, p_done: true }), 'item_not_found'));
check('7: plans need a title', failsWith(await call(alex, 'forge_add_future_item', { p_title: '' }), 'title_required'));

// ══ 8: weekly check-ins ═════════════════════════════════════════════════════
const ck = await call(alex, 'forge_save_checkin', { p_week_start: iso(monday), p_went_well: 'We trained four times', p_appreciate: 'Your patience' });
check('8: Alex checks in for this week', ck.data?.went_well === 'We trained four times' && ck.data.improving === null);
check('8: Blair can read it — check-ins are shared with your partner',
  (await snap(blair)).journey.checkins.some(c => c.user_id === alex.id && c.appreciate === 'Your patience'));
check('8: saving again updates the same week',
  (await call(alex, 'forge_save_checkin', { p_week_start: iso(monday), p_went_well: 'Trained four times', p_appreciate: 'Your patience' })).data?.went_well === 'Trained four times'
    && (await snap(alex)).journey.checkins.filter(c => c.user_id === alex.id).length === 1);
const tuesday = new Date(monday); tuesday.setUTCDate(monday.getUTCDate() + 1);
const longAgo = new Date(monday); longAgo.setUTCDate(monday.getUTCDate() - 35);
check('8: weeks start on a Monday, close to now',
  failsWith(await call(alex, 'forge_save_checkin', { p_week_start: iso(tuesday), p_went_well: 'x' }), 'week_invalid')
    && failsWith(await call(alex, 'forge_save_checkin', { p_week_start: iso(longAgo), p_went_well: 'x' }), 'week_invalid'));
check('8: answers have a sensible length', failsWith(await call(alex, 'forge_save_checkin', { p_week_start: iso(monday), p_support: 'x'.repeat(1001) }), 'checkin_too_long'));
check('8: Casey cannot check in to their Journey', failsWith(await call(casey, 'forge_save_checkin', { p_week_start: iso(monday), p_went_well: 'x' }), 'no_active_journey'));
check('8: clearing every answer removes the check-in',
  (await call(blair, 'forge_save_checkin', { p_week_start: iso(monday), p_support: 'Walk on Sunday' })).data?.support === 'Walk on Sunday'
    && (await call(blair, 'forge_save_checkin', { p_week_start: iso(monday) })).data === null
    && !(await snap(alex)).journey.checkins.some(c => c.user_id === blair.id));

// ══ 9: going around the API ═════════════════════════════════════════════════
const alexToken = (await alex.client.auth.getSession()).data.session.access_token;
const direct = [];
for (const table of ['accounts', 'friendships', 'journeys', 'journey_members', 'goals', 'contributions', 'future_items', 'checkins']) {
  const plain = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${alexToken}` } });
  const profiled = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${alexToken}`, 'Accept-Profile': 'forge' } });
  if (plain.ok || profiled.ok) direct.push(`${table}:${plain.status}/${profiled.status}`);
}
check('9: no table can be read through the Data API, even signed in', direct.length === 0, direct.join(' ') || 'all 8 refused');
const writeTry = await fetch(`${SUPABASE_URL}/rest/v1/goals`, {
  method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${alexToken}`, 'Content-Profile': 'forge', 'Content-Type': 'application/json' },
  body: JSON.stringify({ journey_id: JID, title: 'sneaky', kind: 'milestone' }),
});
check('9: nor written', !writeTry.ok, String(writeTry.status));
const helper = await fetch(`${SUPABASE_URL}/rest/v1/rpc/person`, {
  method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${alexToken}`, 'Content-Type': 'application/json', 'Content-Profile': 'forge' },
  body: JSON.stringify({ p_user: blair.id }),
});
check('9: the private helpers cannot be called', !helper.ok, String(helper.status));
const sqlAsUser = psql(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${alex.id}","role":"authenticated"}', true); select count(*) from forge.goals; rollback;`);
check('9: inside the database, a signed-in role has no access to the tables at all',
  !sqlAsUser.ok && /permission denied for schema forge/.test(sqlAsUser.err), sqlAsUser.err.split('\n')[0]);
const forged = (() => {
  const [h, p] = alexToken.split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  payload.sub = blair.id;
  return `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${alexToken.split('.')[2]}`;
})();
const forgedCall = await fetch(`${SUPABASE_URL}/rest/v1/rpc/forge_snapshot`, {
  method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${forged}`, 'Content-Type': 'application/json' }, body: '{}',
});
check('9: a session edited to impersonate someone is rejected', forgedCall.status === 401, String(forgedCall.status));
const noKey = await fetch(`${SUPABASE_URL}/rest/v1/rpc/forge_snapshot`, {
  method: 'POST', headers: { Authorization: `Bearer ${alexToken}`, 'Content-Type': 'application/json' }, body: '{}',
});
check('9: and every request needs the project key', noKey.status === 401);

// ══ 10: leaving, removing, deleting ═════════════════════════════════════════
const counts = () => psql(`select (select count(*) from forge.goals where journey_id = '${JID}') + (select count(*) from forge.future_items where journey_id = '${JID}')
  + (select count(*) from forge.checkins where journey_id = '${JID}') + (select count(*) from forge.contributions c join forge.goals g on g.id = c.goal_id where g.journey_id = '${JID}')
  + (select count(*) from forge.journeys where id = '${JID}')`, { user: 'supabase_admin' }).out;
check('10: before leaving, the Journey holds its content', Number(counts()) > 3, counts());
check('10: Blair leaves', (await call(blair, 'forge_leave_journey', { p_journey: JID })).data?.status === 'ended');
check('10: the Journey ends for both, and its content is deleted',
  (await snap(alex)).journey === null && (await snap(blair)).journey === null && counts() === '0');
check('10: they are still friends', (await snap(alex)).friends.map(f => f.username).join() === 'blair');
const again = await call(alex, 'forge_invite_to_journey', { p_friend: blair.id });
await call(blair, 'forge_respond_journey_invite', { p_journey: again.data.journey_id, p_accept: true });
check('10: a new Journey starts empty', (await snap(alex)).journey?.goals.length === 0 && (await snap(alex)).journey.future.length === 0);
await call(alex, 'forge_add_future_item', { p_title: 'Learn to sail' });
check('10: removing a friend', (await call(alex, 'forge_remove_friend', { p_user: blair.id })).data?.status === 'removed');
a = await snap(alex); b = await snap(blair);
check('10: …ends the friendship and the Journey they shared, for both',
  a.friends.length === 0 && a.journey === null && !b.friends.some(f => f.username === 'alex') && b.journey === null);
check('10: …and they cannot start one again without becoming friends again',
  failsWith(await call(blair, 'forge_invite_to_journey', { p_friend: alex.id }), 'not_friends'));
check('10: removing someone who is not a friend is refused', failsWith(await call(casey, 'forge_remove_friend', { p_user: alex.id }), 'not_friends'));

// An account deleted outright (from the dashboard): its Journey ends with it.
const bc = await call(blair, 'forge_invite_to_journey', { p_friend: casey.id });
await call(casey, 'forge_respond_journey_invite', { p_journey: bc.data.journey_id, p_accept: true });
await call(casey, 'forge_add_future_item', { p_title: 'Run a 10k' });
check('10: (Blair and Casey share a Journey)', (await snap(blair)).journey?.status === 'active');
const del = psql(`delete from auth.users where id = '${casey.id}'`, { user: 'supabase_admin' });
b = await snap(blair);
check('10: deleting an account removes them everywhere and ends their Journey',
  del.ok && b.journey === null && !b.friends.some(f => f.username === 'casey_c')
    && psql(`select count(*) from forge.journeys where id = '${bc.data.journey_id}'`, { user: 'supabase_admin' }).out === '0');

await gateway.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
