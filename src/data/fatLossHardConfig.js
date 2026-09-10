import { HABIT_KEYS } from './habitKeys';

/**
 * ⚡ Fat Loss Challenge — HARD MODE (30 days).
 *
 * This is an addition to the EXISTING Fat Loss Challenge, not a replacement.
 * Beginner and Standard are untouched: they keep their own start_tasks in
 * challengeTemplates.js and the legacy weekly requirements (3 lifts + 2 Zone 2).
 * Everything specific to Hard Mode lives here.
 *
 * What makes Hard a progression rather than bigger numbers:
 *
 *   • 10,000 steps every day, up from 8,000
 *   • portion control by FULLNESS rather than by calorie counting
 *   • three cardio sessions at two different intensities, not two identical ones
 *   • a photo that is actually taken and stored, not a checkbox
 *   • a weekly objective measurement and review
 *   • a four-week arc that changes what is being asked of you
 *
 * What it explicitly is NOT: a crash diet. There is no calorie target, no
 * additional restriction in week 3, and no daily HIIT. The challenge gets harder
 * through consistency, and SAFETY says so in the app itself.
 */

export const FAT_LOSS_TEMPLATE_ID = 'fat_loss_phase';
export const HARD_VARIANT = 'hard';
export const HARD_DURATION_DAYS = 30;

/** True for an attempt that is Fat Loss running in Hard Mode. */
export function isFatLossHard(meta) {
  return meta?.templateId === FAT_LOSS_TEMPLATE_ID && meta?.variant === HARD_VARIANT;
}

/** The Hard Mode config block of an attempt, or null. */
export function hardConfig(meta) {
  return isFatLossHard(meta) ? (meta.fatLossHard || null) : null;
}

export const IDENTITY = {
  name: 'Fat Loss — Hard Mode',
  emoji: '⚡',
  subtitle: 'A focused 30-day cutting phase.',
  positioning: 'Normal Fat Loss teaches the habits. Hard Mode is executing them with high consistency — plus 10k steps every day, tighter portion awareness, structured cardio across two intensity zones, and daily visual tracking.',
};

// ── The mechanism: fullness, not calorie counting ───────────────────────────
export const FULLNESS = {
  title: 'Stop at ~90% fullness',
  short: 'Stop eating at ~90% full — satisfied, not stuffed.',
  plain: 'Finish meals satisfied, not stuffed. Stop when you feel like you could comfortably eat a little more.',
  why: 'This is Hard Mode\'s answer to calorie counting. Most overeating is unconscious — finishing a plate, eating past the point of satisfaction, a second helping taken automatically. Leaving that last 10% is a habit you can run anywhere, without weighing food or logging a single number.',
  // The honest limit of the claim. Stated in the app, not just in a comment.
  honesty: 'Forge is not claiming this creates a specific calorie deficit — it cannot know that. What it does is make a moderate deficit more likely, alongside high protein, mostly whole foods, 10k steps and structured cardio, without asking you to track anything.',
  howTo: [
    'Slow down enough to notice. Fullness lags the last few bites by a good ten minutes.',
    'Put the fork down before the plate is empty. Leaving something is the whole skill.',
    'Ask mid-meal: could I comfortably eat a bit more? If the honest answer is no, you have gone past 90%.',
    'Protein and whole foods first — they make 90% feel like enough far sooner.',
    'Miss it at one meal? The next meal is the next rep. This is a skill, not a test.',
  ],
};

// ── Protein ─────────────────────────────────────────────────────────────────
export const PROTEIN = {
  perLbLow: 0.8,
  perLbHigh: 1.0,
  title: 'Protein target',
  why: 'The habit that protects your result. In a deficit, protein is what keeps the weight you lose weighted toward fat rather than muscle, and it does more for fullness per calorie than anything else on the plate.',
  modes: [
    { id: 'perLb', label: 'Per pound of target weight', hint: '0.8–1.0 g per lb of the bodyweight you are aiming for' },
    { id: 'fixed', label: 'One fixed number', hint: 'Simpler: pick a daily gram target once and hit it every day' },
  ],
  defaultTargetWeight: 175,
  defaultFixedGrams: 150,
};

/** Grams of protein per day for a setup, whichever mode the user chose. */
export function proteinGrams(setup) {
  const s = setup || {};
  if (s.proteinMode === 'fixed') return Math.max(1, Math.round(s.proteinFixedGrams || PROTEIN.defaultFixedGrams));
  const w = Math.max(1, s.targetWeightLb || PROTEIN.defaultTargetWeight);
  return Math.round(w * PROTEIN.perLbLow);
}

/** Human label for the protein task at this setup. */
export function proteinLabel(setup) {
  const s = setup || {};
  if (s.proteinMode === 'fixed') return `Hit ${proteinGrams(s)}g protein`;
  const w = Math.max(1, s.targetWeightLb || PROTEIN.defaultTargetWeight);
  return `Hit protein: ${Math.round(w * PROTEIN.perLbLow)}–${Math.round(w * PROTEIN.perLbHigh)}g`;
}

// ── Targets ─────────────────────────────────────────────────────────────────
export const STEP_TARGET = 10000;
export const SLEEP_TARGET = { min: 7.5, max: 9 };
export const WHOLE_FOOD_PCT = 90;

// ── XP weighting ────────────────────────────────────────────────────────────
// Follows the EXISTING Fat Loss hierarchy exactly — ⭐⭐⭐ Keystone 40 ·
// ⭐⭐ Important 25 · ⭐ Supporting 10–15 — so Hard Mode's economy is
// continuous with Normal's rather than a competing scale.
//
// Highest importance (per the Hard Mode brief): protein, 10k steps, 90%
// fullness, resistance training. Fat Loss keeps exactly TWO daily Keystone
// habits (protein + whole foods) as it always has; steps and fullness sit at the
// top of the Important tier, and resistance training is the highest-XP weekly
// requirement.
export const XP = {
  protein: 40,        // ⭐⭐⭐ keystone
  wholeFood: 40,      // ⭐⭐⭐ keystone
  steps: 30,          // ⭐⭐ raised above Normal's 25 — this is the Hard differentiator
  fullness: 30,       // ⭐⭐ the portion-control mechanism
  sleep: 25,          // ⭐⭐
  water: 15,          // ⭐
  photo: 10,          // ⭐ required, low XP
  dailyLog: 10,       // ⭐
  // Weekly
  lifting: 30,        // highest-importance weekly requirement
  zone2: 20,
  intervals: 25,
  waist: 15,          // required weekly, lower XP
  review: 10,
};

// ── Daily requirements ──────────────────────────────────────────────────────
/**
 * Hard Mode's daily task list.
 *
 * Note what is NOT here: any calorie target. Normal Hard Mode (before this
 * build) carried an `fl_deficit` "stay in a 300–600 calorie deficit" task; it is
 * replaced by the fullness habit, because asking for a numeric deficit requires
 * exactly the calorie tracking this challenge is designed to avoid.
 */
export function buildStartTasks(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  return [
    {
      id: 'fl_protein', name: proteinLabel(s), icon: '🥩', color: '#FF6B6B',
      xp: XP.protein, keystone: 3, keystoneHabit: true,
      habitKey: HABIT_KEYS.PROTEIN_TARGET,
      target: { value: proteinGrams(s), unit: 'g', direction: 'atLeast' },
      desc: 'Preserves muscle in a deficit, and keeps you full enough that 90% fullness is not a fight.',
    },
    {
      id: 'fl_whole', name: `Eat mostly whole foods (~${WHOLE_FOOD_PCT}%)`, icon: '🥗', color: '#6BCB77',
      xp: XP.wholeFood, keystone: 3, keystoneHabit: true,
      habitKey: HABIT_KEYS.WHOLE_FOODS,
      desc: 'Roughly nine meals in ten minimally processed. Not a ban list — the remaining 10% is deliberate room, not a failure.',
    },
    {
      id: 'fl_steps', name: `Walk ${STEP_TARGET.toLocaleString()}+ steps`, icon: '🚶', color: '#FFB347',
      xp: XP.steps, keystone: 2,
      habitKey: HABIT_KEYS.DAILY_STEPS,
      target: { value: STEP_TARGET, unit: 'steps', direction: 'atLeast' },
      desc: 'Every day, not on average. This is the main lever Hard Mode adds over Normal, and it costs almost nothing in recovery.',
    },
    {
      id: 'fl_fullness', name: FULLNESS.short, icon: '🍽️', color: '#F97316',
      xp: XP.fullness, keystone: 2,
      habitKey: HABIT_KEYS.FULLNESS_CONTROL,
      desc: FULLNESS.plain,
    },
    {
      id: 'fl_sleep', name: `Sleep ${SLEEP_TARGET.min}–${SLEEP_TARGET.max} hours`, icon: '😴', color: '#A78BFA',
      xp: XP.sleep, keystone: 2,
      habitKey: HABIT_KEYS.SLEEP_TARGET,
      target: { value: SLEEP_TARGET.min, unit: 'hours', direction: 'atLeast' },
      desc: 'Recovery, training quality, and appetite regulation. Short sleep makes hunger harder to read and 90% fullness harder to hit.',
    },
    {
      id: 'fl_water', name: 'Hit water goal', icon: '💧', color: '#45B7D1',
      xp: XP.water, keystone: 1,
      habitKey: HABIT_KEYS.HYDRATION,
      desc: 'Your usual target. Not a weight-manipulation tool.',
    },
    {
      id: 'fl_photo', name: 'Daily progress photo', icon: '📸', color: '#74B9FF',
      xp: XP.photo, keystone: 1,
      habitKey: HABIT_KEYS.PROGRESS_PHOTO,
      photoCapture: true,      // the daily panel renders a real camera/upload control
      desc: 'Required, not optional. Same spot, same light, same distance — the comparison is only worth anything if the conditions match.',
    },
    {
      id: 'daily_log', name: 'Complete Daily Log', icon: '📊', color: '#8B9DC3',
      xp: XP.dailyLog, keystone: 1,
      habitKey: HABIT_KEYS.DAILY_LOG,
      desc: 'Ratings and any measurements you took today.',
    },
  ].map((t, i) => ({ ...t, order: i }));
}

// ── Photo standardisation ───────────────────────────────────────────────────
export const PHOTO_GUIDE = {
  title: 'Make the photos comparable',
  blurb: 'A before/after is only honest if the two shots match. Lock these down on Day 1 and repeat them.',
  items: [
    'Same location, every day.',
    'Same lighting — and avoid overhead light, which fakes definition.',
    'Same distance from the camera. Mark where you stand.',
    'Same posture, relaxed. Do not flex in one and not the other.',
    'Same clothing.',
    'Ideally the same time of day — first thing, before eating, is the most consistent.',
  ],
  privacy: 'Your photos stay on this device. They are held in this browser\'s private storage, are never uploaded anywhere by Forge, and are deliberately excluded from Settings → Export so a backup file can never contain them. Only you can share them.',
};

// ── Weekly requirements ─────────────────────────────────────────────────────
/**
 * Hard Mode's weekly requirements, run through Forge's existing generic weekly
 * engine as PER-ATTEMPT defs.
 *
 * That matters: the engine prefers an attempt's own `weeklyRequirementDefs` over
 * the legacy Fat Loss constant, so Beginner and Standard attempts — including
 * every one already archived — keep their original 3 lifts + 2 Zone 2 untouched.
 *
 * Cardio is deliberately NOT three identical sessions: two easy aerobic sessions
 * that add volume at low fatigue cost, plus one short interval session for
 * higher-end fitness.
 */
export function weeklyRequirementDefs() {
  return [
    {
      id: 'lifting', habitKey: HABIT_KEYS.HYPERTROPHY_TRAINING,
      label: 'Resistance Training', icon: '🏋️', perWeek: 3, xp: XP.lifting, keystone: 3,
      logLabel: 'Log Lifting Session', unit: 'lift',
      note: 'Three, not four or more. Your existing programme counts — this is about keeping the muscle you have, not adding training volume in a deficit.',
    },
    {
      id: 'zone2', habitKey: HABIT_KEYS.EXERCISE_SESSION,
      label: 'Zone 2–3 Cardio', icon: '❤️', perWeek: 2, xp: XP.zone2, keystone: 2,
      logLabel: 'Log Zone 2–3 Session', unit: 'session',
      note: '30 minutes, conversational to slightly working. Aerobic volume at a low recovery cost.',
    },
    {
      id: 'intervals', habitKey: HABIT_KEYS.INTERVAL_TRAINING,
      label: 'Interval Session', icon: '🔥', perWeek: 1, xp: XP.intervals, keystone: 2,
      logLabel: 'Log Interval Session', unit: 'session',
      note: 'One per week. Short — roughly 15–25 minutes in total, most of it warm-up, recovery and cool-down.',
    },
    {
      id: 'waist', habitKey: HABIT_KEYS.WAIST_MEASUREMENT,
      label: 'Waist Measurement', icon: '📏', perWeek: 1, xp: XP.waist, keystone: 1,
      logLabel: 'Log Waist Measurement', unit: 'measurement',
      note: 'Once a week, same conditions: morning, before eating, tape level at the navel, relaxed — not sucked in.',
    },
    {
      id: 'review', habitKey: HABIT_KEYS.WEEKLY_REVIEW,
      label: 'Weekly Review', icon: '🔍', perWeek: 1, xp: XP.review, keystone: 1,
      logLabel: 'Log Weekly Review', unit: 'review',
      note: 'Five minutes: look at the week\'s adherence, your photos and your waist. Adjust behaviour, not targets.',
    },
  ];
}

// ── Cardio guidance ─────────────────────────────────────────────────────────
export const CARDIO = {
  principle: 'Three sessions, two different jobs.',
  blurb: 'The two Zone 2–3 sessions build aerobic volume with relatively low fatigue, which matters when you are also lifting three times a week in a deficit. The single interval session develops higher-end cardiovascular fitness that easy work does not reach.',
  // The claim this challenge refuses to make.
  honesty: 'Intervals are not magic for fat loss. They are here for conditioning. Total energy expenditure and the nutrition habits are what drive the fat side — the steps you take every day matter more for that than any one session does.',
  zone2: {
    title: 'Zone 2–3 · ×2 per week',
    detail: '30 minutes. You can hold a conversation, though not comfortably at the top end. Walking uphill, easy bike, rower, steady jog — the modality does not matter.',
  },
  intervals: {
    title: 'Intervals · ×1 per week',
    detail: 'Zone 4–5 in the hard efforts ONLY — not 30 continuous minutes at that intensity, which is neither the point nor realistic.',
    template: [
      '5-minute easy warm-up',
      '4–6 hard intervals — 60–90 seconds each, hard but controlled',
      'Equal or longer easy recovery between each one',
      '5-minute cool-down',
    ],
    totalTime: 'Roughly 15–25 minutes in total.',
    caution: 'Not all-out sprints. "Hard" means you could not hold a conversation and would want to stop near the end of the interval — not maximal. One of these per week is the whole requirement; more is not better here.',
  },
};

// ── The 30-day progression ──────────────────────────────────────────────────
/**
 * Four weeks with different emphasis, so the challenge is a progression rather
 * than thirty identical days.
 *
 * Critically, NOTHING gets restricted further as the weeks pass. Week 3 does not
 * cut food or add cardio — it asks for tighter adherence to the same programme.
 * That is stated in the copy the user reads, because "push" weeks in fat-loss
 * programmes are exactly where people start starving themselves.
 */
export const WEEKS = [
  {
    week: 1, title: 'Lock In', emoji: '🔒',
    goal: 'Establish perfect execution of the core habits.',
    focus: [
      'Protein hit every single day',
      '10,000 steps every day — no averaging',
      'Practise 90% fullness at every meal',
      '~90% whole foods',
      '7.5–9 hours of sleep',
      'A photo every day, in the same conditions',
      'All three lifts, both Zone 2–3 sessions and the interval session',
    ],
    coaching: 'This week is about the setup, not the result. Get the photo conditions fixed, get the step target hit on the awkward days, and find out what 90% actually feels like. Nothing you see on the scale this week means much.',
  },
  {
    week: 2, title: 'Build Momentum', emoji: '📈',
    goal: 'Consistency. The behaviours should start feeling automatic.',
    focus: [
      'Same habits, less deliberation',
      'Notice which habit is the one you keep having to force',
      'Waist and photos are starting to be worth comparing',
    ],
    coaching: 'If one habit is repeatedly the one you miss, that is the information this week gives you. Fix the logistics around it — the walk you schedule, the protein you prep — rather than relying on wanting it more.',
  },
  {
    week: 3, title: 'Push', emoji: '🎯',
    goal: 'Adherence. This week gets harder through consistency, not restriction.',
    focus: [
      'Zero missed keystone habits',
      'Every training session completed',
      'Hold the steps on the busy days — those are the ones that count',
    ],
    // The single most important sentence in the progression.
    coaching: 'Push does NOT mean eating less or adding cardio. Your targets do not change this week and neither does your food. What changes is how little you let slide. Cutting further here is the most common way a good 30 days turns into a bad one.',
    warning: 'Do not reduce calories, add extra cardio sessions, or skip meals to accelerate results. That is not what this week is.',
  },
  {
    week: 4, title: 'Finish', emoji: '🏁',
    goal: 'Your strongest week of adherence, and a clean final measurement.',
    focus: [
      'No missed keystone habits',
      'Maintain lifting performance — this is the muscle-retention check',
      'All cardio completed',
      'Steps hit',
      'Nutrition habits held',
      'Final standardised photo and waist measurement',
    ],
    coaching: 'Take the final photo in exactly the conditions you used on Day 1 — same spot, same light, same time of day, same clothes. That single detail decides whether your before/after is worth anything.',
  },
];

/** The progression week containing a challenge day. */
export function weekFor(dayNumber) {
  const n = Math.max(1, Math.ceil((dayNumber || 1) / 7));
  return WEEKS[Math.min(n, WEEKS.length) - 1];
}

// ── What you may notice ─────────────────────────────────────────────────────
export const WHAT_YOU_MAY_NOTICE = {
  title: 'What you may notice',
  items: [
    'A smaller waist',
    'A leaner-looking face',
    'A flatter stomach',
    'More abdominal definition',
    'Better shoulder, chest and arm definition',
    'Clothes fitting better',
    'Improved cardiovascular conditioning',
    'Better exercise tolerance',
    'Increased confidence',
  ],
  target: 'Typical target: approximately 3–5 lb of body fat over 30 days for an appropriate candidate following the program consistently.',
  disclaimer: 'Results vary. Starting body composition, energy intake, adherence, activity, genetics, water balance, and other factors affect results.',
  // Guards against the target reading as a promise.
  framing: 'That range is an estimate, not a commitment. Forge cannot measure your body fat and will not pretend to — what it can show you at the end is what you actually did, and what your own photos and waist measurement show.',
};

// ── Safety ──────────────────────────────────────────────────────────────────
/**
 * Hard Mode is an aggressive-but-sustainable phase, and there are people for
 * whom an intentional fat-loss phase is not appropriate at all. The setup screen
 * asks before the challenge starts, and answering yes surfaces guidance rather
 * than the challenge.
 */
export const SAFETY = {
  title: 'Before you start',
  meaning: {
    is: ['More structure', 'More consistency', 'More precision', 'Better conditioning'],
    isNot: [
      'Crash dieting',
      'Starvation or very low calories',
      'Daily HIIT',
      'Excessive cardio',
      'Cutting out entire food groups',
      'Training through injury',
      'Dehydration or manipulating scale weight',
    ],
  },
  screen: {
    prompt: 'Does any of these describe you right now?',
    options: [
      { id: 'lean', label: 'I am already very lean, or underweight' },
      { id: 'pregnant', label: 'I am pregnant or breastfeeding' },
      { id: 'ed', label: 'I have an eating disorder, or a history of disordered eating' },
      { id: 'medical', label: 'I have another reason intentional weight loss may not be right for me' },
      { id: 'none', label: 'None of these' },
    ],
  },
  flagged: {
    title: 'This is not the right challenge right now',
    body: 'An aggressive fat-loss phase is not appropriate in any of those situations, and Forge is not going to push one on you. This is not a judgement about discipline — it is the wrong tool.',
    guidance: [
      'If you are already very lean or underweight, further fat loss carries real costs: strength, hormones, sleep, mood and training quality all suffer, and there is little left to lose.',
      'If you are pregnant or breastfeeding, intentional weight loss should be directed by your doctor or midwife, not an app.',
      'If you have an eating disorder or a history of disordered eating, daily photos, portion rules and a fat-loss target can be genuinely harmful. Please talk to someone qualified before starting anything like this.',
      'If a doctor has advised against dieting, follow that advice over this app.',
    ],
    alternatives: 'Better fits in Forge: ⚡ Energy Reset builds the same sleep, movement and food-quality habits with no fat-loss target at all; 🏗️ Muscle Building runs the training side without a deficit; 🔥 Forge Daily keeps a streak alive with no target of any kind.',
    override: 'I understand the guidance and want to continue anyway',
  },
  running: 'If at any point this starts feeling like restriction rather than structure — food thoughts crowding everything else, training performance falling away, sleep going — that is a signal to stop the phase, not to push harder.',
};

// ── Setup ───────────────────────────────────────────────────────────────────
export function defaultSetup() {
  return {
    proteinMode: 'perLb',
    targetWeightLb: PROTEIN.defaultTargetWeight,
    proteinFixedGrams: PROTEIN.defaultFixedGrams,
    safetyFlags: [],
    acknowledged: false,
  };
}

/** True when the user's answers mean Forge should not push a fat-loss target. */
export function isContraindicated(setup) {
  const flags = setup?.safetyFlags || [];
  return flags.some(f => f !== 'none') && flags.length > 0;
}

/** The Hard Mode block stored on the attempt. */
export function buildConfig(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  return {
    proteinMode: s.proteinMode,
    targetWeightLb: s.targetWeightLb,
    proteinFixedGrams: s.proteinFixedGrams,
    proteinGrams: proteinGrams(s),
    stepTarget: STEP_TARGET,
    wholeFoodPct: WHOLE_FOOD_PCT,
    acknowledgedSafety: !!s.acknowledged,
    // Recorded so the completion screen can be honest about what was flagged,
    // never to gate or shame. Never leaves the device.
    safetyFlags: (s.safetyFlags || []).filter(f => f !== 'none'),
  };
}
