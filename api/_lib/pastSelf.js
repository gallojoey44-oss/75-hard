// Messages from your past self — the pure half.
//
// A user writes short messages to themselves and asks Forge to send one back
// at a time they choose. This module decides WHEN one is due and WHICH one it
// is. It does no I/O at all, for two reasons:
//
//   1. so the timing rules (weekdays, time zones, daylight saving, the catch-up
//      window) can be tested deterministically, like schedule.js;
//   2. so the APP can import the very same functions. When a notification is
//      tapped, the app has to show the message that notification was for, and
//      in the default private mode the server never knew which one that was —
//      it only knew a message was due. Both sides therefore derive the choice
//      from the same rule, in the same file, and cannot disagree.
//
// PRIVACY, which shapes the record this module validates:
//
//   • By default the server is told NOTHING a person wrote. It stores a time,
//     the chosen weekdays, a time zone and quiet hours, and sends a fixed
//     sentence: "A message from your past self is ready."
//   • Only when the user switches on "show my message on the lock screen" does
//     the app upload text — and then only the short messages that are switched
//     on, never a letter. `sanitizeRecord` enforces that on the server too: a
//     record without the consent flag has its text discarded even if a client
//     sent some.

import { localNow, toMinutes, inQuietHours, CATCH_UP_MINUTES } from './schedule.js';

/** The reminder type used for the send-once claim and in diagnostics. */
export const PAST_SELF_TYPE = 'pastSelf';

/** How many short messages a profile may keep. */
export const MAX_MESSAGES = 30;
/** Longest short message. A notification body much past this is cut off by the phone. */
export const MAX_MESSAGE_CHARS = 140;

/** What the lock screen says unless the user has chosen to show their own words. */
export const PRIVATE_TITLE = 'Forge';
export const PRIVATE_BODY = 'A message from your past self is ready.';
/** The heading used when their own words ARE shown. Forge's words, not theirs. */
export const REVEALED_TITLE = 'From your past self';

/** The view the service worker hands back to the app when the notification is tapped. */
export const PAST_SELF_VIEW = 'message';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[A-Za-z0-9_-]{1,48}$/;

// ── Dates ────────────────────────────────────────────────────────────────────

/** Whole days from 1970-01-01 to a 'YYYY-MM-DD' local date. No time zone involved. */
export function dayNumberOf(localDate) {
  const [y, m, d] = String(localDate || '').split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** 0 = Sunday … 6 = Saturday, for a 'YYYY-MM-DD' local date. */
export function weekdayOf(localDate) {
  const n = dayNumberOf(localDate);
  // 1970-01-01 was a Thursday.
  return Number.isFinite(n) ? (((n + 4) % 7) + 7) % 7 : NaN;
}

/** A clean, sorted weekday list — or null, which means every day. */
export function normalizeDays(days) {
  if (!Array.isArray(days)) return null;
  const clean = [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (clean.length === 0 || clean.length === 7) return null;
  return clean;
}

/** True when a local date is one of the chosen days. */
export function isScheduledDay(localDate, days) {
  const list = normalizeDays(days);
  return !list || list.includes(weekdayOf(localDate));
}

// ── Which message ────────────────────────────────────────────────────────────

/**
 * How many scheduled days there have been up to and including this one.
 *
 * Rotation is counted in DELIVERIES, not calendar days. Counting calendar days
 * looks equivalent and is not: with two messages on a Monday-Wednesday-Friday
 * schedule the dates are always two apart, so "day number modulo two" lands on
 * the same message every single time and the other is never sent.
 */
export function occurrenceIndex(localDate, days) {
  const n = dayNumberOf(localDate);
  if (!Number.isFinite(n)) return 0;
  const list = normalizeDays(days);
  if (!list) return n;
  const sundayBased = n + 4;                        // so that % 7 is the weekday
  const week = Math.floor(sundayBased / 7);
  const weekday = ((sundayBased % 7) + 7) % 7;
  // On an unscheduled day this is the count of scheduled days already past
  // this week, which makes the function total without ever being asked that.
  const position = list.filter(d => d < weekday).length;
  return week * list.length + position;
}

/** The item of a rotation that belongs to a local date, or null for an empty list. */
export function pickForDate(list, localDate, days) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const i = occurrenceIndex(localDate, days);
  return list[((i % list.length) + list.length) % list.length];
}

// ── The stored record ────────────────────────────────────────────────────────

function validTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/**
 * Validate what a client asked the server to store, returning the record to
 * keep — or null when the request is not a usable schedule.
 *
 * Message text survives only when `showContent` is literally true. It is kept
 * exactly as written apart from surrounding whitespace: nothing here rewrites,
 * shortens or "improves" a person's words. A message that is too long is
 * dropped rather than truncated, because a truncated sentence is no longer
 * what they wrote.
 */
export function sanitizeRecord(input) {
  const b = input || {};
  if (!validTimezone(b.timezone)) return null;
  if (typeof b.time !== 'string' || !HHMM.test(b.time)) return null;

  const quiet = b.quietHours;
  const quietHours = quiet && HHMM.test(String(quiet.start)) && HHMM.test(String(quiet.end))
    ? { start: quiet.start, end: quiet.end }
    : null;

  let rotation = [];
  if (b.showContent === true && Array.isArray(b.rotation)) {
    const seen = new Set();
    for (const item of b.rotation) {
      if (rotation.length >= MAX_MESSAGES) break;
      const id = typeof item?.id === 'string' ? item.id : '';
      const text = typeof item?.text === 'string' ? item.text.trim() : '';
      if (!ID.test(id) || seen.has(id)) continue;
      if (!text || [...text].length > MAX_MESSAGE_CHARS) continue;
      seen.add(id);
      rotation.push({ id, text });
    }
  }

  return {
    timezone: b.timezone,
    time: b.time,
    days: normalizeDays(b.days),
    quietHours,
    // Consent without anything to show is not consent to anything.
    showContent: rotation.length > 0,
    rotation,
  };
}

// ── What to send ─────────────────────────────────────────────────────────────

/**
 * The push payload for one delivery.
 *
 * `tag` is per profile and constant, and `renotify` is set: an unread message
 * from an earlier day is replaced rather than stacked, and the replacement
 * still alerts. `date` and `profile` travel with it so the app can show the
 * message this notification was for — even if it is tapped the next morning,
 * and even on a phone two people share.
 */
export function buildPayload(record, localDate, profileId) {
  const base = {
    tag: `forge-pastself-${profileId || 'me'}`,
    renotify: true,
    view: PAST_SELF_VIEW,
    profile: profileId || null,
    date: localDate,
  };
  const pick = record?.showContent ? pickForDate(record.rotation, localDate, record.days) : null;
  if (pick) {
    return { ...base, title: REVEALED_TITLE, body: pick.text, msg: pick.id };
  }
  return { ...base, title: PRIVATE_TITLE, body: PRIVATE_BODY };
}

/**
 * Decide whether a stored record is due right now.
 *
 * Returns { localDate, minutes, quiet, scheduledDay, due } where `due` is the
 * payload to send, or null. Whether it has ALREADY been sent today is the
 * caller's question, answered against the store.
 *
 * Time zones and daylight saving are handled by reading the local wall clock
 * through Intl rather than adding an offset: on the night the clocks go
 * forward a 02:30 message is due at the first run after 03:00, and on the
 * night they go back the second 01:30 is stopped by the send-once claim.
 */
export function evaluatePastSelf(record, now = new Date(), catchUp = CATCH_UP_MINUTES) {
  const { date: localDate, minutes } = localNow(record.timezone, now);
  const quiet = inQuietHours(record.quietHours, minutes);
  const scheduledDay = isScheduledDay(localDate, record.days);
  const at = toMinutes(record.time);
  const reached = at <= minutes && minutes - at <= catchUp;
  const due = scheduledDay && !quiet && reached
    ? buildPayload(record, localDate, record.profileId)
    : null;
  return { localDate, minutes, quiet, scheduledDay, due };
}

// ── What the server will say about what it holds ────────────────────────────

/**
 * A description of a stored record for the diagnostics endpoint: facts and a
 * COUNT, never the text. That endpoint can be read by anyone who knows an
 * install id, and "how many messages are stored" is all the app needs in order
 * to confirm that a deletion really happened.
 */
export function storedSummary(record, profileId, now = new Date()) {
  if (!record) return { stored: false, contentStored: 0 };
  const e = evaluatePastSelf({ ...record, profileId }, now);
  return {
    stored: true,
    time: record.time,
    days: record.days || null,
    timezone: record.timezone,
    showContent: !!record.showContent,
    contentStored: Array.isArray(record.rotation) ? record.rotation.length : 0,
    syncedAt: record.syncedAt || null,
    scheduledToday: e.scheduledDay,
    inQuietHours: e.quiet,
    dueNow: !!e.due,
  };
}

// ── Sending ──────────────────────────────────────────────────────────────────

/**
 * Deliver every past-self message that is due, at most once per local day.
 *
 * Takes its collaborators as arguments so the exactly-once behaviour can be
 * tested without a network or a live store. The claim is taken BEFORE sending,
 * so two overlapping dispatcher runs cannot both deliver, and released if every
 * send fails, so one transient error does not cost the day's message.
 */
export async function dispatchPastSelf({
  listIds, getRecord, getSubscriptions, alreadySent, markSent, unmarkSent,
  send, onResult = async () => {}, now = new Date(),
}) {
  const summary = { checked: 0, sent: 0, skipped: 0, errors: 0, cleaned: 0 };
  for (const id of await listIds()) {
    const cut = String(id).lastIndexOf(':');
    if (cut <= 0) continue;
    const installId = id.slice(0, cut);
    const profileId = id.slice(cut + 1);
    try {
      const record = await getRecord(installId, profileId);
      if (!record) { summary.skipped++; continue; }
      const { localDate, due } = evaluatePastSelf({ ...record, profileId }, now);
      if (!due) { summary.skipped++; continue; }

      summary.checked++;
      if (await alreadySent(installId, profileId, PAST_SELF_TYPE, localDate)) { summary.skipped++; continue; }
      const subs = await getSubscriptions(installId, profileId);
      if (!subs.length) { summary.skipped++; continue; }

      await markSent(installId, profileId, PAST_SELF_TYPE, localDate);
      let accepted = 0;
      let lastError = null;
      for (const sub of subs) {
        const r = await send(sub, due);
        if (r?.ok) accepted++;
        else { if (r?.gone) summary.cleaned++; lastError = r?.error || r?.statusCode; }
      }
      if (accepted > 0) {
        summary.sent++;
      } else {
        summary.errors++;
        await unmarkSent(installId, profileId, PAST_SELF_TYPE, localDate);
      }
      await onResult(installId, profileId, { accepted, error: lastError, localDate, revealed: !!due.msg });
    } catch {
      summary.errors++;
    }
  }
  return summary;
}
