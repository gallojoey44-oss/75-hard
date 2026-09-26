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
  carbs: 30,                  // a FUNDAMENTAL — priced with nutrition, not below it
  proteinDistribution: 8,
  creatine: 6,
  micronutrients: 6,
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

// ── Muscle Specialization Mode ──────────────────────────────────────────────
/**
 * A specialization block reallocates recoverable training volume toward up to
 * two priority muscles. It does not create extra whole-body growth — the copy
 * below says so plainly, because "specialize and grow everything faster" is the
 * obvious wrong reading.
 *
 * Everything here is a starting reference and is editable per attempt.
 */
export const SPECIALIZATION = {
  question: 'Do you want to prioritize specific muscles?',
  options: [
    { id: 'balanced', label: 'No — Balanced Muscle Growth', blurb: 'Spread your volume evenly across every muscle group.' },
    { id: 'specialize', label: 'Yes — Specialization Block', blurb: 'Give up to two muscles more of your recoverable volume for a few weeks.' },
  ],
  maxPriority: 2,
  explanation: 'Specialization gives priority muscles more of your recoverable training volume while other muscles receive enough work to maintain or progress more slowly.',
  // The claim this feature refuses to make.
  honesty: 'This reallocates emphasis — it does not add whole-body muscle beyond what your biology allows. Priority muscles get more; the rest get less and progress more slowly for the length of the block. That trade is the whole mechanism.',
  recommendedWeeks: { min: 6, max: 8 },
  durationNote: 'Six to eight weeks is the usual length for a block like this. If your challenge runs longer, that is fine — you can keep going or switch back to balanced later.',
  // Priority-muscle weekly volume. A RANGE, never a single "optimal" number.
  prioritySets: { min: 12, max: 16, suggested: 13 },
  // Non-priority muscles drop to maintenance-ish work rather than to nothing.
  maintenanceFactor: 0.6,
  minMaintenanceSets: 4,
  // Spread priority volume across this many weekly exposures.
  exposures: { min: 2, max: 3, suggested: 3 },
  exposureNote: 'Spread priority volume across roughly 2–3 sessions a week rather than one enormous workout. For example, 5 + 3 + 5 sets across three sessions is 13 weekly productive sets — an illustration, not a prescription.',
  lowestEffectiveNote: 'Forge favours the LOWEST volume that keeps you progressing. More sets is not a higher score — if you are progressing on 12, there is no prize for doing 16.',
};

/** The muscle groups a user may prioritise (every tracked group). */
export function specializationChoices() {
  return MUSCLE_GROUPS.map(m => ({ id: m.id, label: m.label, icon: m.icon }));
}

/**
 * Fraction of the gap closed at each stage, indexed by stage count.
 * Front-loaded: the first step is the easiest to recover from, the last is not.
 */
export const RAMP_PROFILE = [
  [1],
  [0.6, 1],
  [0.5, 0.8, 1],
  [0.5, 0.75, 0.9, 1],
];

/**
 * Gradual volume progression for a priority muscle.
 *
 * Jumping straight from 6 sets/week to 16 is how people bury themselves. The
 * ramp starts near where the user actually is and climbs toward the target over
 * the block, never exceeding it, and never dropping below where they started.
 *
 * Returns per-week suggested set counts, e.g. from 6 → 13:
 *   weeks 1–2 ≈ 10, weeks 3–4 ≈ 12, weeks 5+ ≈ 13
 */
export function volumeRamp({ current = 0, target = SPECIALIZATION.prioritySets.suggested, weeks = 8 }) {
  const start = Math.max(0, Math.round(current));
  const goal = Math.max(start, Math.round(target));
  const n = Math.max(1, Math.round(weeks));
  if (goal === start) return Array.from({ length: n }, (_, i) => ({ week: i + 1, sets: goal }));

  // Step up in stages rather than every single week, so a week is long enough
  // to actually tell whether the added volume is being recovered from.
  //
  // The stage profile closes the gap fastest at the start and eases in at the
  // top: the first jump is the one the user can most easily absorb, and the
  // last few sets are the ones most likely to outrun recovery. From 6 sets
  // toward 13 over 8 weeks this gives 10, 10, 11, 11, 12, 12, 13, 13.
  const stages = Math.min(RAMP_PROFILE.length, Math.max(2, Math.ceil(n / 2)));
  const profile = RAMP_PROFILE[stages - 1] || RAMP_PROFILE[RAMP_PROFILE.length - 1];
  const perStage = Math.max(1, Math.ceil(n / stages));
  const out = [];
  for (let i = 0; i < n; i++) {
    const stage = Math.min(stages - 1, Math.floor(i / perStage));
    const frac = profile[stage] ?? 1;
    out.push({ week: i + 1, sets: Math.round(start + (goal - start) * frac) });
  }
  return out;
}

/** The suggested sets for a priority muscle in a given block week. */
export function rampedTarget({ current, target, weeks, week }) {
  const ramp = volumeRamp({ current, target, weeks });
  const row = ramp.find(r => r.week === week) || ramp[ramp.length - 1];
  return row ? row.sets : target;
}

/**
 * Weekly set targets for a specialization setup.
 *
 * Priority muscles get the priority target; everything else drops to a
 * maintenance level derived from its own default rather than a flat number, so
 * a muscle that normally needs less still needs less.
 */
export function specializationTargets({ priority = [], prioritySets = SPECIALIZATION.prioritySets.suggested, base = null } = {}) {
  const baseTargets = base || defaultVolumeTargets();
  const out = {};
  for (const m of MUSCLE_GROUPS) {
    if (priority.includes(m.id)) {
      out[m.id] = Math.round(prioritySets);
    } else {
      out[m.id] = Math.max(
        SPECIALIZATION.minMaintenanceSets,
        Math.round((baseTargets[m.id] ?? m.defaultTarget) * SPECIALIZATION.maintenanceFactor),
      );
    }
  }
  return out;
}

/** True when an attempt's config has a live specialization block. */
export function isSpecializing(cfg) {
  return !!cfg?.specialization?.enabled && (cfg.specialization.priority || []).length > 0;
}

/** The priority muscle ids for an attempt (empty when balanced). */
export function priorityMuscles(cfg) {
  return isSpecializing(cfg) ? [...(cfg.specialization.priority || [])] : [];
}

// ── Micro-workouts ──────────────────────────────────────────────────────────
export const MICRO_WORKOUTS = {
  title: 'Micro-workouts',
  body: 'A short session counts toward a muscle\'s weekly volume when it contains real hypertrophy work — for example 2–3 challenging sets of weighted or deficit push-ups for chest.',
  // The failure mode this feature must not reward.
  honesty: 'These count toward the SAME weekly volume budget — they do not add to it. The point is to distribute productive volume across the week, not to accumulate more of it. Easy daily pump work does not count just because it happened.',
  minSetsToCount: 2,
};

// ── Training quality ────────────────────────────────────────────────────────
export const EXERCISE_SELECTION = {
  title: 'Choosing exercises',
  items: [
    'Stable enough to execute the same way every time',
    'Can be progressively overloaded over weeks',
    'Puts substantial tension on the muscle you are targeting',
    'Uses an effective range of motion',
    'Often benefits from meaningful load at longer muscle lengths',
  ],
  note: 'Nothing exotic is required. The ordinary movements work.',
  specializationNote: 'For a specialization block, use two or three useful movement patterns rather than putting all the weekly volume through one exercise. For chest that might be a press, an incline or alternate press, and a fly or adduction movement — an example, not a requirement.',
};

export const REST_GUIDANCE = {
  title: 'Rest between hard sets',
  body: 'Rest long enough that the next hard set is still productive. Hard compound movements often need roughly 2+ minutes; isolation work usually needs less.',
  note: 'There is no universal 60-second rule, and Forge does not time your rest or score it.',
};

export const STIMULUS_QUALITY = {
  title: 'What makes a set count',
  body: 'Volume only matters if the sets provide a meaningful stimulus. A set that is easy, rushed, or mostly momentum is not a productive set no matter what it does to your weekly count.',
  items: [
    'Controlled execution — no throwing the weight around',
    'A useful range of motion',
    'A stable, repeatable setup',
    'The target muscle actually receiving meaningful tension',
    'Adding load while substantially degrading technique is not progression',
  ],
};

// ── Micronutrient coverage ──────────────────────────────────────────────────
/**
 * An OPTIONAL nutrition optimization: general adequacy over time, not hitting
 * 100% of every RDA every day, and never a task per nutrient.
 */
export const MICRONUTRIENTS = {
  title: 'Micronutrient coverage',
  blurb: 'One check: did you eat in a way that broadly covers your micronutrient bases today? Fruit, vegetables, dairy or alternatives, whole grains, and varied protein sources across the week gets most people most of the way there.',
  nutrients: [
    { id: 'vitd', name: 'Vitamin D', sources: 'Sunlight, oily fish, eggs, fortified foods' },
    { id: 'magnesium', name: 'Magnesium', sources: 'Nuts, seeds, legumes, whole grains, leafy greens' },
    { id: 'zinc', name: 'Zinc', sources: 'Meat, shellfish, legumes, seeds' },
    { id: 'iron', name: 'Iron', sources: 'Red meat, shellfish, legumes, dark greens' },
    { id: 'calcium', name: 'Calcium', sources: 'Dairy, fortified alternatives, tofu, leafy greens' },
    { id: 'potassium', name: 'Potassium', sources: 'Potatoes, beans, bananas, dairy, leafy greens' },
    { id: 'bvitamins', name: 'B vitamins (folate, B12, B6)', sources: 'Meat, fish, eggs, dairy, legumes, leafy greens' },
    { id: 'sodium', name: 'Sodium', sources: 'Salt and normal seasoning — training raises needs somewhat' },
    { id: 'vitc', name: 'Vitamin C', sources: 'Citrus, berries, peppers, brassicas' },
    { id: 'selenium', name: 'Selenium', sources: 'Brazil nuts, fish, eggs, whole grains' },
    { id: 'iodine', name: 'Iodine', sources: 'Iodised salt, dairy, eggs, seafood' },
  ],
  // The two claims this feature refuses to make.
  honesty: 'Inadequate intake of these can become a bottleneck. Intake ABOVE adequate does not add hypertrophy — more is not better here, and megadosing is not an optimization.',
  foodFirst: 'Food first. A supplement is a reasonable gap-filler where your diet genuinely falls short, not a default.',
};

// ── Nutrition targets ───────────────────────────────────────────────────────
// Protein is expressed as g per lb of bodyweight so the actual number follows
// the user rather than a universal constant.
//
// 0.8–1.0 g/lb is the practical optimization range. Within it, MORE IS NOT
// BETTER: roughly 0.8–0.9 g/lb is generally sufficient for someone eating
// adequate calories, and 1.0 g/lb simply adds margin. Forge does not present
// 1.0 as more anabolic than 0.8, and does not nudge anyone above 1 g/lb.
export const PROTEIN_PER_LB = {
  min: 0.8,
  max: 1.0,
  suggested: 0.85,
  // Shown wherever the target is set, so the number never reads as "more wins".
  note: 'Around 0.8–0.9 g/lb is generally enough when you are eating adequate calories. 1.0 g/lb adds margin rather than extra growth — going meaningfully above 1 g/lb is not recommended here.',
};

/** Suggested daily protein in grams for a bodyweight, or null when unknown. */
export function suggestedProteinGrams(bodyweightLb, perLb = PROTEIN_PER_LB.suggested) {
  if (!bodyweightLb || bodyweightLb <= 0) return null;
  return Math.round(bodyweightLb * perLb / 5) * 5;
}

// ── Carbohydrate availability ───────────────────────────────────────────────
/**
 * Suggested carbohydrate intake, scaled to bodyweight AND training demand.
 *
 * These are reference ranges, not requirements. ~1.5 g/lb/day is the default
 * starting reference for typical hypertrophy training; everything is editable.
 *
 * Carbohydrate is deliberately the LAST macro allocated (see reconcileMacros):
 * it takes what remains of the energy target after protein and adequate fat,
 * because a carb figure that pushes the user past their calorie target would
 * quietly break the thing it is meant to support.
 */
export const CARB_DEMAND_LEVELS = [
  {
    id: 'lower', label: 'Lower-volume lifting', perLb: { min: 0.9, max: 1.4, suggested: 1.15 },
    blurb: 'Fewer hard sets per week, or shorter sessions.',
  },
  {
    id: 'typical', label: 'Typical hypertrophy training', perLb: { min: 1.4, max: 1.8, suggested: 1.5 },
    blurb: 'The usual case — a normal hypertrophy programme.',
  },
  {
    id: 'high', label: 'High-volume / specialization', perLb: { min: 1.8, max: 2.3, suggested: 2.0 },
    blurb: 'High weekly set counts, or a specialization block.',
  },
];
export const DEFAULT_CARB_DEMAND = 'typical';
export const DEFAULT_CARB_PER_LB = 1.5;

export function carbDemandLevel(id) {
  return CARB_DEMAND_LEVELS.find(l => l.id === id) || CARB_DEMAND_LEVELS[1];
}

/** Suggested daily carbohydrate in grams, or null when bodyweight is unknown. */
export function suggestedCarbGrams(bodyweightLb, perLb = DEFAULT_CARB_PER_LB) {
  if (!bodyweightLb || bodyweightLb <= 0) return null;
  return Math.round((bodyweightLb * perLb) / 5) * 5;
}

/** Calories per gram, for reconciling macros against an energy target. */
export const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 };

/**
 * Minimum dietary fat, as g per lb of bodyweight.
 *
 * Fat is protected BEFORE carbohydrate in the hierarchy: squeezing fat to fit a
 * carb number is not a trade Forge will make on the user's behalf.
 */
export const FAT_PER_LB = { min: 0.3, suggested: 0.35 };

/**
 * Fit protein, fat and carbohydrate inside the energy target.
 *
 * The hierarchy, in order:
 *   1. calorie / energy target
 *   2. protein
 *   3. adequate dietary fat
 *   4. carbohydrate takes much of what remains
 *
 * The suggested carb figure is a STARTING REFERENCE. When it does not fit the
 * calorie target, calorie/macro consistency wins and the carb target is reduced
 * to what actually fits — `adjusted` records that so the UI can explain it
 * rather than silently showing a different number than the one suggested.
 *
 * With no calorie target set (the default), there is nothing to reconcile
 * against and the suggestion passes through untouched.
 */
export function reconcileMacros({ bodyweightLb, calorieTarget, proteinGrams, carbGrams, fatPerLb = FAT_PER_LB.suggested }) {
  const protein = Math.max(0, Math.round(proteinGrams || 0));
  const suggestedCarb = Math.max(0, Math.round(carbGrams || 0));
  const fatFloor = bodyweightLb ? Math.round(bodyweightLb * FAT_PER_LB.min) : 0;
  const fat = bodyweightLb ? Math.max(fatFloor, Math.round(bodyweightLb * fatPerLb)) : 0;

  if (!calorieTarget || calorieTarget <= 0) {
    return { fits: true, adjusted: false, protein, fat, carb: suggestedCarb, suggestedCarb, calorieTarget: null, kcal: null };
  }

  const proteinKcal = protein * KCAL_PER_G.protein;
  const fatKcal = fat * KCAL_PER_G.fat;
  const remaining = calorieTarget - proteinKcal - fatKcal;
  const carbRoom = Math.max(0, Math.floor(remaining / KCAL_PER_G.carb));
  const carb = Math.min(suggestedCarb, carbRoom);
  const adjusted = carb < suggestedCarb;

  return {
    fits: !adjusted,
    adjusted,
    protein,
    fat,
    carb,
    suggestedCarb,
    carbRoom,
    calorieTarget,
    kcal: proteinKcal + fatKcal + carb * KCAL_PER_G.carb,
    // Energy the three macros do not account for. Room, not a shortfall — the
    // carb target is a reference, so Forge does not inflate it to fill the gap.
    headroomKcal: Math.max(0, calorieTarget - (proteinKcal + fatKcal + carb * KCAL_PER_G.carb)),
    // Why the number moved, in the user's words.
    note: adjusted
      ? `Your calorie target leaves room for about ${carb} g of carbs after protein and adequate fat, so that is the target Forge uses. Raise your calorie target if you want the full ${suggestedCarb} g.`
      : null,
  };
}

/** Glycogen / muscular fullness education — shown, never scored. */
export const GLYCOGEN_EDUCATION = {
  title: 'Carbs, glycogen and muscular fullness',
  body: 'Muscle glycogen stores carbohydrate inside muscle. Glycogen is stored with water, which can contribute to a fuller muscular appearance. Adequate carbohydrate availability can also support high-quality resistance training.',
  // The honest caveat, stated in the app rather than only in a comment.
  caveat: 'Glycogen-associated water is not new muscle tissue. If you substantially increase carbohydrate intake, expect some early bodyweight increase that partly reflects glycogen and water rather than fat or muscle — that is normal, and it is not a sign that anything is wrong.',
};

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

/**
 * Standardised progress checks for a specialization block: Day 0, then every
 * two weeks. Comparable conditions are what make the comparison worth anything.
 */
export const SPECIALIZATION_CHECKPOINTS = [0, 14, 28, 42, 56];

export function checkpointDays(weeks = SPECIALIZATION.recommendedWeeks.max) {
  const last = weeks * 7;
  return SPECIALIZATION_CHECKPOINTS.filter(d => d <= last);
}

export const PHOTO_CONDITIONS = {
  title: 'Keep the conditions the same',
  items: [
    'Same lighting',
    'Same pose',
    'Same camera distance',
    'Same time of day',
    'Same pumped-vs-unpumped state',
  ],
  // The default, and the reason for it.
  defaultState: 'unpumped',
  note: 'Default to UNPUMPED photos for hypertrophy comparisons — a pump makes any two photos incomparable, and it is the easiest way to fool yourself.',
  honesty: 'A fuller-looking muscle is not proof of new muscle tissue. Glycogen, water, training recency and time of day all move how you look far faster than tissue does.',
};

export function defaultMeasurementSelection() {
  return Object.fromEntries(MEASUREMENTS.map(m => [m.id, m.defaultOn]));
}

// ── Fundamentals vs optimizations ───────────────────────────────────────────
/**
 * The challenge's internal split between what actually builds muscle and what
 * merely helps at the margins.
 *
 * This exists so optional adherence can never stand in for the real work. XP
 * already encodes it — every optimization is priced below the cheapest
 * fundamental — but the split is named here so the panel and the insights can
 * report the two separately, and so a test can assert the pricing rule rather
 * than trusting it.
 */
export const FUNDAMENTAL_KEYS = [
  HABIT_KEYS.HYPERTROPHY_TRAINING,
  HABIT_KEYS.PROTEIN_TARGET,
  HABIT_KEYS.CALORIE_TARGET,
  HABIT_KEYS.CARBOHYDRATE_TARGET,
  HABIT_KEYS.SLEEP_TARGET,
];
export const OPTIMIZATION_KEYS = [
  HABIT_KEYS.CREATINE,
  HABIT_KEYS.PROTEIN_DISTRIBUTION,
  HABIT_KEYS.MICRONUTRIENT_COVERAGE,
  HABIT_KEYS.STRESS_RECOVERY,
];

export const HIERARCHY = {
  fundamentals: [
    'Productive hypertrophy training',
    'Progressive overload / performance progression',
    'Appropriate weekly volume',
    'Sufficient energy intake',
    'Protein',
    'Adequate carbohydrate availability',
    'Sleep and recovery',
  ],
  optimizations: [
    'Creatine',
    'Protein distribution',
    'Micronutrient coverage',
    'Specialization strategy',
    'Stress-management practice',
  ],
  rule: 'Optimizations are worth having and worth very little without the fundamentals. Forge prices them far below the basics on purpose, and reports the two separately — perfect creatine with poor training and protein is not a good Muscle Building block, and the app will say so.',
  // Below this, fundamentals adherence is called out regardless of how good the
  // optimization adherence looks.
  poorFundamentalsPct: 70,
};

/** True when a habit key counts as a fundamental for this challenge. */
export function isFundamental(habitKey) {
  return FUNDAMENTAL_KEYS.includes(habitKey);
}

/**
 * Split adherence into fundamentals and optimizations.
 *
 * Reports the two independently and flags when strong optional adherence is
 * sitting on top of weak basics — the case the hierarchy exists to catch. This
 * is a READOUT, not a second scoring system: it never modifies XP, the
 * challenge score, or any grade.
 */
export function hierarchyBreakdown({ tasks = [], days = {}, upto = 0 }) {
  const rows = tasks.filter(t => t.habitKey);
  const fundamentals = rows.filter(t => isFundamental(t.habitKey));
  const optimizations = rows.filter(t => OPTIMIZATION_KEYS.includes(t.habitKey));

  const adherence = (list) => {
    let done = 0, total = 0;
    for (let n = 1; n <= upto; n++) {
      const rec = days?.[n];
      if (!rec) continue;
      for (const t of list) { total++; if (rec.tasks?.[t.id]) done++; }
    }
    return total ? { done, total, pct: Math.round((done / total) * 100) } : null;
  };

  const f = adherence(fundamentals);
  const o = adherence(optimizations);
  const weakFundamentals = !!f && f.pct < HIERARCHY.poorFundamentalsPct;
  return {
    fundamentals: f,
    optimizations: o,
    fundamentalCount: fundamentals.length,
    optimizationCount: optimizations.length,
    weakFundamentals,
    // Fires only when the optional work is genuinely outperforming the basics.
    masking: weakFundamentals && !!o && o.pct > (f?.pct ?? 0) + 10,
    message: weakFundamentals && !!o && o.pct > (f?.pct ?? 0) + 10
      ? `Your optional habits are at ${o.pct}% but the fundamentals are at ${f.pct}%. The optimizations are not the problem and they are not the fix — training, protein, energy and sleep are what move this.`
      : null,
  };
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
    desc: 'Spread protein across roughly 3–4 substantial feedings rather than most of it in one meal.',
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
  {
    id: 'mb_micronutrients',
    key: 'micronutrients',
    habitKey: HABIT_KEYS.MICRONUTRIENT_COVERAGE,
    name: 'Micronutrient Coverage',
    icon: '🥦',
    color: '#84CC16',
    xp: XP.micronutrients,
    keystone: 0,
    desc: 'One check: did today\'s food broadly cover your bases? General adequacy over time — not 100% of every RDA every day.',
    setupLabel: 'Micronutrient Coverage — broad dietary adequacy',
  },
];

// ── "Why this helps" ────────────────────────────────────────────────────────
// Deliberately measured language. No claim that any habit guarantees growth,
// raises testosterone, or works as an on/off threshold.
export const WHY = {
  [HABIT_KEYS.PROTEIN_TARGET]: 'Provides the amino acids needed to repair and build muscle. Around 0.8–0.9 g/lb is generally sufficient when calories are adequate; 1.0 g/lb is margin rather than a bigger stimulus.',
  [HABIT_KEYS.CARBOHYDRATE_TARGET]: 'Carbohydrates replenish muscle glycogen and help support high-quality, high-volume resistance training.',
  [HABIT_KEYS.MICRONUTRIENT_COVERAGE]: 'Inadequate micronutrient intake can become a bottleneck for training and recovery. Adequate is the goal — more than adequate does not add growth.',
  [HABIT_KEYS.HYPERTROPHY_TRAINING]: 'Hard resistance training provides the stimulus that tells muscle tissue to adapt and grow.',
  [HABIT_KEYS.CALORIE_TARGET]: 'Muscle growth requires enough energy to support training, recovery, and new tissue.',
  [HABIT_KEYS.SLEEP_TARGET]: 'Sleep supports recovery, performance, and the processes involved in adaptation.',
  [HABIT_KEYS.STRESS_RECOVERY]: 'Unnecessary chronic psychological stress makes recovery and consistent high-quality training harder. The aim is being able to return to a relaxed baseline after stressors — not eliminating a stress response. Training itself raises cortisol, and that is a normal, appropriate part of adapting.',
  [HABIT_KEYS.CREATINE]: 'Creatine can improve repeated high-intensity performance and modestly enhance gains from resistance training over time.',
  [HABIT_KEYS.PROTEIN_DISTRIBUTION]: 'Spreading protein across roughly 3–4 substantial feedings gives muscle several opportunities to respond, rather than most of the day\'s protein arriving at once. A substantial high-quality feeding will often supply roughly 2–3+ g of leucine — you do not need to track that, and it is not an on/off threshold. When total daily protein is already sufficient, distribution is a small refinement, not a large advantage.',
  specialization: 'A specialization block reallocates recoverable volume toward your priority muscles. It does not add whole-body growth — other muscles get less and progress more slowly for the length of the block.',
  volume: 'Weekly hard sets are the clearest dose of training that drives growth. Around 10 challenging sets per muscle per week is a useful starting point, not a universal rule — and the target is the LOWEST volume that keeps you progressing, not the highest you can survive.',
  stimulus: 'Volume only counts when the sets are hard enough to matter. Roughly 0–3 reps in reserve on most working sets, with controlled execution and a useful range of motion. You do not need to take sets to failure.',
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
    // Carbohydrate: demand level drives the suggestion; the gram figure is then
    // reconciled against the calorie target before it becomes a task.
    carbDemand: DEFAULT_CARB_DEMAND,
    carbPerLb: DEFAULT_CARB_PER_LB,
    carbGrams: null,             // null → derived from bodyweight and demand
    sleepHours: SLEEP_TARGET.suggested,
    volumeTargets: defaultVolumeTargets(),
    // Balanced by default — a specialization block is always an explicit choice.
    specialization: { enabled: false, priority: [], prioritySets: SPECIALIZATION.prioritySets.suggested, exposures: SPECIALIZATION.exposures.suggested, weeks: SPECIALIZATION.recommendedWeeks.max, currentSets: {} },
    optimizations: { proteinDistribution: false, creatine: false, micronutrients: false },
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
/**
 * The resolved nutrition numbers for a setup, in hierarchy order: energy target
 * first, then protein, then adequate fat, then carbohydrate takes what remains.
 * Shared by the task list and the attempt metadata so they can never disagree.
 */
export function resolveNutrition(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  const protein = s.proteinGrams || suggestedProteinGrams(s.bodyweightLb, s.proteinPerLb);
  const suggestedCarb = s.carbGrams || suggestedCarbGrams(s.bodyweightLb, s.carbPerLb);
  const macros = reconcileMacros({
    bodyweightLb: s.bodyweightLb,
    calorieTarget: s.calorieTarget,
    proteinGrams: protein || 0,
    carbGrams: suggestedCarb || 0,
  });
  return {
    proteinGrams: protein,
    // Null only when bodyweight is unknown — then the task carries guidance
    // rather than a number, exactly as protein already does.
    carbGrams: suggestedCarb ? macros.carb : null,
    suggestedCarbGrams: suggestedCarb,
    macros,
  };
}

export function buildStartTasks(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  const { proteinGrams: grams, carbGrams, macros } = resolveNutrition(s);
  const mode = nutritionMode(s.nutritionMode);
  const demand = carbDemandLevel(s.carbDemand);

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
        ? `About ${s.proteinPerLb} g per lb of bodyweight. ${PROTEIN_PER_LB.note}`
        : `Aim for ${PROTEIN_PER_LB.min}–${PROTEIN_PER_LB.max} g per lb of bodyweight. ${PROTEIN_PER_LB.note}`,
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
      id: 'mb_carbs',
      name: carbGrams ? `Hit carb target (${carbGrams} g)` : 'Hit carb target',
      icon: '🍚',
      color: '#FBBF24',
      xp: XP.carbs,
      keystone: 2,
      habitKey: HABIT_KEYS.CARBOHYDRATE_TARGET,
      ...(carbGrams ? { target: { value: carbGrams, unit: 'g_carb', direction: 'atLeast' } } : {}),
      desc: carbGrams
        ? `${demand.label} — about ${s.carbPerLb} g per lb.${macros.adjusted ? ` Trimmed to fit your calorie target (${macros.suggestedCarb} g suggested).` : ''}`
        : `${demand.label} — roughly ${demand.perLb.min}–${demand.perLb.max} g per lb of bodyweight, inside your calorie target.`,
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
  const { proteinGrams: grams, carbGrams, suggestedCarbGrams: suggCarb, macros } = resolveNutrition(s);
  const spec = s.specialization || {};
  const specializing = !!spec.enabled && (spec.priority || []).length > 0;
  // A specialization block reallocates the attempt's volume targets. Balanced
  // attempts keep exactly the targets they had.
  const volumeTargets = specializing
    ? specializationTargets({
      priority: spec.priority,
      prioritySets: spec.prioritySets ?? SPECIALIZATION.prioritySets.suggested,
      base: s.volumeTargets,
    })
    : { ...s.volumeTargets };
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
      carbDemand: s.carbDemand,
      carbPerLb: s.carbPerLb,
      carbGrams,
      suggestedCarbGrams: suggCarb,
      macros,
      sleepHours: s.sleepHours,
      volumeTargets,
      // Baseline targets, kept so ending a block can restore them and so the
      // ramp knows where the user actually started from.
      baseVolumeTargets: { ...s.volumeTargets },
      specialization: {
        enabled: specializing,
        priority: [...(spec.priority || [])].slice(0, SPECIALIZATION.maxPriority),
        prioritySets: spec.prioritySets ?? SPECIALIZATION.prioritySets.suggested,
        exposures: spec.exposures ?? SPECIALIZATION.exposures.suggested,
        weeks: spec.weeks ?? SPECIALIZATION.recommendedWeeks.max,
        // Where each priority muscle was before the block — drives the ramp so
        // nobody is jumped straight to the top of the range.
        currentSets: { ...(spec.currentSets || {}) },
      },
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
