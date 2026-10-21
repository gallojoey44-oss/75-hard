// GET /api/push/status?installId=&profileId= — diagnostics for the settings
// screen. Reports whether the subscription and schedule are live server-side,
// the synced timezone, the last cron check, and the last push attempt/result.
// Read-only; contains no health/challenge data.

import {
  getSubscriptions, getSchedule, getDiagnostics, kvGet,
  storeConfigured, CRON_LAST_KEY, getCronRuns, pendingOneShots,
} from '../_lib/store.js';
import { vapidConfigured } from '../_lib/push.js';
import { evaluateSchedule, cadenceMinutes, SCHEDULER_STALE_MINUTES } from '../_lib/schedule.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const installId = req.query.installId;
  const profileId = req.query.profileId;

  const base = {
    vapidConfigured: vapidConfigured(),
    storeConfigured: storeConfigured(),
  };

  if (!base.storeConfigured) {
    return res.status(200).json({ ...base, subscriptionActive: false, scheduleSynced: false });
  }
  if (!installId || !['me', 'girlfriend'].includes(profileId)) {
    return res.status(400).json({ error: 'Missing installId/profileId', ...base });
  }

  try {
    const subs = await getSubscriptions(installId, profileId);
    const schedule = await getSchedule(installId, profileId);
    const diag = await getDiagnostics(installId, profileId);
    const cronLast = await kvGet(CRON_LAST_KEY);
    const runs = await getCronRuns();
    const queued = await pendingOneShots(installId, profileId);

    const lastRun = runs[0] || cronLast || null;
    const lastRunAgeMin = lastRun ? Math.round((Date.now() - new Date(lastRun).getTime()) / 60000) : null;
    // The dispatcher is the only thing that sends anything. If it is not
    // running, every other green light is irrelevant — so this is reported as a
    // first-class verdict rather than buried in a timestamp.
    const schedulerLive = lastRunAgeMin != null && lastRunAgeMin <= SCHEDULER_STALE_MINUTES;

    // What the server would do for this schedule RIGHT NOW. This is what makes
    // "why did I get nothing?" answerable: it shows quiet hours, a stale day,
    // or simply nothing being due, instead of leaving the user guessing.
    let evaluation = null;
    if (schedule) {
      try {
        const e = evaluateSchedule(schedule);
        evaluation = {
          localDate: e.localDate,
          localMinutes: e.minutes,
          inQuietHours: e.quiet,
          staleDay: e.staleDay,
          dueNow: e.due.map(d => d.type),
          // On a stale day a reminder only survives if it has fallback copy.
          suppressedByStaleDay: e.staleDay
            ? Object.entries(schedule.reminders || {}).filter(([, v]) => !v?.fallback).map(([k]) => k)
            : [],
        };
      } catch { evaluation = null; }
    }

    return res.status(200).json({
      ...base,
      subscriptionActive: subs.length > 0,
      subscriptionCount: subs.length,
      scheduleSynced: !!schedule,
      timezone: schedule?.timezone || diag.timezone || null,
      scheduledReminderCount: schedule ? Object.keys(schedule.reminders || {}).length : 0,
      scheduleLocalDate: schedule?.localDate || null,
      syncedAt: schedule?.syncedAt || diag.syncedAt || null,

      // ── Scheduler health ──────────────────────────────────────────────────
      schedulerLive,
      schedulerLastRun: lastRun,
      schedulerLastRunAgeMinutes: lastRunAgeMin,
      schedulerCadenceMinutes: cadenceMinutes(runs),
      schedulerRecentRuns: runs.slice(0, 6),
      lastServerCheck: diag.lastCronCheck || null,
      globalCronLastRun: cronLast || null,

      // ── Queued one-shot tests ─────────────────────────────────────────────
      queuedCount: queued.length,
      queuedDueAt: queued[0]?.dueAt || null,
      lastQueuedAt: diag.lastQueuedAt || null,
      lastQueuedDueAt: diag.lastQueuedDueAt || null,

      // ── Push attempts ─────────────────────────────────────────────────────
      // `accepted` means the push SERVICE took it (HTTP 201). It does NOT mean
      // the phone received or displayed anything.
      lastPushAttempt: diag.lastPushAttempt || null,
      lastPushAccepted: diag.lastPushAccepted || null,
      lastPushResult: diag.lastPushResult || null,
      lastPushType: diag.lastPushType || null,
      lastPushWasFallback: diag.lastPushWasFallback ?? null,
      failureReason: diag.failureReason || null,

      // ── Genuine delivery (reported by the service worker on the device) ────
      // This is the only field that proves a push actually arrived.
      lastConfirmedDelivery: diag.lastConfirmedDelivery || null,
      lastConfirmedLabel: diag.lastConfirmedLabel || null,
      confirmedCount: diag.confirmedCount || 0,

      evaluation,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Status failed', detail: String(err?.message || err), ...base });
  }
}
