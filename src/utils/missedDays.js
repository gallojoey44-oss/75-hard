import { computeDayXP, hasAnyActivity, requiredTasksForDay } from './gamification';
import { getDateForDayNumber } from './dateUtils';
import { dayRules } from '../data/xpEconomy';

/**
 * Missed days, as something a person can read.
 *
 * The XP system already knows what a missed day costs. What it could not do
 * was say WHEN the misses happened, so the Rank Details card showed a single
 * standing "XP Lost from Missed Days" figure that looked like an ongoing
 * penalty long after the user had come back and resumed.
 *
 * This module separates the two:
 *
 *   RECENT    A gap you have just returned from. Temporary, specific, and
 *             shown once per gap — not re-announced on every reload.
 *   HISTORY   The permanent record, per challenge, for the XP History section.
 *
 * Two rules throughout:
 *   • The current day is never counted. It is not finished, so it cannot have
 *     been missed.
 *   • Penalties are read from computeDayXP under the ATTEMPT'S OWN rate card,
 *     not recalculated here, so this can never disagree with the balance.
 *     Without the rate card the default era-1 rules applied, and an era-2
 *     attempt's missed day was reported at the old flat 25 while the balance
 *     was charged a share of that attempt's budget.
 */

/** How many consecutive missed days make a gap worth announcing. */
export const MIN_GAP_DAYS = 2;

/**
 * How many days of renewed activity the notice survives. After this it stops
 * on its own, so someone who is plainly back does not keep being told they
 * were away.
 */
export const NOTICE_WINDOW_DAYS = 3;

/**
 * The last day of a segment that could have incurred a miss penalty.
 *
 * This mirrors computeTotalXP exactly, and has to: it loops `xpStartDay..dayNum`
 * while treating days from the UNCAPPED `rawDay` onward as unfinished, so a
 * day is chargeable only if it is inside the segment AND strictly in the past.
 * Using either bound alone miscounts — `rawDay` alone counts days after a
 * challenge ended, and `dayNum` alone counts a day that was never charged.
 */
function lastChargeableDay(rawDay, dayNum) {
  const raw = (Number(rawDay) || 1) - 1;
  // Only a positive number caps the segment. null, undefined and 0 all mean
  // "no cap" — read as a bound they would silently suppress every missed day.
  const end = Number(dayNum) > 0 ? Number(dayNum) : Infinity;
  return Math.min(raw, end);
}

/**
 * Per-day miss detail for one segment.
 *
 * `rawDay` is the UNCAPPED current day number; `dayNum` is the segment's last
 * day, if it has one. Only days inside the segment and strictly before the
 * current day are considered, which is what keeps the unfinished current day
 * out and days past the end of a finished challenge out too.
 */
export function missedDayDetail({ days, tasks, meta, challengeStart, rawDay, dayNum, penaltiesEnabled = true, xpStartDay = 1 }) {
  const out = [];
  let totalPenalty = 0;
  const rules = dayRules(meta);
  const last = lastChargeableDay(rawDay, dayNum);
  for (let i = Math.max(1, xpStartDay); i <= last; i++) {
    const rec = (days || {})[i];
    if (hasAnyActivity(rec)) continue;
    const dayTasks = requiredTasksForDay(tasks || [], meta, challengeStart, i);
    const { lost } = computeDayXP(rec, dayTasks, null, i, last, penaltiesEnabled, rawDay, rules);
    out.push({ dayNum: i, date: getDateForDayNumber(challengeStart, i), penalty: lost });
    totalPenalty += lost;
  }
  return { missed: out, missedDays: out.length, totalPenalty };
}

/**
 * The most recent stretch of consecutive missed days, and how long ago it
 * ended.
 *
 * Trailing ACTIVE days are skipped first, so a user who has been back for two
 * days still gets the gap that preceded them — with `daysSinceReturn` of 2, so
 * the caller can decide the notice has run its course.
 *
 * Returns null when there is no qualifying gap.
 */
export function recentGap({ days, tasks, meta, challengeStart, rawDay, dayNum, penaltiesEnabled = true, xpStartDay = 1 }) {
  const last = lastChargeableDay(rawDay, dayNum);  // never the current day
  const first = Math.max(1, xpStartDay);
  if (last < first) return null;

  const active = (n) => hasAnyActivity((days || {})[n]);

  // Walk back over the days since they returned.
  let cursor = last;
  let daysSinceReturn = 0;
  while (cursor >= first && active(cursor)) { cursor--; daysSinceReturn++; }
  if (cursor < first) return null;                  // no misses at all

  // Then measure the contiguous run of missed days.
  const gapEnd = cursor;
  while (cursor >= first && !active(cursor)) cursor--;
  const gapStart = cursor + 1;

  const missedDays = gapEnd - gapStart + 1;
  if (missedDays < MIN_GAP_DAYS) return null;

  let penalty = 0;
  const rules = dayRules(meta);
  for (let i = gapStart; i <= gapEnd; i++) {
    const dayTasks = requiredTasksForDay(tasks || [], meta, challengeStart, i);
    penalty += computeDayXP((days || {})[i], dayTasks, null, i, last, penaltiesEnabled, rawDay, rules).lost;
  }

  return {
    missedDays,
    penalty,
    fromDay: gapStart,
    toDay: gapEnd,
    fromDate: getDateForDayNumber(challengeStart, gapStart),
    toDate: getDateForDayNumber(challengeStart, gapEnd),
    daysSinceReturn,
    // Identifies this specific stretch of time. Stable across reloads, so the
    // same gap is never presented as a new event twice; a LATER gap produces a
    // different key and is announced on its own.
    key: `${challengeStart || 'none'}|${gapStart}-${gapEnd}`,
  };
}

/**
 * Whether the Welcome Back notice should appear.
 *
 * Shown for a gap the user has just come back from, once. It stops when they
 * dismiss it, and on its own once they have been active for a few days — so it
 * cannot become permanent furniture.
 */
export function shouldShowComeback(gap, dismissedKey) {
  if (!gap) return false;
  if (gap.key === dismissedKey) return false;
  return gap.daysSinceReturn <= NOTICE_WINDOW_DAYS;
}

/**
 * The permanent XP History: one row per archived challenge plus the live one.
 *
 * `archiveDetail` is supplied by the caller (xpLedger.archiveDeficit) so this
 * module does not need to know how an archive is recomputed.
 */
export function buildXPHistory({ archives, archiveDetail, current }) {
  const rows = (archives || []).map(a => {
    const d = archiveDetail ? archiveDetail(a) : null;
    return {
      id: a.id,
      name: a?.challenge?.name || 'Challenge',
      startDate: a.challengeStart || null,
      endDate: a.endDate || a.archivedAt || null,
      banked: Math.max(0, Number(a.xpEarned) || 0),
      earned: d?.verified ? d.gained : null,
      penalties: d?.verified ? d.missedPenalty : null,
      // Days that were logged but left incomplete cost XP too. Reported on
      // their own line so "6 days missed" is never shown beside a figure that
      // six missed days could not add up to.
      partialPenalties: d?.verified ? Math.max(0, d.lost - d.missedPenalty) : null,
      missedDays: d?.verified ? d.missedDays : null,
      // An archive whose records cannot be re-read shows its banked total and
      // says the detail is unavailable, rather than a technical error.
      detailAvailable: !!d?.verified,
      archived: true,
    };
  });

  if (current) rows.push({ ...current, archived: false });
  return rows;
}
