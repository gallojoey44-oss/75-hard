import { CHALLENGE_TEMPLATES, getTemplateById } from './challengeTemplates';
import { CONFIGURED_BUILDERS } from './configuredChallenges';
import { rulesVersionOf, versionedRule } from './habitRules';

/**
 * What a habit row SAYS, resolved when it is drawn rather than when it was
 * stored.
 *
 * A task list is written onto the profile the moment a challenge starts, and
 * everything on it — id, name, XP, target, keystone weight — belongs to that
 * attempt for its whole life. That is deliberate: a later rebalance must never
 * change what a running challenge is worth or what it requires.
 *
 * Two of those stored fields are not part of the attempt's definition at all.
 * `desc` is a sentence explaining the rule, and `guideId` points at an article.
 * Freezing those at start time meant that improving an explanation reached
 * nobody who was already using the app, and the only way to deliver it was to
 * bump the template version — which raises "Template update available" and
 * asks somebody to update their active challenge's REQUIREMENTS in order to
 * receive a better sentence. That trade is not worth making, so it is not made
 * here: this module re-resolves those two fields at render time, from the live
 * challenge definition, and writes nothing.
 *
 * The boundary is exact. Only `desc` and `guideId` are ever replaced. Anything
 * that decides whether a day counted, what it paid, or how it is graded is
 * read from the stored task, untouched.
 *
 * Where the RULE itself changed rather than its wording, data/habitRules.js
 * decides by the attempt's own stamped version, so an attempt started under the
 * old reading keeps the old sentence and is never offered the new one.
 */

/** Display-only fields. Nothing outside this list may be overlaid. */
const PRESENTATION_FIELDS = ['desc', 'guideId'];

/**
 * Guide ids by habit id, collected once from every challenge that can build a
 * task list. A guide id depends on the habit, never on the mode or the setup
 * numbers, so one map covers every attempt of every challenge.
 */
function collectGuideIds() {
  const map = new Map();
  const note = (task) => {
    if (!task?.id || !task.guideId) return;
    // First writer wins, and a later disagreement is a real conflict: two
    // challenges sharing a habit id must agree on what it is. The guide test
    // asserts this map has no such conflict.
    if (!map.has(task.id)) map.set(task.id, task.guideId);
  };
  for (const template of CHALLENGE_TEMPLATES) {
    for (const variant of Object.values(template.variants || {})) {
      for (const task of variant.start_tasks || []) note(task);
    }
  }
  for (const builders of Object.values(CONFIGURED_BUILDERS)) {
    try {
      for (const task of builders.buildTasks() || []) note(task);
    } catch {
      // A builder that needs a setup it was not given contributes nothing.
      // It cannot break the app over a missing Guide button.
    }
  }
  return map;
}

// Built on first use rather than at module load, so importing this file costs
// nothing until a task row is actually drawn.
let GUIDE_IDS = null;
/** Guide id for a habit id, or null. */
export function guideIdForHabit(taskId) {
  if (!GUIDE_IDS) GUIDE_IDS = collectGuideIds();
  return GUIDE_IDS.get(taskId) || null;
}

/** Every habit id that has a guide, for tests and tooling. */
export function guideIdMap() {
  if (!GUIDE_IDS) GUIDE_IDS = collectGuideIds();
  return new Map(GUIDE_IDS);
}

/**
 * The live `desc`/`guideId` for one habit of one attempt, or null when the
 * attempt's challenge has nothing to say about it (a custom task, or a habit
 * from a challenge this build no longer defines).
 */
export function presentationFor(task, meta) {
  if (!task?.id || !meta?.templateId) return null;

  const template = getTemplateById(meta.templateId);

  // What the challenge itself says about this habit, before any rule version
  // is considered. Variant templates state each mode's habits directly, so the
  // attempt's own mode is the exact source for both fields. A configured
  // challenge builds its habits from a setup this module cannot replay, so its
  // description stays exactly as the attempt recorded it and only the guide,
  // which depends on the habit alone, is refreshed.
  let base = null;
  const variantTasks = template?.variants?.[meta.variant]?.start_tasks;
  if (variantTasks) {
    const live = variantTasks.find(t => t.id === task.id);
    if (live) base = { desc: live.desc ?? null, guideId: live.guideId ?? null };
  }
  if (!base && template) {
    base = { desc: task.desc ?? null, guideId: guideIdForHabit(task.id) };
  }

  // A rule that changed by version then overrides what it actually changed.
  // Where it says nothing — a mode whose wording was already correct, like
  // Hard Mode's "roughly nine meals in ten" — the challenge's own sentence
  // stands. A version states a difference, not a replacement.
  const versioned = versionedRule(task.id, rulesVersionOf(meta), meta.variant || null);
  if (versioned) {
    return {
      desc: versioned.desc ?? base?.desc ?? null,
      guideId: versioned.guideId ?? base?.guideId ?? null,
    };
  }
  return base;
}

/**
 * A task list with its display-only fields resolved against the live challenge
 * definition. Returns the SAME array when nothing differs, so React sees no
 * change where there is none.
 *
 * `support` is the stacked lane's attempt, when there is one. A support-only
 * habit is resolved against ITS attempt, because the two were started at
 * different times and may be on different rule versions. A habit that serves
 * both lanes is shown in the primary lane and follows the primary's rules,
 * which is the attempt its row is listed under.
 */
export function presentTasks(tasks, meta, support = null) {
  if (!Array.isArray(tasks) || !tasks.length || !meta) return tasks;
  let changed = false;
  const out = tasks.map((task) => {
    const lanes = task.challenges;
    const supportOnly = support && Array.isArray(lanes) &&
      lanes.includes('support') && !lanes.includes('primary');
    const live = presentationFor(task, supportOnly ? support : meta);
    if (!live) return task;
    const patch = {};
    for (const field of PRESENTATION_FIELDS) {
      const next = live[field] ?? null;
      const now = task[field] ?? null;
      if (next !== now) patch[field] = next;
    }
    if (!Object.keys(patch).length) return task;
    changed = true;
    return { ...task, ...patch };
  });
  return changed ? out : tasks;
}
