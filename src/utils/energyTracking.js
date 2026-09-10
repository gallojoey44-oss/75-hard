/**
 * Energy tracking — the measurement half of the Energy Reset challenge.
 *
 * Three ratings per day (morning / afternoon / overall, each 1–10) live directly
 * on the existing day record as optional fields, exactly like the Muscle
 * Building physique measurements. A record written before this challenge existed
 * simply has no values, which reads as "not rated" rather than as a zero — so
 * nothing in the app's history is retro-scored, and nothing needs migrating.
 *
 * Everything here is pure and observational. It compares what the user logged
 * and reports differences and associations; it never asserts that a habit CAUSED
 * an energy change, because a short single-arm self-report cannot establish
 * that — at any of the challenge's lengths. Phrasing is enforced by the callers
 * using ASSOCIATION_PHRASING below.
 */

/** The three tracked dimensions, in display order. */
export const ENERGY_FIELDS = [
  { key: 'morningEnergy',   label: 'Morning Energy',   short: 'Morning',   icon: '🌅', prompt: 'How alert did you feel in the first hour or two after waking?' },
  { key: 'afternoonEnergy', label: 'Afternoon Energy', short: 'Afternoon', icon: '🌤️', prompt: 'How was your energy through the afternoon dip?' },
  { key: 'overallEnergy',   label: 'Overall Energy',   short: 'Overall',   icon: '⚡', prompt: 'Taking the whole day together, how energised were you?' },
];

export const ENERGY_KEYS = ENERGY_FIELDS.map(f => f.key);

/** Ratings are 1–10; 0/undefined/null all mean "not rated". */
export const ENERGY_SCALE = { min: 1, max: 10 };

/**
 * Default window: how many rated days form the "before" and "after" sides.
 *
 * Three days each smooths out a single unusually good or bad day without
 * needing more data than the shortest challenge can produce. Callers running a
 * longer challenge pass a larger window, so a month-long attempt compares two
 * weeks-worth of days rather than two three-day slivers.
 */
export const WINDOW_SIZE = 3;

/**
 * The window actually used, given how many days were rated.
 *
 * The requested window is capped so the two sides can never overlap and are
 * always balanced: with only five rated days a window of seven degrades to two
 * per side rather than swallowing the whole run and reporting nothing.
 */
export function effectiveWindow(requested, ratedCount) {
  return Math.max(1, Math.min(requested || WINDOW_SIZE, Math.floor((ratedCount || 0) / 2)));
}

/**
 * Minimum rated days before a before/after comparison is shown at all.
 *
 * With a user-supplied pre-challenge baseline, two rated challenge days are
 * enough to say something. Without one the baseline has to come out of the
 * challenge itself, so more days are needed for the two windows to be
 * meaningfully separate.
 */
export const MIN_RATED_DAYS = { withBaseline: 2, derived: 4 };

/** A single rating, or null when the day was not rated on that dimension. */
export function ratingOf(rec, key) {
  const v = rec?.[key];
  return typeof v === 'number' && v >= ENERGY_SCALE.min && v <= ENERGY_SCALE.max ? v : null;
}

/** True when a record carries at least one energy rating. */
export function hasEnergyData(rec) {
  return ENERGY_KEYS.some(k => ratingOf(rec, k) !== null);
}

/** { morningEnergy, afternoonEnergy, overallEnergy } with nulls for unrated. */
export function energyOf(rec) {
  return Object.fromEntries(ENERGY_KEYS.map(k => [k, ratingOf(rec, k)]));
}

/** Mean of the values that exist, rounded to 1dp, or null when there are none. */
function mean(values) {
  const nums = values.filter(v => typeof v === 'number');
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/** Per-dimension averages across a list of day records. */
export function averageEnergy(records) {
  const list = records || [];
  const out = { n: list.length };
  for (const k of ENERGY_KEYS) out[k] = mean(list.map(r => ratingOf(r, k)));
  return out;
}

/**
 * The rated day records of an attempt, in day order, each tagged with its day
 * number. Days the user never rated are skipped entirely rather than counted as
 * zero — a missing rating is missing data, not low energy.
 */
export function ratedDays(days, endDayNum) {
  const out = [];
  for (let n = 1; n <= (endDayNum || 0); n++) {
    const rec = days?.[n];
    if (rec && hasEnergyData(rec)) out.push({ ...rec, dayNumber: n });
  }
  return out;
}

/** Percent change from → to, rounded. Null when it cannot be computed. */
export function pctChange(from, to) {
  if (typeof from !== 'number' || typeof to !== 'number' || from === 0) return null;
  return Math.round(((to - from) / from) * 100);
}

/**
 * A user-supplied pre-challenge baseline, normalised — or null when the user
 * skipped it (which is always allowed: the challenge must be startable in one
 * tap, so the baseline can also be derived from the earliest rated days).
 */
export function normalizeBaseline(baseline) {
  if (!baseline) return null;
  const rec = {};
  for (const k of ENERGY_KEYS) {
    const v = ratingOf(baseline, k);
    if (v !== null) rec[k] = v;
  }
  return hasEnergyData(rec) ? rec : null;
}

/**
 * The before/after energy comparison.
 *
 * "Before" is the user's pre-challenge baseline when they gave one, otherwise
 * the earliest rated days of the challenge. "After" is the latest rated days,
 * and it NEVER overlaps a derived baseline window — comparing a stretch of days
 * against itself would manufacture a change out of nothing.
 */
export function energyComparison({ days, endDayNum, baseline = null, windowSize = WINDOW_SIZE } = {}) {
  const rated = ratedDays(days, endDayNum);
  const base = normalizeBaseline(baseline);

  let beforeRecords, afterRecords, source;
  if (base) {
    source = 'baseline';
    beforeRecords = [base];
    afterRecords = rated.slice(-windowSize);
  } else {
    source = 'derived';
    // Early days vs final days, both sides sized to what the run actually
    // produced so they stay balanced and never overlap.
    const w = effectiveWindow(windowSize, rated.length);
    beforeRecords = rated.slice(0, w);
    afterRecords = rated.slice(w).slice(-w);
  }

  const need = base ? MIN_RATED_DAYS.withBaseline : MIN_RATED_DAYS.derived;
  const enoughData = rated.length >= need && afterRecords.length > 0 && beforeRecords.length > 0;

  const before = averageEnergy(beforeRecords);
  const after = averageEnergy(afterRecords);

  const dimensions = ENERGY_FIELDS.map(f => ({
    key: f.key,
    label: f.label,
    short: f.short,
    icon: f.icon,
    before: before[f.key],
    after: after[f.key],
    // A dimension the user rated at only one end cannot be compared, and is
    // reported as such rather than silently dropped or shown as a change.
    pct: (before[f.key] != null && after[f.key] != null) ? pctChange(before[f.key], after[f.key]) : null,
  }));

  // The headline number is the mean of whichever dimensions were actually rated
  // at both ends, so a user who only ever filled in "Overall" still gets a real
  // answer instead of a blank.
  const comparable = dimensions.filter(d => d.before != null && d.after != null);
  const overallBefore = mean(comparable.map(d => d.before));
  const overallAfter = mean(comparable.map(d => d.after));

  return {
    enoughData,
    source,
    ratedDayCount: rated.length,
    beforeDays: beforeRecords.filter(r => r.dayNumber).map(r => r.dayNumber),
    afterDays: afterRecords.map(r => r.dayNumber),
    average: {
      before: overallBefore,
      after: overallAfter,
      pct: pctChange(overallBefore, overallAfter),
    },
    dimensions,
  };
}

/**
 * How associations must be worded.
 *
 * These are observational patterns from one person's self-report over ten days.
 * They can be real and still have nothing to do with the habit — a good week
 * raises both the habit and the energy. Every phrase here is associative.
 */
export const ASSOCIATION_PHRASING = {
  sameDay: (label, diff, dim) =>
    `Your ${dim} averaged ${diff} ${diff === 1 ? 'point' : 'points'} higher on days you completed ${label}.`,
  nextDay: (label, diff, dim) =>
    `Your ${dim} averaged ${diff} ${diff === 1 ? 'point' : 'points'} higher after nights you completed ${label}.`,
  caveat: 'These are patterns in what you logged, not proof of cause. Your own ratings over a few weeks can show what went together — not what made what happen.',
};

/** Minimum days on each side, and minimum gap, before a pattern is surfaced. */
export const ASSOCIATION_MIN = { perGroup: 2, diff: 0.5 };

/**
 * Associations between completing a daily habit and energy.
 *
 * `lagKeys` names the habits compared against the NEXT day's rating instead of
 * the same day's — sleep is the obvious one: last night's sleep shows up in
 * today's energy, not yesterday's.
 *
 * Only habits with enough days on BOTH sides of the split are considered, so a
 * habit completed every single day (or never) produces no pattern rather than a
 * fake one.
 */
export function energyAssociations({ days, endDayNum, tasks = [], lagKeys = [], dimension = 'overallEnergy' } = {}) {
  const out = [];
  const dimLabel = (ENERGY_FIELDS.find(f => f.key === dimension) || ENERGY_FIELDS[2]).label.toLowerCase();

  for (const task of tasks) {
    if (!task?.id) continue;
    const lagged = lagKeys.includes(task.habitKey) || lagKeys.includes(task.id);
    const done = [], notDone = [];
    for (let n = 1; n <= (endDayNum || 0); n++) {
      const behaviourDay = days?.[n];
      if (!behaviourDay) continue;
      const ratingDay = lagged ? days?.[n + 1] : behaviourDay;
      const value = ratingOf(ratingDay, lagged ? 'afternoonEnergy' : dimension)
        ?? ratingOf(ratingDay, dimension);
      if (value === null || value === undefined) continue;
      (behaviourDay.tasks?.[task.id] ? done : notDone).push(value);
    }
    if (done.length < ASSOCIATION_MIN.perGroup || notDone.length < ASSOCIATION_MIN.perGroup) continue;
    const a = mean(done), b = mean(notDone);
    if (a == null || b == null) continue;
    const diff = Math.round((a - b) * 10) / 10;
    if (Math.abs(diff) < ASSOCIATION_MIN.diff) continue;

    const usedDim = lagged ? 'afternoon energy' : dimLabel;
    out.push({
      taskId: task.id,
      habitKey: task.habitKey || task.id,
      label: task.name,
      lagged,
      higher: diff > 0,
      diff: Math.abs(diff),
      withHabit: a,
      withoutHabit: b,
      daysWith: done.length,
      daysWithout: notDone.length,
      text: diff > 0
        ? (lagged ? ASSOCIATION_PHRASING.nextDay : ASSOCIATION_PHRASING.sameDay)(task.name, Math.abs(diff), usedDim)
        : `Your ${usedDim} averaged ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'point' : 'points'} lower on days you completed ${task.name} — likely a coincidence of timing over ten days rather than anything about the habit.`,
    });
  }

  // Strongest pattern first; a stable tiebreak keeps the order deterministic.
  return out.sort((x, y) => (y.diff - x.diff) || x.taskId.localeCompare(y.taskId));
}

/**
 * Average energy per challenge week — the trajectory a longer run can show that
 * two endpoints cannot.
 *
 * A challenge week is the same fixed 7-day block from the challenge start that
 * the rest of Forge uses. Weeks with no ratings are reported with a null average
 * rather than dropped, so a gap reads as a gap.
 */
export function weeklyEnergyTrajectory({ days, endDayNum, dimension = 'overallEnergy' } = {}) {
  const weeks = [];
  for (let start = 1; start <= (endDayNum || 0); start += 7) {
    const end = Math.min(start + 6, endDayNum);
    const values = [];
    for (let n = start; n <= end; n++) {
      const v = ratingOf(days?.[n], dimension);
      if (v !== null) values.push(v);
    }
    weeks.push({
      week: Math.ceil(start / 7),
      startDay: start,
      endDay: end,
      ratedDays: values.length,
      average: mean(values),
    });
  }
  return weeks;
}

/**
 * The complete energy result for a finished attempt — the object the completion
 * screen renders.
 *
 * `windowSize` and `maxAssociations` scale with the chosen duration: a longer
 * run smooths over more days and can surface more patterns, because it has more
 * observations. The evidence bar for a pattern never moves — only how many of
 * the patterns that clear it are shown.
 */
export function buildEnergySummary({
  days, endDayNum, tasks = [], baseline = null, lagKeys = [],
  windowSize = WINDOW_SIZE, maxAssociations = 4, trajectory = false, depthNote = null,
} = {}) {
  const comparison = energyComparison({ days, endDayNum, baseline, windowSize });
  const associations = comparison.enoughData
    ? energyAssociations({ days, endDayNum, tasks, lagKeys }).slice(0, maxAssociations)
    : [];
  return {
    tracked: true,
    ...comparison,
    durationDays: endDayNum,
    associations,
    // Only offered where there is more than one week to compare — a trajectory
    // of one point is not a trajectory.
    trajectory: trajectory && endDayNum > 7
      ? weeklyEnergyTrajectory({ days, endDayNum }).filter(w => w.ratedDays > 0)
      : null,
    depthNote,
    caveat: ASSOCIATION_PHRASING.caveat,
  };
}
