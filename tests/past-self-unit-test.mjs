/**
 * Messages from your past self — timing, choice, privacy and send-once.
 *
 * Four promises are tested here, without a browser or a network:
 *
 *   1. WHEN — the chosen weekdays and time are honoured in the user's own time
 *      zone, across both daylight-saving changes, with the same catch-up window
 *      the reminders use.
 *   2. WHICH — rotation is counted in deliveries, and the app and the server
 *      reach the same answer from the same function.
 *   3. PRIVACY — unless the user has switched on lock-screen display, nothing
 *      they wrote is in what the app sends or in what the server stores; a
 *      letter is never sent under any setting; and switching it off again
 *      deletes what was stored.
 *   4. ONCE — one scheduled message is one notification, however often the
 *      dispatcher runs and whether or not two runs overlap.
 *
 * The store is the same in-memory stand-in for the Upstash REST API that the
 * push-queue suite uses, so the real command sequence is exercised.
 */

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

// ── In-memory Upstash REST stand-in ─────────────────────────────────────────
const db = new Map();
const sets = new Map();
function run(args) {
  const [op, key, ...rest] = args;
  switch (op) {
    case 'SET': db.set(key, rest[0]); return 'OK';
    case 'GET': return db.has(key) ? db.get(key) : null;
    case 'DEL': { const had = db.delete(key); sets.delete(key); return had ? 1 : 0; }
    case 'EXISTS': return db.has(key) ? 1 : 0;
    case 'EXPIRE': return 1;
    case 'SADD': { if (!sets.has(key)) sets.set(key, new Set()); sets.get(key).add(rest[0]); return 1; }
    case 'SREM': { sets.get(key)?.delete(rest[0]); return 1; }
    case 'SMEMBERS': return [...(sets.get(key) || [])];
    default: throw new Error(`unsupported command ${op}`);
  }
}
process.env.KV_REST_API_URL = 'https://fake-kv.test';
process.env.KV_REST_API_TOKEN = 'fake-token';
globalThis.fetch = async (_url, init) => {
  const args = JSON.parse(init.body);
  return { ok: true, status: 200, json: async () => ({ result: run(args) }) };
};

const store = await import('../api/_lib/store.js');
const ps = await import('../api/_lib/pastSelf.js');
const client = await import('../src/utils/pastSelf.js');
const { default: syncHandler } = await import('../api/push/sync.js');
const { default: unsubscribeHandler } = await import('../api/push/unsubscribe.js');

/** Call a Vercel-style handler and capture what it answered. */
async function call(handler, { method = 'POST', body = {}, query = {} } = {}) {
  let status = 0; let json = null;
  const res = { status(c) { status = c; return res; }, json(j) { json = j; return res; } };
  await handler({ method, body, query, headers: {} }, res);
  return { status, json };
}

const NY = 'America/New_York';
/** A Date at a UTC instant. Local times below are derived, never assumed. */
const utc = (y, m, d, hh, mm) => new Date(Date.UTC(y, m - 1, d, hh, mm));

// ══ 1: dates, weekdays and the chosen days ══════════════════════════════════
check('1: weekday comes from the local date alone',
  ps.weekdayOf('2026-11-14') === 6 && ps.weekdayOf('2026-11-15') === 0 && ps.weekdayOf('1970-01-01') === 4);
check('1: an empty or full week means every day',
  ps.normalizeDays([]) === null && ps.normalizeDays([0, 1, 2, 3, 4, 5, 6]) === null && ps.normalizeDays(null) === null);
check('1: chosen days are cleaned, de-duplicated and sorted',
  ps.normalizeDays([5, 1, 1, 9, -1, 3]).join() === '1,3,5');
check('1: a Monday-Wednesday-Friday schedule skips Tuesday',
  ps.isScheduledDay('2026-11-16', [1, 3, 5]) && !ps.isScheduledDay('2026-11-17', [1, 3, 5]));

// ══ 2: when it is due ═══════════════════════════════════════════════════════
const rec = (over = {}) => ({
  timezone: NY, time: '07:30', days: null, quietHours: { start: '22:30', end: '07:00' },
  showContent: false, rotation: [], profileId: 'me', ...over,
});
// 14 Nov 2026 is after the autumn change, so New York is UTC-5.
check('2: not due before the chosen time',
  ps.evaluatePastSelf(rec(), utc(2026, 11, 14, 12, 29)).due === null, '07:29 local');
check('2: due at the chosen time', !!ps.evaluatePastSelf(rec(), utc(2026, 11, 14, 12, 30)).due);
check('2: still due a late dispatcher run inside the catch-up window',
  !!ps.evaluatePastSelf(rec(), utc(2026, 11, 14, 13, 55)).due, '08:55 local');
check('2: not sent hours late — outside the window it is skipped',
  ps.evaluatePastSelf(rec(), utc(2026, 11, 14, 14, 5)).due === null, '09:05 local');
check('2: it is evaluated in the user\'s zone, not the server\'s',
  ps.evaluatePastSelf(rec({ timezone: 'Asia/Tokyo' }), utc(2026, 11, 13, 22, 30)).localDate === '2026-11-14' &&
  !!ps.evaluatePastSelf(rec({ timezone: 'Asia/Tokyo' }), utc(2026, 11, 13, 22, 30)).due, '07:30 in Tokyo is the 13th in UTC');
check('2: an unscheduled weekday sends nothing',
  ps.evaluatePastSelf(rec({ days: [1, 3, 5] }), utc(2026, 11, 14, 12, 30)).due === null, 'a Saturday');
check('2: and the scheduled one does',
  !!ps.evaluatePastSelf(rec({ days: [1, 3, 5] }), utc(2026, 11, 16, 12, 30)).due, 'the Monday');
check('2: quiet hours hold it back',
  ps.evaluatePastSelf(rec({ time: '06:30' }), utc(2026, 11, 14, 11, 30)).due === null &&
  ps.evaluatePastSelf(rec({ time: '06:30' }), utc(2026, 11, 14, 11, 30)).quiet === true);

// Daylight saving. Clocks go forward in New York on 8 March 2026 (02:00 → 03:00)
// and back on 1 November 2026 (02:00 → 01:00).
check('2: summer time — 07:30 local is 11:30 UTC, an hour earlier than in winter',
  !!ps.evaluatePastSelf(rec(), utc(2026, 7, 15, 11, 30)).due &&
  ps.evaluatePastSelf(rec(), utc(2026, 7, 15, 11, 29)).due === null);
const gap = rec({ time: '02:30', quietHours: null });
check('2: a time that does not exist on the spring-forward night is sent at the first run after it',
  ps.evaluatePastSelf(gap, utc(2026, 3, 8, 6, 59)).due === null &&      // 01:59 EST
  !!ps.evaluatePastSelf(gap, utc(2026, 3, 8, 7, 0)).due,                // 03:00 EDT
  '02:30 never happens; 03:00 is 30 minutes "after" it');
const twice = rec({ time: '01:30', quietHours: null });
const first0130 = ps.evaluatePastSelf(twice, utc(2026, 11, 1, 5, 30));   // 01:30 EDT
const second0130 = ps.evaluatePastSelf(twice, utc(2026, 11, 1, 6, 30));  // 01:30 EST
check('2: a time that happens twice on the fall-back night is due both times, on ONE local date',
  !!first0130.due && !!second0130.due && first0130.localDate === second0130.localDate,
  'which is why the send-once claim is keyed by local date — see 5');

// ══ 3: which message ════════════════════════════════════════════════════════
const two = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }];
const mwf = ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23', '2026-11-25', '2026-11-27'];
const mwfPicks = mwf.map(d => ps.pickForDate(two, d, [1, 3, 5]).id).join('');
check('3: two messages on Mon/Wed/Fri alternate — neither is starved',
  mwfPicks === 'ababab' || mwfPicks === 'bababa', mwfPicks);
const three = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const daily = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
const dailyPicks = daily.map(d => ps.pickForDate(three, d, null).id).join('');
check('3: daily rotation walks through every message in order',
  /^(abc|bca|cab){2}$/.test(dailyPicks), dailyPicks);
check('3: the same date always gives the same message',
  ps.pickForDate(three, '2026-11-14', null).id === ps.pickForDate(three, '2026-11-14', null).id);
check('3: an empty rotation gives nothing rather than throwing', ps.pickForDate([], '2026-11-14', null) === null);
check('3: rotation crosses a week boundary without repeating or skipping',
  (() => {
    const days = ['2026-11-20', '2026-11-23', '2026-11-25'];    // Fri, Mon, Wed
    const idx = days.map(d => ps.occurrenceIndex(d, [1, 3, 5]));
    return idx[1] === idx[0] + 1 && idx[2] === idx[1] + 1;
  })());

// ══ 4: privacy — what leaves the device, and what the server keeps ══════════
const SECRET_LETTER = 'LETTER-CANARY I am afraid of ending up like my father';
const SECRET_A = 'MSG-CANARY-A Remember why you started';
const SECRET_B = 'MSG-CANARY-B Do not let fear decide';
const SECRET_OFF = 'MSG-CANARY-OFF this one is switched off';

let state = client.readPastSelf({});
check('4: a profile that has never used this reads as empty, with delivery off',
  state.letters.length === 0 && state.messages.length === 0 && state.delivery.enabled === false &&
  state.delivery.showContent === false);

state = client.saveLetter(state, { title: 'Day one', body: SECRET_LETTER });
state = client.saveMessage(state, { text: SECRET_A });
state = client.saveMessage(state, { text: SECRET_B });
state = client.saveMessage(state, { text: SECRET_OFF });
state = client.setMessageEnabled(state, state.messages[2].id, false);
check('4: letters and messages are saved as written',
  state.letters[0].body === SECRET_LETTER && state.messages.map(m => m.text).join('|') === [SECRET_A, SECRET_B, SECRET_OFF].join('|'));

const ctx = { timezone: NY, quietHours: { start: '22:30', end: '07:00' } };
check('4: with notifications off, the app asks the server to hold nothing',
  JSON.stringify(client.buildSyncBody(state, ctx)) === JSON.stringify({ kind: 'pastSelf', enabled: false }));

state = client.updateDelivery(state, { enabled: true, time: '07:30' });
const privateBody = client.buildSyncBody(state, ctx);
check('4: by default the request carries a schedule and NOT ONE WORD the user wrote',
  privateBody.enabled === true && privateBody.showContent === false && privateBody.rotation.length === 0 &&
  !/CANARY/.test(JSON.stringify(privateBody)), JSON.stringify(privateBody));

state = client.updateDelivery(state, { showContent: true });
const revealBody = client.buildSyncBody(state, ctx);
check('4: with lock-screen display on, only the messages that are switched on are sent',
  revealBody.showContent === true && revealBody.rotation.length === 2 &&
  revealBody.rotation.map(r => r.text).join('|') === [SECRET_A, SECRET_B].join('|'));
check('4: the switched-off message is not sent', !JSON.stringify(revealBody).includes('CANARY-OFF'));
check('4: a letter is never sent, under any setting', !JSON.stringify(revealBody).includes('LETTER-CANARY'));
check('4: the user\'s words are sent exactly as written — not rewritten, not shortened',
  revealBody.rotation[0].text === SECRET_A);

// Pinning one message sends only that one.
const pinned = client.updateDelivery(state, { pick: 'specific', messageId: state.messages[1].id });
check('4: pinned to one message, only that message is sent',
  client.buildSyncBody(pinned, ctx).rotation.length === 1 && client.buildSyncBody(pinned, ctx).rotation[0].text === SECRET_B);

// The server's own guard: text without the consent flag is discarded.
const sneaky = ps.sanitizeRecord({ timezone: NY, time: '07:30', showContent: false, rotation: [{ id: 'x', text: SECRET_A }] });
check('4: the server discards message text that arrives without consent',
  sneaky.showContent === false && sneaky.rotation.length === 0);
const tooLong = ps.sanitizeRecord({ timezone: NY, time: '07:30', showContent: true, rotation: [{ id: 'x', text: 'y'.repeat(ps.MAX_MESSAGE_CHARS + 1) }] });
check('4: an over-long message is refused, never truncated',
  tooLong.rotation.length === 0 && tooLong.showContent === false);
check('4: a nonsense schedule is not stored at all',
  ps.sanitizeRecord({ timezone: 'Not/AZone', time: '07:30' }) === null &&
  ps.sanitizeRecord({ timezone: NY, time: '25:99' }) === null);
check('4: a client cannot store more than the message limit',
  ps.sanitizeRecord({ timezone: NY, time: '07:30', showContent: true,
    rotation: Array.from({ length: 80 }, (_, i) => ({ id: `m${i}`, text: `t${i}` })) }).rotation.length === ps.MAX_MESSAGES);

// Through the real endpoint, into the store, and back out via status.
const INSTALL = 'install-ps-1';
let r = await call(syncHandler, { body: { ...privateBody, installId: INSTALL, profileId: 'me' } });
check('4: the private schedule is accepted and reports no stored text',
  r.status === 200 && r.json.stored === true && r.json.contentStored === 0);
check('4: nothing the user wrote is anywhere in the store', ![...db.values()].some(v => /CANARY/.test(v)));

r = await call(syncHandler, { body: { ...revealBody, installId: INSTALL, profileId: 'me' } });
check('4: with consent, the server reports how many messages it holds', r.json.contentStored === 2);
const stored = await store.getPastSelf(INSTALL, 'me');
check('4: and holds exactly those — no letter, no switched-off message',
  stored.rotation.length === 2 && !JSON.stringify(stored).includes('LETTER-CANARY') && !JSON.stringify(stored).includes('CANARY-OFF'));

// What the diagnostics endpoint reports. (status.js itself is not imported
// here: it pulls in web-push, which this runner cannot bundle. It returns this
// function's result unchanged.)
const summaryOf = async (install, profile) => ps.storedSummary(await store.getPastSelf(install, profile), profile);
let status = await summaryOf(INSTALL, 'me');
check('4: the status endpoint reports a count and never the text',
  status.stored === true && status.contentStored === 2 && !/CANARY/.test(JSON.stringify(status)));

// Revoking consent deletes what was stored.
r = await call(syncHandler, { body: { ...privateBody, installId: INSTALL, profileId: 'me' } });
check('4: switching lock-screen display off again removes the text from the server',
  r.json.contentStored === 0 && ![...db.values()].some(v => /CANARY/.test(v)));

// And turning the feature off deletes the record entirely.
await call(syncHandler, { body: { ...revealBody, installId: INSTALL, profileId: 'me' } });
r = await call(syncHandler, { body: { kind: 'pastSelf', enabled: false, installId: INSTALL, profileId: 'me' } });
status = await summaryOf(INSTALL, 'me');
check('4: turning notifications off deletes the record, text and all',
  r.json.stored === false && (await store.getPastSelf(INSTALL, 'me')) === null &&
  status.stored === false && !(await store.getAllPastSelfIds()).includes(`${INSTALL}:me`));

// The two profiles never share a record.
await call(syncHandler, { body: { ...revealBody, installId: INSTALL, profileId: 'me' } });
check('4: one profile\'s messages are not visible under the other',
  (await store.getPastSelf(INSTALL, 'girlfriend')) === null &&
  (await summaryOf(INSTALL, 'girlfriend')).stored === false);

// The reminder sync is untouched by any of this, and vice versa.
await call(syncHandler, { body: {
  installId: INSTALL, profileId: 'me', timezone: NY, localDate: '2026-11-14', masterEnabled: true,
  quietHours: { start: '22:30', end: '07:00' },
  reminders: { u_morning: { time: '08:00', payload: null, fallback: { title: 'M', body: 'b' } } },
} });
check('4: a reminder sync leaves the past-self record exactly as it was',
  (await store.getPastSelf(INSTALL, 'me')).rotation.length === 2);
await call(syncHandler, { body: { ...privateBody, installId: INSTALL, profileId: 'me' } });
check('4: and a past-self sync leaves the reminder schedule exactly as it was',
  Object.keys((await store.getSchedule(INSTALL, 'me')).reminders).join() === 'u_morning');
await call(syncHandler, { body: { installId: INSTALL, profileId: 'me', timezone: NY, localDate: '2026-11-14', masterEnabled: false } });
check('4: switching reminders off does not silence messages the user asked for separately',
  (await store.getPastSelf(INSTALL, 'me')) !== null && (await store.getSchedule(INSTALL, 'me')) === null);

// Unsubscribing the last device removes the record along with everything else.
await store.saveSubscription(INSTALL, 'me', { endpoint: 'https://push.test/abc', keys: { p256dh: 'k', auth: 'a' } });
await call(syncHandler, { body: { ...revealBody, installId: INSTALL, profileId: 'me' } });
await call(unsubscribeHandler, { body: { installId: INSTALL, profileId: 'me', endpoint: 'https://push.test/abc' } });
check('4: removing the last push subscription removes stored message text too',
  (await store.getPastSelf(INSTALL, 'me')) === null);

// ══ 5: one scheduled message is one notification ════════════════════════════
const I2 = 'install-ps-2';
await store.saveSubscription(I2, 'me', { endpoint: 'https://push.test/one', keys: { p256dh: 'k', auth: 'a' } });
await call(syncHandler, { body: { ...revealBody, installId: I2, profileId: 'me' } });

function deps(sendImpl) {
  return {
    listIds: store.getAllPastSelfIds, getRecord: store.getPastSelf, getSubscriptions: store.getSubscriptions,
    alreadySent: store.alreadySent, markSent: store.markSent, unmarkSent: store.unmarkSent, send: sendImpl,
  };
}
const sent = [];
const okSend = async (_sub, payload) => { sent.push(payload); return { ok: true }; };
const at0730 = utc(2026, 11, 16, 12, 30);     // Monday 07:30 in New York

let s1 = await ps.dispatchPastSelf({ ...deps(okSend), now: at0730 });
check('5: the first run at the chosen time sends one notification', s1.sent === 1 && sent.length === 1);
for (let i = 1; i <= 12; i++) {
  await ps.dispatchPastSelf({ ...deps(okSend), now: new Date(at0730.getTime() + i * 5 * 60000) });
}
check('5: twelve more runs across the next hour send nothing further', sent.length === 1, `${sent.length} sent`);
await Promise.all([
  ps.dispatchPastSelf({ ...deps(okSend), now: at0730 }),
  ps.dispatchPastSelf({ ...deps(okSend), now: at0730 }),
]);
check('5: two overlapping runs still send nothing further', sent.length === 1);

check('5: the notification carries the user\'s own words when they chose to show them',
  sent[0].title === ps.REVEALED_TITLE && [SECRET_A, SECRET_B].includes(sent[0].body) && !!sent[0].msg);
check('5: it says where to open and whom it is for',
  sent[0].view === 'message' && sent[0].profile === 'me' && sent[0].date === '2026-11-16');
check('5: it replaces an unread one from an earlier day instead of stacking, and still alerts',
  sent[0].tag === 'forge-pastself-me' && sent[0].renotify === true);

const nextDay = utc(2026, 11, 17, 12, 30);
await ps.dispatchPastSelf({ ...deps(okSend), now: nextDay });
check('5: the next day sends the next message — once', sent.length === 2 && sent[1].msg !== sent[0].msg && sent[1].date === '2026-11-17');

// The fall-back night: 01:30 happens twice and must be sent once.
const I3 = 'install-ps-3';
await store.saveSubscription(I3, 'me', { endpoint: 'https://push.test/dst', keys: { p256dh: 'k', auth: 'a' } });
await call(syncHandler, { body: { kind: 'pastSelf', enabled: true, installId: I3, profileId: 'me', timezone: NY, time: '01:30', days: null, quietHours: null, showContent: false, rotation: [] } });
const dstSent = [];
const only = (id) => async () => [id];
const dstDeps = { ...deps(async (_s, p) => { dstSent.push(p); return { ok: true }; }), listIds: only(`${I3}:me`) };
await ps.dispatchPastSelf({ ...dstDeps, now: utc(2026, 11, 1, 5, 30) });
await ps.dispatchPastSelf({ ...dstDeps, now: utc(2026, 11, 1, 6, 30) });
check('5: on the night the clocks go back, the repeated hour sends one notification, not two',
  dstSent.length === 1, `${dstSent.length} sent`);
check('5: in private mode the lock screen shows the fixed sentence and no message id',
  dstSent[0].title === 'Forge' && dstSent[0].body === 'A message from your past self is ready.' && dstSent[0].msg === undefined);

// A failed send releases the claim so the next run can retry — and then stops.
const I4 = 'install-ps-4';
await store.saveSubscription(I4, 'me', { endpoint: 'https://push.test/flaky', keys: { p256dh: 'k', auth: 'a' } });
await call(syncHandler, { body: { ...privateBody, installId: I4, profileId: 'me' } });
let attempts = 0;
const flaky = async () => { attempts++; return attempts === 1 ? { ok: false, error: 'timeout' } : { ok: true }; };
const flakyDeps = { ...deps(flaky), listIds: only(`${I4}:me`) };
const f1 = await ps.dispatchPastSelf({ ...flakyDeps, now: at0730 });
const f2 = await ps.dispatchPastSelf({ ...flakyDeps, now: new Date(at0730.getTime() + 5 * 60000) });
const f3 = await ps.dispatchPastSelf({ ...flakyDeps, now: new Date(at0730.getTime() + 10 * 60000) });
check('5: a failed send is retried on the next run, and once it lands it is not sent again',
  f1.errors === 1 && f2.sent === 1 && f3.sent === 0 && attempts === 2, `${attempts} attempts`);

// No subscription: nothing is claimed, so it can still be sent once one exists.
const I5 = 'install-ps-5';
await call(syncHandler, { body: { ...privateBody, installId: I5, profileId: 'me' } });
const n1 = await ps.dispatchPastSelf({ ...deps(okSend), listIds: only(`${I5}:me`), now: at0730 });
check('5: with no device to send to, the day\'s slot is not used up',
  n1.sent === 0 && !(await store.alreadySent(I5, 'me', ps.PAST_SELF_TYPE, '2026-11-16')));

// A device that can no longer be reached takes its record — and its words — with it.
{
  const removed = [];
  const removeRecord = async (i, p) => { removed.push(`${i}:${p}`); await store.removePastSelf(i, p); };
  const stored = (minutesBefore) => ({
    ...ps.sanitizeRecord(revealBody), syncedAt: new Date(at0730.getTime() - minutesBefore * 60000).toISOString(),
  });
  const run = (id, sendImpl = okSend) =>
    ps.dispatchPastSelf({ ...deps(sendImpl), listIds: only(`${id}:me`), removeRecord, now: at0730 });

  // Synced two hours before it fell due, and no device left to send to.
  await store.savePastSelf('ps-orphan', 'me', stored(120));
  const o = await run('ps-orphan');
  check('5: a schedule with no device left to send to is deleted when it falls due',
    o.removed === 1 && (await store.getPastSelf('ps-orphan', 'me')) === null && removed.includes('ps-orphan:me'));
  check('5: …taking the words with it, and leaving nothing in the index',
    ![...db.keys()].some(k => k.includes('ps-orphan'))
    && (await store.getAllPastSelfIds()).every(id => !id.startsWith('ps-orphan')));

  // Synced a minute ago: the device's subscription may simply not have arrived yet.
  await store.savePastSelf('ps-new', 'me', stored(1));
  const n = await run('ps-new');
  check('5: one synced moments ago is kept — its subscription may still be on its way',
    n.removed === 0 && (await store.getPastSelf('ps-new', 'me')) !== null);

  // The push service says the device withdrew its subscription.
  await store.saveSubscription('ps-revoked', 'me', { endpoint: 'https://push.test/revoked', keys: { p256dh: 'k', auth: 'a' } });
  await store.savePastSelf('ps-revoked', 'me', stored(1));
  const r = await run('ps-revoked', async () => ({ ok: false, gone: true, statusCode: 410 }));
  check('5: when the push service reports the device gone, the record is deleted at once',
    r.removed === 1 && r.sent === 0 && (await store.getPastSelf('ps-revoked', 'me')) === null);
  check('5: …and the day is not marked as sent',
    !(await store.alreadySent('ps-revoked', 'me', ps.PAST_SELF_TYPE, '2026-11-16')));

  // One of two devices gone, the other still there: delivered, and kept.
  await store.saveSubscription('ps-two', 'me', { endpoint: 'https://push.test/two-a', keys: { p256dh: 'k', auth: 'a' } });
  await store.saveSubscription('ps-two', 'me', { endpoint: 'https://push.test/two-b', keys: { p256dh: 'k', auth: 'a' } });
  await store.savePastSelf('ps-two', 'me', stored(120));
  let first = true;
  const t = await run('ps-two', async () => { const g = first; first = false; return g ? { ok: false, gone: true } : { ok: true }; });
  check('5: with one device gone and another still reachable, it is delivered and kept',
    t.sent === 1 && t.removed === 0 && (await store.getPastSelf('ps-two', 'me')) !== null);

  // A transient failure is not a departure.
  await store.saveSubscription('ps-flaky', 'me', { endpoint: 'https://push.test/flaky-2', keys: { p256dh: 'k', auth: 'a' } });
  await store.savePastSelf('ps-flaky', 'me', stored(120));
  const f = await run('ps-flaky', async () => ({ ok: false, statusCode: 500, error: 'server error' }));
  check('5: a push service error that is not "gone" keeps the record for the retry',
    f.removed === 0 && f.errors === 1 && (await store.getPastSelf('ps-flaky', 'me')) !== null);
}

// It does not interfere with a reminder's own send-once claim on the same day.
await store.markSent(I2, 'me', 'u_morning', '2026-11-18');
const before = sent.length;
await ps.dispatchPastSelf({ ...deps(okSend), listIds: only(`${I2}:me`), now: utc(2026, 11, 18, 12, 30) });
check('5: a reminder already sent that day does not block the message, or the other way round',
  sent.length === before + 1 && (await store.alreadySent(I2, 'me', 'u_morning', '2026-11-18')));

// ══ 6: opening a notification shows the message it was for ══════════════════
let s = client.readPastSelf({});
s = client.saveMessage(s, { text: 'one' });
s = client.saveMessage(s, { text: 'two' });
s = client.saveMessage(s, { text: 'three' });
s = client.updateDelivery(s, { enabled: true });
const server = (date) => ps.buildPayload(ps.sanitizeRecord({ ...client.buildSyncBody(client.updateDelivery(s, { showContent: true }), ctx) }), date, 'me');
check('6: the app and the server choose the same message for the same date',
  ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'].every(d =>
    client.resolveReveal(s, { date: d }).message.id === server(d).msg));
check('6: a message id from the notification wins over the date',
  client.resolveReveal(s, { date: '2026-11-14', msg: s.messages[2].id }).message.text === 'three');
check('6: if that message has since been deleted, the day\'s message is shown instead',
  client.resolveReveal(s, { date: '2026-11-14', msg: 'gone' }).kind === 'message');
let lettersOnly = client.saveLetter(client.readPastSelf({}), { body: 'Dear me' });
check('6: with no short messages, the notification opens the letter',
  client.resolveReveal(lettersOnly, { date: '2026-11-14' }).kind === 'letter');
check('6: with nothing at all, it says so rather than breaking',
  client.resolveReveal(client.readPastSelf({}), { date: '2026-11-14' }).kind === 'none');
check('6: a letter alone is enough to schedule the private notification',
  client.deliveryActive(client.updateDelivery(lettersOnly, { enabled: true })) &&
  client.buildSyncBody(client.updateDelivery(lettersOnly, { enabled: true, showContent: true }), ctx).rotation.length === 0);

// ══ 7: editing ══════════════════════════════════════════════════════════════
let e = client.readPastSelf({});
e = client.saveMessage(e, { text: '  Become who you promised.  ' });
check('7: surrounding whitespace is trimmed and nothing else is changed', e.messages[0].text === 'Become who you promised.');
const id0 = e.messages[0].id;
e = client.saveMessage(e, { id: id0, text: 'Become who you promised yourself.' });
check('7: editing replaces the text and keeps the same message', e.messages.length === 1 && e.messages[0].id === id0 && /yourself/.test(e.messages[0].text));
check('7: an empty message is not saved', client.saveMessage(e, { text: '   ' }).messages.length === 1);
check('7: an over-long message is refused with a reason, not cut down',
  !!client.messageProblem(e, 'x'.repeat(client.MAX_MESSAGE_CHARS + 1)) &&
  client.saveMessage(e, { text: 'x'.repeat(client.MAX_MESSAGE_CHARS + 1) }).messages.length === 1);
check('7: an emoji counts as one character', client.charCount('🔥🔥') === 2);
e = client.updateDelivery(e, { pick: 'specific', messageId: id0 });
check('7: deleting the pinned message returns delivery to rotation',
  client.deleteMessage(e, id0).delivery.pick === 'rotate' && client.deleteMessage(e, id0).delivery.messageId === null);
check('7: switching the pinned message off does the same',
  client.setMessageEnabled(e, id0, false).delivery.pick === 'rotate');
check('7: "specific days" can never be left with no day chosen',
  client.updateDelivery(e, { mode: 'days', days: [] }).delivery.days.length > 0);
let l = client.saveLetter(client.readPastSelf({}), { title: 'One', body: 'first' });
const lid = l.letters[0].id;
l = client.saveLetter(l, { id: lid, title: 'One', body: 'first, revised' });
check('7: editing a letter keeps its original date and records the edit',
  l.letters.length === 1 && l.letters[0].body === 'first, revised' && l.letters[0].createdAt <= l.letters[0].updatedAt);
check('7: deleting a letter removes only that letter',
  client.deleteLetter(client.saveLetter(l, { body: 'second' }), lid).letters.length === 1);

// ══ 8: describing the schedule honestly ═════════════════════════════════════
check('8: the days read naturally',
  client.describeDays({ mode: 'daily', days: [1] }) === 'Every day' &&
  client.describeDays({ mode: 'days', days: [1, 2, 3, 4, 5] }) === 'Weekdays' &&
  client.describeDays({ mode: 'days', days: [1, 3, 5] }) === 'Mon, Wed, Fri');
const active = client.updateDelivery(client.saveMessage(client.readPastSelf({}), { text: 'm' }), { enabled: true, mode: 'days', days: [1], time: '07:30' });
const nxt = client.nextDelivery(active, new Date(2026, 10, 14, 9, 0));   // Saturday morning
check('8: the next delivery is the next chosen weekday at the chosen time',
  nxt && nxt.localDate === '2026-11-16' && nxt.at.getHours() === 7 && nxt.at.getMinutes() === 30, nxt?.localDate);
check('8: nothing is promised while delivery is off',
  client.nextDelivery(client.updateDelivery(active, { enabled: false })) === null);
check('8: the preview shows the private sentence by default and the real words only when asked',
  client.previewNotification(active, '2026-11-16', { reveal: false }).body === 'A message from your past self is ready.' &&
  client.previewNotification(active, '2026-11-16', { reveal: true }).body === 'm');

// A bare date is a calendar day: west of Greenwich it must not slip to the day before.
{
  const tz = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  check('8: a letter dated 2026-11-05 reads as the 5th in Los Angeles, not the 4th',
    /\b5\b/.test(client.formatWritten('2026-11-05')) && !/\b4\b/.test(client.formatWritten('2026-11-05')), client.formatWritten('2026-11-05'));
  process.env.TZ = 'Pacific/Auckland';
  check('8: and as the 5th in Auckland too', /\b5\b/.test(client.formatWritten('2026-11-05')), client.formatWritten('2026-11-05'));
  if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  check('8: a date that cannot be read is shown as it is, never as "Invalid Date"',
    client.formatWritten('sometime in spring') === 'sometime in spring' && client.formatWritten('') === '');
}

// ══ 9: one profile opting out never silences the other ═════════════════════
// A device has ONE push subscription. Both profiles share it in the browser,
// and on the server it is stored once, under its endpoint. So unsubscribing on
// behalf of one profile takes the other's notifications with it — which is why
// anything about to unsubscribe has to ask whether something else still needs it.
{
  const on = client.updateDelivery(client.saveMessage(client.readPastSelf({}), { text: 'm' }), { enabled: true });
  const off = client.readPastSelf({});
  const profs = (me, gf) => ({ me: { pastSelf: me }, girlfriend: { pastSelf: gf } });
  const prefs = (me, gf) => ({ me: { masterEnabled: me }, girlfriend: { masterEnabled: gf } });
  const need = client.pushStillNeeded;

  check('9: with everything off, nothing needs the subscription',
    need(profs(off, off), prefs(false, false)) === false);
  check('9: switching off my own messages, with nothing else on, frees it',
    need(profs(on, off), prefs(false, false), { pastSelf: 'me' }) === false);
  check('9: …but not while my reminders are still on',
    need(profs(on, off), prefs(true, false), { pastSelf: 'me' }) === true);
  check('9: …and not while the OTHER profile still has messages on',
    need(profs(on, on), prefs(false, false), { pastSelf: 'me' }) === true);
  check('9: …or the other profile still has reminders on',
    need(profs(on, off), prefs(false, true), { pastSelf: 'me' }) === true);
  check('9: switching off my reminders keeps it while my own messages are on',
    need(profs(on, off), prefs(true, false), { reminders: 'me' }) === true);
  check('9: switching off my reminders keeps it while the other profile uses it',
    need(profs(off, on), prefs(true, false), { reminders: 'me' }) === true &&
    need(profs(off, off), prefs(true, true), { reminders: 'me' }) === true);
  check('9: switching off my reminders, with nothing else on, frees it',
    need(profs(off, off), prefs(true, false), { reminders: 'me' }) === false);
  check('9: messages switched on with nothing written do not count as needing it',
    need(profs(client.updateDelivery(off, { enabled: true }), off), prefs(false, false)) === false);
  check('9: missing profiles or preferences are read as off, not as an error',
    need(undefined, undefined) === false && need({}, {}) === false);

  // The server-side half of the same fact: the two profiles' subscriptions on
  // one device are ONE stored record.
  db.clear(); sets.clear();
  const shared = { endpoint: 'https://push.example.test/send/device-1', keys: { p256dh: 'p', auth: 'a' } };
  await store.saveSubscription('inst-9', 'me', shared);
  await store.saveSubscription('inst-9', 'girlfriend', shared);
  check('9: both profiles can be reached through the one stored subscription',
    (await store.getSubscriptions('inst-9', 'me')).length === 1 &&
    (await store.getSubscriptions('inst-9', 'girlfriend')).length === 1);
  await store.removeSubscription('inst-9', 'me', shared.endpoint);
  check('9: removing it for one profile removes it for both — hence the guard',
    (await store.getSubscriptions('inst-9', 'girlfriend')).length === 0);
}

// ══ 10: nothing was added that Forge would have to pay for or migrate ══════
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const root = process.cwd();
  const functions = [
    ...readdirSync(resolve(root, 'api/push')).map(f => `push/${f}`),
    ...readdirSync(resolve(root, 'api/cron')).map(f => `cron/${f}`),
  ].filter(f => f.endsWith('.js')).sort();
  check('10: there are still exactly nine serverless functions — none was added',
    functions.length === 9, functions.join(', '));
  check('10: no past-self endpoint exists; it rides on /api/push/sync and the dispatcher',
    !functions.some(f => /past|letter|message/i.test(f)));

  const settings = readFileSync(resolve(root, 'src/components/SettingsView.jsx'), 'utf8');
  const keys = settings.match(/const LS_KEYS = \[([^\]]+)\]/)?.[1].replace(/['\s]/g, '').split(',') || [];
  check('10: the backup still covers the same nine keys, in the same order',
    keys.join() === 'profiles,allDays,activeProfile,quoteData,experiments,dismissedHints,archives,notifPrefs,weeklyReflections',
    keys.join());
  check('10: letters and messages need no key of their own — they live on the profile',
    client.readPastSelf({ pastSelf: client.saveLetter(client.readPastSelf({}), { body: 'kept' }) }).letters[0].body === 'kept');

  const nav = readFileSync(resolve(root, 'src/components/BottomNav.jsx'), 'utf8');
  const tabs = [...nav.matchAll(/id:\s*'([a-z]+)'/g)].map(m => m[1]);
  check('10: the bottom bar still has its five tabs and no sixth',
    tabs.join() === 'home,today,insights,challenges,settings', tabs.join());
}

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
