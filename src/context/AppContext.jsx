import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getTodayStr, getDayNumberFromStart, getDateForDayNumber, dayNumberForDate } from '../utils/dateUtils';
import { challengeDayNumber, getChallengeState, isScheduled, isChallengeActive, CHALLENGE_STATE, daysUntilStart, dateOffsetFromToday } from '../utils/challengeSchedule';
import {
  LANE, challengeOf, startOf, hasSupportChallenge, laneDayNumber, laneIsComplete,
  tasksForLane, mergeSupportTasks, stripSupportTasks, previewMerge, lanesOfTask,
  recordKeyForLaneDay,
} from '../utils/challengeStack';
import { canStack, getCompatibility } from '../data/challengeCompatibility';
import { SOURCES } from '../data/defaultQuotes';
import { computeAverages } from '../utils/insightsUtils';
import { computeTotalXP, computeBadges, computeChallengeScore, isChallengePassed, getPassingConfig, getBonusXP, requiredTasksForDay, computeChallengeChanges, computeWithinChallengeTrend, DEFAULT_PASSING_SCORE, DEFAULT_KEYSTONE_REQUIREMENT, LEGACY_PASSING_SCORE } from '../utils/gamification';
import { buildTimeline } from '../utils/archiveUtils';
import { computeWeeklyRequirements, hasWeeklyRequirements, makeSession, weeklyAdherence, WEEKLY_REQUIREMENT_TEMPLATE_IDS as WEEKLY_REQ_TEMPLATES } from '../utils/weeklyRequirements';
import { makeVolumeEntry, weeklyVolume, tracksVolume } from '../utils/muscleVolume';
import { makeExerciseEntry } from '../utils/exerciseLog';
import {
  makeCycleLog, logForDate, tracksCycles, groupCycles, logsInChallenge,
  compareCycles, safetyFlags, persistentSymptomsAtCompletion,
} from '../utils/cycleTracking';
import { HORMONE_HEALTH_TEMPLATE_ID } from '../data/hormoneHealthConfig';
import { ENERGY_RESET_TEMPLATE_ID, LAGGED_HABIT_KEYS, windowForDuration, insightDepth } from '../data/energyResetConfig';
import { buildEnergySummary } from '../utils/energyTracking';
import { clearProfilePhotos } from '../utils/photoStore';
import { getTemplateById, FORGE_DAILY_META, FORGE_DAILY_TASKS, DAILY_LOG_TASK, consolidateDailyLogTasks, applyColdExposureUpgrade, isColdExposureEnabled, MENTAL_TRAINING_TEMPLATE_ID, COLD_SHOWER_BONUS_ID } from '../data/challengeTemplates';
import { makeDefaultNotifPrefs } from '../utils/notificationUtils';
import { keystoneHabitsOf, RANKS, computeLifetimeXP } from '../utils/gamification';
import { resolveRankState, resolveHighestRank, rankFloorXP } from '../utils/rank';

export const MENTAL_OPTIONS = [
  { id: 'breathwork',    label: '5 min breathwork',             icon: '🫁' },
  { id: 'meditation',    label: '5 min meditation',             icon: '🧘' },
  { id: 'journaling',    label: '5 min journaling',             icon: '📝' },
  { id: 'visualization', label: 'Visualization',                icon: '🎯' },
  { id: 'reframe',       label: 'Reframe one negative thought', icon: '💭' },
  { id: 'do_avoided',    label: 'Do one thing I was avoiding',  icon: '⚡' },
  { id: 'no_phone',      label: '30 min no phone before bed',   icon: '📵' },
];

const DEFAULT_TASKS_ME = [
  { id: 'workout',   name: '45-minute workout complete', icon: '🏋️', order: 0 },
  { id: 'diet',      name: 'Diet followed',              icon: '🥗',  order: 1 },
  { id: 'water',     name: 'Water goal hit',             icon: '💧',  order: 2 },
  { id: 'reading',   name: '10 pages read',              icon: '📚',  order: 3 },
  { id: 'photo',     name: 'Progress photo taken',       icon: '📸',  order: 4 },
  { id: 'mental',    name: 'Mental training complete',   icon: '🧠',  order: 5 },
  { ...DAILY_LOG_TASK, order: 6 },
];

const DEFAULT_TASKS_GF = [
  { id: 'gf_workout', name: '45-minute workout complete',            color: '#FF6B6B', order: 0  },
  { id: 'gf_diet',    name: 'Eat clean / diet followed',             color: '#6BCB77', order: 1  },
  { id: 'gf_photo',   name: 'Progress photo taken',                  color: '#74B9FF', order: 2  },
  { id: 'gf_mental',  name: 'Mental training complete',              color: '#A78BFA', order: 3  },
  { id: 'gf_bed',     name: 'Make my bed',                           color: '#FF8FAB', order: 4  },
  { id: 'gf_room',    name: 'Tidy up my room',                       color: '#4ECDC4', order: 5  },
  { id: 'gf_skin',    name: 'Take care of my skin',                  color: '#45B7D1', order: 6  },
  { id: 'gf_walk',    name: 'Walk 10,000 steps',                     color: '#FFB347', order: 7  },
  { id: 'gf_water',   name: 'Drink water',                           color: '#74B9FF', order: 8  },
  { id: 'gf_read',    name: 'Read a few pages or listen to a podcast', color: '#DDA0DD', order: 9 },
  { id: 'gf_meals',   name: 'Prep meals for tomorrow',               color: '#F9E04B', order: 10 },
  { id: 'gf_screen',  name: 'Limit screen time 30 min before bed',   color: '#A8E6CF', order: 11 },
  { ...DAILY_LOG_TASK, order: 12 },
];

export const DISCIPLINE_75_ID = '75_day_discipline_challenge';

/**
 * The 75-Day Discipline Challenge descriptor.
 *
 * This is ONE challenge in the library, not a default. It is used in exactly two
 * places: when the user explicitly starts 75-Day, and to describe a legacy
 * profile (pre-v3.4.0) that has a running challengeStart but no descriptor —
 * those genuinely were the original 75-day challenge.
 *
 * It must NEVER be used as a fallback for "no active challenge". Forge began
 * as a 75 Hard app, and that legacy assumption is what silently manufactured a
 * phantom 75-Day attempt whenever a challenge ended.
 */
export const DISCIPLINE_75_META = {
  templateId: DISCIPLINE_75_ID,
  name: '75-Day Discipline Challenge',
  emoji: '🔥',
  variant: null,
  durationDays: 75,
  passingScore: 80,
  keystoneRequirement: 70,
  completionBonusXP: 2500,
};

/**
 * Scoring defaults for a NEWLY started attempt, applied only under whatever the
 * chosen template supplies. Deliberately carries no identity and no duration —
 * a new attempt's templateId, name, emoji, variant and durationDays must come
 * from the selected challenge, so nothing can leak in from a previous one.
 */
const NEW_ATTEMPT_DEFAULTS = {
  variant: null,
  durationDays: null,
  passingScore: DEFAULT_PASSING_SCORE,
  keystoneRequirement: DEFAULT_KEYSTONE_REQUIREMENT,
  completionBonusXP: 0,
};

/**
 * The 75-Day Discipline Challenge's own daily task set.
 *
 * The 75-day template describes its variants in prose rather than as start_tasks,
 * so its task list is these per-profile defaults. Naming them explicitly is what
 * lets a 75-Day start install ITS OWN tasks instead of inheriting whatever the
 * previous challenge left in the profile.
 */
export function discipline75Tasks(profId) {
  const base = profId === 'girlfriend' ? DEFAULT_TASKS_GF : DEFAULT_TASKS_ME;
  return base.map(t => ({ ...t }));
}

/** Task ids that legitimately belong to a 75-Day attempt (either profile). */
const DISCIPLINE_75_TASK_IDS = new Set(
  [...DEFAULT_TASKS_ME, ...DEFAULT_TASKS_GF].map(t => t.id),
);

const DEFAULT_QUOTE_SETTINGS = {
  enabledSources: [...SOURCES],
  favorites: [],
  showReflectionTask: false,
};

function makeDefaultProfiles() {
  return {
    me: {
      id: 'me',
      name: 'Male',
      emoji: '💪',
      challengeStart: null,
      tasks: DEFAULT_TASKS_ME,
      bonusMissions: [],
      rankHistory: [],
      quoteSettings: { ...DEFAULT_QUOTE_SETTINGS },
      customQuotes: [],
    },
    girlfriend: {
      id: 'girlfriend',
      name: 'Female',
      emoji: '🌸',
      challengeStart: null,
      tasks: DEFAULT_TASKS_GF,
      bonusMissions: [],
      rankHistory: [],
      quoteSettings: { ...DEFAULT_QUOTE_SETTINGS },
      customQuotes: [],
    },
  };
}

function emptyDay(date, dayNumber) {
  return {
    date,
    dayNumber,
    tasks: {},
    mentalTraining: { selected: null, completed: false, notes: '' },
    mood: 0,
    confidence: 0,
    sleep: 0,
    energy: 0,
    recovery: 0,
    workoutEffort: 0,
    stress: 0,
    notes: '',
    glucoseNotes: '',
    hoursSlept: 0,
    weight: 0,
    waist: 0,
    // Optional physique measurements (Muscle Building). Additive: a record
    // written before these existed simply has no value, which reads as 0.
    chest: 0,
    arms: 0,
    thighs: 0,
    // Optional energy ratings 1-10 (10-Day Energy Reset). Additive in the same
    // way: 0 means "not rated", never "rated zero", so a day the user skipped is
    // excluded from the comparison rather than dragging it down.
    morningEnergy: 0,
    afternoonEnergy: 0,
    overallEnergy: 0,
    validated: false,
    isMWD: false,
    mwdTasks: {},
    // Bonus Missions (optional): bonusDone maps missionId → XP awarded that day;
    // bonusOneTime holds missions added just for this date.
    bonusDone: {},
    bonusOneTime: [],
  };
}

/**
 * Re-key a profile's day records from one challenge start date to another.
 *
 * Day records are keyed by the primary challenge's day number, so moving the
 * primary anchor (promoting a support challenge, or dropping to Forge Daily
 * beside a running support) would otherwise strand every record. Each record's
 * real calendar date is authoritative here — stored on the record, or recovered
 * from the old start — so the move is lossless. Records dated before the new
 * Day 1 have no day number in the new numbering and are dropped.
 */
function rekeyDays(days, oldStart, newStart) {
  if (!oldStart || !newStart || oldStart === newStart) return days || {};
  const out = {};
  for (const [key, rec] of Object.entries(days || {})) {
    const date = rec?.date || getDateForDayNumber(oldStart, Number(key));
    if (!date || date < newStart) continue;
    const n = dayNumberForDate(newStart, date);
    if (!n) continue;
    out[n] = { ...rec, date, dayNumber: n };
  }
  return out;
}

function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/**
 * Safe migration — never removes or overwrites user data.
 * Runs once at startup.
 */
export function migrateProfiles(stored, days = {}) {
  const profiles = { ...stored };
  let changed = false;

  // Task-list migrations only apply to the original 75-day challenge —
  // profiles running a template challenge (e.g. Mental Training Phase) manage
  // their task list through the template, not these defaults. A profile with no
  // challenge at all is NOT the 75-day challenge, so it is excluded: that
  // "absent means 75-day" reading only holds for a legacy attempt, which by
  // definition has a running start date.
  const onDefaultChallenge = (profId) => {
    const prof = profiles[profId];
    const meta = prof?.activeChallenge;
    if (meta) return meta.templateId === DISCIPLINE_75_ID;
    return !!prof?.challengeStart;
  };

  // Ensure both profile slots always exist
  if (!profiles.me) { profiles.me = makeDefaultProfiles().me; changed = true; }
  if (!profiles.girlfriend) { profiles.girlfriend = makeDefaultProfiles().girlfriend; changed = true; }

  // Generic profile labels — rename only the old default names; names the
  // user set themselves are left alone. Profile ids and data are unchanged.
  if (profiles.me.name === 'Joey') {
    profiles.me = { ...profiles.me, name: 'Male' };
    changed = true;
  }
  if (profiles.girlfriend.name === 'Girlfriend') {
    profiles.girlfriend = { ...profiles.girlfriend, name: 'Female' };
    changed = true;
  }

  // Joey — rename old 'workout' task name (preserves ID so history is intact)
  {
    const tasks = profiles.me.tasks || [];
    const w = tasks.find(t => t.id === 'workout');
    if (w && w.name === 'Workout complete') {
      profiles.me = {
        ...profiles.me,
        tasks: tasks.map(t =>
          t.id === 'workout' ? { ...t, name: '45-minute workout complete' } : t
        ),
      };
      changed = true;
    }
  }

  // Girlfriend — add any missing required tasks (appended at end, stable IDs)
  if (onDefaultChallenge('girlfriend')) {
    const tasks = profiles.girlfriend.tasks || [];
    const required = [
      { id: 'gf_workout', name: '45-minute workout complete', color: '#FF6B6B' },
      { id: 'gf_diet',    name: 'Eat clean / diet followed',  color: '#6BCB77' },
      { id: 'gf_photo',   name: 'Progress photo taken',       color: '#74B9FF' },
      { id: 'gf_mental',  name: 'Mental training complete',   color: '#A78BFA' },
    ];
    let newTasks = [...tasks];
    let maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
    let addedAny = false;
    for (const req of required) {
      if (!tasks.find(t => t.id === req.id)) {
        maxOrder++;
        newTasks.push({ ...req, order: maxOrder });
        addedAny = true;
      }
    }
    if (addedAny) {
      profiles.girlfriend = { ...profiles.girlfriend, tasks: newTasks };
      changed = true;
    }
  }

  // Both profiles — add quoteSettings, customQuotes, and faith flags if missing
  for (const profId of ['me', 'girlfriend']) {
    if (!profiles[profId].quoteSettings) {
      profiles[profId] = {
        ...profiles[profId],
        quoteSettings: { ...DEFAULT_QUOTE_SETTINGS },
      };
      changed = true;
    } else if (!profiles[profId].quoteSettings.enabledSources) {
      profiles[profId] = {
        ...profiles[profId],
        quoteSettings: { ...DEFAULT_QUOTE_SETTINGS, ...profiles[profId].quoteSettings },
      };
      changed = true;
    }
    if (!profiles[profId].customQuotes) {
      profiles[profId] = { ...profiles[profId], customQuotes: [] };
      changed = true;
    }
    if (profiles[profId].faithEnabled === undefined) {
      profiles[profId] = { ...profiles[profId], faithEnabled: false };
      changed = true;
    }
    if (profiles[profId].faithCountsToward === undefined) {
      profiles[profId] = { ...profiles[profId], faithCountsToward: false };
      changed = true;
    }
    if (profiles[profId].sleepTarget === undefined) {
      profiles[profId] = { ...profiles[profId], sleepTarget: 8 };
      changed = true;
    }
    if (profiles[profId].sleepAutoComplete === undefined) {
      profiles[profId] = { ...profiles[profId], sleepAutoComplete: true };
      changed = true;
    }
  }

  // Joey — add sleep_target task if missing
  if (onDefaultChallenge('me')) {
    const tasks = profiles.me.tasks || [];
    if (!tasks.find(t => t.id === 'sleep_target')) {
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
      profiles.me = {
        ...profiles.me,
        tasks: [...tasks, { id: 'sleep_target', name: 'Sleep target met', icon: '😴', order: maxOrder + 1 }],
      };
      changed = true;
    }
  }

  // Girlfriend — add gf_sleep_target task if missing
  if (onDefaultChallenge('girlfriend')) {
    const tasks = profiles.girlfriend.tasks || [];
    if (!tasks.find(t => t.id === 'gf_sleep_target')) {
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
      profiles.girlfriend = {
        ...profiles.girlfriend,
        tasks: [...tasks, { id: 'gf_sleep_target', name: 'Sleep target met', color: '#DDA0DD', order: maxOrder + 1 }],
      };
      changed = true;
    }
  }

  // Both profiles — add comebackMode and comebackHistory if missing
  for (const profId of ['me', 'girlfriend']) {
    if (!profiles[profId].comebackMode) {
      profiles[profId] = {
        ...profiles[profId],
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
      };
      changed = true;
    }
    if (!profiles[profId].comebackHistory) {
      profiles[profId] = { ...profiles[profId], comebackHistory: [] };
      changed = true;
    }
    if (profiles[profId].xpPenalties === undefined) {
      profiles[profId] = { ...profiles[profId], xpPenalties: true };
      changed = true;
    }
    if (profiles[profId].xpOffset === undefined) {
      profiles[profId] = { ...profiles[profId], xpOffset: 0 };
      changed = true;
    }
  }

  // Unified Daily Log — replace built-in metric-logging tasks (Log mood/stress/
  // energy, Sleep/energy logged) with a single Daily Log task. Only Forge-owned
  // metric ids are touched; custom tasks are always preserved. Idempotent.
  // templateVersion is intentionally left as-is: an active challenge started
  // from an older template still needs its normal sync to pick up the rest of
  // that version's tasks, so we must not falsely mark it up to date here.
  for (const profId of ['me', 'girlfriend']) {
    const { tasks: consolidated, changed: taskChanged } = consolidateDailyLogTasks(profiles[profId].tasks || []);
    if (taskChanged) {
      profiles[profId] = { ...profiles[profId], tasks: consolidated };
      changed = true;
    }
  }

  // Bonus Missions + Short Physical Reset (Mental Training v6).
  for (const profId of ['me', 'girlfriend']) {
    // Every profile carries a bonusMissions list (defs for recurring missions).
    if (!Array.isArray(profiles[profId].bonusMissions)) {
      profiles[profId] = { ...profiles[profId], bonusMissions: [] };
      changed = true;
    }
    // Rank history (Hall of Legends). highestRank is intentionally NOT written
    // here: the rank state layer (syncRankUnlock) seeds it on first load from
    // the strongest stored evidence — the persisted rank, this history, and the
    // rank the current Lifetime XP proves — so a profile is never demoted and
    // never gets a retroactive ceremony. It is the permanent XP floor.
    if (!Array.isArray(profiles[profId].rankHistory)) {
      profiles[profId] = { ...profiles[profId], rankHistory: [] };
      changed = true;
    }

    // Challenge Combination — the support lane. Existing users migrate naturally:
    // their one running challenge IS the primary (it already lives in
    // activeChallenge / challengeStart / tasks, which this never touches), and
    // they simply have no support challenge. Only the two absent fields are
    // written, so the migration is additive, idempotent, and impossible to
    // misread — nothing is re-derived, re-keyed or reset.
    if (profiles[profId].supportChallenge === undefined) {
      profiles[profId] = { ...profiles[profId], supportChallenge: null, supportChallengeStart: null };
      changed = true;
    }
    let meta = profiles[profId].activeChallenge;

    // Weekly Requirements (Fat Loss) — every profile carries a session list.
    if (!Array.isArray(profiles[profId].weeklySessions)) {
      profiles[profId] = { ...profiles[profId], weeklySessions: [] };
      changed = true;
    }
    // Muscle Building — hard-set volume entries and the exercise log. Additive
    // and idempotent: an existing profile simply gains two empty lists, and no
    // other challenge reads them, so nothing about an existing attempt changes.
    if (!Array.isArray(profiles[profId].volumeSets)) {
      profiles[profId] = { ...profiles[profId], volumeSets: [] };
      changed = true;
    }
    if (!Array.isArray(profiles[profId].exerciseLog)) {
      profiles[profId] = { ...profiles[profId], exerciseLog: [] };
      changed = true;
    }
    // Women's Hormone Health — menstrual symptom check-ins. Additive and
    // idempotent: a profile simply gains an empty list, and no other challenge
    // reads it, so nothing about an existing attempt changes. There is
    // deliberately NO global cycle tracking — only this challenge writes here.
    if (!Array.isArray(profiles[profId].cycleLogs)) {
      profiles[profId] = { ...profiles[profId], cycleLogs: [] };
      changed = true;
    }
    // An attempt that began before weekly tracking existed has no session
    // history for its earlier weeks, so enforcement starts from the day the
    // feature is first seen: weeks before that are never evaluated or
    // penalised, and nothing is fabricated. New attempts stamp this at start,
    // so they are tracked from week 1. Idempotent — written once.
    if (meta && WEEKLY_REQ_TEMPLATES.has(meta.templateId) && !meta.weeklyRequirementsStartDate && profiles[profId].challengeStart) {
      // Never earlier than Day 1: a scheduled attempt tracks weeks from its
      // future start, not from the day the app happened to migrate it.
      const cs = profiles[profId].challengeStart;
      profiles[profId] = {
        ...profiles[profId],
        activeChallenge: { ...meta, weeklyRequirementsStartDate: cs > getTodayStr() ? cs : getTodayStr() },
      };
      meta = profiles[profId].activeChallenge;
      changed = true;
    }

    // Passing-score default lowered 75 → 70 (standard Forge). Migrate an active
    // attempt that still stores the OLD 75 default down to 70 — but ONLY when its
    // template does not define an explicit passing_score. A stricter/intentional
    // rule (e.g. 75-Day Discipline stores 80, or a template that explicitly sets
    // its own threshold) is preserved untouched. Idempotent: once it reads 70 (or
    // a template override), nothing changes. Archived results are never touched.
    if (meta && meta.passingScore === LEGACY_PASSING_SCORE) {
      const t = getTemplateById(meta.templateId);
      if (t?.passing_score == null) {
        profiles[profId] = { ...profiles[profId], activeChallenge: { ...meta, passingScore: DEFAULT_PASSING_SCORE } };
        meta = profiles[profId].activeChallenge;
        changed = true;
      }
    }

    if (meta?.templateId !== 'mental_training_phase') continue;
    const tpl = getTemplateById('mental_training_phase');

    // Cold Exposure Upgrade normalization (idempotent, never touches day
    // records / scores / XP):
    //   • absent flag → default false (pre-feature attempts stay disabled and
    //     show the new "Add to Current Challenge" control).
    //   • enabled at setup but missing a start date → backfill to the challenge
    //     start, which reflects the old setup-only behavior (required from day
    //     one). We never guess a mid-challenge date.
    if (meta.coldExposureUpgradeEnabled === undefined) {
      profiles[profId] = { ...profiles[profId], activeChallenge: { ...meta, coldExposureUpgradeEnabled: false } };
      meta = profiles[profId].activeChallenge;
      changed = true;
    } else if (meta.coldExposureUpgradeEnabled === true && !meta.coldExposureUpgradeStartDate && profiles[profId].challengeStart) {
      profiles[profId] = { ...profiles[profId], activeChallenge: { ...meta, coldExposureUpgradeStartDate: profiles[profId].challengeStart } };
      meta = profiles[profId].activeChallenge;
      changed = true;
    }

    // Add the required Short Physical Reset task to active MT challenges without
    // it — inserted just before the Daily Log, preserving custom tasks. The
    // task's XP/duration match the challenge's variant. templateVersion is left
    // as-is so the normal sync can still align anything else.
    const tasks = profiles[profId].tasks || [];
    if (!tasks.some(t => t.id === 'mt_physical')) {
      const variantDef = tpl?.variants?.[meta.variant] || tpl?.variants?.standard;
      const physical = (variantDef?.start_tasks || []).find(t => t.id === 'mt_physical');
      if (physical) {
        const dailyIdx = tasks.findIndex(t => t.id === 'daily_log');
        const next = [...tasks];
        const insertAt = dailyIdx >= 0 ? dailyIdx : next.length;
        next.splice(insertAt, 0, { ...physical, source: 'template' });
        profiles[profId] = { ...profiles[profId], tasks: next.map((t, i) => ({ ...t, order: i })) };
        changed = true;
      }
    }

    // Seed the challenge's default Bonus Missions if none are present yet
    // (converts the old built-in optional cold-shower / phone-before-bed items
    // into real Bonus Missions). Never touches user-created custom tasks.
    if ((profiles[profId].bonusMissions || []).length === 0 && tpl?.bonus_missions?.length) {
      profiles[profId] = {
        ...profiles[profId],
        bonusMissions: tpl.bonus_missions.map((m, i) => ({ ...m, source: 'template', recurring: true, order: i })),
      };
      changed = true;
    }
  }

  // ── Repair: a 75-Day attempt that was auto-created by the old Start New
  // Challenge flow ────────────────────────────────────────────────────────────
  // The old startChallenge() treated a missing descriptor as "the default
  // challenge" (75-Day) and a missing task list as "keep what's already there",
  // so archiving a challenge and starting a new one manufactured a 75-Day
  // attempt sitting on the PREVIOUS challenge's tasks.
  //
  // This repairs only attempts that provably came from that bug, using three
  // independent signals that a genuine start cannot produce together:
  //
  //   1. no Future Self Letter — every challenge started from the library goes
  //      through the letter step, so its absence means no one chose this;
  //   2. zero logged days — nothing has ever been recorded under it, so there is
  //      no history, XP or score to lose (and nothing to archive: it is dropped,
  //      never written into the archives as a completed attempt);
  //   3. the task list holds template tasks belonging to a DIFFERENT challenge —
  //      the hybrid state itself.
  //
  // Custom (user-added) tasks are ignored by signal 3, so a user who customized
  // their 75-Day list is never caught by it. Archives, lifetime XP and rank are
  // not touched: the profile simply returns to no-active-challenge and the user
  // picks what they actually want.
  for (const profId of ['me', 'girlfriend']) {
    const prof = profiles[profId];
    const meta = prof?.activeChallenge;
    if (!prof || meta?.templateId !== DISCIPLINE_75_ID) continue;
    if (meta.futureSelfLetter) continue;                       // intentionally started
    if (Object.keys(days?.[profId] || {}).length > 0) continue; // has real history
    const leaked = (prof.tasks || []).some(
      t => t?.source === 'template' && !DISCIPLINE_75_TASK_IDS.has(t.id),
    );
    if (!leaked) continue;                                      // consistent attempt

    profiles[profId] = {
      ...prof,
      challengeStart: null,
      activeChallenge: null,
      supportChallenge: null,
      supportChallengeStart: null,
      tasks: FORGE_DAILY_TASKS.map((t, i) => ({ ...t, source: 'template', order: i, challenges: [LANE.PRIMARY] })),
      bonusMissions: [],
      xpOffset: 0,
      xpStartDay: 1,
    };
    changed = true;
  }

  // Task provenance defaults to the primary lane. A task written before the
  // Challenge Combination feature — template or user-added — belongs to the one
  // challenge that was running, so tagging it primary is exactly what it already
  // meant. This runs LAST, after every other migration has finished editing task
  // lists, so a task inserted by an earlier step is tagged in the same pass and
  // the whole migration settles in one load (re-running then changes nothing).
  for (const profId of ['me', 'girlfriend']) {
    const ts = profiles[profId]?.tasks;
    if (Array.isArray(ts) && ts.some(t => t && !Array.isArray(t.challenges))) {
      profiles[profId] = {
        ...profiles[profId],
        tasks: ts.map(t => (t && Array.isArray(t.challenges) ? t : { ...t, challenges: [LANE.PRIMARY] })),
      };
      changed = true;
    }
  }

  if (changed) saveLS('profiles', profiles);
  return profiles;
}

const DAILY_LOG_METRIC_FIELDS = ['mood', 'confidence', 'sleep', 'energy', 'recovery', 'workoutEffort', 'stress', 'hoursSlept'];

/**
 * True when a day record has at least one logged metric (a rating > 0 or hours
 * slept > 0). Used to decide whether the unified Daily Log counts as complete.
 */
export function dayHasLoggedMetric(dayData) {
  return DAILY_LOG_METRIC_FIELDS.some(f => (dayData?.[f] || 0) > 0);
}

/**
 * Backfill the unified Daily Log completion onto historical days. A day is
 * marked daily_log = true when it already had metric logging — either one of
 * the old separate metric-log tasks was completed, or any numeric metric was
 * recorded. Existing metric data is never removed; XP is never duplicated
 * (the old per-metric task flags simply stop counting once their task
 * definitions are gone, and daily_log awards its 20 XP once). Idempotent.
 */
function migrateAllDays(stored) {
  const all = { ...stored };
  let changed = false;

  // Daily-task completion is stored strictly per (day record, task id) and must
  // never be inferred from another date or from the ABSENCE of a record.
  //
  // An earlier build "grandfathered" Short Physical Reset onto every prior
  // Mental Training day that lacked an explicit record — fabricating completions
  // the user never made. Because that ran on every load, any day the user
  // legitimately left undone was silently re-checked the moment it rolled into
  // the past ("carrying over from the previous day"). That grandfathering — and
  // the one-time repair that existed only to undo its damage — are removed: a
  // task with no stored record for a date now simply reads as unchecked.

  for (const profId of Object.keys(all)) {
    const profDays = all[profId] || {};
    let profChanged = false;
    const nextDays = {};
    for (const [k, d] of Object.entries(profDays)) {
      if (!d) { nextDays[k] = d; continue; }
      let day = d;

      // Daily Log backfill: a day already carrying logged metric data counts its
      // unified Daily Log as done. Derived only from THAT day's own recorded
      // metrics (never another date), and idempotent.
      if (!day.tasks?.daily_log) {
        const hadMetricTask = !!(day.tasks && (day.tasks.mt_mood || day.tasks.mt_stress || day.tasks.mt_energy || day.tasks.sleep_log));
        if (hadMetricTask || dayHasLoggedMetric(day)) {
          day = { ...day, tasks: { ...day.tasks, daily_log: true } };
          profChanged = true;
        }
      }

      nextDays[k] = day;
    }
    if (profChanged) { all[profId] = nextDays; changed = true; }
  }

  if (changed) saveLS('allDays', all);
  return all;
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activeProfile, setActiveProfileState] = useState(() => loadLS('activeProfile', null));
  const [profiles, setProfilesState] = useState(() =>
    migrateProfiles(loadLS('profiles', makeDefaultProfiles()), loadLS('allDays', { me: {}, girlfriend: {} }))
  );
  const [allDays, setAllDaysState] = useState(() => migrateAllDays(loadLS('allDays', { me: {}, girlfriend: {} })));
  // Per-date quote data: { me: { '2024-01-15': { cycleOffset, reflectionNotes, reflectionComplete } }, girlfriend: {} }
  const [quoteData, setQuoteDataState] = useState(() => loadLS('quoteData', { me: {}, girlfriend: {} }));
  // Experiments: { me: [...], girlfriend: [...] }
  const [experiments, setExperimentsState] = useState(() => loadLS('experiments', { me: [], girlfriend: [] }));
  // Dismissed hints: { me: { habitId: expiryDateStr }, girlfriend: {} }
  const [dismissedHints, setDismissedHintsState] = useState(() => loadLS('dismissedHints', { me: {}, girlfriend: {} }));
  // Challenge archives: { me: [archiveEntry], girlfriend: [] } — never wiped by
  // starting a new challenge; feeds lifetime XP and long-term Insights trends.
  const [archives, setArchivesState] = useState(() => loadLS('archives', { me: [], girlfriend: [] }));
  // Notification preferences, per profile — all reminders default OFF
  const [notifPrefs, setNotifPrefsState] = useState(() =>
    loadLS('notifPrefs', { me: makeDefaultNotifPrefs(), girlfriend: makeDefaultNotifPrefs() })
  );
  // Weekly reflections, per profile: { me: { [weekNumber]: {helped, avoided, tooHard, date} } }
  const [weeklyReflections, setWeeklyReflectionsState] = useState(() =>
    loadLS('weeklyReflections', { me: {}, girlfriend: {} })
  );

  // Current local calendar date (YYYY-MM-DD). Kept in state so that when the app
  // stays open across midnight the whole tree re-renders: getDayNumber() then
  // recomputes to the new day and the Today view loads a fresh unchecked set for
  // the new date — no reload or reinstall required. A poll (every local day
  // boundary is at most 60s away) plus a foreground check covers both the
  // app-left-open and app-resumed cases.
  const [todayStr, setTodayStr] = useState(() => getTodayStr());
  useEffect(() => {
    const tick = () => setTodayStr(prev => {
      const now = getTodayStr();
      return now !== prev ? now : prev;
    });
    const id = setInterval(tick, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const setActiveProfile = useCallback((id) => {
    setActiveProfileState(id);
    saveLS('activeProfile', id);
  }, []);

  const setProfiles = useCallback((updater) => {
    setProfilesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('profiles', next);
      return next;
    });
  }, []);

  const setAllDays = useCallback((updater) => {
    setAllDaysState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('allDays', next);
      return next;
    });
  }, []);

  const setQuoteData = useCallback((updater) => {
    setQuoteDataState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('quoteData', next);
      return next;
    });
  }, []);

  const setExperiments = useCallback((updater) => {
    setExperimentsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('experiments', next);
      return next;
    });
  }, []);

  const setDismissedHints = useCallback((updater) => {
    setDismissedHintsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('dismissedHints', next);
      return next;
    });
  }, []);

  const setArchives = useCallback((updater) => {
    setArchivesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('archives', next);
      return next;
    });
  }, []);

  const saveWeeklyReflection = useCallback((weekNumber, answers, profId = activeProfile) => {
    if (!profId) return;
    setWeeklyReflectionsState(prev => {
      const cur = prev[profId] || {};
      const next = {
        ...prev,
        [profId]: { ...cur, [weekNumber]: { ...answers, date: getTodayStr() } },
      };
      saveLS('weeklyReflections', next);
      return next;
    });
  }, [activeProfile]);

  // Merge updates into the active profile's notification preferences
  const updateNotifPrefs = useCallback((updates, profId = activeProfile) => {
    if (!profId) return;
    setNotifPrefsState(prev => {
      const cur = prev[profId] || makeDefaultNotifPrefs();
      const next = {
        ...prev,
        [profId]: {
          ...cur,
          ...updates,
          quietHours: updates.quietHours ? { ...cur.quietHours, ...updates.quietHours } : cur.quietHours,
          reminders: updates.reminders
            ? Object.fromEntries(Object.entries({ ...cur.reminders, ...updates.reminders }).map(([k, v]) => [
                k, { ...cur.reminders?.[k], ...v },
              ]))
            : cur.reminders,
        },
      };
      saveLS('notifPrefs', next);
      return next;
    });
  }, [activeProfile]);

  const profile = profiles[activeProfile] || null;
  const days = (activeProfile && allDays[activeProfile]) || {};

  /**
   * The active challenge descriptor.
   *
   * "No active challenge" is a first-class state and resolves to the Forge Daily
   * baseline — never to 75-Day. The only case that still resolves to 75-Day is a
   * legacy profile (pre-v3.4.0) with a real running start date but no stored
   * descriptor, which genuinely was the original 75-day challenge.
   */
  const getChallengeMeta = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    if (prof?.activeChallenge) return prof.activeChallenge;
    if (prof?.challengeStart) return DISCIPLINE_75_META;   // legacy attempt
    return FORGE_DAILY_META;                               // no active challenge
  }, [activeProfile, profiles]);

  /**
   * True only when a REAL challenge is set up (running or scheduled). The Forge
   * Daily baseline is not a challenge, so this is false there — it is the single
   * predicate the UI uses to decide between "you have a challenge" and "choose
   * one from the library".
   */
  const hasActiveChallenge = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    if (!prof?.challengeStart) return false;
    return prof.activeChallenge?.templateId !== 'forge_daily';
  }, [activeProfile, profiles]);

  // Raw days since the challenge/baseline began — uncapped. Used to detect
  // when a fixed-duration challenge has run past its final day.
  const getRawDayNumber = useCallback((profId = activeProfile) => {
    // NULL while the attempt is scheduled — the clock has not started, so no
    // downstream system (scoring, XP, streaks, weekly requirements, day
    // generation, notifications) sees a challenge day.
    return challengeDayNumber(profiles[profId]?.challengeStart);
  }, [activeProfile, profiles]);

  /** Authoritative attempt state: 'none' | 'scheduled' | 'active'. */
  const getChallengeStatus = useCallback((profId = activeProfile) => {
    return getChallengeState(profiles[profId]);
  }, [activeProfile, profiles]);

  const isChallengeScheduled = useCallback((profId = activeProfile) => isScheduled(profiles[profId]), [activeProfile, profiles]);
  const getDaysUntilStart = useCallback((profId = activeProfile) => daysUntilStart(profiles[profId]?.challengeStart), [activeProfile, profiles]);

  const isForgeDaily = useCallback((profId = activeProfile) => {
    return profiles[profId]?.activeChallenge?.templateId === 'forge_daily';
  }, [activeProfile, profiles]);

  // ── Challenge Combination: the optional SUPPORT lane ──────────────────────
  // The primary lane is untouched — activeChallenge / challengeStart / tasks are
  // exactly what they have always been. Everything below is additive, and every
  // accessor returns the "no support challenge" answer for a profile that has
  // none, so single-challenge behaviour is unchanged.

  /** The support challenge descriptor, or null. */
  const getSupportMeta = useCallback((profId = activeProfile) => {
    return challengeOf(profiles[profId], LANE.SUPPORT);
  }, [activeProfile, profiles]);

  /** True when a second challenge is stacked on the primary. */
  const hasSupport = useCallback((profId = activeProfile) => {
    return hasSupportChallenge(profiles[profId]);
  }, [activeProfile, profiles]);

  /** The support challenge's own day number (null when absent or not yet begun). */
  const getSupportDayNumber = useCallback((profId = activeProfile) => {
    return laneDayNumber(profiles[profId], LANE.SUPPORT);
  }, [activeProfile, profiles]);

  const getSupportStart = useCallback((profId = activeProfile) => {
    return startOf(profiles[profId], LANE.SUPPORT);
  }, [activeProfile, profiles]);

  /** Descriptor + start + day number for a lane, in one call. */
  const getLaneInfo = useCallback((lane, profId = activeProfile) => {
    const prof = profiles[profId];
    const meta = challengeOf(prof, lane);
    if (!meta) return null;
    return {
      lane,
      meta,
      name: meta.name,
      emoji: meta.emoji,
      start: startOf(prof, lane),
      dayNumber: laneDayNumber(prof, lane),
      duration: meta.durationDays || null,
      complete: laneIsComplete(prof, lane),
    };
  }, [activeProfile, profiles]);

  const getDayNumber = useCallback((profId = activeProfile) => {
    const start = profiles[profId]?.challengeStart;
    if (!start) return null;
    const n = challengeDayNumber(start);
    if (n == null) return null;                 // scheduled — no day yet
    // Forge Daily (durationDays null) is open-ended — the day number tracks
    // the real calendar date and is never capped, so Today never freezes.
    const duration = profiles[profId]?.activeChallenge?.durationDays;
    if (duration == null && profiles[profId]?.activeChallenge) return Math.max(1, n);
    return Math.min(n, duration || 75);
  }, [activeProfile, profiles]);

  const getDayData = useCallback((dayNumber) => {
    return days[dayNumber] || null;
  }, [days]);

  const getTodayData = useCallback(() => {
    const n = getDayNumber();
    if (!n) return null;
    const start = profile?.challengeStart;
    const date = getDateForDayNumber(start, n);
    return days[n] || emptyDay(date, n);
  }, [getDayNumber, days, profile]);

  const updateDay = useCallback((dayNumber, updates) => {
    if (!activeProfile) return;
    setAllDays(prev => {
      const profDays = prev[activeProfile] || {};
      const existing = profDays[dayNumber] || emptyDay(null, dayNumber);
      return {
        ...prev,
        [activeProfile]: {
          ...profDays,
          [dayNumber]: { ...existing, ...updates },
        },
      };
    });
  }, [activeProfile, setAllDays]);

  const toggleTask = useCallback((dayNumber, taskId) => {
    if (!activeProfile) return;
    setAllDays(prev => {
      const profDays = prev[activeProfile] || {};
      const existing = profDays[dayNumber] || emptyDay(null, dayNumber);
      return {
        ...prev,
        [activeProfile]: {
          ...profDays,
          [dayNumber]: {
            ...existing,
            tasks: { ...existing.tasks, [taskId]: !existing.tasks[taskId] },
          },
        },
      };
    });
  }, [activeProfile, setAllDays]);

  const getDayCompletion = useCallback((dayNumber, profId = activeProfile) => {
    // Date-aware task set: the Cold Exposure Upgrade's Cold Shower is only part
    // of a day's required tasks on and after its activation date, so completion
    // for earlier days is judged against the correct (smaller) set.
    const tasks = requiredTasksForDay(profiles[profId]?.tasks || [], profiles[profId]?.activeChallenge, profiles[profId]?.challengeStart, dayNumber);
    if (!tasks.length) return 0;
    const dayData = (allDays[profId] || {})[dayNumber];
    if (!dayData) return 0;
    // The daily percentage is computed ONLY from the challenge attempt's required
    // tasks (the same set the visible "x/y tasks" count uses), so it always
    // agrees with the count and reads 100% when every required task is done. The
    // optional Faith / Reflection section is a personal add-on, not a challenge
    // task — it never enters this denominator (it still awards its own XP).
    const done = tasks.filter(t => dayData.tasks[t.id]).length;
    return Math.round((done / tasks.length) * 100);
  }, [activeProfile, profiles, allDays]);

  const getStreak = useCallback((profId = activeProfile) => {
    const dayNum = getDayNumber(profId);
    if (!dayNum) return 0;
    const profDays = allDays[profId] || {};
    const tasks = profiles[profId]?.tasks || [];
    if (!tasks.length) return 0;
    const meta = profiles[profId]?.activeChallenge;
    const cs = profiles[profId]?.challengeStart;
    let streak = 0;
    for (let i = dayNum; i >= 1; i--) {
      const d = profDays[i];
      if (!d) break;
      const dayTasks = requiredTasksForDay(tasks, meta, cs, i);
      const done = dayTasks.filter(t => d.tasks[t.id]).length;
      if (dayTasks.length && done === dayTasks.length) streak++;
      else break;
    }
    return streak;
  }, [activeProfile, allDays, profiles, getDayNumber]);

  const getLongestStreak = useCallback((profId = activeProfile) => {
    const dayNum = getDayNumber(profId);
    if (!dayNum) return 0;
    const profDays = allDays[profId] || {};
    const tasks = profiles[profId]?.tasks || [];
    if (!tasks.length) return 0;
    const meta = profiles[profId]?.activeChallenge;
    const cs = profiles[profId]?.challengeStart;
    let max = 0, cur = 0;
    for (let i = 1; i <= dayNum; i++) {
      const d = profDays[i];
      const dayTasks = requiredTasksForDay(tasks, meta, cs, i);
      const done = d ? dayTasks.filter(t => d.tasks[t.id]).length : 0;
      if (dayTasks.length && done === dayTasks.length) { cur++; max = Math.max(max, cur); }
      else cur = 0;
    }
    return max;
  }, [activeProfile, allDays, profiles, getDayNumber]);

  /**
   * Snapshot everything about the current challenge into an archive entry:
   * tasks, full day history (completions, ratings, notes, sleep, recovery,
   * workout effort, stress, mental training, faith reflection), quote
   * reflections, XP earned, badges earned, and comeback history.
   * Returns null when there is nothing worth archiving.
   */
  const buildArchiveEntry = useCallback((profId) => {
    const prof = profiles[profId];
    const profDays = allDays[profId] || {};
    if (!prof?.challengeStart || Object.keys(profDays).length === 0) return null;
    // A scheduled attempt never reached Day 1, so there is nothing to archive —
    // cancelling or rescheduling it must not create a phantom completed/failed
    // challenge in the user's history.
    if (isScheduled(prof)) return null;

    const meta = prof.activeChallenge || DISCIPLINE_75_META;   // legacy attempt (has a start date, no descriptor)
    const dayNum = Math.min(getDayNumberFromStart(prof.challengeStart) || 1, meta.durationDays || 75);
    const xpData = computeTotalXP(allDays, profiles, profId, getDayCompletion, dayNum, dayNum);
    const badges = computeBadges(allDays, profiles, profId, getDayCompletion, dayNum).map(b => b.id);

    // Quote reflections logged during this challenge's date range
    const endDate = getDateForDayNumber(prof.challengeStart, dayNum);
    const profQuotes = quoteData[profId] || {};
    const challengeQuotes = {};
    for (const [date, q] of Object.entries(profQuotes)) {
      if (date >= prof.challengeStart && date <= endDate) challengeQuotes[date] = q;
    }

    const completed = meta.durationDays != null && dayNum >= meta.durationDays;

    // Challenge Performance snapshot (percentage score, pass/fail, bonus).
    // Use the RAW (uncapped) local day so a finished challenge finalises every
    // day (no in-progress day left neutral); a mid-challenge archive still gets
    // the fair current-day-neutral score.
    const rawDay = getDayNumberFromStart(prof.challengeStart) || 1;
    const cfg = getPassingConfig(meta);
    const scoreObj = computeChallengeScore(allDays, profiles, profId, rawDay);
    const passed = scoreObj ? isChallengePassed(scoreObj, meta) : null;
    const bonusEarned = !!(passed && cfg.completionBonus > 0);
    const totalXP = Math.max(0, xpData.rawTotal);
    const bonusXP = Object.values(profDays).reduce((s, d) => s + getBonusXP(d), 0);
    const completionBonusAwarded = bonusEarned ? cfg.completionBonus : 0;
    const taskXP = Math.max(0, totalXP - completionBonusAwarded - bonusXP);

    return {
      id: `arch_${Date.now()}`,
      archivedAt: getTodayStr(),
      challenge: { ...meta },
      challengeStart: prof.challengeStart,
      endDayNum: dayNum,
      endDate,
      completed,
      completionDate: completed ? getTodayStr() : null,
      // Only the PRIMARY lane's rows belong to this challenge's record. A
      // support challenge's tasks archive with the support challenge, so a
      // stacked attempt is never graded against requirements it did not own.
      tasks: tasksForLane(prof.tasks, LANE.PRIMARY),
      lane: LANE.PRIMARY,
      days: profDays,
      quoteData: challengeQuotes,
      weeklyReflections: { ...(weeklyReflections[profId] || {}) },
      // Weekly Requirements snapshot: the raw sessions plus the resolved
      // per-week targets/results, so an archive can be read back without
      // recomputing against a template that may later change.
      weeklySessions: [...(prof.weeklySessions || [])],
      // Muscle Building per-attempt history, snapshotted so an archived
      // challenge can be read back in full.
      volumeSets: [...(prof.volumeSets || [])],
      exerciseLog: [...(prof.exerciseLog || [])],
      cycleLogs: [...(prof.cycleLogs || [])],
      weeklyRequirements: hasWeeklyRequirements(meta) ? (() => {
        const wr = computeWeeklyRequirements({
          sessions: prof.weeklySessions, meta, challengeStart: prof.challengeStart,
          currentRawDay: (getDayNumberFromStart(prof.challengeStart) || 1) + 1, // finalise every elapsed week
          penaltiesEnabled: prof.xpPenalties !== false,
        });
        return {
          tracked: true,
          startDate: meta.weeklyRequirementsStartDate || prof.challengeStart,
          weeks: wr.weeks.map(w => ({
            week: w.week, startDay: w.startDay, endDay: w.endDay, days: w.days, partial: w.partial,
            tracked: w.tracked, finalized: w.finalized,
            requirements: w.requirements.map(r => ({ id: r.id, target: r.target, done: r.done, credited: r.credited, met: r.met })),
          })),
          adherence: weeklyAdherence(wr),
          earnedXP: wr.earnedXP, availableXP: wr.availableXP,
          sessionXP: wr.sessionXP, missedUnits: wr.missedUnits, missedPenalty: wr.missedPenalty,
        };
      })() : { tracked: false },
      xpEarned: totalXP,
      badges,
      comebackHistory: prof.comebackHistory || [],
      xpOffset: prof.xpOffset ?? 0,
      xpStartDay: prof.xpStartDay ?? 1,
      // Performance / scoring record (permanent)
      finalScore: scoreObj ? scoreObj.score : null,
      scoreAvailable: !!(scoreObj && scoreObj.hasData),
      passingScore: cfg.passingScore,
      keystoneRequirement: cfg.keystoneRequirement,
      keystoneAdherence: scoreObj ? scoreObj.keystoneAdherence : null,
      passed,
      completionBonus: cfg.completionBonus,
      bonusEarned,
      taskXP,
      bonusXP,
      resultDate: completed ? getTodayStr() : null,
    };
  }, [profiles, allDays, quoteData, weeklyReflections, getDayCompletion]);

  /**
   * Archive entry for the SUPPORT challenge.
   *
   * Structurally identical to a primary archive so every existing archive
   * reader, insight and result screen works on it unchanged. Two differences:
   * `lane: 'support'` records which slot it ran in, and its `days` map is
   * re-keyed to the SUPPORT challenge's own day numbers — so the archive reads
   * as a self-contained challenge with its own Day 1, independent of whatever
   * primary it happened to run beside.
   */
  const buildSupportArchiveEntry = useCallback((profId) => {
    const prof = profiles[profId];
    const meta = challengeOf(prof, LANE.SUPPORT);
    const start = startOf(prof, LANE.SUPPORT);
    if (!meta || !start) return null;
    if (isScheduled({ challengeStart: start })) return null;   // never began
    const rawDay = challengeDayNumber(start);
    if (!rawDay) return null;

    const tasks = tasksForLane(prof.tasks, LANE.SUPPORT);
    if (!tasks.length) return null;
    const dayNum = Math.min(rawDay, meta.durationDays || rawDay);
    const profDays = allDays[profId] || {};

    // Re-key the shared day records onto this challenge's own day numbering.
    const days = {};
    for (let i = 1; i <= dayNum; i++) {
      const key = recordKeyForLaneDay(prof, LANE.SUPPORT, i);
      const d = key == null ? null : profDays[key];
      if (d) days[i] = { ...d, dayNumber: i };
    }
    if (Object.keys(days).length === 0) return null;

    const scoreObj = computeChallengeScore(allDays, profiles, profId, rawDay, LANE.SUPPORT);
    const cfg = getPassingConfig(meta);
    const passed = scoreObj ? isChallengePassed(scoreObj, meta) : null;
    const completed = meta.durationDays != null && rawDay >= meta.durationDays;

    return {
      id: `arch_sup_${Date.now()}`,
      lane: LANE.SUPPORT,
      archivedAt: getTodayStr(),
      challenge: { ...meta },
      challengeStart: start,
      endDayNum: dayNum,
      endDate: getDateForDayNumber(start, dayNum),
      completed,
      completionDate: completed ? getTodayStr() : null,
      tasks,
      days,
      quoteData: {},
      weeklyReflections: {},
      weeklySessions: [],
      weeklyRequirements: { tracked: false },
      // Default 0. endSupportChallenge overwrites this with the XP that actually
      // LEAVES the current challenge when the support rows are removed — a
      // transfer, never a gain. Shared habits stay in the list, so their XP never
      // moves and can never be counted twice; only support-only rows carry over.
      xpEarned: 0,
      badges: [],
      comebackHistory: [],
      xpOffset: 0,
      xpStartDay: 1,
      finalScore: scoreObj ? scoreObj.score : null,
      scoreAvailable: !!(scoreObj && scoreObj.hasData),
      passingScore: cfg.passingScore,
      keystoneRequirement: cfg.keystoneRequirement,
      keystoneAdherence: scoreObj ? scoreObj.keystoneAdherence : null,
      passed,
      completionBonus: 0,
      bonusEarned: false,
      taskXP: 0,
      bonusXP: 0,
      resultDate: completed ? getTodayStr() : null,
    };
  }, [profiles, allDays]);

  /**
   * Start a new challenge. The current challenge (if any) is archived first —
   * nothing is deleted. Only active-challenge progress resets: day data,
   * challenge XP, and comeback state. Lifetime data (archives, quote
   * reflections, experiments, profile settings) is preserved.
   *
   * options (all optional):
   *   challenge — { templateId, name, emoji, variant, durationDays } descriptor
   *   tasks     — task list for the new challenge; replaces the profile's daily
   *               tasks (the outgoing list is preserved in the archive entry)
   */
  const startChallenge = useCallback((profId = activeProfile, options = null) => {
    // ── Activation is ALWAYS explicit ──────────────────────────────────────
    // Selecting a challenge and activating one are separate actions. Without a
    // chosen descriptor AND its own task set there is nothing to start, so this
    // refuses rather than inventing an attempt. This is the structural reason a
    // hybrid state (one challenge's metadata beside another's tasks) can no
    // longer exist: both halves arrive together or neither is written.
    if (!options?.challenge?.templateId) return false;
    if (!options?.tasks?.length) return false;

    // Archive BOTH lanes before anything is replaced, so a stacked pair leaves
    // two independent records rather than losing the support challenge.
    const entry = buildArchiveEntry(profId);
    const supportEntry = buildSupportArchiveEntry(profId);
    const newEntries = [entry, supportEntry].filter(Boolean);
    if (newEntries.length) {
      setArchives(prev => ({ ...prev, [profId]: [...(prev[profId] || []), ...newEntries] }));
    }
    const meta = { ...NEW_ATTEMPT_DEFAULTS, ...options.challenge };
    // A setup-time Cold Exposure Upgrade is required from day one — pin its
    // activation to the challenge start (today) so date-aware grading matches.

    // Day 1 may be today or a future local date (a scheduled start). Everything
    // else — weekly requirements, cold exposure, scoring — anchors to it.
    const startDate = options?.startDate || getTodayStr();
    // A brand-new attempt tracks weekly requirements from DAY 1, not from the
    // day it was set up, so a scheduled challenge's week 1 begins on Day 1.
    if (hasWeeklyRequirements(meta) && !meta.weeklyRequirementsStartDate) {
      meta.weeklyRequirementsStartDate = startDate;
    }
    if (isColdExposureEnabled(meta)) meta.coldExposureUpgradeStartDate = startDate;
    // Future Self Letter is stored on the challenge descriptor, so it archives
    // with the challenge (buildArchiveEntry snapshots the descriptor) and is
    // never overwritten by a later challenge.
    if (options?.futureSelfLetter) {
      meta.futureSelfLetter = { ...options.futureSelfLetter, writtenAt: getTodayStr() };
    }
    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        challengeStart: startDate,
        activeChallenge: meta,
        // Starting a NEW primary clears the support lane: a support challenge is
        // chosen to complement one specific primary, so it never silently
        // carries over onto a different one. (Its progress was archived above,
        // through buildArchiveEntry, before anything was replaced.)
        supportChallenge: null,
        supportChallengeStart: null,
        pendingPrimaryChoice: null,
        // The new attempt's task list is generated from ITS OWN template/mode/
        // duration/upgrades and REPLACES whatever was there. It is never merged
        // with, or defaulted to, the outgoing challenge's list — that list has
        // already been snapshotted into the archive entry above.
        tasks: options.tasks.map((t, i) => ({ ...t, source: 'template', order: i, challenges: [LANE.PRIMARY] })),
        // Bonus Missions are per-challenge: seed from the new challenge (or clear).
        bonusMissions: (options?.bonusMissions || []).map((m, i) => ({ ...m, source: 'template', recurring: true, order: i })),
        xpOffset: 0,
        xpStartDay: 1,
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
        comebackHistory: [],
        weeklySessions: [],
        // Volume and exercise history belong to the attempt (they are archived
        // with it just above), so a new attempt starts from a clean slate.
        volumeSets: [],
        exerciseLog: [],
        cycleLogs: [],
        lastCompletion: null,
      },
    }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
    setWeeklyReflectionsState(prev => {
      const next = { ...prev, [profId]: {} };
      saveLS('weeklyReflections', next);
      return next;
    });
    return true;
  }, [activeProfile, buildArchiveEntry, buildSupportArchiveEntry, setArchives, setProfiles, setAllDays]);

  // ── Support challenge lifecycle ───────────────────────────────────────────


  /**
   * Stack a SUPPORT challenge alongside the running primary.
   *
   * The primary is not touched in any way: its descriptor, start date, day
   * records, XP, weekly sessions and archives all stay exactly as they are. Only
   * the shared daily task list grows — and only by the support challenge's
   * NON-duplicate requirements, because mergeSupportTasks folds any habit both
   * challenges require into the single row that already exists.
   *
   * Returns false when it cannot stack (no primary, one already stacked, or a
   * conflicting pairing); the caller surfaces the reason.
   */
  const addSupportChallenge = useCallback((options, profId = activeProfile) => {
    const prof = profiles[profId];
    if (!prof?.challengeStart || !options?.challenge) return false;
    if (hasSupportChallenge(prof)) return false;                 // never more than two
    if (prof.activeChallenge?.templateId === 'forge_daily') return false;
    const primaryId = prof.activeChallenge?.templateId;
    if (primaryId && primaryId === options.challenge.templateId) return false;
    if (!canStack(primaryId, options.challenge.templateId)) return false;

    const startDate = options.startDate || getTodayStr();
    const meta = { ...NEW_ATTEMPT_DEFAULTS, ...options.challenge };
    if (hasWeeklyRequirements(meta) && !meta.weeklyRequirementsStartDate) {
      meta.weeklyRequirementsStartDate = startDate;
    }
    if (isColdExposureEnabled(meta)) meta.coldExposureUpgradeStartDate = startDate;
    if (options.futureSelfLetter) {
      meta.futureSelfLetter = { ...options.futureSelfLetter, writtenAt: getTodayStr() };
    }
    const supportTasks = (options.tasks || []).map(t => ({ ...t, source: 'template' }));
    const { tasks } = mergeSupportTasks(prof.tasks || [], supportTasks);

    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        supportChallenge: meta,
        supportChallengeStart: startDate,
        tasks,
      },
    }));
    return true;
  }, [activeProfile, profiles, setProfiles]);

  /**
   * What adding a support challenge would do to the daily list — the shared
   * habits it would merge and how many rows it would actually add. Pure preview,
   * changes nothing.
   */
  const previewSupportChallenge = useCallback((supportTasks, profId = activeProfile) => {
    return previewMerge(profiles[profId]?.tasks || [], supportTasks || []);
  }, [activeProfile, profiles]);

  /**
   * End the support challenge. Archives it first when it produced any real
   * progress, then removes its rows from the daily list. The PRIMARY challenge
   * is completely unaffected — same descriptor, same start date, same day
   * records, same XP, same score.
   */
  const endSupportChallenge = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    if (!hasSupportChallenge(prof)) return false;
    const nextTasks = stripSupportTasks(prof.tasks || []);

    // XP in Forge is DERIVED: the current task list is re-applied to every logged
    // day. Dropping the support challenge's rows would therefore silently erase
    // XP the user genuinely earned on days they genuinely completed. Measure that
    // difference once, here, and bank it in BOTH places so nothing moves and
    // nothing duplicates:
    //
    //   • the support ARCHIVE takes it as xpEarned  → Lifetime XP is unchanged
    //     (computeLifetimeXP sums archives + the current challenge's raw total,
    //     which is about to drop by exactly this amount — a transfer, not a gain);
    //   • xpOffset takes it too → the visible Challenge XP total is unchanged,
    //     so ending a support challenge never looks like a punishment.
    //
    // Only support-ONLY rows contribute: a shared habit stays in the list, so its
    // XP never moves and can never be counted a second time.
    const dayNum = getDayNumber(profId);
    let carriedXP = 0;
    if (dayNum) {
      const before = computeTotalXP(allDays, profiles, profId, getDayCompletion, dayNum, dayNum);
      const after = computeTotalXP(
        allDays,
        { ...profiles, [profId]: { ...prof, tasks: nextTasks, supportChallenge: null, supportChallengeStart: null } },
        profId, getDayCompletion, dayNum, dayNum,
      );
      carriedXP = Math.max(0, before.rawTotal - after.rawTotal);
    }

    const entry = buildSupportArchiveEntry(profId);
    if (entry) {
      setArchives(prev => ({ ...prev, [profId]: [...(prev[profId] || []), { ...entry, xpEarned: carriedXP, taskXP: carriedXP }] }));
    }

    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        supportChallenge: null,
        supportChallengeStart: null,
        tasks: nextTasks,
        xpOffset: (prev[profId].xpOffset ?? 0) + carriedXP,
      },
    }));
    return true;
  }, [activeProfile, profiles, allDays, getDayCompletion, getDayNumber, setProfiles, setArchives, buildSupportArchiveEntry]);

  /**
   * Promote the running SUPPORT challenge into the PRIMARY slot.
   *
   * Offered (never forced) when the primary finishes. Day records are re-keyed
   * from the old primary's numbering onto the support challenge's own Day 1, so
   * every completion already logged against it survives the move and its
   * progress continues from where it actually is — not from day 1.
   */
  const promoteSupportToPrimary = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    if (!hasSupportChallenge(prof)) return false;
    const oldStart = prof.challengeStart;
    const newStart = prof.supportChallengeStart;
    const meta = { ...prof.supportChallenge };
    // Support rows become the new primary's rows; primary-only rows retire with
    // the challenge that owned them (exactly as any challenge switch works).
    const tasks = tasksForLane(prof.tasks, LANE.SUPPORT)
      .map((t, i) => { const { mergedFrom, targetConflict, ...rest } = t; return { ...rest, challenges: [LANE.PRIMARY], order: i }; });

    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        challengeStart: newStart,
        activeChallenge: meta,
        tasks,
        supportChallenge: null,
        supportChallengeStart: null,
        pendingPrimaryChoice: null,
        lastCompletion: null,
        weeklySessions: hasWeeklyRequirements(meta) ? (prev[profId].weeklySessions || []) : [],
      },
    }));
    setAllDays(prev => ({ ...prev, [profId]: rekeyDays(prev[profId] || {}, oldStart, newStart) }));
    return true;
  }, [activeProfile, profiles, setProfiles, setAllDays]);

  /** Dismiss the "what next?" prompt shown when a primary finishes beside a support. */
  const clearPrimaryChoice = useCallback((profId = activeProfile) => {
    setProfiles(prev => ({ ...prev, [profId]: { ...prev[profId], pendingPrimaryChoice: null } }));
  }, [activeProfile, setProfiles]);

  // Build the Challenge Complete summary shown after a challenge finishes.
  function buildCompletionSummary(entry, profId = activeProfile) {
    const days = entry.days || {};
    const tasks = entry.tasks || [];
    const keystoneTasks = keystoneHabitsOf(tasks);
    let perfectDays = 0, compSum = 0, compCount = 0, ksTotal = 0, ksDone = 0, daysLogged = 0;
    const logged = [];
    for (let i = 1; i <= entry.endDayNum; i++) {
      const d = days[i];
      const hasActivity = d && (Object.values(d.tasks || {}).some(Boolean) || (d.notes || '').trim());
      if (hasActivity) { daysLogged++; logged.push(d); }
      // Date-aware: Cold Shower only counts from its activation date onward.
      const dayTasks = requiredTasksForDay(tasks, entry.challenge, entry.challengeStart, i);
      const done = d ? dayTasks.filter(t => d.tasks?.[t.id]).length : 0;
      const pct = dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0;
      compSum += pct; compCount++;
      if (dayTasks.length && done === dayTasks.length) perfectDays++;
      if (d) for (const kt of keystoneTasks) { ksTotal++; if (d.tasks?.[kt.id]) ksDone++; }
    }
    // "Changes During This Challenge": averaged first-half vs second-half of the
    // logged challenge days for every tracked metric (no single-day baseline).
    // Primary: the user's pre-challenge baseline vs this challenge's average.
    // The baseline is drawn from ALL prior history (older archived challenges and
    // Forge Daily / non-challenge days), strictly before this challenge started —
    // buildTimeline unifies both sources by date, and computeChallengeChanges
    // enforces date < challengeStart so the challenge can never seed its own
    // baseline. Secondary: the within-challenge (first vs second half) trend.
    const historyEntries = buildTimeline(
      { challengeStart: entry.challengeStart, tasks: entry.tasks },
      allDays[profId] || {},
      archives[profId] || [],
    );
    const changesResult = computeChallengeChanges(days, entry.endDayNum, {
      challengeStart: entry.challengeStart,
      historyEntries,
    });
    const trend = computeWithinChallengeTrend(days, entry.endDayNum);

    // Energy Reset: the early-days vs final-days energy result. Built only from
    // the ratings the user actually logged — a day they skipped is absent, not
    // zero, and when there is not enough data the screen says so rather than
    // inventing a change. Associations are observational and worded as such.
    //
    // The comparison window and how many patterns are surfaced both scale with
    // the length the user chose: a 30-day run compares a week against a week and
    // can show a trajectory, while a 7-day run compares three days against
    // three. The evidence bar for a pattern is the same at every length.
    const energySummary = (() => {
      if (entry.challenge?.templateId !== ENERGY_RESET_TEMPLATE_ID) return null;
      const durationDays = entry.challenge?.durationDays || entry.endDayNum;
      const depth = insightDepth(durationDays);
      return buildEnergySummary({
        days,
        endDayNum: entry.endDayNum,
        tasks: entry.tasks || [],
        baseline: entry.challenge?.energyReset?.baseline || null,
        lagKeys: LAGGED_HABIT_KEYS,
        windowSize: windowForDuration(durationDays),
        maxAssociations: depth.maxAssociations,
        trajectory: depth.trajectory,
        depthNote: depth.note,
      });
    })();

    // Women's Hormone Health: the cycle-to-cycle comparison. Built from the
    // archived check-ins only — nothing is estimated, and a metric without real
    // values at both ends simply does not appear.
    const cycleSummary = (() => {
      if (entry.challenge?.templateId !== HORMONE_HEALTH_TEMPLATE_ID) return null;
      const cycles = groupCycles(entry.cycleLogs || []);
      return {
        tracked: true,
        cycles: cycles.map(c => ({
          index: c.index, stage: c.stage?.label || null, start: c.start, end: c.end, days: c.days,
          avgPain: c.avgPain, worstPain: c.worstPain, avgEnergy: c.avgEnergy, avgMood: c.avgMood,
          avgBloating: c.avgBloating, avgSleepQuality: c.avgSleepQuality,
          lifeImpact: c.lifeImpact, exerciseDisruptedDays: c.exerciseDisruptedDays,
          workDisruptedDays: c.workDisruptedDays, heavyFlowDays: c.heavyFlowDays,
        })),
        changes: compareCycles(cycles),
        safetyFlags: safetyFlags(cycles, entry.cycleLogs || []),
        // Severe symptoms that persisted despite completing the challenge. The
        // completion screen uses this to say plainly that this is not a
        // discipline failure and is worth medical attention.
        persistentSymptoms: persistentSymptomsAtCompletion(cycles),
        enoughData: cycles.length >= 2,
      };
    })();

    return {
      cycleSummary,
      energySummary,
      name: entry.challenge?.name,
      emoji: entry.challenge?.emoji,
      variant: entry.challenge?.variant,
      templateId: entry.challenge?.templateId,
      coldExposureEnabled: !!entry.challenge?.coldExposureUpgradeEnabled,
      weeklyRequirements: entry.weeklyRequirements || { tracked: false },
      coldExposureStartDate: entry.challenge?.coldExposureUpgradeStartDate || null,
      challengeStart: entry.challengeStart || null,
      durationDays: entry.challenge?.durationDays,
      completionDate: entry.completionDate || getTodayStr(),
      xpEarned: entry.xpEarned,
      badges: entry.badges || [],
      badgeId: entry.challenge?.badgeId || null,
      daysLogged,
      perfectDays,
      avgCompletion: compCount ? Math.round(compSum / compCount) : 0,
      keystonePct: ksTotal ? Math.round((ksDone / ksTotal) * 100) : 0,
      hasKeystones: keystoneTasks.length > 0,
      reflections: entry.weeklyReflections || {},
      letter: entry.challenge?.futureSelfLetter || null,
      changes: changesResult.changes,
      changesHasBaseline: changesResult.hasBaseline,
      changesLimited: changesResult.limited,
      trend,
      // Challenge Performance result (percentage score system)
      finalScore: entry.finalScore ?? null,
      scoreAvailable: entry.scoreAvailable !== false && entry.finalScore != null,
      // Old archives completed before a threshold was stored keep the historical
      // 75% context (their pass/fail was decided under the old default).
      passingScore: entry.passingScore ?? LEGACY_PASSING_SCORE,
      keystoneRequirement: entry.keystoneRequirement ?? DEFAULT_KEYSTONE_REQUIREMENT,
      keystoneAdherence: entry.keystoneAdherence ?? null,
      passed: entry.passed ?? null,
      completionBonus: entry.completionBonus ?? 0,
      bonusEarned: !!entry.bonusEarned,
      taskXP: entry.taskXP ?? entry.xpEarned ?? 0,
      bonusXP: entry.bonusXP ?? 0,
    };
  }

  /**
   * Complete the active challenge: archive it (with completion metadata), store
   * a Challenge Complete summary, and automatically return to Forge Daily so
   * the app never stays frozen on the final day. Lifetime data is preserved.
   */
  const completeChallenge = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    if (!prof?.challengeStart) return;
    if (prof.activeChallenge?.templateId === 'forge_daily') return; // baseline never "completes"
    if (isScheduled(prof)) return; // never begun — cannot complete

    const entry = buildArchiveEntry(profId);
    const summary = entry ? buildCompletionSummary(entry, profId) : null;
    if (entry) {
      setArchives(prev => ({ ...prev, [profId]: [...(prev[profId] || []), entry] }));
    }

    // ── A support challenge is still running ────────────────────────────────
    // Finishing the primary must not quietly end it. The primary slot drops to
    // the Forge Daily baseline (the app's "no active primary" state) anchored to
    // the SUPPORT's Day 1, and the day records are re-keyed to that anchor so
    // the support challenge's own progress is fully preserved. The user is then
    // prompted to promote it, choose a new primary, or stay as they are —
    // pendingPrimaryChoice records that the decision is theirs to make.
    if (hasSupportChallenge(prof)) {
      const supportStart = prof.supportChallengeStart;
      const supportTasks = tasksForLane(prof.tasks, LANE.SUPPORT)
        .map(t => { const { mergedFrom, targetConflict, ...rest } = t; return rest; });
      const { tasks } = mergeSupportTasks(
        FORGE_DAILY_TASKS.map(t => ({ ...t, source: 'template', challenges: [LANE.PRIMARY] })),
        supportTasks,
      );
      setProfiles(prev => ({
        ...prev,
        [profId]: {
          ...prev[profId],
          challengeStart: supportStart,
          activeChallenge: { ...FORGE_DAILY_META },
          tasks,
          bonusMissions: [],
          lastCompletion: summary,
          pendingPrimaryChoice: {
            finishedName: prof.activeChallenge?.name || null,
            supportName: prof.supportChallenge?.name || null,
            supportEmoji: prof.supportChallenge?.emoji || null,
          },
          xpOffset: 0,
          xpStartDay: 1,
          comebackMode: { active: false, dayStart: null, dismissedAt: null },
          comebackHistory: [],
          weeklySessions: hasWeeklyRequirements(prof.supportChallenge) ? (prev[profId].weeklySessions || []) : [],
        },
      }));
      setAllDays(prev => ({ ...prev, [profId]: rekeyDays(prev[profId] || {}, prof.challengeStart, supportStart) }));
      return;
    }

    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        challengeStart: getTodayStr(),
        activeChallenge: { ...FORGE_DAILY_META },
        tasks: FORGE_DAILY_TASKS.map((t, i) => ({ ...t, source: 'template', order: i })),
        bonusMissions: [],
        lastCompletion: summary,
        xpOffset: 0,
        xpStartDay: 1,
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
        comebackHistory: [],
        weeklySessions: [],
      },
    }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
    setWeeklyReflectionsState(prev => {
      const next = { ...prev, [profId]: {} };
      saveLS('weeklyReflections', next);
      return next;
    });
  }, [activeProfile, profiles, buildArchiveEntry, buildSupportArchiveEntry, setArchives, setProfiles, setAllDays]);

  /**
   * The SUPPORT challenge has run past its final day: archive it and clear the
   * support slot. The primary challenge continues completely untouched — this
   * never resets, re-anchors or re-scores it.
   */
  const completeSupportChallenge = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    if (!hasSupportChallenge(prof)) return false;
    if (!laneIsComplete(prof, LANE.SUPPORT)) return false;
    return endSupportChallenge(profId);
  }, [activeProfile, profiles, endSupportChallenge]);

  /** Dismiss the Challenge Complete screen (stay on Forge Daily). */
  const dismissCompletion = useCallback((profId = activeProfile) => {
    setProfiles(prev => ({ ...prev, [profId]: { ...prev[profId], lastCompletion: null } }));
  }, [activeProfile, setProfiles]);

  /**
   * Drop to Forge Daily — the app's NO ACTIVE CHALLENGE state.
   *
   * This is the whole of what "Start New Challenge" does to stored state: it
   * archives the running attempt(s) exactly once and leaves the profile with no
   * challenge. It deliberately does NOT instantiate anything — the user then
   * picks a challenge from the library and configures it, and only that
   * confirmation creates the next attempt.
   *
   * Forge Daily is open-ended (durationDays null), so this period is never
   * counted as "Day 1 of" any challenge, and the user can keep logging while
   * they decide. Archives, lifetime XP, rank and every previous attempt are
   * untouched; only the live attempt's own slate is cleared.
   */
  const startForgeDaily = useCallback((profId = activeProfile) => {
    // Both lanes are archived, so ending everything while a support challenge
    // is stacked leaves two records rather than silently dropping the support.
    const entries = [buildArchiveEntry(profId), buildSupportArchiveEntry(profId)].filter(Boolean);
    if (entries.length) setArchives(prev => ({ ...prev, [profId]: [...(prev[profId] || []), ...entries] }));
    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        challengeStart: getTodayStr(),
        activeChallenge: { ...FORGE_DAILY_META },
        tasks: FORGE_DAILY_TASKS.map((t, i) => ({ ...t, source: 'template', order: i, challenges: [LANE.PRIMARY] })),
        bonusMissions: [],
        // The support lane is chosen to complement one specific primary, so it
        // never survives that primary ending. (Archived just above.)
        supportChallenge: null,
        supportChallengeStart: null,
        pendingPrimaryChoice: null,
        xpOffset: 0,
        xpStartDay: 1,
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
        comebackHistory: [],
        weeklySessions: [],
        // Attempt-scoped logs. Archived with the attempt above, so a new slate
        // here cannot leak one challenge's data into the next.
        volumeSets: [],
        exerciseLog: [],
        cycleLogs: [],
      },
    }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
    setWeeklyReflectionsState(prev => {
      const next = { ...prev, [profId]: {} };
      saveLS('weeklyReflections', next);
      return next;
    });
  }, [activeProfile, buildArchiveEntry, setArchives, setProfiles, setAllDays]);

  /**
   * Restore an archived challenge as the active one. If a challenge is
   * currently running with logged data, it is archived first — no data loss.
   */
  const restoreArchive = useCallback((archiveId, profId = activeProfile) => {
    const list = archives[profId] || [];
    const entry = list.find(a => a.id === archiveId);
    if (!entry) return;

    let newList = list.filter(a => a.id !== archiveId);
    const activeEntry = buildArchiveEntry(profId);
    if (activeEntry) newList = [...newList, activeEntry];

    setArchives(prev => ({ ...prev, [profId]: newList }));
    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        challengeStart: entry.challengeStart,
        activeChallenge: entry.challenge ? { ...entry.challenge } : { ...DISCIPLINE_75_META },
        tasks: entry.tasks?.length ? entry.tasks : prev[profId].tasks,
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
        comebackHistory: entry.comebackHistory || [],
        xpOffset: entry.xpOffset ?? 0,
        xpStartDay: entry.xpStartDay ?? 1,
      },
    }));
    setAllDays(prev => ({ ...prev, [profId]: entry.days || {} }));
  }, [activeProfile, archives, buildArchiveEntry, setArchives, setProfiles, setAllDays]);

  /**
   * True when the active challenge was started from an older version of its
   * template (only variant-based templates carry a version).
   */
  const isChallengeTemplateOutdated = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    const meta = prof?.activeChallenge;
    if (!prof?.challengeStart || !meta) return false;
    const tpl = getTemplateById(meta.templateId);
    if (!tpl || tpl.start_flow !== 'variant' || !meta.variant) return false;
    if (!tpl.variants?.[meta.variant]?.start_tasks) return false;
    return (meta.templateVersion || 1) < (tpl.template_version || 1);
  }, [activeProfile, profiles]);

  /**
   * Resolve whether a task is template-owned or user-added. Tasks saved
   * before the source field existed are inferred safely: an id that belongs
   * to the active template (any variant, or its id prefix) is template-owned;
   * anything else — including tasks added via Manage Tasks — is custom.
   */
  const getTaskSource = useCallback((task, profId = activeProfile) => {
    if (task?.source === 'template' || task?.source === 'custom') return task.source;
    const meta = profiles[profId]?.activeChallenge;
    const tpl = meta ? getTemplateById(meta.templateId) : null;
    if (!tpl || tpl.start_flow !== 'variant') return 'custom';
    for (const v of Object.values(tpl.variants || {})) {
      if ((v.start_tasks || []).some(t => t.id === task.id)) return 'template';
    }
    if (tpl.task_id_prefix && task.id?.startsWith(tpl.task_id_prefix)) return 'template';
    return 'custom';
  }, [activeProfile, profiles]);

  /**
   * Sync the active challenge's task list with the latest version of its
   * template (same variant). Only template-owned tasks are refreshed:
   * new template tasks are added, outdated template tasks are removed, and
   * user-added custom tasks are always preserved (appended after the
   * template tasks, keeping their relative order).
   *
   * Nothing resets: challenge start date, day data, XP history, and archives
   * are untouched. Task IDs are stable across template versions, so saved
   * completion for matching tasks (template and custom) is preserved; flags
   * for removed tasks stay in the day records (ignored, never deleted) and
   * new tasks simply start unchecked going forward.
   */
  const syncActiveChallengeWithTemplate = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    const meta = prof?.activeChallenge;
    if (!prof?.challengeStart || !meta) return;
    const tpl = getTemplateById(meta.templateId);
    const variantDef = tpl?.variants?.[meta.variant];
    if (!variantDef?.start_tasks) return;

    // Preserve the locked Cold Exposure Upgrade for this attempt: when enabled,
    // the required Cold Shower task is re-generated into the refreshed template
    // task list (it is not part of the static template start_tasks). A sync
    // never silently removes it or alters the attempt's rule.
    const baseTemplateTasks = applyColdExposureUpgrade(variantDef.start_tasks, isColdExposureEnabled(meta));
    const templateTasks = baseTemplateTasks.map(t => ({ ...t, source: 'template' }));
    const customTasks = [...(prof.tasks || [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter(t => getTaskSource(t, profId) === 'custom')
      .map(t => ({ ...t, source: 'custom' }));

    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        tasks: [...templateTasks, ...customTasks].map((t, i) => ({ ...t, order: i })),
        activeChallenge: { ...prev[profId].activeChallenge, templateVersion: tpl.template_version || 1 },
      },
    }));
  }, [activeProfile, profiles, getTaskSource, setProfiles]);

  const deleteArchive = useCallback((archiveId, profId = activeProfile) => {
    setArchives(prev => ({
      ...prev,
      [profId]: (prev[profId] || []).filter(a => a.id !== archiveId),
    }));
  }, [activeProfile, setArchives]);

  /**
   * Advanced danger-zone option: permanently delete ALL data for one profile —
   * active challenge, archives, lifetime XP, quotes, experiments. The other
   * profile's data is untouched.
   */
  const deleteAllProfileData = useCallback((profId = activeProfile) => {
    const defaults = makeDefaultProfiles()[profId];
    setProfiles(prev => ({ ...prev, [profId]: defaults }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
    setArchives(prev => ({ ...prev, [profId]: [] }));
    setQuoteData(prev => ({ ...prev, [profId]: {} }));
    setExperiments(prev => ({ ...prev, [profId]: [] }));
    setDismissedHints(prev => ({ ...prev, [profId]: {} }));
    // Progress photos live in IndexedDB rather than localStorage, so deleting a
    // profile's data has to clear them explicitly or the images would outlive
    // everything else the user asked to erase.
    clearProfilePhotos(profId);
  }, [activeProfile, setProfiles, setAllDays, setArchives, setQuoteData, setExperiments, setDismissedHints]);

  // Update start date without wiping saved day data — used for backfilling
  /**
   * Move a SCHEDULED attempt's Day 1 to another date (past-safe: refuses once the
   * challenge has begun, where setChallengeStart's backfill correction applies
   * instead). No days have occurred yet, so nothing else is touched.
   */
  const rescheduleChallenge = useCallback((dateStr, profId = activeProfile) => {
    if (!dateStr) return false;
    const prof = profiles[profId];
    if (!isScheduled(prof)) return false;
    setProfiles(prev => {
      const p = prev[profId];
      const meta = { ...p.activeChallenge };
      // Re-anchor the date-based challenge rules to the new Day 1.
      if (meta.weeklyRequirementsStartDate) meta.weeklyRequirementsStartDate = dateStr;
      if (meta.coldExposureUpgradeStartDate) meta.coldExposureUpgradeStartDate = dateStr;
      return { ...prev, [profId]: { ...p, challengeStart: dateStr, activeChallenge: meta } };
    });
    return true;
  }, [activeProfile, profiles, setProfiles]);

  /** Begin a scheduled attempt immediately: today's local date becomes Day 1. */
  const startChallengeNow = useCallback((profId = activeProfile) => {
    return rescheduleChallenge(getTodayStr(), profId);
  }, [activeProfile, rescheduleChallenge]);

  const setChallengeStart = useCallback((dateStr, profId = activeProfile) => {
    if (!dateStr) return;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], challengeStart: dateStr },
    }));
  }, [activeProfile, setProfiles]);

  const updateProfile = useCallback((updates) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: { ...prev[activeProfile], ...updates },
    }));
  }, [activeProfile, setProfiles]);

  const addTask = useCallback((taskData) => {
    if (!activeProfile) return;
    const tasks = profile?.tasks || [];
    // Tasks added through Manage Tasks (or Insights) are user-owned:
    // template syncs must never remove them.
    const newTask = { id: `task_${Date.now()}`, order: tasks.length, source: 'custom', ...taskData };
    updateProfile({ tasks: [...tasks, newTask] });
  }, [activeProfile, profile, updateProfile]);

  const updateTask = useCallback((taskId, updates) => {
    if (!activeProfile) return;
    const tasks = profile?.tasks || [];
    updateProfile({ tasks: tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) });
  }, [activeProfile, profile, updateProfile]);

  const deleteTask = useCallback((taskId) => {
    if (!activeProfile) return;
    // The Cold Exposure Upgrade is a locked rule of the active Mental Training
    // attempt: its required Cold Shower task cannot be casually removed through
    // ordinary task management (to change it, start a new challenge attempt).
    if (taskId === 'mt_cold_shower' && isColdExposureEnabled(profile?.activeChallenge)) return;
    const tasks = profile?.tasks || [];
    updateProfile({ tasks: tasks.filter(t => t.id !== taskId).map((t, i) => ({ ...t, order: i })) });
  }, [activeProfile, profile, updateProfile]);

  const reorderTasks = useCallback((newTasks) => {
    updateProfile({ tasks: newTasks.map((t, i) => ({ ...t, order: i })) });
  }, [updateProfile]);

  /**
   * Add the Cold Exposure Upgrade to the ACTIVE Mental Training challenge, mid-
   * attempt. One-directional (disabled → enabled) and idempotent: it never runs
   * for a non-MT challenge or an already-enabled attempt. It sets the locked
   * rule + activation date (today, local) and generates today's required Cold
   * Shower task. Past days are untouched — date-aware grading excludes the task
   * from every date before the activation date, so no prior grade, XP, count, or
   * penalty changes.
   */
  const addColdExposureUpgrade = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    const meta = prof?.activeChallenge;
    if (!prof?.challengeStart) return;
    if (meta?.templateId !== MENTAL_TRAINING_TEMPLATE_ID) return;
    if (meta?.coldExposureUpgradeEnabled === true) return;
    // Effective from today for a running challenge; from Day 1 for one that is
    // still scheduled — the upgrade can never activate before the challenge does.
    const startDate = isScheduled(prof) ? prof.challengeStart : getTodayStr();
    const todayNum = getDayNumber(profId);
    setProfiles(prev => {
      const p = prev[profId];
      return {
        ...prev,
        [profId]: {
          ...p,
          activeChallenge: { ...p.activeChallenge, coldExposureUpgradeEnabled: true, coldExposureUpgradeStartDate: startDate },
          tasks: applyColdExposureUpgrade(p.tasks || [], true).map((t, i) => ({ ...t, order: i })),
        },
      };
    });
    // Prevent double cold-exposure credit on the activation date: drop any
    // optional bm_cold bonus already completed earlier today (its XP is
    // superseded by the now-required Cold Shower, which starts unchecked).
    // Past dates are never touched.
    if (todayNum) {
      setAllDays(prev => {
        const profDays = prev[profId] || {};
        const d = profDays[todayNum];
        if (!d || d.bonusDone?.[COLD_SHOWER_BONUS_ID] == null) return prev;
        const bonusDone = { ...d.bonusDone };
        delete bonusDone[COLD_SHOWER_BONUS_ID];
        return { ...prev, [profId]: { ...profDays, [todayNum]: { ...d, bonusDone } } };
      });
    }
  }, [activeProfile, profiles, setProfiles, setAllDays, getDayNumber]);

  // ── Bonus Mission actions ───────────────────────────────────────────────
  // Bonus Missions are optional. They award bonus XP but are never required,
  // never counted in required progress, and never affect challenge/streak/MWD
  // completion. Completion + the XP awarded are stored per profile and date in
  // dayData.bonusDone (missionId → XP), so XP is awarded once, removed on
  // uncheck, and never double-counted after reopening.

  // ── Weekly Requirements (Fat Loss) ──────────────────────────────────────
  // Sessions are stored individually on the active attempt so they can be
  // listed, attributed to a date and removed one at a time. Nothing is ever
  // inferred — a session exists only because the user logged it.

  const logWeeklySession = useCallback((type, dateStr, profId = activeProfile) => {
    if (!profId || !type) return null;
    const meta = profiles[profId]?.activeChallenge;
    if (!hasWeeklyRequirements(meta)) return null;
    const date = dateStr || getTodayStr();
    const session = makeSession(type, date);
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], weeklySessions: [...(prev[profId]?.weeklySessions || []), session] },
    }));
    return session;
  }, [activeProfile, profiles, setProfiles]);

  /** Remove one session by id (undo / fix a mistaken log). */
  const removeWeeklySession = useCallback((sessionId, profId = activeProfile) => {
    if (!profId || !sessionId) return;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], weeklySessions: (prev[profId]?.weeklySessions || []).filter(s => s.id !== sessionId) },
    }));
  }, [activeProfile, setProfiles]);

  // ── Muscle Building: weekly hard-set volume ───────────────────────────────
  // Sets are stored individually, like weekly sessions, so they can be listed,
  // dated and undone one at a time. Logging a set awards NO XP and never enters
  // the challenge score — volume is a progress metric, not a currency.

  const logVolumeSets = useCallback((muscle, sets = 1, dateStr, profId = activeProfile) => {
    if (!profId || !muscle) return null;
    if (!tracksVolume(profiles[profId]?.activeChallenge)) return null;
    const entry = makeVolumeEntry(muscle, sets, dateStr || getTodayStr());
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], volumeSets: [...(prev[profId]?.volumeSets || []), entry] },
    }));
    return entry;
  }, [activeProfile, profiles, setProfiles]);

  const removeVolumeEntry = useCallback((entryId, profId = activeProfile) => {
    if (!profId || !entryId) return;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], volumeSets: (prev[profId]?.volumeSets || []).filter(v => v.id !== entryId) },
    }));
  }, [activeProfile, setProfiles]);

  /** Weekly volume state for the active attempt's current challenge week. */
  const getWeeklyVolume = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    return weeklyVolume({
      entries: prof?.volumeSets,
      meta: prof?.activeChallenge,
      challengeStart: prof?.challengeStart,
      rawDay: getRawDayNumber(profId),
    });
  }, [activeProfile, profiles, getRawDayNumber]);

  // ── Muscle Building: exercise log (progressive overload) ──────────────────

  const logExercise = useCallback((entryData, profId = activeProfile) => {
    if (!profId) return null;
    const entry = makeExerciseEntry({ ...entryData, date: entryData?.date || getTodayStr() });
    if (!entry) return null;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], exerciseLog: [...(prev[profId]?.exerciseLog || []), entry] },
    }));
    return entry;
  }, [activeProfile, setProfiles]);

  const removeExerciseEntry = useCallback((entryId, profId = activeProfile) => {
    if (!profId || !entryId) return;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], exerciseLog: (prev[profId]?.exerciseLog || []).filter(e => e.id !== entryId) },
    }));
  }, [activeProfile, setProfiles]);

  // ── Women's Hormone Health: menstrual symptom check-ins ───────────────────
  // Written ONLY by this challenge, and only for days the user chose to mark as
  // menstrual days. Forge never infers a cycle phase and no other challenge
  // reads these. Check-ins are outcome MEASUREMENTS — they award no XP and
  // never enter the challenge score.

  /** Create or update the check-in for a date. Idempotent per date. */
  const saveCycleLog = useCallback((dateStr, values, profId = activeProfile) => {
    if (!profId || !dateStr) return null;
    if (!tracksCycles(profiles[profId]?.activeChallenge)) return null;
    let saved = null;
    setProfiles(prev => {
      const p = prev[profId];
      const list = p?.cycleLogs || [];
      const existing = list.find(l => l.date === dateStr);
      saved = existing
        ? { ...existing, ...values, interference: { ...existing.interference, ...(values?.interference || {}) },
            concerns: { ...existing.concerns, ...(values?.concerns || {}) } }
        : makeCycleLog(dateStr, values);
      return {
        ...prev,
        [profId]: {
          ...p,
          cycleLogs: existing ? list.map(l => (l.date === dateStr ? saved : l)) : [...list, saved],
        },
      };
    });
    return saved;
  }, [activeProfile, profiles, setProfiles]);

  /** Remove a check-in entirely (the user un-marks a menstrual day). */
  const removeCycleLog = useCallback((dateStr, profId = activeProfile) => {
    if (!profId || !dateStr) return;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], cycleLogs: (prev[profId]?.cycleLogs || []).filter(l => l.date !== dateStr) },
    }));
  }, [activeProfile, setProfiles]);

  /** The check-in for a date, or null. */
  const getCycleLog = useCallback((dateStr, profId = activeProfile) => {
    return logForDate(profiles[profId]?.cycleLogs, dateStr);
  }, [activeProfile, profiles]);

  /** The attempt's check-ins grouped into cycles, with each cycle summarised. */
  const getCycles = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    if (!tracksCycles(prof?.activeChallenge)) return [];
    return groupCycles(logsInChallenge(prof?.cycleLogs, prof?.challengeStart, getRawDayNumber(profId)));
  }, [activeProfile, profiles, getRawDayNumber]);

  /** Resolved weekly-requirement state for the active attempt. */
  const getWeeklyRequirements = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    return computeWeeklyRequirements({
      sessions: prof?.weeklySessions,
      meta: prof?.activeChallenge,
      challengeStart: prof?.challengeStart,
      currentRawDay: getRawDayNumber(profId),
      penaltiesEnabled: prof?.xpPenalties !== false,
    });
  }, [activeProfile, profiles, getRawDayNumber]);

  const toggleBonusMission = useCallback((dayNumber, mission) => {
    if (!activeProfile || !mission?.id || !dayNumber) return;
    setAllDays(prev => {
      const profDays = prev[activeProfile] || {};
      const existing = profDays[dayNumber] || emptyDay(null, dayNumber);
      const bonusDone = { ...(existing.bonusDone || {}) };
      if (bonusDone[mission.id] != null) delete bonusDone[mission.id];
      else bonusDone[mission.id] = Number(mission.xp) || 0;
      return { ...prev, [activeProfile]: { ...profDays, [dayNumber]: { ...existing, bonusDone } } };
    });
  }, [activeProfile, setAllDays]);

  // Add a Bonus Mission. Recurring missions live on the profile (appear every
  // day); one-time missions live on a single day's record.
  const addBonusMission = useCallback((def, opts = {}) => {
    if (!activeProfile || !def?.name) return;
    const mission = {
      id: def.id || `bm_custom_${Date.now()}`,
      icon: def.icon || '🎯',
      name: def.name,
      xp: Number(def.xp) || 0,
      desc: def.desc || '',
      source: def.source || 'custom',
    };
    if (opts.recurring) {
      setProfiles(prev => {
        const cur = prev[activeProfile]?.bonusMissions || [];
        if (cur.some(m => m.id === mission.id)) return prev; // no duplicates
        return {
          ...prev,
          [activeProfile]: {
            ...prev[activeProfile],
            bonusMissions: [...cur, { ...mission, recurring: true, order: cur.length }],
          },
        };
      });
    } else {
      const dayNumber = opts.dayNumber;
      if (!dayNumber) return;
      setAllDays(prev => {
        const profDays = prev[activeProfile] || {};
        const existing = profDays[dayNumber] || emptyDay(null, dayNumber);
        const oneTime = existing.bonusOneTime || [];
        if (oneTime.some(m => m.id === mission.id)) return prev;
        return {
          ...prev,
          [activeProfile]: { ...profDays, [dayNumber]: { ...existing, bonusOneTime: [...oneTime, { ...mission, recurring: false }] } },
        };
      });
    }
  }, [activeProfile, setProfiles, setAllDays]);

  // Remove a Bonus Mission. Recurring defs are removed from the profile;
  // one-time missions from the day. The given day's completion for that mission
  // is cleared so today's count/XP update; earned XP on PAST days is preserved.
  const removeBonusMission = useCallback((missionId, opts = {}) => {
    if (!activeProfile || !missionId) return;
    if (opts.recurring) {
      setProfiles(prev => {
        const cur = prev[activeProfile]?.bonusMissions || [];
        return {
          ...prev,
          [activeProfile]: {
            ...prev[activeProfile],
            bonusMissions: cur.filter(m => m.id !== missionId).map((m, i) => ({ ...m, order: i })),
          },
        };
      });
    }
    const dayNumber = opts.dayNumber;
    if (dayNumber) {
      setAllDays(prev => {
        const profDays = prev[activeProfile] || {};
        const existing = profDays[dayNumber];
        if (!existing) return prev;
        const bonusDone = { ...(existing.bonusDone || {}) };
        delete bonusDone[missionId];
        const bonusOneTime = (existing.bonusOneTime || []).filter(m => m.id !== missionId);
        return { ...prev, [activeProfile]: { ...profDays, [dayNumber]: { ...existing, bonusDone, bonusOneTime } } };
      });
    }
  }, [activeProfile, setProfiles, setAllDays]);

  const reorderBonusMissions = useCallback((newList) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: { ...prev[activeProfile], bonusMissions: (newList || []).map((m, i) => ({ ...m, order: i })) },
    }));
  }, [activeProfile, setProfiles]);

  // ── Rank actions (Lifetime Rank ceremony + Hall of Legends) ──────────────
  // rankHistory records every rank ever reached: { rank, name, philosophy,
  // date, lifetimeXP }. highestRank is the max rank number reached and gates
  // the once-per-rank ceremony (it never replays a previously earned rank).

  // NOTE: the former initRankBaseline / recordRankUp pair has been retired.
  // Both wrote highestRank from the Home screen, which meant the permanent rank
  // was only persisted when Home happened to be open — and neither ever fed the
  // XP floor. syncRankUnlock (above) is now the single writer.

  // ── Quote actions ──────────────────────────────────────────────────────

  const updateQuoteSettings = useCallback((updates) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        quoteSettings: { ...prev[activeProfile].quoteSettings, ...updates },
      },
    }));
  }, [activeProfile, setProfiles]);

  const addCustomQuote = useCallback((quoteData) => {
    if (!activeProfile) return;
    const quotes = profile?.customQuotes || [];
    const newQ = { id: `q_custom_${Date.now()}`, isInspired: true, ...quoteData };
    updateProfile({ customQuotes: [...quotes, newQ] });
  }, [activeProfile, profile, updateProfile]);

  const updateCustomQuote = useCallback((id, updates) => {
    if (!activeProfile) return;
    const quotes = profile?.customQuotes || [];
    updateProfile({ customQuotes: quotes.map(q => q.id === id ? { ...q, ...updates } : q) });
  }, [activeProfile, profile, updateProfile]);

  const deleteCustomQuote = useCallback((id) => {
    if (!activeProfile) return;
    const quotes = profile?.customQuotes || [];
    const qs = profile?.quoteSettings || {};
    updateProfile({
      customQuotes: quotes.filter(q => q.id !== id),
      quoteSettings: { ...qs, favorites: (qs.favorites || []).filter(fid => fid !== id) },
    });
  }, [activeProfile, profile, updateProfile]);

  const toggleFavoriteQuote = useCallback((quoteId) => {
    if (!activeProfile) return;
    const favs = profile?.quoteSettings?.favorites || [];
    const next = favs.includes(quoteId)
      ? favs.filter(id => id !== quoteId)
      : [...favs, quoteId];
    updateQuoteSettings({ favorites: next });
  }, [activeProfile, profile, updateQuoteSettings]);

  const getQuoteDataForDate = useCallback((dateStr) => {
    if (!activeProfile) return null;
    return (quoteData[activeProfile] || {})[dateStr] || null;
  }, [activeProfile, quoteData]);

  const updateQuoteDataForDate = useCallback((dateStr, updates) => {
    if (!activeProfile) return;
    setQuoteData(prev => {
      const profData = prev[activeProfile] || {};
      const existing = profData[dateStr] || { cycleOffset: 0, reflectionNotes: '', reflectionComplete: false };
      return {
        ...prev,
        [activeProfile]: {
          ...profData,
          [dateStr]: { ...existing, ...updates },
        },
      };
    });
  }, [activeProfile, setQuoteData]);

  // ── Insights / Experiment actions ──────────────────────────────────────

  const startExperiment = useCallback((habitId, habitName, baselineDayNums, startDayNum) => {
    if (!activeProfile) return;
    const tasks = profiles[activeProfile]?.tasks || [];
    const profDays = allDays[activeProfile] || {};
    const baseline = computeAverages(baselineDayNums, profDays, tasks);
    const exp = {
      id: `exp_${Date.now()}`,
      habitId,
      habitName,
      startDayNum,
      endDayNum: startDayNum + 6,
      status: 'active',
      baseline,
      result: null,
      startedAt: getTodayStr(),
    };
    setExperiments(prev => ({
      ...prev,
      [activeProfile]: [...(prev[activeProfile] || []), exp],
    }));
  }, [activeProfile, profiles, allDays, setExperiments]);

  const updateExperiment = useCallback((expId, updates) => {
    if (!activeProfile) return;
    setExperiments(prev => ({
      ...prev,
      [activeProfile]: (prev[activeProfile] || []).map(e =>
        e.id === expId ? { ...e, ...updates } : e
      ),
    }));
  }, [activeProfile, setExperiments]);

  const dismissHint = useCallback((habitId) => {
    if (!activeProfile) return;
    // Expires 7 days from today
    const today = getTodayStr();
    const expiry = new Date(today);
    expiry.setDate(expiry.getDate() + 7);
    const expiryStr = expiry.toISOString().slice(0, 10);
    setDismissedHints(prev => ({
      ...prev,
      [activeProfile]: {
        ...(prev[activeProfile] || {}),
        [habitId]: expiryStr,
      },
    }));
  }, [activeProfile, setDismissedHints]);

  // ── Lifetime rank + permanent rank floor ─────────────────────────────────
  //
  // ONE source of truth. Every screen that shows a rank, Lifetime XP, tier
  // progress or "XP to next rank" reads getRankState() — so it is structurally
  // impossible for one screen to show a rank while another shows XP below that
  // rank's threshold.
  //
  // The floor is enforced HERE, in the state layer, not in any component: raw
  // Lifetime XP is recomputed from archives plus the current challenge (and so
  // falls whenever a task is unchecked, a challenge is recalculated or history
  // is edited), and the effective figure is that raw total clamped up to the
  // threshold of the highest rank ever unlocked.

  /** The calculated (unfloored) Lifetime XP for a profile. */
  const getRawLifetimeXP = useCallback((profId = activeProfile) => {
    const dayNum = getDayNumber(profId);
    const xpData = dayNum
      ? computeTotalXP(allDays, profiles, profId, getDayCompletion, dayNum, dayNum)
      : { rawTotal: 0 };
    return computeLifetimeXP(archives[profId] || [], xpData.rawTotal || 0);
  }, [activeProfile, allDays, profiles, archives, getDayCompletion, getDayNumber]);

  /**
   * The normalized rank state: effective XP (never below the permanent floor),
   * current and next rank, tier progress and XP to the next tier.
   */
  const getRankState = useCallback((profId = activeProfile) => {
    return resolveRankState({
      rawLifetimeXP: getRawLifetimeXP(profId),
      highestRank: profiles[profId]?.highestRank ?? null,
    });
  }, [activeProfile, profiles, getRawLifetimeXP]);

  /** The permanent XP floor for a profile. */
  const getRankFloorXP = useCallback((profId = activeProfile) => {
    return rankFloorXP(profiles[profId]?.highestRank ?? 0);
  }, [activeProfile, profiles]);

  /**
   * Persist a rank unlock. Monotonic and idempotent: highestRank only ever
   * rises, ranks already in history are never duplicated, and re-running with
   * the same state is a no-op (so a reload can never lose or replay an unlock).
   *
   * `silent` marks the one-time baseline for a profile that predates this
   * field — the rank is recorded without a ceremony, because it was earned
   * before Forge started tracking the moment.
   */
  const syncRankUnlock = useCallback((profId, unlockedRank, { silent = false, atXP = 0 } = {}) => {
    if (!profId || !unlockedRank) return;
    setProfiles(prev => {
      const p = prev[profId];
      if (!p) return prev;
      const stored = Number.isFinite(p.highestRank) ? p.highestRank : null;
      if (stored != null && unlockedRank <= stored) return prev;   // never decrement, never replay
      const have = new Set((p.rankHistory || []).map(h => h.rank));
      const additions = [];
      for (let r = 1; r <= unlockedRank; r++) {
        if (have.has(r)) continue;
        const meta = RANKS[r - 1] || {};
        additions.push({
          rank: r,
          name: meta.name,
          philosophy: meta.philosophy,
          // A backfilled rank has no known date; a genuine unlock does.
          date: silent ? null : getTodayStr(),
          lifetimeXP: silent ? (meta.minXP ?? 0) : atXP,
        });
      }
      return {
        ...prev,
        [profId]: {
          ...p,
          highestRank: unlockedRank,
          rankHistory: [...(p.rankHistory || []), ...additions],
          // Consumed by the rank-up ceremony. Only a genuine unlock sets it, so
          // the silent baseline never triggers a retroactive celebration.
          ...(silent ? {} : { pendingRankUp: { fromRank: stored ?? unlockedRank, toRank: unlockedRank, atXP } }),
        },
      };
    });
  }, [setProfiles]);

  /** Clear the ceremony marker once it has been shown. */
  const clearPendingRankUp = useCallback((profId = activeProfile) => {
    setProfiles(prev => (prev[profId]?.pendingRankUp
      ? { ...prev, [profId]: { ...prev[profId], pendingRankUp: null } }
      : prev));
  }, [activeProfile, setProfiles]);

  /**
   * Keep the persisted permanent rank in step with reality, for BOTH profiles
   * independently — a profile's rank history can never be influenced by the
   * other one.
   *
   * Running in the state layer (rather than on the Home screen) is what makes
   * the unlock durable: ranking up while logging tasks on Today, then reloading,
   * still keeps the rank and its floor.
   */
  useEffect(() => {
    for (const profId of Object.keys(profiles)) {
      const prof = profiles[profId];
      if (!prof) continue;
      const raw = getRawLifetimeXP(profId);
      const stored = Number.isFinite(prof.highestRank) ? prof.highestRank : null;

      // Two kinds of evidence, deliberately distinguished:
      //
      //   EVIDENCE  — a tier the user has ALREADY earned, proven by the stored
      //               permanent rank or by the Hall of Legends history. Always
      //               honoured (so a profile whose XP dipped below the tier it
      //               demonstrably reached is normalized UP, never demoted), and
      //               never celebrated, because it is not new.
      //   XP        — the tier the current calculated total reaches. Passing a
      //               tier this way is a genuine unlock and does get a ceremony.
      //
      // Taking the max of all sources is what makes highestRank monotonic: no
      // path here can ever lower it.
      const historic = (prof.rankHistory || []).reduce((m, h) => Math.max(m, h?.rank || 0), 0);
      const evidence = Math.max(stored ?? 0, historic);
      const byXP = resolveRankState({ rawLifetimeXP: raw, highestRank: evidence }).highestRank;
      const target = Math.max(evidence, byXP);
      if (target <= (stored ?? 0) && stored != null) continue;   // nothing to do

      // Silent when the rank was already earned (a first-load baseline, or a
      // tier recovered from history) — a ceremony only ever marks a tier the
      // user has just crossed for the first time.
      const silent = stored == null || target <= evidence;
      syncRankUnlock(profId, target, { silent, atXP: Math.max(raw, rankFloorXP(target)) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, allDays, archives]);

  // ── XP actions ────────────────────────────────────────────────────────────

  const resetXP = useCallback(() => {
    if (!activeProfile) return;
    const dayNum = getDayNumber();
    if (!dayNum) return;
    const { total } = computeTotalXP(allDays, profiles, activeProfile, getDayCompletion, dayNum, dayNum);
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        xpOffset: (prev[activeProfile].xpOffset || 0) - total,
      },
    }));
  }, [activeProfile, allDays, profiles, getDayCompletion, getDayNumber, setProfiles]);

  // ── Comeback Mode actions ──────────────────────────────────────────────────

  const startComeback = useCallback((dayNumber) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        comebackMode: { active: true, dayStart: dayNumber, dismissedAt: null },
      },
    }));
  }, [activeProfile, setProfiles]);

  const dismissComeback = useCallback((dayNumber) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        comebackMode: { active: false, dayStart: null, dismissedAt: dayNumber },
      },
    }));
  }, [activeProfile, setProfiles]);

  const completeComeback = useCallback((startDay) => {
    if (!activeProfile) return;
    setProfiles(prev => {
      const p = prev[activeProfile];
      return {
        ...prev,
        [activeProfile]: {
          ...p,
          comebackMode: { active: false, dayStart: null, dismissedAt: null },
          comebackHistory: [...(p.comebackHistory || []), { startDay, completed: true }],
        },
      };
    });
  }, [activeProfile, setProfiles]);

  return (
    <AppContext.Provider value={{
      activeProfile, profile, profiles, days, allDays, todayStr,
      setActiveProfile,
      getChallengeMeta, hasActiveChallenge, getDayNumber, getRawDayNumber, isForgeDaily, getDayData, getTodayData,
      completeChallenge, dismissCompletion, startForgeDaily,
      getDayCompletion, getStreak, getLongestStreak,
      updateDay, toggleTask,
      startChallenge, setChallengeStart, updateProfile,
      // Archives
      archives, restoreArchive, deleteArchive, deleteAllProfileData,
      // Template sync
      isChallengeTemplateOutdated, syncActiveChallengeWithTemplate, getTaskSource,
      // Notifications
      notifPrefs, updateNotifPrefs,
      // Weekly reflection
      weeklyReflections, saveWeeklyReflection,
      addTask, updateTask, deleteTask, reorderTasks, addColdExposureUpgrade,
      // Weekly Requirements
      logWeeklySession, removeWeeklySession, getWeeklyRequirements,
      // Muscle Building — volume, exercise log
      logVolumeSets, removeVolumeEntry, getWeeklyVolume,
      logExercise, removeExerciseEntry,
      // Women's Hormone Health — symptom check-ins
      saveCycleLog, removeCycleLog, getCycleLog, getCycles,
      // Scheduled / future challenge starts
      getChallengeStatus, isChallengeScheduled, getDaysUntilStart,
      rescheduleChallenge, startChallengeNow, CHALLENGE_STATE,
      // Challenge Combination (primary + optional support)
      getSupportMeta, hasSupport, getSupportDayNumber, getSupportStart, getLaneInfo,
      addSupportChallenge, previewSupportChallenge, endSupportChallenge,
      completeSupportChallenge, promoteSupportToPrimary, clearPrimaryChoice, LANE,
      // Bonus Missions
      toggleBonusMission, addBonusMission, removeBonusMission, reorderBonusMissions,
      // Rank ceremony / Hall of Legends
      // Lifetime rank + permanent floor (single source of truth)
      getRankState, getRawLifetimeXP, getRankFloorXP, clearPendingRankUp,
      MENTAL_OPTIONS,
      // Quote
      quoteData,
      updateQuoteSettings,
      addCustomQuote, updateCustomQuote, deleteCustomQuote,
      toggleFavoriteQuote,
      getQuoteDataForDate, updateQuoteDataForDate,
      // Insights
      experiments, dismissedHints,
      startExperiment, updateExperiment, dismissHint,
      // XP
      resetXP,
      // Comeback
      startComeback, dismissComeback, completeComeback,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
