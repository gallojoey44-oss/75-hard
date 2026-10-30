/**
 * Habit rules that changed, and the attempts each version applies to.
 *
 * Some habits were defined loosely enough that people could reasonably read
 * them two ways — "Sleep 7.5+ hours" never said in bed or asleep, "Eat mostly
 * whole foods (80%+)" never said 80% of what, and Mental Training's own copy
 * named breathwork, meditation or prayer while the habit was labelled
 * MEDITATION. Settling those is a change to what completing the habit means,
 * and an attempt that is already running was started under the old reading.
 *
 * So the rule is versioned per ATTEMPT rather than globally. A new attempt is
 * stamped with HABIT_RULES_VERSION at the moment it starts; an attempt begun
 * before this existed has no stamp and is version 1 for life. Nothing is
 * rewritten, nothing is migrated, and no one is prompted to update: an archived
 * challenge keeps the rules it was graded under, and an active one keeps the
 * rules it was started under.
 *
 * What a version controls is DISPLAY ONLY — the sentence under the habit name
 * and whether a strategy guide is offered. No XP figure, target, keystone
 * weighting or completion check reads this file. A rule change here changes
 * what Forge TELLS you a habit means; it cannot retroactively mark a day
 * complete or incomplete.
 *
 * Adding a version: bump HABIT_RULES_VERSION, add the new entry under the
 * habit's id, and leave every earlier entry exactly as it is.
 */

/** Stamped onto every attempt started from now on. */
export const HABIT_RULES_VERSION = 2;

/** The rules version an attempt was started under. Unstamped means version 1. */
export function rulesVersionOf(meta) {
  const v = Number(meta?.habitRulesVersion);
  return Number.isFinite(v) && v >= 1 ? v : 1;
}

/**
 * Habits whose stated rule differs by version, as `{ id: { version: {...} } }`.
 *
 * `desc` is the line under the habit name; `guideId` is the strategy guide
 * offered, or null for none. A version that is absent inherits the highest
 * version at or below it, so only the versions where something actually
 * changed need an entry.
 */
export const VERSIONED_HABITS = {
  // ── Mental Training's core habit ─────────────────────────────────────────
  // Version 1 is the rule as the challenge's own rationale copy states it:
  // "a few focused minutes of breathwork, meditation, or prayer". It had no
  // description at all, so stating it is the one thing here that tells an
  // existing attempt something it was not already being held to.
  //
  // Version 2 makes mindfulness and visualization eligible, and moves prayer
  // out — Mental Training already has a separate Prayer habit worth its own
  // XP, and one practice should not tick two requirements that were meant to
  // be separate. Attempts on version 1 keep prayer, exactly as started.
  mt_mind: {
    1: {
      desc: 'Breathwork, meditation or prayer. Following your breath quietly counts.',
      guideId: null,
    },
    2: {
      desc: 'Meditation, mindfulness, breathwork or visualization.',
      guideId: 'mental:mind',
    },
  },

  // ── Sleep: opportunity, not hours asleep ────────────────────────────────
  // LOCK IN and Energy Reset already call this sleep opportunity and say so on
  // the card. Fat Loss and Muscle Building carried a number and no sentence,
  // so the two of them were quietly measuring something the other two were
  // not. Version 2 aligns all four.
  // Fat Loss states the rule and keeps its own reason for caring about it:
  // Hard Mode's card already connected sleep to reading hunger, and that is
  // worth more on the row than a second sentence about the opportunity.
  fl_sleep: {
    1: { desc: null, guideId: null },
    2: { desc: 'Time in bed, not time asleep. Short sleep makes hunger harder to read.', guideId: 'fatloss:sleep' },
  },
  mb_sleep: {
    1: { desc: null, guideId: null },
    2: { desc: 'Time in bed, not time asleep. Give yourself the opportunity.', guideId: 'muscle:sleep' },
  },

  // ── Whole foods: the unit is meals ──────────────────────────────────────
  // The percentage was in the habit's name and nowhere else, so "80% of what"
  // had no answer in Beginner or Standard. Hard Mode already answered it on
  // its own card — "roughly nine meals in ten" — and version 2 applies that
  // reading to the other modes. Hard Mode's own copy is untouched: it never
  // needed this.
  //
  // The percentage itself follows the mode, so the sentence does too.
  fl_whole: {
    1: { desc: null, guideId: null },
    // Hard Mode is absent on purpose: its card already says "roughly nine
    // meals in ten", so there is nothing for this version to change there and
    // its own wording stands.
    2: { desc: null, guideId: 'fatloss:whole', descByVariant: {
      beginner: 'Roughly eight meals in ten minimally processed. Not a ban list.',
      standard: 'Roughly nine meals in ten minimally processed. Not a ban list.',
    } },
  },
};

/**
 * The rule for a habit under a given version, or null when the habit has no
 * versioned rule at all. `variant` selects a mode-specific sentence where one
 * exists (the whole-foods percentage differs between Beginner and Standard).
 */
export function versionedRule(taskId, version, variant = null) {
  const byVersion = VERSIONED_HABITS[taskId];
  if (!byVersion) return null;
  // Inherit downwards: a version with no entry of its own follows the most
  // recent one at or below it, so adding version 3 for one habit does not mean
  // restating every other habit's unchanged rule.
  let found = null;
  for (const key of Object.keys(byVersion).map(Number).sort((a, b) => a - b)) {
    if (key <= version) found = byVersion[key];
  }
  if (!found) return null;
  const desc = (variant && found.descByVariant?.[variant]) || found.desc || null;
  return { desc, guideId: found.guideId ?? null };
}
