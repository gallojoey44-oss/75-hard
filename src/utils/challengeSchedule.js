import { getTodayStr, dayNumberForDate, formatDateLong } from './dateUtils';

/**
 * Scheduled (future) challenge starts — the single source of truth for whether
 * a challenge attempt's clock has started.
 *
 * `profile.challengeStart` remains the canonical Day 1 date. Its relationship to
 * the user's LOCAL today is what defines the attempt's state, so no extra stored
 * flag can drift out of sync with it:
 *
 *   no challengeStart              → NONE       (nothing set up)
 *   challengeStart >  local today  → SCHEDULED  (prepared, clock not started)
 *   challengeStart <= local today  → ACTIVE     (Day 1 has arrived)
 *
 * Dates are plain local 'YYYY-MM-DD' strings, so comparisons are lexicographic
 * and purely local-calendar — never a UTC instant that could flip a day early or
 * late across timezones or DST.
 *
 * Activation is therefore automatic and requires no button press: the moment the
 * local date reaches challengeStart, every derived value switches to ACTIVE.
 *
 * Migration is a no-op by construction: every pre-existing attempt has a start
 * date of today or earlier, so it derives as ACTIVE exactly as before. A future
 * start is never inferred for an existing challenge.
 */

export const CHALLENGE_STATE = {
  NONE: 'none',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
};

/** Authoritative state for an attempt. */
export function getChallengeState(profile, todayStr = getTodayStr()) {
  const start = profile?.challengeStart;
  if (!start) return CHALLENGE_STATE.NONE;
  return start > todayStr ? CHALLENGE_STATE.SCHEDULED : CHALLENGE_STATE.ACTIVE;
}

/** True when the attempt is prepared but its Day 1 has not arrived yet. */
export function isScheduled(profile, todayStr = getTodayStr()) {
  return getChallengeState(profile, todayStr) === CHALLENGE_STATE.SCHEDULED;
}

/** True when the attempt's clock is running (Day 1 has arrived). */
export function isChallengeActive(profile, todayStr = getTodayStr()) {
  return getChallengeState(profile, todayStr) === CHALLENGE_STATE.ACTIVE;
}

/**
 * The current challenge day number, or NULL while the attempt is scheduled.
 *
 * Returning null (rather than clamping to 1, as the raw date helpers do) is
 * what stops every downstream system before it starts: scoring, XP, streaks,
 * weekly requirements, day generation and notifications all already treat a null
 * day number as "no challenge day", so none of them run before Day 1.
 */
export function challengeDayNumber(challengeStart, todayStr = getTodayStr()) {
  if (!challengeStart) return null;
  if (challengeStart > todayStr) return null;   // scheduled — clock not started
  return dayNumberForDate(challengeStart, todayStr);
}

/** Whole local days until Day 1 (0 once it has arrived). */
export function daysUntilStart(challengeStart, todayStr = getTodayStr()) {
  if (!challengeStart || challengeStart <= todayStr) return 0;
  const a = new Date(todayStr + 'T00:00:00');
  const b = new Date(challengeStart + 'T00:00:00');
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** 'YYYY-MM-DD' for today + n local days. */
export function dateOffsetFromToday(n, todayStr = getTodayStr()) {
  const d = new Date(todayStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Human phrase for when a scheduled challenge begins ("tomorrow" / a date). */
export function startsInWords(challengeStart, todayStr = getTodayStr()) {
  const days = daysUntilStart(challengeStart, todayStr);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return formatDateLong(challengeStart);
}

/** Heading for the pre-start card. */
export function scheduledHeading(challengeStart, todayStr = getTodayStr()) {
  const days = daysUntilStart(challengeStart, todayStr);
  if (days === 1) return 'Challenge Starts Tomorrow';
  return `Challenge Starts ${formatDateLong(challengeStart)}`;
}
