import { HABIT_KEYS } from './habitKeys';
import { ENERGY_FIELDS, ENERGY_SCALE } from '../utils/energyTracking';

/**
 * ⚡ 10-Day Energy Reset — the complete challenge definition.
 *
 * Everything challenge-specific lives here: the identity, the daily habits and
 * their XP weighting, the weekly exercise requirement, the education copy and
 * the completion-insight wiring. The template entry, the setup screen, the daily
 * panel and the completion block are all generated from these constants, so the
 * challenge is edited here rather than across the codebase.
 *
 * What makes it different from Forge's longer challenges is the length and the
 * measurement: ten days is short enough to start today, and long enough that a
 * before/after in the user's own energy ratings means something. The ratings are
 * the point — the habits are the intervention, the ratings are the read-out.
 *
 * To evolve it later, change data here, not logic elsewhere:
 *   • add/remove a daily habit  → DAILY_HABITS
 *   • change XP weighting       → XP (the priority ladder is documented there)
 *   • change the weekly target  → WEEKLY_DEFAULTS / weeklyRequirementDefs
 *   • change the education copy → WHY / MICRONUTRIENTS / CAFFEINE / WIND_DOWN
 */

export const ENERGY_RESET_TEMPLATE_ID = 'energy_reset_10_day';

export const IDENTITY = {
  id: ENERGY_RESET_TEMPLATE_ID,
  name: '10-Day Energy Reset',
  shortName: 'Energy Reset',
  subtitle: 'Wake Up Sharper. Crash Less. Feel It in 10 Days.',
  emoji: '⚡',
  goal: '10 days to wake up sharper, reduce energy crashes, and feel consistently energized throughout the day.',
  pitch: 'Short enough to start today. Long enough to actually notice the difference.',
};

// Fixed length — the whole premise is that ten days is the commitment.
export const DURATION_DAYS = 10;
export const COMPLETION_BONUS_XP = 400;

// ── XP weighting ────────────────────────────────────────────────────────────
// Forge's existing scale (keystones 40, supporting habits 10–30). The REQUIRED
// importance ladder from highest to lowest, and the reason for each tier:
//
//   Sleep opportunity        40  HIGHEST   nothing else compensates for too
//                                          little time in bed
//   Morning light            30  HIGH      the strongest lever on morning
//   Nutrient-dense eating    30  HIGH      alertness and circadian timing
//   Exercise (weekly)        30  HIGH      substrate for energy metabolism
//   Daily steps              20  MEDIUM    consistent low-grade movement
//   Morning hydration        15  MEDIUM
//   Caffeine discipline      15  MEDIUM    protects the sleep above it
//   Stress downshift         12  SUPPORT
//   Evening wind-down        10  SUPPORT
//   Daily Log                10            shared Forge task; carries the
//                                          energy ratings
export const XP = {
  sleep: 40,
  morningLight: 30,
  nutrientDense: 30,
  exercise: 30,
  aerobic: 25,
  steps: 20,
  hydration: 15,
  caffeine: 15,
  stress: 12,
  windDown: 10,
  dailyLog: 10,
};

// ── Editable targets (all pre-filled; the setup screen is one screen) ───────
export const MORNING_LIGHT = { minutes: 10, withinMinutesOfWaking: 60 };
export const STEP_TARGET = { suggested: 8000, unit: 'steps' };
export const SLEEP_OPPORTUNITY = { suggested: 8, min: 6, max: 10, unit: 'hours' };
export const STRESS_MINUTES = { suggested: 5, min: 5, unit: 'minutes' };
export const CAFFEINE_CUTOFF = { suggested: 10, unit: 'hours before bed' };
export const WEEKLY_DEFAULTS = { resistancePerWeek: 2, aerobicPerWeek: 2 };

/**
 * Micronutrients that participate in normal energy metabolism, with food
 * sources.
 *
 * This is EDUCATION, not a tracking requirement. Forge never asks the user to
 * log individual micronutrients or hit an RDA — the daily habit is "eat
 * nutrient-dense food and deliberately cover these bases", and this list is what
 * "these bases" means, shown on demand.
 */
export const MICRONUTRIENTS = [
  { id: 'folate',    name: 'Folate',    sources: 'Leafy greens, legumes, beans, citrus, liver' },
  { id: 'b12',       name: 'B12',       sources: 'Meat, fish, eggs, dairy — or a supplement if you eat plant-based' },
  { id: 'iron',      name: 'Iron',      sources: 'Red meat, shellfish, legumes, dark greens (pair plant sources with vitamin C)' },
  { id: 'magnesium', name: 'Magnesium', sources: 'Nuts, seeds, legumes, whole grains, dark chocolate, leafy greens' },
  { id: 'b1',        name: 'B1 (Thiamine)',   sources: 'Pork, whole grains, legumes, sunflower seeds' },
  { id: 'b2',        name: 'B2 (Riboflavin)', sources: 'Dairy, eggs, almonds, mushrooms, lean meat' },
  { id: 'b3',        name: 'B3 (Niacin)',     sources: 'Poultry, fish, peanuts, whole grains' },
  { id: 'b6',        name: 'B6',        sources: 'Poultry, fish, potatoes, bananas, chickpeas' },
  { id: 'iodine',    name: 'Iodine',    sources: 'Iodised salt, dairy, eggs, seafood, seaweed' },
  { id: 'selenium',  name: 'Selenium',  sources: 'Brazil nuts (one or two is plenty), fish, eggs, whole grains' },
];

export const MICRONUTRIENT_NOTE =
  'You do not need to track any of this. Eat real food across these groups over the week and you will cover most of it without counting anything. This list is here so "nutrient-dense" means something concrete, not so you can audit yourself daily.';

export const MICRONUTRIENT_CAUTION =
  'Persistent fatigue despite good sleep and food is worth a conversation with a doctor — deficiencies (iron and B12 especially), thyroid function and other medical causes are real, common, and not fixed by discipline.';

// ── Education blocks ───────────────────────────────────────────────────────
export const MORNING_LIGHT_GUIDE = {
  title: 'Morning light',
  blurb: `Get outside within about ${MORNING_LIGHT.withinMinutesOfWaking} minutes of waking, for ${MORNING_LIGHT.minutes}+ minutes. Outdoor light is far brighter than indoor light even on a grey day.`,
  items: [
    'Overcast still counts — outdoor shade beats a bright room.',
    'Through a window is weaker. Outside is the point.',
    'On a dark winter morning, get the light when it arrives and keep the wake time steady.',
    'Combine it with something you already do: coffee, the dog, the walk to work.',
  ],
  notice: 'Flexible by design. If the weather or the season makes ten minutes outdoors unrealistic, get what you can and keep the habit — this is not an all-or-nothing requirement.',
};

export const SLEEP_GUIDE = {
  title: 'Sleep opportunity',
  blurb: 'This habit is about the TIME you give yourself in bed, not about forcing yourself to fall asleep. You cannot will yourself asleep; you can protect the window.',
  items: [
    'Pick a consistent wake time and hold it — including weekends. It anchors everything else.',
    'Work backwards from that wake time to set a realistic lights-out.',
    'Individual sleep need varies. Aim for enough that you wake without dragging, not for a number someone else picked.',
    'A bad night happens. Keep the wake time and let the next night catch up.',
  ],
  notice: 'Consistency of wake time matters at least as much as total hours. It is the single most repeatable thing here.',
};

export const CAFFEINE = {
  title: 'Caffeine discipline',
  principle: 'Use caffeine deliberately — not to paper over sleep you did not get.',
  items: [
    `Keep it well clear of bedtime — roughly ${CAFFEINE_CUTOFF.suggested} hours, adjusted to how sensitive you are.`,
    'Notice when a second or third cup is compensating for a short night rather than adding anything.',
    'Caffeine borrows alertness against later. On top of poor sleep it makes the crash bigger.',
    'You do not have to quit. This is about timing and honesty, not abstinence.',
  ],
  notice: 'This habit is marked complete when you kept caffeine away from bedtime AND did not use it to replace sleep. Both halves, your honest call.',
};

export const STRESS_OPTIONS = ['Meditation', 'Diaphragmatic breathing', 'NSDR', 'Prayer', 'A quiet walk'];

export const WIND_DOWN = {
  title: 'Evening wind-down',
  blurb: 'Protect the stretch before sleep: lower stimulation, dimmer light, and the same few steps every night so your body learns the cue.',
  items: [
    'Dim the lights — overhead lights off, lamps on.',
    'Get off the doom-scroll. The content is more stimulating than the screen.',
    'Same short sequence each night, in the same order.',
    'Keep it boring on purpose. Boring is the mechanism.',
  ],
};

export const EXERCISE_GUIDE = {
  principle: 'Resistance training plus easy aerobic work — tracked by the week, not forced every day.',
  blurb: 'Exercise is a weekly requirement so it fits around the rest of your life and around any training you are already doing. Ten days is not the moment to overhaul your programme.',
  items: [
    'Already following a training plan? Keep it. Log the sessions you were doing anyway.',
    'Aerobic work here means conversational pace — Zone 2, not intervals.',
    'Resistance training is anything loaded and progressive: gym, bands, bodyweight.',
    'A hard session late at night can cost you the sleep habit. Earlier is usually better for energy.',
  ],
  notice: 'If you are running another fitness challenge alongside this one, its sessions count here too — a session is logged once and satisfies both.',
};

/**
 * "Why this helps" — shown per habit in the setup screen and the daily panel.
 * Deliberately mechanistic and modest: none of these promises a cure, and the
 * challenge never claims a habit caused a measured change.
 */
export const WHY = {
  [HABIT_KEYS.SLEEP_TARGET]:
    'Everything else on this list is a rounding error next to enough time in bed at a consistent hour. If only one habit survives the ten days, make it this one.',
  [HABIT_KEYS.MORNING_LIGHT]:
    'Bright light early is the strongest everyday signal for the timing of your sleep–wake rhythm. It tends to show up as easier mornings and a clearer drop into sleep at night.',
  [HABIT_KEYS.WHOLE_FOODS]:
    'The reactions that turn food into usable energy depend on B vitamins, iron, magnesium, iodine and selenium. Nutrient-dense eating covers those without you tracking a single milligram.',
  [HABIT_KEYS.EXERCISE_SESSION]:
    'Regular resistance and aerobic training improve how well you use fuel and oxygen. Counterintuitively, spending energy on training is one of the more reliable ways to have more of it.',
  [HABIT_KEYS.DAILY_STEPS]:
    'Long unbroken sitting flattens energy on its own. Steps spread movement across the day rather than concentrating it in one session.',
  [HABIT_KEYS.HYDRATION]:
    'You wake up mildly dehydrated after a night of breathing and not drinking. Even mild dehydration reliably shows up as fatigue and worse concentration.',
  [HABIT_KEYS.CAFFEINE_DISCIPLINE]:
    'Caffeine too late erodes the sleep that everything else depends on, and caffeine used to cover a short night makes the afternoon crash deeper. This habit protects the keystone.',
  [HABIT_KEYS.STRESS_RECOVERY]:
    'A few minutes of deliberate downshifting interrupts an all-day stress response that otherwise drains you and follows you to bed.',
  [HABIT_KEYS.EVENING_WINDDOWN]:
    'Light and stimulation late push your sleep timing later. A predictable, dimmer wind-down is what makes the sleep habit achievable rather than aspirational.',
  [HABIT_KEYS.DAILY_LOG]:
    'Your three energy ratings live here. They are the entire measurement — without them the Day 10 comparison has nothing to compare.',
};

// ── Energy ratings ─────────────────────────────────────────────────────────
export const ENERGY_PROMPT = {
  title: 'Rate your energy',
  blurb: 'Three taps. Go with your gut — a rough number logged every day beats a precise one logged twice.',
  fields: ENERGY_FIELDS,
  scale: ENERGY_SCALE,
  missingNote: 'Miss a day and nothing breaks — the Day 10 comparison simply uses the days you did rate.',
};

export const BASELINE_PROMPT = {
  title: 'Where are you starting from?',
  blurb: 'Optional. Rate a typical recent day so Day 10 has something honest to compare against.',
  skipNote: 'Skip it and Forge uses your earliest few days of ratings as the baseline instead. Either way you can start right now.',
};

/**
 * Habits whose effect is compared against the NEXT day's rating.
 *
 * Last night's sleep and last night's wind-down show up in today's energy, not
 * in the rating logged the evening you did them.
 */
export const LAGGED_HABIT_KEYS = [HABIT_KEYS.SLEEP_TARGET, HABIT_KEYS.EVENING_WINDDOWN];

// ── The daily habits ───────────────────────────────────────────────────────
/**
 * Habit definitions in priority order. `build` receives the resolved setup and
 * returns the display fields that depend on the user's chosen targets.
 *
 * Every habit declares a canonical habitKey so that running Energy Reset
 * alongside another challenge merges the shared behaviours into ONE row that
 * satisfies both — the existing shared-habit dedup handles this, so a single
 * action can never be paid for twice.
 */
export const DAILY_HABITS = [
  {
    id: 'er_sleep', habitKey: HABIT_KEYS.SLEEP_TARGET,
    icon: '😴', color: '#A78BFA', xp: XP.sleep, keystone: 3, keystoneHabit: true,
    build: (s) => ({
      name: `Sleep opportunity: ${s.sleepHours}+ hours`,
      target: { value: s.sleepHours, unit: 'hours', direction: 'atLeast' },
      desc: `Give yourself the time in bed to meet your own sleep need, and keep a consistent wake time. It is the opportunity that counts, not whether every hour was perfect.`,
    }),
  },
  {
    id: 'er_light', habitKey: HABIT_KEYS.MORNING_LIGHT,
    icon: '🌅', color: '#FBBF24', xp: XP.morningLight, keystone: 3,
    build: (s) => ({
      name: `Morning light: ${s.lightMinutes}+ minutes outdoors`,
      target: { value: s.lightMinutes, unit: 'minutes', direction: 'atLeast' },
      desc: `Outside within about ${MORNING_LIGHT.withinMinutesOfWaking} minutes of waking. Overcast counts — outdoor light beats indoor light even on a grey day.`,
    }),
  },
  {
    id: 'er_nutrition', habitKey: HABIT_KEYS.WHOLE_FOODS,
    icon: '🥗', color: '#6BCB77', xp: XP.nutrientDense, keystone: 2,
    build: () => ({
      name: 'Eat nutrient-dense whole foods',
      desc: 'Mostly minimally processed, and a deliberate effort across the food groups that carry the micronutrients energy metabolism runs on. No tracking, no RDA targets.',
    }),
  },
  {
    id: 'er_steps', habitKey: HABIT_KEYS.DAILY_STEPS,
    icon: '🚶', color: '#FFB347', xp: XP.steps, keystone: 2,
    build: (s) => ({
      name: `Walk ${s.stepTarget.toLocaleString()}+ steps`,
      target: { value: s.stepTarget, unit: 'steps', direction: 'atLeast' },
      desc: 'Movement spread across the day. This is separate from your training — a gym session alone does not usually get you here.',
    }),
  },
  {
    id: 'er_hydration', habitKey: HABIT_KEYS.HYDRATION,
    icon: '💧', color: '#45B7D1', xp: XP.hydration, keystone: 1,
    build: () => ({
      name: 'Drink water soon after waking',
      desc: 'You wake up mildly dehydrated. Electrolytes are worth it if you sweat heavily or train hard — otherwise water is fine and nothing extra is required.',
    }),
  },
  {
    id: 'er_caffeine', habitKey: HABIT_KEYS.CAFFEINE_DISCIPLINE,
    icon: '☕', color: '#B45309', xp: XP.caffeine, keystone: 2,
    build: (s) => ({
      name: 'Caffeine used deliberately',
      target: { value: s.caffeineCutoffHours, unit: 'hours before bed', direction: 'atLeast' },
      desc: `Kept roughly ${s.caffeineCutoffHours}+ hours clear of bedtime, and not used to paper over a short night. Your honest call — not an abstinence rule.`,
    }),
  },
  {
    id: 'er_stress', habitKey: HABIT_KEYS.STRESS_RECOVERY,
    icon: '🌿', color: '#34D399', xp: XP.stress, keystone: 1,
    build: (s) => ({
      name: `${s.stressMinutes}+ minutes of downshifting`,
      target: { value: s.stressMinutes, unit: 'minutes', direction: 'atLeast' },
      desc: `Your choice: ${STRESS_OPTIONS.join(',').toLowerCase()}, or anything else deliberately calming.`,
    }),
  },
  {
    id: 'er_winddown', habitKey: HABIT_KEYS.EVENING_WINDDOWN,
    icon: '🌙', color: '#818CF8', xp: XP.windDown, keystone: 1,
    build: () => ({
      name: 'Evening wind-down',
      desc: 'Lower stimulation, dimmer light, and the same predictable routine before bed.',
    }),
  },
  {
    id: 'daily_log', habitKey: HABIT_KEYS.DAILY_LOG,
    icon: '📊', color: '#8B9DC3', xp: XP.dailyLog, keystone: 1,
    build: () => ({
      name: 'Complete Daily Log',
      desc: 'Including your three energy ratings — the measurement this whole challenge is built around.',
    }),
  },
];

/** Setup defaults. Every one is pre-filled so the challenge starts in one tap. */
export function defaultSetup() {
  return {
    sleepHours: SLEEP_OPPORTUNITY.suggested,
    lightMinutes: MORNING_LIGHT.minutes,
    stepTarget: STEP_TARGET.suggested,
    stressMinutes: STRESS_MINUTES.suggested,
    caffeineCutoffHours: CAFFEINE_CUTOFF.suggested,
    resistancePerWeek: WEEKLY_DEFAULTS.resistancePerWeek,
    aerobicPerWeek: WEEKLY_DEFAULTS.aerobicPerWeek,
    // Optional pre-challenge baseline — null means "derive it from my first days".
    baseline: null,
  };
}

/** The daily task list for an attempt. */
export function buildStartTasks(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  return DAILY_HABITS.map((h, i) => {
    const { build, ...rest } = h;
    return { ...rest, ...build(s), order: i };
  });
}

/**
 * Weekly exercise requirements, run through Forge's existing generic weekly
 * engine (per-attempt defs, so these targets are locked to this attempt).
 *
 * Over ten days that is one full week plus a 3-day week; the engine prorates the
 * short final week automatically, so the last three days ask for one session of
 * each rather than the full weekly target.
 */
export function weeklyRequirementDefs(setup = {}) {
  const s = { ...defaultSetup(), ...setup };
  return [
    {
      id: 'er_resistance', habitKey: HABIT_KEYS.HYPERTROPHY_TRAINING,
      label: 'Resistance Training', icon: '🏋️', perWeek: s.resistancePerWeek, xp: XP.exercise, keystone: 2,
      logLabel: 'Log Resistance Session', unit: 'session',
      note: 'Already training? Log the sessions you were doing anyway — this is not extra work.',
    },
    {
      id: 'er_aerobic', habitKey: HABIT_KEYS.EXERCISE_SESSION,
      label: 'Aerobic / Zone 2', icon: '❤️', perWeek: s.aerobicPerWeek, xp: XP.aerobic, keystone: 2,
      logLabel: 'Log Aerobic Session', unit: 'session',
      note: 'Conversational pace. A long walk, easy bike or steady jog all count.',
    },
  ];
}

/** The challenge-attempt metadata written by the setup flow. */
export function buildChallengeMeta(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  return {
    templateId: ENERGY_RESET_TEMPLATE_ID,
    name: IDENTITY.name,
    emoji: IDENTITY.emoji,
    subtitle: IDENTITY.subtitle,
    variant: 'standard',
    durationDays: DURATION_DAYS,
    templateVersion: 1,
    completionBonusXP: COMPLETION_BONUS_XP,
    // The attempt's own copy of its configuration, so later edits to this file
    // never rewrite a running challenge.
    energyReset: {
      sleepHours: s.sleepHours,
      lightMinutes: s.lightMinutes,
      stepTarget: s.stepTarget,
      stressMinutes: s.stressMinutes,
      caffeineCutoffHours: s.caffeineCutoffHours,
      resistancePerWeek: s.resistancePerWeek,
      aerobicPerWeek: s.aerobicPerWeek,
      baseline: s.baseline || null,
    },
    weeklyRequirementDefs: weeklyRequirementDefs(s),
  };
}

/** The Energy Reset config block of an attempt, or null. */
export function erConfig(meta) {
  return meta?.templateId === ENERGY_RESET_TEMPLATE_ID ? (meta.energyReset || null) : null;
}

/** True when this attempt tracks energy ratings. */
export function tracksEnergy(meta) {
  return meta?.templateId === ENERGY_RESET_TEMPLATE_ID;
}
