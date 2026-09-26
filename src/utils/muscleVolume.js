import { dayNumberForDate } from './dateUtils';
import { weekOfDay, challengeWeeks } from './weeklyRequirements';
import {
  MUSCLE_GROUPS, defaultVolumeTargets, mbConfig,
  SPECIALIZATION, isSpecializing, priorityMuscles, rampedTarget, MICRO_WORKOUTS,
} from '../data/muscleBuildingConfig';

/**
 * Weekly hypertrophy volume — hard sets per muscle group, per challenge week.
 *
 * Sets are stored as individual entries so they can be listed, attributed to a
 * date and undone one at a time — the same shape weeklySessions uses:
 *
 *   profiles[profId].volumeSets = [{ id, muscle, sets, date }]
 *
 * Volume is a CHALLENGE-PROGRESS METRIC, not an XP source. Logging a set awards
 * no XP and never touches the challenge score, so a user cannot farm XP by
 * tapping a counter. It exists to answer "am I giving each muscle a meaningful
 * weekly dose?" and to feed the coaching insights.
 *
 * Targets are per-attempt data (meta.muscleBuilding.volumeTargets), so ~10 sets
 * is a starting reference the user can change per muscle rather than a constant
 * baked into logic. Future personalisation — training experience, priority
 * muscles, recovery, specialisation blocks — only has to write different numbers
 * into that same map.
 */

/**
 * `micro` marks a short session logged as a micro-workout.
 *
 * It is a LABEL, not a separate budget: micro-workout sets count toward the
 * same weekly target as any other sets. The point of the feature is to
 * distribute productive volume across the week, not to let someone accumulate
 * extra volume by calling it something else — so nothing here adds to a target
 * or awards anything for frequency on its own.
 */
export function makeVolumeEntry(muscle, sets, date, opts = {}) {
  return {
    id: `vol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    muscle,
    sets: Math.max(1, Math.round(sets || 1)),
    date,
    ...(opts.micro ? { micro: true } : {}),
  };
}

/**
 * True when a micro-workout entry carries enough real work to count.
 *
 * A single easy set tacked on for frequency is not a hypertrophy stimulus, so
 * it does not earn a place in the weekly count. Ordinary (non-micro) entries
 * are never filtered — the user logged a session, it counts.
 */
export function microCounts(entry) {
  if (!entry?.micro) return true;
  return (Number(entry.sets) || 0) >= MICRO_WORKOUTS.minSetsToCount;
}

/** The per-attempt weekly set targets, falling back to the shipped defaults. */
export function volumeTargets(meta) {
  const cfg = mbConfig(meta);
  return { ...defaultVolumeTargets(), ...(cfg?.volumeTargets || {}) };
}

/**
 * The targets actually in force for a given block week.
 *
 * With a specialization block running, a priority muscle's target follows the
 * RAMP from where the user was before the block toward the block target — so a
 * user coming from 6 sets is asked for 10 in week 1, not 13. Non-priority
 * muscles and balanced attempts use their stored target unchanged.
 */
export function targetsForWeek(meta, weekNumber) {
  const cfg = mbConfig(meta);
  const stored = volumeTargets(meta);
  if (!cfg || !isSpecializing(cfg) || !weekNumber) return stored;

  const spec = cfg.specialization || {};
  const weeks = spec.weeks || SPECIALIZATION.recommendedWeeks.max;
  const out = { ...stored };
  for (const id of priorityMuscles(cfg)) {
    const current = Number(spec.currentSets?.[id]);
    // No "before" figure recorded → nothing to ramp from, use the block target.
    if (!Number.isFinite(current)) continue;
    out[id] = rampedTarget({ current, target: stored[id], weeks, week: weekNumber });
  }
  return out;
}

/**
 * Distinct training days a muscle was trained on within a week — the exposure
 * count. Spreading volume across 2–3 exposures is guidance the dashboard
 * reports; it is never a requirement and never scored.
 */
export function exposuresInWeek(entries, muscle) {
  const dates = new Set();
  for (const e of entries || []) {
    if (e?.muscle !== muscle || !e.date || !microCounts(e)) continue;
    dates.add(e.date);
  }
  return dates.size;
}

/** True when this attempt tracks muscle-group volume. */
export function tracksVolume(meta) {
  return !!mbConfig(meta);
}

/** Entries that fall inside a challenge week's day span. */
export function entriesInWeek(entries, week, challengeStart) {
  if (!challengeStart || !week) return [];
  return (entries || []).filter(e => {
    if (!e?.date || !e.muscle) return false;
    // Logged before Day 1 → belongs to no challenge week (dayNumberForDate
    // clamps to 1, so the date must be rejected explicitly).
    if (e.date < challengeStart) return false;
    const day = dayNumberForDate(challengeStart, e.date);
    return day != null && day >= week.startDay && day <= week.endDay;
  });
}

/** The challenge week containing a raw day number, or null. */
export function weekForDay(meta, rawDay) {
  if (!rawDay) return null;
  const weeks = challengeWeeks(meta);
  const n = weekOfDay(Math.min(rawDay, meta?.durationDays || rawDay));
  return weeks.find(w => w.week === n) || null;
}

/**
 * Volume state for one challenge week.
 *
 * Returns per-muscle { done, target, pct, met } rows plus week totals, so the UI
 * can render "Chest: 8 / 10 sets" without recomputing anything.
 */
export function weeklyVolume({ entries, meta, challengeStart, rawDay }) {
  const week = weekForDay(meta, rawDay);
  if (!week || !tracksVolume(meta)) {
    // Same shape as the supported case, so a caller can read priorityRows /
    // specializing without guarding for the unsupported path.
    return {
      supported: false, week: null, rows: [], specializing: false,
      priorityRows: [], otherRows: [], totalDone: 0, totalTarget: 0, pct: 0, metCount: 0,
    };
  }
  const cfg = mbConfig(meta);
  const targets = targetsForWeek(meta, week.week);
  const priority = priorityMuscles(cfg);
  const specializing = priority.length > 0;
  const exposureTarget = cfg?.specialization?.exposures ?? SPECIALIZATION.exposures.suggested;
  // Micro-workouts too small to be a real stimulus are excluded from the count.
  const logged = entriesInWeek(entries, week, challengeStart).filter(microCounts);
  const done = {};
  for (const e of logged) done[e.muscle] = (done[e.muscle] || 0) + e.sets;

  const rows = MUSCLE_GROUPS.map(m => {
    const target = targets[m.id] ?? m.defaultTarget;
    const d = done[m.id] || 0;
    const isPriority = priority.includes(m.id);
    const exposures = exposuresInWeek(logged, m.id);
    return {
      id: m.id, label: m.label, icon: m.icon, major: m.major,
      done: d, target,
      pct: target > 0 ? Math.min(100, Math.round((d / target) * 100)) : 0,
      met: target > 0 && d >= target,
      priority: isPriority,
      exposures,
      // Only meaningful for priority muscles; the dashboard shows it there.
      exposureTarget: isPriority ? exposureTarget : null,
      exposuresMet: !isPriority || exposures >= Math.min(exposureTarget, SPECIALIZATION.exposures.min),
      microSets: logged.filter(e => e.muscle === m.id && e.micro).reduce((sum, e) => sum + e.sets, 0),
    };
  });

  const totalDone = rows.reduce((s, r) => s + r.done, 0);
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  return {
    supported: true,
    week,
    rows,
    specializing,
    priorityRows: rows.filter(r => r.priority),
    otherRows: rows.filter(r => !r.priority),
    totalDone,
    totalTarget,
    pct: totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0,
    metCount: rows.filter(r => r.met).length,
  };
}

/**
 * Volume adherence across every FINALISED week — the input signal the coaching
 * feedback uses. The in-progress week is excluded so an unfinished week is never
 * read as a shortfall.
 */
export function volumeAdherence({ entries, meta, challengeStart, rawDay }) {
  if (!tracksVolume(meta) || !rawDay || !challengeStart) return null;
  const targets = volumeTargets(meta);
  let done = 0, target = 0, weeks = 0;
  for (const week of challengeWeeks(meta)) {
    if (week.endDay >= rawDay) continue;           // not finalised yet
    weeks++;
    const logged = entriesInWeek(entries, week, challengeStart).filter(microCounts);
    const per = {};
    for (const e of logged) per[e.muscle] = (per[e.muscle] || 0) + e.sets;
    const weekTargets = targetsForWeek(meta, week.week);
    for (const m of MUSCLE_GROUPS) {
      const t = weekTargets[m.id] ?? targets[m.id] ?? m.defaultTarget;
      target += t;
      done += Math.min(per[m.id] || 0, t);         // credit capped at the target
    }
  }
  if (!weeks) return null;
  return { weeks, done, target, pct: target > 0 ? Math.round((done / target) * 100) : 0 };
}
