import { HABIT_KEYS } from './habitKeys';

/**
 * Muscle Building — SAMPLE V1 configuration.
 *
 * EVERYTHING challenge-specific lives in this file. The template entry, the
 * setup screen, the daily task list, the weekly requirements, the volume
 * tracker, the growth-trend coaching and the "why this helps" copy are all
 * generated from the constants below — no Muscle Building constant is duplicated
 * anywhere else in the codebase.
 *
 * To evolve the challenge later you change data here, not logic elsewhere:
 *   • add/remove an optimization habit  → OPTIMIZATION_HABITS
 *   • change XP                         → XP (the priority ladder is documented there)
 *   • change suggested volume           → MUSCLE_GROUPS / DEFAULT_SET_TARGET
 *   • change durations or training days → DURATIONS / TRAINING_DAY_OPTIONS
 *   • change gain-rate coaching         → GAIN_RATE
 *   • add a pillar                      → PILLARS (purely descriptive grouping)
 *
 * The outcome this challenge optimises for is HYPERTROPHY — visible muscle
 * growth — not maximal strength. Training is scheduled and volume-aware rather
 * than a generic daily "work out" checkbox.
 */

export const MUSCLE_BUILDING_TEMPLATE_ID = 'muscle_building_phase';

export const IDENTITY = {
  id: MUSCLE_BUILDING_TEMPLATE_ID,
  name: 'Muscle Building',
  subtitle: 'Build More Muscle. Train With Purpose.',
  emoji: '🏗️',
  goal: 'Maximize natural muscle growth by combining high-quality hypertrophy training, sufficient nutrition, recovery, and evidence-backed optimization habits.',
};

// ── Durations ───────────────────────────────────────────────────────────────
export const DURATIONS = [30, 60, 90];
export const DEFAULT_DURATION = 60;
export const DURATION_LABELS = {
  30: 'Foundation',
  60: 'Growth Block',
  90: 'Full Mesocycle',
};
export const COMPLETION_BONUS_BY_DURATION = { 30: 500, 60: 900, 90: 1400 };

// ── The four pillars (a conceptual grouping shown in the UI, not extra tasks) ─
export const PILLARS = [
  { id: 'training',     label: 'Training Stimulus', icon: '🏋️', blurb: 'Scheduled hypertrophy sessions and weekly hard-set volume.' },
  { id: 'nutrition',    label: 'Nutrition',         icon: '🥩', blurb: 'Protein first, then enough total energy to support growth.' },
  { id: 'recovery',     label: 'Recovery',          icon: '😴', blurb: 'Sleep and a deliberate return to a calm baseline.' },
  { id: 'optimization', label: 'Optimization',      icon: '✨', blurb: 'Optional habits with a real, modest effect — never the fundamentals.' },
];

// ── XP weighting ────────────────────────────────────────────────────────────
// Uses Forge's existing scale (Fat Loss keystones are 40, supporting tasks
// 10–25). The REQUIRED priority ladder, highest first:
//
//   Protein Target (keystone) 40  ==  Scheduled Training 40   VERY HIGH
//   Nutrition Target          30                              HIGH
//   Sleep Target              25                              MODERATE-HIGH
//   Daily Recovery Practice   15                              MODERATE
//   Daily Log                 10                              baseline
//   ── optional optimization, deliberately below every fundamental ──
//   Protein Distribution       8                              LOW
//   Creatine                   6                              LOW
//
// Optional habits are capped below the cheapest fundamental so that opting into
// every optimization can never outweigh doing the actual work.
export const XP = {
  protein: 40,
  training: 40,       // per scheduled session, via weekly requirements
  nutrition: 30,
  sleep: 25,
  recovery: 15,
  dailyLog: 10,
  proteinDistribution: 8,
  creatine: 6,
};

// ── Training schedule ───────────────────────────────────────────────────────
export const TRAINING_DAY_OPTIONS = [3, 4, 5, 6];
export const DEFAULT_TRAINING_DAYS = 4;

/**
 * Scheduled training is a WEEKLY requirement, not a daily checkbox: the
 * challenge cares that the planned sessions happen across the week, not that one
 * happens on any given day. Generated from the chosen days-per-week so the
 * existing weekly-requirements engine drives it unchanged.
 */
export function trainingRequirementDef(daysPerWeek = DEFAULT_TRAINING_DAYS) {
  return {
    id: 'hypertrophy_training',
    habitKey: HABIT_KEYS.HYPERTROPHY_TRAINING,
    label: 'Hypertrophy Training',
    icon: '🏋️',
    perWeek: daysPerWeek,
    xp: XP.training,
    keystone: 3,
    logLabel: 'Log Training Session',
    unit: 'session',
  };
}

// ── Training quality guidance (educational — never an XP checkbox) ──────────
export const RIR_GUIDANCE = {
  headline: 'Take most working sets close to failure',
  body: 'Most working sets should generally be taken close enough to failure to create a meaningful hypertrophy stimulus — roughly 0–3 reps in reserve. You do not need to take every set to absolute failure.',
  rirRange: [0, 3],
};

// ── Weekly hypertrophy volume ───────────────────────────────────────────────
// ~10 challenging sets per week is a useful STARTING REFERENCE, not a universal
// optimum — every target here is editable at setup and stored per attempt.
export const DEFAULT_SET_TARGET = 10;
export const MUSCLE_GROUPS = [
  { id: 'chest',      label: 'Chest',      icon: '🫁', defaultTarget: 10, major: true },
  { id: 'back',       label: 'Back',       icon: '🔙', defaultTarget: 10, major: true },
  { id: 'quads',      label: 'Quads',      icon: '🦵', defaultTarget: 10, major: true },
  { id: 'hamstrings', label: 'Hamstrings', icon: '🦿', defaultTarget: 10, major: true },
  { id: 'glutes',     label: 'Glutes',     icon: '🍑', defaultTarget: 10, major: true },
  { id: 'shoulders',  label: 'Shoulders',  icon: '🎯', defaultTarget: 10, major: true },
  { id: 'biceps',     label: 'Biceps',     icon: '💪', defaultTarget: 8,  major: false },
  { id: 'triceps',    label: 'Triceps',    icon: '🦾', defaultTarget: 8,  major: false },
  { id: 'calves',     label: 'Calves',     icon: '🐄', defaultTarget: 8,  major: false },
  { id: 'abs',        label: 'Abs',        icon: '🧱', defaultTarget: 6,  major: false },
];

/** Default weekly set targets as a plain { muscleId: sets } map. */
export function defaultVolumeTargets() {
  return Object.fromEntries(MUSCLE_GROUPS.map(m => [m.id, m.defaultTarget]));
}

// ── Nutrition targets ───────────────────────────────────────────────────────
// Protein is expressed as g per lb of bodyweight so the actual number follows
// the user rather than a universal constant. 0.7–1.0 g/lb is the muscle-building
// range; the midpoint is only a SUGGESTION and is fully editable.
export const PROTEIN_PER_LB = { min: 0.7, max: 1.0, suggested: 0.85 };

/** Suggested daily protein in grams for a bodyweight, or null when unknown. */
export function suggestedProteinGrams(bodyweightLb, perLb = PROTEIN_PER_LB.suggested) {
  if (!bodyweightLb || bodyweightLb <= 0) return null;
  return Math.round(bodyweightLb * perLb / 5) * 5;
}

/**
 * Nutrition (energy) goal modes. V1 ships lean bulk as the default and stores the
 * mode on the attempt, so `recomp` and `maximum` already have somewhere to live
 * when their coaching rules are written.
 */
export const NUTRITION_MODES = [
  { id: 'lean_bulk', label: 'Lean Bulk',      blurb: 'A modest surplus — grow while limiting fat gain.', gainRate: { min: 0.1, max: 0.3 } },
  { id: 'recomp',    label: 'Recomp',         blurb: 'Around maintenance — slower growth, minimal fat gain.', gainRate: { min: 0.0, max: 0.1 } },
  { id: 'maximum',   label: 'Maximum Gain',   blurb: 'A larger surplus — fastest growth, more fat gain.', gainRate: { min: 0.25, max: 0.5 } },
];
export const DEFAULT_NUTRITION_MODE = 'lean_bulk';

export function nutritionMode(id) {
  return NUTRITION_MODES.find(m => m.id === id) || NUTRITION_MODES[0];
}

// ── Sleep ───────────────────────────────────────────────────────────────────
export const SLEEP_TARGET = { min: 7, suggested: 8, unit: 'hours' };

// ── Daily recovery practice ─────────────────────────────────────────────────
export const RECOVERY_PRACTICE = {
  minMinutes: 5,
  maxMinutes: 10,
  options: [
    'Meditation',
    'Diaphragmatic breathing',
    'NSDR / yoga nidra',
    'A quiet walk (no phone)',
    'Prayer',
    'Another deliberate calming practice',
  ],
};

// ── Bodyweight gain-rate coaching ───────────────────────────────────────────
// Percent of bodyweight per week. A starting REFERENCE range, editable per
// attempt and per nutrition mode — no single rate is presented as optimal.
export const GAIN_RATE = {
  defaultMin: 0.1,
  defaultMax: 0.3,
  // How far above target counts as "substantially faster" before coaching fires.
  fastFactor: 1.5,
  // Consecutive flat weeks before a stall insight fires.
  stallWeeks: 3,
  // A week is "flat" when |change| is below this fraction of bodyweight.
  flatThreshold: 0.05,
};

// ── Physique tracking ───────────────────────────────────────────────────────
// Nothing here is required; the user picks what they want to track at setup.
export const MEASUREMENTS = [
  { id: 'weight', label: 'Body weight', unit: 'lb', field: 'weight', icon: '⚖️', defaultOn: true },
  { id: 'waist',  label: 'Waist',       unit: 'in', field: 'waist',  icon: '📏', defaultOn: true },
  { id: 'chest',  label: 'Chest',       unit: 'in', field: 'chest',  icon: '🫁', defaultOn: false },
  { id: 'arms',   label: 'Arms',        unit: 'in', field: 'arms',   icon: '💪', defaultOn: true },
  { id: 'thighs', label: 'Thighs',      unit: 'in', field: 'thighs', icon: '🦵', defaultOn: false },
  { id: 'photos', label: 'Progress photos', unit: '', field: null,   icon: '📸', defaultOn: true },
];
export const CHECKIN_INTERVAL_DAYS = { min: 14, max: 28, suggested: 14 };

export function defaultMeasurementSelection() {
  return Object.fromEntries(MEASUREMENTS.map(m => [m.id, m.defaultOn]));
}

// ── Optional optimization habits ────────────────────────────────────────────
// Opt-in at setup only. A habit the user did not enable is never required and
// never penalised. Adding a future optimization means adding an entry here.
export const OPTIMIZATION_HABITS = [
  {
    id: 'mb_protein_distribution',
    key: 'proteinDistribution',
    habitKey: HABIT_KEYS.PROTEIN_DISTRIBUTION,
    name: 'Protein Distribution',
    icon: '🍽️',
    color: '#F59E0B',
    xp: XP.proteinDistribution,
    keystone: 0,
    desc: 'Spread protein across roughly 3–4 substantial feedings through the day.',
    setupLabel: 'Protein Distribution — 3–4 substantial protein feedings',
  },
  {
    id: 'mb_creatine',
    key: 'creatine',
    habitKey: HABIT_KEYS.CREATINE,
    name: 'Take Creatine',
    icon: '⚗️',
    color: '#60A5FA',
    xp: XP.creatine,
    keystone: 0,
    desc: '3–5 g per day. No loading phase needed — consistency is what matters.',
    setupLabel: 'Creatine — 3–5 g daily',
  },
];

// ── "Why this helps" ────────────────────────────────────────────────────────
// Deliberately measured language. No claim that any habit guarantees growth,
// raises testosterone, or works as an on/off threshold.
export const WHY = {
  [HABIT_KEYS.PROTEIN_TARGET]: 'Provides the amino acids needed to repair and build muscle.',
  [HABIT_KEYS.HYPERTROPHY_TRAINING]: 'Hard resistance training provides the stimulus that tells muscle tissue to adapt and grow.',
  [HABIT_KEYS.CALORIE_TARGET]: 'Muscle growth requires enough energy to support training, recovery, and new tissue.',
  [HABIT_KEYS.SLEEP_TARGET]: 'Sleep supports recovery, performance, and the processes involved in adaptation.',
  [HABIT_KEYS.STRESS_RECOVERY]: 'Chronic psychological stress can make recovery and consistent high-quality training harder. Deliberate recovery helps you return to baseline.',
  [HABIT_KEYS.CREATINE]: 'Creatine can improve repeated high-intensity performance and modestly enhance gains from resistance training over time.',
  [HABIT_KEYS.PROTEIN_DISTRIBUTION]: 'Spreading protein across several substantial meals gives muscle multiple opportunities for a strong muscle-protein-synthesis response.',
  volume: 'Weekly hard sets are the clearest dose of training that drives growth. Around 10 challenging sets per muscle per week is a useful starting point, not a universal rule.',
};

// ── Setup defaults ──────────────────────────────────────────────────────────
/** The complete, editable configuration a new attempt starts from. */
export function defaultSetup() {
  return {
    durationDays: DEFAULT_DURATION,
    trainingDaysPerWeek: DEFAULT_TRAINING_DAYS,
    bodyweightLb: null,
    proteinPerLb: PROTEIN_PER_LB.suggested,
    proteinGrams: null,          // null → derived from bodyweight, or set directly
    nutritionMode: DEFAULT_NUTRITION_MODE,
    calorieTarget: null,         // null → "hit your configured target", no number shown
    sleepHours: SLEEP_TARGET.suggested,
    volumeTargets: defaultVolumeTargets(),
    optimizations: { proteinDistribution: false, creatine: false },
    measurements: defaultMeasurementSelection(),
    gainRateMin: GAIN_RATE.defaultMin,
    gainRateMax: GAIN_RATE.defaultMax,
  };
}

// ── Daily task list ─────────────────────────────────────────────────────────
/**
 * Build the daily task list from a setup object.
 *
 * Every task carries its canonical habitKey, so a Muscle Building requirement
 * that another challenge also requires (protein, sleep, recovery) deduplicates
 * through the shared-habit system and is never paid XP twice.
 *
 * Scheduled training is NOT here: it is a weekly requirement (see
 * trainingRequirementDef), because the challenge cares about the planned
 * sessions landing across the week, not about a checkbox every single day.
 */
export function buildStartTasks(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  const grams = s.proteinGrams || suggestedProteinGrams(s.bodyweightLb, s.proteinPerLb);
  const mode = nutritionMode(s.nutritionMode);

  const tasks = [
    {
      id: 'mb_protein',
      name: grams ? `Hit protein target (${grams} g)` : 'Hit protein target',
      icon: '🥩',
      color: '#FF6B6B',
      xp: XP.protein,
      keystone: 3,
      keystoneHabit: true,                       // the challenge's Keystone Habit
      habitKey: HABIT_KEYS.PROTEIN_TARGET,
      ...(grams ? { target: { value: grams, unit: 'g_protein', direction: 'atLeast' } } : {}),
      desc: grams
        ? `About ${s.proteinPerLb} g per lb of bodyweight.`
        : 'Aim for 0.7–1.0 g per lb of bodyweight.',
    },
    {
      id: 'mb_nutrition',
      name: s.calorieTarget ? `Hit nutrition target (${s.calorieTarget} kcal)` : 'Hit Nutrition Target',
      icon: '🍽️',
      color: '#F97316',
      xp: XP.nutrition,
      keystone: 2,
      habitKey: HABIT_KEYS.CALORIE_TARGET,
      ...(s.calorieTarget ? { target: { value: s.calorieTarget, unit: 'kcal', direction: 'atLeast' } } : {}),
      desc: `${mode.label} — ${mode.blurb}`,
    },
    {
      id: 'mb_sleep',
      name: `Sleep ${s.sleepHours}+ hours`,
      icon: '😴',
      color: '#A78BFA',
      xp: XP.sleep,
      keystone: 2,
      habitKey: HABIT_KEYS.SLEEP_TARGET,
      target: { value: s.sleepHours, unit: 'hours', direction: 'atLeast' },
    },
    {
      id: 'mb_recovery',
      name: 'Daily Recovery Practice',
      icon: '🌿',
      color: '#34D399',
      xp: XP.recovery,
      keystone: 1,
      habitKey: HABIT_KEYS.STRESS_RECOVERY,
      target: { value: RECOVERY_PRACTICE.minMinutes, unit: 'minutes', direction: 'atLeast' },
      desc: `${RECOVERY_PRACTICE.minMinutes}–${RECOVERY_PRACTICE.maxMinutes} minutes: ${RECOVERY_PRACTICE.options.slice(0, 4).join(', ').toLowerCase()}, or another deliberate calming practice.`,
    },
  ];

  // Opt-in optimizations, always ordered after every fundamental.
  for (const habit of OPTIMIZATION_HABITS) {
    if (!s.optimizations?.[habit.key]) continue;
    tasks.push({
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      xp: habit.xp,
      keystone: habit.keystone,
      habitKey: habit.habitKey,
      desc: habit.desc,
      optimization: true,
    });
  }

  tasks.push({
    id: 'daily_log',
    name: 'Complete Daily Log',
    icon: '📊',
    color: '#8B9DC3',
    xp: XP.dailyLog,
    keystone: 1,
    habitKey: HABIT_KEYS.DAILY_LOG,
  });

  return tasks.map((t, i) => ({ ...t, order: i }));
}

/**
 * The challenge-attempt metadata written by the setup flow. Everything the
 * running challenge needs to behave correctly lives on the attempt, so changing
 * this file later never rewrites a challenge already in progress.
 */
export function buildChallengeMeta(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  const grams = s.proteinGrams || suggestedProteinGrams(s.bodyweightLb, s.proteinPerLb);
  return {
    templateId: MUSCLE_BUILDING_TEMPLATE_ID,
    name: IDENTITY.name,
    emoji: IDENTITY.emoji,
    subtitle: IDENTITY.subtitle,
    variant: 'standard',
    durationDays: s.durationDays,
    templateVersion: 1,
    completionBonusXP: COMPLETION_BONUS_BY_DURATION[s.durationDays] || 900,
    // Muscle Building config — the attempt's own copy, editable per attempt.
    muscleBuilding: {
      trainingDaysPerWeek: s.trainingDaysPerWeek,
      bodyweightLb: s.bodyweightLb,
      proteinPerLb: s.proteinPerLb,
      proteinGrams: grams,
      nutritionMode: s.nutritionMode,
      calorieTarget: s.calorieTarget,
      sleepHours: s.sleepHours,
      volumeTargets: { ...s.volumeTargets },
      optimizations: { ...s.optimizations },
      measurements: { ...s.measurements },
      gainRateMin: s.gainRateMin,
      gainRateMax: s.gainRateMax,
    },
    // Scheduled training runs through the generic weekly-requirements engine.
    weeklyRequirementDefs: [trainingRequirementDef(s.trainingDaysPerWeek)],
  };
}

/** The Muscle Building config block of an attempt, or null. */
export function mbConfig(meta) {
  return meta?.templateId === MUSCLE_BUILDING_TEMPLATE_ID ? (meta.muscleBuilding || null) : null;
}

/** True when this attempt is a Muscle Building challenge. */
export function isMuscleBuilding(meta) {
  return meta?.templateId === MUSCLE_BUILDING_TEMPLATE_ID;
}
