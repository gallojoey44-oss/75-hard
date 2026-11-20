import { HABIT_KEYS } from './habitKeys';

/**
 * Mental Training — one habit, six ways to do it.
 *
 * The Mental Training Phase has always had one core habit, `mt_mind`, worth
 * one keystone-weighted share of the day's XP. That does not change. What
 * changes is what the habit accepts: instead of an undefined "few minutes",
 * an attempt started from now on can train in any of six practices, and the
 * person chooses one each day. One requirement, one completion, one reward —
 * the practice is how you train, not an extra thing to train for.
 *
 * ── Versioning ────────────────────────────────────────────────────────────
 *
 * Which practices qualify is part of an attempt's RULES, so it is decided per
 * attempt and stamped when the attempt starts, like the Cold Exposure Upgrade
 * and Fat Loss Hard Mode's setup:
 *
 *   meta.mentalTraining = { version: 1, minutes: 20 }
 *
 * An attempt with no stamp was started before this existed. It keeps exactly
 * the habit it started with — its name, its minutes, its wording, its guide
 * (or lack of one) — and is never offered Begin Training or asked to update.
 * Nothing here rewrites a stored attempt, and the template's own task lists
 * are left describing those attempts, so a template sync can never quietly
 * turn an old attempt into a new one.
 *
 * `version` names the PRACTICE SET. Version 1 is the six below. A later set
 * (Mental Sparring, longer guided sessions) is added as version 2 beside it;
 * attempts on version 1 keep these six for life.
 *
 * `minutes` is the daily target chosen at setup and fixed for the attempt.
 * It is a requirement, not a reward: every option pays the same XP, so there
 * is nothing to gain by choosing less, and the XP figure is never read from
 * here — it comes from the attempt's stamped economy like every other habit.
 */

/** The template this applies to, and its one training habit. */
export const MENTAL_TRAINING_TEMPLATE = 'mental_training_phase';
export const TRAINING_TASK_ID = 'mt_mind';

/** The practice set new attempts are stamped with. */
export const TRAINING_VERSION = 1;

/** The line under the habit name, and its guide, for attempts on any version. */
export const TRAINING_DESC = 'Choose an intentional practice to strengthen your attention, awareness, or understanding.';
export const TRAINING_GUIDE_ID = 'mental:training';

/** Coaching copy for a skipped keystone. States the rule; promises nothing. */
export const TRAINING_KEYSTONE_WHY =
  'Mental Training is the keystone of this challenge: a set block of time each day spent deliberately directing your attention. ' +
  'Any of the six practices counts — what matters is turning up for the minutes, every day.';

// ── Daily minutes ───────────────────────────────────────────────────────────

/** Every daily length a Mental Training attempt can be set to. */
export const TRAINING_MINUTE_OPTIONS = [10, 20, 30];

/**
 * What each mode recommends and what it allows.
 *
 * A mode never allows LESS than its own recommendation. The modes pay
 * differently — Hard Mode's day is worth more than Beginner's — so letting
 * Hard Mode train for ten minutes would make the dearest mode the easiest to
 * earn from, which is exactly the contradiction a mode exists to prevent.
 * Training for longer than your mode asks is always allowed; it simply pays
 * what the mode pays.
 */
export const TRAINING_MINUTES_BY_MODE = {
  beginner: { recommended: 10, options: [10, 20, 30] },
  standard: { recommended: 20, options: [20, 30] },
  hard:     { recommended: 30, options: [30] },
};

function modeRules(mode) {
  return TRAINING_MINUTES_BY_MODE[mode] || TRAINING_MINUTES_BY_MODE.standard;
}

/** The minutes a mode recommends. */
export function recommendedMinutes(mode) {
  return modeRules(mode).recommended;
}

/** The minutes a mode allows, shortest first. */
export function allowedMinutes(mode) {
  return [...modeRules(mode).options];
}

/**
 * The minutes an attempt of this mode will actually be set to: the choice when
 * the mode allows it, otherwise the mode's recommendation. Changing mode in
 * setup therefore never carries over a length the new mode does not allow.
 */
export function resolveMinutes(mode, chosen = null) {
  const n = Number(chosen);
  return allowedMinutes(mode).includes(n) ? n : recommendedMinutes(mode);
}

/** The per-attempt stamp for a new attempt of this mode. */
export function buildTrainingConfig(mode, chosen = null) {
  return { version: TRAINING_VERSION, minutes: resolveMinutes(mode, chosen) };
}

/**
 * An attempt's training stamp, or null for an attempt that has none — every
 * attempt started before this existed, and every other challenge.
 */
export function trainingConfigOf(meta) {
  if (!meta || meta.templateId !== MENTAL_TRAINING_TEMPLATE) return null;
  const t = meta.mentalTraining;
  if (!t || typeof t !== 'object') return null;
  const minutes = Number(t.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const version = Number(t.version);
  return { version: Number.isFinite(version) && version >= 1 ? version : 1, minutes };
}

/** "Mental Training — 20 minutes" */
export function trainingTaskName(minutes) {
  return `Mental Training — ${minutes} minutes`;
}

/**
 * A template task list with the training habit set to this attempt's minutes.
 *
 * Only the training habit changes, and only its wording and target: its id,
 * keystone weight, habit key and XP are the template's, so the attempt is
 * priced exactly as it would have been. With no config the list is returned
 * untouched — which is what keeps an unstamped attempt's sync identical to
 * what it always was.
 */
export function applyTrainingSetup(tasks, config) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!config?.minutes) return list;
  return list.map(t => (t.id !== TRAINING_TASK_ID ? t : {
    ...t,
    name: trainingTaskName(config.minutes),
    desc: TRAINING_DESC,
    target: { value: config.minutes, unit: 'minutes', direction: 'atLeast' },
  }));
}

/**
 * The attempt a habit row belongs to, chosen exactly as presentTasks chooses
 * it: a support-only row follows the support attempt, everything else the
 * primary. A row and its training screen can never disagree about the rules.
 */
export function attemptForTask(task, meta, support = null) {
  const lanes = task?.challenges;
  const supportOnly = support && Array.isArray(lanes) &&
    lanes.includes('support') && !lanes.includes('primary');
  return supportOnly ? support : meta;
}

/**
 * Whether this row is a training habit, and on what terms: `{ version,
 * minutes, practices }`, or null for every other row — including the
 * Mental Training habit of an attempt started before the six practices.
 */
export function trainingFor(task, meta, support = null) {
  if (!task || task.id !== TRAINING_TASK_ID) return null;
  const config = trainingConfigOf(attemptForTask(task, meta, support));
  if (!config) return null;
  return { ...config, practices: practicesFor(config) };
}

// ── The six practices ───────────────────────────────────────────────────────
//
// Each one is written to be started inside fifteen seconds: a name, a plain
// subtitle, one line on what it trains, five or six short steps, and a few
// examples either side of the line. Longer guidance lives in the habit's
// Guide. Nothing here promises an outcome — the practices train a skill, and
// a session counts whether or not it felt like it went well.
//
// `overlaps` names the habits a practice is most easily confused with. Time
// counted here counts for Mental Training only, so the screen says so by name
// for whichever of those habits are actually on the day's list.

export const PRACTICES_V1 = [
  {
    id: 'dead_calm',
    name: 'Dead Calm',
    subtitle: 'Meditation & Breathwork',
    scene: 'lake',
    pitch: 'Sit still, slow your breathing, and keep bringing your attention back to it.',
    develops: 'Holding your attention on one thing — the breath — and returning each time it wanders.',
    trains: ['attention', 'calm'],
    deviceFree: false,
    steps: [
      'Sit comfortably, upright but relaxed. Close your eyes, or rest them on one spot.',
      'Settle with slow breaths: in through the nose for 4, out for 6. Do this for about a minute.',
      'Then breathe normally and keep your attention on the feeling of each breath.',
      'When your mind wanders — it will — notice where it went and return to the next breath.',
      'Keep going until your time is up. Coming back is the practice, not a failure of it.',
    ],
    counts: [
      'Sitting quietly, following your breath',
      'Slow, paced breathing — such as in for 4, out for 6',
      'A body scan: moving your attention slowly from your feet to your head',
    ],
    doesntCount: [
      'Breathing exercises while scrolling, watching or listening to something',
      'Lying down until you fall asleep',
    ],
    tip: 'If slow breathing makes you light-headed, go back to breathing normally. Attention is the practice; the breathing pattern only supports it.',
    overlaps: [HABIT_KEYS.PRAYER],
  },
  {
    id: 'open_sky',
    name: 'Open Sky',
    subtitle: 'Mindful Nature Observation',
    scene: 'sky',
    pitch: 'Go outside with your phone away and pay real attention to what is around you.',
    develops: 'Noticing what is actually around you, instead of what is on a screen or running through your head.',
    trains: ['awareness', 'presence'],
    deviceFree: true,
    steps: [
      'Read this, then put your phone away — in a pocket, a bag, or left indoors.',
      'Go outside. A park, a garden, a quiet street or a balcony all work.',
      'Walk slowly or sit still. Find five things you can see, four you can hear and three you can feel.',
      'Keep noticing: colours, movement, near and distant sounds, the air on your skin.',
      'When you drift into thoughts or plans, notice it and bring your attention back to your surroundings.',
      'When your time is up, come back and record it.',
    ],
    counts: [
      'A slow walk with your attention on your surroundings, phone away',
      'Sitting outside watching the sky, trees, water or the street',
      'Standing still and listening — wind, birds, traffic, voices',
    ],
    doesntCount: [
      'Walking while scrolling, texting or on a call',
      'Headphones in — music, podcasts or audiobooks',
      'A run or workout where your attention is on pace and numbers',
    ],
    tip: 'Weather does not matter. A covered porch or doorway still counts, as long as your attention is on what is around you.',
    overlaps: [HABIT_KEYS.MOVEMENT],
  },
  {
    id: 'moving_stillness',
    name: 'Moving Stillness',
    subtitle: 'Mindful Stretching & Mobility',
    scene: 'bamboo',
    pitch: 'Slow, deliberate stretching with your full attention on breath and body.',
    develops: 'Staying aware of your body and breath while you move, instead of rushing through it.',
    trains: ['body awareness', 'calm'],
    deviceFree: true,
    steps: [
      'Read this, then put your phone face down and out of reach.',
      'Choose four to six gentle movements — neck rolls, shoulder circles, a forward fold, hip openers, cat–cow.',
      'Move slowly. Breathe out as you ease into each position, and hold it for several slow breaths.',
      'Keep your attention on what you feel: the stretch, warmth, tension letting go, the breath.',
      'When your mind drifts, bring it back to the part of your body that is moving.',
      'Never push into pain. When your time is up, come back and record it.',
    ],
    counts: [
      'Slow stretching with your attention on breath and body',
      'A gentle yoga or mobility flow, done deliberately',
      'Slow, flowing movement such as tai chi',
    ],
    doesntCount: [
      'An ordinary workout or run done on autopilot',
      'Stretching in front of the TV or while on your phone',
    ],
    tip: 'This is about attention, not effort or flexibility. Easy positions held with full attention count completely.',
    overlaps: [HABIT_KEYS.MOVEMENT],
  },
  {
    id: 'pursuit_of_wisdom',
    name: 'Pursuit of Wisdom',
    subtitle: 'Reflective Reading',
    scene: 'lantern',
    pitch: 'Read something worth thinking about — slowly — and work out what it means for you.',
    develops: 'Thinking an idea through: what it means, whether it is true, and how it applies to your life.',
    trains: ['understanding', 'reflection'],
    deviceFree: true,
    steps: [
      'Choose a thoughtful text: philosophy, Scripture, a classic, or any book that makes you think.',
      'Put your phone away. Use a paper book or an e-reader.',
      'Read one short passage slowly — a page or two is plenty — then stop.',
      'Ask what it is really saying, whether you agree, and where it shows up in your own life.',
      'Pick one idea and decide how you could act on it today.',
      'Carry on with the next passage until your time is up, then come back and record it.',
    ],
    promptsTitle: 'Questions to read with',
    prompts: [
      'What is the author really claiming here?',
      'Where have I seen this be true — or false — in my own life?',
      'What would change if I took this seriously for one day?',
      'What is one thing I will do differently today because of it?',
    ],
    counts: [
      'Reading a short passage slowly and reflecting on its meaning',
      'Returning to a passage you marked and thinking it through',
      'Stopping to note one idea you want to put into practice',
    ],
    doesntCount: [
      'Skimming to get through pages',
      'News, social media, or scrolling through articles',
    ],
    tip: 'Fewer pages, more thought. A whole session on one paragraph is a good session.',
    overlaps: [HABIT_KEYS.READING],
  },
  {
    id: 'inner_vision',
    name: 'Inner Vision',
    subtitle: 'Visualization & Mental Rehearsal',
    scene: 'peak',
    pitch: 'Rehearse a hard moment or a meaningful goal in detail — including how you respond when it gets difficult.',
    develops: 'Preparing your response to difficult moments before they arrive, so the response is already rehearsed.',
    trains: ['composure', 'preparation'],
    deviceFree: false,
    steps: [
      'Choose one specific situation: a hard conversation, a workout, a presentation, a moment of fear or temptation.',
      'Sit comfortably, close your eyes and take a few slow breaths.',
      'Picture it in detail — where you are, who is there, what you can see and hear.',
      'Rehearse the response you want: what you say, how you hold yourself, how you breathe when it gets hard.',
      'Run it again with a setback. Imagine it going wrong, and rehearse how you recover.',
      'Finish by picturing the moment just after you have handled it well.',
    ],
    promptsTitle: 'Situations to rehearse',
    examples: [
      { label: 'A difficult conversation', text: 'Rehearse your opening line — then staying calm and clear if it turns heated.' },
      { label: 'Training', text: 'Walk through each set, especially the moment you will want to stop, and what you do then.' },
      { label: 'Fear or adversity', text: 'Picture the nerves arriving. Rehearse one slow breath, and the first step you take anyway.' },
      { label: 'A distraction or craving', text: 'Picture the urge showing up — and you choosing what you planned instead.' },
      { label: 'A meaningful goal', text: 'Picture an ordinary day once you have reached it, then today’s first step toward it.' },
    ],
    counts: [
      'Rehearsing a specific situation you are about to face',
      'Rehearsing how you respond to a setback, a fear or a distraction',
      'Picturing a meaningful goal and the steps that lead to it',
    ],
    doesntCount: [
      'Daydreaming, or replaying a worry without rehearsing a response',
      'Watching motivational videos',
    ],
    tip: 'Rehearsal prepares you; it does not decide how things go. Keep it specific and realistic — setbacks included.',
    overlaps: [],
  },
  {
    id: 'inner_mirror',
    name: 'Inner Mirror',
    subtitle: 'Journaling & Introspection',
    scene: 'pool',
    pitch: 'Write honestly about your thoughts, choices and values. Prompts included.',
    develops: 'Seeing your own thoughts, motives and choices clearly enough to learn from them.',
    trains: ['self-awareness', 'honesty'],
    deviceFree: true,
    steps: [
      'Get a notebook or a sheet of paper, and put your phone away.',
      'Pick a prompt below, or write about whatever is on your mind.',
      'Write without stopping to edit. Honesty matters more than neatness.',
      'When you get stuck, ask “why?” or “what else?” and keep going.',
      'Before you finish, underline one thing you noticed about yourself.',
    ],
    promptsTitle: 'Prompts, if you want one',
    prompts: [
      'What decision am I avoiding, and why?',
      'What drained me this week, and what gave me energy?',
      'Where did my actions today match my values — and where didn’t they?',
      'What am I feeling right now, and what set it off?',
      'What would the person I am becoming do differently tomorrow?',
    ],
    counts: [
      'Free-writing about your thoughts, feelings and choices',
      'Answering one prompt in depth',
      'A structured review: what went well, what did not, what next',
    ],
    doesntCount: [
      'To-do lists, or planning your schedule',
      'Venting in messages to someone else',
    ],
    tip: 'Forge never asks for, sees or stores what you write. The notebook is yours.',
    overlaps: [HABIT_KEYS.GRATITUDE],
  },
];

/** Practice sets by version. Earlier sets are never edited once released. */
export const PRACTICE_SETS = {
  1: PRACTICES_V1,
};

/** The practices an attempt's training version accepts. */
export function practicesFor(config) {
  const version = Number(config?.version) || TRAINING_VERSION;
  // A version this build does not know (a backup restored into an older
  // build) falls back to the newest set it does know rather than to nothing.
  if (PRACTICE_SETS[version]) return PRACTICE_SETS[version];
  const known = Object.keys(PRACTICE_SETS).map(Number).filter(v => v <= version).sort((a, b) => b - a);
  return PRACTICE_SETS[known[0] || TRAINING_VERSION];
}

/** A practice by id, from any set. */
export function getPractice(id) {
  for (const set of Object.values(PRACTICE_SETS)) {
    const found = set.find(p => p.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * The habits on today's list that this practice must not be mistaken for,
 * by name. Only habits actually present are named, so a support lane or an
 * edited list never mentions a habit the person does not have.
 */
export function overlappingTasks(practice, tasks) {
  const keys = practice?.overlaps || [];
  if (!keys.length) return [];
  return (tasks || []).filter(t => t.id !== TRAINING_TASK_ID && keys.includes(t.habitKey));
}

/**
 * The habits a Mental Training session is kept apart from, for the general
 * rule on the selection screen: every habit any practice overlaps with.
 */
export function separateHabits(tasks) {
  const keys = new Set(PRACTICES_V1.flatMap(p => p.overlaps));
  return (tasks || []).filter(t => t.id !== TRAINING_TASK_ID && keys.has(t.habitKey));
}

// ── Practice tracking ───────────────────────────────────────────────────────
//
// Which practice a day was trained with is recorded on the day itself, as a
// practice id and nothing else — no notes, no journal text, no timings. It is
// separate from completion: XP reads the habit's checkbox, never this field,
// so it can be missing, stale or wrong without moving a single point.

export const PRACTICE_FIELD = 'trainingPractice';

/** The practice recorded for a day, or null. */
export function practiceOfDay(dayData) {
  const id = dayData?.[PRACTICE_FIELD];
  return typeof id === 'string' && getPractice(id) ? id : null;
}
