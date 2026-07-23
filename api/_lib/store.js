// Persistent store for push subscriptions and reminder schedules.
//
// Backed by a Redis-compatible REST API (Vercel KV or Upstash Redis — both
// expose the same Upstash REST protocol). No extra npm dependency: we speak
// the REST protocol directly over fetch.
//
// Env vars (Vercel KV injects the KV_* pair automatically when you attach a KV
// store; Upstash uses the UPSTASH_* pair). Either works:
//   KV_REST_API_URL / KV_REST_API_TOKEN
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//
// Privacy: only notification-delivery data is stored here — push endpoints,
// encryption keys, timezone, quiet hours, reminder times, and pre-rendered
// reminder copy. No health logs, challenge entries, weights, ratings, or
// Future Self letters ever reach the server.

// Read at call time so serverless cold starts always see current env, and so
// tests can configure the store before exercising it.
function restUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
}
function restToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
}

export function storeConfigured() {
  return !!(restUrl() && restToken());
}

// Execute a single Redis command via the Upstash REST protocol.
async function cmd(args) {
  if (!storeConfigured()) throw new Error('store-not-configured');
  const res = await fetch(restUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${restToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`store-error ${res.status} ${text}`.trim());
  }
  const json = await res.json();
  return json.result;
}

// ── Primitive helpers ────────────────────────────────────────────────────────

export async function kvSet(key, value) {
  return cmd(['SET', key, JSON.stringify(value)]);
}
export async function kvSetEx(key, value, ttlSeconds) {
  return cmd(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]);
}
export async function kvGet(key) {
  const v = await cmd(['GET', key]);
  if (v == null) return null;
  try { return JSON.parse(v); } catch { return v; }
}
export async function kvDel(key) {
  return cmd(['DEL', key]);
}
export async function kvExists(key) {
  return (await cmd(['EXISTS', key])) === 1;
}
export async function kvExpire(key, ttlSeconds) {
  return cmd(['EXPIRE', key, String(ttlSeconds)]);
}
export async function kvSAdd(key, member) {
  return cmd(['SADD', key, member]);
}
export async function kvSRem(key, member) {
  return cmd(['SREM', key, member]);
}
export async function kvSMembers(key) {
  return (await cmd(['SMEMBERS', key])) || [];
}

// ── Key builders ─────────────────────────────────────────────────────────────

const SUB_TTL = 60 * 60 * 24 * 60;   // 60 days — refreshed on every sync/subscribe
const SENT_TTL = 60 * 60 * 36;       // 36 hours — idempotency window per local day

// A push endpoint is long; use it directly as the key suffix (Redis keys can be
// large). We base64url the endpoint to keep the key clean.
function endpointKey(endpoint) {
  return `push:sub:${Buffer.from(endpoint).toString('base64url')}`;
}
function subsIndexKey(installId, profileId) {
  return `push:subs:${installId}:${profileId}`;
}
function schedKey(installId, profileId) {
  return `push:sched:${installId}:${profileId}`;
}
function diagKey(installId, profileId) {
  return `push:diag:${installId}:${profileId}`;
}
function sentKey(installId, profileId, type, localDate) {
  return `push:sent:${installId}:${profileId}:${type}:${localDate}`;
}

export const INDEX_KEY = 'push:index';       // set of "installId:profileId" with schedules
export const CRON_LAST_KEY = 'push:cron:last';

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function saveSubscription(installId, profileId, subscription) {
  const key = endpointKey(subscription.endpoint);
  await kvSetEx(key, { subscription, installId, profileId, updatedAt: new Date().toISOString() }, SUB_TTL);
  await kvSAdd(subsIndexKey(installId, profileId), subscription.endpoint);
  await kvExpire(subsIndexKey(installId, profileId), SUB_TTL);
}

export async function getSubscriptions(installId, profileId) {
  const endpoints = await kvSMembers(subsIndexKey(installId, profileId));
  const out = [];
  for (const endpoint of endpoints) {
    const rec = await kvGet(endpointKey(endpoint));
    if (rec?.subscription) out.push(rec.subscription);
    else await kvSRem(subsIndexKey(installId, profileId), endpoint); // prune dangling index entry
  }
  return out;
}

export async function removeSubscription(installId, profileId, endpoint) {
  await kvDel(endpointKey(endpoint));
  await kvSRem(subsIndexKey(installId, profileId), endpoint);
}

// Remove a subscription that the push service reported as gone (404/410).
export async function removeSubscriptionByEndpoint(endpoint) {
  const rec = await kvGet(endpointKey(endpoint));
  await kvDel(endpointKey(endpoint));
  if (rec?.installId && rec?.profileId) {
    await kvSRem(subsIndexKey(rec.installId, rec.profileId), endpoint);
  }
}

// ── Reminder schedule (minimal scheduling data only) ────────────────────────

export async function saveSchedule(installId, profileId, schedule) {
  await kvSetEx(schedKey(installId, profileId), schedule, SUB_TTL);
  await kvSAdd(INDEX_KEY, `${installId}:${profileId}`);
}

export async function getSchedule(installId, profileId) {
  return kvGet(schedKey(installId, profileId));
}

export async function getAllScheduleIds() {
  return kvSMembers(INDEX_KEY);
}

export async function removeSchedule(installId, profileId) {
  await kvDel(schedKey(installId, profileId));
  await kvSRem(INDEX_KEY, `${installId}:${profileId}`);
}

// ── Idempotency (one send per install/profile/type/local-date) ──────────────

export async function alreadySent(installId, profileId, type, localDate) {
  return kvExists(sentKey(installId, profileId, type, localDate));
}
export async function markSent(installId, profileId, type, localDate) {
  return kvSetEx(sentKey(installId, profileId, type, localDate), 1, SENT_TTL);
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

export async function getDiagnostics(installId, profileId) {
  return (await kvGet(diagKey(installId, profileId))) || {};
}
export async function updateDiagnostics(installId, profileId, patch) {
  const cur = (await kvGet(diagKey(installId, profileId))) || {};
  await kvSetEx(diagKey(installId, profileId), { ...cur, ...patch }, SUB_TTL);
}
