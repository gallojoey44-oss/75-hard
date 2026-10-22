/**
 * The versioned XP economy.
 *
 * The properties that matter most, and are therefore tested hardest:
 *   • era-1 attempts and archives compute EXACTLY as they did before, to the
 *     point — otherwise the rebalance has rewritten history;
 *   • an attempt in progress keeps its rates when the global economy changes;
 *   • a daily budget is a real guarantee: task XP sums to it regardless of how
 *     many tasks there are;
 *   • breaking a streak, or restarting a short challenge, can never out-earn
 *     uninterrupted adherence;
 *   • the x10 conversion is exact through floors, forgiveness and the ledger;
 *   • the one-year benchmark lands at roughly 365 days.
 */
import {
  CURRENT_ECONOMY_VERSION, ECONOMY_V2, ECONOMY_V1, RANKS, EFFORT_TIERS,
  tierBudget, allocateTaskXP, completionBonusFor, dayRules, dailyBudgetOf,
  repriceWeeklyDefs, economyVersionOf, displayScaleFor, bonusCapForAttempt,
} from '../src/data/xpEconomy.js';
import {
  stampAttempt, repriceTasks, effortTierFor, toDisplayXP, archiveEraOf,
  ledgerDisplayAmount, forgivenDisplayAmount,
} from '../src/utils/xpAttempt.js';
import {
  computeDayXP, computeTotalXP, computeStreakEvents, getTaskXP, ERA1_RULES,
} from '../src/utils/gamification.js';
import { computeXPBreakdown, makeLedger } from '../src/utils/xpLedger.js';
import { rankFloorXP, resolveRankState } from '../src/utils/rank.js';
import { computeWeeklyRequirements, getWeeklyRequirementDefs } from '../src/utils/weeklyRequirements.js';
import { weeklyRequirementDefs as FLH_weeklyDefs } from '../src/data/fatLossHardConfig.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const dstr = (off) => {
  const d = new Date(); d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ══ 1: era-1 fidelity — the engine must not have moved ═════════════════════
// These are the numbers the app produced before the versioned engine existed.
// If any of them changes, an archive has been revalued.
{
  const tasks = [
    { id: 'workout' }, { id: 'diet' }, { id: 'water' }, { id: 'reading' },
    { id: 'photo' }, { id: 'mental' }, { id: 'daily_log', xp: 20 },
  ];
  const full = { tasks: Object.fromEntries(tasks.map(t => [t.id, true])),
    mood: 4, energy: 4, sleep: 4, stress: 3, recovery: 4 };

  check('1: era-1 flat fallback still prices a high-value task at 15',
    getTaskXP({ id: 'workout' }) === 15);
  check('1: era-1 flat fallback still prices an ordinary task at 10',
    getTaskXP({ id: 'water' }) === 10);

  const d = computeDayXP(full, tasks, null, 1, 2, true, 2);
  // 95 task + 50 all-complete + 10 all-ratings = 155
  check('1: a perfect era-1 day is still 155 XP', d.gained === 155, String(d.gained));
  check('1: a perfect day loses nothing', d.lost === 0);

  const missed = computeDayXP(undefined, tasks, null, 1, 2, true, 2);
  check('1: a missed era-1 day still costs 25', missed.lost === 25, String(missed.lost));

  const partial = computeDayXP({ tasks: { workout: true } }, tasks, null, 1, 2, true, 2);
  // 6 missed: diet 10 + water 5 + reading 5 + photo 5 + mental 10 + daily_log
  // min(20 x 0.25, 12) = 5.
  check('1: an era-1 partial day still charges the capped task penalties',
    partial.gained === 15 && partial.lost === 40, `${partial.gained}/${partial.lost}`);

  // The era-1 streak ladder, re-armed per streak.
  const compl = (n) => (n === 4 ? 0 : 100);
  const st = computeStreakEvents({ p: {} }, 'p', compl, 10, true, 11);
  check('1: era-1 streaks still re-arm after a break',
    st.gained === 60 && st.lost === 30, `${st.gained}/${st.lost} — the 3-day bonus paid twice`);
  check('1: ERA1_RULES is era 1', ERA1_RULES.version === 1 && ERA1_RULES.perfectDay === 50);
}

// ══ 2: the daily budget is a real guarantee ════════════════════════════════
{
  for (const tier of EFFORT_TIERS) {
    for (const mode of ['beginner', 'standard', 'hard']) {
      const b = tierBudget(tier, mode);
      for (const n of [1, 2, 5, 7, 8, 9, 12, 20]) {
        const tasks = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, keystone: i % 4 }));
        const priced = allocateTaskXP(tasks, b);
        const sum = priced.reduce((s, t) => s + t.xp, 0);
        if (sum !== b) {
          check(`2: ${tier}/${mode} with ${n} tasks sums to the budget`, false, `${sum} != ${b}`);
        }
        if (priced.some(t => t.xp < 1)) {
          check(`2: ${tier}/${mode} with ${n} tasks never prices a habit at 0`, false);
        }
      }
    }
  }
  check('2: every tier/mode/task-count combination sums exactly to its budget', true,
    `${EFFORT_TIERS.length * 3 * 8} combinations`);

  // Task COUNT must not change what a challenge is worth.
  const five = allocateTaskXP(Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, keystone: 2 })), 160);
  const thirteen = allocateTaskXP(Array.from({ length: 13 }, (_, i) => ({ id: `b${i}`, keystone: 2 })), 160);
  check('2: adding tasks splits the budget rather than inflating it',
    five.reduce((s, t) => s + t.xp, 0) === thirteen.reduce((s, t) => s + t.xp, 0),
    '5 tasks and 13 tasks both total 160');

  // Keystones outrank supporting habits.
  const mixed = allocateTaskXP([
    { id: 'k3', keystone: 3 }, { id: 'k2', keystone: 2 },
    { id: 'k1', keystone: 1 }, { id: 'k0', keystone: 0 },
  ], 200);
  check('2: a keystone is worth more than a supporting habit',
    mixed[0].xp > mixed[1].xp && mixed[1].xp > mixed[2].xp && mixed[2].xp >= mixed[3].xp,
    mixed.map(t => t.xp).join('/'));
}

// ══ 3: difficulty ordering ═════════════════════════════════════════════════
{
  const pairs = [
    ['easy', 'medium'], ['medium', 'medium_hard'],
    ['medium_hard', 'hard'], ['hard', 'elite'],
  ];
  for (const [lower, higher] of pairs) {
    check(`3: hard-mode ${lower} never out-earns standard ${higher}`,
      tierBudget(lower, 'hard') < tierBudget(higher, 'standard'),
      `${tierBudget(lower, 'hard')} < ${tierBudget(higher, 'standard')}`);
  }
  for (const tier of EFFORT_TIERS) {
    check(`3: ${tier} modes are ordered beginner < standard < hard`,
      tierBudget(tier, 'beginner') < tierBudget(tier, 'standard') &&
      tierBudget(tier, 'standard') < tierBudget(tier, 'hard'));
  }
  check('3: the hard multiplier is 1.08, which is what makes the pairs hold',
    ECONOMY_V2.modes.hard === 1.08);
}

// ══ 4: stamping, and an attempt in progress keeping its rates ══════════════
{
  const template = { id: 'x', effort_tier: 'hard' };
  const tasks = [
    { id: 'a', keystone: 3 }, { id: 'b', keystone: 3 }, { id: 'c', keystone: 2 },
    { id: 'd', keystone: 1 }, { id: 'e', keystone: 0 },
  ];
  const { meta, tasks: priced } = stampAttempt({
    meta: { templateId: 'x', variant: 'standard', durationDays: 75 }, tasks, template,
  });
  check('4: the attempt is stamped with the current era',
    meta.xpEconomyVersion === CURRENT_ECONOMY_VERSION);
  check('4: the tier and budget are stamped onto the descriptor',
    meta.effortTier === 'hard' && meta.dailyBudget === 200,
    `${meta.effortTier}/${meta.dailyBudget}`);
  check('4: the completion bonus is stamped from the budget and duration',
    meta.completionBonusXP === 3000, String(meta.completionBonusXP));
  check('4: tasks are priced to the budget', priced.reduce((s, t) => s + t.xp, 0) === 200);

  // The engine reads the STAMP, so changing the global economy cannot move it.
  const rules = dayRules(meta);
  check('4: the attempt resolves era-2 rules', rules.version === 2 && rules.perfectDay === 30);
  const before = computeDayXP(
    { tasks: Object.fromEntries(priced.map(t => [t.id, true])) },
    priced, null, 1, 2, true, 2, rules);
  const savedTier = ECONOMY_V2.tiers.hard;
  ECONOMY_V2.tiers.hard = 999;                       // a later rebalance
  const after = computeDayXP(
    { tasks: Object.fromEntries(priced.map(t => [t.id, true])) },
    priced, null, 1, 2, true, 2, dayRules(meta));
  ECONOMY_V2.tiers.hard = savedTier;
  check('4: a rebalance does not change an attempt already in progress',
    before.gained === after.gained && before.gained === 230,
    `${before.gained} then ${after.gained}`);

  // Per-variant tiers.
  const mt = { id: 'mt', effort_tier: 'medium',
    effort_tier_by_variant: { beginner: 'easy', standard: 'medium', hard: 'medium' } };
  check('4: a per-variant tier overrides the template tier',
    effortTierFor(mt, 'beginner') === 'easy' && effortTierFor(mt, 'standard') === 'medium');
  check('4: a template without per-variant tiers falls back to its own',
    effortTierFor({ effort_tier: 'hard' }, 'beginner') === 'hard');
  check('4: an unstamped descriptor reads as era 1',
    economyVersionOf({}) === 1 && economyVersionOf(null) === 1);
  check('4: an era-1 stamp keeps era-1 task XP untouched',
    repriceTasks({ xpEconomyVersion: 1 }, tasks) === tasks);
}

// ══ 5: era-2 day XP ════════════════════════════════════════════════════════
{
  const meta = { xpEconomyVersion: 2, effortTier: 'hard', variant: 'standard',
    dailyBudget: 200, durationDays: 75 };
  const rules = dayRules(meta);
  const tasks = allocateTaskXP(
    Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, keystone: [3, 3, 2, 2, 1, 1, 1, 0][i] })), 200);
  const all = Object.fromEntries(tasks.map(t => [t.id, true]));

  const perfect = computeDayXP({ tasks: all }, tasks, null, 1, 2, true, 2, rules);
  check('5: a perfect era-2 hard day is budget + 15%', perfect.gained === 230, String(perfect.gained));

  const withRatings = computeDayXP(
    { tasks: all, mood: 4, energy: 4, sleep: 4, stress: 3, recovery: 4 },
    tasks, null, 1, 2, true, 2, rules);
  check('5: the duplicate all-ratings award is gone',
    withRatings.gained === perfect.gained, String(withRatings.gained));

  const withMental = computeDayXP(
    { tasks: all, mentalTraining: { completed: true } }, tasks, null, 1, 2, true, 2, rules);
  check('5: the duplicate mental-section award is gone',
    withMental.gained === perfect.gained, String(withMental.gained));

  const missed = computeDayXP(undefined, tasks, null, 1, 2, true, 2, rules);
  check('5: a missed era-2 day costs half the budget', missed.lost === 100, String(missed.lost));
  check('5: a missed day costs 43% of a perfect day',
    Math.round((missed.lost / perfect.gained) * 100) === 43);

  const bonus = computeDayXP(
    { tasks: all, bonusDone: { a: 500 } }, tasks, null, 1, 2, true, 2, rules);
  check('5: optional XP is capped at 10% of the budget per day',
    bonus.gained === perfect.gained + 20, String(bonus.gained - perfect.gained));

  // A day can never lose more than its own ceiling.
  const allMissed = computeDayXP({ notes: 'x' }, tasks, null, 1, 2, true, 2, rules);
  check('5: a touched-but-empty day is capped at the day loss ceiling',
    allMissed.lost <= rules.dayLossCap, `${allMissed.lost} <= ${rules.dayLossCap}`);

  check('5: era 2 has no flat task fallback', getTaskXP({ id: 'workout' }, rules) === 0);
}

// ══ 6: streaks cannot be farmed ════════════════════════════════════════════
{
  const meta = { xpEconomyVersion: 2, dailyBudget: 200, durationDays: 75, effortTier: 'hard' };
  const rules = dayRules(meta);

  const unbroken = computeStreakEvents({ p: {} }, 'p', () => 100, 62, true, 63, rules);
  const broken = computeStreakEvents({ p: {} }, 'p', (n) => (n === 31 ? 0 : 100), 62, true, 63, rules);
  check('6: breaking a streak does not re-arm the ladder',
    broken.gained <= unbroken.gained, `${broken.gained} <= ${unbroken.gained}`);
  check('6: breaking a streak costs no separate penalty under era 2',
    broken.lost === 0, String(broken.lost));

  // The whole point: skipping a day must never pay.
  const dayValue = 200 + 30;          // task budget + perfect-day
  const missPenalty = 100;
  const skipDelta = (broken.gained - broken.lost) - (unbroken.gained - unbroken.lost)
    - dayValue - missPenalty;
  check('6: skipping a day is strictly worse than not skipping it',
    skipDelta < 0, `net effect ${skipDelta} XP`);

  // Restarting short challenges must not beat one long attempt.
  const perDayFor = (duration, horizon) => {
    const b = tierBudget('medium', 'standard');
    const m = { xpEconomyVersion: 2, dailyBudget: b, durationDays: duration };
    const r = dayRules(m);
    const cycles = Math.floor(horizon / duration);
    const tail = horizon % duration;
    const streakOne = computeStreakEvents({ p: {} }, 'p', () => 100, duration, true, duration + 1, r).gained;
    const streakTail = tail ? computeStreakEvents({ p: {} }, 'p', () => 100, tail, true, tail + 1, r).gained : 0;
    const compl = cycles * completionBonusFor('medium', 'standard', duration);
    return (horizon * (b + r.perfectDay) + compl + cycles * streakOne + streakTail) / horizon;
  };
  const long = perDayFor(90, 90);
  for (const d of [7, 14, 21, 30, 45]) {
    const short = perDayFor(d, 90);
    check(`6: ${d}-day restarts do not beat one 90-day attempt`,
      short <= long + 0.01, `${short.toFixed(2)} vs ${long.toFixed(2)}`);
  }
}

// ══ 7: completion bonus is duration-neutral ════════════════════════════════
{
  const rates = [7, 10, 14, 21, 30, 56, 60, 75, 84, 90].map(d => ({
    d, perDay: completionBonusFor('medium', 'standard', d) / d,
  }));
  const spread = Math.max(...rates.map(r => r.perDay)) - Math.min(...rates.map(r => r.perDay));
  check('7: the completion bonus is worth the same per day at every duration',
    spread < 0.2, `spread ${spread.toFixed(3)} XP/day`);
  check('7: an open-ended attempt has no completion bonus',
    completionBonusFor('easy', 'standard', 0) === 0);
}

// ══ 8: the x10 conversion is exact ═════════════════════════════════════════
{
  check('8: era 1 scales by 10 and era 2 by 1',
    displayScaleFor(1) === 10 && displayScaleFor(2) === 1);
  check('8: an unstamped archive is era 1',
    archiveEraOf({ xpEarned: 100 }) === 1);
  check('8: a stamped archive reports its own era',
    archiveEraOf({ challenge: { xpEconomyVersion: 2 } }) === 2);
  check('8: era-1 XP converts by exactly ten', toDisplayXP(8245, 1) === 82450);
  check('8: era-2 XP is already display units', toDisplayXP(21000, 2) === 21000);

  // Rank thresholds moved with the units, so relative position is unchanged.
  check('8: the ladder is the era-1 ladder times ten',
    RANKS[7].minXP === 100000 && RANKS[6].minXP === 75000 && RANKS[1].minXP === 2500);
  check('8: a converted balance keeps its rank',
    resolveRankState({ rawLifetimeXP: 82450, highestRank: 7 }).current.name === 'True Warrior');
  // 8,245 sat (8245-7500)/(10000-7500) = 29.8% into the old True Warrior tier.
  // Converted, 82,450 sits (82450-75000)/(100000-75000) = 29.8% into the new
  // one, so the unit change moves nobody.
  check('8: and its position within the tier',
    resolveRankState({ rawLifetimeXP: 82450, highestRank: 7 }).progress === 30,
    String(resolveRankState({ rawLifetimeXP: 82450, highestRank: 7 }).progress));

  // Floors and forgiveness, through the breakdown.
  const cases = [
    ['before reconciliation', 8245, 0, 7500],
    ['after reconciliation', 8245, 649, 7500],
    ['charge exceeds headroom', 7600, 649, 7500],
    ['exactly at the floor', 7500, 100, 7500],
    ['below the floor', 7000, 500, 7500],
  ];
  for (const [label, earned, pen, floorX1] of cases) {
    const b = computeXPBreakdown({
      archives: [{ xpEarned: earned }],
      currentSegment: { gained: 0, lost: 0 },
      ledger: pen ? { version: 1, reconciled: { amount: pen } } : makeLedger(),
      currentEra: 1,
    });
    check(`8: ${label} converts exactly`, b.net === (earned - pen) * 10,
      `${b.net} vs ${(earned - pen) * 10}`);
  }

  check('8: a ledger amount written under era 1 is scaled on read',
    ledgerDisplayAmount({ amount: 649 }) === 6490);
  check('8: a ledger amount written under era 2 is not scaled again',
    ledgerDisplayAmount({ amount: 6490, ledgerUnits: 2 }) === 6490);
  check('8: the same holds for a forgiveness credit',
    forgivenDisplayAmount({ forgiven: 500 }) === 5000 &&
    forgivenDisplayAmount({ forgiven: 5000, forgivenUnits: 2 }) === 5000);
}

// ══ 9: mixed-era lifetime XP ═══════════════════════════════════════════════
{
  const b = computeXPBreakdown({
    archives: [
      { xpEarned: 8245 },                                        // era 1 -> 82,450
      { xpEarned: 21000, challenge: { xpEconomyVersion: 2 } },    // era 2 -> 21,000
    ],
    currentSegment: { gained: 0, lost: 0 },
    ledger: { version: 1, reconciled: { amount: 649 } },          // era 1 -> 6,490
    currentEra: 2,
  });
  check('9: each archive converts by its own era',
    b.earned === 103450, String(b.earned));
  check('9: the era-1 ledger charge converts too', b.grossPenalties === 6490);
  check('9: the breakdown reconciles', b.earned - b.grossPenalties + b.forgiven === b.net);
  check('9: and the net is the figure the card shows', b.net === 96960, String(b.net));
}

// ══ 10: the one-year benchmark ═════════════════════════════════════════════
{
  const profId = 'p';
  const tier = 'hard', mode = 'standard', duration = 75;
  const { meta, tasks } = stampAttempt({
    meta: { templateId: '75', variant: mode, durationDays: duration },
    tasks: [
      { id: 'workout', keystone: 3 }, { id: 'diet', keystone: 3 },
      { id: 'sleep', keystone: 2 }, { id: 'mental', keystone: 2 },
      { id: 'water', keystone: 1 }, { id: 'reading', keystone: 1 },
      { id: 'daily_log', keystone: 1 }, { id: 'photo', keystone: 0 },
    ],
    template: { effort_tier: tier },
  });

  /**
   * `days` perfect days of a 75-day attempt, through the real engine.
   * The duration stays 75 whatever `days` is, so a partial run earns no
   * completion bonus — which is what makes the year cycle-accurate.
   */
  const attempt = (days) => {
    const allDays = { [profId]: {} };
    for (let i = 1; i <= days; i++) {
      allDays[profId][i] = { tasks: Object.fromEntries(tasks.map(t => [t.id, true])) };
    }
    const profiles = { [profId]: {
      challengeStart: dstr(-(days - 1)), activeChallenge: meta,
      tasks, xpPenalties: true, xpStartDay: 1, xpOffset: 0,
      weeklySessions: [], comebackHistory: [],
    } };
    return computeTotalXP(allDays, profiles, profId, () => 100, days, days);
  };

  const cycle = attempt(75);
  const tail = attempt(65);     // 65 days into a 5th cycle: no completion bonus
  const year = 4 * cycle.gained + tail.gained;
  const perDay = year / 365;
  const daysToTop = Math.ceil(RANKS[7].minXP / perDay);

  check('10: one perfect 75-day attempt banks 21,000',
    cycle.gained === 21000, String(cycle.gained));
  check('10: 365 days of perfect 75 Hard is about 100,000 XP',
    Math.abs(year - 100000) < 2000, String(year));
  check('10: Unbreakable arrives at about one year',
    daysToTop >= 350 && daysToTop <= 380, `day ${daysToTop}`);
  check('10: one attempt is no longer worth more than the whole ladder',
    cycle.gained < RANKS[7].minXP,
    `${cycle.gained} < ${RANKS[7].minXP}`);

  // The rank curve.
  const dayFor = (xp) => Math.ceil(xp / perDay);
  check('10: the early ranks still arrive quickly',
    dayFor(2500) <= 15 && dayFor(7500) <= 35,
    `Apprentice day ${dayFor(2500)}, Disciplined day ${dayFor(7500)}`);
  check('10: and the last two take most of the year',
    dayFor(75000) >= 250 && dayFor(100000) >= 350,
    `True Warrior day ${dayFor(75000)}, Unbreakable day ${dayFor(100000)}`);
}

// ══ 11: XP keeps accruing past the top rank ════════════════════════════════
{
  for (const xp of [100000, 125000, 400000]) {
    const st = resolveRankState({ rawLifetimeXP: xp, highestRank: 8 });
    check(`11: ${xp.toLocaleString()} XP is not clamped`, st.xp === xp, String(st.xp));
    check(`11: ${xp.toLocaleString()} reports Unbreakable with no next rank`,
      st.current.name === 'Unbreakable' && st.next === null && st.xpToNext === 0);
  }
  check('11: the top floor is the top threshold', rankFloorXP(8) === 100000);
}

// ══ 12: weekly requirements draw on their own budget ═══════════════════════
{
  const meta = { xpEconomyVersion: 2, dailyBudget: 160, durationDays: 30, effortTier: 'medium' };
  const defs = [
    { id: 'lifting', perWeek: 3, xp: 25, keystone: 2 },
    { id: 'zone2', perWeek: 2, xp: 20, keystone: 2 },
  ];
  const priced = repriceWeeklyDefs(defs, meta);
  const weekly = priced.reduce((s, d) => s + d.perWeek * d.xp, 0);
  check('12: the weekly budget is half a day per week',
    Math.abs(weekly - 80) <= 5, `${weekly} vs 80`);
  check('12: more required sessions does not mean more weekly XP',
    (() => {
      const many = repriceWeeklyDefs(
        [...defs, { id: 'extra', perWeek: 4, xp: 30, keystone: 2 }], meta);
      const total = many.reduce((s, d) => s + d.perWeek * d.xp, 0);
      return Math.abs(total - weekly) <= 8;
    })());
  check('12: every session is worth at least 1 XP',
    repriceWeeklyDefs([{ id: 'x', perWeek: 20, xp: 5, keystone: 0 }], meta)[0].xp >= 1);
}

// ══ 13: the optional-XP ceiling for a whole attempt ════════════════════════
{
  const meta = { xpEconomyVersion: 2, dailyBudget: 160, durationDays: 14 };
  check('13: the attempt bonus cap is 5% of the attempt budget',
    bonusCapForAttempt(meta) === 112, String(bonusCapForAttempt(meta)));
  check('13: an era-1 attempt has no cap',
    bonusCapForAttempt({ xpEconomyVersion: 1 }) === Infinity);
  check('13: an open-ended attempt has no attempt cap',
    bonusCapForAttempt({ xpEconomyVersion: 2, dailyBudget: 120 }) === Infinity);
  check('13: optional XP can never exceed a tenth of guaranteed XP',
    (() => {
      const b = 160, d = 30;
      const cap = bonusCapForAttempt({ xpEconomyVersion: 2, dailyBudget: b, durationDays: d });
      return cap / (b * d) <= 0.05;
    })());
}

// ══ 14: Fat Loss Hard's five weekly requirements are all real ══════════════
// The revision-1 audit claimed three of these were advertised but never
// tracked. That was wrong — it read the legacy module constant rather than the
// per-attempt defs. This pins the correct behaviour so the claim cannot be
// made again either way.
{
  const defs = FLH_weeklyDefs();
  check('14: Fat Loss Hard declares all five weekly requirements',
    defs.length === 5, defs.map(d => d.id).join(' '));
  const meta = { templateId: 'fat_loss_phase', name: 'FL', variant: 'hard',
    durationDays: 30, xpEconomyVersion: 2, effortTier: 'medium',
    dailyBudget: 160, weeklyRequirementDefs: repriceWeeklyDefs(defs, { dailyBudget: 160, xpEconomyVersion: 2 }) };
  check('14: the engine sees all five for the attempt',
    getWeeklyRequirementDefs(meta).length === 5);
  check('14: each one is worth XP', getWeeklyRequirementDefs(meta).every(d => d.xp >= 1),
    getWeeklyRequirementDefs(meta).map(d => `${d.id}:${d.xp}`).join(' '));

  // Logging every session for two weeks must pay for every requirement type.
  const start = dstr(-13);
  const sessions = [];
  for (let w = 0; w < 2; w++) {
    for (const d of getWeeklyRequirementDefs(meta)) {
      for (let k = 0; k < d.perWeek; k++) {
        const x = new Date(start + 'T00:00:00');
        x.setDate(x.getDate() + w * 7 + k);
        sessions.push({ type: d.id, date: `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` });
      }
    }
  }
  const wk = computeWeeklyRequirements({
    sessions, meta, challengeStart: start, currentRawDay: 15, penaltiesEnabled: true });
  check('14: every logged session is paid', wk.sessionXP > 0, String(wk.sessionXP));
  check('14: with everything logged nothing is charged as missed',
    wk.missedUnits === 0 && wk.missedPenalty === 0,
    `${wk.missedUnits} missed`);
  check('14: all five appear in the week the user is shown',
    (wk.current?.requirements || []).length === 5,
    (wk.current?.requirements || []).map(r => r.label).join(', '));

  // And missing them is charged, for every type.
  const none = computeWeeklyRequirements({
    sessions: [], meta, challengeStart: start, currentRawDay: 15, penaltiesEnabled: true });
  check('14: missing every session is charged', none.missedPenalty > 0, String(none.missedPenalty));
  // Two finalised weeks x 8 required sessions (3 lifts + 2 cardio + 1 interval
  // + 1 waist + 1 review).
  check('14: the charge covers all five requirement types, both weeks',
    none.missedUnits === 2 * getWeeklyRequirementDefs(meta).reduce((s, d) => s + d.perWeek, 0),
    String(none.missedUnits));
}

// ══ 15: the Daily Log keeps a real reward after the duplicates are removed ══
// Era 1 paid for filling in the Daily Log twice: once as the daily_log task and
// again as a +10 all-ratings bonus. Removing the duplicate must not leave the
// Daily Log worth nothing.
{
  const tasks = allocateTaskXP([
    { id: 'a', keystone: 3 }, { id: 'b', keystone: 2 },
    { id: 'daily_log', keystone: 1 },
  ], 160);
  const logTask = tasks.find(t => t.id === 'daily_log');
  check('15: the Daily Log is priced inside the budget', logTask.xp >= 1, String(logTask.xp));
  check('15: it is worth more than nothing and less than a keystone',
    logTask.xp > 0 && logTask.xp < tasks.find(t => t.id === 'a').xp,
    `${logTask.xp} vs keystone ${tasks.find(t => t.id === 'a').xp}`);

  const meta = { xpEconomyVersion: 2, dailyBudget: 160, durationDays: 30 };
  const rules = dayRules(meta);
  const withLog = computeDayXP(
    { tasks: { daily_log: true }, mood: 4, energy: 4, sleep: 4, stress: 3, recovery: 4 },
    tasks, null, 1, 2, true, 2, rules);
  const withoutLog = computeDayXP(
    { tasks: { a: true } }, tasks, null, 1, 2, true, 2, rules);
  check('15: completing the Daily Log still earns its XP',
    withLog.gained === logTask.xp, `${withLog.gained} vs ${logTask.xp}`);
  check('15: and ratings alone no longer pay a second time',
    withLog.gained === logTask.xp, 'no +10 on top');
  check('15: a day without the Daily Log earns less',
    withoutLog.gained < withLog.gained + tasks.find(t => t.id === 'a').xp);
}

// ══ 16: the same challenge is worth the same to both profiles ══════════════
// 75 Hard still carries a different task list per profile — 7 habits on one,
// 13 on the other — because they genuinely track different things. Under era 1
// that made the SAME challenge worth 95 XP/day to one profile and 155 to the
// other. The budget model fixes the inequity without flattening the lists:
// both divide one budget.
{
  const me = [
    { id: 'workout', keystone: 3 }, { id: 'diet', keystone: 3 }, { id: 'water', keystone: 1 },
    { id: 'reading', keystone: 1 }, { id: 'photo', keystone: 0 }, { id: 'mental', keystone: 2 },
    { id: 'daily_log', keystone: 1 },
  ];
  const gf = [
    { id: 'gf_workout', keystone: 3 }, { id: 'gf_diet', keystone: 3 }, { id: 'gf_photo', keystone: 0 },
    { id: 'gf_mental', keystone: 2 }, { id: 'gf_bed', keystone: 0 }, { id: 'gf_room', keystone: 0 },
    { id: 'gf_skin', keystone: 0 }, { id: 'gf_walk', keystone: 1 }, { id: 'gf_water', keystone: 1 },
    { id: 'gf_read', keystone: 1 }, { id: 'gf_meals', keystone: 0 }, { id: 'gf_screen', keystone: 0 },
    { id: 'daily_log', keystone: 1 },
  ];
  const stampFor = (tasks) => stampAttempt({
    meta: { templateId: '75_day_discipline_challenge', variant: 'standard', durationDays: 75 },
    tasks, template: { effort_tier: 'hard' },
  });
  const a = stampFor(me), b = stampFor(gf);
  const sum = (x) => x.tasks.reduce((s, t) => s + t.xp, 0);
  check('16: both profiles get the same daily budget',
    a.meta.dailyBudget === b.meta.dailyBudget && a.meta.dailyBudget === 200);
  check('16: and the same daily task total despite 7 vs 13 habits',
    sum(a) === sum(b) && sum(a) === 200, `${sum(a)} vs ${sum(b)}`);
  check('16: and the same completion bonus',
    a.meta.completionBonusXP === b.meta.completionBonusXP);
  check('16: each profile keeps its own habits',
    a.tasks.length === 7 && b.tasks.length === 13);
  // A perfect day is worth the same to both.
  const dayFor = (st) => computeDayXP(
    { tasks: Object.fromEntries(st.tasks.map(t => [t.id, true])) },
    st.tasks, null, 1, 2, true, 2, dayRules(st.meta)).gained;
  check('16: a perfect day is worth the same to both profiles',
    dayFor(a) === dayFor(b) && dayFor(a) === 230, `${dayFor(a)} vs ${dayFor(b)}`);
}

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
