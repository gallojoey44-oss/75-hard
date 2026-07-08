export const MWD_TASKS = [
  { id: 'mwd_move',    label: '10 min movement',                icon: '🚶' },
  { id: 'mwd_breathe', label: '2 min breathwork or reflection', icon: '💨' },
  { id: 'mwd_fuel',    label: 'Protein meal or clean food',     icon: '🥩' },
  { id: 'mwd_water',   label: 'Water minimum',                  icon: '💧' },
  { id: 'mwd_learn',   label: '1 page read or 2 min learning',  icon: '📖' },
  { id: 'mwd_wind',    label: 'Sleep wind-down routine',         icon: '🌙' },
];

export const LEVELS = [
  { level: 1, name: 'Initiate',     minXP: 0    },
  { level: 2, name: 'Disciplined',  minXP: 200  },
  { level: 3, name: 'Resilient',    minXP: 500  },
  { level: 4, name: 'Warrior',      minXP: 1000 },
  { level: 5, name: 'True Warrior', minXP: 2000 },
];

export const BADGE_DEFS = [
  { id: 'first_perfect_day',      emoji: '⭐', label: 'First Perfect Day',    desc: 'Completed 100% of tasks for the first time.' },
  { id: 'streak_3',               emoji: '🔥', label: '3-Day Streak',          desc: 'Completed all tasks 3 days in a row.' },
  { id: 'streak_7',               emoji: '🏆', label: '7-Day Warrior',         desc: 'Completed all tasks 7 days in a row.' },
  { id: 'returned_after_setback', emoji: '↩️', label: 'Returned',              desc: 'Came back after 2+ missed days.' },
  { id: 'stress_defeated',        emoji: '🧘', label: 'Stress Defeated',       desc: 'Brought stress from 7+ down to 5 or below.' },
  { id: 'sleep_rebuilt',          emoji: '😴', label: 'Sleep Rebuilt',         desc: 'Improved sleep quality from low to 7+.' },
  { id: 'consistency_reclaimed',  emoji: '📈', label: 'Consistency Reclaimed', desc: 'Went from <60% to 80%+ completion the next week.' },
  { id: 'mental_streak',          emoji: '🧠', label: 'Mind Strong',           desc: '5 consecutive days of mental training.' },
  { id: 'comeback_complete',      emoji: '💪', label: 'Comeback Complete',     desc: 'Finished a 3-day comeback plan.' },
];

export function getMWDComplete(dayData) {
  if (!dayData?.isMWD) return false;
  return MWD_TASKS.every(t => dayData.mwdTasks?.[t.id]);
}

export function getLevelInfo(xp) {
  let current = LEVELS[0];
  let next = LEVELS[1] || null;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const progress = next
    ? Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
    : 100;
  return { current, next, progress, xp };
}

export function computeXP(allDays, profiles, profId) {
  let xp = 0;
  const profDays = allDays[profId] || {};
  const profTasks = profiles[profId]?.tasks || [];

  for (const dayData of Object.values(profDays)) {
    const tasksDone = profTasks.filter(t => dayData.tasks?.[t.id]).length;
    xp += tasksDone * 10;
    if (profTasks.length > 0 && tasksDone === profTasks.length) xp += 50;
    if (dayData.mentalTraining?.completed) xp += 15;
    if (getMWDComplete(dayData)) xp += 25;
    const hasRatings = (dayData.mood > 0) || (dayData.energy > 0) || (dayData.sleep > 0) ||
                       (dayData.stress > 0) || (dayData.recovery > 0);
    const hasNotes   = (dayData.notes || '').trim().length > 5;
    if (hasRatings || hasNotes) xp += 10;
  }

  for (const cb of (profiles[profId]?.comebackHistory || [])) {
    xp += 20;
    if (cb.completed) xp += 100;
  }

  return xp;
}

export function computeBadges(allDays, profiles, profId, getDayCompletion, dayNum) {
  if (!dayNum) return [];
  const profDays = allDays[profId] || {};
  const earned = new Set();

  // first_perfect_day
  for (let i = 1; i <= dayNum; i++) {
    if (getDayCompletion(i, profId) === 100) { earned.add('first_perfect_day'); break; }
  }

  // streak_3 / streak_7
  let maxStreak = 0, cur = 0;
  for (let i = 1; i <= dayNum; i++) {
    if (getDayCompletion(i, profId) === 100) { cur++; maxStreak = Math.max(maxStreak, cur); }
    else cur = 0;
  }
  if (maxStreak >= 3) earned.add('streak_3');
  if (maxStreak >= 7) earned.add('streak_7');

  // returned_after_setback
  let missedRun = 0;
  for (let i = 1; i <= dayNum; i++) {
    const pct = getDayCompletion(i, profId);
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
    for (let i = 0; i < weeks.length - 1; i++) {
      if (weeks[i] < 60 && weeks[i + 1] >= 80) { earned.add('consistency_reclaimed'); break; }
    }
  }

  // mental_streak (5 consecutive days)
  {
    let mentalCur = 0;
    for (let i = 1; i <= dayNum; i++) {
      if (profDays[i]?.mentalTraining?.completed) {
        if (++mentalCur >= 5) { earned.add('mental_streak'); break; }
      } else mentalCur = 0;
    }
  }

  // comeback_complete
  if ((profiles[profId]?.comebackHistory || []).some(cb => cb.completed)) {
    earned.add('comeback_complete');
  }

  return BADGE_DEFS.filter(b => earned.has(b.id));
}

const MSGS_PERFECT = [
  "You kept your word today.",
  "Discipline won today.",
  "Every task. Every day. That's the standard.",
  "This is how resilience is built.",
  "The goal is becoming harder to break.",
];

const MSGS_MWD = [
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
  "Setbacks don't end the story. You do.",
  "Coming back is its own kind of discipline.",
];

const MSGS_STRESS = [
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

export function detectSetback(allDays, profId, getDayCompletion, dayNum) {
  if (!dayNum || dayNum < 2) {
    return { hasSetback: false, incompleteDays: 0, consecutiveMissed: 0, avgCompletion: 0 };
  }
  const profDays = allDays[profId] || {};
  const last7 = Array.from({ length: Math.min(7, dayNum) }, (_, i) => dayNum - i).filter(n => n >= 1);

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
