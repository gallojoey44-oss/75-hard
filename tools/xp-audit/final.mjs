/**
 * XP economy audit — stage 6: the proposal at x10 scale with INTEGER task XP.
 *
 * Identical ratios to stage 5 (so the one-year benchmark is unchanged), but the
 * unit is 10x finer, which is what lets an 8-9 task challenge carry whole-number
 * XP that still differentiates a keystone from a supporting habit.
 */

const ECONOMY = {
  version: 2,
  scale: 10,
  tiers: { easy: 120, medium: 160, medium_hard: 180, hard: 200, elite: 220 },
  modes: { beginner: 0.85, standard: 1.00, hard: 1.12 },
  perfectDayRate: 0.15,
  completionRate: 0.20,
  missedDayRate: 0.50,
  taskMissRate: 0.25,
  streakLadder: [
    { days: 3, xp: 20 }, { days: 7, xp: 50 }, { days: 14, xp: 80 },
    { days: 30, xp: 150 }, { days: 60, xp: 250 }, { days: 75, xp: 300 },
  ],
  bonusPerDayRate: 0.10,
  bonusPerAttemptRate: 0.05,
  faithRate: 0.05,
  recoveryDayRate: 0.50,
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
const streakXP = (d) => ECONOMY.streakLadder.filter(m => m.days <= d).reduce((s, m) => s + m.xp, 0);

/**
 * Integer task XP summing EXACTLY to the budget (largest-remainder method), so
 * a challenge's daily total is its budget regardless of how many tasks it has.
 */
function allocate(tasks, b) {
  const w = tasks.map(t => ECONOMY.weights[t.keystone ?? 0]);
  const tot = w.reduce((s, x) => s + x, 0);
  const raw = w.map(x => (b * x) / tot);
  const base = raw.map(x => Math.max(1, Math.floor(x)));
  let short = b - base.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, c) => c.frac - a.frac);
  const out = [...base];
  let k = 0;
  while (short > 0) { out[order[k % order.length].i]++; short--; k++; }
  while (short < 0) {
    // Trim from the largest first, never below 1.
    const big = out.map((v, i) => ({ v, i })).sort((a, c) => c.v - a.v);
    const hit = big.find(x => out[x.i] > 1);
    if (!hit) break;
    out[hit.i]--; short++;
  }
  return tasks.map((t, i) => ({ ...t, xp: out[i] }));
}

function project({ tier, mode, duration, horizon, adherence = 1 }) {
  const b = budget(tier, mode);
  const cycles = Math.floor(horizon / duration);
  const tail = horizon % duration;
  const active = Math.round(horizon * adherence);
  const missed = horizon - active;
  const earn = active * (b + perfect(b));
  const bonus = cycles * completion(b, duration);
  const streak = adherence >= 1
    ? cycles * streakXP(duration) + streakXP(tail)
    : Math.round((cycles + 1) * streakXP(Math.min(duration, Math.round(1 / (1 - adherence)))));
  const pen = missed * missedDay(b);
  const net = earn + bonus + streak - pen;
  return { b, net, perDay: net / horizon, earn, bonus, streak, pen };
}
const toReach = (xp, perDay) => Math.ceil(xp / perDay);

const L = [];
const log = (...a) => L.push(a.join(' '));
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);

log('BENCHMARK — 365 days perfect 75 Hard, x10 scale, integer XP');
const B = project({ tier: 'hard', mode: 'standard', duration: 75, horizon: 365 });
log(`  daily budget=${B.b}  perfect-day=${perfect(B.b)}  completion/cycle=${completion(B.b, 75)}`);
log(`  task+perfect=${B.earn}  completion=${B.bonus}  streak=${B.streak}  → LIFETIME AT 365 = ${B.net}`);
log(`  per day = ${B.perDay.toFixed(1)}   Unbreakable (100,000) on day ${toReach(100000, B.perDay)}`);
log('');
log('  Rank progression on perfect 75 Hard:');
for (const [n, xp] of RANKS) log(`    ${pad(n, 14)} ${rp(xp.toLocaleString(), 7)}  day ${rp(xp === 0 ? 0 : toReach(xp, B.perDay), 4)}`);

log('');
log('='.repeat(92));
log('INTEGER TASK TABLES — daily budget split by keystone weight, sums exactly');
const ex = {
  '75 Hard — hard/standard (200/day)': { tier: 'hard', mode: 'standard', tasks: [
    { id: '45-min workout', keystone: 3 }, { id: 'Diet followed', keystone: 3 },
    { id: 'Sleep target', keystone: 2 }, { id: 'Mental training', keystone: 2 },
    { id: 'Water goal', keystone: 1 }, { id: '10 pages read', keystone: 1 },
    { id: 'Complete Daily Log', keystone: 1 }, { id: 'Progress photo', keystone: 0 } ] },
  'Mental Training — medium/standard (160/day)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'Mental Training (5 min)', keystone: 3 }, { id: 'Read 5 pages', keystone: 2 },
    { id: 'Prayer', keystone: 2 }, { id: 'Write one gratitude', keystone: 1 },
    { id: '60-min phone-free block', keystone: 1 }, { id: 'Complete Daily Log', keystone: 1 },
    { id: 'Physical reset (10 min)', keystone: 0 } ] },
  'Mental Training — medium/hard (179/day)': { tier: 'medium', mode: 'hard', tasks: [
    { id: 'Mental Training (10 min)', keystone: 3 }, { id: 'Read 10 pages', keystone: 2 },
    { id: 'Prayer', keystone: 2 }, { id: 'Write one gratitude', keystone: 1 },
    { id: '90-min phone-free block', keystone: 1 }, { id: 'Complete Daily Log', keystone: 1 },
    { id: 'Physical reset (15 min)', keystone: 0 } ] },
  'LOCK IN — medium/standard (160/day)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'Sleep opportunity 8h+', keystone: 3 }, { id: 'Flow training x2', keystone: 3 },
    { id: 'Execute 2 of 3 priorities', keystone: 3 }, { id: 'Daily mission', keystone: 2 },
    { id: 'Physical energy', keystone: 2 }, { id: 'Attention training', keystone: 2 },
    { id: 'Mental recovery', keystone: 1 }, { id: 'Stress off-switch', keystone: 1 },
    { id: 'Complete Daily Log', keystone: 0 } ] },
  'Fat Loss — medium/standard (160/day)': { tier: 'medium', mode: 'standard', tasks: [
    { id: 'Hit protein goal', keystone: 3 }, { id: 'Whole foods 90%', keystone: 3 },
    { id: 'Walk 8,000+ steps', keystone: 2 }, { id: 'Sleep 7.5-9h', keystone: 2 },
    { id: 'Hit water goal', keystone: 1 }, { id: 'Progress photo', keystone: 1 },
    { id: 'Complete Daily Log', keystone: 1 } ] },
  'Forge Daily — easy/standard (120/day)': { tier: 'easy', mode: 'standard', tasks: [
    { id: 'Mental Training', keystone: 1 }, { id: 'Hit sleep goal', keystone: 0 },
    { id: 'Move your body', keystone: 0 }, { id: 'Read', keystone: 0 },
    { id: 'Pray', keystone: 0 }, { id: 'Gratitude', keystone: 0 },
    { id: 'Drink water', keystone: 0 }, { id: 'Complete Daily Log', keystone: 1 } ] },
};
for (const [name, cfg] of Object.entries(ex)) {
  const b = budget(cfg.tier, cfg.mode);
  const ts = allocate(cfg.tasks, b);
  log('');
  log(`  ${name}`);
  for (const t of ts) log(`      ${rp(t.xp, 4)} xp  ${'*'.repeat(t.keystone || 0).padEnd(3)} ${t.id}`);
  log(`      ${rp(ts.reduce((s, t) => s + t.xp, 0), 4)} xp  = daily budget`);
  log(`      +${perfect(b)} perfect-day  =>  ${b + perfect(b)} per perfect day`);
  log(`      missed day costs -${missedDay(b)}`);
}

log('');
log('='.repeat(92));
log('ALL CHALLENGES — proposed, every mode');
log(pad('challenge', 24), pad('tier', 12), pad('mode', 9), rp('d', 3), rp('task/d', 7),
    rp('perf', 5), rp('compl', 6), rp('max/day', 8), rp('attempt', 8), rp('XP/day', 7), rp('→UNBR', 7));
log('-'.repeat(110));
const cat = [
  ['75 Hard', 'hard', [75]], ['Mental Training', 'medium', [7, 14, 21]],
  ['LOCK IN', 'medium', [7, 14, 21, 30, 60, 90]], ['Fat Loss', 'medium', [14, 30, 60]],
  ['Muscle Building', 'medium_hard', [30, 60, 90]], ['Energy Reset', 'medium', [7, 10, 14, 30]],
  ['Hormone Health', 'medium', [56, 84]], ['Sleep Reset', 'easy', [7, 14]],
  ['Recovery', 'easy', [7, 14]], ['Strength', 'medium_hard', [21, 30]],
  ['Custom', 'medium', [7, 14, 21, 30, 75]],
];
for (const [name, tier, durs] of cat) {
  for (const mode of ['beginner', 'standard', 'hard']) {
    for (const d of durs) {
      const b = budget(tier, mode);
      const p = project({ tier, mode, duration: d, horizon: 365 });
      const attempt = d * (b + perfect(b)) + completion(b, d) + streakXP(d);
      log(pad(name, 24), pad(tier, 12), pad(mode, 9), rp(d, 3), rp(b, 7), rp(perfect(b), 5),
          rp(completion(b, d), 6), rp(b + perfect(b), 8), rp(attempt, 8),
          rp(p.perDay.toFixed(1), 7), rp(toReach(100000, p.perDay), 7));
    }
  }
}

log('');
log('='.repeat(92));
log('PENALTY PROPORTIONALITY — proposed vs current');
for (const tier of Object.keys(ECONOMY.tiers)) {
  const b = budget(tier, 'standard');
  log(`  ${pad(tier, 12)} perfect day=+${rp(b + perfect(b), 4)}  missed day=-${rp(missedDay(b), 4)}  (${((missedDay(b) / (b + perfect(b))) * 100).toFixed(0)}% of a perfect day)`);
}
log('  current: perfect day=+155, missed day=-25 (16% of a perfect day) — inactivity nearly free');

log('');
log('='.repeat(92));
log("MIGRATION ARITHMETIC — the user's own balance");
const cur = 8245, floor = 7500;
log(`  Current: ${cur} XP, True Warrior, floor ${floor}, verified historical deficit -649`);
log(`  After opting into reconciliation (unchanged, era-1 rules): ${cur - 649} XP`);
log('');
log('  Option A — grandfather (x10 units, balance and thresholds scale together):');
log(`    ${cur} -> ${(cur * 10).toLocaleString()} XP against a ${(100000).toLocaleString()} ladder; True Warrior floor ${(floor * 10).toLocaleString()}`);
log(`    relative position unchanged (${((cur / 10000) * 100).toFixed(1)}% of the ladder either way)`);
log(`    days of new-rate perfect 75 Hard to Unbreakable from there: ${Math.ceil((100000 - cur * 10) / B.perDay)}`);
log('  Option B — era-rescale era-1 earnings to the new rate:');
const factor = 27.4 / 203.4;   // new per-day / current per-day (75 Hard male)
log(`    era-1 conversion factor = ${factor.toFixed(3)} (new 27.4/day vs current 203.4/day)`);
log(`    ${cur} -> ${Math.round(cur * 10 * factor).toLocaleString()} XP, which is rank ${RANKS.filter(([, x]) => Math.round(cur * 10 * factor) >= x).length} (${RANKS.filter(([, x]) => Math.round(cur * 10 * factor) >= x).pop()[0]})`);
log(`    the permanent floor would hold the DISPLAY at ${(floor * 10).toLocaleString()} (True Warrior kept), but the earned figure`);
log('    would sit far below it, so the floor would be doing all the work — not recommended');

console.log(L.join('\n'));
