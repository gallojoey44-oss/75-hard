import { RIR_GUIDANCE } from '../data/muscleBuildingConfig';

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
