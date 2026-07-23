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

import { HIGH_VALUE_TASK_IDS, MWD_TASKS, getRankInfo, getTaskXP, topIncompleteKeystone } from './gamification';
import { getInstallId, getTimezone } from './installId';

// A keystone task's display name without its duration suffix ("Mental
// Training — 10 min…" → "Mental Training").
function keystoneName(task) {
  return task ? task.name.replace(/\s+—.*$/, '') : '';
}

// ─── Reminder catalog ────────────────────────────────────────────────────────

export const REMINDER_DEFS = [
  { id: 'morning',     label: 'Morning Daily Mission',          hasTime: true,  defaultTime: '08:00' },
  { id: 'workout',     label: 'Workout reminder',               hasTime: true,  defaultTime: '16:00' },
  { id: 'water',       label: 'Water reminder',                 hasTime: true,  defaultTime: '14:00' },
  { id: 'reading',     label: 'Reading reminder',               hasTime: true,  defaultTime: '19:00' },
  { id: 'photo',       label: 'Progress photo reminder',        hasTime: true,  defaultTime: '20:30' },
  { id: 'evening',     label: 'Evening remaining-tasks reminder', hasTime: true, defaultTime: '20:00' },
  { id: 'sleep',       label: 'Sleep / wind-down reminder',     hasTime: true,  defaultTime: '21:30' },
  { id: 'streak',      label: 'Streak warning',                 hasTime: true,  defaultTime: '21:00' },
  { id: 'oneTaskLeft', label: 'One-task-left alert',            hasTime: false },
  { id: 'comeback',    label: 'Comeback reminder',              hasTime: true,  defaultTime: '10:00' },
  { id: 'insights',    label: 'Insights recommendation alert',  hasTime: true,  defaultTime: '12:00' },
  { id: 'milestone',   label: 'Rank / XP milestone alert',      hasTime: false },
];

// Background-delivery capability.
//
// Time-based reminders (hasTime) can be delivered by the server while the app
// is closed: the app pre-renders each one's copy at its current (fresh) state
// and syncs it, so the server never fabricates values. Event-based reminders
// fire the instant a live local condition becomes true and have no scheduled
// time, so they remain app-active-only (the server would have to invent the
// triggering state). This is the honest line between the two tiers.
export function isBackgroundReminder(type) {
  const def = REMINDER_DEFS.find(d => d.id === type);
  return !!def?.hasTime;
}

export const BACKGROUND_REMINDER_IDS = REMINDER_DEFS.filter(d => d.hasTime).map(d => d.id);
export const APP_ACTIVE_ONLY_IDS = REMINDER_DEFS.filter(d => !d.hasTime).map(d => d.id);

export function makeDefaultNotifPrefs() {
  const reminders = {};
  for (const def of REMINDER_DEFS) {
    reminders[def.id] = { enabled: false, time: def.defaultTime || null };
  }
  return {
    masterEnabled: false,               // everything OFF until the user enables
    quietHours: { start: '22:30', end: '07:00' },
    reminders,
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
    const reminders = {};
    if (prefs?.masterEnabled) {
      for (const def of REMINDER_DEFS) {
        if (!def.hasTime) continue;                       // background-capable only
        const setting = prefs.reminders?.[def.id];
        if (!setting?.enabled) continue;
        const payload = buildReminder(def.id, ctx);       // null when not applicable
        reminders[def.id] = { time: setting.time || def.defaultTime, payload };
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
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = quietHours.start.split(':').map(Number);
  const [eh, em] = quietHours.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end   = eh * 60 + em;
  // Window may cross midnight (default 22:30 → 07:00)
  return start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end);
}

// ─── Content builder (mirrors what the future push backend will send) ───────

function taskXP(task) {
  return HIGH_VALUE_TASK_IDS.has(task.id) ? 15 : 10;
}

function findTaskByTopic(tasks, topic) {
  const patterns = {
    workout: /workout|training|lift|discipline block|movement/i,
    water:   /water/i,
    reading: /read/i,
    photo:   /photo/i,
  };
  const re = patterns[topic];
  return re ? tasks.find(t => re.test(t.name)) : null;
}

/**
 * Build the notification for a reminder type given today's context, or null
 * when the reminder should NOT fire (task done, day complete, etc.).
 *
 * ctx: { profileId, tasks, dayData, isMWD, comebackActive, hasSetback,
 *        challengeName, lifetimeXP, challengeXP, bottleneckLabel }
 */
export function buildReminder(type, ctx) {
  const tasks = ctx.tasks || [];
  const done = new Set(tasks.filter(t => ctx.dayData?.tasks?.[t.id]).map(t => t.id));
  const remainingTasks = tasks.filter(t => !done.has(t.id));
  const mwdRemaining = MWD_TASKS.filter(t => !ctx.dayData?.mwdTasks?.[t.id]);
  const remaining = ctx.isMWD ? mwdRemaining.length : remainingTasks.length;
  const dayComplete = ctx.isMWD ? mwdRemaining.length === 0 : (tasks.length > 0 && remainingTasks.length === 0);
  const tag = (t) => `forge-${ctx.profileId}-${t}`;
  // Keystone habits are prioritized in reminders when present and unfinished.
  const keystone = topIncompleteKeystone(tasks, ctx.dayData);

  switch (type) {
    case 'morning': {
      if (dayComplete) return null;
      // Lead with the keystone habit when the challenge has one.
      if (keystone) {
        return {
          title: '⚔️ Your most important task remains unfinished.',
          body: `${keystoneName(keystone)} — ${getTaskXP(keystone)} XP.`,
          tag: tag('morning'), view: 'today',
        };
      }
      const availableXP = tasks.reduce((s, t) => s + taskXP(t), 0) + 50 + 15 + 10;
      return {
        title: '⚔️ Daily Mission',
        body: `Complete today's ${ctx.challengeName || 'challenge'} and earn up to ${availableXP} XP.`,
        tag: tag('morning'), view: 'today',
      };
    }
    case 'workout': case 'water': case 'reading': case 'photo': {
      const task = findTaskByTopic(tasks, type);
      if (!task || done.has(task.id)) return null; // never remind about a finished task
      const titles = {
        workout: '🏋️ Training Quest',
        water:   '💧 Hydration check',
        reading: '📚 Reading time',
        photo:   '📸 Progress photo',
      };
      const bodies = {
        workout: `Your workout task is still waiting. +${taskXP(task)} XP.`,
        water:   `"${task.name}" is still open. +${taskXP(task)} XP.`,
        reading: `"${task.name}" is still open. +${taskXP(task)} XP.`,
        photo:   `Future you will want this photo. +${taskXP(task)} XP.`,
      };
      return { title: titles[type], body: bodies[type], tag: tag(type), view: 'today' };
    }
    case 'evening': {
      if (dayComplete || remaining === 0) return null;
      // A more urgent keystone push in the evening — still encouraging.
      if (keystone && !ctx.isMWD) {
        return {
          title: '🔥 Your challenge is at risk.',
          body: `Complete your ${keystoneName(keystone)} today. You've still got time.`,
          tag: tag('evening'), view: 'today',
        };
      }
      const body = ctx.isMWD
        ? `Minimum Warrior Day: ${remaining} small ${remaining === 1 ? 'task' : 'tasks'} left. The floor holds.`
        : `${remaining} ${remaining === 1 ? 'task' : 'tasks'} left today. Still time to close it out.`;
      return { title: '🌆 Evening check-in', body, tag: tag('evening'), view: 'today' };
    }
    case 'sleep': {
      return {
        title: '🌙 Begin your wind-down',
        body: "Protect tomorrow's energy by starting your sleep routine.",
        tag: tag('sleep'), view: 'today',
      };
    }
    case 'streak': {
      if (dayComplete) return null; // never warn when the day is already done
      const body = ctx.isMWD
        ? `MWD active: ${remaining} ${remaining === 1 ? 'task' : 'tasks'} to keep the chain alive.`
        : `You still have ${remaining} ${remaining === 1 ? 'task' : 'tasks'} remaining.`;
      return { title: '🔥 Defend your streak', body, tag: tag('streak'), view: 'today' };
    }
    case 'oneTaskLeft': {
      if (dayComplete || remaining !== 1) return null; // exactly one required task
      return {
        title: '🛡️ One task left',
        body: 'Finish the final task to complete the day.',
        tag: tag('oneTaskLeft'), view: 'today',
      };
    }
    case 'comeback': {
      if (!ctx.comebackActive && !ctx.hasSetback) return null;
      return {
        title: '⚔️ Return to the path',
        body: 'A setback is not an identity. Complete one task today.',
        tag: tag('comeback'), view: 'today',
      };
    }
    case 'insights': {
      if (!ctx.bottleneckLabel) return null;
      return {
        title: '🔎 Forge noticed a pattern',
        body: `${ctx.bottleneckLabel}. A recommended task is ready.`,
        tag: tag('insights'), view: 'insights',
      };
    }
    case 'milestone': {
      const rankInfo = getRankInfo(ctx.lifetimeXP || 0);
      if (!rankInfo.next) return null;
      const toNext = rankInfo.next.minXP - rankInfo.xp;
      if (toNext > 150) return null; // only when a rank-up is genuinely close
      return {
        title: `🏆 ${toNext.toLocaleString()} XP to ${rankInfo.next.name}`,
        body: 'Rank is earned through repeated proof.',
        tag: tag('milestone'), view: 'home',
      };
    }
    default:
      return null;
  }
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
  const due = [];
  for (const def of REMINDER_DEFS) {
    const setting = prefs.reminders?.[def.id];
    if (!setting?.enabled) continue;
    if (def.hasTime && !timeReached(setting.time || def.defaultTime, now)) continue;
    if (alreadyFiredToday(ctx.profileId, def.id, todayStr)) continue;
    const content = buildReminder(def.id, ctx);
    if (content) due.push({ type: def.id, ...content });
  }
  return due;
}
