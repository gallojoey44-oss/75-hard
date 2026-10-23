/**
 * What is the real maximum ratio between a keystone and a minor habit?
 * Derived from the weights, then checked empirically against every challenge.
 */
import { ECONOMY_V2, allocateTaskXP, tierBudget } from '/home/user/75-hard/src/data/xpEconomy.js';

const W = ECONOMY_V2.weights;
const CLAMP = 0.12;   // the within-tier nudge ceiling
console.log('Keystone weights:', JSON.stringify(W));
console.log(`Within-tier nudge clamped to +/-${CLAMP * 100}%`);
console.log('');
console.log('THEORETICAL BOUNDS (before integer rounding)');
console.log('pair      max ratio = (w_hi x 1.12) / (w_lo x 0.88)');
for (const [hi, lo] of [[3,2],[3,1],[3,0],[2,1],[2,0],[1,0]]) {
  const r = (W[hi] * (1 + CLAMP)) / (W[lo] * (1 - CLAMP));
  console.log(`  k${hi}:k${lo}     ${r.toFixed(3)}x`);
}
console.log('');
console.log('The nudge only applies when a tier has MORE THAN ONE task with');
console.log('differing XP; a tier with a single task sits exactly on its weight.');
console.log('Unnudged bounds:');
for (const [hi, lo] of [[3,1],[3,0]]) {
  console.log(`  k${hi}:k${lo}     ${(W[hi] / W[lo]).toFixed(3)}x`);
}

// ── Empirical, across every real challenge ─────────────────────────────────
const REAL = {
  'Mental Training (standard)': [
    { id: 'mt_mind', xp: 100, keystone: 3 }, { id: 'mt_reading', xp: 40, keystone: 2 },
    { id: 'mt_prayer', xp: 40, keystone: 2 }, { id: 'mt_gratitude', xp: 20, keystone: 1 },
    { id: 'mt_focus', xp: 20, keystone: 1 }, { id: 'mt_physical', xp: 30, keystone: 0 },
    { id: 'daily_log', xp: 20, keystone: 0 },
  ],
  'Energy Reset': [
    { id: 'er_sleep', xp: 40, keystone: 3 }, { id: 'er_light', xp: 30, keystone: 3 },
    { id: 'er_nutrition', xp: 30, keystone: 2 }, { id: 'er_steps', xp: 20, keystone: 2 },
    { id: 'er_caffeine', xp: 15, keystone: 2 }, { id: 'er_hydration', xp: 15, keystone: 1 },
    { id: 'er_stress', xp: 12, keystone: 1 }, { id: 'er_winddown', xp: 10, keystone: 1 },
    { id: 'daily_log', xp: 10, keystone: 1 },
  ],
  'Hormone Health': [
    { id: 'hh_sleep', xp: 40, keystone: 3 }, { id: 'hh_whole_food', xp: 35, keystone: 2 },
    { id: 'hh_movement', xp: 25, keystone: 2 }, { id: 'hh_stress', xp: 25, keystone: 1 },
    { id: 'hh_hydration', xp: 10, keystone: 1 }, { id: 'daily_log', xp: 10, keystone: 1 },
  ],
  'LOCK IN': [
    { id: 'li_sleep', xp: 40, keystone: 3 }, { id: 'li_flow', xp: 35, keystone: 3 },
    { id: 'li_execute', xp: 30, keystone: 3 }, { id: 'li_mission', xp: 25, keystone: 2 },
    { id: 'li_energy', xp: 25, keystone: 2 }, { id: 'li_attention', xp: 20, keystone: 2 },
    { id: 'li_recovery', xp: 15, keystone: 1 }, { id: 'li_stress', xp: 12, keystone: 1 },
    { id: 'daily_log', xp: 10, keystone: 0 },
  ],
  'Fat Loss': [
    { id: 'fl_protein', xp: 40, keystone: 3 }, { id: 'fl_whole', xp: 40, keystone: 3 },
    { id: 'fl_steps', xp: 25, keystone: 2 }, { id: 'fl_sleep', xp: 25, keystone: 2 },
    { id: 'fl_water', xp: 15, keystone: 1 }, { id: 'fl_photo', xp: 10, keystone: 1 },
    { id: 'daily_log', xp: 10, keystone: 1 },
  ],
  'Muscle Building': [
    { id: 'mb_protein', xp: 40, keystone: 3 }, { id: 'mb_nutrition', xp: 30, keystone: 2 },
    { id: 'mb_carbs', xp: 30, keystone: 2 }, { id: 'mb_sleep', xp: 25, keystone: 2 },
    { id: 'mb_recovery', xp: 15, keystone: 1 }, { id: 'daily_log', xp: 10, keystone: 1 },
  ],
  'Forge Daily': [
    { id: 'fd_mind', xp: 12, keystone: 1 }, { id: 'fd_sleep', xp: 8, keystone: 0 },
    { id: 'fd_move', xp: 8, keystone: 0 }, { id: 'fd_read', xp: 6, keystone: 0 },
    { id: 'fd_pray', xp: 6, keystone: 0 }, { id: 'fd_grat', xp: 5, keystone: 0 },
    { id: 'fd_water', xp: 5, keystone: 0 }, { id: 'daily_log', xp: 20, keystone: 0 },
  ],
};
const BUDGET = { 'Forge Daily': 120, 'LOCK IN': 180, 'Muscle Building': 180 };
console.log('');
console.log('MEASURED, per challenge');
console.log('challenge                    top  lowest   ratio   tiers');
let worstK1 = 0, worstK0 = 0;
for (const [name, tasks] of Object.entries(REAL)) {
  const b = BUDGET[name] || 160;
  const priced = allocateTaskXP(tasks, b);
  const top = priced.reduce((m, t) => (t.xp > m.xp ? t : m), priced[0]);
  const low = priced.reduce((m, t) => (t.xp < m.xp ? t : m), priced[0]);
  const ratio = top.xp / low.xp;
  console.log(`  ${name.padEnd(27)} ${String(top.xp).padStart(3)}  ${String(low.xp).padStart(5)}   ${ratio.toFixed(2)}x   k${top.keystone}:k${low.keystone}`);
  if (low.keystone === 1) worstK1 = Math.max(worstK1, ratio);
  if (low.keystone === 0) worstK0 = Math.max(worstK0, ratio);
}
console.log('');
console.log(`  widest observed keystone-to-ONE-star  : ${worstK1.toFixed(2)}x`);
console.log(`  widest observed keystone-to-ZERO-star : ${worstK0.toFixed(2)}x`);

// ── Rounding: how much can the integer allocation move a ratio? ───────────
console.log('');
console.log('ROUNDING EFFECT');
console.log('Largest-remainder allocation shifts a task by at most 1 XP, which');
console.log('matters most for the smallest values. Worst case found:');
let maxDrift = 0, where = '';
for (const [name, tasks] of Object.entries(REAL)) {
  const b = BUDGET[name] || 160;
  const priced = allocateTaskXP(tasks, b);
  const weights = tasks.map(t => W[t.keystone ?? 0]);
  // Exact (unrounded) share, for comparison.
  const sums = {}, counts = {};
  for (const t of tasks) { const k = t.keystone ?? 0; sums[k] = (sums[k]||0)+t.xp; counts[k] = (counts[k]||0)+1; }
  const exact = tasks.map((t) => {
    const k = t.keystone ?? 0;
    const mean = sums[k] / counts[k];
    const mult = Math.min(1.12, Math.max(0.88, 1 + 0.3 * (t.xp / mean - 1)));
    return W[k] * mult;
  });
  const tot = exact.reduce((s, x) => s + x, 0);
  for (let i = 0; i < tasks.length; i++) {
    const want = (b * exact[i]) / tot;
    const drift = Math.abs(priced[i].xp - want);
    if (drift > maxDrift) { maxDrift = drift; where = `${name} / ${tasks[i].id}: exact ${want.toFixed(2)} -> ${priced[i].xp}`; }
  }
}
console.log(`  max drift ${maxDrift.toFixed(2)} XP  (${where})`);
