/**
 * Forge's push API, answered in-process by the REAL handlers.
 *
 * A browser test that stubbed /api/push/sync with `{ ok: true }` would prove
 * only that the app sends a request. This routes each call to the actual
 * serverless function, running against an in-memory stand-in for the Upstash
 * REST store — the same stand-in the unit suites use — so what the app is told
 * the server stored is what the server code really did with what it was sent.
 *
 * Every request body is kept in `calls`, which is what lets a privacy test
 * assert that a particular piece of text never left the page at all.
 */

export async function createFakePushApi() {
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

  const { default: sync } = await import('../../api/push/sync.js');
  const { default: unsubscribe } = await import('../../api/push/unsubscribe.js');
  const store = await import('../../api/_lib/store.js');

  const calls = [];
  let failing = false;

  async function invoke(handler, method, body) {
    let status = 200; let json = {};
    const res = { status(c) { status = c; return res; }, json(j) { json = j; return res; } };
    await handler({ method, body, query: {}, headers: {} }, res);
    return { status, json };
  }

  return {
    calls,
    store,
    /** Raw contents of the stand-in store, for "is this text anywhere?" checks. */
    dump: () => JSON.stringify([...db.entries()]),
    /** Make every call fail, as if the phone had no signal. */
    setFailing(v) { failing = !!v; },
    /** Attach to a Playwright page or context. */
    async attach(target) {
      await target.route('**/api/push/**', async (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        let body = {};
        try { body = req.postDataJSON() || {}; } catch { /* GET */ }
        calls.push({ path, method: req.method(), body });
        if (failing) { await route.abort('failed'); return; }
        let out = { status: 200, json: { ok: true } };
        if (path.endsWith('/sync')) out = await invoke(sync, req.method(), body);
        else if (path.endsWith('/unsubscribe')) out = await invoke(unsubscribe, req.method(), body);
        else if (path.endsWith('/status')) out = { status: 200, json: { vapidConfigured: true, storeConfigured: true } };
        await route.fulfill({ status: out.status, contentType: 'application/json', body: JSON.stringify(out.json) });
      });
    },
  };
}
