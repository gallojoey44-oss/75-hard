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

export const RANKS = [
  { rank: 1, name: 'Initiate',      minXP: 0,     desc: 'You began.' },
  { rank: 2, name: 'Apprentice',    minXP: 250,   desc: 'You are learning consistency.' },
  { rank: 3, name: 'Disciplined',   minXP: 750,   desc: 'You keep promises more often.' },
  { rank: 4, name: 'Resilient',     minXP: 1500,  desc: 'You return after setbacks.' },
  { rank: 5, name: 'Warrior',       minXP: 3000,  desc: 'You execute under pressure.' },
  { rank: 6, name: 'Elite Warrior', minXP: 5000,  desc: 'Discipline is becoming identity.' },
  { rank: 7, name: 'True Warrior',  minXP: 7500,  desc: 'You act from principle, not mood.' },
  { rank: 8, name: 'Unbreakable',   minXP: 10000, desc: 'You are hard to derail.' },
];

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

// ─── High-value task IDs ─────────────────────────────────────────────────────

export const HIGH_VALUE_TASK_IDS = new Set([
  'workout', 'gf_workout',
  'sleep_target', 'gf_sleep_target',
  'diet', 'gf_diet',
  'mental', 'gf_mental',
  'mt_mind', 'mt_body', // Mental Training Phase core tasks
]);

// ─── Keystone habits & per-task XP ───────────────────────────────────────────
// Newer challenge templates weight tasks unequally: each task can carry an
// explicit `xp` value and a `keystone` tier (1–3 stars). Keystone habits earn
// significantly more XP, are pinned/highlighted in the UI, and are prioritized
// in reminders. Legacy tasks without these fields fall back to the flat
// high-value scheme so existing challenges are unaffected.

/** XP a single task is worth when completed. */
export function getTaskXP(task) {
  if (task && typeof task.xp === 'number') return task.xp;
  return HIGH_VALUE_TASK_IDS.has(task?.id) ? 15 : 10;
}

/** Keystone tier: 3 (⭐⭐⭐) / 2 (⭐⭐) / 1 (⭐) / 0 (not a keystone). */
export function getTaskKeystone(task) {
  return task && typeof task.keystone === 'number' ? task.keystone : 0;
}

export function isKeystone(task) {
  return getTaskKeystone(task) > 0;
}

export function keystoneStars(tier) {
  return '⭐'.repeat(Math.max(0, Math.min(3, tier || 0)));
}

/** XP lost for missing a task (kept modest — the app never punishes harshly). */
function taskMissPenalty(task) {
  if (task && typeof task.xp === 'number') return Math.round(Math.min(task.xp * 0.25, 12));
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

function hasAnyActivity(dayData) {
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
 */
export function computeDayXP(dayData, tasks, profId, dayNum, currentDayNum, penaltiesEnabled) {
  if (dayNum > currentDayNum) return { gained: 0, lost: 0 };

  // Entire day missed (past day with zero activity)
  if (!hasAnyActivity(dayData)) {
    return { gained: 0, lost: penaltiesEnabled ? 25 : 0 };
  }

  let gained = 0;
  let lost   = 0;
  const mwdDone = getMWDComplete(dayData);
  // Penalty multiplier: 0.3× when MWD was completed (user still showed up)
  const penaltyMult = (mwdDone && penaltiesEnabled) ? 0.3 : 1.0;

  // Task XP — per-task weighting when the task carries an xp value, otherwise
  // the flat high-value scheme. Keystone habits earn significantly more.
  for (const task of tasks) {
    const done = !!dayData.tasks?.[task.id];
    if (done) {
      gained += getTaskXP(task);
    } else if (penaltiesEnabled) {
      lost += Math.round(taskMissPenalty(task) * penaltyMult);
    }
  }

  // All tasks complete bonus (+50)
  const tasksDone = tasks.filter(t => dayData.tasks?.[t.id]).length;
  if (tasks.length > 0 && tasksDone === tasks.length) gained += 50;

  // Mental training section completed (+15, on top of task XP)
  if (dayData.mentalTraining?.completed) gained += 15;

  // All five ratings logged (+10)
  if ((dayData.mood || 0) > 0 && (dayData.energy || 0) > 0 &&
      (dayData.sleep || 0) > 0 && (dayData.stress || 0) > 0 &&
      (dayData.recovery || 0) > 0) gained += 10;

  // Faith reflection (+10)
  if (dayData.faithReflection?.completed) gained += 10;

  // MWD complete (+25)
  if (mwdDone) gained += 25;

  // Bonus Missions (optional) — extra XP that never affects required completion.
  gained += getBonusXP(dayData);

  // Cap per-day loss to 80 XP
  lost = Math.min(lost, 80);

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
export function computeStreakEvents(allDays, profId, getDayCompletion, dayNum, penaltiesEnabled) {
  const profDays = allDays[profId] || {};
  let gained = 0;
  let lost   = 0;
  const events = [];
  let streak   = 0;
  let hitInStreak = new Set();

  for (let i = 1; i <= dayNum; i++) {
    const pct = getDayCompletion(i, profId);
    if (pct === 100) {
      streak++;
      for (const m of STREAK_MILESTONES) {
        if (streak === m.days && !hitInStreak.has(m.days)) {
          gained += m.bonus;
          hitInStreak.add(m.days);
          events.push({ day: i, type: 'streak_bonus', xp: m.bonus, label: `${m.days}-day streak bonus` });
        }
      }
    } else {
      if (penaltiesEnabled && streak >= 3) {
        lost += 30;
        events.push({ day: i, type: 'streak_break', xp: -30, label: 'Streak broken' });
      }
      streak = 0;
      hitInStreak = new Set();
    }
  }

  return { gained, lost, events };
}

// ─── Comeback bonuses ────────────────────────────────────────────────────────

function computeComebackXP(profiles, profId, xpStartDay) {
  let gained = 0;
  for (const cb of (profiles[profId]?.comebackHistory || [])) {
    if (!xpStartDay || (cb.startDay >= xpStartDay)) {
      gained += 20;             // started
      if (cb.completed) gained += 100; // finished
    }
  }
  return gained;
}

// ─── Total XP ────────────────────────────────────────────────────────────────

/**
 * Compute total XP for a profile.
 * Returns { total, rawTotal, gained, lost } — total is max(0, rawTotal + xpOffset).
 */
export function computeTotalXP(allDays, profiles, profId, getDayCompletion, dayNum, currentDayNum) {
  const profDays       = allDays[profId] || {};
  const tasks          = profiles[profId]?.tasks || [];
  const penaltiesOn    = profiles[profId]?.xpPenalties !== false;
  const xpStartDay     = profiles[profId]?.xpStartDay ?? 1;
  const xpOffset       = profiles[profId]?.xpOffset ?? 0;

  let totalGained = 0;
  let totalLost   = 0;

  // Day-level XP (only days within the active range)
  for (let i = xpStartDay; i <= dayNum; i++) {
    const { gained, lost } = computeDayXP(profDays[i], tasks, profId, i, currentDayNum, penaltiesOn);
    totalGained += gained;
    totalLost   += lost;
  }

  // Streak bonuses (computed from xpStartDay onward)
  const { gained: sG, lost: sL } = computeStreakEvents(
    allDays, profId,
    (n, p) => (n >= xpStartDay ? getDayCompletion(n, p) : 0),
    dayNum, penaltiesOn
  );
  totalGained += sG;
  totalLost   += sL;

  // Comeback bonuses
  totalGained += computeComebackXP(profiles, profId, xpStartDay);

  // Challenge completion reward (e.g. Fat Loss Challenge: +500 XP at day 30)
  const meta = profiles[profId]?.activeChallenge;
  if (meta?.rewardXP && meta?.durationDays && dayNum >= meta.durationDays) {
    totalGained += meta.rewardXP;
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

  const { gained, lost } = computeDayXP(profDays[dayNum], tasks, profId, dayNum, dayNum, penaltiesOn);

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
