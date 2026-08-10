import { dayNumberForDate, getDateForDayNumber } from './dateUtils';

/**
 * Weekly Requirements — required challenge activities tracked per CHALLENGE WEEK
 * rather than per day (currently Fat Loss only).
 *
 * A challenge week is a fixed 7-day block counted from the challenge start, not
 * a calendar Mon–Sun week: week 1 = days 1–7, week 2 = days 8–14, and so on.
 * That keeps every week a full 7 days regardless of which weekday the challenge
 * began on. A final week shorter than 7 days is PRORATED (see targetForWeek).
 *
 * Sessions are stored individually (never as a bare counter) so they can be
 * listed, attributed to a date, and removed one at a time:
 *   profiles[profId].weeklySessions = [{ id, type, date }]
 * The list belongs to the active challenge attempt — it is cleared when a
 * challenge starts and snapshotted into the archive when one ends.
 */

// Requirement definitions. `perWeek` is the full-week target; `xp` is awarded per
// logged session and is the weight used in the challenge score.
export const WEEKLY_REQUIREMENT_DEFS = [
  { id: 'lifting', label: 'Lifting',       icon: '🏋️', perWeek: 3, xp: 25, keystone: 2, logLabel: 'Log Lifting Session', unit: 'lift' },
  { id: 'zone2',   label: 'Zone 2 Cardio', icon: '❤️',  perWeek: 2, xp: 20, keystone: 2, logLabel: 'Log Zone 2 Session',  unit: 'Zone 2' },
];

export const WEEKLY_REQUIREMENT_TEMPLATE_IDS = new Set(['fat_loss_phase']);

/** True when this challenge attempt tracks weekly requirements. */
export function hasWeeklyRequirements(meta) {
  return !!meta && WEEKLY_REQUIREMENT_TEMPLATE_IDS.has(meta.templateId);
}

/** The requirement definitions for an attempt ([] when unsupported). */
export function getWeeklyRequirementDefs(meta) {
  return hasWeeklyRequirements(meta) ? WEEKLY_REQUIREMENT_DEFS : [];
}

/** 1-based challenge week containing a 1-based challenge day. */
export function weekOfDay(dayNum) {
  return Math.max(1, Math.ceil((dayNum || 1) / 7));
}

/**
 * Prorated target for a week that has `daysInWeek` days available.
 * Deterministic rule: round-half-up of perWeek × daysInWeek / 7. A full 7-day
 * week returns perWeek exactly. Examples — a 2-day final week needs
 * round(3×2/7)=1 lift and round(2×2/7)=1 Zone 2; a 4-day final week needs
 * round(3×4/7)=2 lifts and round(2×4/7)=1 Zone 2.
 */
export function targetForWeek(perWeek, daysInWeek) {
  if (daysInWeek >= 7) return perWeek;
  if (daysInWeek <= 0) return 0;
  return Math.round((perWeek * daysInWeek) / 7);
}

/**
 * Every challenge week for an attempt, with its day span and prorated targets.
 * The final week is truncated to the challenge duration.
 */
export function challengeWeeks(meta) {
  const duration = meta?.durationDays;
  if (!duration || !hasWeeklyRequirements(meta)) return [];
  const defs = getWeeklyRequirementDefs(meta);
  const weeks = [];
  for (let startDay = 1; startDay <= duration; startDay += 7) {
    const endDay = Math.min(startDay + 6, duration);
    const days = endDay - startDay + 1;
    weeks.push({
      week: weekOfDay(startDay),
      startDay,
      endDay,
      days,
      partial: days < 7,
      targets: Object.fromEntries(defs.map(d => [d.id, targetForWeek(d.perWeek, days)])),
    });
  }
  return weeks;
}

/**
 * The first challenge week that weekly requirements apply to.
 *
 * New attempts store weeklyRequirementsStartDate = the challenge start, so every
 * week counts. An attempt that predates this feature is migrated with the date
 * it was first seen, so earlier weeks — for which no session history could
 * possibly exist — are never evaluated or penalised.
 */
export function effectiveStartWeek(meta, challengeStart) {
  const from = meta?.weeklyRequirementsStartDate;
  if (!from || !challengeStart) return 1;
  const day = dayNumberForDate(challengeStart, from);
  return weekOfDay(day || 1);
}

/** Sessions of one type that fall inside a week's day span. */
export function sessionsInWeek(sessions, type, week, challengeStart) {
  if (!challengeStart) return [];
  return (sessions || []).filter(s => {
    if (!s || s.type !== type || !s.date) return false;
    const day = dayNumberForDate(challengeStart, s.date);
    return day != null && day >= week.startDay && day <= week.endDay;
  });
}

/**
 * Full weekly-requirement state for an attempt.
 *
 * Scoring follows the same fairness rule as daily tasks: a FINALISED week (its
 * last day is already historical) puts its whole target into the denominator and
 * any shortfall counts as missed; the CURRENT in-progress week contributes only
 * what has actually been logged — to BOTH sides — so nothing is held against the
 * user until the week ends. Future weeks are ignored entirely. Earned credit is
 * capped at each week's target, so extra sessions can never push the score above
 * 100%.
 *
 * @returns {{
 *   supported: boolean, weeks: Array, current: Object|null,
 *   earnedXP: number, availableXP: number,
 *   missedUnits: number, missedPenalty: number,
 *   totals: Object, sessionXP: number
 * }}
 */
export function computeWeeklyRequirements({ sessions, meta, challengeStart, currentRawDay, penaltiesEnabled = false }) {
  const defs = getWeeklyRequirementDefs(meta);
  if (!defs.length || !challengeStart || !currentRawDay) {
    return { supported: false, weeks: [], current: null, earnedXP: 0, availableXP: 0, missedUnits: 0, missedPenalty: 0, totals: {}, sessionXP: 0 };
  }
  const fromWeek = effectiveStartWeek(meta, challengeStart);
  const all = challengeWeeks(meta);
  const currentWeekNum = weekOfDay(Math.min(currentRawDay, meta.durationDays || currentRawDay));

  let earnedXP = 0, availableXP = 0, missedUnits = 0, missedPenalty = 0, sessionXP = 0;
  const totals = Object.fromEntries(defs.map(d => [d.id, { done: 0, required: 0 }]));
  const weeks = [];

  for (const week of all) {
    const tracked = week.week >= fromWeek;
    // A week is finalised once its last day is strictly in the past.
    const finalized = week.endDay < currentRawDay;
    const isCurrent = !finalized && week.startDay <= currentRawDay;
    const reqs = defs.map(def => {
      const logged = sessionsInWeek(sessions, def.id, week, challengeStart);
      const target = week.targets[def.id];
      const done = logged.length;
      const credited = Math.min(done, target);   // never more than the target
      // Every logged session earns its XP (self-reported, like every other task).
      if (tracked) sessionXP += done * def.xp;
      if (tracked && finalized) {
        availableXP += target * def.xp;
        earnedXP += credited * def.xp;
        const missed = Math.max(0, target - done);
        missedUnits += missed;
        if (penaltiesEnabled) missedPenalty += missed * Math.round(Math.min(def.xp * 0.25, 12));
        totals[def.id].required += target;
        totals[def.id].done += credited;
      } else if (tracked && isCurrent) {
        // Neutral: only what is already done counts, on both sides.
        availableXP += credited * def.xp;
        earnedXP += credited * def.xp;
        totals[def.id].required += credited;
        totals[def.id].done += credited;
      }
      return {
        ...def, target, done, credited,
        met: done >= target,
        remaining: Math.max(0, target - done),
        sessions: logged.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
      };
    });
    weeks.push({
      ...week, tracked, finalized, isCurrent,
      startDate: getDateForDayNumber(challengeStart, week.startDay),
      endDate: getDateForDayNumber(challengeStart, week.endDay),
      requirements: reqs,
    });
  }

  return {
    supported: true,
    weeks,
    current: weeks.find(w => w.isCurrent) || null,
    earnedXP, availableXP, missedUnits, missedPenalty, totals, sessionXP,
    fromWeek,
  };
}

/** Compact per-type adherence for summaries: { lifting: {done, required, pct} }. */
export function weeklyAdherence(result) {
  const out = {};
  for (const [id, t] of Object.entries(result?.totals || {})) {
    out[id] = { ...t, pct: t.required > 0 ? Math.round((t.done / t.required) * 100) : null };
  }
  return out;
}

/** Create a session record. Ids are unique so duplicates are never conflated. */
export function makeSession(type, date) {
  return { id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, date };
}
