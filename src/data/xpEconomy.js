/**
 * The XP economy — centralized, versioned, and the only place rates live.
 *
 * Forge's XP was spread across per-task literals, flat day bonuses and
 * per-template reward figures, which is how two incompatible schemes came to
 * coexist: legacy tasks priced at a flat 10/15, newer templates at up to 100 a
 * task. The result rewarded task COUNT and template age rather than effort, and
 * cleared the whole rank ladder in 20-50 days.
 *
 * This module replaces that with one rule:
 *
 *     difficulty sets a daily XP budget, and tasks divide that budget by weight
 *
 * Adding a task therefore splits the budget instead of inflating it, so neither
 * task count nor profile can change what a challenge is worth.
 *
 * ── Eras ───────────────────────────────────────────────────────────────────
 *
 * Rates are versioned, and an attempt is STAMPED with its version when it
 * starts. Everything the engine needs — the daily budget, the completion bonus,
 * the repriced weekly requirements, the per-task XP — is written onto the
 * attempt and its task snapshot at that moment. An archive is therefore
 * self-describing: it recomputes under the rules it actually ran under, forever,
 * and a later rebalance cannot reach back and revalue it.
 *
 * ── Units and the conversion layer ─────────────────────────────────────────
 *
 * Era 2 uses units 10x finer than era 1, because a 27.4 XP/day budget cannot be
 * split across 8 tasks in whole numbers that still distinguish a keystone from
 * a supporting habit. Rather than rewrite stored history, each era declares a
 * DISPLAY SCALE and conversion happens at read time:
 *
 *     displayXP = storedXP x DISPLAY_SCALE[era]
 *
 * Stored records are never touched, so the conversion is reversible by
 * deleting a table entry, and an era-1 archive still means exactly what it
 * meant when it was written.
 */

// ── Versions ────────────────────────────────────────────────────────────────

/** The era new attempts are stamped with. */
export const CURRENT_ECONOMY_VERSION = 2;

/** An attempt with no stamp predates versioning and is era 1. */
export const LEGACY_ECONOMY_VERSION = 1;

/**
 * Display scale per era. Era 1 stored XP in units 1/10 the size of era 2's, so
 * its figures are multiplied to sit on the same ladder.
 */
export const DISPLAY_SCALE = { 1: 10, 2: 1 };

export function economyVersionOf(meta) {
  const v = Number(meta?.xpEconomyVersion);
  return Number.isFinite(v) && v >= 1 ? v : LEGACY_ECONOMY_VERSION;
}

export function displayScaleFor(version) {
  return DISPLAY_SCALE[version] ?? DISPLAY_SCALE[LEGACY_ECONOMY_VERSION];
}

// ── Ranks ───────────────────────────────────────────────────────────────────

/**
 * The rank ladder, in display units.
 *
 * Thresholds are 10x their era-1 values, which is the same conversion applied
 * to stored XP — so every profile keeps its exact relative position and nobody
 * changes rank because of the unit change. Names and thresholds are data:
 * renaming a rank, moving a threshold or appending a prestige tier is an edit
 * here and nothing else.
 *
 * XP is NOT capped at the top rank. A profile past Unbreakable keeps
 * accumulating; `resolveRankState` reports no next rank and 100% progress.
 */
export const RANKS = [
  { rank: 1, name: 'Initiate',      minXP: 0,      desc: 'You began.',                        philosophy: 'You chose to begin.' },
  { rank: 2, name: 'Apprentice',    minXP: 2500,   desc: 'You are learning consistency.',     philosophy: 'You are learning to show up.' },
  { rank: 3, name: 'Disciplined',   minXP: 7500,   desc: 'You keep promises more often.',     philosophy: 'You learned to show up.' },
  { rank: 4, name: 'Resilient',     minXP: 15000,  desc: 'You return after setbacks.',        philosophy: 'You continue even when motivation disappears.' },
  { rank: 5, name: 'Warrior',       minXP: 30000,  desc: 'You execute under pressure.',       philosophy: 'You execute under pressure.' },
  { rank: 6, name: 'Elite Warrior', minXP: 50000,  desc: 'Discipline is becoming identity.',  philosophy: 'You protect your standards.' },
  { rank: 7, name: 'True Warrior',  minXP: 75000,  desc: 'You act from principle, not mood.', philosophy: 'You act from principle, not mood.' },
  { rank: 8, name: 'Unbreakable',   minXP: 100000, desc: 'You are hard to derail.',           philosophy: 'Your habits now define you.' },
];

// ── Difficulty tiers ────────────────────────────────────────────────────────

/**
 * Effort tiers, in ascending order. A tier is a statement about how much work a
 * day of the challenge demands — not how many boxes it has.
 */
export const EFFORT_TIERS = ['easy', 'medium', 'medium_hard', 'hard', 'elite'];

/**
 * The task ids era 1 priced above the rest.
 *
 * Economy data, so it lives here; `gamification` re-exports it for the call
 * sites that already import it from there. It still matters under era 2 as a
 * WEIGHT source for legacy task lists, which carry neither explicit XP nor
 * keystone tiers.
 */
export const HIGH_VALUE_TASK_IDS = new Set([
  'workout', 'gf_workout',
  'sleep_target', 'gf_sleep_target',
  'diet', 'gf_diet',
  'mental', 'gf_mental',
  'mt_mind', 'mt_body',
]);

/**
 * Effort tiers for attempts whose descriptor is not a registry template, keyed
 * by templateId.
 *
 * The Forge Daily baseline is the case that matters: it lives in
 * FORGE_DAILY_META rather than CHALLENGE_TEMPLATES, so `getTemplateById` cannot
 * find it, and a descriptor stored before tiers existed carries no tier of its
 * own either. Without this it resolved to the default `medium` and was given a
 * 160 budget — a third more than the baseline is meant to be worth.
 */
export const TEMPLATE_TIER_FALLBACK = {
  forge_daily: 'easy',
};

/** Difficulty ratings as shown to the user, per tier. */
export const TIER_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  medium_hard: 'Medium/Hard',
  hard: 'Hard',
  elite: 'Elite',
};

// ── Era 2 ───────────────────────────────────────────────────────────────────

export const ECONOMY_V2 = {
  version: 2,

  /** Daily task-XP budget by effort tier. The whole economy scales from here. */
  tiers: { easy: 120, medium: 160, medium_hard: 180, hard: 200, elite: 220 },

  /**
   * User-selected mode. Deliberately narrow: at 1.12 a hard-mode medium_hard
   * challenge (202) out-earned standard-mode hard (200), inverting the tiers.
   * 1.08 keeps every adjacent pair ordered.
   */
  modes: { beginner: 0.85, standard: 1.00, hard: 1.08 },

  /** Day-level awards, as a fraction of that day's budget. */
  perfectDayRate: 0.15,
  faithRate: 0.05,
  /** A Minimum Warrior Day replaces the day's task XP rather than adding to it. */
  recoveryDayRate: 0.50,

  /**
   * Completion bonus = rate x budget x duration. Linear in duration, so it is
   * worth the same per day at every length and a short challenge confers no
   * per-day advantage.
   */
  completionRate: 0.20,

  /**
   * Streak milestones, awarded once per ATTEMPT per milestone — never re-armed
   * by breaking a streak, which under era 1 made skipping a day worth +920 XP.
   * An attempt's total streak XP is additionally capped, which is what stops a
   * run of short attempts out-earning one long one.
   */
  streakLadder: [
    { days: 3, xp: 20 }, { days: 7, xp: 50 }, { days: 14, xp: 80 },
    { days: 30, xp: 150 }, { days: 60, xp: 250 }, { days: 75, xp: 300 },
  ],
  streakCapRate: 0.05,
  streakBreakPenalty: 0,

  /** Optional XP. Capped so it can never reorder the difficulty ranking. */
  bonusPerDayRate: 0.10,
  bonusPerAttemptRate: 0.05,

  /** Weekly requirements draw on their own budget: rate x daily budget, per week. */
  weeklySessionRate: 0.50,

  /**
   * Penalties are budget-relative, so a missed day costs the same share of a
   * day's worth at every difficulty (43%) instead of a flat 25 that was 16% of
   * a hard day and 19% of an easy one.
   */
  missedDayRate: 0.50,
  taskMissRate: 0.25,
  dayLossCapRate: 0.50,
  recoveryPenaltyMult: 0.3,

  comeback: { start: 20, complete: 100 },

  /** Keystone tier -> share of the budget. What splits the daily budget. */
  weights: { 3: 3.0, 2: 2.0, 1: 1.3, 0: 1.0 },

  /** Era 2 prices every task explicitly; there is no flat fallback. */
  legacyTaskFallback: false,
};

// ── Era 1 (frozen) ──────────────────────────────────────────────────────────

/**
 * The rates era-1 attempts ran under, recorded so their archives keep
 * recomputing identically. These are historical facts, not tunables: changing
 * a number here rewrites the past, which is the thing this module exists to
 * prevent.
 */
export const ECONOMY_V1 = {
  version: 1,
  perfectDayFlat: 50,
  allRatingsFlat: 10,
  mentalSectionFlat: 15,
  faithFlat: 10,
  recoveryDayFlat: 25,
  missedDayFlat: 25,
  taskMissRate: 0.25,
  taskMissFlatCap: 12,
  dayLossCapFlat: 80,
  streakLadder: [
    { days: 3, xp: 30 }, { days: 7, xp: 100 }, { days: 14, xp: 250 }, { days: 30, xp: 750 },
  ],
  streakBreakPenalty: 30,
  /** Era 1 re-armed the ladder on every new streak. Preserved for fidelity. */
  streakOncePerAttempt: false,
  streakCapRate: Infinity,
  bonusPerDayRate: Infinity,
  bonusPerAttemptRate: Infinity,
  comeback: { start: 20, complete: 100 },
  legacyTaskFallback: true,
};

export const ECONOMIES = { 1: ECONOMY_V1, 2: ECONOMY_V2 };

export function economyFor(version) {
  return ECONOMIES[version] || ECONOMY_V1;
}

// ── Budgets and allocation ──────────────────────────────────────────────────

/** The daily task-XP budget for a tier and mode. */
export function tierBudget(tier, mode = 'standard', economy = ECONOMY_V2) {
  const base = economy.tiers?.[tier] ?? economy.tiers?.medium ?? 160;
  const mult = economy.modes?.[mode] ?? 1;
  return Math.round(base * mult);
}

/**
 * What share of the budget each task should get.
 *
 * When a template has priced EVERY task itself, those values are the weights.
 * Challenge configs encode a deliberate priority ladder within a tier — Energy
 * Reset puts sleep at 40 and morning light at 30, both keystones — and
 * weighting by keystone tier alone would flatten them to the same number,
 * throwing away a design decision the challenge author made. Scaling the
 * author's own ladder to the budget keeps the internal ordering exactly
 * proportional while the DAILY TOTAL is what difficulty governs.
 *
 * A list where only some tasks carry `xp` is a legacy list (75 Hard, where only
 * the Daily Log constant has one), and its numbers are not a ladder — treating
 * them as weights would make the Daily Log the most valuable habit of the day.
 * Those fall back to keystone tiers.
 */
function taskWeights(list, economy) {
  const allPriced = list.every(t => typeof t?.xp === 'number' && t.xp > 0);
  const anyKeystone = list.some(t => (t?.keystone ?? 0) > 0);

  if (allPriced && anyKeystone) {
    // Keystone tiers govern ACROSS tiers; the author's own XP only orders tasks
    // WITHIN a tier.
    //
    // Using the author's XP as the weight outright preserves distortions as
    // readily as designs: Mental Training priced its 5-minute meditation at
    // 100, more than 75 Hard's entire daily slate, and carrying that forward
    // handed one task 37% of the day while a 60-minute phone-free block got
    // 7%. Using keystone tiers alone goes too far the other way and flattens
    // deliberate distinctions, like Energy Reset's sleep (40) above morning
    // light (30) when both are keystones.
    //
    // So each task starts at its tier's weight and is nudged by how it compares
    // with its OWN tier's average.
    //
    // The nudge is CLAMPED so it can never reorder two tiers. For adjacent
    // weights a and b, no inversion requires a(1+m) < b(1−m), i.e.
    // m < (b−a)/(b+a). Across 1.0/1.3/2.0/3.0 the tightest pair is 1.0 and 1.3,
    // giving m < 0.130 — so 0.12. Without the clamp an outlier does invert the
    // tiers: Forge Daily's Daily Log, priced at 20 among tasks averaging 8,
    // overtook the keystone Mental Training habit.
    const NUDGE = 0.3;
    const MAX_SHIFT = 0.12;
    const clamp = (m) => Math.min(1 + MAX_SHIFT, Math.max(1 - MAX_SHIFT, m));
    const sums = new Map();
    const counts = new Map();
    for (const t of list) {
      const k = t?.keystone ?? 0;
      sums.set(k, (sums.get(k) || 0) + t.xp);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return list.map(t => {
      const k = t?.keystone ?? 0;
      const base = economy.weights?.[k] ?? 1;
      const mean = sums.get(k) / counts.get(k);
      const ratio = mean > 0 ? t.xp / mean : 1;
      return base * clamp(1 + NUDGE * (ratio - 1));
    });
  }

  if (allPriced) return list.map(t => t.xp);
  if (anyKeystone) return list.map(t => economy.weights?.[t?.keystone ?? 0] ?? 1);
  // A legacy list: no explicit XP and no keystone tiers, which is every
  // 75-Day Discipline task. Era 1 distinguished them only through
  // HIGH_VALUE_TASK_IDS, so that shape is the weighting — otherwise the whole
  // list would flatten to one value and a 45-minute workout would be worth the
  // same as taking a photo. Adding keystone tiers to those tasks instead would
  // change the challenge's keystone-adherence grading, which is out of scope.
  return list.map(t => (HIGH_VALUE_TASK_IDS.has(t?.id) ? 15 : 10));
}

/**
 * Split a budget across tasks, in whole numbers that sum to EXACTLY the budget
 * (largest-remainder). Exactness matters: the budget is the guarantee that two
 * challenges of the same tier are worth the same per day, so a rounding drift
 * would quietly reintroduce the task-count problem.
 *
 * Every task gets at least 1 XP, so a long task list cannot price a habit at
 * zero and make it look optional.
 */
export function allocateTaskXP(tasks, budget, economy = ECONOMY_V2) {
  const list = tasks || [];
  if (!list.length) return [];
  const weights = taskWeights(list, economy);
  const total = weights.reduce((s, x) => s + x, 0) || 1;
  const raw = weights.map(w => (budget * w) / total);
  const out = raw.map(x => Math.max(1, Math.floor(x)));

  let short = budget - out.reduce((s, x) => s + x, 0);
  // Hand the remainder to the largest fractional parts first.
  const byFrac = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (short > 0 && byFrac.length) { out[byFrac[k % byFrac.length].i]++; short--; k++; }
  // Over-allocated (many tasks forced up to the 1 XP minimum): trim the
  // largest, never below 1.
  while (short < 0) {
    const target = out
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)
      .find(x => out[x.i] > 1);
    if (!target) break;
    out[target.i]--; short++;
  }
  return list.map((t, i) => ({ ...t, xp: out[i] }));
}

// ── Derived rates for one attempt ───────────────────────────────────────────

/**
 * Every day-level rate the XP engine needs, resolved for one attempt.
 *
 * The engine takes this object rather than reading the economy directly, which
 * is what keeps era-1 recomputation bit-identical: an era-1 attempt yields the
 * old flat numbers, an era-2 attempt yields budget-relative ones, and neither
 * can see the other's rules.
 */
export function dayRules(meta) {
  const version = economyVersionOf(meta);
  const economy = economyFor(version);

  if (version < 2) {
    return {
      version,
      economy,
      dailyBudget: null,
      perfectDay: economy.perfectDayFlat,
      allRatings: economy.allRatingsFlat,
      mentalSection: economy.mentalSectionFlat,
      faith: economy.faithFlat,
      recoveryDay: economy.recoveryDayFlat,
      missedDay: economy.missedDayFlat,
      taskMissRate: economy.taskMissRate,
      taskMissFlatCap: economy.taskMissFlatCap,
      dayLossCap: economy.dayLossCapFlat,
      bonusPerDayCap: Infinity,
      recoveryPenaltyMult: 0.3,
      streakLadder: economy.streakLadder,
      streakBreakPenalty: economy.streakBreakPenalty,
      streakOncePerAttempt: false,
      streakCap: Infinity,
      legacyTaskFallback: true,
    };
  }

  const budget = dailyBudgetOf(meta);
  const duration = Number(meta?.durationDays) || 0;
  return {
    version,
    economy,
    dailyBudget: budget,
    perfectDay: Math.round(budget * economy.perfectDayRate),
    // Era 2 removes both duplicate awards: the all-ratings bonus and the
    // mental-training-section bonus each paid a second time for something
    // already paid as a required task.
    allRatings: 0,
    mentalSection: 0,
    faith: Math.round(budget * economy.faithRate),
    recoveryDay: Math.round(budget * economy.recoveryDayRate),
    missedDay: Math.round(budget * economy.missedDayRate),
    taskMissRate: economy.taskMissRate,
    taskMissFlatCap: Infinity,
    dayLossCap: Math.round(budget * economy.dayLossCapRate),
    bonusPerDayCap: Math.round(budget * economy.bonusPerDayRate),
    recoveryPenaltyMult: economy.recoveryPenaltyMult,
    streakLadder: economy.streakLadder,
    streakBreakPenalty: economy.streakBreakPenalty,
    streakOncePerAttempt: true,
    streakCap: duration > 0
      ? Math.round(economy.streakCapRate * budget * duration)
      // An open-ended baseline has no duration to cap against, so the ladder
      // accrues at the same per-day rate a finite attempt would get.
      : Infinity,
    legacyTaskFallback: false,
  };
}

/** The attempt's stamped daily budget, or one derived from its tier and mode. */
export function dailyBudgetOf(meta) {
  const stamped = Number(meta?.dailyBudget);
  if (Number.isFinite(stamped) && stamped > 0) return stamped;
  const economy = economyFor(economyVersionOf(meta));
  return tierBudget(meta?.effortTier || 'medium', meta?.variant || 'standard', economy);
}

/** Completion bonus for an era-2 attempt of this tier, mode and duration. */
export function completionBonusFor(tier, mode, durationDays, economy = ECONOMY_V2) {
  if (!durationDays) return 0;
  return Math.round(tierBudget(tier, mode, economy) * durationDays * economy.completionRate);
}

/** The optional-XP ceiling for a whole attempt. */
export function bonusCapForAttempt(meta) {
  const version = economyVersionOf(meta);
  if (version < 2) return Infinity;
  const economy = economyFor(version);
  const budget = dailyBudgetOf(meta);
  const duration = Number(meta?.durationDays) || 0;
  if (!duration) return Infinity;
  return Math.round(economy.bonusPerAttemptRate * budget * duration);
}

/**
 * Weekly-requirement definitions repriced onto an era-2 weekly budget.
 *
 * The weekly budget is a fraction of the daily one, per week, divided across
 * the requirements by session count and keystone weight. Under era 1 each
 * session carried its own literal XP, so a challenge with more required
 * sessions simply earned more — the same count-driven inflation as daily tasks.
 */
export function repriceWeeklyDefs(defs, meta, economy = ECONOMY_V2) {
  const list = defs || [];
  if (!list.length) return list;
  const budget = dailyBudgetOf(meta);
  const weeklyBudget = Math.round(economy.weeklySessionRate * budget);
  const weightOf = (d) => (Number(d?.perWeek) || 1) * (economy.weights?.[d?.keystone ?? 0] ?? 1);
  const total = list.reduce((s, d) => s + weightOf(d), 0) || 1;
  return list.map(d => {
    const share = (weeklyBudget * weightOf(d)) / total;
    const perSession = Math.max(1, Math.round(share / (Number(d.perWeek) || 1)));
    return { ...d, xp: perSession };
  });
}
