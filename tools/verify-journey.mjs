#!/usr/bin/env node
/**
 * Verify a real Supabase project before Our Journey goes live.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node tools/verify-journey.mjs
 *
 * Run it on your own computer. The service-role key is used here only to
 * create three throwaway test accounts and sign them in without sending email,
 * and to delete them at the end. It never goes into the app, a build, a commit
 * or Vercel — the app only ever has the public anon key.
 *
 * Every check then runs as one of those three people, through the same Data
 * API the app uses: two of them become friends and share a Journey from two
 * separate sessions (as two phones would), and the third tries to read and
 * change what is not theirs. Exits non-zero if anything fails.
 */
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const tag = Math.random().toString(36).slice(2, 8);
const people = ['a', 'b', 'c'].map(x => ({ email: `forge-verify-${tag}-${x}@example.com`, username: `v${tag}${x}` }));
const created = [];

async function signIn(p) {
  const made = await admin.auth.admin.createUser({ email: p.email, email_confirm: true });
  if (made.error) throw new Error(`create ${p.email}: ${made.error.message}`);
  created.push(made.data.user.id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: p.email });
  if (link.error) throw new Error(`link ${p.email}: ${link.error.message}`);
  const client = createClient(URL_, ANON, opts);
  const v = await client.auth.verifyOtp({ email: p.email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) throw new Error(`sign in ${p.email}: ${v.error.message}`);
  return { ...p, client, id: v.data.user.id, token: v.data.session.access_token };
}
const call = async (who, fn, args = {}) => {
  const { data, error } = await who.client.rpc(fn, args);
  return { data, error: error?.message || null, code: error?.code || null };
};
const snap = async (who) => (await call(who, 'forge_snapshot')).data;

try {
  const anon = createClient(URL_, ANON, opts);
  const refused = await anon.rpc('forge_snapshot');
  check('signed-out callers are refused', refused.error?.code === '42501', refused.error?.message);

  const [a, b, c] = [await signIn(people[0]), await signIn(people[1]), await signIn(people[2])];
  check('three test accounts can sign in', !!(a.id && b.id && c.id));
  for (const p of [a, b, c]) await call(p, 'forge_claim_username', { p_username: p.username });
  check('usernames are claimed', (await snap(a))?.me?.username === a.username);

  const found = await call(c, 'forge_find_user', { p_username: a.username });
  check('an exact username finds a name and nothing else',
    found.data && !('user_id' in found.data) && !('invite_code' in found.data) && !JSON.stringify(found.data).includes('@'));
  check('a partial username finds nobody', (await call(c, 'forge_find_user', { p_username: a.username.slice(0, -1) })).data === null);

  await call(a, 'forge_send_friend_request', { p_username: b.username });
  const req = (await snap(b)).incoming_requests[0];
  check('someone else cannot accept your friend request',
    (await call(c, 'forge_respond_friend_request', { p_request: req.id, p_accept: true })).error === 'request_not_found');
  await call(b, 'forge_respond_friend_request', { p_request: req.id, p_accept: true });
  check('two people become friends', (await snap(a)).friends.some(f => f.username === b.username));

  const inv = await call(a, 'forge_invite_to_journey', { p_friend: b.id });
  check('nothing can be shared before the invitation is accepted',
    (await call(a, 'forge_create_goal', { p_title: 'x', p_kind: 'milestone' })).error === 'no_active_journey');
  check('an outsider cannot accept it', (await call(c, 'forge_respond_journey_invite', { p_journey: inv.data.journey_id, p_accept: true })).error === 'invite_not_found');
  await call(b, 'forge_respond_journey_invite', { p_journey: inv.data.journey_id, p_accept: true });
  check('the Journey is active for both', (await snap(a)).journey?.status === 'active' && (await snap(b)).journey?.status === 'active');

  const g = await call(a, 'forge_create_goal', { p_title: 'Verify goal', p_kind: 'count', p_target: 3, p_unit: 'steps' });
  await call(b, 'forge_agree_goal', { p_goal: g.data.id });
  await call(a, 'forge_add_contribution', { p_goal: g.data.id, p_amount: 1 });
  await call(b, 'forge_add_contribution', { p_goal: g.data.id, p_amount: 1 });
  const seenByA = (await snap(a)).journey.goals.find(x => x.id === g.data.id);
  const seenByB = (await snap(b)).journey.goals.find(x => x.id === g.data.id);
  check('contributions from two sessions are combined, and both see the same', seenByA?.progress === 2 && seenByB?.progress === 2);

  check('an outsider sees none of it', (await snap(c)).journey === null && !JSON.stringify(await snap(c)).includes('Verify goal'));
  check('an outsider cannot add to it', (await call(c, 'forge_add_contribution', { p_goal: g.data.id, p_amount: 1 })).error === 'goal_not_found');

  let direct = 0;
  for (const table of ['accounts', 'friendships', 'journeys', 'goals', 'contributions', 'checkins']) {
    for (const profile of [null, 'forge']) {
      const r = await fetch(`${URL_}/rest/v1/${table}?select=*`, {
        headers: { apikey: ANON, Authorization: `Bearer ${a.token}`, ...(profile ? { 'Accept-Profile': profile } : {}) },
      });
      if (r.ok) direct++;
    }
  }
  check('no table can be read directly through the Data API', direct === 0, `${direct} readable`);

  await call(b, 'forge_leave_journey', { p_journey: inv.data.journey_id });
  check('leaving ends the Journey for both', (await snap(a)).journey === null && (await snap(b)).journey === null);
} catch (err) {
  check('verification ran to the end', false, err.message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`(removed ${created.length} test account${created.length === 1 ? '' : 's'})`);
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
