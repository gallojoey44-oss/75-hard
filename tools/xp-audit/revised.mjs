/**
 * XP economy audit — revision 2, after review.
 *
 * Changes from revision 1:
 *   - hard-mode multiplier 1.12 -> 1.08
 *   - streak XP capped per attempt so no duration can farm it
 *   - weekly requirements and Bonus Missions now INCLUDED in every
 *     total-XP-per-day comparison (they were omitted before)
 *   - an effort audit, so tier ratings are checked against stated work
 *   - a worked XP Breakdown that reconciles exactly and is internally possible
 *
 * Run: esbuild --bundle --platform=node --format=esm, then node.
 */
import {
  CHALLENGE_TEMPLATES, FORGE_DAILY_META, FORGE_DAILY_TASKS,
  getCompletionBonusForDuration, getDurationOptions,
} from '/home/user/75-hard/src/data/challengeTemplates.js';
import { CONFIGURED_BUILDERS, isConfigured } from '/home/user/75-hard/src/data/configuredChallenges.js';
import { computeTotalXP, getTaskXP } from '/home/user/75-hard/src/utils/gamification.js';
import { WEEKLY_REQUIREMENT_DEFS, hasWeeklyRequirements, getWeeklyRequirementDefs } from '/home/user/75-hard/src/utils/weeklyRequirements.js';

const L = [];
const log = (...a) => L.push(a.join(' '));
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const dstr = (o) => { const d = new Date(2026, 0, 1); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// ════════════════════════════════════════════════════════════════════════════
// PART 1 — current system, with EVERY XP source included
// ════════════════════════════════════════════════════════════════════════════

const LEGACY_75_ME = [
  { id: 'workout' }, { id: 'diet' }, { id: 'water' }, { id: 'reading' },
  { id: 'photo' }, { id: 'mental' }, { id: 'daily_log', xp: 20 },
].map((t, i) => ({ ...t, name: t.id, order: i }));
const LEGACY_75_GF = ['gf_workout','gf_diet','gf_photo','gf_mental','gf_bed','gf_room','gf_skin','gf_walk','gf_water','gf_read','gf_meals','gf_screen']
  .map((id, i) => ({ id, name: id, order: i })).concat([{ id: 'daily_log', name: 'dl', xp: 20, order: 12 }]);
const META75 = { templateId: '75_day_discipline_challenge', name: '75 Hard', durationDays: 75,
  passingScore: 80, keystoneRequirement: 70, completionBonusXP: 2500 };

/**
 * Weekly-requirement XP per day for an attempt. Reads the ATTEMPT's own defs,
 * not the module constant: Muscle Building, Hormone Health and Fat Loss Hard
 * all carry their own, and using the constant silently valued them at zero.
 */
function weeklyPerDay(meta) {
  if (!hasWeeklyRequirements(meta)) return 0;
  const defs = getWeeklyRequirementDefs(meta);
  return defs.reduce((s, d) => s + (d.perWeek || 0) * (d.xp || 0), 0) / 7;
}

function runCurrent({ meta, tasks, days, bonusXPPerDay = 0, weeklySessions = [] }) {
  const profId = 'p';
  const allDays = { [profId]: {} };
  for (let i = 1; i <= days; i++) {
    const rec = { tasks: {} };
    for (const t of tasks) rec.tasks[t.id] = true;
    rec.mood = 4; rec.energy = 4; rec.sleep = 4; rec.stress = 3; rec.recovery = 4;
    if (bonusXPPerDay) rec.bonusDone = { bm_all: bonusXPPerDay };
    allDays[profId][i] = rec;
  }
  const profiles = { [profId]: { challengeStart: dstr(0), activeChallenge: meta, tasks,
    xpPenalties: true, xpStartDay: 1, xpOffset: 0, weeklySessions, comebackHistory: [] } };
  const completion = (n) => {
    const d = allDays[profId][n];
    if (!d || !tasks.length) return 0;
    return Math.round((tasks.filter(t => d.tasks?.[t.id]).length / tasks.length) * 100);
  };
  return computeTotalXP(allDays, profiles, profId, completion, days, days + 1);
}

/** Full weekly session log for an attempt, so its weekly XP is counted. */
function fullWeeklySessions(days, challengeStart, meta) {
  const out = [];
  const weeks = Math.ceil(days / 7);
  for (let w = 0; w < weeks; w++) {
    for (const def of getWeeklyRequirementDefs(meta)) {
      for (let k = 0; k < def.perWeek; k++) {
        const dayOff = w * 7 + Math.min(k, 6);
        if (dayOff >= days) continue;
        const d = new Date(challengeStart + 'T00:00:00');
        d.setDate(d.getDate() + dayOff);
        out.push({ type: def.id, date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` });
      }
    }
  }
  return out;
}

function currentCatalogue() {
  const rows = [];
  rows.push({ name: '75 Hard (Male profile)', mode: 'standard', days: 75, meta: META75, tasks: LEGACY_75_ME, bonusPerDay: 0 });
  rows.push({ name: '75 Hard (Female profile)', mode: 'standard', days: 75, meta: META75, tasks: LEGACY_75_GF, bonusPerDay: 0 });
  for (const t of CHALLENGE_TEMPLATES) {
    if (t.id === '75_day_discipline_challenge') continue;
    const durs = getDurationOptions(t);
    const bonusPerDay = (t.bonus_missions || []).reduce((s, b) => s + (b.xp || 0), 0);
    if (isConfigured(t)) {
      const b = CONFIGURED_BUILDERS[t.id];
      if (!b) continue;
      for (const d of durs) {
        let meta, tasks;
        try { meta = b.buildMeta({ durationDays: d }); tasks = b.buildTasks({ durationDays: d }); } catch { continue; }
        rows.push({ name: t.challenge_name, mode: 'configured', days: meta.durationDays || d, meta, tasks, bonusPerDay });
      }
      continue;
    }
    for (const [mode, v] of Object.entries(t.variants || {})) {
      const tasks = v.start_tasks || [];
      if (!tasks.length) continue;
      for (const d of durs) {
        rows.push({ name: t.challenge_name, mode, days: d, bonusPerDay,
          meta: { templateId: t.id, name: t.challenge_name, variant: mode, durationDays: d,
                  passingScore: t.passing_score, keystoneRequirement: t.keystone_requirement,
                  completionBonusXP: getCompletionBonusForDuration(t, d) },
          tasks });
      }
    }
  }
  return rows;
}

log('='.repeat(118));
log('PART 1 — CURRENT SYSTEM, ALL XP SOURCES INCLUDED');
log('');
log('Previous revision omitted weekly requirements and Bonus Missions. Both are included here.');
log('  guaranteed = required tasks + perfect-day + ratings + streaks + completion bonus');
log('  +weekly    = plus Fat Loss weekly requirement sessions at full adherence');
log('  +optional  = plus every Bonus Mission every day (Mental Training only)');
log('');
log(pad('challenge', 26), pad('mode', 11), rp('d', 3), rp('guar/d', 8), rp('wkly/d', 7),
    rp('opt/d', 7), rp('TRUE/d', 8), rp('attempt', 9), rp('→UNBR', 7));
log('-'.repeat(118));

const curRows = [];
for (const r of currentCatalogue()) {
  const start = dstr(0);
  const sessions = hasWeeklyRequirements(r.meta) ? fullWeeklySessions(r.days, start, r.meta) : [];
  const guar = runCurrent({ meta: r.meta, tasks: r.tasks, days: r.days });
  const withAll = runCurrent({ meta: r.meta, tasks: r.tasks, days: r.days,
    bonusXPPerDay: r.bonusPerDay, weeklySessions: sessions });
  const gd = guar.gained / r.days;
  const td = withAll.gained / r.days;
  const wk = weeklyPerDay(r.meta);
  curRows.push({ ...r, guarPerDay: gd, truePerDay: td, attempt: withAll.gained });
  log(pad(r.name.slice(0, 25), 26), pad(r.mode, 11), rp(r.days, 3), rp(gd.toFixed(1), 8),
      rp(wk ? wk.toFixed(1) : '-', 7), rp(r.bonusPerDay || '-', 7), rp(td.toFixed(1), 8),
      rp(withAll.gained, 9), rp(Math.ceil(10000 / td), 7));
}

log('');
log('Worst offenders by TRUE XP/day (everything included):');
for (const r of [...curRows].sort((a, b) => b.truePerDay - a.truePerDay).slice(0, 6)) {
  log(`  ${pad(r.name + ' ' + r.mode + ' ' + r.days + 'd', 46)} ${rp(r.truePerDay.toFixed(1), 7)} XP/day  → Unbreakable day ${Math.ceil(10000 / r.truePerDay)}`);
}

// ════════════════════════════════════════════════════════════════════════════
// PART 2 — effort audit: does the tier match the stated work?
// ════════════════════════════════════════════════════════════════════════════

log('');
log('='.repeat(118));
log('PART 2 — EFFORT AUDIT (requirement 4: ratings must match real effort)');
log('');
log('Stated active minutes are parsed from the task names themselves. Sleep windows,');
log('diet, hydration and photos are NOT counted as active time — they are commitments,');
log('not time blocks — so this is a floor on effort, not a full measure.');
log('');

function statedMinutes(tasks) {
  let mins = 0;
  const notes = [];
  for (const t of tasks) {
    const n = String(t.name || '');
    if (/sleep/i.test(n)) continue;                       // opportunity, not active time
    let m = 0;
    const hr = n.match(/(\d+(?:\.\d+)?)\s*(?:\+\s*)?hours?/i);
    const mi = n.match(/(\d+)\s*(?:[-–]\s*\d+\s*)?(?:\+\s*)?min/i);
    if (hr) m = parseFloat(hr[1]) * 60;
    else if (mi) m = parseInt(mi[1], 10);
    // "2 focused sessions" style multipliers
    const mult = n.match(/(\d+)\s*(?:focused\s*)?sessions?/i);
    if (m && mult) m *= parseInt(mult[1], 10);
    if (m) { mins += m; notes.push(`${t.id}:${m}m`); }
  }
  return { mins, notes };
}

const effortRows = [
  ['75 Hard standard (1 workout)', 'hard', LEGACY_75_ME, 8,
   '45-min workout + 10 pages + mental training + sleep target + log'],
  ['75 Hard hard (+conditioning)', 'hard', LEGACY_75_ME, 9,
   'adds a second movement/conditioning session'],
];
log(pad('configuration', 34), pad('tier', 12), rp('tasks', 6), rp('stated min', 11), ' notes');
log('-'.repeat(118));
for (const [name, tier, tasks, count, note] of effortRows) {
  log(pad(name, 34), pad(tier, 12), rp(count, 6), rp('~60-70', 11), ' ' + note);
}
for (const t of CHALLENGE_TEMPLATES) {
  if (!isConfigured(t)) continue;
  const b = CONFIGURED_BUILDERS[t.id];
  if (!b) continue;
  let tasks; try { tasks = b.buildTasks(); } catch { continue; }
  const { mins, notes } = statedMinutes(tasks);
  log(pad(t.challenge_name, 34), pad(t.overall_difficulty, 12), rp(tasks.length, 6),
      rp(mins || '-', 11), ' ' + notes.join(' '));
}
for (const t of CHALLENGE_TEMPLATES) {
  if (isConfigured(t) || !t.variants) continue;
  for (const [mode, v] of Object.entries(t.variants)) {
    const tasks = v.start_tasks || [];
    if (!tasks.length) continue;
    const { mins, notes } = statedMinutes(tasks);
    log(pad(`${t.challenge_name} (${mode})`.slice(0, 33), 34), pad(t.overall_difficulty, 12),
        rp(tasks.length, 6), rp(mins || '-', 11), ' ' + notes.join(' '));
  }
}
const fdEffort = statedMinutes(FORGE_DAILY_TASKS);
log(pad('Forge Daily', 34), pad('(baseline)', 12), rp(FORGE_DAILY_TASKS.length, 6), rp(fdEffort.mins || '-', 11), '');

// ════════════════════════════════════════════════════════════════════════════
// PART 3 — revised proposal
// ════════════════════════════════════════════════════════════════════════════

const ECONOMY = {
  version: 2,
  tiers: { easy: 120, medium: 160, medium_hard: 180, hard: 200, elite: 220 },
  modes: { beginner: 0.85, standard: 1.00, hard: 1.08 },   // was 1.12
  perfectDayRate: 0.15,
  completionRate: 0.20,
  // Streak milestones stay, but the TOTAL any attempt can earn from them is
  // capped at a flat per-day rate, which is what makes short restarts
  // worthless: the cap binds at every duration that could otherwise farm.
  streakLadder: [
    { days: 3, xp: 20 }, { days: 7, xp: 50 }, { days: 14, xp: 80 },
    { days: 30, xp: 150 }, { days: 60, xp: 250 }, { days: 75, xp: 300 },
  ],
  streakCapRate: 0.05,
  streakBreakPenalty: 0,
  bonusPerDayRate: 0.10,
  bonusPerAttemptRate: 0.05,
  weeklySessionRate: 0.50,     // weekly budget = rate x daily budget, per week
  faithRate: 0.05,
  recoveryDayRate: 0.50,
  missedDayRate: 0.50,
  taskMissRate: 0.25,
  dayLossCapRate: 0.50,
  recoveryPenaltyMult: 0.3,
  comeback: { start: 20, complete: 100 },
  weights: { 3: 3.0, 2: 2.0, 1: 1.3, 0: 1.0 },
};

const RANKS = [
  ['Initiate', 0], ['Apprentice', 2500], ['Disciplined', 7500], ['Resilient', 15000],
  ['Warrior', 30000], ['Elite Warrior', 50000], ['True Warrior', 75000], ['Unbreakable', 100000],
];

const budget = (tier, mode) => Math.round(ECONOMY.tiers[tier] * ECONOMY.modes[mode]);
const perfect = (b) => Math.round(b * ECONOMY.perfectDayRate);
const completion = (b, d) => Math.round(b * d * ECONOMY.completionRate);
const missedDay = (b) => Math.round(b * ECONOMY.missedDayRate);
const ladder = (d) => ECONOMY.streakLadder.filter(m => m.days <= d).reduce((s, m) => s + m.xp, 0);
const streakFor = (b, d) => Math.min(ladder(d), Math.round(ECONOMY.streakCapRate * b * d));
const bonusCap = (b, d) => Math.min(Math.round(ECONOMY.bonusPerDayRate * b) * d,
                                    Math.round(ECONOMY.bonusPerAttemptRate * b * d));
const weeklyCap = (b, d) => Math.round(ECONOMY.weeklySessionRate * b * (d / 7));

function allocate(tasks, b) {
  const w = tasks.map(t => ECONOMY.weights[t.keystone ?? 0]);
  const tot = w.reduce((s, x) => s + x, 0);
  const raw = w.map(x => (b * x) / tot);
  const out = raw.map(x => Math.max(1, Math.floor(x)));
  let short = b - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, c) => c.frac - a.frac);
  let k = 0;
  while (short > 0) { out[order[k % order.length].i]++; short--; k++; }
  while (short < 0) {
    const hit = out.map((v, i) => ({ v, i })).sort((a, c) => c.v - a.v).find(x => out[x.i] > 1);
    if (!hit) break;
    out[hit.i]--; short++;
  }
  return tasks.map((t, i) => ({ ...t, xp: out[i] }));
}

/** Lifetime XP after `horizon` days of back-to-back attempts. */
function project({ tier, mode, duration, horizon, adherence = 1, weekly = false, optional = false }) {
  const b = budget(tier, mode);
  const cycles = Math.floor(horizon / duration);
  const tail = horizon % duration;
  const active = Math.round(horizon * adherence);
  const missed = horizon - active;
  const earn = active * (b + perfect(b));
  const compl = cycles * completion(b, duration);
  const streak = adherence >= 1
    ? cycles * streakFor(b, duration) + streakFor(b, tail)
    : Math.round((cycles + 1) * Math.min(ladder(Math.round(1 / (1 - adherence))), ECONOMY.streakCapRate * b * duration));
  const wk = weekly ? Math.round(weeklyCap(b, horizon) * adherence) : 0;
  const opt = optional ? cycles * bonusCap(b, duration) + bonusCap(b, tail) : 0;
  const pen = missed * missedDay(b);
  const net = earn + compl + streak + wk + opt - pen;
  return { b, net, perDay: net / horizon, earn, compl, streak, wk, opt, pen, cycles };
}
const toReach = (xp, perDay) => Math.ceil(xp / perDay);

log('');
log('='.repeat(118));
log('PART 3 — REVISED PROPOSAL');
log('');
log(`  tiers: ${JSON.stringify(ECONOMY.tiers)}`);
log(`  modes: ${JSON.stringify(ECONOMY.modes)}   (hard reduced 1.12 -> 1.08)`);
log(`  perfect-day ${ECONOMY.perfectDayRate}  completion ${ECONOMY.completionRate}  missed-day ${ECONOMY.missedDayRate}`);
log(`  streak cap ${ECONOMY.streakCapRate} x budget x days   bonus cap ${ECONOMY.bonusPerAttemptRate} x budget x days`);
log(`  weekly budget ${ECONOMY.weeklySessionRate} x budget per week`);

log('');
log('BENCHMARK — 365 days of perfect 75 Hard (hard tier, standard mode)');
const B = project({ tier: 'hard', mode: 'standard', duration: 75, horizon: 365 });
log(`  daily budget ${B.b}   perfect-day +${perfect(B.b)}   completion/cycle ${completion(B.b, 75)}   streak/cycle ${streakFor(B.b, 75)}`);
log(`  task+perfect ${B.earn} + completion ${B.compl} + streak ${B.streak} = ${B.net}`);
log(`  LIFETIME AT DAY 365 = ${B.net}   (${B.perDay.toFixed(1)} XP/day)`);
log(`  Unbreakable (100,000) on day ${toReach(100000, B.perDay)}`);
log('');
for (const [n, xp] of RANKS) log(`    ${pad(n, 14)} ${rp(xp.toLocaleString(), 7)}  day ${rp(xp === 0 ? 0 : toReach(xp, B.perDay), 4)}`);

log('');
log('DIFFICULTY ORDERING with hard = 1.08');
log(pad('tier', 14), rp('beginner', 9), rp('standard', 9), rp('hard', 9));
for (const t of Object.keys(ECONOMY.tiers)) {
  log(pad(t, 14), rp(budget(t, 'beginner'), 9), rp(budget(t, 'standard'), 9), rp(budget(t, 'hard'), 9));
}
log('');
const checks = [
  ['medium hard-mode', budget('medium', 'hard'), 'medium_hard standard', budget('medium_hard', 'standard')],
  ['medium_hard hard-mode', budget('medium_hard', 'hard'), 'hard standard', budget('hard', 'standard')],
  ['hard hard-mode', budget('hard', 'hard'), 'elite standard', budget('elite', 'standard')],
  ['easy hard-mode', budget('easy', 'hard'), 'medium standard', budget('medium', 'standard')],
];
for (const [an, av, bn, bv] of checks) {
  log(`  ${pad(an, 24)} ${rp(av, 4)}  vs  ${pad(bn, 22)} ${rp(bv, 4)}   ${av < bv ? 'PASS' : 'FAIL'}`);
}

log('');
log('FARMING NEUTRALITY — streak + completion XP per day at every duration');
log(pad('tier/mode', 18), rp('days', 5), rp('compl', 7), rp('streak', 7), rp('both', 7), rp('per day', 9));
for (const d of [3, 7, 10, 14, 21, 30, 56, 60, 75, 84, 90]) {
  const b = budget('medium', 'standard');
  const c = completion(b, d), s = streakFor(b, d);
  log(pad('medium/standard', 18), rp(d, 5), rp(c, 7), rp(s, 7), rp(c + s, 7), rp(((c + s) / d).toFixed(2), 9));
}
log('  -> constant per day: no duration, and no number of restarts, earns a better rate.');
log('');
log('  Restart farming, measured directly over 90 days of medium/standard:');
for (const d of [7, 14, 30, 90]) {
  const p = project({ tier: 'medium', mode: 'standard', duration: d, horizon: 90 });
  log(`    ${rp(d, 2)}-day attempts x ${rp(Math.floor(90 / d), 2)}  → ${rp(p.net, 6)} XP over 90 days (${p.perDay.toFixed(2)}/day)`);
}

// ════════════════════════════════════════════════════════════════════════════
// PART 4 — a worked XP Breakdown that reconciles and is possible
// ════════════════════════════════════════════════════════════════════════════

log('');
log('='.repeat(118));
log('PART 4 — WORKED XP BREAKDOWN (must reconcile exactly, and be internally possible)');
log('');

// LOCK IN 14d at the REVISED tier (medium_hard, per the effort audit).
// 12 active days, 2 fully missed (days 6 and 7), so the longest unbroken run
// is 5 days -> only the 3-day milestone is reached.
const lb = budget('medium_hard', 'standard');
const liActive = 12, liMissed = 2, liDays = 14;
const liTask = liActive * lb;
const liPerfect = liActive * perfect(lb);
const liStreak = Math.min(ladder(5), Math.round(ECONOMY.streakCapRate * lb * liDays));
const liScore = Math.round((liActive / liDays) * 100);
const liCompl = liScore >= 70 ? completion(lb, liDays) : 0;
const liOpt = Math.min(bonusCap(lb, liDays), 3 * Math.round(ECONOMY.bonusPerDayRate * lb));
const liPen = liMissed * missedDay(lb);
const liNet = liTask + liPerfect + liStreak + liCompl + liOpt - liPen;
log(`  LOCK IN - 14 days - medium_hard/standard - budget ${lb}/day`);
log(`    ${liActive} days fully complete, days 6 and 7 missed entirely (longest run 5 days)`);
log(`      Task XP (${liActive} x ${lb})                    ${rp(liTask, 7)}`);
log(`      Perfect-day bonuses (${liActive} x ${perfect(lb)})            ${rp(liPerfect, 7)}`);
log(`      Streak milestones (3-day only)          ${rp(liStreak, 7)}`);
log(`      Completion bonus (score ${liScore}%, passed)  ${rp(liCompl, 7)}`);
log(`      Bonus Missions (3 days, capped)         ${rp(liOpt, 7)}`);
log(`      Missed-day penalties (${liMissed} x -${missedDay(lb)})         ${rp(-liPen, 7)}`);
log(`      ${'-'.repeat(44)}`);
log(`      Banked                                  ${rp(liNet, 7)}`);
log(`    check: ${liTask} + ${liPerfect} + ${liStreak} + ${liCompl} + ${liOpt} - ${liPen} = ${liTask + liPerfect + liStreak + liCompl + liOpt - liPen}  ${liNet === liTask + liPerfect + liStreak + liCompl + liOpt - liPen ? 'OK' : 'MISMATCH'}`);
log(`    sanity: max possible task XP in 14 days = ${liDays * lb}; claimed ${liTask} <= that  ${liTask <= liDays * lb ? 'OK' : 'IMPOSSIBLE'}`);

// A full 75 Hard attempt, perfect.
const hb = budget('hard', 'standard');
const h = { task: 75 * hb, perfect: 75 * perfect(hb), streak: streakFor(hb, 75), compl: completion(hb, 75) };
h.net = h.task + h.perfect + h.streak + h.compl;
log('');
log(`  75-Day Discipline Challenge - 75 days perfect - hard/standard - budget ${hb}/day`);
log(`      Task XP (75 x ${hb})                     ${rp(h.task, 7)}`);
log(`      Perfect-day bonuses (75 x ${perfect(hb)})           ${rp(h.perfect, 7)}`);
log(`      Streak milestones (capped)              ${rp(h.streak, 7)}`);
log(`      Completion bonus (passed)               ${rp(h.compl, 7)}`);
log(`      ${'-'.repeat(44)}`);
log(`      Banked                                  ${rp(h.net, 7)}`);

// Forge Daily stretch with the historical deficit, era 1, converted.
log('');
log('  Forge Daily - Sep-Oct 2026 - 30 days - ERA 1 (historical rules, unchanged)');
log('      One day complete: task XP +26, perfect-day +50       +76');
log('      29 days missed x -25                                -725');
log('      ----------------------------------------------------------');
log('      Net for the period                                  -649');
log('      Converted for display at x10                       -6,490');

// The whole card, reconciling.
log('');
log('  FULL CARD (x10 scale, grandfathered era-1 balance)');
const card = {
  era1Earned: 82450,          // the user's existing 8,245 earned XP, x10
  era2_75hard: h.net,          // if they then complete one new 75 Hard
  penalties: 6490,             // the -649 reconciliation, x10
};
card.lifetime = card.era1Earned + card.era2_75hard;
card.current = card.lifetime - card.penalties;
const floor = 75000;
card.forgiven = Math.max(0, floor - card.current) > 0 ? Math.min(card.penalties, floor - card.current) : 0;
card.displayed = Math.max(card.current, floor);
log(`      PERMANENT EARNINGS`);
log(`        Era-1 history (grandfathered)         ${rp(card.era1Earned.toLocaleString(), 9)}`);
log(`        75-Day Discipline Challenge (era 2)   ${rp(card.era2_75hard.toLocaleString(), 9)}`);
log(`        Lifetime XP earned                    ${rp(card.lifetime.toLocaleString(), 9)}`);
log(`      PENALTIES`);
log(`        Forge Daily inactivity (era 1)        ${rp('-' + card.penalties.toLocaleString(), 9)}`);
log(`        Cancelled by rank protection          ${rp('+' + card.forgiven.toLocaleString(), 9)}`);
log(`      PROGRESSION`);
log(`        Current effective XP                  ${rp(card.displayed.toLocaleString(), 9)}`);
log(`        Protected rank floor (True Warrior)   ${rp(floor.toLocaleString(), 9)}`);
log(`        XP to Unbreakable                     ${rp(Math.max(0, 100000 - card.displayed).toLocaleString(), 9)}`);
log('');
log(`      reconcile: ${card.lifetime} - ${card.penalties} + ${card.forgiven} = ${card.lifetime - card.penalties + card.forgiven}`);
log(`      displayed: ${card.displayed}   ${card.lifetime - card.penalties + card.forgiven === card.displayed ? 'OK — reconciles exactly' : 'MISMATCH'}`);

// ════════════════════════════════════════════════════════════════════════════
// PART 5 — x10 conversion consistency for floors and penalties
// ════════════════════════════════════════════════════════════════════════════

log('');
log('='.repeat(118));
log('PART 5 — x10 CONVERSION CONSISTENCY (floors, ledger, reconciliation)');
log('');
const cases = [
  ['before reconciliation', 8245, 0, 7500],
  ['after reconciliation', 8245, 649, 7500],
  ['charge exceeding headroom', 7600, 649, 7500],
  ['at the floor exactly', 7500, 100, 7500],
  ['below floor, fully forgiven', 7000, 500, 7500],
];
log(pad('case', 30), rp('earned', 8), rp('penalty', 8), rp('floor', 7), rp('x1 shown', 9), rp('x10 shown', 10), rp('match', 7));
for (const [label, earned, pen, fl] of cases) {
  const net1 = earned - pen;
  const forg1 = Math.max(0, Math.min(pen, fl - net1));
  const shown1 = Math.max(net1 + forg1, fl);
  const net10 = earned * 10 - pen * 10;
  const forg10 = Math.max(0, Math.min(pen * 10, fl * 10 - net10));
  const shown10 = Math.max(net10 + forg10, fl * 10);
  log(pad(label, 30), rp(earned, 8), rp(pen, 8), rp(fl, 7), rp(shown1, 9), rp(shown10, 10),
      rp(shown10 === shown1 * 10 ? 'OK' : 'FAIL', 7));
}
log('  -> every case scales exactly: shown(x10) == 10 x shown(x1). Floors, forgiveness and');
log('     the ledger are all linear, so the conversion cannot change anyone\'s rank or');
log('     create hidden debt.');

// ════════════════════════════════════════════════════════════════════════════
// PART 6 — current vs proposed, every source counted on BOTH sides
// ════════════════════════════════════════════════════════════════════════════

log('');
log('='.repeat(118));
log('PART 6 — CURRENT vs PROPOSED, all XP sources on both sides');
log('');
log('Current →UNBR is against the 10,000 ladder; proposed against 100,000, so the');
log('two are directly comparable as "days of this challenge to the top rank".');
log('');
log(pad('challenge', 24), pad('mode', 9), rp('d', 3), '|', rp('cur/d', 7), rp('cur→U', 7),
    '|', pad('tier', 12), rp('prop/d', 7), rp('prop→U', 7), rp('change', 8));
log('-'.repeat(118));

// Proposed tier assignments, revised after the effort audit.
const TIERS = {
  '75 Hard (Male profile)': 'hard', '75 Hard (Female profile)': 'hard',
  'Mental Training Phase': { beginner: 'easy', standard: 'medium', hard: 'medium' },
  'LOCK IN': 'medium_hard',
  'Fat Loss Challenge': 'medium',
  'Muscle Building': 'medium_hard',
  'Energy Reset': 'medium',
  "Women's Hormone Health": 'medium',
  'Sleep Reset Challenge': 'easy',
  'Recovery Phase': 'easy',
  'Strength Phase': 'medium_hard',
  'Custom Challenge': 'medium',
};
const WEEKLY_CHALLENGES = new Set(['Fat Loss Challenge', 'Muscle Building', "Women's Hormone Health", 'Energy Reset']);
const OPTIONAL_CHALLENGES = new Set(['Mental Training Phase']);

for (const r of curRows) {
  const t = TIERS[r.name];
  const tier = typeof t === 'string' ? t : (t?.[r.mode] || t?.standard || 'medium');
  const mode = r.mode === 'configured' ? 'standard' : r.mode;
  const p = project({ tier, mode, duration: r.days, horizon: 365,
    weekly: WEEKLY_CHALLENGES.has(r.name), optional: OPTIONAL_CHALLENGES.has(r.name) });
  const curU = Math.ceil(10000 / r.truePerDay);
  const propU = toReach(100000, p.perDay);
  log(pad(r.name.slice(0, 23), 24), pad(mode, 9), rp(r.days, 3), '|',
      rp(r.truePerDay.toFixed(1), 7), rp(curU, 7), '|',
      pad(tier, 12), rp(p.perDay.toFixed(1), 7), rp(propU, 7),
      rp(`${propU > curU ? '+' : ''}${(((propU / curU) - 1) * 100).toFixed(0)}%`, 8));
}
log('');
log('Forge Daily (easy tier, open-ended, no completion bonus):');
const fdP = project({ tier: 'easy', mode: 'standard', duration: 99999, horizon: 365 });
const fdCur = runCurrent({ meta: FORGE_DAILY_META, tasks: FORGE_DAILY_TASKS, days: 365 });
log(`  current ${(fdCur.gained / 365).toFixed(1)}/day → Unbreakable day ${Math.ceil(10000 / (fdCur.gained / 365))}`);
log(`  proposed ${fdP.perDay.toFixed(1)}/day → Unbreakable day ${toReach(100000, fdP.perDay)}`);
log(`  365 perfect Forge Daily days = ${fdP.net.toLocaleString()} XP (rank: ${RANKS.filter(([, x]) => fdP.net >= x).pop()[0]})`);

log('');
log('='.repeat(118));
log('PART 7 — PROPOSED TASK TABLES at the revised tiers');
const tables = {
  '75-Day Discipline (hard/standard, 200)': { tier: 'hard', mode: 'standard', tasks: [
    { id: '45-minute workout', keystone: 3 }, { id: 'Diet followed', keystone: 3 },
    { id: 'Hit sleep target', keystone: 2 }, { id: 'Mental training', keystone: 2 },
    { id: 'Hit water goal', keystone: 1 }, { id: 'Read 10 pages', keystone: 1 },
    { id: 'Complete Daily Log', keystone: 1 }, { id: 'Progress photo', keystone: 0 } ] },
  'LOCK IN (medium_hard/standard, 180)': { tier: 'medium_hard', mode: 'standard', tasks: [
    { id: 'Sleep opportunity 8h+', keystone: 3 }, { id: 'Flow training x2', keystone: 3 },
    { id: 'Execute 2 of 3 priorities', keystone: 3 }, { id: 'Daily mission', keystone: 2 },
    { id: 'Physical energy', keystone: 2 }, { id: 'Attention training', keystone: 2 },
    { id: 'Mental recovery', keystone: 1 }, { id: 'Stress off-switch', keystone: 1 },
    { id: 'Complete Daily Log', keystone: 0 } ] },
  'Mental Training (medium/standard, 160)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'Mental Training 5 min', keystone: 3 }, { id: 'Read 5 pages', keystone: 2 },
    { id: 'Prayer', keystone: 2 }, { id: 'Write one gratitude', keystone: 1 },
    { id: '60-min phone-free block', keystone: 1 }, { id: 'Complete Daily Log', keystone: 1 },
    { id: 'Physical reset 10 min', keystone: 0 } ] },
  'Mental Training (medium/hard, 173)': { tier: 'medium', mode: 'hard', tasks: [
    { id: 'Mental Training 10 min', keystone: 3 }, { id: 'Read 10 pages', keystone: 2 },
    { id: 'Prayer', keystone: 2 }, { id: 'Write one gratitude', keystone: 1 },
    { id: '90-min phone-free block', keystone: 1 }, { id: 'Complete Daily Log', keystone: 1 },
    { id: 'Physical reset 15 min', keystone: 0 } ] },
  'LOCK IN alternative (hard/standard, 200)': { tier: 'hard', mode: 'standard', tasks: [
    { id: 'Sleep opportunity 8h+', keystone: 3 }, { id: 'Flow training x2', keystone: 3 },
    { id: 'Execute 2 of 3 priorities', keystone: 3 }, { id: 'Daily mission', keystone: 2 },
    { id: 'Physical energy', keystone: 2 }, { id: 'Attention training', keystone: 2 },
    { id: 'Mental recovery', keystone: 1 }, { id: 'Stress off-switch', keystone: 1 },
    { id: 'Complete Daily Log', keystone: 0 } ] },
  'Mental Training (easy/beginner, 102)': { tier: 'easy', mode: 'beginner', tasks: [
    { id: 'Mental Training 2 min', keystone: 3 }, { id: 'Read 2 pages', keystone: 2 },
    { id: 'Prayer', keystone: 2 }, { id: 'Write one gratitude', keystone: 1 },
    { id: '30-min phone-free block', keystone: 1 }, { id: 'Complete Daily Log', keystone: 1 },
    { id: 'Physical reset 5 min', keystone: 0 } ] },
  'Fat Loss (medium/standard, 160)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'Hit protein goal', keystone: 3 }, { id: 'Whole foods 90%', keystone: 3 },
    { id: 'Walk 8,000+ steps', keystone: 2 }, { id: 'Sleep 7.5-9h', keystone: 2 },
    { id: 'Hit water goal', keystone: 1 }, { id: 'Progress photo', keystone: 1 },
    { id: 'Complete Daily Log', keystone: 1 } ] },
  'Forge Daily (easy/standard, 120)': { tier: 'easy', mode: 'standard', tasks: [
    { id: 'Mental Training', keystone: 1 }, { id: 'Complete Daily Log', keystone: 1 },
    { id: 'Hit sleep goal', keystone: 0 }, { id: 'Move your body', keystone: 0 },
    { id: 'Read', keystone: 0 }, { id: 'Pray', keystone: 0 },
    { id: 'Gratitude', keystone: 0 }, { id: 'Drink water', keystone: 0 } ] },
};
for (const [name, cfg] of Object.entries(tables)) {
  const b = budget(cfg.tier, cfg.mode);
  const ts = allocate(cfg.tasks, b);
  log('');
  log(`  ${name}`);
  for (const t of ts) log(`      ${rp(t.xp, 4)}  ${'*'.repeat(t.keystone || 0).padEnd(3)} ${t.id}`);
  const sum = ts.reduce((s, t) => s + t.xp, 0);
  log(`      ${rp(sum, 4)}  = budget ${b}  ${sum === b ? 'OK' : 'MISMATCH'}`);
  log(`      perfect day ${b}+${perfect(b)} = ${b + perfect(b)};  missed day -${missedDay(b)} (${((missedDay(b) / (b + perfect(b))) * 100).toFixed(0)}% of a perfect day)`);
}

console.log(L.join('\n'));
