// Pure, testable scheduling logic shared by the cron dispatcher.
// No I/O — takes a schedule + "now" and decides what is due.

// Current local date ('YYYY-MM-DD') and minutes-since-midnight for an IANA
// timezone. Uses Intl so daylight-saving transitions are handled correctly
// (no fixed UTC offset).
export function localNow(timezone, now = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(now).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  return { date, minutes };
}

export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

export function inQuietHours(quietHours, minutes) {
  if (!quietHours?.start || !quietHours?.end) return false;
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  // Window may cross midnight (e.g. 22:30 → 07:00).
  return start <= end ? (minutes >= start && minutes < end) : (minutes >= start || minutes < end);
}

/**
 * How long after a reminder's time it may still be delivered.
 *
 * Without a window, "due" means "any time today that has already passed", so a
 * dispatcher that runs infrequently (or recovers after an outage) would deliver
 * the whole day's reminders at once, hours late. 90 minutes is long enough to
 * absorb a slow external cron or a missed run, and short enough that a reminder
 * never arrives so late that it is just noise.
 */
export const CATCH_UP_MINUTES = 90;

/**
 * The real interval between dispatcher runs, in minutes, from a list of run
 * timestamps (newest first), or null when there aren't yet two to compare.
 *
 * The median gap, not the mean: a single long gap after a cold start or a
 * missed run shouldn't make a healthy 5-minute scheduler look broken.
 */
export function cadenceMinutes(runs) {
  if (!Array.isArray(runs) || runs.length < 2) return null;
  const times = runs.map(r => new Date(r).getTime()).filter(Number.isFinite).sort((a, b) => b - a);
  if (times.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i - 1] - times[i]) / 60000);
  gaps.sort((a, b) => a - b);
  return Math.round(gaps[Math.floor(gaps.length / 2)]);
}

/**
 * How recently the dispatcher must have run for it to count as live. Anything
 * older means queued pushes and timed reminders are not going out, whatever the
 * rest of the configuration says.
 */
export const SCHEDULER_STALE_MINUTES = 30;

/**
 * Decide which reminders in a schedule are due right now.
 *
 * Returns { localDate, minutes, quiet, staleDay, due: [{type, payload, stale}] }.
 * Idempotency (already-sent) is applied by the caller against the store;
 * everything here is pure so it can be unit-tested deterministically.
 *
 * ── On stale days ──────────────────────────────────────────────────────────
 * The app pre-renders each reminder's copy for a specific local date so the
 * server never invents dynamic values (a task count, a day number). The
 * original implementation then SUPPRESSED everything once that date was no
 * longer today — which made background delivery structurally impossible: a
 * schedule only stays fresh while the app is being opened daily, and that is
 * precisely when background delivery is not needed.
 *
 * The fix keeps the principle and drops the suppression. Each reminder may also
 * carry a `fallback` payload: date-independent copy ("Time for your evening
 * check-in") that is true on any day. On a stale day the fallback is sent
 * instead of the dynamic payload. If a reminder has no fallback, it is still
 * suppressed — better silence than a stale number.
 */
export function evaluateSchedule(schedule, now = new Date(), catchUp = CATCH_UP_MINUTES) {
  const { date: localDate, minutes } = localNow(schedule.timezone, now);
  const quiet = inQuietHours(schedule.quietHours, minutes);
  const staleDay = !!(schedule.localDate && schedule.localDate !== localDate);

  const due = [];
  if (schedule.masterEnabled && !quiet) {
    for (const [type, entry] of Object.entries(schedule.reminders || {})) {
      if (!entry) continue;
      // On a stale day the dynamic copy cannot be trusted; use the
      // date-independent fallback, or skip entirely when there is none.
      const payload = staleDay ? (entry.fallback || null) : (entry.payload || entry.fallback || null);
      if (!payload) continue;
      const at = toMinutes(entry.time);
      if (at > minutes) continue;                     // time not reached (local)
      if (minutes - at > catchUp) continue;           // too late to be useful
      due.push({ type, payload, stale: staleDay });
    }
  }
  return { localDate, minutes, quiet, staleDay, due };
}
