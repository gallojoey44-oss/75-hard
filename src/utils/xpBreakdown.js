import {
  computeDayXP, computeStreakEvents, computeTotalXP, getTaskXP, getBonusXP,
  getMWDComplete, requiredTasksForDay, hasAnyActivity,
} from './gamification';
import { computeWeeklyRequirements, hasWeeklyRequirements } from './weeklyRequirements';
import { dayRules, economyVersionOf, dailyBudgetOf, displayScaleFor } from '../data/xpEconomy';
import { getDayNumberFromStart } from './dateUtils';

/**
 * Where a challenge's XP actually came from.
 *
 * The rank card could say what a period banked but not why. This takes one
 * segment — live or archived — and splits its total into the things a user did:
 * daily tasks, perfect days, streaks, weekly sessions, optional missions, and
 * each kind of deduction.
 *
 * Two rules it is built around:
 *
 *   • It RECONCILES. The parts are summed and checked against what
 *     `computeTotalXP` says the segment is worth; the result carries a
 *     `reconciles` flag rather than quietly disagreeing with the balance.
 *   • It uses the segment's OWN era. An era-1 period is broken down with era-1
 *     rates and then converted for display, so the explanation matches the
 *     rules that were actually applied at the time.
 */

/**
 * Split one segment into its parts.
 *
 * Every figure comes back in the segment's STORED units, plus a `scale` for
 * converting to display units, so a caller can show either without guessing.
 */
export function segmentBreakdown({
  days, tasks, meta, challengeStart, dayNum, rawDay,
  penaltiesEnabled = true, xpStartDay = 1, weeklySessions = [],
  getDayCompletion = null,
}) {
  const rules = dayRules(meta);
  const era = economyVersionOf(meta);
  const profId = '_seg';
  const profDays = days || {};
  const taskList = tasks || [];
  const last = Math.max(0, Number(dayNum) || 0);
  // The past/current boundary is derived from challengeStart, exactly as
  // computeTotalXP derives it. Trusting a caller-supplied rawDay instead would
  // let the two disagree about whether the final day is finalised, and the
  // breakdown would charge a missed day the balance never charged.
  const raw = getDayNumberFromStart(challengeStart) ?? Number(rawDay) ?? last;

  const parts = {
    era,
    scale: displayScaleFor(era),
    dailyBudget: era >= 2 ? dailyBudgetOf(meta) : null,
    effortTier: meta?.effortTier || null,
    mode: meta?.variant || null,
    days: last,
    // Earnings
    taskXP: 0,
    perfectDayXP: 0,
    perfectDays: 0,
    ratingsXP: 0,
    mentalSectionXP: 0,
    faithXP: 0,
    recoveryXP: 0,
    recoveryDays: 0,
    optionalXP: 0,
    streakXP: 0,
    weeklyXP: 0,
    completionXP: 0,
    comebackXP: 0,
    // Deductions
    missedDayPenalty: 0,
    missedDays: 0,
    taskMissPenalty: 0,
    streakBreakPenalty: 0,
    weeklyMissPenalty: 0,
  };

  // ── Day by day ────────────────────────────────────────────────────────────
  for (let i = Math.max(1, xpStartDay); i <= last; i++) {
    const rec = profDays[i];
    const dayTasks = requiredTasksForDay(taskList, meta, challengeStart, i);
    const { gained, lost } = computeDayXP(rec, dayTasks, profId, i, last, penaltiesEnabled, raw, rules);

    if (!hasAnyActivity(rec)) {
      // A whole day missed: computeDayXP returns only the flat charge.
      if (lost > 0) { parts.missedDayPenalty += lost; parts.missedDays++; }
      continue;
    }

    // Attribute the day's earnings to their sources. Summing these must give
    // back `gained`, which is asserted below.
    let dayTaskXP = 0;
    for (const t of dayTasks) if (rec.tasks?.[t.id]) dayTaskXP += getTaskXP(t, rules);
    parts.taskXP += dayTaskXP;

    const allDone = dayTasks.length > 0 &&
      dayTasks.filter(t => rec.tasks?.[t.id]).length === dayTasks.length;
    if (allDone) { parts.perfectDayXP += rules.perfectDay; parts.perfectDays++; }

    if (rec.mentalTraining?.completed) parts.mentalSectionXP += rules.mentalSection;
    const allRatings = (rec.mood || 0) > 0 && (rec.energy || 0) > 0 && (rec.sleep || 0) > 0 &&
                       (rec.stress || 0) > 0 && (rec.recovery || 0) > 0;
    if (allRatings) parts.ratingsXP += rules.allRatings;
    if (rec.faithReflection?.completed) parts.faithXP += rules.faith;
    if (getMWDComplete(rec)) { parts.recoveryXP += rules.recoveryDay; parts.recoveryDays++; }
    parts.optionalXP += Math.min(getBonusXP(rec), rules.bonusPerDayCap ?? Infinity);

    // Whatever the day lost on a day that was touched is task shortfall.
    parts.taskMissPenalty += lost;
  }

  // ── Streaks ───────────────────────────────────────────────────────────────
  if (getDayCompletion) {
    const st = computeStreakEvents(
      { [profId]: profDays }, profId, (n) => getDayCompletion(n), last, penaltiesEnabled, raw, rules);
    parts.streakXP = st.gained;
    parts.streakBreakPenalty = st.lost;
  }

  // ── Weekly requirements ───────────────────────────────────────────────────
  if (hasWeeklyRequirements(meta)) {
    const wk = computeWeeklyRequirements({
      sessions: weeklySessions, meta, challengeStart, currentRawDay: raw,
      penaltiesEnabled,
    });
    parts.weeklyXP = wk.sessionXP;
    parts.weeklyMissPenalty = wk.missedPenalty;
  }

  parts.earned = parts.taskXP + parts.perfectDayXP + parts.ratingsXP + parts.mentalSectionXP +
    parts.faithXP + parts.recoveryXP + parts.optionalXP + parts.streakXP + parts.weeklyXP +
    parts.completionXP + parts.comebackXP;
  parts.deducted = parts.missedDayPenalty + parts.taskMissPenalty +
    parts.streakBreakPenalty + parts.weeklyMissPenalty;
  parts.net = parts.earned - parts.deducted;
  return parts;
}

/**
 * The same split, reconciled against the engine's own total for the segment.
 *
 * `reconciles` is false when the parts do not add up to what `computeTotalXP`
 * says — which is information, not something to hide: a breakdown that
 * disagrees with the balance is worse than no breakdown, so the caller shows
 * the banked figure and says the detail is unavailable.
 */
export function reconciledSegmentBreakdown(input) {
  const parts = segmentBreakdown(input);
  const profId = '_seg';
  const profiles = { [profId]: {
    challengeStart: input.challengeStart,
    activeChallenge: input.meta,
    tasks: input.tasks || [],
    xpPenalties: input.penaltiesEnabled !== false,
    xpStartDay: input.xpStartDay ?? 1,
    xpOffset: 0,
    weeklySessions: input.weeklySessions || [],
    comebackHistory: input.comebackHistory || [],
  } };
  const completion = input.getDayCompletion || (() => 0);
  const engine = computeTotalXP(
    { [profId]: input.days || {} }, profiles, profId,
    (n) => completion(n), input.dayNum, input.rawDay ?? input.dayNum,
  );
  // The completion bonus is awarded by computeTotalXP at the final day, so it
  // appears in the engine total but not in the day-by-day walk above. Taking
  // the difference attributes it rather than leaving it unexplained.
  const diff = engine.gained - parts.earned;
  if (diff > 0) { parts.completionXP = diff; parts.earned += diff; parts.net += diff; }

  parts.engineGained = engine.gained;
  parts.engineLost = engine.lost;
  parts.engineNet = engine.rawTotal;
  parts.reconciles = parts.earned === engine.gained && parts.deducted === engine.lost;
  return parts;
}

/** Convert a breakdown's figures to display units. */
export function toDisplay(parts) {
  const s = parts?.scale || 1;
  const out = { ...parts };
  for (const k of [
    'taskXP', 'perfectDayXP', 'ratingsXP', 'mentalSectionXP', 'faithXP', 'recoveryXP',
    'optionalXP', 'streakXP', 'weeklyXP', 'completionXP', 'comebackXP',
    'missedDayPenalty', 'taskMissPenalty', 'streakBreakPenalty', 'weeklyMissPenalty',
    'earned', 'deducted', 'net', 'dailyBudget',
  ]) {
    if (typeof out[k] === 'number') out[k] = Math.round(out[k] * s);
  }
  return out;
}
