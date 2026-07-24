// GET/POST /api/cron/dispatch — the scheduled sender.
//
// Invoked by Vercel Cron (see vercel.json). NOTE: Vercel's Hobby plan limits
// cron jobs to once per day, so vercel.json uses a daily schedule to keep
// deployments valid on Hobby. For true minute-level delivery, upgrade to Vercel
// Pro and set the schedule to "* * * * *", or hit this endpoint every minute
// from an external cron (e.g. cron-job.org / GitHub Actions) with
// ?key=$CRON_SECRET. For each synced schedule it computes the user's *local*
// time from their IANA timezone (DST-aware), and delivers any reminder whose
// time has arrived, that is not in quiet hours, and that has not already been
// sent for the local date.
//
// Security: requires CRON_SECRET. Vercel Cron automatically sends
// `Authorization: Bearer $CRON_SECRET`; an external cron may instead pass
// `?key=$CRON_SECRET`. Without CRON_SECRET set the endpoint refuses to run.
//
// Idempotency: one send per (installId, profileId, reminderType, localDate).
// Stale-day guard (in evaluateSchedule): if the schedule's localDate no longer
// matches the user's current local date, its pre-rendered payloads are stale,
// so nothing is sent until the app re-syncs (never fabricate server-side).

import {
  getAllScheduleIds, getSchedule, getSubscriptions,
  alreadySent, markSent, updateDiagnostics, storeConfigured, kvSet, CRON_LAST_KEY,
} from '../_lib/store.js';
import { sendPush, vapidConfigured } from '../_lib/push.js';
import { evaluateSchedule } from '../_lib/schedule.js';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // must be configured
  const auth = req.headers.authorization || '';
  const key = (req.query && req.query.key) || '';
  return auth === `Bearer ${secret}` || key === secret;
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!vapidConfigured() || !storeConfigured()) {
    return res.status(503).json({ error: 'Push service or store not configured' });
  }

  const startedAt = new Date().toISOString();
  await kvSet(CRON_LAST_KEY, startedAt).catch(() => {});

  const summary = { checked: 0, sent: 0, skipped: 0, cleaned: 0, errors: 0 };

  try {
    const ids = await getAllScheduleIds();
    for (const id of ids) {
      const [installId, profileId] = id.split(':');
      const schedule = await getSchedule(installId, profileId);
      if (!schedule || !schedule.masterEnabled) { summary.skipped++; continue; }

      const { localDate, minutes, due } = evaluateSchedule(schedule);

      await updateDiagnostics(installId, profileId, {
        lastCronCheck: startedAt, lastLocalDate: localDate, lastLocalMinutes: minutes,
      }).catch(() => {});

      if (due.length === 0) { summary.skipped++; continue; }

      const subs = await getSubscriptions(installId, profileId);
      if (subs.length === 0) { summary.skipped++; continue; }

      for (const { type, payload } of due) {
        summary.checked++;
        if (await alreadySent(installId, profileId, type, localDate)) { summary.skipped++; continue; }

        // Mark sent BEFORE delivering so a retry/overlap can't double-send.
        await markSent(installId, profileId, type, localDate);

        let delivered = 0;
        let lastError = null;
        for (const sub of subs) {
          const result = await sendPush(sub, payload);
          if (result.ok) delivered++;
          else { if (result.gone) summary.cleaned++; lastError = result.error || result.statusCode; }
        }

        if (delivered > 0) {
          summary.sent++;
          await updateDiagnostics(installId, profileId, {
            lastPushAttempt: new Date().toISOString(),
            lastPushDelivered: new Date().toISOString(),
            lastPushType: type, lastPushResult: 'delivered', failureReason: null,
          }).catch(() => {});
        } else {
          summary.errors++;
          await updateDiagnostics(installId, profileId, {
            lastPushAttempt: new Date().toISOString(),
            lastPushType: type, lastPushResult: 'failed',
            failureReason: String(lastError || 'no active subscriptions'),
          }).catch(() => {});
        }
      }
    }
    return res.status(200).json({ ok: true, ranAt: startedAt, ...summary });
  } catch (err) {
    return res.status(500).json({ error: 'Dispatch failed', detail: String(err?.message || err), ...summary });
  }
}
