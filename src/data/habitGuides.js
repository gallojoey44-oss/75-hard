import * as LI from './lockInConfig';

/**
 * Habit strategy guides — the shared registry.
 *
 * A task may carry a `guideId`. When it does, the daily task row offers a way
 * into a full strategy guide for that habit, and the guide renders from data
 * alone. This registry is what keeps the UI challenge-agnostic: DailyView and
 * CheckItem know about `guideId` and nothing about which challenge supplied it,
 * so a future challenge gets guides by adding its module here.
 *
 * Guide ids are namespaced by their source module, because two challenges may
 * both want a guide called "sleep" without meaning the same thing by it.
 *
 * The guide shape is documented in lockInConfig.GUIDES. Every guide must have:
 *   id, title, icon, tagline, quickStart[], why{}, how{}, optimize[],
 *   advanced[], mistakes[], examples[]
 */

/** `${source}:${id}` — the id a task stores in `guideId`. */
function namespaced(source, guides) {
  return Object.fromEntries(
    Object.entries(guides).map(([id, g]) => [`${source}:${id}`, { ...g, source }]),
  );
}

export const HABIT_GUIDES = {
  ...namespaced('lockin', LI.GUIDES),
};

/** Full guide id for a source module's local guide id. */
export function guideId(source, id) {
  return id ? `${source}:${id}` : null;
}

/** A guide by its full id, or null when the task has none. */
export function getGuide(id) {
  return (id && HABIT_GUIDES[id]) || null;
}

/** The guide a task points at, or null. */
export function guideForTask(task) {
  return getGuide(task?.guideId);
}

/** True when a task has an attached strategy guide. */
export function hasGuide(task) {
  return !!guideForTask(task);
}

/**
 * Evidence labelling, shared by every guide so the legend means the same thing
 * everywhere. Sourced from LOCK IN, which introduced it.
 */
export const EVIDENCE = LI.EVIDENCE;
export const EVIDENCE_META = LI.EVIDENCE_META;
export const EVIDENCE_LEGEND = LI.EVIDENCE_LEGEND;
