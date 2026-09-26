import { RIR_GUIDANCE } from '../data/muscleBuildingConfig';
import { dayNumberForDate } from './dateUtils';

/**
 * Exercise logging and progressive-overload trends.
 *
 * Forge had no workout logging before Muscle Building, so this is a deliberately
 * small first version: entries are flat records on the profile, in the same
 * individually-addressable shape the rest of Forge uses.
 *
 *   profiles[profId].exerciseLog = [{ id, date, exercise, load, reps, sets, rir }]
 *
 * `rir` (reps in reserve) is OPTIONAL. Forge never requires it, never scores it
 * and never awards XP for it — the 0–3 RIR guidance is educational (see
 * RIR_GUIDANCE), and logging it simply makes the trend read better.
 *
 * Progression is judged on VOLUME LOAD per session (load × reps × sets), which
 * captures every progression route the challenge cares about — more reps at the
 * same load, more load at similar reps, or more productive volume — rather than
 * demanding a heavier top set every time. A session that does not beat the last
 * one is never a failure: the trend compares recent work against earlier work,
 * so a single flat or lighter session cannot mark an exercise as regressing.
 */

/** Normalise a free-text exercise name into a stable grouping key. */
export function exerciseKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function makeExerciseEntry({ exercise, load, reps, sets, rir, date }) {
  const name = String(exercise || '').trim();
  if (!name) return null;
  return {
    id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    exercise: name,
    load: Number(load) || 0,
    reps: Math.max(0, Math.round(Number(reps) || 0)),
    sets: Math.max(1, Math.round(Number(sets) || 1)),
    // Optional. Stored only when the user actually supplied it.
    ...(rir === '' || rir == null ? {} : { rir: Math.max(0, Math.round(Number(rir))) }),
  };
}

/** Total work in one logged entry — the comparable quantity across sessions. */
export function volumeLoad(entry) {
  if (!entry) return 0;
  return (Number(entry.load) || 0) * (Number(entry.reps) || 0) * (Number(entry.sets) || 1);
}

/** Entries grouped by exercise, each sorted oldest → newest. */
export function groupByExercise(entries) {
  const map = new Map();
  for (const e of entries || []) {
    if (!e?.exercise || !e.date) continue;
    const k = exerciseKey(e.exercise);
    if (!map.has(k)) map.set(k, { key: k, name: e.exercise, entries: [] });
    map.get(k).entries.push(e);
  }
  for (const g of map.values()) g.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return [...map.values()];
}

/** How much the recent window must beat the earlier one to count as a move. */
const MEANINGFUL_CHANGE = 0.03;   // 3%
const MIN_SESSIONS = 4;           // below this there is not enough history to judge

/**
 * Trend for one exercise: 'progressing' | 'holding' | 'declining' | null.
 *
 * Compares the average volume load of the most recent half of its sessions with
 * the earlier half. Averaging both windows is what stops one heavy or one light
 * session from flipping the verdict. Returns null — not a verdict — when there
 * is too little history, so the UI can stay quiet instead of guessing.
 */
export function exerciseTrend(group) {
  const list = (group?.entries || []).filter(e => volumeLoad(e) > 0);
  if (list.length < MIN_SESSIONS) {
    return { key: group?.key, name: group?.name, sessions: list.length, trend: null };
  }
  const half = Math.floor(list.length / 2);
  const avg = arr => arr.reduce((s, e) => s + volumeLoad(e), 0) / arr.length;
  const earlier = avg(list.slice(0, half));
  const recent = avg(list.slice(-half));
  const change = earlier > 0 ? (recent - earlier) / earlier : 0;

  let trend = 'holding';
  if (change >= MEANINGFUL_CHANGE) trend = 'progressing';
  else if (change <= -MEANINGFUL_CHANGE) trend = 'declining';

  const best = list.reduce((a, b) => (volumeLoad(b) > volumeLoad(a) ? b : a), list[0]);
  return {
    key: group.key,
    name: group.name,
    sessions: list.length,
    trend,
    changePct: Math.round(change * 100),
    latest: list[list.length - 1],
    best,
  };
}

/** Trends for every exercise with enough history, best movers first. */
export function performanceTrends(entries) {
  return groupByExercise(entries)
    .map(exerciseTrend)
    .filter(t => t.trend != null)
    .sort((a, b) => (b.changePct || 0) - (a.changePct || 0));
}

/** One-line summaries, e.g. "Your incline dumbbell press is progressing." */
export function trendSummaries(entries, limit = 3) {
  const wording = {
    progressing: name => `Your ${name.toLowerCase()} is progressing.`,
    holding: name => `Your ${name.toLowerCase()} is holding steady.`,
    declining: name => `Your ${name.toLowerCase()} has dipped recently — worth a look at recovery or fatigue.`,
  };
  return performanceTrends(entries).slice(0, limit).map(t => ({ ...t, text: wording[t.trend](t.name) }));
}

/**
 * The overall performance signal used by the feedback system: the share of
 * tracked exercises that are progressing, or null when nothing has enough
 * history yet.
 */
export function overallPerformance(entries) {
  const trends = performanceTrends(entries);
  if (!trends.length) return null;
  const progressing = trends.filter(t => t.trend === 'progressing').length;
  const declining = trends.filter(t => t.trend === 'declining').length;
  return {
    tracked: trends.length,
    progressing,
    declining,
    pct: Math.round((progressing / trends.length) * 100),
    // "Flat" means nothing is moving up — the stall signal, not a failure.
    flat: progressing === 0,
  };
}

/** Educational RIR guidance — never a checkbox, never scored. */
export const RIR = RIR_GUIDANCE;

// ── Progressive overload, properly defined ──────────────────────────────────
/**
 * Progression is NOT "add weight every workout".
 *
 * Forge recognises every route that actually represents a better performance:
 *
 *   reps      — more reps at the same load
 *   load      — more load at comparable reps
 *   volume    — additional productive sets, where appropriate
 *   execution — better ROM/control at comparable load, or the same work at a
 *               lower RIR (more in reserve for the same result)
 *
 * Double progression falls out of this naturally: 60×8 → 60×9 → 60×10 → 60×12
 * → 65×8 is five consecutive successful sessions, and the last one is a
 * progression even though reps dropped, because load rose.
 */
export const PROGRESSION_ROUTES = [
  { id: 'reps', label: 'More reps at the same load' },
  { id: 'load', label: 'More load at comparable reps' },
  { id: 'sets', label: 'Additional productive sets, when appropriate' },
  { id: 'execution', label: 'Better range of motion or control at the same load' },
  { id: 'rir', label: 'The same performance with more left in reserve' },
];

export const DOUBLE_PROGRESSION = {
  title: 'Double progression',
  body: 'Pick a rep range — say 8–12. Work up within it at the same load, and once you reach the top of the range, add load and start again near the bottom.',
  example: ['60 lb × 8', '60 lb × 9', '60 lb × 10', '60 lb × 12', '65 lb × 8'],
  note: 'Every one of those is a successful session. You are not failing a week because the bar did not move.',
};

/** Rep-range tolerance for treating two sessions' reps as "comparable". */
const COMPARABLE_REPS = 1;

/**
 * How far reps may fall on a load increase and still count as progression.
 *
 * Double progression works UP a rep range and then resets near the bottom with
 * more load — 60×12 → 65×8 is the intended move, not a regression, even though
 * both reps and volume load drop. 8 is 67% of 12, so a floor of 0.6 accepts a
 * normal range reset while still rejecting a collapse like 12 → 3.
 */
const LOAD_JUMP_REP_FLOOR = 0.6;

/**
 * Classify one session against the one before it: which progression route, if
 * any, it represents. Returns null when there is nothing to compare against.
 */
export function classifyProgression(prev, curr) {
  if (!prev || !curr) return null;
  const pLoad = Number(prev.load) || 0, cLoad = Number(curr.load) || 0;
  const pReps = Number(prev.reps) || 0, cReps = Number(curr.reps) || 0;
  const pSets = Number(prev.sets) || 1, cSets = Number(curr.sets) || 1;
  const repsComparable = Math.abs(cReps - pReps) <= COMPARABLE_REPS;

  if (cLoad > pLoad && (repsComparable || cReps >= pReps)) return 'load';
  // The double-progression reset: more load, reps back toward the bottom of the
  // range. Progression, even though reps and total volume load both dip.
  if (cLoad > pLoad && pReps > 0 && cReps >= Math.ceil(pReps * LOAD_JUMP_REP_FLOOR)) return 'load';
  if (cLoad === pLoad && cReps > pReps) return 'reps';
  if (cLoad === pLoad && cReps === pReps && cSets > pSets) return 'sets';
  // Same work, more left in the tank.
  if (cLoad === pLoad && cReps === pReps && cSets === pSets &&
      prev.rir != null && curr.rir != null && curr.rir > prev.rir) return 'rir';
  return null;
}

/** Every progression step within one exercise's history, oldest first. */
export function progressionSteps(group) {
  const list = (group?.entries || []).filter(e => volumeLoad(e) > 0);
  const out = [];
  for (let i = 1; i < list.length; i++) {
    const route = classifyProgression(list[i - 1], list[i]);
    if (route) out.push({ from: list[i - 1], to: list[i], route, date: list[i].date });
  }
  return out;
}

/** Weeks since this exercise last progressed by any route, or null. */
export function weeksSinceProgress(group, challengeStart, todayDate) {
  const steps = progressionSteps(group);
  if (!challengeStart || !todayDate) return null;
  const last = steps.length ? steps[steps.length - 1].date : (group?.entries?.[0]?.date || null);
  if (!last) return null;
  const lastDay = dayNumberForDate(challengeStart, last);
  const today = dayNumberForDate(challengeStart, todayDate);
  if (lastDay == null || today == null) return null;
  return Math.max(0, Math.floor((today - lastDay) / 7));
}

/** Consecutive weeks of no progression before the stall insight fires. */
export const STALL_WEEKS = 3;

/**
 * The stall signal: MOST tracked exercises showing no meaningful progression
 * for roughly 3–4 weeks.
 *
 * Deliberately conservative — it needs several tracked exercises and a real
 * stretch of time, because a training block with one flat exercise is normal
 * and telling someone they have stalled when they have not is worse than
 * staying quiet.
 */
export function stallInsight({ entries, challengeStart, todayDate, minExercises = 2 }) {
  const groups = groupByExercise(entries).filter(g => (g.entries || []).length >= MIN_SESSIONS);
  if (groups.length < minExercises) return null;
  const stalled = groups.filter(g => {
    const w = weeksSinceProgress(g, challengeStart, todayDate);
    return w != null && w >= STALL_WEEKS;
  });
  if (stalled.length < Math.ceil(groups.length / 2)) return null;
  return {
    stalled: stalled.length,
    tracked: groups.length,
    weeks: STALL_WEEKS,
    text: 'Performance has stalled. Review training volume, nutrition, sleep, and recovery.',
    exercises: stalled.map(g => g.name),
  };
}
