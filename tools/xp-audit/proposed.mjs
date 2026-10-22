/**
 * XP economy audit — stage 5: the PROPOSED economy, solved and simulated.
 *
 * The proposal is a budget model: difficulty sets a daily XP budget, tasks
 * divide it by weight, and every bonus is a fraction of that budget. Task
 * COUNT therefore stops driving XP, which is the root of most of the current
 * imbalance.
 *
 * This script does not read the app's current rates. It implements the
 * proposal and checks it against the one-year benchmark.
 */

// ─── Proposed, centralized, versioned ───────────────────────────────────────

const ECONOMY = {
  version: 2,
  // Base daily task budget by the challenge's own difficulty rating.
  tiers: { easy: 12, medium: 16, medium_hard: 18, hard: 20, elite: 22 },
  // User-selected mode. Deliberately narrow so a Hard-mode medium challenge
  // cannot out-earn a standard-mode hard one.
  modes: { beginner: 0.85, standard: 1.00, hard: 1.12 },
  // Day-level awards, as a fraction of that day's task budget.
  perfectDayRate: 0.15,
  faithRate: 0.05,
  recoveryDayRate: 0.50,       // replaces the day's task XP, not added to it
  // Completion bonus = rate x budget x duration. Linear in duration, so the
  // bonus is worth the same per day at every length: no short-challenge edge.
  completionRate: 0.20,
  // Once per attempt per milestone (never re-armed by breaking a streak).
  streakLadder: [
    { days: 3, xp: 2 }, { days: 7, xp: 5 }, { days: 14, xp: 8 },
    { days: 30, xp: 15 }, { days: 60, xp: 25 }, { days: 75, xp: 30 },
  ],
  streakBreakPenalty: 0,
  // Optional XP, capped so it cannot reorder the difficulty ranking.
  bonusPerDayRate: 0.10,
  bonusPerAttemptRate: 0.05,
  // Penalties, also budget-relative, so they stay proportionate at every tier.
  missedDayRate: 0.50,
  taskMissRate: 0.25,
  dayLossCapRate: 0.50,
  recoveryPenaltyMult: 0.3,
  comeback: { start: 2, complete: 10 },
  // Task weighting by keystone tier: what splits the budget.
  weights: { 3: 3.0, 2: 2.0, 1: 1.3, 0: 1.0 },
};

const RANKS = [
  ['Initiate', 0], ['Apprentice', 250], ['Disciplined', 750], ['Resilient', 1500],
  ['Warrior', 3000], ['Elite Warrior', 5000], ['True Warrior', 7500], ['Unbreakable', 10000],
];

// ─── Derived helpers ────────────────────────────────────────────────────────

const budget = (tier, mode) => ECONOMY.tiers[tier] * ECONOMY.modes[mode];
const perfectDay = (b) => round1(b * ECONOMY.perfectDayRate);
const completionBonus = (b, days) => Math.round(b * days * ECONOMY.completionRate);
const missedDay = (b) => round1(b * ECONOMY.missedDayRate);
const round1 = (x) => Math.round(x * 10) / 10;

/** Streak XP earned inside ONE attempt of `days` perfect days. */
function streakXP(days) {
  return ECONOMY.streakLadder.filter(m => m.days <= days).reduce((s, m) => s + m.xp, 0);
}

/** Per-task XP: the budget split by keystone weight. Count-independent. */
function taskXP(tasks, b) {
  const tot = tasks.reduce((s, t) => s + ECONOMY.weights[t.keystone ?? 0], 0);
  return tasks.map(t => ({
    ...t,
    xp: Math.round((b * ECONOMY.weights[t.keystone ?? 0] / tot) * 10) / 10,
  }));
}

/**
 * Lifetime XP after `horizon` days of back-to-back attempts at full adherence.
 * Completion bonuses only count for attempts that actually finished.
 */
function project({ tier, mode, duration, horizon, adherence = 1 }) {
  const b = budget(tier, mode);
  const cycles = Math.floor(horizon / duration);
  const tailDays = horizon % duration;
  const activeDays = Math.round(horizon * adherence);
  const missedDays = horizon - activeDays;

  const taskAndPerfect = activeDays * (b + perfectDay(b));
  const bonuses = cycles * completionBonus(b, duration);
  // Perfect adherence keeps one streak per attempt; partial adherence breaks
  // it, so only the early milestones are reached on average.
  const streaks = adherence >= 1
    ? cycles * streakXP(duration) + streakXP(tailDays)
    : Math.round((cycles + 1) * streakXP(Math.min(duration, Math.round(1 / (1 - adherence)))));
  const penalties = missedDays * missedDay(b);

  const gross = taskAndPerfect + bonuses + streaks;
  return { b, cycles, gross, penalties, net: Math.round(gross - penalties), perDay: (gross - penalties) / horizon };
}

const dayToReach = (xp, perDay) => (perDay <= 0 ? Infinity : Math.ceil(xp / perDay));

// ─── Report ─────────────────────────────────────────────────────────────────

const L = [];
const log = (...a) => L.push(a.join(' '));
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);

log('PROPOSED ECONOMY v2 — constants');
log(`  tiers (daily task budget): ${JSON.stringify(ECONOMY.tiers)}`);
log(`  mode multipliers:          ${JSON.stringify(ECONOMY.modes)}`);
log(`  perfect day = ${ECONOMY.perfectDayRate} x budget   completion = ${ECONOMY.completionRate} x budget x days`);
log(`  missed day  = ${ECONOMY.missedDayRate} x budget   task miss  = ${ECONOMY.taskMissRate} x task XP`);
log(`  streak ladder (once per attempt): ${ECONOMY.streakLadder.map(m => `${m.days}d+${m.xp}`).join(' ')}`);
log('');

log('='.repeat(96));
log('BENCHMARK CHECK — 365 days of perfect 75 Hard (Hard tier, standard mode, 75-day cycles)');
const bench = project({ tier: 'hard', mode: 'standard', duration: 75, horizon: 365 });
log(`  daily task budget        : ${bench.b}`);
log(`  perfect-day bonus        : ${perfectDay(bench.b)}`);
log(`  completion bonus / cycle : ${completionBonus(bench.b, 75)}`);
log(`  complete cycles in 365d  : ${bench.cycles} (+${365 % 75} days into the next)`);
log(`  streak XP over the year  : ${bench.cycles * streakXP(75) + streakXP(365 % 75)}`);
log(`  LIFETIME XP AT DAY 365   : ${bench.net}`);
log(`  per day                  : ${bench.perDay.toFixed(2)}`);
log(`  Unbreakable reached on   : day ${dayToReach(10000, bench.perDay)}   <-- target ~365`);
log('');
log('  Rank-by-rank, perfect 75 Hard:');
for (const [name, xp] of RANKS) {
  log(`    ${pad(name, 14)} ${rp(xp, 6)} XP  -> day ${rp(xp === 0 ? 0 : dayToReach(xp, bench.perDay), 4)}`);
}

log('');
log('='.repeat(96));
log('DIFFICULTY ORDERING — does mode ever beat a harder challenge?');
log(pad('tier', 14), pad('beginner', 10), pad('standard', 10), pad('hard', 10));
log('-'.repeat(50));
for (const tier of Object.keys(ECONOMY.tiers)) {
  log(pad(tier, 14),
      pad(budget(tier, 'beginner').toFixed(2), 10),
      pad(budget(tier, 'standard').toFixed(2), 10),
      pad(budget(tier, 'hard').toFixed(2), 10));
}
log('');
const worst = budget('medium', 'hard'), ref = budget('hard', 'standard');
log(`  Hard-mode MEDIUM = ${worst.toFixed(2)}/day vs standard-mode HARD = ${ref.toFixed(2)}/day`);
log(`  ${worst < ref ? 'PASS' : 'FAIL'} — a hard mode never out-earns a genuinely harder challenge`);
const eliteHard = budget('elite', 'hard');
log(`  Hard-mode ELITE = ${eliteHard.toFixed(2)}/day > hard = ${ref.toFixed(2)} (intended: Elite is above Hard)`);

log('');
log('='.repeat(96));
log('COMPLETION BONUS IS DURATION-NEUTRAL');
for (const d of [7, 14, 21, 30, 60, 75, 90]) {
  const b = budget('medium', 'standard');
  log(`  medium/standard ${rp(d, 2)}d: bonus=${rp(completionBonus(b, d), 5)}  per day=${(completionBonus(b, d) / d).toFixed(2)}`);
}
log('  -> constant per-day value: restarting short challenges gains nothing.');

log('');
log('='.repeat(96));
log('REQUIREMENT 9 SIMULATIONS (proposed economy)');
log(pad('scenario', 46), rp('30d', 7), rp('90d', 7), rp('180d', 8), rp('365d', 8), rp('→UNBRK', 8));
log('-'.repeat(96));
const scenarios = [
  ['1. 75 Hard, perfect', { tier: 'hard', mode: 'standard', duration: 75 }],
  ['2. 75 Hard, 90% adherence', { tier: 'hard', mode: 'standard', duration: 75, adherence: 0.9 }],
  ['3. Mental Training, standard', { tier: 'medium', mode: 'standard', duration: 14 }],
  ['4. Mental Training, hard', { tier: 'medium', mode: 'hard', duration: 14 }],
  ['5. Fat Loss, standard 30d', { tier: 'medium', mode: 'standard', duration: 30 }],
  ['6a. LOCK IN standard 14d', { tier: 'medium', mode: 'standard', duration: 14 }],
  ['6b. LOCK IN hard 14d', { tier: 'medium', mode: 'hard', duration: 14 }],
  ['6c. LOCK IN standard 90d', { tier: 'medium', mode: 'standard', duration: 90 }],
  ['8. inconsistent (70% adherence)', { tier: 'medium', mode: 'standard', duration: 30, adherence: 0.7 }],
  ['   Forge Daily only (easy tier)', { tier: 'easy', mode: 'standard', duration: 9999 }],
];
for (const [label, cfg] of scenarios) {
  const at = (h) => project({ ...cfg, horizon: h }).net;
  const p365 = project({ ...cfg, horizon: 365 });
  log(pad(label, 46), rp(at(30), 7), rp(at(90), 7), rp(at(180), 8), rp(at(365), 8),
      rp(dayToReach(10000, p365.perDay), 8));
}

log('');
log('='.repeat(96));
log('WORKED TASK TABLES (budget split by keystone weight — count-independent)');
const examples = {
  '75 Hard (hard/standard)': { tier: 'hard', mode: 'standard', tasks: [
    { id: 'workout', keystone: 3 }, { id: 'diet', keystone: 3 }, { id: 'sleep', keystone: 2 },
    { id: 'water', keystone: 1 }, { id: 'reading', keystone: 1 }, { id: 'photo', keystone: 0 },
    { id: 'mental', keystone: 2 }, { id: 'daily_log', keystone: 1 },
  ] },
  'Mental Training (medium/standard)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'mt_mind', keystone: 3 }, { id: 'mt_reading', keystone: 2 }, { id: 'mt_prayer', keystone: 2 },
    { id: 'mt_gratitude', keystone: 1 }, { id: 'mt_focus', keystone: 1 },
    { id: 'mt_physical', keystone: 0 }, { id: 'daily_log', keystone: 1 },
  ] },
  'LOCK IN (medium/standard)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'li_sleep', keystone: 3 }, { id: 'li_flow', keystone: 3 }, { id: 'li_execute', keystone: 3 },
    { id: 'li_mission', keystone: 2 }, { id: 'li_energy', keystone: 2 }, { id: 'li_attention', keystone: 2 },
    { id: 'li_recovery', keystone: 1 }, { id: 'li_stress', keystone: 1 }, { id: 'daily_log', keystone: 0 },
  ] },
  'Fat Loss (medium/standard)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'fl_protein', keystone: 3 }, { id: 'fl_whole', keystone: 3 }, { id: 'fl_steps', keystone: 2 },
    { id: 'fl_sleep', keystone: 2 }, { id: 'fl_water', keystone: 1 }, { id: 'fl_photo', keystone: 1 },
    { id: 'daily_log', keystone: 1 },
  ] },
};
for (const [name, cfg] of Object.entries(examples)) {
  const b = budget(cfg.tier, cfg.mode);
  const ts = taskXP(cfg.tasks, b);
  log('');
  log(`  ${name} — daily budget ${b.toFixed(2)} across ${ts.length} tasks`);
  for (const t of ts) log(`      ${rp(t.xp.toFixed(1), 5)} xp  k${t.keystone}  ${t.id}`);
  log(`      ${rp(ts.reduce((s, t) => s + t.xp, 0).toFixed(1), 5)} xp  TOTAL (= budget)`);
  log(`      + perfect day ${perfectDay(b)}  → ${(b + perfectDay(b)).toFixed(1)} per perfect day`);
}

console.log(L.join('\n'));
