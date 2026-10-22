import { getDayNumberFromStart, getDateForDayNumber } from './dateUtils.js';
import { isColdExposureRequiredForDate, COLD_SHOWER_TASK_ID } from '../data/challengeTemplates';
import { readDayMetric, dayHasAnyMetric } from './insightsUtils';
import { computeWeeklyRequirements } from './weeklyRequirements';
import { isScheduled } from './challengeSchedule';
import { LANE, challengeOf, startOf, tasksForLane, recordKeyForLaneDay } from './challengeStack';
import { dayRules, bonusCapForAttempt, RANKS as ECONOMY_RANKS, HIGH_VALUE_TASK_IDS as ECONOMY_HIGH_VALUE_IDS } from '../data/xpEconomy';

/**
 * The effective required-task list for a specific challenge day. The only
 * date-dependent task is the Cold Exposure Upgrade's Cold Shower: it is required
 * only on and after its activation date, so it is filtered OUT of any day before
 * that date. Every other task is date-independent. Returns the same array
 * reference when nothing changes (no allocation on the common path).
 */
export function requiredTasksForDay(tasks, meta, challengeStart, dayNum) {
  if (!tasks || !tasks.some(t => t.id === COLD_SHOWER_TASK_ID)) return tasks || [];
  const dateStr = getDateForDayNumber(challengeStart, dayNum);
  if (isColdExposureRequiredForDate(meta, dateStr)) return tasks;
  return tasks.filter(t => t.id !== COLD_SHOWER_TASK_ID);
}

// ─── Minimum Warrior Day ────────────────────────────────────────────────────

export const MWD_TASKS = [
  { id: 'mwd_move',    label: '10 min movement',                icon: '🚶' },
  { id: 'mwd_breathe', label: '2 min breathwork or reflection', icon: '💨' },
  { id: 'mwd_fuel',    label: 'Protein meal or clean food',     icon: '🥩' },
  { id: 'mwd_water',   label: 'Water minimum',                  icon: '💧' },
  { id: 'mwd_learn',   label: '1 page read or 2 min learning',  icon: '📖' },
  { id: 'mwd_wind',    label: 'Sleep wind-down routine',         icon: '🌙' },
];

export function getMWDComplete(dayData) {
  if (!dayData?.isMWD) return false;
  return MWD_TASKS.every(t => dayData.mwdTasks?.[t.id]);
}

// ─── Ranks ──────────────────────────────────────────────────────────────────

/**
 * The rank ladder, re-exported from `src/data/xpEconomy.js` so every existing
 * import keeps working while names and thresholds live in one configurable
 * place.
 *
 * Thresholds are no longer frozen — they are data, and changing them is how
 * Forge rebalances. What IS frozen is the past: a profile's `highestRank` is
 * permanent, and an archive recomputes under the economy version it ran under,
 * so moving a threshold can never revoke a rank someone earned.
 */
export const RANKS = ECONOMY_RANKS;

// ─── Rank rewards ─────────────────────────────────────────────────────────────
// Each rank permanently unlocks one cosmetic/achievement. Purely additive and
// keyed by rank number so future cosmetics only need a new entry here. Unlocked
// rewards are derived from the highest rank ever reached (persisted), so they
// are permanent and survive new challenges.
export const RANK_REWARDS = {
  1: { type: 'achievement',   icon: '🔥', label: 'Forge Initiate',        desc: 'Your journey begins.' },
  2: { type: 'badge',         icon: '🥉', label: 'Apprentice Badge',      desc: 'Consistency badge unlocked.' },
  3: { type: 'quoteCategory', icon: '📜', label: 'Discipline Quotes',     desc: 'A new quote category is unlocked.' },
  4: { type: 'banner',        icon: '🌄', label: 'Resilient Banner',      desc: 'A new profile banner accent.' },
  5: { type: 'iconAccent',    icon: '⚔️', label: 'Warrior Accent',        desc: 'A gold accent for your rank badge.' },
  6: { type: 'badge',         icon: '💠', label: 'Elite Badge',           desc: 'Elite Warrior badge unlocked.' },
  7: { type: 'banner',        icon: '👑', label: 'True Warrior Banner',   desc: 'A premium banner accent.' },
  8: { type: 'achievement',   icon: '🏛', label: 'Unbreakable',           desc: 'The final rank achievement.' },
};

export function getRankReward(rank) {
  return RANK_REWARDS[rank] || null;
}

/** All rewards unlocked up to and including the highest rank reached. */
export function getUnlockedRewards(highestRank) {
  const out = [];
  for (let r = 1; r <= (highestRank || 0); r++) {
    const reward = RANK_REWARDS[r];
    if (reward) out.push({ rank: r, name: RANKS[r - 1]?.name, ...reward });
  }
  return out;
}

/**
 * Bare XP → rank, with NO permanent-floor awareness.
 *
 * Superseded by resolveRankState in utils/rank.js, which every screen uses.
 * Kept only because it is a pure helper over the frozen ladder; do not use it
 * to display a rank, or the permanent floor will not be applied.
 */
export function getRankInfo(xp) {
  let current = RANKS[0];
  let next = RANKS[1] || null;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXP) {
      current = RANKS[i];
      next = RANKS[i + 1] || null;
      break;
    }
  }
  const progress = next
    ? Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
    : 100;
  return { current, next, progress, xp };
}

// ─── Growth summary ("You Have Grown") ───────────────────────────────────────
// Builds evidence of change from a merged, date-sorted timeline of logged days
// (see archiveUtils.buildTimeline). Only metrics with enough real data are
// returned; anything without sufficient history is omitted so nothing is faked.

function fmtHours(h) {
  const hrs = Math.floor(h);
  const m = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(m).padStart(2, '0')}m`;
}

/**
 * @param timeline entries: { date, data, tasks, source }
 * @param opts { streak }
 * Returns an ordered array of { icon, label, before?, after?, value? }.
 */
export function computeGrowthSummary(timeline, opts = {}) {
  const entries = timeline || [];
  const out = [];

  // Before/after for a numeric rating field (mood/confidence/hoursSlept).
  const beforeAfter = (key) => {
    const vals = entries.filter(e => (e.data?.[key] || 0) > 0);
    if (vals.length < 4) return null; // not enough history to be meaningful
    const half = Math.min(3, Math.floor(vals.length / 2));
    const avg = arr => arr.reduce((s, e) => s + e.data[key], 0) / arr.length;
    return { before: avg(vals.slice(0, half)), after: avg(vals.slice(-half)) };
  };

  const mood = beforeAfter('mood');
  if (mood) out.push({ icon: '📈', label: 'Mood', before: mood.before.toFixed(1), after: mood.after.toFixed(1) });

  const conf = beforeAfter('confidence');
  if (conf) out.push({ icon: '💪', label: 'Confidence', before: conf.before.toFixed(1), after: conf.after.toFixed(1) });

  const sleep = beforeAfter('hoursSlept');
  if (sleep) out.push({ icon: '😴', label: 'Average Sleep', before: fmtHours(sleep.before), after: fmtHours(sleep.after) });

  const mental = entries.filter(e => e.data?.mentalTraining?.completed).length;
  if (mental > 0) out.push({ icon: '🧠', label: 'Mental Training Sessions', value: String(mental) });

  const bonus = entries.reduce((s, e) => s + Object.keys(e.data?.bonusDone || {}).length, 0);
  if (bonus > 0) out.push({ icon: '🏆', label: 'Bonus Missions Completed', value: String(bonus) });

  const streak = opts.streak || 0;
  if (streak > 0) out.push({ icon: '🔥', label: 'Current Streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}` });

  return out;
}

// ─── Future Self message ─────────────────────────────────────────────────────
// A short encouraging message shown after the growth summary. When the user
// wrote a Future Self letter it is composed FROM their own words (quoted, never
// modified). This is a deterministic, offline generator — a PWA has no LLM
// backend — so it always works and never sends user data anywhere.

function firstSentence(text) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  const m = t.match(/^(.{0,140}?[.!?])(\s|$)/);
  let s = m ? m[1] : t.slice(0, 140);
  if (!m && t.length > 140) s += '…';
  return s;
}

export function buildFutureSelfMessage(letter) {
  const why = (letter?.why || '').trim();
  if (!why) {
    return {
      hasLetter: false,
      title: 'A word from Forge',
      lines: [
        'The version of you that started this is proud.',
        'Discipline is becoming who you are.',
        'Keep going.',
      ],
    };
  }
  return {
    hasLetter: true,
    title: 'A message from your past self',
    lines: [
      'Remember why you started.',
      `You wrote: “${firstSentence(why)}”`,
      'The person who wrote that knew this would be hard. Keep going.',
    ],
  };
}

// ─── Badges ─────────────────────────────────────────────────────────────────

export const BADGE_DEFS = [
  { id: 'first_task',             emoji: '✅', label: 'First Task',           desc: 'Completed your very first task.' },
  { id: 'first_perfect_day',      emoji: '⭐', label: 'First Perfect Day',    desc: 'Completed 100% of tasks for the first time.' },
  { id: 'streak_3',               emoji: '🔥', label: '3-Day Streak',         desc: '3 consecutive perfect days.' },
  { id: 'streak_7',               emoji: '🏆', label: '7-Day Warrior',        desc: '7 consecutive perfect days.' },
  { id: 'streak_14',              emoji: '⚡', label: '14-Day Drive',         desc: '14 consecutive perfect days.' },
  { id: 'streak_30',              emoji: '💎', label: '30-Day Legend',        desc: '30 consecutive perfect days.' },
  { id: 'returned_after_setback', emoji: '↩️', label: 'Returned',            desc: 'Came back after 2+ missed days.' },
  { id: 'comeback_complete',      emoji: '💪', label: 'Comeback Complete',   desc: 'Finished a 3-day comeback plan.' },
  { id: 'mental_streak',          emoji: '🧠', label: 'Mind Strong',         desc: '5 consecutive days of mental training.' },
  { id: 'sleep_rebuilt',          emoji: '😴', label: 'Sleep Rebuilt',       desc: 'Sleep quality improved from low to 7+.' },
  { id: 'stress_defeated',        emoji: '🧘', label: 'Stress Defeated',     desc: 'Reduced stress from 7+ down to 5 or below.' },
  { id: 'recovery_master',        emoji: '🔋', label: 'Recovery Master',     desc: 'Recovery stayed at 7+ for 7 consecutive days.' },
  { id: 'true_warrior_rank',      emoji: '🏅', label: 'True Warrior',        desc: 'Reached the True Warrior rank (7,500 XP).' },
  { id: 'body_fat_slayer',        emoji: '🗡️', label: 'Body Fat Slayer',     desc: 'Completed the 30-day Fat Loss Challenge.' },
];

/**
 * The era-1 rate card, used whenever a caller does not supply one.
 *
 * Every XP function takes a `rules` object and defaults to this, which is what
 * makes the versioned engine safe to introduce: an existing call site that has
 * not been updated computes exactly what it computed before, so era-1 archives
 * and in-progress era-1 attempts cannot shift by a single point.
 */
export const ERA1_RULES = dayRules({ xpEconomyVersion: 1 });

// ─── High-value task IDs ─────────────────────────────────────────────────────

/**
 * The task ids era 1 priced above the rest. Defined in `src/data/xpEconomy.js`
 * and re-exported here so existing imports keep working.
 */
export const HIGH_VALUE_TASK_IDS = ECONOMY_HIGH_VALUE_IDS;

// ─── Keystone habits & per-task XP ───────────────────────────────────────────
// Newer challenge templates weight tasks unequally: each task can carry an
// explicit `xp` value and a `keystone` tier (1–3 stars). Keystone habits earn
// significantly more XP, are pinned/highlighted in the UI, and are prioritized
// in reminders. Legacy tasks without these fields fall back to the flat
// high-value scheme so existing challenges are unaffected.

/**
 * XP a single task is worth when completed.
 *
 * Era 2 prices every task explicitly when the attempt starts, so the flat
 * 10/15 fallback is era-1 only. Keeping it alive for era 2 would silently
 * reintroduce the two-scheme problem the budget model exists to remove: a task
 * added later without an `xp` would land outside its challenge's budget.
 */
export function getTaskXP(task, rules = ERA1_RULES) {
  if (task && typeof task.xp === 'number') return task.xp;
  if (!rules?.legacyTaskFallback) return 0;
  return HIGH_VALUE_TASK_IDS.has(task?.id) ? 15 : 10;
}

/** Keystone tier: 3 (⭐⭐⭐) / 2 (⭐⭐) / 1 (⭐) / 0 (not a keystone). */
export function getTaskKeystone(task) {
  return task && typeof task.keystone === 'number' ? task.keystone : 0;
}

export function isKeystone(task) {
  return getTaskKeystone(task) > 0;
}

/**
 * The tasks that count toward KEYSTONE ADHERENCE for a task list.
 *
 * Stars (`keystone: 1|2|3`) express display importance and drive ordering. Most
 * templates treat every starred task as a keystone habit, which is the legacy
 * behaviour kept here. A template can instead designate its keystone habits
 * explicitly with `keystoneHabit: true` — used by Fat Loss, where ⭐ and ⭐⭐
 * mark supporting/important tasks but only the two ⭐⭐⭐ habits (protein and
 * whole-food nutrition) are true keystones.
 *
 * The designation lives on the task snapshot, so an attempt's archive keeps the
 * rule that applied when it ran.
 */
export function keystoneHabitsOf(tasks) {
  const list = tasks || [];
  const designated = list.filter(t => t?.keystoneHabit === true);
  return designated.length ? designated : list.filter(isKeystone);
}

export function keystoneStars(tier) {
  return '⭐'.repeat(Math.max(0, Math.min(3, tier || 0)));
}

/** XP lost for missing a task (kept modest — the app never punishes harshly). */
function taskMissPenalty(task, rules = ERA1_RULES) {
  const rate = rules.taskMissRate ?? 0.25;
  const cap = rules.taskMissFlatCap ?? 12;
  if (task && typeof task.xp === 'number') return Math.round(Math.min(task.xp * rate, cap));
  if (!rules?.legacyTaskFallback) return 0;
  return HIGH_VALUE_TASK_IDS.has(task?.id) ? 10 : 5;
}

/**
 * Tasks sorted for display: keystones first (highest tier first), then the
 * rest in their existing order. Stable within each group.
 */
export function sortTasksByKeystone(tasks) {
  return [...(tasks || [])]
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (getTaskKeystone(b.t) - getTaskKeystone(a.t)) || (a.i - b.i))
    .map(x => x.t);
}

/** The highest-tier keystone task that is not yet complete today, or null. */
export function topIncompleteKeystone(tasks, dayData) {
  const incomplete = (tasks || []).filter(t => isKeystone(t) && !dayData?.tasks?.[t.id]);
  if (!incomplete.length) return null;
  return incomplete.sort((a, b) => getTaskKeystone(b) - getTaskKeystone(a))[0];
}

// ─── Per-day XP computation ──────────────────────────────────────────────────

export function hasAnyActivity(dayData) {
  if (!dayData) return false;
  const hasTasksDone = Object.values(dayData.tasks || {}).some(Boolean);
  const hasRatings   = (dayData.mood || 0) > 0 || (dayData.energy || 0) > 0 ||
                       (dayData.sleep || 0) > 0 || (dayData.stress || 0) > 0 ||
                       (dayData.recovery || 0) > 0;
  const hasNotes     = (dayData.notes || '').trim().length > 0;
  const hasMWD       = dayData.isMWD && Object.values(dayData.mwdTasks || {}).some(Boolean);
  const hasBonus     = Object.keys(dayData.bonusDone || {}).length > 0;
  return hasTasksDone || hasRatings || hasNotes || hasMWD || hasBonus;
}

/**
 * Bonus XP earned from optional Bonus Missions for a day. Each completed
 * mission stores the XP it awarded in dayData.bonusDone[missionId], so the
 * amount is self-contained per day: awarded once, removed on uncheck, and
 * never double-counted after reopening. Bonus XP is separate from required-task
 * XP and never affects required completion.
 */
export function getBonusXP(dayData) {
  return Object.values(dayData?.bonusDone || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

/** Count of completed Bonus Missions for a day. */
export function getBonusCount(dayData) {
  return Object.keys(dayData?.bonusDone || {}).length;
}

/**
 * Compute XP gained and lost for a single day.
 * Returns { gained, lost } — both non-negative.
 * dayNum > currentDayNum: no XP (future days).
 *
 * Miss penalties are only ever charged for a STRICTLY-PAST day
 * (dayNum < currentRawDay). The current, in-progress day awards earned XP
 * immediately but is never penalised for unchecked tasks — it has not been
 * finalised yet (that happens once the local calendar day ends). `currentRawDay`
 * is the uncapped local day number; it defaults to currentDayNum so callers that
 * only track a single "today" still get correct (penalty-free) current-day XP.
 */
export function computeDayXP(dayData, tasks, profId, dayNum, currentDayNum, penaltiesEnabled, currentRawDay = currentDayNum, rules = ERA1_RULES) {
  if (dayNum > currentDayNum) return { gained: 0, lost: 0 };
  const isPast = dayNum < currentRawDay;

  // Entire day missed — only a finalised (past) day incurs the penalty. An
  // untouched current day stays neutral (nothing missed yet). Era 2 charges a
  // share of the day's own budget, so the cost is proportionate at every
  // difficulty instead of a flat 25 that barely registered against a hard day.
  if (!hasAnyActivity(dayData)) {
    return { gained: 0, lost: (penaltiesEnabled && isPast) ? rules.missedDay : 0 };
  }

  let gained = 0;
  let lost   = 0;
  const mwdDone = getMWDComplete(dayData);
  // Penalty multiplier: 0.3× when MWD was completed (user still showed up)
  const penaltyMult = (mwdDone && penaltiesEnabled) ? (rules.recoveryPenaltyMult ?? 0.3) : 1.0;

  // Task XP. Unchecked tasks only cost XP once the day is finalised (isPast).
  for (const task of tasks) {
    const done = !!dayData.tasks?.[task.id];
    if (done) {
      gained += getTaskXP(task, rules);
    } else if (penaltiesEnabled && isPast) {
      lost += Math.round(taskMissPenalty(task, rules) * penaltyMult);
    }
  }

  // Every required task complete.
  const tasksDone = tasks.filter(t => dayData.tasks?.[t.id]).length;
  if (tasks.length > 0 && tasksDone === tasks.length) gained += rules.perfectDay;

  // Mental training section. Era 2 drops this: in a challenge that requires
  // mental training it paid twice for one action, and in one that does not it
  // awarded XP for work the challenge never asked for.
  if (dayData.mentalTraining?.completed) gained += rules.mentalSection;

  // All five ratings logged. Era 2 drops this too — filling in the Daily Log is
  // already paid as the Daily Log task.
  if ((dayData.mood || 0) > 0 && (dayData.energy || 0) > 0 &&
      (dayData.sleep || 0) > 0 && (dayData.stress || 0) > 0 &&
      (dayData.recovery || 0) > 0) gained += rules.allRatings;

  // Faith reflection.
  if (dayData.faithReflection?.completed) gained += rules.faith;

  // A Minimum Warrior Day. Era 2 treats it as a reduced day rather than a
  // bonus on top, which is what it is.
  if (mwdDone) gained += rules.recoveryDay;

  // Bonus Missions (optional) — never affect required completion, and under
  // era 2 are capped per day so optional XP cannot reorder the difficulty
  // ranking.
  gained += Math.min(getBonusXP(dayData), rules.bonusPerDayCap ?? Infinity);

  // A day can never cost more than its own ceiling.
  lost = Math.min(lost, rules.dayLossCap ?? 80);

  return { gained, lost };
}

// ─── Streak events ───────────────────────────────────────────────────────────

const STREAK_MILESTONES = [
  { days: 3,  bonus: 30 },
  { days: 7,  bonus: 100 },
  { days: 14, bonus: 250 },
  { days: 30, bonus: 750 },
];

/**
 * Scan day history and emit streak bonus/break events.
 * Returns { gained, lost, events: [{ day, type, xp, label }] }
 * Each new streak that hits a milestone earns the bonus (can be earned multiple times).
 * Break penalty (-30) fires once per streak break, only if streak was ≥ 3.
 */
export function computeStreakEvents(allDays, profId, getDayCompletion, dayNum, penaltiesEnabled, currentRawDay = dayNum + 1, rules = ERA1_RULES) {
  const profDays = allDays[profId] || {};
  let gained = 0;
  let lost   = 0;
  const events = [];
  let streak   = 0;
  let hitInStreak = new Set();
  // Era 2 pays a milestone the FIRST time an attempt reaches it and never
  // again, and caps the attempt's total. Era 1 re-armed the whole ladder on
  // every new streak, which made deliberately breaking one worth +920 XP.
  const oncePerAttempt = !!rules.streakOncePerAttempt;
  const ladder = (rules.streakLadder || []).map(m => ({ days: m.days, bonus: m.xp ?? m.bonus }));
  const hitInAttempt = new Set();

  for (let i = 1; i <= dayNum; i++) {
    const pct = getDayCompletion(i, profId);
    if (pct === 100) {
      streak++;
      for (const m of ladder) {
        const alreadyHit = oncePerAttempt ? hitInAttempt.has(m.days) : hitInStreak.has(m.days);
        if (streak === m.days && !alreadyHit) {
          gained += m.bonus;
          hitInStreak.add(m.days);
          hitInAttempt.add(m.days);
          events.push({ day: i, type: 'streak_bonus', xp: m.bonus, label: `${m.days}-day streak bonus` });
        }
      }
    } else {
      // A streak break only costs XP for a finalised (past) day. Today being
      // incomplete does not break — and penalise — a streak before it ends.
      const breakPenalty = rules.streakBreakPenalty ?? 30;
      if (penaltiesEnabled && breakPenalty > 0 && streak >= 3 && i < currentRawDay) {
        lost += breakPenalty;
        events.push({ day: i, type: 'streak_break', xp: -breakPenalty, label: 'Streak broken' });
      }
      streak = 0;
      hitInStreak = new Set();
    }
  }

  // The per-attempt ceiling is what stops a run of short attempts out-earning
  // one long attempt of the same total length.
  const cap = rules.streakCap ?? Infinity;
  if (gained > cap) {
    events.push({ day: dayNum, type: 'streak_cap', xp: cap - gained, label: 'Streak bonus cap' });
    gained = cap;
  }

  return { gained, lost, events };
}

// ─── Comeback bonuses ────────────────────────────────────────────────────────

function computeComebackXP(profiles, profId, xpStartDay, rules = ERA1_RULES) {
  const cfg = rules.economy?.comeback || { start: 20, complete: 100 };
  let gained = 0;
  for (const cb of (profiles[profId]?.comebackHistory || [])) {
    if (!xpStartDay || (cb.startDay >= xpStartDay)) {
      gained += cfg.start;
      if (cb.completed) gained += cfg.complete;
    }
  }
  return gained;
}

// ─── Total XP ────────────────────────────────────────────────────────────────

// ─── Challenge Performance (percentage score) ────────────────────────────────
// The Challenge Score is a whole-number percentage of REQUIRED-task XP only:
//   (required XP earned so far) / (required XP available so far) × 100
// over ELAPSED days. It deliberately excludes bonus missions, the completion
// bonus, rank rewards, and the day-level extras (all-complete/ratings/faith/
// streak/MWD bonuses) — those never move the score. Future days are excluded.
// Minimum Warrior Days are "protected" (excluded from both sides) so a recovery
// day never drags the score.

// The single shared standard-Forge passing threshold. Individual challenges may
// override it (stricter or user-chosen) via meta.passingScore; everything that
// needs the standard default reads this constant rather than hardcoding a number.
export const DEFAULT_PASSING_SCORE = 70;
export const DEFAULT_KEYSTONE_REQUIREMENT = 65;
// The pre-migration standard default. Used only as a fallback when displaying or
// summarizing OLD archives that were completed before a threshold was stored, so
// their historical pass/fail context is preserved (never applied to live scoring).
export const LEGACY_PASSING_SCORE = 75;

export function getPassingConfig(meta) {
  return {
    passingScore: meta?.passingScore ?? DEFAULT_PASSING_SCORE,
    keystoneRequirement: meta?.keystoneRequirement ?? DEFAULT_KEYSTONE_REQUIREMENT,
    completionBonus: meta?.completionBonusXP ?? meta?.rewardXP ?? 0,
  };
}

function scoreDayRequired(dayData, tasks) {
  let earned = 0, available = 0;
  for (const t of tasks) {
    const xp = getTaskXP(t);
    available += xp;
    if (dayData?.tasks?.[t.id]) earned += xp;
  }
  return { earned, available };
}

/**
 * Weighted required-XP Challenge Score. Returns null for open-ended baselines
 * (Forge Daily) or when there is nothing scorable yet.
 *
 * Current-day-neutral rule: `currentRawDay` is the user's uncapped local day
 * number. Every day strictly before it is FINALISED — its full required-XP
 * slate is in the denominator and unchecked tasks count as missed. The current
 * (in-progress) day is NEUTRAL — only COMPLETED tasks add to both the numerator
 * and the denominator, so the score never drops merely because today's tasks
 * are still unchecked. When the day ends and `currentRawDay` advances, that day
 * finalises automatically (this is a pure derived value, so finalisation is
 * idempotent and needs no stored record — it re-derives from the local date
 * every render, correct across reloads, timezones, and DST).
 */
export function computeChallengeScore(allDays, profiles, profId, currentRawDay, lane = LANE.PRIMARY) {
  const prof = profiles[profId];
  const meta = challengeOf(prof, lane);
  const challengeStart = startOf(prof, lane);
  // Weekly Requirements (Fat Loss) add their own earned/available XP on top of
  // the daily-task totals, using the same finalised-vs-current fairness rule.
  const weekly = computeWeeklyRequirements({
    sessions: prof?.weeklySessions,
    meta,
    challengeStart,
    currentRawDay,
  });
  const duration = meta?.durationDays;
  // Per-challenge adherence is a FILTER over the one shared daily task list: a
  // habit both challenges require appears in both lanes' sets, so completing it
  // once counts toward both — while still paying XP only once, because it is a
  // single row. Absent provenance means primary, so a single-challenge profile
  // scores over exactly the same task list it always did.
  const tasks = tasksForLane(prof?.tasks, lane);
  if (!duration || !currentRawDay || tasks.length === 0) return null;
  const profDays = allDays[profId] || {};
  // Support days resolve to the day record through the shared calendar date, so
  // the two challenges can have completely different start dates.
  const recordFor = lane === LANE.SUPPORT
    ? (n) => { const k = recordKeyForLaneDay(prof, LANE.SUPPORT, n); return k == null ? undefined : profDays[k]; }
    : (n) => profDays[n];
  const keystoneTasks = keystoneHabitsOf(tasks);
  const fullDayAvail = tasks.reduce((s, t) => s + getTaskXP(t), 0);

  // Today (in progress) counts completed tasks only; every earlier day is
  // finalised. Once the challenge overruns its duration there is no in-progress
  // day — everything is finalised.
  const inProgressDay = currentRawDay <= duration ? currentRawDay : null;
  const finalizedThrough = Math.min(currentRawDay - 1, duration);

  let earned = 0, available = 0, ksDone = 0, ksTotal = 0;
  let completedDays = 0, missedDays = 0, finalizedDays = 0, mwdDays = 0;

  // ── Finalised (past) days — full slate in the denominator; unchecked = missed.
  // The per-day task list is date-aware: the Cold Exposure Upgrade's Cold Shower
  // is excluded from any day before its activation date, so enabling it mid-
  // challenge never adds a denominator, a miss, or a penalty to earlier days.
  for (let i = 1; i <= finalizedThrough; i++) {
    const d = recordFor(i);
    if (d?.isMWD) { mwdDays++; continue; } // protected — excluded from scoring
    finalizedDays++;
    const dayTasks = requiredTasksForDay(tasks, meta, challengeStart, i);
    const s = scoreDayRequired(d, dayTasks);
    earned += s.earned; available += s.available;
    const doneCount = d ? dayTasks.filter(t => d.tasks?.[t.id]).length : 0;
    if (dayTasks.length && doneCount === dayTasks.length) completedDays++;
    if (!d || doneCount === 0) missedDays++;
    for (const kt of keystoneTasks) { ksTotal++; if (d?.tasks?.[kt.id]) ksDone++; }
  }

  // ── In-progress day (today) — NEUTRAL. Only completed tasks move the score;
  // unchecked tasks are not counted (not yet missed) on either side.
  let todayEvaluated = 0, todayScored = false, hasInProgress = false;
  if (inProgressDay && inProgressDay > finalizedThrough) {
    const d = recordFor(inProgressDay);
    if (d?.isMWD) {
      mwdDays++;
    } else if (d) {
      hasInProgress = true;
      const dayTasks = requiredTasksForDay(tasks, meta, challengeStart, inProgressDay);
      for (const t of dayTasks) {
        if (d.tasks?.[t.id]) { const xp = getTaskXP(t); earned += xp; available += xp; todayEvaluated += xp; }
      }
      // Keystone adherence stays neutral too — today's keystones only count once
      // completed; an unchecked keystone today is not held against the user yet.
      for (const kt of keystoneTasks) { if (d.tasks?.[kt.id]) { ksTotal++; ksDone++; } }
      if (todayEvaluated > 0) todayScored = true;
      const doneCount = dayTasks.filter(t => d.tasks?.[t.id]).length;
      if (dayTasks.length && doneCount === dayTasks.length) completedDays++;
    }
  }

  // Weekly requirement XP joins the same weighted pools. Earned is capped at each
  // week's target inside computeWeeklyRequirements, so this can never exceed 100%.
  earned += weekly.earnedXP;
  available += weekly.availableXP;

  const scoredDays = finalizedDays + (todayScored ? 1 : 0);
  const score = available > 0 ? Math.round((earned / available) * 100) : 0;
  const keystoneAdherence = ksTotal > 0 ? Math.round((ksDone / ksTotal) * 100) : 100;

  // Required XP still to be evaluated before the challenge ends: today's
  // not-yet-completed slate + every full future day (an estimate input only).
  const todayRemaining = hasInProgress ? Math.max(0, fullDayAvail - todayEvaluated) : (inProgressDay ? fullDayAvail : 0);
  const futureDays = inProgressDay ? Math.max(0, duration - inProgressDay) : 0;
  const remainingAvailable = todayRemaining + futureDays * fullDayAvail;
  const elapsed = Math.min(currentRawDay, duration);

  return {
    score, requiredEarned: earned, requiredAvailable: available,
    keystoneAdherence, keystoneCount: keystoneTasks.length,
    completedDays, missedDays, scoredDays, finalizedDays, mwdDays,
    inProgressDay: (inProgressDay && inProgressDay > finalizedThrough) ? inProgressDay : null,
    elapsed, duration, remainingAvailable, fullDayAvail,
    weekly,
    lane,
    challengeName: meta?.name || null,
    hasData: scoredDays > 0 && available > 0,
    // A confirmed score requires at least one finalised day. Before that (the
    // very first day), the score is "still building" rather than a real figure.
    hasConfirmed: finalizedDays > 0,
  };
}

/** A challenge passes when the score AND keystone adherence both meet config. */
export function isChallengePassed(scoreObj, meta) {
  if (!scoreObj) return false;
  const cfg = getPassingConfig(meta);
  return scoreObj.score >= cfg.passingScore && scoreObj.keystoneAdherence >= cfg.keystoneRequirement;
}

export const PERF_STATUS = {
  excellent: { key: 'excellent', label: 'Excellent',       message: 'You are performing well. Keep protecting your Keystone Habits.' },
  onTrack:   { key: 'onTrack',   label: 'On Track',        message: 'You are currently above the passing score.' },
  atRisk:    { key: 'atRisk',    label: 'At Risk',         message: 'You are close to the passing line. Your next Keystone task matters.' },
  needs:     { key: 'needs',     label: 'Needs Attention', message: 'You are currently below the passing pace. Focus on the highest-value tasks first.' },
};

// Status bands anchored to the challenge's passing score (default 70):
//   Excellent    ≥ 90
//   On Track     ≥ passingScore            (≥ 70 by default)
//   At Risk      ≥ passingScore − 10       (60–69 by default)
//   Needs Attn.  below that                (< 60 by default)
// Anchoring to the passing score keeps the bands truthful for stricter
// challenges too (e.g. an 80% challenge shows On Track at ≥ 80, At Risk ≥ 70).
export function getPerformanceStatus(score, passingScore = DEFAULT_PASSING_SCORE) {
  if (score >= 90) return PERF_STATUS.excellent;
  if (score >= passingScore) return PERF_STATUS.onTrack;
  if (score >= passingScore - 10) return PERF_STATUS.atRisk;
  return PERF_STATUS.needs;
}

/**
 * Per-task completion % across finalised (non-MWD) days, plus the in-progress
 * day counted neutrally: a completed task today adds to both done and total; an
 * unchecked task today is skipped so it never drags the task's percentage before
 * the day ends. Mirrors the current-day-neutral rule in computeChallengeScore.
 */
export function computeTaskBreakdown(allDays, profiles, profId, currentRawDay) {
  const prof = profiles[profId];
  const meta = prof?.activeChallenge;
  const duration = meta?.durationDays;
  const tasks = prof?.tasks || [];
  if (!duration || !currentRawDay || !tasks.length) return [];
  const profDays = allDays[profId] || {};
  const cs = prof.challengeStart;
  const inProgressDay = currentRawDay <= duration ? currentRawDay : null;
  const finalizedThrough = Math.min(currentRawDay - 1, duration);
  return tasks.map(t => {
    // Cold Shower only counts across dates on/after its activation date.
    const dateAware = t.id === COLD_SHOWER_TASK_ID;
    let done = 0, total = 0;
    for (let i = 1; i <= finalizedThrough; i++) {
      const d = profDays[i];
      if (d?.isMWD) continue;
      if (dateAware && !isColdExposureRequiredForDate(meta, getDateForDayNumber(cs, i))) continue;
      total++;
      if (d?.tasks?.[t.id]) done++;
    }
    if (inProgressDay && inProgressDay > finalizedThrough) {
      const d = profDays[inProgressDay];
      if (d && !d.isMWD && d.tasks?.[t.id]) { done++; total++; }
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { id: t.id, name: t.name, done, total, pct, keystone: getTaskKeystone(t) };
  });
}

/**
 * Estimated final score assuming remaining days continue at the current rate.
 * ALWAYS an estimate — the UI labels it as such. Also returns the required XP
 * still needed to finish exactly at the passing line.
 */
export function projectFinalScore(scoreObj, meta) {
  if (!scoreObj || !scoreObj.hasData) return null;
  const cfg = getPassingConfig(meta);
  // Required XP still to be evaluated (today's unfinished slate + full future
  // days) comes straight from the score object so the projection never treats
  // an in-progress day as finished at 0%.
  const remainingAvail = scoreObj.remainingAvailable ?? 0;
  const remainingDays = Math.max(0, scoreObj.duration - scoreObj.elapsed);
  // Estimate future performance at the current confirmed rate (neutral — not an
  // assumption that today ends at 0%).
  const rate = scoreObj.requiredAvailable > 0 ? scoreObj.requiredEarned / scoreObj.requiredAvailable : 0;
  const projEarned = scoreObj.requiredEarned + rate * remainingAvail;
  const projAvail = scoreObj.requiredAvailable + remainingAvail;
  const projected = projAvail > 0 ? Math.round((projEarned / projAvail) * 100) : scoreObj.score;
  const needTotal = Math.ceil((cfg.passingScore / 100) * projAvail);
  const needRemaining = Math.max(0, needTotal - scoreObj.requiredEarned);
  return {
    projected,
    willPass: projected >= cfg.passingScore,
    remainingDays,
    remainingAvailable: remainingAvail,
    needRemaining: Math.min(needRemaining, remainingAvail),
    passingScore: cfg.passingScore,
    // Too little confirmed history to project meaningfully (no finalised day yet).
    insufficient: (scoreObj.finalizedDays ?? 0) === 0,
  };
}

// ─── Changes During This Challenge ───────────────────────────────────────────
// The tracked wellbeing metrics and their direction. "higherBetter: false" means
// a LOWER value is an improvement (e.g. stress). New metrics can be added here
// and are picked up everywhere automatically.
export const CHANGE_METRICS = [
  { key: 'mood',          label: 'Mood',           higherBetter: true },
  { key: 'energy',        label: 'Energy',         higherBetter: true },
  { key: 'confidence',    label: 'Confidence',     higherBetter: true },
  { key: 'sleep',         label: 'Sleep',          higherBetter: true },
  { key: 'recovery',      label: 'Recovery',       higherBetter: true },
  { key: 'workoutEffort', label: 'Workout Effort', higherBetter: true },
  { key: 'stress',        label: 'Stress',         higherBetter: false },
];
// Each within-challenge trend window must hold at least this many logged values
// for a metric before the (secondary) trend is reported.
export const CHANGE_MIN_WINDOW = 2;

// Pre-challenge baseline sizing, per metric:
//   ≥ 30 valid pre-challenge values → use the most recent 30
//   14–29                           → use all available
//   7–13                            → use all available, flagged "limited"
//   < 7                             → the metric does not qualify
export const BASELINE_MAX_DAYS = 30;
export const BASELINE_MIN_DAYS = 7;
export const BASELINE_LIMITED_MAX = 13;
// A metric needs at least one valid value inside the challenge to have an average.
export const CHALLENGE_MIN_VALUES = 1;

/** Mean of a numeric list, rounded to one decimal (null when empty). */
function avg1(vals) {
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

/**
 * "Changes During This Challenge" — did this challenge improve the user compared
 * with how they were doing BEFORE it started?
 *
 * BASELINE  = their most recent logged days strictly BEFORE challengeStart,
 *             drawn from all history (archived challenges, Forge Daily days, any
 *             other logs), capped at the most recent BASELINE_MAX_DAYS per metric.
 * CHALLENGE = every valid logged value inside this exact challenge attempt.
 *
 * Both windows are metric-specific and judged independently: a metric with a thin
 * baseline is omitted on its own and never suppresses a metric that qualifies.
 * Values are read through the shared normalizer (readDayMetric), so alias field
 * names are handled and 0/blank is never a rating. Direction is respected (lower
 * is better for stress).
 *
 * Data leakage is impossible by construction: baseline entries must satisfy
 * date < challengeStart, and challenge values come only from this attempt's own
 * day records (days 1..endDayNum), whose dates run challengeStart..challengeEnd.
 *
 * @param challengeDays  the attempt's day records, keyed by day number
 * @param endDayNum      last day of the attempt
 * @param opts.challengeStart  'YYYY-MM-DD' — the attempt's first day
 * @param opts.historyEntries  [{ date, data }] across all sources (buildTimeline)
 * @returns { changes, hasBaseline, limited, baselineStart, baselineEnd }
 */
export function computeChallengeChanges(challengeDays, endDayNum, opts = {}) {
  const { challengeStart = null, historyEntries = [] } = opts;

  // ── Pre-challenge history: strictly before the challenge start, oldest→newest.
  const prior = (historyEntries || [])
    .filter(e => e?.date && e?.data && (!challengeStart || e.date < challengeStart))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ── Challenge-period records (this attempt only).
  const challengeRecords = [];
  for (let i = 1; i <= (endDayNum || 0); i++) {
    const d = challengeDays?.[i];
    if (d && dayHasAnyMetric(d)) challengeRecords.push(d);
  }

  const changes = [];
  let hasBaseline = false, limited = false;
  let baselineStart = null, baselineEnd = null;

  for (const { key, label, higherBetter } of CHANGE_METRICS) {
    // Baseline: this metric's valid values before the challenge, most recent
    // BASELINE_MAX_DAYS of them.
    const priorForMetric = prior
      .map(e => ({ date: e.date, v: readDayMetric(e.data, key) }))
      .filter(x => x.v != null);
    const used = priorForMetric.slice(-BASELINE_MAX_DAYS);
    if (used.length < BASELINE_MIN_DAYS) continue; // not enough pre-challenge data
    hasBaseline = true;
    const isLimited = used.length <= BASELINE_LIMITED_MAX;
    if (isLimited) limited = true;
    if (!baselineStart || used[0].date < baselineStart) baselineStart = used[0].date;
    const lastDate = used[used.length - 1].date;
    if (!baselineEnd || lastDate > baselineEnd) baselineEnd = lastDate;

    // Challenge average: every valid value inside the attempt.
    const challengeVals = challengeRecords.map(d => readDayMetric(d, key)).filter(v => v != null);
    if (challengeVals.length < CHALLENGE_MIN_VALUES) continue;

    const from = avg1(used.map(x => x.v));
    const to = avg1(challengeVals);
    // Delta derives from the displayed (rounded) values so "from → to" and
    // "by X" are always arithmetically consistent.
    const deltaRounded = Math.round((to - from) * 10) / 10;
    changes.push({
      key, label, higherBetter, from, to,
      delta: Math.abs(deltaRounded),
      changed: deltaRounded !== 0,
      improved: higherBetter ? deltaRounded > 0 : deltaRounded < 0,
      baselineCount: used.length,
      challengeCount: challengeVals.length,
      limitedBaseline: isLimited,
    });
  }

  return { changes, hasBaseline, limited, baselineStart, baselineEnd };
}

/**
 * "Within-Challenge Trend" — the SECONDARY view: first half vs second half of the
 * logged challenge days. It measures momentum inside the challenge and is never
 * the primary result (that is baseline-vs-challenge above). Logged days are split
 * into two non-overlapping halves, dropping the middle day when the count is odd,
 * and a metric is reported only when both halves hold at least CHANGE_MIN_WINDOW
 * values.
 */
export function computeWithinChallengeTrend(challengeDays, endDayNum) {
  const logged = [];
  for (let i = 1; i <= (endDayNum || 0); i++) {
    const d = challengeDays?.[i];
    if (d && dayHasAnyMetric(d)) logged.push(d);
  }
  const n = logged.length;
  const half = Math.floor(n / 2);
  if (half < 1) return [];
  const firstWin = logged.slice(0, half);
  const secondWin = logged.slice(n - half);
  const windowVals = (arr, key) => arr.map(d => readDayMetric(d, key)).filter(v => v != null);
  const out = [];
  for (const { key, label, higherBetter } of CHANGE_METRICS) {
    const a = windowVals(firstWin, key), b = windowVals(secondWin, key);
    if (a.length < CHANGE_MIN_WINDOW || b.length < CHANGE_MIN_WINDOW) continue;
    const first = avg1(a), second = avg1(b);
    const deltaRounded = Math.round((second - first) * 10) / 10;
    out.push({
      key, label, higherBetter, first, second,
      delta: Math.abs(deltaRounded),
      changed: deltaRounded !== 0,
      improved: higherBetter ? deltaRounded > 0 : deltaRounded < 0,
      firstCount: a.length, secondCount: b.length,
    });
  }
  return out;
}

/**
 * Compute total XP for a profile.
 * Returns { total, rawTotal, gained, lost } — total is max(0, rawTotal + xpOffset).
 */
export function computeTotalXP(allDays, profiles, profId, getDayCompletion, dayNum, currentDayNum) {
  // A SCHEDULED attempt has no challenge days yet, so no XP can exist — neither
  // earned (no farming a Day 1 that has not arrived) nor lost (no miss
  // penalties, no streak penalties, no weekly-requirement shortfalls).
  if (isScheduled(profiles[profId])) return { total: 0, rawTotal: 0, gained: 0, lost: 0 };
  const profDays       = allDays[profId] || {};
  const tasks          = profiles[profId]?.tasks || [];
  const penaltiesOn    = profiles[profId]?.xpPenalties !== false;
  const xpStartDay     = profiles[profId]?.xpStartDay ?? 1;
  const xpOffset       = profiles[profId]?.xpOffset ?? 0;
  // Uncapped local day — the boundary between finalised past days (which can
  // incur miss penalties) and the neutral, penalty-free current day.
  const rawDay         = getDayNumberFromStart(profiles[profId]?.challengeStart) ?? currentDayNum ?? dayNum;
  const meta           = profiles[profId]?.activeChallenge;
  const challengeStart = profiles[profId]?.challengeStart;
  // The attempt's own rate card. Resolved from the version stamped on the
  // descriptor, so an era-1 attempt keeps era-1 rates for its whole life and
  // an archive recomputes under the rules it ran under.
  const rules          = dayRules(meta);

  let totalGained = 0;
  let totalLost   = 0;

  // Day-level XP (only days within the active range). Each day is evaluated with
  // its DATE-AWARE task list, so the Cold Exposure Upgrade only earns/penalises
  // XP on and after its activation date — never on earlier days.
  for (let i = xpStartDay; i <= dayNum; i++) {
    const dayTasks = requiredTasksForDay(tasks, meta, challengeStart, i);
    const { gained, lost } = computeDayXP(profDays[i], dayTasks, profId, i, currentDayNum, penaltiesOn, rawDay, rules);
    totalGained += gained;
    totalLost   += lost;
  }

  // Streak bonuses (computed from xpStartDay onward)
  const { gained: sG, lost: sL } = computeStreakEvents(
    allDays, profId,
    (n, p) => (n >= xpStartDay ? getDayCompletion(n, p) : 0),
    dayNum, penaltiesOn, rawDay, rules
  );
  totalGained += sG;
  totalLost   += sL;

  // Comeback bonuses
  totalGained += computeComebackXP(profiles, profId, xpStartDay, rules);

  // Weekly Requirements (Fat Loss): every logged session awards its XP, and each
  // shortfall unit costs the standard miss penalty ONCE the week is finalised —
  // an unfinished current week is never penalised. Derived from the stored
  // session list, so reloading can neither duplicate XP nor re-apply a penalty.
  const weeklyXP = computeWeeklyRequirements({
    sessions: profiles[profId]?.weeklySessions,
    meta,
    challengeStart,
    currentRawDay: rawDay,
    penaltiesEnabled: penaltiesOn,
  });
  totalGained += weeklyXP.sessionXP;
  totalLost += weeklyXP.missedPenalty;

  // Optional Bonus Mission XP is capped per ATTEMPT as well as per day, so a
  // long challenge cannot accumulate enough optional XP to out-earn a harder
  // one. Each day was already clamped in computeDayXP; this removes any excess
  // above the attempt's ceiling.
  const attemptBonusCap = bonusCapForAttempt(meta);
  if (Number.isFinite(attemptBonusCap)) {
    let bonusTotal = 0;
    for (let i = xpStartDay; i <= dayNum; i++) {
      bonusTotal += Math.min(getBonusXP(profDays[i]), rules.bonusPerDayCap ?? Infinity);
    }
    if (bonusTotal > attemptBonusCap) totalGained -= (bonusTotal - attemptBonusCap);
  }

  // Completion Bonus — awarded ONCE at the final day, and ONLY when the
  // challenge is passed (final Challenge Score ≥ passing score AND keystone
  // adherence ≥ requirement). Failing never removes already-earned task XP;
  // it just withholds this separate bonus. This is a derived value (not a
  // stored increment), so it never duplicates across reloads.
  if (meta?.durationDays && dayNum >= meta.durationDays) {
    const cfg = getPassingConfig(meta);
    if (cfg.completionBonus > 0) {
      const sc = computeChallengeScore(allDays, profiles, profId, rawDay);
      if (isChallengePassed(sc, meta)) totalGained += cfg.completionBonus;
    }
  }

  const rawTotal = totalGained - totalLost;
  const total    = Math.max(0, rawTotal + xpOffset);
  return { total, rawTotal, gained: totalGained, lost: totalLost };
}

/**
 * Lifetime XP = XP banked in archived challenges + everything earned in the
 * current challenge (raw, so "Reset Challenge XP" never lowers it).
 * Only the advanced delete-all-data option can clear it (by clearing archives).
 */
export function computeLifetimeXP(archiveList, currentRawTotal = 0) {
  const archivedXP = (archiveList || []).reduce((s, a) => s + (a.xpEarned || 0), 0);
  return archivedXP + Math.max(0, currentRawTotal);
}

/**
 * XP breakdown for today only — for the "XP gained/lost today" display.
 */
export function computeTodayXP(allDays, profiles, profId, getDayCompletion, dayNum) {
  if (!dayNum) return { gained: 0, lost: 0, streakBonus: 0 };
  const profDays    = allDays[profId] || {};
  const tasks       = profiles[profId]?.tasks || [];
  const penaltiesOn = profiles[profId]?.xpPenalties !== false;
  const dayTasks    = requiredTasksForDay(tasks, profiles[profId]?.activeChallenge, profiles[profId]?.challengeStart, dayNum);

  const { gained, lost } = computeDayXP(profDays[dayNum], dayTasks, profId, dayNum, dayNum, penaltiesOn);

  // Check if today hit a streak milestone
  let streak = 0;
  let streakBonus = 0;
  for (let i = 1; i <= dayNum; i++) {
    if (getDayCompletion(i, profId) === 100) {
      streak++;
      for (const m of STREAK_MILESTONES) {
        if (streak === m.days && i === dayNum) streakBonus += m.bonus;
      }
    } else {
      streak = 0;
    }
  }

  return { gained: gained + streakBonus, lost, streakBonus };
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export function computeBadges(allDays, profiles, profId, getDayCompletion, dayNum) {
  if (!dayNum) return [];
  const profDays = allDays[profId] || {};
  const earned   = new Set();

  // first_task
  for (let i = 1; i <= dayNum; i++) {
    const d = profDays[i];
    if (d && Object.values(d.tasks || {}).some(Boolean)) { earned.add('first_task'); break; }
  }

  // first_perfect_day
  for (let i = 1; i <= dayNum; i++) {
    if (getDayCompletion(i, profId) === 100) { earned.add('first_perfect_day'); break; }
  }

  // streak_3 / _7 / _14 / _30
  let maxStreak = 0, cur = 0;
  for (let i = 1; i <= dayNum; i++) {
    if (getDayCompletion(i, profId) === 100) { cur++; maxStreak = Math.max(maxStreak, cur); }
    else cur = 0;
  }
  if (maxStreak >= 3)  earned.add('streak_3');
  if (maxStreak >= 7)  earned.add('streak_7');
  if (maxStreak >= 14) earned.add('streak_14');
  if (maxStreak >= 30) earned.add('streak_30');

  // returned_after_setback
  let missedRun = 0;
  for (let i = 1; i <= dayNum; i++) {
    const pct   = getDayCompletion(i, profId);
    const mwdOk = getMWDComplete(profDays[i]);
    if (pct < 60 && !mwdOk) { missedRun++; }
    else if (missedRun >= 2) { earned.add('returned_after_setback'); missedRun = 0; }
    else { missedRun = 0; }
  }

  // stress_defeated
  {
    let hadHigh = false;
    for (let i = 1; i <= dayNum; i++) {
      const s = profDays[i]?.stress || 0;
      if (s > 0) {
        if (s >= 7) hadHigh = true;
        else if (hadHigh && s <= 5) { earned.add('stress_defeated'); break; }
      }
    }
  }

  // sleep_rebuilt
  {
    let hadLow = false;
    for (let i = 1; i <= dayNum; i++) {
      const sl = profDays[i]?.sleep || 0;
      if (sl > 0) {
        if (sl < 5) hadLow = true;
        else if (hadLow && sl >= 7) { earned.add('sleep_rebuilt'); break; }
      }
    }
  }

  // recovery_master (7 consecutive days recovery >= 7)
  {
    let recCur = 0;
    for (let i = 1; i <= dayNum; i++) {
      const r = profDays[i]?.recovery || 0;
      if (r >= 7) { if (++recCur >= 7) { earned.add('recovery_master'); break; } }
      else recCur = 0;
    }
  }

  // consistency_reclaimed
  if (dayNum >= 14) {
    const weeks = [];
    for (let w = 0; w * 7 + 1 <= dayNum; w++) {
      const wDays = Array.from({ length: 7 }, (_, j) => w * 7 + j + 1).filter(n => n <= dayNum);
      if (wDays.length >= 5) {
        const avg = wDays.reduce((s, n) => s + getDayCompletion(n, profId), 0) / wDays.length;
        weeks.push(avg);
      }
    }
    // (not in BADGE_DEFS v3, kept for internal use)
    for (let i = 0; i < weeks.length - 1; i++) {
      if (weeks[i] < 60 && weeks[i + 1] >= 80) break;
    }
  }

  // mental_streak (5 consecutive days)
  {
    let mCur = 0;
    for (let i = 1; i <= dayNum; i++) {
      if (profDays[i]?.mentalTraining?.completed) {
        if (++mCur >= 5) { earned.add('mental_streak'); break; }
      } else mCur = 0;
    }
  }

  // comeback_complete
  if ((profiles[profId]?.comebackHistory || []).some(cb => cb.completed)) {
    earned.add('comeback_complete');
  }

  // true_warrior_rank: check if XP ever reached 7,500 (approximate from dayNum count)
  // We'll award it if current total >= 7,500 — caller handles this
  return BADGE_DEFS.filter(b => earned.has(b.id));
}

// ─── Warrior messages ────────────────────────────────────────────────────────

const MSGS_PERFECT  = [
  "You kept your word today.",
  "Discipline won today.",
  "Every task. Every day. That's the standard.",
  "This is how resilience is built.",
  "The goal is becoming harder to break.",
  "Rank is earned through repeated proof.",
];
const MSGS_MWD      = [
  "Minimum still counts when life hits.",
  "A bad day did not beat you.",
  "You showed up. That's the whole thing.",
  "The floor held. Come back stronger tomorrow.",
  "Not perfect. Not quitting either.",
];
const MSGS_COMEBACK = [
  "You returned instead of disappearing.",
  "This is what it looks like to get back up.",
  "The return is the hardest rep.",
  "A setback is not an identity.",
  "Coming back is its own kind of discipline.",
];
const MSGS_STRESS   = [
  "A bad day did not beat you.",
  "You trained through the noise. That's rare.",
  "Difficult days build what easy ones can't.",
];

export function getWarriorMessage({ isMWD = false, isComeback = false, stressHigh = false } = {}) {
  let pool;
  if (isComeback) pool = MSGS_COMEBACK;
  else if (isMWD) pool = MSGS_MWD;
  else if (stressHigh) pool = MSGS_STRESS;
  else pool = MSGS_PERFECT;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Setback detection ───────────────────────────────────────────────────────

export function detectSetback(allDays, profId, getDayCompletion, dayNum) {
  if (!dayNum || dayNum < 2) {
    return { hasSetback: false, incompleteDays: 0, consecutiveMissed: 0, avgCompletion: 0 };
  }
  const profDays = allDays[profId] || {};
  const last7    = Array.from({ length: Math.min(7, dayNum) }, (_, i) => dayNum - i).filter(n => n >= 1);

  const completions = last7.map(n => {
    const mwdOk = getMWDComplete(profDays[n]);
    return mwdOk ? 60 : getDayCompletion(n, profId);
  });

  const incompleteDays = completions.filter(p => p < 60).length;

  let consecutiveMissed = 0;
  for (let i = dayNum; i >= Math.max(1, dayNum - 6); i--) {
    const mwdOk = getMWDComplete(profDays[i]);
    if (!mwdOk && getDayCompletion(i, profId) < 60) consecutiveMissed++;
    else break;
  }

  const avgCompletion = completions.length
    ? Math.round(completions.reduce((s, v) => s + v, 0) / completions.length)
    : 0;

  return { hasSetback: incompleteDays >= 2, incompleteDays, consecutiveMissed, avgCompletion };
}
