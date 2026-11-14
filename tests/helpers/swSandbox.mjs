/**
 * The real public/sw.js, executed in a sandbox with stubbed worker globals.
 *
 * A service worker cannot be unit-tested in place: it only runs inside a
 * browser's worker scope, and no browser automation can tap a notification.
 * So the file itself is loaded here, unmodified, into a vm context whose
 * `self`, `caches`, `clients` and `fetch` are recording stand-ins. Whatever a
 * test observes is what the shipped worker did.
 *
 * Used by the service-worker unit suite, and by the browser suites that need
 * to know exactly what a tapped notification hands back to the app.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { resolve } from 'node:path';

// Resolved from the repo root, not from import.meta.url: the runner bundles
// unit suites into a temp directory before executing them.
export const swSource = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

/** Load sw.js in a sandbox and return handles to its stubbed world. */
export function loadSW({ identity = { installId: 'install-abc', profileId: 'me' }, showThrows = false, windows = [], origin = 'https://75-hard-v2.vercel.app' } = {}) {
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
    location: { origin },
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
  runInContext(swSource, ctx);

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


/** A push event carrying `data`, shaped the way the worker reads it. */
export const pushEvent = data => ({ data: { json: () => data, text: () => JSON.stringify(data) } });
