/**
 * The service worker's push handler — the half of background delivery that
 * runs on the device.
 *
 * Nothing about a push can be proved server-side: the push service returns 201
 * when it ACCEPTS a request, which says nothing about the phone. So the handler
 * has two jobs, and both are tested here by executing the real public/sw.js in
 * a sandbox with stubbed worker globals:
 *
 *   1. always show a notification (iOS can revoke a subscription that receives
 *      a push and displays nothing);
 *   2. report back that the push arrived, which is the only evidence of
 *      delivery that exists anywhere.
 *
 * It also pins two cache rules that silently broke diagnostics: the identity
 * cache must survive activation, and /api/ responses must never be served from
 * cache.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { resolve } from 'node:path';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

// Resolved from the repo root, not from import.meta.url: the runner bundles
// unit suites into a temp directory before executing them.
const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

/** Load sw.js in a sandbox and return handles to its stubbed world. */
function loadSW({ identity = { installId: 'install-abc', profileId: 'me' }, showThrows = false, windows = [] } = {}) {
  const listeners = {};
  const shown = [];
  const posted = [];
  const opened = [];              // URLs handed to clients.openWindow
  const cacheStore = new Map();   // name -> Map(url -> body)
  const deleted = [];

  const fakeCaches = {
    async open(name) {
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      const bucket = cacheStore.get(name);
      return {
        async match(url) {
          if (!bucket.has(url)) return undefined;
          const body = bucket.get(url);
          return { json: async () => JSON.parse(body) };
        },
        async put(url, res) { bucket.set(url, typeof res === 'string' ? res : res.__body); },
        async addAll() {},
      };
    },
    async keys() { return [...cacheStore.keys()]; },
    async delete(name) { deleted.push(name); cacheStore.delete(name); return true; },
    async match() { return undefined; },
  };
  if (identity) cacheStore.set('forge-identity', new Map([['/__forge_identity', JSON.stringify(identity)]]));

  const self = {
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    registration: {
      async showNotification(title, opts) {
        if (showThrows) throw new Error('display blocked');
        shown.push({ title, ...opts });
      },
    },
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url) => { opened.push(url); return {}; },
    },
    location: { origin: 'https://75-hard-v2.vercel.app' },
    skipWaiting: () => {},
  };

  const ctx = createContext({
    self,
    caches: fakeCaches,
    URL,
    URLSearchParams,
    console,
    Response: class { constructor(body) { this.__body = body; } },
    fetch: async (url, init) => { posted.push({ url, init }); return { ok: true, status: 200 }; },
  });
  runInContext(source, ctx);

  /** Fire an event and await whatever the handler passed to waitUntil. */
  async function fire(type, event) {
    const pending = [];
    const ev = { waitUntil: p => pending.push(p), respondWith: p => pending.push(p), ...event };
    for (const fn of listeners[type] || []) fn(ev);
    await Promise.all(pending);
    return ev;
  }

  return { fire, shown, posted, opened, listeners, cacheStore, deleted, ctx };
}

const pushEvent = data => ({ data: { json: () => data, text: () => JSON.stringify(data) } });

// ══ 1: the handlers exist ═══════════════════════════════════════════════════
let sw = loadSW();
check('1: a push handler is registered', (sw.listeners.push || []).length === 1);
check('1: a notificationclick handler is registered', (sw.listeners.notificationclick || []).length === 1);

// ══ 2: a push ALWAYS shows a notification ══════════════════════════════════
// iOS may revoke a subscription that receives a push and displays nothing, so
// there is no "silent push" branch to take.
sw = loadSW();
await sw.fire('push', pushEvent({ title: 'Water', body: 'Drink up', tag: 'forge-water' }));
check('2: the notification is shown', sw.shown.length === 1 && sw.shown[0].title === 'Water');
check('2: the body is passed through', sw.shown[0].body === 'Drink up');
check('2: the tag is passed through', sw.shown[0].tag === 'forge-water');

sw = loadSW();
await sw.fire('push', pushEvent({}));
check('2: an empty payload still shows something rather than nothing',
  sw.shown.length === 1 && sw.shown[0].title.includes('Forge'));

sw = loadSW();
await sw.fire('push', pushEvent({ title: 'T' }));
check('2: a payload with no tag gets a default tag', sw.shown[0].tag === 'forge-push');

// ══ 3: renotify — a test push must actually alert ══════════════════════════
// With a fixed tag and renotify false, a test push silently replaces an older
// notification and looks like it never arrived.
sw = loadSW();
await sw.fire('push', pushEvent({ title: 'T', tag: 'forge-sched-test-123', renotify: true }));
check('3: renotify is honoured when the server asks for it', sw.shown[0].renotify === true);
sw = loadSW();
await sw.fire('push', pushEvent({ title: 'T' }));
check('3: ordinary reminders do not renotify', sw.shown[0].renotify === false);

// ══ 4: delivery confirmation — the only proof a push arrived ═══════════════
sw = loadSW();
await sw.fire('push', pushEvent({
  title: 'T', tag: 'forge-sched-test-123',
  confirm: { label: 'scheduled-test', tag: 'forge-sched-test-123' },
}));
check('4: a push asking for confirmation posts back to the server', sw.posted.length === 1);
check('4: it posts to /api/push/delivered', sw.posted[0]?.url === '/api/push/delivered');
check('4: it is a POST', sw.posted[0]?.init?.method === 'POST');
let body = JSON.parse(sw.posted[0].init.body);
check('4: it identifies the install and profile, so the right record is updated',
  body.installId === 'install-abc' && body.profileId === 'me');
check('4: it reports which push it was', body.label === 'scheduled-test' && body.tag === 'forge-sched-test-123');

sw = loadSW();
await sw.fire('push', pushEvent({ title: 'T', body: 'b' }));
check('4: a push with no confirm request posts nothing', sw.posted.length === 0);

// Without the identity mirror the SW cannot say who received the push. It must
// still display the notification rather than failing.
sw = loadSW({ identity: null });
await sw.fire('push', pushEvent({ title: 'T', confirm: { label: 'scheduled-test' } }));
check('4: with no identity available nothing is posted', sw.posted.length === 0);
check('4: and the notification is shown anyway', sw.shown.length === 1);

// A push that arrived but could not be displayed is still a push that arrived.
sw = loadSW({ showThrows: true });
await sw.fire('push', pushEvent({ title: 'T', confirm: { label: 'scheduled-test' } }));
check('4: receipt is confirmed even when the display fails — that distinction matters',
  sw.posted.length === 1 && sw.shown.length === 0);

// ══ 5: the identity cache must survive activation ══════════════════════════
// It is not a versioned cache. Deleting it on every deploy would silently stop
// delivery confirmation working.
sw = loadSW();
sw.cacheStore.set('75hard-v1-assets', new Map());   // an old version, should go
await sw.fire('activate', {});
check('5: an old versioned cache is cleaned up', sw.deleted.includes('75hard-v1-assets'));
check('5: the identity cache is NOT deleted', !sw.deleted.includes('forge-identity'));
check('5: the identity entry is still readable after activation',
  sw.cacheStore.get('forge-identity')?.has('/__forge_identity'));

// ══ 6: API responses are never served from cache ═══════════════════════════
// /api/push/status is a GET; cached, the diagnostics panel would report a
// scheduler run or a delivery confirmation from minutes ago as current.
function fetchFor(pathname, extra = {}) {
  return {
    request: {
      method: 'GET',
      url: `https://75-hard-v2.vercel.app${pathname}`,
      mode: 'no-cors',
      headers: { get: () => null },
      ...extra,
    },
  };
}
sw = loadSW();
let handled = [];
await (async () => {
  const ev = { ...fetchFor('/api/push/status?installId=x'), respondWith: p => handled.push(p), waitUntil: () => {} };
  for (const fn of sw.listeners.fetch || []) fn(ev);
})();
check('6: a GET to /api/ is not intercepted at all', handled.length === 0);

handled = [];
await (async () => {
  const ev = { ...fetchFor('/assets/index-abc123.js'), respondWith: p => handled.push(p), waitUntil: () => {} };
  for (const fn of sw.listeners.fetch || []) fn(ev);
})();
check('6: ordinary assets are still cached', handled.length === 1);
await Promise.allSettled(handled);

handled = [];
await (async () => {
  const ev = {
    request: { method: 'POST', url: 'https://75-hard-v2.vercel.app/api/push/delivered', headers: { get: () => null } },
    respondWith: p => handled.push(p), waitUntil: () => {},
  };
  for (const fn of sw.listeners.fetch || []) fn(ev);
})();
check('6: the confirmation POST is left alone', handled.length === 0);

// ══ 7: the cache version was bumped with this change ═══════════════════════
check('7: the cache version is a current 75hard-v* string',
  /const CACHE_VER\s*=\s*'75hard-v(\d+)'/.test(source) &&
  Number(source.match(/const CACHE_VER\s*=\s*'75hard-v(\d+)'/)[1]) >= 55,
  source.match(/const CACHE_VER\s*=\s*'([^']+)'/)?.[1]);

// ══ 8: a message from a past self carries its identity through the tap ═════
// A reminder only needs to say which screen to open. A past-self message also
// has to say which message it was, whose it is and the date it was sent for —
// and it has to survive both routes into the app: a message to a window that
// is already open, and the URL of one that has to be launched.
const pastSelfPush = {
  title: 'Forge', body: 'A message from your past self is ready.',
  tag: 'forge-pastself-girlfriend', renotify: true,
  view: 'message', profile: 'girlfriend', date: '2026-11-16', msg: 'm_abc123',
};
sw = loadSW();
await sw.fire('push', pushEvent(pastSelfPush));
const shownData = sw.shown[0]?.data || {};
check('8: the notification keeps the view, message id, profile and date',
  shownData.view === 'message' && shownData.msg === 'm_abc123'
  && shownData.profile === 'girlfriend' && shownData.date === '2026-11-16',
  JSON.stringify(shownData));
check('8: the default private wording is shown exactly as sent',
  sw.shown[0].title === 'Forge' && sw.shown[0].body === 'A message from your past self is ready.');
check('8: nothing but identifiers is kept on the notification — no message text',
  Object.keys(shownData).sort().join() === 'date,msg,profile,view');

sw = loadSW();
await sw.fire('push', pushEvent({ ...pastSelfPush, msg: undefined, extra: 'ignored', profile: 42 }));
check('8: unknown or malformed fields are not carried',
  JSON.stringify(sw.shown[0].data) === JSON.stringify({ view: 'message', date: '2026-11-16' }),
  JSON.stringify(sw.shown[0].data));

sw = loadSW();
await sw.fire('push', pushEvent({ title: 'Water', body: 'Drink up', tag: 'forge-water', view: 'today' }));
check('8: an ordinary reminder still carries only its view',
  JSON.stringify(sw.shown[0].data) === JSON.stringify({ view: 'today' }));

// Tapped with Forge closed: the app is launched at a URL that says everything.
sw = loadSW();
let closed = 0;
await sw.fire('notificationclick', { notification: { close: () => { closed++; }, data: shownData } });
check('8: tapping closes the notification', closed === 1);
check('8: with Forge closed, exactly one window is opened', sw.opened.length === 1);
{
  const u = new URL(sw.opened[0] || '/', 'https://75-hard-v2.vercel.app');
  check('8: the launch URL carries the view, message, profile and date',
    u.pathname === '/' && u.searchParams.get('view') === 'message' && u.searchParams.get('msg') === 'm_abc123'
    && u.searchParams.get('profile') === 'girlfriend' && u.searchParams.get('date') === '2026-11-16',
    sw.opened[0]);
}

// Tapped with Forge open: the existing window is told, focused, and nothing new opens.
{
  const messages = []; let focused = 0;
  const win = { url: 'https://75-hard-v2.vercel.app/', postMessage: m => messages.push(m), focus: async () => { focused++; } };
  sw = loadSW({ windows: [win] });
  await sw.fire('notificationclick', { notification: { close: () => {}, data: shownData } });
  check('8: with Forge open, the open window is messaged once', messages.length === 1);
  check('8: the message carries the view, message id, profile and date',
    messages[0]?.type === 'FORGE_NAVIGATE' && messages[0].view === 'message' && messages[0].msg === 'm_abc123'
    && messages[0].profile === 'girlfriend' && messages[0].date === '2026-11-16', JSON.stringify(messages[0]));
  check('8: the window is focused and no second window is opened', focused === 1 && sw.opened.length === 0);

  // A reminder tap is unchanged by any of this.
  messages.length = 0;
  await sw.fire('notificationclick', { notification: { close: () => {}, data: { view: 'today' } } });
  check('8: a reminder tap still sends just its view',
    JSON.stringify(messages[0]) === JSON.stringify({ type: 'FORGE_NAVIGATE', view: 'today' }), JSON.stringify(messages[0]));
}
sw = loadSW();
await sw.fire('notificationclick', { notification: { close: () => {}, data: { view: 'today' } } });
check('8: a reminder tap with Forge closed opens /?view=today, as before', sw.opened[0] === '/?view=today', sw.opened[0]);
sw = loadSW();
await sw.fire('notificationclick', { notification: { close: () => {}, data: undefined } });
check('8: a notification with no data still opens Today', sw.opened[0] === '/?view=today', sw.opened[0]);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
