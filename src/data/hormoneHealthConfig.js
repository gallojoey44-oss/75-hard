import { HABIT_KEYS } from './habitKeys';

/**
 * Women's Hormone Health — 84 days / 12 weeks.
 *
 * EVERYTHING challenge-specific lives in this file: the daily and weekly
 * requirements, XP weighting, symptom check-in fields, Life Impact scoring, the
 * three-cycle stages, the educational copy and the medical-safety thresholds.
 * The template entry, setup screen, challenge panel and completion summary are
 * all generated from the constants below.
 *
 * ── What this challenge does and does not claim ────────────────────────────
 * It does NOT promise to "balance hormones", eliminate periods, or treat any
 * menstrual disorder. It builds sustainable habits that MAY reduce cramps,
 * fatigue, bloating, mood disruption, poor sleep and low energy — and, above
 * all, how much the cycle interferes with ordinary life.
 *
 * ── What it deliberately does not do ───────────────────────────────────────
 * No global cycle tracking, and no changes to any other Forge challenge. The
 * user knows where she is in her own cycle; Forge never tries to infer a phase.
 * The cycle-aware exercise rule below applies ONLY inside this challenge.
 */

export const HORMONE_HEALTH_TEMPLATE_ID = 'womens_hormone_health';

export const IDENTITY = {
  id: HORMONE_HEALTH_TEMPLATE_ID,
  name: "Women's Hormone Health",
  subtitle: 'Build habits. Reclaim your month.',
  emoji: '🌸',
  goal: 'Build sustainable health habits that may reduce menstrual cramps, fatigue, bloating, mood disruption and poor sleep — and reduce how much your cycle interferes with your life.',
  // Stated plainly and up front, so the challenge never oversells itself.
  disclaimer: 'This challenge does not claim to balance hormones, eliminate periods, or treat any medical condition. It builds habits that may help, and it measures whether your cycle is interfering with your life less over time.',
};

// ── Duration ────────────────────────────────────────────────────────────────
// Fixed at 84 days — roughly three menstrual cycles — so progress is judged on a
// trend rather than on one period. No shorter versions.
export const DURATION_DAYS = 84;
export const CYCLES_COVERED = 3;

// ── The three stages ────────────────────────────────────────────────────────
export const CYCLE_STAGES = [
  { cycle: 1, label: 'Baseline', title: 'Cycle 1 — Baseline / Foundation',
    blurb: 'Establish the habits and get an honest picture of your current symptoms. Nothing here is a test — this is the measurement you compare against.' },
  { cycle: 2, label: 'Improvement', title: 'Cycle 2 — Improvement',
    blurb: 'Compare this period against your baseline. Some things may be better, some the same. Both are information.' },
  { cycle: 3, label: 'Consolidation', title: 'Cycle 3 — Consolidation',
    blurb: 'Is the change holding? One good cycle can be luck. Two in a row is a trend.' },
];

// ── XP weighting ────────────────────────────────────────────────────────────
// Forge's existing scale (keystones 40, supporting tasks 10–25). Priority, per
// the challenge design, highest first:
//
//   Sleep & Recovery (KEYSTONE)  40   ┐
//   Whole-Food Nutrition         35   ├ highest importance
//   Exercise session (weekly)    35   ┘
//   Daily Movement               25   ┐
//   Stress Reduction             25   ├ medium importance
//   Omega-3 foods (weekly)       20   ┘
//   Iron-rich foods (weekly)     15   ┐
//   Symptom check-in             10   ├ supporting importance
//   Hydration                    10   ┘
//
// The keystone is worth four times the smallest supporting habit, so sleep is
// unambiguously the thing to protect on a hard day.
export const XP = {
  sleep: 40,
  wholeFood: 35,
  exercise: 35,
  movement: 25,
  stress: 25,
  omega3: 20,
  ironRich: 15,
  symptomCheckIn: 10,
  hydration: 10,
};

// ── Daily targets (all editable at setup) ───────────────────────────────────
export const SLEEP_TARGET = { min: 7.5, max: 9, suggested: 7.5, unit: 'hours' };
export const STEP_TARGET = { suggested: 8000, unit: 'steps' };
export const STRESS_MINUTES = { min: 5, suggested: 5, unit: 'minutes' };
export const HYDRATION = {
  // Deliberately the user's OWN normal target — no product, no special salt.
  note: 'Your normal daily hydration target. No special salt, trace minerals or electrolyte products required.',
  electrolyteNote: 'Electrolytes are optional and only worth considering after substantial sweating.',
};

export const STRESS_OPTIONS = [
  'Meditation',
  'Diaphragmatic breathing',
  'Prayer',
  'Journaling',
  'Quiet relaxation',
];

// ── Weekly targets ──────────────────────────────────────────────────────────
export const EXERCISE_PER_WEEK = 3;
export const OMEGA3_PER_WEEK = 2;          // "2–3 times per week" — 2 is the target
export const IRON_RICH_PER_WEEK = 4;

export const OMEGA3_FOODS = ['Salmon', 'Sardines', 'Trout', 'Herring', 'Mackerel'];
export const IRON_RICH_FOODS = ['Beef', 'Seafood', 'Eggs', 'Beans and lentils', 'Leafy greens'];

/**
 * The weekly requirements, generated for the existing weekly-requirements engine
 * so this challenge needs no parallel tracking system. Targets come from an
 * attempt's own setup, so changing this file never rewrites a running challenge.
 */
export function weeklyRequirementDefs(setup = {}) {
  const s = { ...defaultSetup(), ...setup };
  return [
    {
      id: 'hh_exercise', habitKey: HABIT_KEYS.EXERCISE_SESSION,
      label: 'Exercise', icon: '🏃', perWeek: s.exercisePerWeek, xp: XP.exercise, keystone: 3,
      logLabel: 'Log Exercise Session', unit: 'session',
      // The cycle-aware rule: any appropriately scaled session counts.
      note: 'Scaled sessions count in full — adjust intensity, not consistency.',
    },
    {
      id: 'hh_omega3', habitKey: HABIT_KEYS.OMEGA3_FOODS,
      label: 'Omega-3 Foods', icon: '🐟', perWeek: s.omega3PerWeek, xp: XP.omega3, keystone: 1,
      logLabel: 'Log Fatty Fish Meal', unit: 'meal',
      note: 'Food first — fish-oil supplements are never required.',
    },
    {
      id: 'hh_iron', habitKey: HABIT_KEYS.IRON_RICH_FOODS,
      label: 'Iron-Rich Foods', icon: '🥩', perWeek: s.ironRichPerWeek, xp: XP.ironRich, keystone: 1,
      logLabel: 'Log Iron-Rich Meal', unit: 'meal',
      note: 'Food first — no iron or liver supplements required.',
    },
  ];
}

// ── The cycle-aware exercise rule ───────────────────────────────────────────
// The single most important piece of guidance in this challenge, and the one
// that most needs to avoid telling women what their bodies can do.
export const EXERCISE_GUIDANCE = {
  principle: 'Adjust intensity, not consistency.',
  whenGood: {
    title: 'When energy and recovery are good',
    blurb: 'Train hard. Strength work, progressive overload, harder cardio, higher intensity — whatever you would normally do.',
    examples: ['Strength training', 'Progressive overload', 'Harder cardio', 'Higher-intensity work'],
  },
  whenSymptomatic: {
    title: 'When luteal or menstrual symptoms are significant',
    blurb: 'A scaled session still counts in full. Show up, do what fits today, and keep the streak of consistency intact.',
    examples: ['Moderate strength training', 'Pilates', 'Zone 2 cardio', 'Walking', 'Mobility', 'Yoga', 'Recovery-focused movement'],
  },
  // Explicit, because the opposite claim is common and wrong.
  notice: 'You are not biologically incapable of training hard during your period. If you feel good, train normally — chase a PR if you want one. If you feel rough, scale it. Both count.',
};

// ── During menstruation: optional comfort tools, never requirements ─────────
export const MENSTRUATION_TOOLS = {
  title: 'Optional comfort and recovery tools',
  blurb: 'None of these are required and none affect your score. They are simply things that help some people.',
  items: ['Heating pad', 'Warm bath', 'An easy walk', 'Mobility work', 'Extra recovery time', 'An extra 30–60 minutes of sleep opportunity'],
};

// ── Sleep guidance during the late luteal phase and menstruation ────────────
// Recommendations only — they never add a completion requirement.
export const SLEEP_GUIDANCE = {
  title: 'If symptoms or sleep get worse',
  items: [
    'Give yourself an extra 30–60 minutes of sleep opportunity if you need it.',
    'Keep the bedroom comfortably cool.',
    'Prioritise recovery over intensity while symptoms are significant.',
  ],
  notice: 'These are recommendations, not extra boxes to tick. The daily sleep target is the only sleep requirement.',
};

// ── Symptom check-in ────────────────────────────────────────────────────────
// Deliberately short. It appears only on days the user marks as menstrual days —
// there is no daily questionnaire, and Forge never infers a cycle phase.
export const SYMPTOM_SCALES = [
  { id: 'pain',         label: 'Pain / cramps', icon: '🩹', low: 'None',  high: 'Severe',    worseWhenHigh: true },
  { id: 'bloating',     label: 'Bloating',      icon: '🎈', low: 'None',  high: 'Severe',    worseWhenHigh: true },
  { id: 'energy',       label: 'Energy',        icon: '⚡', low: 'Drained', high: 'Great',   worseWhenHigh: false },
  { id: 'mood',         label: 'Mood',          icon: '🙂', low: 'Low',   high: 'Good',      worseWhenHigh: false },
  { id: 'sleepQuality', label: 'Sleep quality', icon: '😴', low: 'Poor',  high: 'Excellent', worseWhenHigh: false },
];

export const FLOW_OPTIONS = [
  { id: 'light',    label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'heavy',    label: 'Heavy' },
];

/** Did the cycle get in the way of ordinary life? The headline question. */
export const INTERFERENCE_AREAS = [
  { id: 'work',     label: 'Work / school',    icon: '💼' },
  { id: 'exercise', label: 'Exercise',         icon: '🏃' },
  { id: 'sleep',    label: 'Sleep',            icon: '😴' },
  { id: 'social',   label: 'Social / plans',   icon: '🫂' },
];

/**
 * Optional red-flag reports. Not part of the daily rhythm and never scored —
 * they exist so the symptoms that genuinely warrant medical evaluation have
 * somewhere to be recorded rather than being missed by a 1–10 pain slider.
 */
export const CONCERN_FLAGS = [
  { id: 'fainting',        label: 'Fainting or near-fainting' },
  { id: 'painBetween',     label: 'Pain between periods' },
  { id: 'painDuringSex',   label: 'Pain during sex' },
  { id: 'floodingClots',   label: 'Flooding or large clots' },
];

// ── Life Impact Score ───────────────────────────────────────────────────────
// 0–10, where 10 means the cycle dominated the day. The interference the cycle
// caused is weighted more heavily than raw symptom severity, because the
// question this challenge is really asking is "how much did this get in the way
// of your life?" rather than "did you still have cramps?".
export const LIFE_IMPACT = {
  interferenceWeight: 0.6,
  severityWeight: 0.4,
  // Bands used for the summary wording.
  bands: [
    { max: 2,  label: 'Barely disruptive',  tone: 'good' },
    { max: 4,  label: 'Mildly disruptive',  tone: 'good' },
    { max: 6,  label: 'Moderately disruptive', tone: 'info' },
    { max: 8,  label: 'Highly disruptive',  tone: 'warn' },
    { max: 10, label: 'Severely disruptive', tone: 'warn' },
  ],
};

// ── Medical safety ──────────────────────────────────────────────────────────
// Thresholds for a discreet, non-judgemental prompt to seek evaluation. These
// fire on REPEATED reports, never on one bad day.
export const SAFETY = {
  severePainScore: 8,          // 8+/10 counts as severe
  severePainDays: 3,           // that many severe days overall
  severePainCycles: 2,         // or severe in this many separate cycles
  heavyFlowDays: 3,            // repeated heavy flow
  interferenceDays: 3,         // repeatedly stopped from normal activities
  worseningCycles: 2,          // life impact rising across this many cycles
  message: {
    title: 'Worth getting checked',
    body: 'What you have been logging is worth discussing with a healthcare professional. Conditions such as endometriosis, adenomyosis, fibroids or anaemia can cause significant menstrual symptoms, and they cannot necessarily be improved by lifestyle habits alone.',
    // The line that matters most.
    reassurance: 'This is not a discipline problem, and it does not mean you did the challenge wrong. Some symptoms have a medical cause and deserve medical care.',
  },
  ironNote: 'Heavy menstrual bleeding can increase the risk of iron deficiency. If your flow is consistently heavy, it is reasonable to ask a healthcare professional about testing your iron levels.',
};

// ── Supplements: optional education only, never a requirement ───────────────
export const SUPPLEMENT_EDUCATION = {
  headline: 'Habits first. Food first. Supplements optional.',
  blurb: 'Nothing below is required to complete this challenge, and none of it is scored. It is here so that if you are going to consider something, you consider it with the evidence and the caveats.',
  items: [
    { name: 'Magnesium', note: 'Some evidence for menstrual cramps and sleep. Generally well tolerated; too much can cause digestive upset.' },
    { name: 'Ginger', note: 'Reasonable evidence for period pain, comparable to common over-the-counter options in some studies.' },
    { name: 'Omega-3', note: 'Some evidence for menstrual pain. Food sources come first in this challenge — a supplement is an alternative, not an upgrade.' },
    { name: 'Iron', note: 'Only when deficiency is confirmed or clinically indicated. Iron is not something to take speculatively — ask for a test first.' },
  ],
  caution: 'Supplements can interact with medications and are not appropriate for everyone. Talk to a healthcare professional before starting one.',
};

// ── Graduation ──────────────────────────────────────────────────────────────
export const GRADUATION = {
  title: 'The point is to not need this challenge',
  body: 'A highly disruptive cycle → foundational health habits → more manageable symptoms → a cycle that interferes less → and then the performance and body-composition challenges, run normally.',
  caveat: 'Not everyone becomes symptom-free, and that is not a failure. If your symptoms stay severe despite doing the work, that is information worth taking to a doctor — not evidence that you did not try hard enough.',
};

// ── "Why this helps" ────────────────────────────────────────────────────────
// Measured language throughout. Nothing here promises a cure.
export const WHY = {
  [HABIT_KEYS.SLEEP_TARGET]: 'Sleep is where recovery happens. Consistent sleep supports energy, mood and pain tolerance — which is why it is the keystone here rather than a supporting habit.',
  [HABIT_KEYS.WHOLE_FOODS]: 'Minimally processed food covers the protein, fibre and micronutrients your body needs. This is not a restrictive "hormone diet" — it is ordinary good eating, done consistently.',
  [HABIT_KEYS.EXERCISE_SESSION]: 'Regular exercise supports mood, sleep and energy. Scaling a session on a hard day keeps the habit intact, which matters far more than any single workout.',
  [HABIT_KEYS.DAILY_STEPS]: 'Daily movement keeps you moving on days when hard training is not realistic. It is the floor beneath your exercise habit, not a substitute for it.',
  [HABIT_KEYS.STRESS_RECOVERY]: 'A few minutes of deliberate down-regulation gives your nervous system a way back to baseline. It supports sleep and how you experience symptoms.',
  [HABIT_KEYS.HYDRATION]: 'Ordinary hydration supports energy and comfort. Your normal target is the target — no special products needed.',
  [HABIT_KEYS.OMEGA3_FOODS]: 'Fatty fish provides omega-3 fats, which have some evidence for menstrual pain. Food first, because whole fish brings protein and micronutrients with it.',
  [HABIT_KEYS.IRON_RICH_FOODS]: 'Menstrual bleeding loses iron. Regularly eating iron-rich food helps maintain your stores — and if your flow is heavy, it is worth asking a professional about testing.',
  [HABIT_KEYS.SYMPTOM_CHECKIN]: 'A short check-in on menstrual days is what makes the three-cycle comparison possible. Without it there is nothing to compare.',
};

// ── Setup ───────────────────────────────────────────────────────────────────
/** The editable configuration a new attempt starts from. */
export function defaultSetup() {
  return {
    sleepHours: SLEEP_TARGET.suggested,
    stepTarget: STEP_TARGET.suggested,
    stressMinutes: STRESS_MINUTES.suggested,
    hydrationNote: '',            // free text — the user's own normal target
    exercisePerWeek: EXERCISE_PER_WEEK,
    omega3PerWeek: OMEGA3_PER_WEEK,
    ironRichPerWeek: IRON_RICH_PER_WEEK,
    acknowledgedSafety: false,
  };
}

// ── Daily task list ─────────────────────────────────────────────────────────
/**
 * Build the daily tasks from a setup object.
 *
 * Every task carries its canonical habitKey, so requirements this challenge
 * shares with another (sleep, whole foods, steps, hydration, stress recovery)
 * deduplicate through the shared-habit system and are never paid XP twice.
 *
 * Exercise, omega-3 and iron-rich foods are NOT here — they are weekly
 * requirements, because the challenge cares that they happen across the week.
 */
export function buildStartTasks(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  const tasks = [
    {
      id: 'hh_sleep',
      name: `Sleep ${s.sleepHours}–${SLEEP_TARGET.max} hours`,
      icon: '😴', color: '#A78BFA',
      xp: XP.sleep, keystone: 3,
      keystoneHabit: true,                       // the challenge's Keystone Habit
      habitKey: HABIT_KEYS.SLEEP_TARGET,
      target: { value: s.sleepHours, unit: 'hours', direction: 'atLeast' },
      desc: 'Keep a reasonably consistent sleep and wake time. On rough days, give yourself extra sleep opportunity.',
    },
    {
      id: 'hh_whole_food',
      name: 'Eat mostly whole foods',
      icon: '🥗', color: '#6BCB77',
      xp: XP.wholeFood, keystone: 2,
      habitKey: HABIT_KEYS.WHOLE_FOODS,
      desc: 'Minimally processed, with enough protein, fruit, vegetables, quality carbs and healthy fats. Not a restrictive diet.',
    },
    {
      id: 'hh_movement',
      name: `Walk ${s.stepTarget.toLocaleString()}+ steps`,
      icon: '🚶', color: '#FFB347',
      xp: XP.movement, keystone: 2,
      habitKey: HABIT_KEYS.DAILY_STEPS,
      target: { value: s.stepTarget, unit: 'steps', direction: 'atLeast' },
      desc: 'Movement you can keep up even on days when hard exercise is not realistic.',
    },
    {
      id: 'hh_stress',
      name: `${s.stressMinutes}+ minutes of down-regulation`,
      icon: '🌿', color: '#34D399',
      xp: XP.stress, keystone: 1,
      habitKey: HABIT_KEYS.STRESS_RECOVERY,
      target: { value: s.stressMinutes, unit: 'minutes', direction: 'atLeast' },
      desc: `Your choice: ${STRESS_OPTIONS.join(', ').toLowerCase()}, or anything else deliberately calming.`,
    },
    {
      id: 'hh_hydration',
      name: 'Hit your hydration target',
      icon: '💧', color: '#45B7D1',
      xp: XP.hydration, keystone: 1,
      habitKey: HABIT_KEYS.HYDRATION,
      desc: s.hydrationNote?.trim() || HYDRATION.note,
    },
    {
      id: 'daily_log',
      name: 'Complete Daily Log',
      icon: '📊', color: '#8B9DC3',
      xp: XP.symptomCheckIn, keystone: 1,
      habitKey: HABIT_KEYS.DAILY_LOG,
    },
  ];
  return tasks.map((t, i) => ({ ...t, order: i }));
}

/** The challenge-attempt metadata written by the setup flow. */
export function buildChallengeMeta(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  return {
    templateId: HORMONE_HEALTH_TEMPLATE_ID,
    name: IDENTITY.name,
    emoji: IDENTITY.emoji,
    subtitle: IDENTITY.subtitle,
    variant: 'standard',
    durationDays: DURATION_DAYS,
    templateVersion: 1,
    completionBonusXP: 1200,
    // The attempt's own copy of its configuration.
    hormoneHealth: {
      sleepHours: s.sleepHours,
      stepTarget: s.stepTarget,
      stressMinutes: s.stressMinutes,
      hydrationNote: s.hydrationNote,
      exercisePerWeek: s.exercisePerWeek,
      omega3PerWeek: s.omega3PerWeek,
      ironRichPerWeek: s.ironRichPerWeek,
      acknowledgedSafety: !!s.acknowledgedSafety,
    },
    // Weekly requirements run through the existing generic engine.
    weeklyRequirementDefs: weeklyRequirementDefs(s),
  };
}

/** The Hormone Health config block of an attempt, or null. */
export function hhConfig(meta) {
  return meta?.templateId === HORMONE_HEALTH_TEMPLATE_ID ? (meta.hormoneHealth || null) : null;
}

/** True when this attempt is a Women's Hormone Health challenge. */
export function isHormoneHealth(meta) {
  return meta?.templateId === HORMONE_HEALTH_TEMPLATE_ID;
}
