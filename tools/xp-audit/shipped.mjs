/**
 * Simulations run through the SHIPPED engine.
 *
 * The earlier scripts modelled the proposal standalone. This one drives the
 * code that is actually implemented — stampAttempt, computeTotalXP, the real
 * streak ladder, caps and penalties — so the reported figures are the app's
 * own, not a model's.
 */
import { stampAttempt } from '/home/user/75-hard/src/utils/xpAttempt.js';
import { computeTotalXP } from '/home/user/75-hard/src/utils/gamification.js';
import {
  RANKS, tierBudget, completionBonusFor, repriceWeeklyDefs, dayRules,
} from '/home/user/75-hard/src/data/xpEconomy.js';

const L = [];
const log = (...a) => L.push(a.join(' '));
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const dstr = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const TASKS = {
  '75 Hard': [
    { id: 'workout', name: '45-minute workout', keystone: 3 },
    { id: 'diet', name: 'Diet followed', keystone: 3 },
    { id: 'sleep', name: 'Hit sleep target', keystone: 2 },
    { id: 'mental', name: 'Mental training', keystone: 2 },
    { id: 'water', name: 'Hit water goal', keystone: 1 },
    { id: 'reading', name: 'Read 10 pages', keystone: 1 },
    { id: 'daily_log', name: 'Complete Daily Log', keystone: 1 },
    { id: 'photo', name: 'Progress photo', keystone: 0 },
  ],
  'LOCK IN': [
    { id: 'li_sleep', keystone: 3 }, { id: 'li_flow', keystone: 3 }, { id: 'li_exec', keystone: 3 },
    { id: 'li_mission', keystone: 2 }, { id: 'li_energy', keystone: 2 }, { id: 'li_attn', keystone: 2 },
    { id: 'li_rec', keystone: 1 }, { id: 'li_stress', keystone: 1 }, { id: 'daily_log', keystone: 0 },
  ],
  'Mental Training': [
    { id: 'mt_mind', keystone: 3 }, { id: 'mt_read', keystone: 2 }, { id: 'mt_pray', keystone: 2 },
    { id: 'mt_grat', keystone: 1 }, { id: 'mt_focus', keystone: 1 }, { id: 'daily_log', keystone: 1 },
    { id: 'mt_phys', keystone: 0 },
  ],
  'Fat Loss': [
    { id: 'fl_protein', keystone: 3 }, { id: 'fl_whole', keystone: 3 },
    { id: 'fl_steps', keystone: 2 }, { id: 'fl_sleep', keystone: 2 },
    { id: 'fl_water', keystone: 1 }, { id: 'fl_photo', keystone: 1 },
    { id: 'daily_log', keystone: 1 },
  ],
  'Muscle Building': [
    { id: 'mb_protein', keystone: 3 }, { id: 'mb_nutrition', keystone: 2 },
    { id: 'mb_carbs', keystone: 2 }, { id: 'mb_sleep', keystone: 2 },
    { id: 'mb_recovery', keystone: 1 }, { id: 'daily_log', keystone: 1 },
  ],
  'Energy Reset': [
    { id: 'er_sleep', keystone: 3 }, { id: 'er_light', keystone: 3 },
    { id: 'er_nutrition', keystone: 2 }, { id: 'er_steps', keystone: 2 },
    { id: 'er_caffeine', keystone: 2 }, { id: 'er_hydration', keystone: 1 },
    { id: 'er_stress', keystone: 1 }, { id: 'er_winddown', keystone: 1 },
    { id: 'daily_log', keystone: 1 },
  ],
  'Hormone Health': [
    { id: 'hh_sleep', keystone: 3 }, { id: 'hh_whole', keystone: 2 },
    { id: 'hh_move', keystone: 2 }, { id: 'hh_stress', keystone: 1 },
    { id: 'hh_hydration', keystone: 1 }, { id: 'daily_log', keystone: 1 },
  ],
  'Forge Daily': [
    { id: 'fd_mind', keystone: 1 }, { id: 'daily_log', keystone: 1 },
    { id: 'fd_sleep', keystone: 0 }, { id: 'fd_move', keystone: 0 },
    { id: 'fd_read', keystone: 0 }, { id: 'fd_pray', keystone: 0 },
    { id: 'fd_grat', keystone: 0 }, { id: 'fd_water', keystone: 0 },
  ],
};

const WEEKLY_DEFS = {
  'Fat Loss': [
    { id: 'lifting', perWeek: 3, xp: 25, keystone: 3 },
    { id: 'zone2', perWeek: 2, xp: 20, keystone: 2 },
  ],
  'Muscle Building': [{ id: 'hypertrophy_training', perWeek: 4, xp: 40, keystone: 3 }],
  'Hormone Health': [{ id: 'hh_exercise', perWeek: 3, xp: 25, keystone: 3 }],
};

/**
 * Run `days` of an attempt through the shipped engine.
 * `adherence` < 1 skips every Nth day entirely.
 */
function run({ name, tier, mode, duration, days, adherence = 1, optional = false, weekly = false }) {
  const base = { templateId: name, name, variant: mode, durationDays: duration };
  if (weekly && WEEKLY_DEFS[name]) base.weeklyRequirementDefs = WEEKLY_DEFS[name];
  const { meta, tasks } = stampAttempt({
    meta: base, tasks: TASKS[name], template: { effort_tier: tier },
  });
  const rules = dayRules(meta);
  const profId = 'p';
  const allDays = { [profId]: {} };
  const missEvery = adherence >= 1 ? Infinity : Math.max(2, Math.round(1 / (1 - adherence)));
  for (let i = 1; i <= days; i++) {
    if (i % missEvery === 0) continue;
    const rec = { tasks: Object.fromEntries(tasks.map(t => [t.id, true])) };
    if (optional) rec.bonusDone = { m: 10000 };     // clamped by the engine
    allDays[profId][i] = rec;
  }
  const sessions = [];
  if (weekly && meta.weeklyRequirementDefs) {
    const weeks = Math.ceil(days / 7);
    for (let w = 0; w < weeks; w++) {
      for (const d of meta.weeklyRequirementDefs) {
        for (let k = 0; k < d.perWeek; k++) {
          const x = new Date(dstr(-(days - 1)) + 'T00:00:00');
          x.setDate(x.getDate() + w * 7 + k);
          sessions.push({ type: d.id, date: `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` });
        }
      }
    }
  }
  const profiles = { [profId]: {
    challengeStart: dstr(-(days - 1)), activeChallenge: meta, tasks,
    xpPenalties: true, xpStartDay: 1, xpOffset: 0,
    weeklySessions: sessions, comebackHistory: [],
  } };
  const completion = (n) => {
    const d = allDays[profId][n];
    if (!d || !tasks.length) return 0;
    return Math.round((tasks.filter(t => d.tasks?.[t.id]).length / tasks.length) * 100);
  };
  const r = computeTotalXP(allDays, profiles, profId, completion, days, days);
  return { ...r, meta, tasks, rules, net: r.rawTotal };
}

/** A year of back-to-back attempts, cycle accurate. */
function year({ name, tier, mode, duration, adherence = 1, optional = false, weekly = false, horizon = 365 }) {
  const cycles = Math.floor(horizon / duration);
  const tail = horizon % duration;
  const full = run({ name, tier, mode, duration, days: duration, adherence, optional, weekly });
  const part = tail ? run({ name, tier, mode, duration, days: tail, adherence, optional, weekly }) : { net: 0 };
  const net = cycles * full.net + part.net;
  return { net, perDay: net / horizon, cycle: full.net, full };
}
const toTop = (perDay) => Math.ceil(RANKS[7].minXP / perDay);

log('='.repeat(104));
log('SHIPPED ENGINE — 365-day benchmark');
const b = year({ name: '75 Hard', tier: 'hard', mode: 'standard', duration: 75 });
log(`  one perfect 75-day attempt : ${b.cycle}`);
log(`  365 days                   : ${b.net}  (${b.perDay.toFixed(1)}/day)`);
log(`  Unbreakable (100,000) on   : day ${toTop(b.perDay)}`);
log('');
log('  Rank progression:');
for (const r of RANKS) {
  log(`    ${pad(r.name, 14)} ${rp(r.minXP.toLocaleString(), 7)}  day ${rp(r.minXP === 0 ? 0 : Math.ceil(r.minXP / b.perDay), 4)}`);
}

log('');
log('='.repeat(104));
log('EVERY CHALLENGE AND MODE — shipped engine, EVERY source including optional')
log('(attempt and /day include Bonus Missions at their cap and weekly sessions at full adherence)');
log(pad('challenge', 18), pad('tier', 12), pad('mode', 9), rp('d', 3), rp('task/d', 7),
    rp('perf', 5), rp('compl', 6), rp('attempt', 8), rp('/day', 7), rp('→UNBR', 7));
log('-'.repeat(104));
const CAT = [
  ['75 Hard', 'hard', [75], false],
  ['LOCK IN', 'medium_hard', [7, 14, 21, 30, 60, 90], false],
  ['Muscle Building', 'medium_hard', [30, 60, 90], true],
  ['Fat Loss', 'medium', [14, 30, 60], true],
  ['Mental Training', 'medium', [7, 14, 21], false],
  ['Energy Reset', 'medium', [7, 10, 14, 30], false],
  ['Hormone Health', 'medium', [56, 84], true],
];
const rows = [];
for (const [name, tier, durs, weekly] of CAT) {
  for (const mode of ['beginner', 'standard', 'hard']) {
    // Mental Training's beginner variant sits a tier lower on the effort audit.
    const t = (name === 'Mental Training' && mode === 'beginner') ? 'easy' : tier;
    for (const d of durs) {
      const y = year({ name, tier: t, mode, duration: d, weekly, optional: true });
      const budget = tierBudget(t, mode);
      const top = toTop(y.perDay);
      rows.push({ name, tier: t, mode, d, perDay: y.perDay, top });
      log(pad(name, 18), pad(t, 12), pad(mode, 9), rp(d, 3), rp(budget, 7),
          rp(Math.round(budget * 0.15), 5), rp(completionBonusFor(t, mode, d), 6),
          rp(y.cycle, 8), rp(y.perDay.toFixed(1), 7), rp(top, 7));
    }
  }
}
const fd = year({ name: 'Forge Daily', tier: 'easy', mode: 'standard', duration: 99999 });
log(pad('Forge Daily', 18), pad('easy', 12), pad('standard', 9), rp('--', 3), rp(120, 7),
    rp(18, 5), rp(0, 6), rp('--', 8), rp(fd.perDay.toFixed(1), 7), rp(toTop(fd.perDay), 7));

log('');
log('  Fastest routes to Unbreakable (lower = faster):');
for (const r of [...rows].sort((a, c) => a.top - c.top).slice(0, 8)) {
  log(`    ${pad(`${r.name} ${r.mode} ${r.d}d`, 40)} day ${rp(r.top, 4)}`);
}
log(`    ${pad('Forge Daily (baseline)', 40)} day ${rp(toTop(fd.perDay), 4)}`);
const fastest = [...rows].sort((a, c) => a.top - c.top)[0];
log('');
log(`  75 Hard standard reaches the top on day ${rows.find(r => r.name === '75 Hard' && r.mode === 'standard').top}.`);
log(`  Fastest of all is ${fastest.name} ${fastest.mode} ${fastest.d}d on day ${fastest.top}.`);

log('');
log('='.repeat(104));
log('REQUIREMENT 9 SCENARIOS — shipped engine');
log(pad('scenario', 44), rp('30d', 8), rp('90d', 8), rp('180d', 9), rp('365d', 9), rp('→UNBR', 7));
log('-'.repeat(104));
const SC = [
  ['1. 75 Hard, perfect', { name: '75 Hard', tier: 'hard', mode: 'standard', duration: 75 }],
  ['2. 75 Hard, 90% adherence', { name: '75 Hard', tier: 'hard', mode: 'standard', duration: 75, adherence: 0.9 }],
  ['3. Mental Training standard', { name: 'Mental Training', tier: 'medium', mode: 'standard', duration: 14 }],
  ['4. Mental Training hard', { name: 'Mental Training', tier: 'medium', mode: 'hard', duration: 14 }],
  ['5. Fat Loss standard 30d', { name: 'Fat Loss', tier: 'medium', mode: 'standard', duration: 30, weekly: true }],
  ['6a. LOCK IN standard 14d', { name: 'LOCK IN', tier: 'medium_hard', mode: 'standard', duration: 14 }],
  ['6b. LOCK IN hard 14d', { name: 'LOCK IN', tier: 'medium_hard', mode: 'hard', duration: 14 }],
  ['6c. LOCK IN standard 90d', { name: 'LOCK IN', tier: 'medium_hard', mode: 'standard', duration: 90 }],
  ['8. inconsistent, 70% adherence', { name: 'LOCK IN', tier: 'medium_hard', mode: 'standard', duration: 30, adherence: 0.7 }],
  ['   Forge Daily only', { name: 'Forge Daily', tier: 'easy', mode: 'standard', duration: 99999 }],
];
for (const [label, cfg] of SC) {
  const at = (h) => year({ ...cfg, horizon: h }).net;
  const y = year({ ...cfg, horizon: 365 });
  log(pad(label, 44), rp(at(30), 8), rp(at(90), 8), rp(at(180), 9), rp(at(365), 9),
      rp(toTop(y.perDay), 7));
}

log('');
log('='.repeat(104));
log('ANTI-FARM CHECKS — shipped engine');
const unbroken = run({ name: '75 Hard', tier: 'hard', mode: 'standard', duration: 75, days: 62 });
const skipped = (() => {
  const r = run({ name: '75 Hard', tier: 'hard', mode: 'standard', duration: 75, days: 62 });
  return r;
})();
log(`  62 unbroken days of 75 Hard : ${unbroken.net}`);
const broken = (() => {
  const base = { templateId: '75 Hard', name: '75 Hard', variant: 'standard', durationDays: 75 };
  const { meta, tasks } = stampAttempt({ meta: base, tasks: TASKS['75 Hard'], template: { effort_tier: 'hard' } });
  const allDays = { p: {} };
  for (let i = 1; i <= 62; i++) {
    if (i === 31) continue;
    allDays.p[i] = { tasks: Object.fromEntries(tasks.map(t => [t.id, true])) };
  }
  const profiles = { p: { challengeStart: dstr(-61), activeChallenge: meta, tasks,
    xpPenalties: true, xpStartDay: 1, xpOffset: 0, weeklySessions: [], comebackHistory: [] } };
  return computeTotalXP(allDays, profiles, 'p', (n) => (allDays.p[n] ? 100 : 0), 62, 62);
})();
log(`  the same with day 31 skipped: ${broken.rawTotal}`);
log(`  skipping a day is worth ${broken.rawTotal - unbroken.net} XP  ${broken.rawTotal < unbroken.net ? '(a LOSS, as intended)' : '*** STILL PAYS ***'}`);
log('');
log('  Restart farming over 90 days, medium_hard/standard:');
for (const d of [7, 14, 30, 45, 90]) {
  const y = year({ name: 'LOCK IN', tier: 'medium_hard', mode: 'standard', duration: d, horizon: 90 });
  log(`    ${rp(d, 2)}-day attempts x ${rp(Math.floor(90 / d), 2)} → ${rp(y.net, 6)} XP (${y.perDay.toFixed(2)}/day)`);
}

console.log(L.join('\n'));
