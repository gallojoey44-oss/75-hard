/**
 * XP economy audit — stage 3: simulate real attempts through the real engine.
 *
 * Nothing here reimplements an XP rule. Every figure comes from
 * computeTotalXP over synthetic day records, so perfect-day bonuses, the
 * REPEATING streak ladder, weekly requirements and the gated completion bonus
 * are all counted exactly as the app counts them.
 */
import {
  CHALLENGE_TEMPLATES, FORGE_DAILY_META, FORGE_DAILY_TASKS,
  getCompletionBonusForDuration, getDurationOptions,
} from '/home/user/75-hard/src/data/challengeTemplates.js';
import { CONFIGURED_BUILDERS, isConfigured } from '/home/user/75-hard/src/data/configuredChallenges.js';
import { computeTotalXP, getTaskXP, RANKS } from '/home/user/75-hard/src/utils/gamification.js';

// ─── Harness ────────────────────────────────────────────────────────────────

const dstr = (off) => {
  const d = new Date(2026, 0, 1);
  d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Run `days` days of a challenge at a given adherence and report the engine's
 * own totals. `extras` controls the optional day-level awards.
 */
function run({ meta, tasks, days, adherence = 1, extras = {}, weeklySessions = [] }) {
  const profId = 'p';
  const allDays = { [profId]: {} };
  // Deterministic miss pattern: every Nth day missed entirely.
  const missEvery = adherence >= 1 ? Infinity : Math.max(2, Math.round(1 / (1 - adherence)));
  for (let i = 1; i <= days; i++) {
    if (i % missEvery === 0) continue;                 // whole day skipped
    const rec = { tasks: {} };
    for (const t of tasks) rec.tasks[t.id] = true;
    if (extras.ratings) { rec.mood = 4; rec.energy = 4; rec.sleep = 4; rec.stress = 3; rec.recovery = 4; }
    if (extras.faith) rec.faithReflection = { completed: true };
    if (extras.mentalTraining) rec.mentalTraining = { completed: true };
    if (extras.bonusXP) rec.bonusDone = { bm_all: extras.bonusXP };
    allDays[profId][i] = rec;
  }
  const profiles = { [profId]: {
    challengeStart: dstr(0),
    activeChallenge: meta,
    tasks,
    xpPenalties: true,
    xpStartDay: 1,
    xpOffset: 0,
    weeklySessions,
    comebackHistory: [],
  } };
  const completion = (n) => {
    const d = allDays[profId][n];
    if (!d || !tasks.length) return 0;
    return Math.round((tasks.filter(t => d.tasks?.[t.id]).length / tasks.length) * 100);
  };
  // dayNum = the capped day reached; rawDay = dayNum + 1 so every simulated day
  // is finalised (otherwise the last day would be treated as in progress).
  return computeTotalXP(allDays, profiles, profId, completion, days, days + 1);
}

/** Days to reach each rank, given a repeating cycle of `len` days worth `xp`. */
function daysToRanks(xpPerCycle, cycleLen) {
  const perDay = xpPerCycle / cycleLen;
  return RANKS.map(r => ({
    rank: r.name,
    minXP: r.minXP,
    days: r.minXP === 0 ? 0 : Math.ceil(r.minXP / perDay),
  }));
}

// ─── Challenge catalogue (runtime task lists) ───────────────────────────────

const LEGACY_75_ME = [
  { id: 'workout', name: '45-minute workout complete', order: 0 },
  { id: 'diet',    name: 'Diet followed',              order: 1 },
  { id: 'water',   name: 'Water goal hit',             order: 2 },
  { id: 'reading', name: '10 pages read',              order: 3 },
  { id: 'photo',   name: 'Progress photo taken',       order: 4 },
  { id: 'mental',  name: 'Mental training complete',   order: 5 },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 20, order: 6 },
];
const LEGACY_75_GF = [
  'gf_workout', 'gf_diet', 'gf_photo', 'gf_mental', 'gf_bed', 'gf_room',
  'gf_skin', 'gf_walk', 'gf_water', 'gf_read', 'gf_meals', 'gf_screen',
].map((id, i) => ({ id, name: id, order: i })).concat([{ id: 'daily_log', name: 'Complete Daily Log', xp: 20, order: 12 }]);

const DISCIPLINE_75_META = {
  templateId: '75_day_discipline_challenge', name: '75-Day Discipline Challenge',
  variant: null, durationDays: 75, passingScore: 80, keystoneRequirement: 70,
  completionBonusXP: 2500,
};

/** Every (challenge, mode, duration) the app can actually run. */
function catalogue() {
  const rows = [];
  // 75 Hard — legacy flat-XP task lists, both profiles.
  rows.push({ key: '75 Hard (profile: Male)', difficulty: 'Hard', mode: 'standard', days: 75,
    meta: DISCIPLINE_75_META, tasks: LEGACY_75_ME, bonus: 2500 });
  rows.push({ key: '75 Hard (profile: Female)', difficulty: 'Hard', mode: 'standard', days: 75,
    meta: DISCIPLINE_75_META, tasks: LEGACY_75_GF, bonus: 2500 });

  for (const t of CHALLENGE_TEMPLATES) {
    if (t.id === '75_day_discipline_challenge') continue;
    const durs = getDurationOptions(t);
    if (isConfigured(t)) {
      const b = CONFIGURED_BUILDERS[t.id];
      if (!b) continue;
      for (const d of durs) {
        let meta, tasks;
        try { meta = b.buildMeta({ durationDays: d }); tasks = b.buildTasks({ durationDays: d }); }
        catch { continue; }
        rows.push({ key: t.challenge_name, difficulty: t.overall_difficulty, mode: 'configured-default',
          days: meta.durationDays || d, meta, tasks, bonus: meta.completionBonusXP ?? getCompletionBonusForDuration(t, d) });
      }
      continue;
    }
    for (const [mode, v] of Object.entries(t.variants || {})) {
      const tasks = v.start_tasks || [];
      if (!tasks.length) continue;                       // descriptive-only
      for (const d of durs) {
        const bonus = getCompletionBonusForDuration(t, d);
        rows.push({ key: t.challenge_name, difficulty: t.overall_difficulty, mode, days: d,
          meta: { templateId: t.id, name: t.challenge_name, variant: mode, durationDays: d,
                  passingScore: t.passing_score, keystoneRequirement: t.keystone_requirement,
                  completionBonusXP: bonus },
          tasks, bonus });
      }
    }
  }
  return rows;
}

// ─── Report ─────────────────────────────────────────────────────────────────

const L = [];
const log = (...a) => L.push(a.join(' '));
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);

log('CURRENT SYSTEM — per challenge/mode/duration, computed by the real engine');
log('');
log(pad('challenge', 30), pad('mode', 12), rp('d', 3), rp('task/d', 7), rp('req+pd', 7),
    rp('bonus', 6), rp('TOTAL', 7), rp('XP/day', 7), rp('→UNBRK', 7));
log('-'.repeat(100));

const rows = catalogue();
const results = [];
for (const r of rows) {
  const taskPerDay = r.tasks.reduce((s, t) => s + getTaskXP(t), 0);
  // Required tasks + perfect-day bonus + ratings (a realistic perfect day:
  // every required habit done and the Daily Log actually filled in).
  const perfect = run({ meta: r.meta, tasks: r.tasks, days: r.days, adherence: 1, extras: { ratings: true } });
  const total = perfect.gained;
  const perDay = total / r.days;
  const toUnbreakable = Math.ceil(10000 / perDay);
  results.push({ ...r, taskPerDay, total, perDay, toUnbreakable, gained: perfect.gained, lost: perfect.lost });
  log(pad(r.key.slice(0, 29), 30), pad(r.mode, 12), rp(r.days, 3), rp(taskPerDay, 7),
      rp(taskPerDay + 50 + 10, 7), rp(r.bonus, 6), rp(total, 7), rp(perDay.toFixed(1), 7), rp(toUnbreakable, 7));
}

log('');
log('Legend: task/d = required-task XP per day. req+pd = plus perfect-day(50) and all-ratings(10).');
log('        TOTAL = engine total for a perfect run INCLUDING repeating streak ladder + completion bonus.');
log('        XP/day = TOTAL / duration. →UNBRK = days of this challenge, repeated, to reach 10,000 XP.');
log('');

// ─── The 365-day benchmark ──────────────────────────────────────────────────
log('='.repeat(100));
log('365-DAY PROJECTION (repeat the same challenge back to back)');
log('');
log(pad('challenge', 30), pad('mode', 12), rp('d', 3), rp('30d', 7), rp('90d', 7), rp('180d', 8), rp('365d', 8));
log('-'.repeat(100));
for (const r of results) {
  const at = (n) => Math.round(r.perDay * n);
  log(pad(r.key.slice(0, 29), 30), pad(r.mode, 12), rp(r.days, 3),
      rp(at(30), 7), rp(at(90), 7), rp(at(180), 8), rp(at(365), 8));
}

// ─── Forge Daily baseline ───────────────────────────────────────────────────
log('');
log('='.repeat(100));
log('FORGE DAILY (open-ended baseline)');
const fd = run({ meta: FORGE_DAILY_META, tasks: FORGE_DAILY_TASKS, days: 365, adherence: 1, extras: { ratings: true } });
log(`  task XP/day = ${FORGE_DAILY_TASKS.reduce((s, t) => s + getTaskXP(t), 0)}`);
log(`  365 perfect days: gained=${fd.gained} lost=${fd.lost} → ${(fd.gained / 365).toFixed(1)} XP/day`);
log(`  days to Unbreakable at that rate: ${Math.ceil(10000 / (fd.gained / 365))}`);

// ─── Streak ladder contribution ─────────────────────────────────────────────
log('');
log('='.repeat(100));
log('STREAK LADDER — how much of a perfect run is streak bonuses');
const probe = (days) => {
  const t = [{ id: 'x', name: 'x', xp: 10 }];
  const meta = { templateId: 'probe', name: 'probe', durationDays: null };
  const r = run({ meta, tasks: t, days, adherence: 1 });
  // one 10xp task + 50 perfect-day = 60/day of non-streak XP
  return { days, total: r.gained, streak: r.gained - days * 60 };
};
for (const d of [30, 60, 90, 180, 365]) {
  const p = probe(d);
  log(`  ${rp(d, 3)} perfect days: total=${rp(p.total, 6)}  of which streak bonuses=${rp(p.streak, 6)}  (${((p.streak / p.total) * 100).toFixed(1)}%)`);
}

console.log(L.join('\n'));
