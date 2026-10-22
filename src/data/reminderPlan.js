import { HABIT_KEYS, habitKeyOf } from './habitKeys';
import { getTaskXP, getTaskKeystone, keystoneHabitsOf } from '../utils/gamification';

/**
 * The reminder plan — what Forge should remind THIS user about, right now.
 *
 * The old system shipped twelve fixed reminders (Reading, Workout, Water,
 * Progress photo…) and matched them to a user's tasks with name regexes. That
 * meant Forge could offer — and send — a reading reminder to someone with no
 * reading task, and it could never reflect a task's real name or target.
 *
 * Here, reminders are DERIVED. There are three categories:
 *
 *   UNIVERSAL   Work with or without a challenge: the morning mission, the
 *               evening check-in, the Daily Log nudge, optional encouragement.
 *   CHALLENGE   Generated from the active challenge's actual task list, using
 *               each task's real name, target and XP, ordered by keystone tier.
 *               They appear when a challenge is running and disappear when it
 *               is not.
 *   PERSONAL    Opt-in habits (reading, workout, hydration, meditation,
 *               walking, custom) that are OFF unless the user turns them on.
 *
 * Two rules the whole module exists to enforce:
 *
 *   1. Nothing is ever reminded about unless it is in the user's challenge or
 *      they explicitly asked for it.
 *   2. A payload may only claim something is incomplete when it was rendered
 *      from real, current state. Everything also carries date-independent
 *      `fallback` copy for the server to use when its snapshot is stale.
 */

export const CATEGORY = {
  UNIVERSAL: 'universal',
  CHALLENGE: 'challenge',
  PERSONAL: 'personal',
};

export const CATEGORY_META = {
  [CATEGORY.UNIVERSAL]: {
    key: CATEGORY.UNIVERSAL, title: 'General Reminders', icon: '🔔',
    blurb: 'These work whether or not a challenge is running.',
  },
  [CATEGORY.CHALLENGE]: {
    key: CATEGORY.CHALLENGE, title: 'Your Active Challenge', icon: '⚔️',
    blurb: 'Built from the challenge you are actually running. They change when it does.',
  },
  [CATEGORY.PERSONAL]: {
    key: CATEGORY.PERSONAL, title: 'Personal Habits', icon: '🌱',
    blurb: 'Optional. Nothing here is on unless you turn it on.',
  },
};

// ── Universal reminders ─────────────────────────────────────────────────────
/**
 * `defaultEnabled` on exactly two of these is what keeps the out-of-the-box
 * volume at two to three a day: morning, evening, and the top keystone habit
 * from the challenge. Everything else is opt-in.
 */
export const UNIVERSAL_REMINDERS = [
  {
    id: 'u_morning', label: 'Morning Daily Mission', icon: '⚔️',
    defaultTime: '08:00', defaultEnabled: true,
    supports: "A short overview of today's plan",
  },
  {
    id: 'u_evening', label: 'Evening Check-In', icon: '🌆',
    defaultTime: '20:00', defaultEnabled: true,
    supports: 'A nudge to review the day before it closes',
  },
  {
    id: 'u_dailylog', label: 'Daily Log reminder', icon: '📊',
    defaultTime: '21:00', defaultEnabled: false,
    supports: 'Only when a Daily Log is part of your day and still open',
    requiresDailyLog: true,
  },
  {
    id: 'u_encouragement', label: 'General encouragement', icon: '💪',
    defaultTime: '12:00', defaultEnabled: false,
    supports: 'An occasional midday line. Off by default.',
  },
];

// ── Personal habits ─────────────────────────────────────────────────────────
/**
 * Opt-in habits with no challenge behind them. Each declares a habitKey so
 * that if the user's challenge already requires the same behaviour, the
 * challenge reminder supersedes it and they never get two notifications for
 * one habit.
 */
export const PERSONAL_HABITS = [
  { id: 'p_reading',    habitKey: HABIT_KEYS.READING,          label: 'Reading',    icon: '📚', defaultTime: '19:00', body: 'Time to read.' },
  { id: 'p_workout',    habitKey: HABIT_KEYS.EXERCISE_SESSION, label: 'Workout',    icon: '🏋️', defaultTime: '17:00', body: 'Time to train.' },
  { id: 'p_hydration',  habitKey: HABIT_KEYS.HYDRATION,        label: 'Hydration',  icon: '💧', defaultTime: '14:00', body: 'Water check — top up.' },
  { id: 'p_meditation', habitKey: HABIT_KEYS.MEDITATION,       label: 'Meditation', icon: '🧘', defaultTime: '07:30', body: 'A few quiet minutes.' },
  { id: 'p_walk',       habitKey: HABIT_KEYS.DAILY_STEPS,      label: 'Walking',    icon: '🚶', defaultTime: '15:00', body: 'Get a walk in.' },
];

export const PERSONAL_BY_ID = Object.fromEntries(PERSONAL_HABITS.map(h => [h.id, h]));

/** Prefix for a user's own habit, added in Settings. */
export const CUSTOM_PREFIX = 'x_';

/** The reminder id for a challenge task. Stable across challenges per habit. */
export function challengeReminderId(task) {
  const key = habitKeyOf(task);
  return key ? `c_${key}` : null;
}

// ── Default times for challenge reminders ───────────────────────────────────
/**
 * A sensible slot per habit. Not a schedule the user is stuck with — every
 * reminder's time is editable — but a default that is at least plausible
 * beats putting everything at 09:00.
 */
const TIME_BY_HABIT = {
  [HABIT_KEYS.SLEEP_TARGET]: '21:30',
  [HABIT_KEYS.EVENING_WINDDOWN]: '21:45',
  [HABIT_KEYS.MORNING_LIGHT]: '07:30',
  [HABIT_KEYS.HYDRATION]: '09:00',
  [HABIT_KEYS.DAILY_MISSION]: '08:15',
  [HABIT_KEYS.FLOW_SESSION]: '09:30',
  [HABIT_KEYS.PRIORITY_EXECUTION]: '16:00',
  [HABIT_KEYS.ATTENTION_TRAINING]: '19:30',
  [HABIT_KEYS.MENTAL_RECOVERY]: '15:30',
  [HABIT_KEYS.STRESS_RECOVERY]: '17:30',
  [HABIT_KEYS.PHYSICAL_ENERGY]: '12:30',
  [HABIT_KEYS.MEDITATION]: '07:30',
  [HABIT_KEYS.READING]: '19:00',
  [HABIT_KEYS.EXERCISE_SESSION]: '17:00',
  [HABIT_KEYS.HYPERTROPHY_TRAINING]: '17:00',
  [HABIT_KEYS.INTERVAL_TRAINING]: '17:00',
  [HABIT_KEYS.DAILY_STEPS]: '15:00',
  [HABIT_KEYS.PROTEIN_TARGET]: '13:00',
  [HABIT_KEYS.CARBOHYDRATE_TARGET]: '13:00',
  [HABIT_KEYS.CALORIE_TARGET]: '13:00',
  [HABIT_KEYS.WHOLE_FOODS]: '12:30',
  [HABIT_KEYS.FULLNESS_CONTROL]: '18:30',
  [HABIT_KEYS.PROGRESS_PHOTO]: '20:30',
  [HABIT_KEYS.GRATITUDE]: '20:45',
  [HABIT_KEYS.PRAYER]: '20:45',
  [HABIT_KEYS.COLD_EXPOSURE]: '07:45',
  [HABIT_KEYS.CREATINE]: '09:30',
  [HABIT_KEYS.SYMPTOM_CHECKIN]: '20:00',
  [HABIT_KEYS.DAILY_LOG]: '21:00',
};

/** Default time for a challenge task's reminder. */
export function defaultTimeForTask(task) {
  return TIME_BY_HABIT[habitKeyOf(task)] || '18:00';
}

/** A task name trimmed of its target, for use in a notification title. */
export function shortTaskName(task) {
  const name = String(task?.name || '').trim();
  // "Sleep opportunity: 8+ hours" → "Sleep opportunity". Keeps the full name
  // when there is no colon, so nothing is silently truncated.
  const colon = name.indexOf(':');
  return colon > 2 ? name.slice(0, colon).trim() : name;
}

/** What requirement a challenge reminder supports, for the settings row. */
export function supportsLabel(task, challengeName, shared) {
  const tier = getTaskKeystone(task);
  const bits = [];
  if (challengeName) bits.push(challengeName);
  if (tier >= 3) bits.push('Keystone habit');
  else if (tier > 0) bits.push(`${'⭐'.repeat(tier)} supporting habit`);
  bits.push(`${getTaskXP(task)} XP`);
  if (shared) bits.push('also covers your support challenge');
  return bits.join(' · ');
}

// ── Plan construction ───────────────────────────────────────────────────────

/**
 * Every reminder available to this user right now, with its stored on/off
 * state and time resolved.
 *
 * ctx: {
 *   tasks,              // the live merged task list (shared habits appear once)
 *   challengeName,      // null when no challenge is running
 *   challengeActive,    // false for Forge Daily, a finished or a scheduled challenge
 *   supportChallengeName,
 *   isSharedTask,       // (task) => bool
 * }
 *
 * Returns { universal: [], challenge: [], personal: [], all: [], enabledCount }.
 * Every entry: { id, category, label, icon, time, enabled, supports, task?,
 *                habitKey?, superseded? }.
 */
export function buildReminderPlan(prefs, ctx = {}) {
  const settings = prefs?.reminders || {};
  const read = (id, def) => {
    const s = settings[id];
    return {
      enabled: s?.enabled ?? def.defaultEnabled ?? false,
      time: s?.time || def.defaultTime,
    };
  };

  const tasks = ctx.tasks || [];
  const hasDailyLogTask = tasks.some(t => habitKeyOf(t) === HABIT_KEYS.DAILY_LOG);

  // ── Universal ──
  const universal = UNIVERSAL_REMINDERS
    // The Daily Log reminder is only offered when a Daily Log is actually part
    // of the day. Offering it otherwise would be a reminder to do nothing.
    .filter(def => !def.requiresDailyLog || hasDailyLogTask)
    .map(def => ({
      ...def, category: CATEGORY.UNIVERSAL, ...read(def.id, def),
    }));

  // ── Challenge ──
  // Derived from the live task list, so the names, targets and XP are whatever
  // the challenge actually says today. Empty when no challenge is running.
  const keystones = new Set(keystoneHabitsOf(tasks).map(t => t.id));
  const challenge = !ctx.challengeActive ? [] : tasks
    // The Daily Log is tracking infrastructure and has its own universal
    // reminder; it is not a challenge habit to nag about.
    .filter(t => habitKeyOf(t) !== HABIT_KEYS.DAILY_LOG)
    .map(task => {
      const id = challengeReminderId(task);
      if (!id) return null;
      const shared = !!ctx.isSharedTask?.(task);
      const def = {
        defaultTime: defaultTimeForTask(task),
        // Only the top keystone is on by default, which is what keeps the
        // default volume at two or three a day rather than one per task.
        defaultEnabled: keystones.has(task.id) && getTaskKeystone(task) >= 3,
      };
      return {
        id, category: CATEGORY.CHALLENGE,
        label: shortTaskName(task),
        fullName: task.name,
        icon: task.icon || '•',
        supports: supportsLabel(task, ctx.challengeName, shared),
        task, habitKey: habitKeyOf(task),
        keystone: getTaskKeystone(task),
        xp: getTaskXP(task),
        shared,
        ...read(id, def),
      };
    })
    .filter(Boolean)
    // Keystone tier first, then XP — the most important habit leads.
    .sort((a, b) => (b.keystone - a.keystone) || (b.xp - a.xp));

  // Only the single highest-priority keystone is on by default. Without this a
  // challenge with three keystone habits would default to five notifications.
  let defaultedOn = false;
  for (const r of challenge) {
    const stored = settings[r.id];
    if (stored?.enabled !== undefined) continue;        // user has decided
    if (r.enabled && !defaultedOn) { defaultedOn = true; continue; }
    if (r.enabled) r.enabled = false;
  }

  // ── Personal ──
  // A personal habit whose behaviour the challenge already covers is
  // superseded, so one habit never produces two notifications.
  const challengeKeys = new Set(challenge.map(r => r.habitKey));
  const built = PERSONAL_HABITS.map(def => {
    const superseded = challengeKeys.has(def.habitKey)
      ? challenge.find(r => r.habitKey === def.habitKey)
      : null;
    return {
      ...def, category: CATEGORY.PERSONAL,
      supports: superseded
        ? `Already covered by your challenge: ${superseded.label}`
        : 'Optional personal habit',
      superseded: superseded ? superseded.id : null,
      ...read(def.id, { ...def, defaultEnabled: false }),
    };
  });

  const custom = (prefs?.customHabits || []).map(h => ({
    id: h.id, category: CATEGORY.PERSONAL,
    label: h.label, icon: h.icon || '✨',
    supports: 'Your own habit',
    custom: true,
    body: h.body || `Time for ${h.label}.`,
    enabled: settings[h.id]?.enabled ?? h.enabled ?? false,
    time: settings[h.id]?.time || h.time || '18:00',
  }));

  const personal = [...built, ...custom];
  const all = [...universal, ...challenge, ...personal];
  // A superseded personal habit is never delivered even if its stored state
  // says enabled — the challenge reminder covers it.
  const deliverable = all.filter(r => r.enabled && !r.superseded);

  return {
    universal, challenge, personal, all,
    deliverable,
    enabledCount: deliverable.length,
    hasChallenge: !!ctx.challengeActive,
    challengeName: ctx.challengeName || null,
  };
}

/** Roughly how many notifications a day this plan produces. */
export const TARGET_DAILY_MIN = 2;
export const TARGET_DAILY_MAX = 3;
/** Above this the settings screen warns about volume. */
export const BUSY_DAILY_THRESHOLD = 5;

/** The ids a default plan turns on, for migration and tests. */
export function defaultEnabledIds(ctx = {}) {
  return buildReminderPlan({ reminders: {} }, ctx).deliverable.map(r => r.id);
}
