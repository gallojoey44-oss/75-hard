import {
  MENTAL_TRAINING_TEMPLATE_ID, applyColdExposureUpgrade, getCompletionBonusForDuration,
  getTemplateById, getDefaultDuration,
} from './challengeTemplates';
import { buildersFor } from './configuredChallenges';
import * as FLH from './fatLossHardConfig';
import { stampAttempt } from '../utils/xpAttempt';
import { dayRules, bonusCapForAttempt, TIER_LABELS, economyFor, economyVersionOf } from './xpEconomy';
import {
  getWeeklyRequirementDefs, hasWeeklyRequirements, computeWeeklyRequirements,
} from '../utils/weeklyRequirements';
import { DEFAULT_PASSING_SCORE, DEFAULT_KEYSTONE_REQUIREMENT } from '../utils/gamification';

/**
 * Building an attempt — once, for both the preview and the start.
 *
 * The Challenge Library used to describe a challenge's XP with hand-written
 * strings (`'⭐⭐⭐ Mental Training — 5 minutes (100 XP).'`) while the attempt was
 * assembled separately inside ChallengesView and then repriced by
 * `stampAttempt`. Two descriptions of the same thing, so they drifted: after the
 * era-2 rebalance the library still advertised era-1 figures — Mental Training
 * at 100 XP a task and 270 XP a day against an actual 160.
 *
 * The fix is structural rather than a correction. `buildAttemptPayload` is the
 * ONE place an attempt is constructed, and `previewAttempt` is that same payload
 * run through the same `stampAttempt` the start flow uses. What the library
 * shows is therefore what starting it produces, by construction — there is no
 * second set of numbers to keep in step.
 *
 * Adding a challenge means teaching this module how to build it, and the
 * library previews it correctly with no further work.
 */

/**
 * Scoring defaults for a NEWLY started attempt, applied only under whatever the
 * chosen template supplies. Deliberately carries no identity and no duration —
 * a new attempt's templateId, name, emoji, variant and durationDays must come
 * from the selected challenge, so nothing can leak in from a previous one.
 *
 * Lives here rather than in AppContext because the preview has to apply exactly
 * the same defaults the start does; two copies would be the original bug again.
 */
export const NEW_ATTEMPT_DEFAULTS = {
  variant: null,
  durationDays: null,
  passingScore: DEFAULT_PASSING_SCORE,
  keystoneRequirement: DEFAULT_KEYSTONE_REQUIREMENT,
  completionBonusXP: 0,
};

/**
 * The `{ challenge, tasks, bonusMissions }` payload for an attempt of this
 * template, mode, duration and setup — unstamped, exactly as the start flow
 * passes it to `startChallenge`.
 *
 * `legacy` carries the 75-Day Discipline descriptor and task list, which live in
 * AppContext (they are per-profile defaults, not template data) and are passed
 * in rather than imported, so this module stays free of the context.
 */
export function buildAttemptPayload({
  template,
  variant = null,
  durationDays = null,
  configuredSetup = null,
  coldExposureUpgradeEnabled = false,
  hardSetup = null,
  legacy = null,
} = {}) {
  if (!template && !legacy) return null;

  // A configured challenge builds its whole attempt — meta, weekly requirements
  // and daily task list — from its own config module. Nothing is assembled here.
  const builders = buildersFor(template);
  if (builders) {
    const setup = configuredSetup ?? undefined;
    return {
      challenge: {
        ...builders.buildMeta(setup),
        passingScore: template.passing_score ?? DEFAULT_PASSING_SCORE,
        keystoneRequirement: template.keystone_requirement ?? DEFAULT_KEYSTONE_REQUIREMENT,
        rewardXP: template.rewards?.xp || 0,
        badgeId: template.rewards?.badge_id || null,
      },
      tasks: builders.buildTasks(setup),
      bonusMissions: [],
    };
  }

  if (legacy) {
    // 75-Day Discipline is one library challenge like any other: it passes its
    // own descriptor and its own task set explicitly.
    return {
      challenge: { ...legacy.meta },
      tasks: legacy.tasks,
      bonusMissions: template?.bonus_missions || [],
    };
  }

  const mode = variant || 'standard';
  const variantDef = template.variants?.[mode];
  // A mode with no task list of its own cannot be built into an attempt. The
  // 75-Day challenge is the one case — its list is a per-profile default,
  // passed in as `legacy` — and every other such template is unbuilt and not
  // startable. Returning null is what stops an empty attempt being previewed
  // as though it were worth its tier's budget.
  if (!variantDef?.start_tasks?.length) return null;
  const days = durationDays ?? getDefaultDuration(template);

  // Cold Exposure Upgrade applies only to Mental Training. The choice is locked
  // onto THIS attempt's challenge rules, and the required Cold Shower task is
  // generated into the daily task list only when enabled.
  const coldEnabled = template.id === MENTAL_TRAINING_TEMPLATE_ID && coldExposureUpgradeEnabled === true;
  // Fat Loss HARD MODE builds its own daily tasks, weekly requirements and
  // config from fatLossHardConfig. Beginner and Standard fall through to the
  // template's own start_tasks and the legacy weekly requirements.
  const hardFatLoss = template.id === FLH.FAT_LOSS_TEMPLATE_ID && mode === FLH.HARD_VARIANT;
  const setup = hardFatLoss ? (hardSetup || FLH.defaultSetup()) : null;

  return {
    challenge: {
      templateId: template.id,
      name: template.challenge_name,
      emoji: template.emoji,
      variant: mode,
      durationDays: days,
      templateVersion: template.template_version || 1,
      rewardXP: template.rewards?.xp || 0,
      // Challenge Performance config (percentage score system). The completion
      // bonus follows the CHOSEN duration for templates that define a
      // per-duration table; others keep their flat reward. Era 2 replaces it
      // with a budget-derived figure during stamping either way.
      completionBonusXP: getCompletionBonusForDuration(template, days),
      passingScore: template.passing_score ?? DEFAULT_PASSING_SCORE,
      keystoneRequirement: template.keystone_requirement ?? DEFAULT_KEYSTONE_REQUIREMENT,
      badgeId: template.rewards?.badge_id || null,
      coldExposureUpgradeEnabled: coldEnabled,
      ...(hardFatLoss ? {
        fatLossHard: FLH.buildConfig(setup),
        weeklyRequirementDefs: FLH.weeklyRequirementDefs(),
      } : {}),
    },
    tasks: hardFatLoss
      ? FLH.buildStartTasks(setup)
      : applyColdExposureUpgrade(variantDef.start_tasks, coldEnabled),
    bonusMissions: template.bonus_missions || [],
  };
}

/**
 * The preview for a CONFIGURED challenge at a given setup state.
 *
 * The setup screens re-render this on every change, so a duration, a target or
 * an opt-in optimization reprices the whole requirement list in front of the
 * user — which is the honest thing to show, because adding a requirement
 * divides the same daily budget rather than adding to it.
 */
export function previewConfigured(templateId, setup = null) {
  return previewAttempt({ template: getTemplateById(templateId), configuredSetup: setup });
}

/** A date far enough in the past that every week of an attempt is finalised. */
const PROJECTION_START = '2020-01-01';

/**
 * Total weekly-requirement XP available across a whole attempt.
 *
 * Read from the engine's own `availableXP` rather than recomputed, with the
 * current day pushed past the final day so every week is finalised and counted.
 */
function weeklyAvailableXP(meta) {
  if (!hasWeeklyRequirements(meta) || !meta?.durationDays) return 0;
  const res = computeWeeklyRequirements({
    sessions: [],
    meta: { ...meta, weeklyRequirementsStartDate: PROJECTION_START },
    challengeStart: PROJECTION_START,
    currentRawDay: Number(meta.durationDays) + 1,
    penaltiesEnabled: false,
  });
  return res.availableXP;
}

/**
 * Streak XP a perfect attempt would earn: every milestone inside its duration,
 * capped. Era 2 awards each milestone once per attempt, so a perfect run
 * collects exactly the ladder up to its length.
 */
function streakXPForPerfectRun(rules, durationDays) {
  const reach = Number(durationDays) || 0;
  const ladder = (rules.streakLadder || []).filter(m => m.days <= reach);
  const raw = ladder.reduce((s, m) => s + m.xp, 0);
  return Number.isFinite(rules.streakCap) ? Math.min(raw, rules.streakCap) : raw;
}

/**
 * Everything the UI needs to describe what an attempt is worth — generated from
 * the attempt itself.
 *
 * `tasks` carry their ALLOCATED XP (the figures the attempt will actually be
 * started with), `weekly` its repriced requirement definitions, and the rest is
 * read from the attempt's own rate card via `dayRules`.
 */
export function previewAttempt(args = {}) {
  const payload = buildAttemptPayload(args);
  if (!payload) return null;

  const stamp = stampAttempt({
    meta: { ...NEW_ATTEMPT_DEFAULTS, ...payload.challenge },
    tasks: payload.tasks,
    template: getTemplateById(payload.challenge.templateId),
  });
  const meta = stamp.meta;
  const tasks = stamp.tasks;
  const rules = dayRules(meta);
  const economy = economyFor(economyVersionOf(meta));
  const duration = Number(meta.durationDays) || 0;

  const weekly = getWeeklyRequirementDefs(meta);
  const weeklyPerWeek = weekly.reduce((s, d) => s + (Number(d.xp) || 0) * (Number(d.perWeek) || 0), 0);
  const weeklyTotal = weeklyAvailableXP(meta);
  const dailyTaskXP = tasks.reduce((s, t) => s + (Number(t.xp) || 0), 0);
  const streakXP = streakXPForPerfectRun(rules, duration);
  const completionBonus = Number(meta.completionBonusXP) || 0;

  return {
    meta,
    tasks,
    weekly,
    bonusMissions: payload.bonusMissions || [],

    // Identity of the rate card in force
    era: rules.version,
    tier: meta.effortTier,
    tierLabel: TIER_LABELS[meta.effortTier] || null,
    mode: meta.variant || null,
    modeMultiplier: economy.modes?.[meta.variant || 'standard'] ?? 1,
    durationDays: duration,

    // Daily
    dailyBudget: rules.dailyBudget ?? dailyTaskXP,
    dailyTaskXP,
    perfectDayBonus: rules.perfectDay,
    faithBonus: rules.faith,
    recoveryDayXP: rules.recoveryDay,

    // Weekly
    weeklyPerWeek,
    weeklyTotal,

    // Bonuses and their ceilings
    completionBonus,
    bonusPerDayCap: rules.bonusPerDayCap,
    bonusAttemptCap: bonusCapForAttempt(meta),
    streakLadder: (rules.streakLadder || []).filter(m => m.days <= duration),
    streakCap: rules.streakCap,
    streakXP,

    // What a miss costs
    missedDayPenalty: rules.missedDay,
    dayLossCap: rules.dayLossCap,

    /**
     * What a flawless attempt earns: every day's tasks and perfect-day bonus,
     * every weekly requirement met, the streak ladder, and the completion bonus.
     * Optional XP is excluded — it is optional.
     */
    projectedPerfectTotal: duration > 0
      ? duration * (dailyTaskXP + rules.perfectDay) + weeklyTotal + streakXP + completionBonus
      : null,
  };
}
