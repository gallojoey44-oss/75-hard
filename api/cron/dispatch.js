// GET/POST /api/cron/dispatch — the scheduled sender.
//
// WHO ACTUALLY CALLS THIS. Vercel's Hobby plan allows cron only ONCE PER DAY,
// and a more frequent schedule in vercel.json fails deployment. A single daily
// run is useless for time-of-day reminders — it almost never coincides with a
// reminder's local time — so the entry in vercel.json is only a backstop. The
// real cadence comes from an external caller every ~5 minutes:
// .github/workflows/push-dispatch.yml (or cron-job.org). See SETUP-PUSH.md.
//
// For each synced schedule it computes the user's *local* time from their IANA
// timezone (DST-aware) and delivers any reminder whose time has arrived, that
// is not in quiet hours, and that has not already been sent for the local date.
// It also drains the one-shot queue first — the delayed test pushes that are
// the only honest proof background delivery reaches the device.
//
// Security: requires CRON_SECRET. Vercel Cron automatically sends
// `Authorization: Bearer $CRON_SECRET`; an external cron may instead pass
// `?key=$CRON_SECRET`. Without CRON_SECRET set the endpoint refuses to run.
//
// Idempotency: one send per (installId, profileId, reminderType, localDate).
// The slot is claimed BEFORE sending and released if every send fails, so a
// transient error does not silently lose the reminder for the rest of the day.
//
// Stale day (in evaluateSchedule): if the schedule's localDate no longer
// matches the user's current local date, the pre-rendered payloads are stale,
// so the reminder falls back to date-independent copy rather than being
// suppressed. Suppressing it meant background delivery only worked on days the
// app had already been opened — i.e. never when it was actually needed.

import {
  getAllScheduleIds, getSchedule, getSubscriptions,
  alreadySent, markSent, unmarkSent, updateDiagnostics, storeConfigured, kvSet, CRON_LAST_KEY,
  recordCronRun, listOneShots, removeOneShot,
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
  // A rolling list of run times, so the diagnostics panel can prove the real
  // cadence instead of just showing "last run".
  await recordCronRun(startedAt).catch(() => {});

  const summary = { checked: 0, sent: 0, skipped: 0, cleaned: 0, errors: 0, oneShots: 0 };

  try {
    // ── One-shot queue first ────────────────────────────────────────────────
    // These are the "prove it works" sends: a single payload with a due time,
    // attempted once and then removed whatever the outcome.
    for (const item of await listOneShots()) {
      if (!item?.dueAt || new Date(item.dueAt) > new Date()) continue;   // not due yet
      await removeOneShot(item.id).catch(() => {});
      const subs = await getSubscriptions(item.installId, item.profileId);
      if (subs.length === 0) {
        summary.errors++;
        await updateDiagnostics(item.installId, item.profileId, {
          lastPushAttempt: new Date().toISOString(),
          lastPushType: item.label, lastPushResult: 'failed',
          failureReason: 'no stored subscription at send time',
        }).catch(() => {});
        continue;
      }
      let accepted = 0; let lastError = null;
      for (const sub of subs) {
        const r = await sendPush(sub, item.payload);
        if (r.ok) accepted++;
        else { if (r.gone) summary.cleaned++; lastError = r.error || r.statusCode; }
      }
      summary.oneShots++;
      if (accepted > 0) summary.sent++; else summary.errors++;
      await updateDiagnostics(item.installId, item.profileId, {
        lastPushAttempt: new Date().toISOString(),
        lastPushType: item.label,
        // "accepted" — the push service took it. Whether the DEVICE showed it
        // is only known once the service worker confirms (see /api/push/delivered).
        lastPushResult: accepted > 0 ? 'accepted' : 'failed',
        lastPushAccepted: accepted > 0 ? new Date().toISOString() : undefined,
        lastPushDueAt: item.dueAt,
        failureReason: accepted > 0 ? null : String(lastError || 'unknown'),
      }).catch(() => {});
    }

    const ids = await getAllScheduleIds();
    for (const id of ids) {
      const [installId, profileId] = id.split(':');
      const schedule = await getSchedule(installId, profileId);
      if (!schedule || !schedule.masterEnabled) { summary.skipped++; continue; }

      const { localDate, minutes, due, quiet, staleDay } = evaluateSchedule(schedule);

      await updateDiagnostics(installId, profileId, {
        lastCronCheck: startedAt, lastLocalDate: localDate, lastLocalMinutes: minutes,
        lastQuiet: quiet, lastStaleDay: staleDay, lastDueCount: due.length,
      }).catch(() => {});

      if (due.length === 0) { summary.skipped++; continue; }

      const subs = await getSubscriptions(installId, profileId);
      if (subs.length === 0) { summary.skipped++; continue; }

      for (const { type, payload, stale } of due) {
        summary.checked++;
        if (await alreadySent(installId, profileId, type, localDate)) { summary.skipped++; continue; }

        // Claim the slot before sending so two overlapping runs cannot both
        // deliver. If every send then fails the claim is RELEASED — otherwise a
        // single transient error would silently lose the reminder for the whole
        // day, which is what the original mark-before-send did.
        await markSent(installId, profileId, type, localDate);

        let accepted = 0;
        let lastError = null;
        for (const sub of subs) {
          const result = await sendPush(sub, payload);
          if (result.ok) accepted++;
          else { if (result.gone) summary.cleaned++; lastError = result.error || result.statusCode; }
        }

        if (accepted > 0) {
          summary.sent++;
          await updateDiagnostics(installId, profileId, {
            lastPushAttempt: new Date().toISOString(),
            lastPushAccepted: new Date().toISOString(),
            lastPushType: type,
            lastPushResult: 'accepted',
            lastPushWasFallback: !!stale,
            failureReason: null,
          }).catch(() => {});
        } else {
          summary.errors++;
          await unmarkSent(installId, profileId, type, localDate).catch(() => {});
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
