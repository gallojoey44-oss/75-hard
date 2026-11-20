import * as LI from './lockInConfig';
import * as FLG from './fatLossGuides';
import * as MTG from './mentalTrainingGuides';
import * as MBG from './muscleBuildingGuides';
import * as ERG from './energyResetGuides';
import * as HHG from './hormoneHealthGuides';
import { EVIDENCE, EVIDENCE_META, EVIDENCE_LEGEND } from './evidence';

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
  ...namespaced(LI.GUIDE_SOURCE, LI.GUIDES),
  ...namespaced(FLG.GUIDE_SOURCE, FLG.GUIDES),
  ...namespaced(MTG.GUIDE_SOURCE, MTG.GUIDES),
  ...namespaced(MBG.GUIDE_SOURCE, MBG.GUIDES),
  ...namespaced(ERG.GUIDE_SOURCE, ERG.GUIDES),
  ...namespaced(HHG.GUIDE_SOURCE, HHG.GUIDES),
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
 * everywhere. Introduced by LOCK IN; it moved to its own module once other
 * challenges had guides of their own.
 */
export { EVIDENCE, EVIDENCE_META, EVIDENCE_LEGEND };
