// POST /api/push/test-scheduled — queue ONE real Web Push for a few minutes'
// time, so background delivery can be tested the only way that actually proves
// anything: schedule it, close the app, lock the phone, wait.
//
// This is deliberately different from /api/push/test-background, which sends
// immediately while the app is still open and therefore proves very little
// about background behaviour.
//
// Body: { installId, profileId, delayMinutes? }   (default 3, max 60)
//
// The send is performed later by /api/cron/dispatch draining the one-shot
// queue, so this endpoint also reports when the dispatcher last ran — if the
// scheduler is not running, the honest answer is "this will never arrive", and
// the response says so rather than implying success.

import {
  getSubscriptions, enqueueOneShot, storeConfigured, getCronRuns, updateDiagnostics,
} from '../_lib/store.js';
import { vapidConfigured } from '../_lib/push.js';
import { cadenceMinutes, SCHEDULER_STALE_MINUTES } from '../_lib/schedule.js';

const DEFAULT_DELAY = 3;
const MAX_DELAY = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!vapidConfigured()) {
    return res.status(503).json({ error: 'Push service not configured', fix: 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel.' });
  }
  if (!storeConfigured()) {
    return res.status(503).json({ error: 'Subscription store not configured', fix: 'Attach a Vercel KV / Upstash Redis store.' });
  }

  const { installId, profileId } = req.body || {};
  const requested = Number(req.body?.delayMinutes);
  const delayMinutes = Math.min(MAX_DELAY, Math.max(1, Number.isFinite(requested) ? requested : DEFAULT_DELAY));

  if (!installId || !['me', 'girlfriend'].includes(profileId)) {
    return res.status(400).json({ error: 'Missing installId/profileId' });
  }

  try {
    // Refuse early if there is nothing to send to — a queued push with no
    // subscription would just fail silently in a few minutes' time.
    const subs = await getSubscriptions(installId, profileId);
    if (subs.length === 0) {
      return res.status(404).json({
        error: 'No stored push subscription for this install/profile',
        fix: 'Open Settings → Notifications and enable reminders. On iPhone, Forge must be installed to the Home Screen first.',
      });
    }

    const dueAt = new Date(Date.now() + delayMinutes * 60000).toISOString();
    const tag = `forge-sched-test-${Date.now()}`;
    const id = await enqueueOneShot({
      installId,
      profileId,
      dueAt,
      label: 'scheduled-test',
      payload: {
        title: '⚔️ Forge scheduled test',
        body: `This was queued ${delayMinutes} minutes ago and sent by the server — Forge did not need to be open.`,
        // A unique tag so it cannot be collapsed into an earlier notification,
        // and renotify so the phone actually alerts rather than silently
        // replacing something already in Notification Centre.
        tag,
        renotify: true,
        view: 'settings',
        confirm: { label: 'scheduled-test', tag },
      },
    });

    await updateDiagnostics(installId, profileId, {
      lastQueuedAt: new Date().toISOString(),
      lastQueuedDueAt: dueAt,
      lastQueuedLabel: 'scheduled-test',
    }).catch(() => {});

    const runs = await getCronRuns();
    const cadence = cadenceMinutes(runs);
    const lastRun = runs[0] || null;
    const lastRunAgeMin = lastRun ? Math.round((Date.now() - new Date(lastRun).getTime()) / 60000) : null;
    // The dispatcher is what actually sends this. If it is not running, say so
    // plainly instead of reporting a cheerful "queued".
    const schedulerLooksLive = lastRunAgeMin != null && lastRunAgeMin <= SCHEDULER_STALE_MINUTES;

    return res.status(200).json({
      ok: true,
      queued: true,
      id,
      dueAt,
      delayMinutes,
      subscriptions: subs.length,
      scheduler: {
        lastRun,
        lastRunAgeMinutes: lastRunAgeMin,
        observedCadenceMinutes: cadence,
        looksLive: schedulerLooksLive,
      },
      // Honest expectation, derived from the cadence actually observed.
      expectedWithinMinutes: schedulerLooksLive
        ? delayMinutes + (cadence || 5)
        : null,
      warning: schedulerLooksLive
        ? null
        : 'The scheduled dispatcher has not run recently, so this queued push will NOT be delivered on time. Set up the external cron (see SETUP-PUSH.md) or hit /api/cron/dispatch manually.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to queue scheduled test', detail: String(err?.message || err) });
  }
}
