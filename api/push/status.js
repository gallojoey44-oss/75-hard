// GET /api/push/status?installId=&profileId= — diagnostics for the settings
// screen. Reports whether the subscription and schedule are live server-side,
// the synced timezone, the last cron check, and the last push attempt/result.
// Read-only; contains no health/challenge data.

import {
  getSubscriptions, getSchedule, getDiagnostics, kvGet,
  storeConfigured, CRON_LAST_KEY,
} from '../_lib/store.js';
import { vapidConfigured } from '../_lib/push.js';

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

    return res.status(200).json({
      ...base,
      subscriptionActive: subs.length > 0,
      subscriptionCount: subs.length,
      scheduleSynced: !!schedule,
      timezone: schedule?.timezone || diag.timezone || null,
      scheduledReminderCount: schedule ? Object.keys(schedule.reminders || {}).length : 0,
      scheduleLocalDate: schedule?.localDate || null,
      syncedAt: schedule?.syncedAt || diag.syncedAt || null,
      lastServerCheck: diag.lastCronCheck || null,
      globalCronLastRun: cronLast || null,
      lastPushAttempt: diag.lastPushAttempt || null,
      lastPushDelivered: diag.lastPushDelivered || null,
      lastPushResult: diag.lastPushResult || null,
      lastPushType: diag.lastPushType || null,
      failureReason: diag.failureReason || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Status failed', detail: String(err?.message || err), ...base });
  }
}
