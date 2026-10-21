/**
 * The push store: the one-shot queue, the send-once claim, the dispatcher run
 * log, and delivery confirmation.
 *
 * Run against an in-memory stand-in for the Upstash REST API, so the real
 * command sequence is exercised without a network or a live Redis.
 *
 * The specific behaviours under test are the ones whose absence produced silent
 * non-delivery: a claim that was taken before the send (so one transient error
 * lost the reminder for 36 hours), a run log that could not prove whether the
 * scheduler was alive, and a diagnostics record that reported "delivered" on a
 * push service's 201.
 */

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

// ── In-memory Upstash REST stand-in ────────────────────────────────────────
const db = new Map();        // key -> string value
const sets = new Map();      // key -> Set<string>
const ttls = new Map();      // key -> seconds (recorded, not enforced)
let calls = 0;

function run(args) {
  calls++;
  const [op, key, ...rest] = args;
  switch (op) {
    case 'SET': {
      db.set(key, rest[0]);
      if (rest[1] === 'EX') ttls.set(key, Number(rest[2]));
      return 'OK';
    }
    case 'GET': return db.has(key) ? db.get(key) : null;
    case 'DEL': { const had = db.delete(key); sets.delete(key); return had ? 1 : 0; }
    case 'EXISTS': return db.has(key) ? 1 : 0;
    case 'EXPIRE': { ttls.set(key, Number(rest[0])); return 1; }
    case 'SADD': {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key).add(rest[0]);
      return 1;
    }
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
const {
  storeConfigured, saveSubscription, getSubscriptions, removeSubscriptionByEndpoint,
  saveSchedule, getSchedule, getAllScheduleIds,
  alreadySent, markSent, unmarkSent,
  enqueueOneShot, listOneShots, removeOneShot, pendingOneShots,
  recordCronRun, getCronRuns,
  recordDelivery, getDiagnostics, updateDiagnostics,
  QUEUE_KEY, CRON_RUNS_KEY,
} = store;

const INSTALL = 'install-abc';
const sub = (n = 1) => ({
  endpoint: `https://web.push.apple.com/token-${n}`,
  keys: { p256dh: 'p', auth: 'a' },
});

// ══ 0: configuration gate ═══════════════════════════════════════════════════
check('0: the store reports itself configured when the KV env vars are present', storeConfigured());

// ══ 1: subscriptions round-trip ═════════════════════════════════════════════
await saveSubscription(INSTALL, 'me', sub(1));
let subs = await getSubscriptions(INSTALL, 'me');
check('1: a saved subscription comes back', subs.length === 1 && subs[0].endpoint === sub(1).endpoint);
check('1: the encryption keys are preserved — a push cannot be encrypted without them',
  subs[0].keys?.p256dh === 'p' && subs[0].keys?.auth === 'a');
check('1: profiles are isolated', (await getSubscriptions(INSTALL, 'girlfriend')).length === 0);

await saveSubscription(INSTALL, 'me', sub(2));
check('1: two devices on one profile both receive', (await getSubscriptions(INSTALL, 'me')).length === 2);

// A dangling index entry (record expired, index not) must be pruned, not
// returned as a phantom device that every send then fails against.
db.delete(`push:sub:${Buffer.from(sub(2).endpoint).toString('base64url')}`);
check('1: an expired subscription record is pruned from the index',
  (await getSubscriptions(INSTALL, 'me')).length === 1);

await saveSubscription(INSTALL, 'me', sub(2));
await removeSubscriptionByEndpoint(sub(2).endpoint);
check('1: a subscription the push service reported gone is removed',
  (await getSubscriptions(INSTALL, 'me')).length === 1);

// ══ 2: schedules and the dispatcher index ═══════════════════════════════════
await saveSchedule(INSTALL, 'me', { timezone: 'America/New_York', masterEnabled: true, reminders: {} });
check('2: a schedule round-trips', (await getSchedule(INSTALL, 'me'))?.timezone === 'America/New_York');
check('2: the install appears in the dispatcher index', (await getAllScheduleIds()).includes(`${INSTALL}:me`));
check('2: an install with no schedule reads as null', (await getSchedule('nobody', 'me')) === null);

// ══ 3: the send-once claim, and releasing it after a total failure ══════════
check('3: nothing is marked sent to begin with', !(await alreadySent(INSTALL, 'me', 'water', '2026-07-15')));
await markSent(INSTALL, 'me', 'water', '2026-07-15');
check('3: claiming the slot blocks a second send in the same run or an overlapping one',
  await alreadySent(INSTALL, 'me', 'water', '2026-07-15'));
check('3: the claim is per local date', !(await alreadySent(INSTALL, 'me', 'water', '2026-07-16')));
check('3: the claim is per reminder type', !(await alreadySent(INSTALL, 'me', 'reading', '2026-07-15')));
check('3: the claim is per profile', !(await alreadySent(INSTALL, 'girlfriend', 'water', '2026-07-15')));

// This is the fix for "one transient error loses the reminder for the day".
await unmarkSent(INSTALL, 'me', 'water', '2026-07-15');
check('3: releasing the claim lets the next dispatcher run retry',
  !(await alreadySent(INSTALL, 'me', 'water', '2026-07-15')));
check('3: the claim carries an expiry, so it cannot block forever',
  ttls.get('push:sent:install-abc:me:water:2026-07-15') > 0);

// ══ 4: the one-shot queue (the 3-minute background test) ════════════════════
const soon = new Date(Date.now() + 3 * 60000).toISOString();
const id = await enqueueOneShot({
  installId: INSTALL, profileId: 'me', dueAt: soon, label: 'scheduled-test',
  payload: { title: 'T', body: 'b', tag: 'forge-sched-test-1', confirm: { label: 'scheduled-test' } },
});
check('4: queueing returns an id', typeof id === 'string' && id.length > 0);
let queued = await listOneShots();
check('4: the queued item is listed', queued.length === 1 && queued[0].id === id);
check('4: it carries its due time, so the dispatcher can hold it back', queued[0].dueAt === soon);
check('4: it carries the full payload including the confirmation request',
  queued[0].payload.confirm?.label === 'scheduled-test');
check('4: it records when it was queued', !!queued[0].queuedAt);
check('4: pendingOneShots filters to one install/profile',
  (await pendingOneShots(INSTALL, 'me')).length === 1 &&
  (await pendingOneShots(INSTALL, 'girlfriend')).length === 0);

// A second test queued alongside the first must not displace it.
const id2 = await enqueueOneShot({ installId: INSTALL, profileId: 'me', dueAt: soon, payload: { title: 'T2' } });
check('4: two queued tests coexist', (await listOneShots()).length === 2 && id2 !== id);
check('4: a queued item with no label gets a default', (await listOneShots()).find(i => i.id === id2).label === 'one-shot');

await removeOneShot(id2);
check('4: removing one leaves the other', (await listOneShots()).length === 1);
check('4: the index entry is removed too, not just the item',
  !(sets.get(QUEUE_KEY)?.has(id2)));
check('4: a queued item expires on its own, so an undelivered test cannot linger forever',
  ttls.get(`push:queue:${id}`) > 0 && ttls.get(`push:queue:${id}`) <= 60 * 60 * 24);

// An item whose record has expired but whose index entry survives must be
// pruned rather than returned as an undeliverable ghost.
db.delete(`push:queue:${id}`);
check('4: an expired queued item is pruned from the index', (await listOneShots()).length === 0);
check('4: the stale index entry is gone', !(sets.get(QUEUE_KEY)?.has(id)));

// ══ 5: the dispatcher run log — proving the scheduler is alive ══════════════
check('5: an empty log reads as empty', (await getCronRuns()).length === 0);
const t0 = new Date(Date.now() - 10 * 60000).toISOString();
const t1 = new Date(Date.now() - 5 * 60000).toISOString();
const t2 = new Date().toISOString();
await recordCronRun(t0);
await recordCronRun(t1);
await recordCronRun(t2);
let runs = await getCronRuns();
check('5: runs are recorded newest first', runs[0] === t2 && runs[1] === t1 && runs[2] === t0);
check('5: three runs are enough to derive a cadence', runs.length === 3);
for (let i = 0; i < 20; i++) await recordCronRun(new Date(Date.now() + i * 1000).toISOString());
runs = await getCronRuns();
check('5: the log is bounded, so it cannot grow without limit', runs.length <= 12, `${runs.length} entries`);
check('5: the log expires, so a long-dead scheduler eventually reads as never run',
  ttls.get(CRON_RUNS_KEY) > 0);

// ══ 6: acceptance is recorded separately from confirmed delivery ═══════════
// A 201 from Apple means the push service took the request. Only the service
// worker reporting back proves the device received anything.
await updateDiagnostics(INSTALL, 'me', {
  lastPushAttempt: new Date().toISOString(),
  lastPushAccepted: new Date().toISOString(),
  lastPushResult: 'accepted',
  lastPushType: 'scheduled-test',
});
let diag = await getDiagnostics(INSTALL, 'me');
check('6: acceptance by the push service is recorded as "accepted", never "delivered"',
  diag.lastPushResult === 'accepted');
check('6: acceptance alone leaves delivery unconfirmed', !diag.lastConfirmedDelivery);
check('6: no confirmations are counted yet', (diag.confirmedCount || 0) === 0);

await recordDelivery(INSTALL, 'me', { label: 'scheduled-test', tag: 'forge-sched-test-1' });
diag = await getDiagnostics(INSTALL, 'me');
check('6: the service worker\'s report is what sets confirmed delivery', !!diag.lastConfirmedDelivery);
check('6: the confirmation records which push it was',
  diag.lastConfirmedLabel === 'scheduled-test' && diag.lastConfirmedTag === 'forge-sched-test-1');
check('6: confirmations are counted', diag.confirmedCount === 1);
await recordDelivery(INSTALL, 'me', { label: 'water' });
diag = await getDiagnostics(INSTALL, 'me');
check('6: a second confirmation increments the count', diag.confirmedCount === 2);
check('6: recording a delivery does not erase the acceptance record', diag.lastPushResult === 'accepted');
check('6: diagnostics are per profile',
  Object.keys(await getDiagnostics(INSTALL, 'girlfriend')).length === 0);

// ══ 7: a failure is recorded as a failure, with a reason ═══════════════════
await updateDiagnostics(INSTALL, 'me', { lastPushResult: 'failed', failureReason: '410 Gone' });
diag = await getDiagnostics(INSTALL, 'me');
check('7: a failed send says so', diag.lastPushResult === 'failed' && diag.failureReason === '410 Gone');
check('7: an earlier confirmation is not wiped by a later failure', diag.confirmedCount === 2);

// ══ 8: no stored health or challenge data ═══════════════════════════════════
const stored = [...db.values()].join(' ');
check('8: only delivery data is stored — no weights, ratings or letters',
  !/weight|rating|letter|reflection/i.test(stored));
check('8: the store was actually exercised, so the assertions above mean something',
  calls > 60, `${calls} commands`);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
