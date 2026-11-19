/**
 * Forge's push backend, run in-process by the REAL handlers.
 *
 * A browser test that stubbed /api/push/sync with `{ ok: true }` would prove
 * only that the app sends a request. This routes each call to the actual
 * serverless function, running against an in-memory stand-in for the Upstash
 * REST store — the same stand-in the unit suites use — so what the app is told
 * the server stored is what the server code really did with what it was sent.
 *
 * It goes one step further for delivery. The real scheduled dispatcher
 * (api/cron/dispatch.js) is run against that store, and it sends through the
 * real web-push library: real VAPID signing, real payload encryption for the
 * subscription's keys. Only the last hop is replaced — the HTTPS request to the
 * browser vendor's push service is caught before it leaves the process — and
 * the captured body is then DECRYPTED with the subscription's private key, the
 * way the phone would. What a test reads from `pushed` is therefore exactly
 * what would have appeared on a device, not what some layer intended to send.
 *
 * Every request body the app made is kept in `calls`, which is what lets a
 * privacy test assert that a particular piece of text never left the page.
 */
import https from 'node:https';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const PUSH_HOST = 'push.forge.test';
const CRON_SECRET = 'forge-test-cron-secret';
const b64 = (buf) => Buffer.from(buf).toString('base64url');

export async function createFakePushApi() {
  // ── The store ────────────────────────────────────────────────────────────
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

  // The handlers read the store location from the environment and speak to it
  // with fetch, so pointing both at the stand-in is all the wiring there is.
  const KV_URL = 'https://fake-kv.test';
  process.env.KV_REST_API_URL = KV_URL;
  process.env.KV_REST_API_TOKEN = 'fake-token';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) === KV_URL) {
      return { ok: true, status: 200, json: async () => ({ result: run(JSON.parse(init.body)) }) };
    }
    return realFetch(url, init);
  };

  // ── The push service ─────────────────────────────────────────────────────
  // Real keys, made fresh for this run. The dispatcher refuses to run without
  // a secret, exactly as in production.
  const { default: webpush } = await import('web-push');
  const { default: ece } = await import('http_ece');
  const vapid = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:tests@forge.test';
  process.env.CRON_SECRET = CRON_SECRET;

  const devices = new Map();     // endpoint → { name, ecdh, auth }
  const pushed = [];             // every push the service was asked to deliver
  let respondWith = () => 201;   // (endpoint, attempt#) → HTTP status

  const realRequest = https.request;
  https.request = (opts, cb) => {
    if (opts?.hostname !== PUSH_HOST) return realRequest(opts, cb);
    const chunks = [];
    const req = new EventEmitter();
    req.write = (c) => { chunks.push(Buffer.from(c)); };
    req.end = () => {
      const endpoint = `https://${PUSH_HOST}${opts.path}`;
      const device = devices.get(endpoint);
      const status = respondWith(endpoint, pushed.filter(p => p.endpoint === endpoint).length);
      let payload = null; let raw = null;
      try {
        raw = ece.decrypt(Buffer.concat(chunks), { version: 'aes128gcm', privateKey: device.ecdh, authSecret: b64(device.auth) }).toString('utf8');
        payload = JSON.parse(raw);
      } catch (err) {
        payload = { __undecryptable: String(err?.message || err) };
      }
      pushed.push({
        endpoint, device: device?.name || null, status, payload, raw,
        accepted: status >= 200 && status < 300,
        signed: /^vapid t=/.test(String(opts.headers?.Authorization || '')),
      });
      const res = new EventEmitter();
      res.statusCode = status;
      res.headers = {};
      queueMicrotask(() => { cb(res); res.emit('data', ''); res.emit('end'); });
    };
    return req;
  };

  const { default: sync } = await import('../../api/push/sync.js');
  const { default: subscribe } = await import('../../api/push/subscribe.js');
  const { default: unsubscribe } = await import('../../api/push/unsubscribe.js');
  const { default: status } = await import('../../api/push/status.js');
  const { default: dispatch } = await import('../../api/cron/dispatch.js');
  const store = await import('../../api/_lib/store.js');

  const calls = [];
  let failing = false;

  async function invoke(handler, method, body, { query = {}, headers = {} } = {}) {
    let code = 200; let json = {};
    const res = { status(c) { code = c; return res; }, json(j) { json = j; return res; } };
    await handler({ method, body, query, headers }, res);
    return { status: code, json };
  }

  return {
    calls,
    pushed,
    store,
    vapidPublicKey: vapid.publicKey,

    /** Raw contents of the stand-in store, for "is this text anywhere?" checks. */
    dump: () => JSON.stringify([[...db.entries()], [...sets.entries()].map(([k, v]) => [k, [...v]])]),
    /** One stored value, parsed. */
    get(key) { const v = db.get(key); try { return v == null ? null : JSON.parse(v); } catch { return v; } },
    keys: () => [...db.keys()],

    /** Make every app → server call fail, as if the phone had no signal. */
    setFailing(v) { failing = !!v; },

    /**
     * A device's push subscription: an endpoint at the stand-in push service
     * and a real P-256 key pair, the private half of which is kept here so the
     * test can read what that device would have been shown.
     */
    newDevice(name = 'phone') {
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.generateKeys();
      const auth = crypto.randomBytes(16);
      const endpoint = `https://${PUSH_HOST}/send/${name}-${crypto.randomBytes(6).toString('hex')}`;
      devices.set(endpoint, { name, ecdh, auth });
      return { endpoint, expirationTime: null, keys: { p256dh: b64(ecdh.getPublicKey()), auth: b64(auth) } };
    },

    /** How the push service answers: (endpoint, attemptIndex) → HTTP status. */
    setPushResponse(fn) { respondWith = fn || (() => 201); },

    /** Run the real scheduled dispatcher once, authorised the way the cron is. */
    async runCron(query = {}) {
      const out = await invoke(dispatch, 'GET', undefined, { query, headers: { authorization: `Bearer ${CRON_SECRET}` } });
      return { status: out.status, ...out.json };
    },

    /** Attach to a Playwright page or context. */
    async attach(target) {
      await target.route('**/api/push/**', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const path = url.pathname;
        let body = {};
        try { body = req.postDataJSON() || {}; } catch { /* GET */ }
        calls.push({ path, method: req.method(), body });
        if (failing) { await route.abort('failed'); return; }
        const query = Object.fromEntries(url.searchParams);
        let out = { status: 200, json: { ok: true } };
        if (path.endsWith('/sync')) out = await invoke(sync, req.method(), body);
        else if (path.endsWith('/subscribe')) out = await invoke(subscribe, req.method(), body);
        else if (path.endsWith('/unsubscribe')) out = await invoke(unsubscribe, req.method(), body);
        else if (path.endsWith('/status')) out = await invoke(status, req.method(), body, { query });
        await route.fulfill({ status: out.status, contentType: 'application/json', body: JSON.stringify(out.json) });
      });
    },

    /** Put the process back the way it was found. */
    restore() {
      https.request = realRequest;
      globalThis.fetch = realFetch;
    },
  };
}
