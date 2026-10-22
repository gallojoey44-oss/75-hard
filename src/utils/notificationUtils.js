// Notification & reminder system.
//
// Honest capability model:
// - While the app is OPEN, the in-app scheduler shows real notifications via
//   the service worker at the configured times.
// - Delivery while the app is CLOSED requires genuine Web Push from a server.
//   The client is push-ready (permission flow, subscription creation, API
//   calls, SW push/notificationclick handlers); actual background delivery
//   needs the Vercel API routes deployed with VAPID keys (see .env.example).
//   Never claim closed-app delivery works before that is configured.

import { HIGH_VALUE_TASK_IDS, MWD_TASKS, getTaskXP, topIncompleteKeystone } from './gamification';
import { resolveRankState } from './rank';
import { getInstallId, getTimezone } from './installId';
import {
  buildReminderPlan, UNIVERSAL_REMINDERS, PERSONAL_HABITS, CATEGORY,
} from '../data/reminderPlan';
import { reminderPayload, reminderFallbackFor } from '../data/reminderCopy';

// ─── Reminder catalogue ─────────────────────────────────────────────────────
//
// There is no fixed catalogue any more. Which reminders exist depends on the
// user's active challenge and the personal habits they opted into, so the list
// is derived per user by buildReminderPlan (data/reminderPlan.js) and its copy
// by reminderPayload / reminderFallbackFor (data/reminderCopy.js).
//
// The old twelve-entry REMINDER_DEFS list lived here. It offered Reading,
// Workout, Water and Progress-photo reminders to everyone and matched them to
// tasks with name regexes, which meant Forge could remind someone to read when
// they had no reading task at all. Re-exported below are only the pieces other
// modules still need.
export { CATEGORY, CATEGORY_META, UNIVERSAL_REMINDERS, PERSONAL_HABITS, buildReminderPlan } from '../data/reminderPlan';
export { reminderPayload, reminderFallbackFor, reminderPreview } from '../data/reminderCopy';

/**
 * Default notification preferences.
 *
 * `reminders` starts EMPTY on purpose. Which reminders exist depends on the
 * user's challenge, so the catalogue is derived at read time by
 * buildReminderPlan; this map only records decisions the user has actually
 * made. An absent entry means "use the default", which is how a new challenge
 * can bring its own reminders without anything being written first.
 */
export function makeDefaultNotifPrefs() {
  return {
    masterEnabled: false,               // everything OFF until the user enables
    quietHours: { start: '22:30', end: '07:00' },
    reminders: {},
    customHabits: [],
    prefsVersion: 2,
  };
}

// ─── Feature detection / permission ─────────────────────────────────────────

export function getNotificationSupport() {
  const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
  const hasSW   = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasPush = hasSW && typeof window !== 'undefined' && 'PushManager' in window;
  const isIOS = typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  );

  let permission = 'unsupported';
  if (hasNotification && hasSW) {
    permission = Notification.permission; // 'default' | 'granted' | 'denied'
  }

  return {
    supported: hasNotification && hasSW,
    pushSupported: hasPush,
    permission,
    isIOS,
    isStandalone,
    // iOS only allows web notifications from the installed Home Screen app
    iosNeedsInstall: isIOS && !isStandalone,
  };
}

export function permissionLabel(support) {
  if (!support.supported) return 'Unsupported';
  if (support.permission === 'granted') return 'Enabled';
  if (support.permission === 'denied')  return 'Denied';
  return 'Not requested';
}

/** Request permission — must only ever be called from a user gesture. */
export async function requestNotificationPermission() {
  const support = getNotificationSupport();
  if (!support.supported) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// ─── Web Push subscription (backend-ready) ───────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * Create (or reuse) a push subscription and register it with the backend.
 * The VAPID *public* key comes from the build environment — the private key
 * lives only on the server. Returns { ok, reason }.
 */
/**
 * Mirror the install id and active profile into a Cache entry.
 *
 * The service worker cannot read localStorage, so without this it has no way to
 * tell the server WHICH install received a push — and delivery confirmation
 * would be impossible. Written on every subscribe and sync.
 */
export async function publishInstallIdentity(profileId) {
  try {
    const cache = await caches.open('forge-identity');
    await cache.put('/__forge_identity', new Response(
      JSON.stringify({ installId: getInstallId(), profileId }),
      { headers: { 'Content-Type': 'application/json' } },
    ));
    return true;
  } catch {
    return false;
  }
}

export async function subscribeToPush(profileId) {
  const support = getNotificationSupport();
  if (!support.pushSupported) return { ok: false, reason: 'push-unsupported' };
  if (support.permission !== 'granted') return { ok: false, reason: 'no-permission' };

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, reason: 'no-vapid-key' }; // push service not configured yet

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: getInstallId(), profileId, subscription: sub.toJSON() }),
    });
    await publishInstallIdentity(profileId);
    return { ok: res.ok, reason: res.ok ? null : 'server-error' };
  } catch {
    return { ok: false, reason: 'subscribe-failed' };
  }
}

export async function unsubscribeFromPush(profileId) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId: getInstallId(), profileId, endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ─── Server-side schedule sync + background test + diagnostics ───────────────

/**
 * Sync the minimal reminder-scheduling data to the server so it can deliver
 * background reminders while the app is closed. The app pre-renders each
 * enabled background-capable reminder's copy at its CURRENT (fresh) state via
 * buildReminder, so the server never fabricates dynamic values. Only time-based
 * reminders are synced; event-based ones stay app-active-only.
 *
 * Returns { ok, reason }.
 */
export async function syncPushSchedule(profileId, prefs, ctx, todayStr) {
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' };
  try {
    publishInstallIdentity(profileId);
    const reminders = {};
    if (prefs?.masterEnabled) {
      const plan = buildReminderPlan(prefs, ctx);
      // `deliverable` is already filtered: disabled reminders are out, and a
      // personal habit the challenge covers is out, so a shared habit can
      // never produce two notifications.
      for (const r of plan.deliverable) {
        reminders[r.id] = {
          time: r.time,
          // Rendered from today's real state. null means "nothing to say" —
          // the task is done, or the reminder does not apply — and the server
          // then has only the fallback to work with.
          payload: reminderPayload(r, ctx),
          // Date-independent copy the server uses when its snapshot is stale,
          // so a background reminder never claims something is incomplete on
          // yesterday's information.
          fallback: reminderFallbackFor(r),
        };
      }
    }
    const res = await fetch('/api/push/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installId: getInstallId(),
        profileId,
        timezone: getTimezone(),
        localDate: todayStr,
        masterEnabled: !!prefs?.masterEnabled,
        quietHours: prefs?.quietHours || { start: '22:30', end: '07:00' },
        reminders,
      }),
    });
    return { ok: res.ok, reason: res.ok ? null : 'server-error' };
  } catch {
    return { ok: false, reason: 'sync-failed' };
  }
}

/** Trigger a real server-originated push to this install/profile's stored subs. */
export async function backgroundTestPush(profileId) {
  try {
    const res = await fetch('/api/push/test-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: getInstallId(), profileId }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  } catch {
    return { ok: false, reason: 'request-failed' };
  }
}

/**
 * Queue a REAL server-sent push for a few minutes' time.
 *
 * This is the only test that proves background delivery: the app can be closed
 * and the phone locked before it fires, because the send originates on the
 * server with no client involvement at all.
 */
export async function scheduledTestPush(profileId, delayMinutes = 3) {
  try {
    await publishInstallIdentity(profileId);
    const res = await fetch('/api/push/test-scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: getInstallId(), profileId, delayMinutes }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  } catch {
    return { ok: false, reason: 'request-failed' };
  }
}

/**
 * True when the app is running as an installed PWA.
 *
 * iOS only grants the Push API to a web app added to the Home Screen. In Safari
 * proper, `Notification.permission` can read "granted" and local notifications
 * can work while `pushManager.subscribe()` is unavailable — which is exactly
 * the state that makes a local test pass and real push silently impossible.
 */
export function isInstalledPWA() {
  try {
    if (typeof window === 'undefined') return false;
    return !!(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone);
  } catch {
    return false;
  }
}

/** True for iOS/iPadOS, where installation is a hard requirement for push. */
export function isIOS() {
  try {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}

/**
 * Whether a genuine Push API subscription exists for this installation right
 * now — read from the browser, not from our own server records.
 */
export async function localSubscriptionState() {
  const out = { pushSupported: false, hasSubscription: false, endpointHost: null, installed: isInstalledPWA(), ios: isIOS() };
  try {
    const support = getNotificationSupport();
    out.pushSupported = support.pushSupported;
    out.permission = support.permission;
    if (!support.pushSupported) return out;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    out.hasSubscription = !!sub;
    if (sub?.endpoint) {
      try { out.endpointHost = new URL(sub.endpoint).host; } catch { out.endpointHost = 'unknown'; }
    }
    return out;
  } catch {
    return out;
  }
}

/** Read the server-side push diagnostics for this install/profile. */
export async function getPushStatus(profileId) {
  try {
    const params = new URLSearchParams({ installId: getInstallId(), profileId });
    const res = await fetch(`/api/push/status?${params.toString()}`);
    if (!res.ok && res.status !== 400) return { ok: false, status: res.status };
    const data = await res.json().catch(() => ({}));
    return { ok: true, ...data };
  } catch {
    return { ok: false, reason: 'request-failed' };
  }
}

// ─── Showing notifications (via service worker, with tags) ──────────────────

export async function showNotification({ title, body, tag, view = 'today' }) {
  const support = getNotificationSupport();
  if (!support.supported || support.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag,                      // duplicates replace instead of stacking
      renotify: false,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { view },
    });
    return true;
  } catch {
    return false;
  }
}

export async function showTestNotification(profileName) {
  return showNotification({
    title: '⚔️ Forge test notification',
    body: `Notifications are working for ${profileName}. This is how reminders will look.`,
    tag: 'forge-test',
    view: 'settings',
  });
}

// ─── Quiet hours ─────────────────────────────────────────────────────────────

export function inQuietHours(quietHours, now = new Date()) {
  if (!quietHours?.start || !quietHours?.end) return false;
  return timeInQuietHours(quietHours, now.getHours() * 60 + now.getMinutes());
}

/**
 * Whether a minutes-since-midnight value falls inside the quiet window.
 *
 * Used to warn the user when a reminder's own time sits inside quiet hours —
 * that reminder can never be delivered, and without the warning it looks
 * exactly like a broken push pipeline.
 */
export function timeInQuietHours(quietHours, mins) {
  if (!quietHours?.start || !quietHours?.end || !Number.isFinite(mins)) return false;
  const [sh, sm] = quietHours.start.split(':').map(Number);
  const [eh, em] = quietHours.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end   = eh * 60 + em;
  // Window may cross midnight (default 22:30 → 07:00)
  return start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end);
}

/** Minutes since midnight for an 'HH:MM' string, or NaN. */
export function minutesOf(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
}

// ─── In-app scheduler bookkeeping (fires only while the app is open) ────────

const LOG_KEY = 'notifLog';

function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch { return {}; }
}

export function alreadyFiredToday(profileId, type, todayStr) {
  const log = loadLog();
  return !!log?.[profileId]?.[todayStr]?.[type];
}

export function markFired(profileId, type, todayStr) {
  const log = loadLog();
  // keep only today's entries per profile so the log never grows
  log[profileId] = { [todayStr]: { ...(log[profileId]?.[todayStr] || {}), [type]: true } };
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch {}
}

function timeReached(timeStr, now = new Date()) {
  if (!timeStr) return false;
  const [h, m] = timeStr.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= h * 60 + m;
}

/**
 * Evaluate which reminders are due right now. Fires each at most once per day
 * (per profile), respects quiet hours, and applies every content guard in
 * buildReminder. Event-based reminders (oneTaskLeft, milestone) are evaluated
 * continuously; time-based ones after their configured time.
 */
export function getDueReminders(prefs, ctx, todayStr, now = new Date()) {
  if (!prefs?.masterEnabled) return [];
  if (inQuietHours(prefs.quietHours, now)) return [];
  const plan = buildReminderPlan(prefs, ctx);
  const due = [];
  for (const r of plan.deliverable) {
    if (!timeReached(r.time, now)) continue;
    if (alreadyFiredToday(ctx.profileId, r.id, todayStr)) continue;
    // Null means the reminder does not apply right now — the task is already
    // done, or there is nothing to log. Not an error; just nothing to send.
    const content = reminderPayload(r, ctx);
    if (content) due.push({ type: r.id, ...content });
  }
  return due;
}

// ─── Preferences migration ──────────────────────────────────────────────────

/**
 * Bring v1 notification preferences onto the derived reminder plan.
 *
 * v1 stored twelve fixed reminder ids (morning, workout, water, reading,
 * photo, evening, sleep, streak, oneTaskLeft, comeback, insights, milestone),
 * each with {enabled, time}. v2 stores decisions only, against plan ids.
 *
 * THE RULE: a migration may carry a decision forward, and may turn something
 * OFF, but must never turn anything ON that the user had not already enabled.
 * Every v1 default was off, so anything enabled was a deliberate choice and is
 * honoured; everything else is simply dropped and falls back to the new
 * defaults — which, with no stored entries at all, is morning + evening + the
 * single top keystone habit.
 *
 * Idempotent: runs once per profile and marks itself with prefsVersion.
 */
const V1_TO_V2 = {
  morning: 'u_morning',
  evening: 'u_evening',
  // Topic reminders become the equivalent OPT-IN personal habit. If the user's
  // challenge covers the same habit, the plan supersedes it automatically and
  // they still get only one notification.
  reading: 'p_reading',
  workout: 'p_workout',
  water:   'p_hydration',
};

export function migrateNotifPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return makeDefaultNotifPrefs();
  if (prefs.prefsVersion >= 2) return prefs;

  const old = prefs.reminders || {};
  const reminders = {};
  for (const [v1id, v2id] of Object.entries(V1_TO_V2)) {
    const entry = old[v1id];
    if (!entry) continue;
    // Only an explicitly ENABLED v1 reminder carries over as enabled. A
    // disabled one carries its time but stays off, so nothing new starts
    // firing because of an upgrade.
    reminders[v2id] = { enabled: !!entry.enabled, time: entry.time || undefined };
    if (!reminders[v2id].time) delete reminders[v2id].time;
  }
  return {
    masterEnabled: !!prefs.masterEnabled,
    quietHours: prefs.quietHours || { start: '22:30', end: '07:00' },
    reminders,
    customHabits: Array.isArray(prefs.customHabits) ? prefs.customHabits : [],
    prefsVersion: 2,
  };
}

/** Migrate every profile's preferences. Safe to call on every load. */
export function migrateAllNotifPrefs(stored) {
  const out = { ...(stored || {}) };
  for (const profId of ['me', 'girlfriend']) {
    out[profId] = migrateNotifPrefs(out[profId]);
  }
  return out;
}
