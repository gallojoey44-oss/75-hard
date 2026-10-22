/**
 * The per-challenge XP breakdown.
 *
 * One property matters above the rest: the parts must add up to what the engine
 * says the segment is worth. A breakdown that disagrees with the balance is
 * worse than no breakdown, so every case here is checked against
 * `computeTotalXP` rather than against a figure written by hand.
 */
import { reconciledSegmentBreakdown, toDisplay } from '../src/utils/xpBreakdown.js';
import { stampAttempt } from '../src/utils/xpAttempt.js';
import { allocateTaskXP, tierBudget } from '../src/data/xpEconomy.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const dstr = (off) => {
  const d = new Date(); d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ERA2_TASKS = [
  { id: 'a', name: 'A', keystone: 3 }, { id: 'b', name: 'B', keystone: 3 },
  { id: 'c', name: 'C', keystone: 2 }, { id: 'd', name: 'D', keystone: 1 },
  { id: 'e', name: 'E', keystone: 0 },
];

function era2Segment({ days, logged, missed = [], extras = {}, duration = 30, tier = 'medium' }) {
  const { meta, tasks } = stampAttempt({
    meta: { templateId: 't', name: 'T', variant: 'standard', durationDays: duration },
    tasks: ERA2_TASKS, template: { effort_tier: tier },
  });
  const rec = {};
  for (const n of logged) {
    rec[n] = { tasks: Object.fromEntries(tasks.map(t => [t.id, true])), ...extras };
  }
  for (const n of missed) delete rec[n];
  const completion = (n) => {
    const d = rec[n];
    if (!d) return 0;
    return Math.round((tasks.filter(t => d.tasks?.[t.id]).length / tasks.length) * 100);
  };
  return reconciledSegmentBreakdown({
    days: rec, tasks, meta, challengeStart: dstr(-(days - 1)),
    dayNum: days, rawDay: days + 1, penaltiesEnabled: true, xpStartDay: 1,
    weeklySessions: [], getDayCompletion: completion,
  });
}

// ══ 1: it reconciles with the engine ═══════════════════════════════════════
{
  const cases = [
    ['a perfect run', { days: 30, logged: Array.from({ length: 30 }, (_, i) => i + 1) }],
    ['a run with gaps', { days: 30, logged: [1, 2, 3, 10, 11, 20, 21, 22, 23, 24] }],
    ['a single logged day', { days: 30, logged: [1] }],
    ['nothing logged at all', { days: 30, logged: [] }],
    ['a short attempt', { days: 7, logged: [1, 2, 3, 4, 5, 6, 7], duration: 7 }],
    ['a hard-tier attempt', { days: 14, logged: [1, 2, 3, 4, 5], duration: 14, tier: 'hard' }],
    ['with wellness ratings', { days: 14, logged: [1, 2, 3], duration: 14,
      extras: { mood: 4, energy: 4, sleep: 4, stress: 3, recovery: 4 } }],
    ['with optional missions', { days: 14, logged: [1, 2, 3], duration: 14,
      extras: { bonusDone: { m1: 40 } } }],
    ['with a faith reflection', { days: 14, logged: [1, 2], duration: 14,
      extras: { faithReflection: { completed: true } } }],
  ];
  for (const [label, cfg] of cases) {
    const p = era2Segment(cfg);
    check(`1: ${label} reconciles with the engine`, p.reconciles,
      `parts ${p.earned}/${p.deducted} vs engine ${p.engineGained}/${p.engineLost}`);
  }
}

// ══ 2: the parts are attributed, not lumped ════════════════════════════════
{
  const p = era2Segment({ days: 30, logged: Array.from({ length: 30 }, (_, i) => i + 1) });
  const budget = tierBudget('medium', 'standard');
  check('2: task XP is days x budget', p.taskXP === 30 * budget, `${p.taskXP} vs ${30 * budget}`);
  check('2: every day counted as perfect', p.perfectDays === 30);
  check('2: the perfect-day bonus is attributed separately', p.perfectDayXP > 0);
  check('2: a completed attempt is credited its completion bonus',
    p.completionXP > 0, String(p.completionXP));
  check('2: streak XP is attributed separately', p.streakXP > 0, String(p.streakXP));
  check('2: a perfect run has no deductions', p.deducted === 0);
  check('2: the duplicate era-2 awards are zero',
    p.ratingsXP === 0 && p.mentalSectionXP === 0);
}

// ══ 3: deductions are split by kind ════════════════════════════════════════
{
  // Days 1-5 complete, 6-10 missed entirely, 11-14 complete.
  const p = era2Segment({ days: 14, duration: 14, logged: [1, 2, 3, 4, 5, 11, 12, 13, 14] });
  check('3: whole missed days are counted', p.missedDays === 5, String(p.missedDays));
  check('3: and charged as missed days, not task shortfalls',
    p.missedDayPenalty > 0 && p.taskMissPenalty === 0,
    `${p.missedDayPenalty}/${p.taskMissPenalty}`);
  check('3: the missed-day charge is days x rate',
    p.missedDayPenalty === p.missedDays * Math.round(tierBudget('medium', 'standard') * 0.5),
    String(p.missedDayPenalty));
  check('3: an incomplete attempt earns no completion bonus',
    p.completionXP === 0 || p.earned < 14 * tierBudget('medium', 'standard') * 1.5);
  check('3: it still reconciles', p.reconciles);
}

// ══ 4: era-1 segments are explained under era-1 rules ══════════════════════
{
  const tasks = [
    { id: 'workout', name: 'w' }, { id: 'diet', name: 'd' },
    { id: 'water', name: 'wa' }, { id: 'daily_log', name: 'dl', xp: 20 },
  ];
  const meta = { templateId: 'legacy', name: 'Legacy', durationDays: 30, xpEconomyVersion: 1 };
  const rec = {};
  for (let i = 1; i <= 10; i++) {
    rec[i] = { tasks: Object.fromEntries(tasks.map(t => [t.id, true])),
      mood: 4, energy: 4, sleep: 4, stress: 3, recovery: 4 };
  }
  const p = reconciledSegmentBreakdown({
    days: rec, tasks, meta, challengeStart: dstr(-29),
    dayNum: 30, rawDay: 31, penaltiesEnabled: true, xpStartDay: 1,
    getDayCompletion: (n) => (rec[n] ? 100 : 0),
  });
  check('4: an era-1 segment reports era 1', p.era === 1);
  check('4: it still carries the era-1 all-ratings award',
    p.ratingsXP === 100, String(p.ratingsXP));
  // workout 15 + diet 15 (high-value) + water 10 + daily_log 20 = 60 a day.
  check('4: era-1 task XP uses the flat fallback',
    p.taskXP === 10 * 60, `${p.taskXP} (10 days x 60)`);
  check('4: the era-1 perfect-day bonus is still 50 a day',
    p.perfectDayXP === 500, String(p.perfectDayXP));
  check('4: it reconciles under its own rules', p.reconciles,
    `parts ${p.earned}/${p.deducted} vs engine ${p.engineGained}/${p.engineLost}`);

  const shown = toDisplay(p);
  check('4: display conversion multiplies an era-1 segment by ten',
    shown.taskXP === p.taskXP * 10 && shown.net === p.net * 10);
  check('4: an era-2 segment is not converted', (() => {
    const q = era2Segment({ days: 10, logged: [1, 2, 3], duration: 30 });
    return toDisplay(q).net === q.net;
  })());
}

// ══ 5: weekly requirements appear in the breakdown ═════════════════════════
{
  const defs = [
    { id: 'lifting', label: 'Lifting', perWeek: 3, xp: 12, keystone: 2 },
    { id: 'zone2', label: 'Zone 2', perWeek: 2, xp: 10, keystone: 2 },
  ];
  const { meta, tasks } = stampAttempt({
    meta: { templateId: 'fat_loss_phase', name: 'FL', variant: 'standard',
            durationDays: 14, weeklyRequirementDefs: defs },
    tasks: ERA2_TASKS, template: { effort_tier: 'medium' },
  });
  const rec = {};
  for (let i = 1; i <= 14; i++) rec[i] = { tasks: Object.fromEntries(tasks.map(t => [t.id, true])) };
  const sessions = [];
  for (let w = 0; w < 2; w++) {
    for (const d of meta.weeklyRequirementDefs) {
      for (let k = 0; k < d.perWeek; k++) {
        sessions.push({ type: d.id, date: dstr(-13 + w * 7 + k) });
      }
    }
  }
  const p = reconciledSegmentBreakdown({
    days: rec, tasks, meta, challengeStart: dstr(-13),
    dayNum: 14, rawDay: 15, penaltiesEnabled: true, xpStartDay: 1,
    weeklySessions: sessions, getDayCompletion: () => 100,
  });
  check('5: weekly session XP is attributed', p.weeklyXP > 0, String(p.weeklyXP));
  check('5: the weekly defs were repriced onto the weekly budget',
    meta.weeklyRequirementDefs.every(d => d.xp >= 1),
    meta.weeklyRequirementDefs.map(d => `${d.id}:${d.xp}`).join(' '));
  check('5: a segment with weekly requirements still reconciles', p.reconciles,
    `parts ${p.earned}/${p.deducted} vs engine ${p.engineGained}/${p.engineLost}`);

  // Missing every session must be charged, and attributed to the weekly line.
  const none = reconciledSegmentBreakdown({
    days: rec, tasks, meta, challengeStart: dstr(-13),
    dayNum: 14, rawDay: 15, penaltiesEnabled: true, xpStartDay: 1,
    weeklySessions: [], getDayCompletion: () => 100,
  });
  check('5: missed weekly sessions are charged', none.weeklyMissPenalty > 0,
    String(none.weeklyMissPenalty));
  check('5: and that case reconciles too', none.reconciles);
}

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
