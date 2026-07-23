// POST /api/push/sync — store the minimal reminder-scheduling data the server
// needs to deliver background reminders. Called by the app whenever the
// relevant settings or today's task state change.
//
// Body (minimal scheduling data ONLY — no health/challenge data):
// {
//   installId, profileId,
//   timezone,          // IANA zone, e.g. "America/New_York" (DST-aware)
//   localDate,         // 'YYYY-MM-DD' the payloads were computed for
//   masterEnabled,     // bool
//   quietHours: { start, end },
//   reminders: {       // only enabled, background-capable (time-based) reminders
//     [type]: { time: 'HH:MM', payload: {title,body,tag,view} | null }
//   }
// }
//
// Pre-rendered payloads are computed by the app (single source of truth for
// notification copy) so the server never fabricates dynamic values.

import { saveSchedule, removeSchedule, updateDiagnostics, storeConfigured } from '../_lib/store.js';

function validTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!storeConfigured()) {
    return res.status(503).json({ error: 'Store not configured' });
  }

  const b = req.body || {};
  const { installId, profileId, timezone, localDate, masterEnabled, quietHours, reminders } = b;

  if (!installId || typeof installId !== 'string') return res.status(400).json({ error: 'Missing installId' });
  if (!['me', 'girlfriend'].includes(profileId)) return res.status(400).json({ error: 'Invalid profile' });
  if (!validTimezone(timezone)) return res.status(400).json({ error: 'Invalid timezone' });

  try {
    // If notifications are off entirely, drop the schedule so cron skips it.
    if (!masterEnabled) {
      await removeSchedule(installId, profileId);
      await updateDiagnostics(installId, profileId, {
        syncedAt: new Date().toISOString(), timezone, localDate, masterEnabled: false,
        reminderCount: 0,
      });
      return res.status(200).json({ ok: true, cleared: true });
    }

    // Keep only well-formed reminder entries.
    const clean = {};
    for (const [type, entry] of Object.entries(reminders || {})) {
      if (!entry || typeof entry.time !== 'string') continue;
      clean[type] = { time: entry.time, payload: entry.payload || null };
    }

    const schedule = {
      installId, profileId, timezone, localDate,
      masterEnabled: true,
      quietHours: quietHours || { start: '22:30', end: '07:00' },
      reminders: clean,
      syncedAt: new Date().toISOString(),
    };
    await saveSchedule(installId, profileId, schedule);
    await updateDiagnostics(installId, profileId, {
      syncedAt: schedule.syncedAt, timezone, localDate, masterEnabled: true,
      reminderCount: Object.keys(clean).length,
    });
    return res.status(200).json({ ok: true, reminderCount: Object.keys(clean).length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to sync schedule', detail: String(err?.message || err) });
  }
}
