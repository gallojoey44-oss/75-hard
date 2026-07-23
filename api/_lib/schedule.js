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
 * Decide which reminders in a schedule are due right now.
 * Returns { localDate, minutes, quiet, staleDay, due: [{type, payload}] }.
 * Idempotency (already-sent) is applied by the caller against the store;
 * everything here is pure so it can be unit-tested deterministically.
 */
export function evaluateSchedule(schedule, now = new Date()) {
  const { date: localDate, minutes } = localNow(schedule.timezone, now);
  const quiet = inQuietHours(schedule.quietHours, minutes);
  // Pre-rendered payloads were computed for schedule.localDate; if the user has
  // rolled into a new local day, they are stale — don't send until re-synced.
  const staleDay = !!(schedule.localDate && schedule.localDate !== localDate);

  const due = [];
  if (schedule.masterEnabled && !quiet && !staleDay) {
    for (const [type, entry] of Object.entries(schedule.reminders || {})) {
      if (!entry?.payload) continue;                  // suppressed / not applicable
      if (toMinutes(entry.time) > minutes) continue;  // time not reached (local)
      due.push({ type, payload: entry.payload });
    }
  }
  return { localDate, minutes, quiet, staleDay, due };
}
