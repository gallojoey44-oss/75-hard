/**
 * One ladder for every XP figure the user reads.
 *
 * Forge computes in each attempt's OWN stored units — that is what keeps the
 * eras isolated and lets an era-1 archive recompute to exactly what it ran
 * under, forever. Lifetime XP and the rank ladder are a single shared ladder,
 * so era-1 figures are multiplied by DISPLAY_SCALE[1] on the way out.
 *
 * Before `src/utils/xpDisplay.js` only the lifetime total crossed that
 * boundary. A legacy LOCK IN task row said "25 XP" and ticking it moved
 * Lifetime XP by 250: the balance was right, the reward was quoted in the
 * wrong currency.
 *
 * What is tested here is the ONE property that makes a reward figure true:
 *
 *     what a figure is shown to be worth
 *       == what completing it moves the lifetime balance by
 *
 * plus the two ways that property breaks:
 *
 *   SCALED TWICE   a figure that already crossed the boundary (Lifetime XP, the
 *                  rank floor, the reconciliation ledger) converted again, so a
 *                  legacy total reads 10x too high.
 *   MIXED SCALES   two figures from the same era rendered on different ladders
 *                  in one view — a task row in stored units under a total in
 *                  display units.
 *
 * Storage is checked as closely as display: nothing here may rewrite a record.
 */
import { displayXP, fmtXP, scaleOfMeta, scaleOfArchive, makeTaskXP } from '../src/utils/xpDisplay.js';
import {
  dayRules, displayScaleFor, DISPLAY_SCALE, CURRENT_ECONOMY_VERSION, economyVersionOf,
} from '../src/data/xpEconomy.js';
import { computeXPBreakdown, archiveDeficit } from '../src/utils/xpLedger.js';
import { computeDayXP, computeTotalXP, getTaskXP } from '../src/utils/gamification.js';
import { missedDayDetail, recentGap, buildXPHistory } from '../src/utils/missedDays.js';
import { stampAttempt, toDisplayXP, archiveEraOf } from '../src/utils/xpAttempt.js';
import { previewAttempt } from '../src/data/challengeAttempt.js';
import { getTemplateById } from '../src/data/challengeTemplates.js';
import { rankFloorXP, resolveRankState } from '../src/utils/rank.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function eq(name, got, want) {
  check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const dstr = (off) => {
  const d = new Date(); d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// An ERA-1 LOCK IN attempt: no stamp, tasks at their original values. Exactly
// what a profile that started before the rebalance still carries.
const ERA1_META = {
  templateId: 'lock_in_14_day', name: 'LOCK IN', variant: 'standard', durationDays: 14,
};
const ERA1_TASKS = [
  { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', xp: 40, keystone: 3, order: 0 },
  { id: 'li_attention', name: 'Attention training: 10+ minutes', xp: 25, keystone: 2, order: 1 },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 20, keystone: 0, order: 2 },
];

// An ERA-2 attempt, stamped the way the app stamps one at start.
const era2 = stampAttempt({
  meta: { ...ERA1_META, effort_tier: 'medium_hard' },
  tasks: ERA1_TASKS.map(t => ({ ...t })),
  template: null,
  version: 2,
});

// ── 1. The scale table and its carriers ─────────────────────────────────────

eq('era 1 stores XP a tenth the size of era 2', DISPLAY_SCALE[1], 10);
eq('era 2 is already on the display ladder', DISPLAY_SCALE[2], 1);
eq('an unstamped attempt resolves to era 1', economyVersionOf(ERA1_META), 1);
eq('dayRules carries the era-1 display scale', dayRules(ERA1_META).displayScale, 10);
eq('dayRules carries the era-2 display scale', dayRules(era2.meta).displayScale, 1);
eq('scaleOfMeta reads an unstamped attempt as era 1', scaleOfMeta(ERA1_META), 10);
eq('scaleOfMeta reads a stamped attempt as its era', scaleOfMeta(era2.meta), 1);
eq('the current era needs no conversion', displayScaleFor(CURRENT_ECONOMY_VERSION), 1);

eq('displayXP converts a legacy figure', displayXP(25, 10), 250);
eq('displayXP leaves an era-2 figure alone', displayXP(25, 1), 25);
eq('displayXP treats a missing scale as no conversion', displayXP(25, undefined), 25);
check('displayXP passes null through rather than printing 0', displayXP(null, 10) === null);
check('displayXP passes undefined through', displayXP(undefined, 10) === undefined);
eq('displayXP rounds rather than drifting', displayXP(2.5, 1), 3);
eq('fmtXP localises the converted figure', fmtXP(400, 10), (4000).toLocaleString());

// ── 2. Per-task reward figures ──────────────────────────────────────────────

const era1XP = makeTaskXP(ERA1_META);
const era2XP = makeTaskXP(era2.meta);

eq('the reported legacy task shows 250, not 25', era1XP(ERA1_TASKS[1]), 250);
eq('a legacy keystone shows 400, not 40', era1XP(ERA1_TASKS[0]), 400);
eq('the legacy Daily Log shows 200, not 20', era1XP(ERA1_TASKS[2]), 200);
check('an era-2 task row is unchanged by the conversion',
  era2.tasks.every(t => era2XP(t) === t.xp),
  JSON.stringify(era2.tasks.map(t => [t.xp, era2XP(t)])));
check('the reader carries its attempt rate card', era1XP.rules.version === 1 && era2XP.rules.version === 2);
eq('a task with no stored xp still uses the era-1 fallback', era1XP({ id: 'legacy_unknown' }), 100);

// Storage is untouched: the conversion is a multiply at read time.
check('converting for display never rewrites a task',
  ERA1_TASKS[1].xp === 25 && getTaskXP(ERA1_TASKS[1], dayRules(ERA1_META)) === 25);

// ── 3. Display == the movement in the balance ───────────────────────────────
//
// The invariant. For a day on an era-1 attempt: the sum of the figures the task
// rows advertise, plus the advertised perfect-day bonus, must equal the change
// in Lifetime XP that computeXPBreakdown reports for ticking all of them.

const START = dstr(-2);                       // Day 3 of a running attempt
const profilesFor = (days) => ({ me: {
  challengeStart: START, activeChallenge: ERA1_META, tasks: ERA1_TASKS,
  xpPenalties: false, xpStartDay: 1, xpOffset: 0, weeklySessions: [], comebackHistory: [],
} });
const completionOf = (days) => (n) => {
  const d = days[n];
  if (!d) return 0;
  return Math.round((ERA1_TASKS.filter(t => d.tasks?.[t.id]).length / ERA1_TASKS.length) * 100);
};
const lifetimeFor = (days) => {
  const seg = computeTotalXP({ me: days }, profilesFor(days), 'me', completionOf(days), 3, 3);
  return computeXPBreakdown({
    archives: [], currentSegment: seg, ledger: null, currentEra: economyVersionOf(ERA1_META),
  }).net;
};

const emptyDay = { 3: { date: dstr(0), tasks: {} } };
const oneTicked = { 3: { date: dstr(0), tasks: { li_attention: true } } };
const allTicked = { 3: { date: dstr(0), tasks: { li_sleep: true, li_attention: true, daily_log: true } } };

const liftOne = lifetimeFor(oneTicked) - lifetimeFor(emptyDay);
eq('ticking the 250 XP task moves Lifetime XP by exactly 250', liftOne, era1XP(ERA1_TASKS[1]));
check('and by ten times the stored value, once — never twice',
  liftOne === ERA1_TASKS[1].xp * DISPLAY_SCALE[1], `moved ${liftOne}`);

const liftAll = lifetimeFor(allTicked) - lifetimeFor(emptyDay);
const advertised = ERA1_TASKS.reduce((s, t) => s + era1XP(t), 0)
  + displayXP(dayRules(ERA1_META).perfectDay, dayRules(ERA1_META).displayScale);
eq('a full day pays exactly what the rows and the bonus advertise', liftAll, advertised);

// The same property on era 2, where the scale is 1 — the conversion must be a
// no-op there, or the rebalanced economy would be inflated.
const e2profiles = { me: {
  challengeStart: START, activeChallenge: era2.meta, tasks: era2.tasks,
  xpPenalties: false, xpStartDay: 1, xpOffset: 0, weeklySessions: [], comebackHistory: [],
} };
const e2days = { 3: { date: dstr(0), tasks: Object.fromEntries(era2.tasks.map(t => [t.id, true])) } };
const e2completion = (n) => (e2days[n] ? 100 : 0);
const e2net = computeXPBreakdown({
  archives: [],
  currentSegment: computeTotalXP({ me: e2days }, e2profiles, 'me', e2completion, 3, 3),
  ledger: null, currentEra: 2,
}).net;
const e2advertised = era2.tasks.reduce((s, t) => s + era2XP(t), 0) + dayRules(era2.meta).perfectDay;
eq('an era-2 day pays exactly what its rows advertise, unscaled', e2net, e2advertised);

// ── 4. Scaled exactly once ──────────────────────────────────────────────────

const ARCH_ERA1 = {
  id: 'arch_old', archivedAt: START, challengeStart: dstr(-40), endDate: dstr(-11), endDayNum: 30,
  challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30 },
  days: {}, tasks: [], xpEarned: 4000, completed: true,
};
const ARCH_ERA2 = {
  ...ARCH_ERA1, id: 'arch_new',
  challenge: { ...ARCH_ERA1.challenge, xpEconomyVersion: 2 }, xpEarned: 4000,
};

eq('an unstamped archive is era 1', archiveEraOf(ARCH_ERA1), 1);
eq('a stamped archive keeps its era', archiveEraOf(ARCH_ERA2), 2);
eq('scaleOfArchive follows the archive stamp', scaleOfArchive(ARCH_ERA1), 10);
eq('scaleOfArchive leaves an era-2 archive alone', scaleOfArchive(ARCH_ERA2), 1);

const bOne = computeXPBreakdown({ archives: [ARCH_ERA1], currentSegment: { gained: 0, lost: 0 }, ledger: null, currentEra: 1 });
eq('a 4,000 XP legacy archive reads 40,000 — once', bOne.archivedXP, 40000);
eq('and contributes exactly that to the balance', bOne.net, 40000);
const bTwice = computeXPBreakdown({ archives: [ARCH_ERA1], currentSegment: { gained: 0, lost: 0 }, ledger: null, currentEra: 1 });
eq('reading the breakdown again gives the same figure (idempotent)', bTwice.net, bOne.net);
check('the archive record itself is unchanged', ARCH_ERA1.xpEarned === 4000);
eq('an era-2 archive is not scaled at all',
  computeXPBreakdown({ archives: [ARCH_ERA2], currentSegment: { gained: 0, lost: 0 }, ledger: null, currentEra: 2 }).net,
  4000);

// A ledger amount written in display units carries `ledgerUnits` and must not
// be converted a second time.
const e2ledger = { reconciled: { amount: 5000, ledgerUnits: 2 } };
eq('an era-2 ledger charge is not scaled twice',
  computeXPBreakdown({ archives: [], currentSegment: { gained: 0, lost: 0 }, ledger: e2ledger, currentEra: 2 }).grossPenalties,
  5000);
eq('a pre-era-2 ledger charge is converted once',
  computeXPBreakdown({ archives: [], currentSegment: { gained: 0, lost: 0 }, ledger: { reconciled: { amount: 500 } }, currentEra: 1 }).grossPenalties,
  5000);

// The rank floor is already on the display ladder. Converting it would move a
// rank's threshold, so it must pass through untouched.
const floor = rankFloorXP(5);
const rank = resolveRankState({ rawLifetimeXP: bOne.net, highestRank: 5 });
eq('the rank floor is read in display units, never converted', rank.floorXP, floor);
check('a legacy balance above its floor is reported as it stands',
  rank.xp === 40000, `rank.xp ${rank.xp}`);
check('the Unbreakable benchmark is untouched by the conversion',
  rankFloorXP(5) === floor && floor > 0);

// ── 5. Penalties under the attempt's own rules ──────────────────────────────
//
// missedDayDetail took no rate card, so it reported the era-1 flat miss for an
// era-2 attempt while the balance was charged a share of that attempt's budget.

const gapDays = { 1: { date: dstr(-2), tasks: { li_sleep: true, li_attention: true, daily_log: true } } };
const era1Miss = missedDayDetail({
  days: gapDays, tasks: ERA1_TASKS, meta: ERA1_META, challengeStart: dstr(-4),
  rawDay: 5, dayNum: 5, penaltiesEnabled: true, xpStartDay: 1,
});
eq('an era-1 missed day costs the era-1 flat rate', era1Miss.totalPenalty / era1Miss.missedDays, dayRules(ERA1_META).missedDay);

const era2Miss = missedDayDetail({
  days: { 1: { date: dstr(-2), tasks: Object.fromEntries(era2.tasks.map(t => [t.id, true])) } },
  tasks: era2.tasks, meta: era2.meta, challengeStart: dstr(-4),
  rawDay: 5, dayNum: 5, penaltiesEnabled: true, xpStartDay: 1,
});
eq('an era-2 missed day costs a share of that attempt\'s budget',
  era2Miss.totalPenalty / era2Miss.missedDays, dayRules(era2.meta).missedDay);
check('the two eras charge different amounts, so the rate card is being read',
  dayRules(ERA1_META).missedDay !== dayRules(era2.meta).missedDay,
  `era1 ${dayRules(ERA1_META).missedDay} vs era2 ${dayRules(era2.meta).missedDay}`);

// The detail has to agree with what the segment was actually charged.
const chargedDays = { ...gapDays };
const chargedProfiles = { me: {
  challengeStart: dstr(-4), activeChallenge: ERA1_META, tasks: ERA1_TASKS,
  xpPenalties: true, xpStartDay: 1, xpOffset: 0, weeklySessions: [], comebackHistory: [],
} };
const chargedSeg = computeTotalXP({ me: chargedDays }, chargedProfiles, 'me', completionOf(chargedDays), 5, 5);
eq('the missed-day breakdown adds up to the segment\'s own loss', era1Miss.totalPenalty, chargedSeg.lost);

const gap = recentGap({
  days: gapDays, tasks: ERA1_TASKS, meta: ERA1_META, challengeStart: dstr(-4),
  rawDay: 5, dayNum: 5, penaltiesEnabled: true, xpStartDay: 1,
});
check('the comeback notice reports the same stored penalty the segment lost',
  gap && gap.penalty === chargedSeg.lost, gap ? `gap ${gap.penalty} vs ${chargedSeg.lost}` : 'no gap');
eq('converted for the notice, that penalty is on the lifetime ladder',
  displayXP(gap.penalty, scaleOfMeta(ERA1_META)), chargedSeg.lost * 10);

// ── 6. No mixed scales inside one view ──────────────────────────────────────
//
// XP History prints its rows above a reconciliation against the lifetime
// balance. Rows in stored units under a display-units total would read as a
// tenfold accounting error, so every row carries its own era's scale.

const histRows = buildXPHistory({
  archives: [ARCH_ERA1, ARCH_ERA2],
  archiveDetail: archiveDeficit,
  current: { id: 'current', name: 'LOCK IN', startDate: START, endDate: null,
    banked: 85, earned: 85, penalties: 0, partialPenalties: 0, missedDays: 0, detailAvailable: true },
});
const scaled = histRows.map(r => {
  const scale = r.archived
    ? scaleOfArchive([ARCH_ERA1, ARCH_ERA2].find(a => a.id === r.id))
    : scaleOfMeta(ERA1_META);
  return { ...r, banked: displayXP(r.banked, scale) };
});
eq('the legacy archive row reads 40,000', scaled.find(r => r.id === 'arch_old').banked, 40000);
eq('the era-2 archive row reads 4,000', scaled.find(r => r.id === 'arch_new').banked, 4000);
eq('the live legacy row reads 850', scaled.find(r => r.id === 'current').banked, 850);

const breakdownTotal = computeXPBreakdown({
  archives: [ARCH_ERA1, ARCH_ERA2],
  currentSegment: { gained: 85, lost: 0 }, ledger: null, currentEra: 1,
}).net;
eq('the rows sum to the reconciliation beneath them',
  scaled.reduce((s, r) => s + r.banked, 0), breakdownTotal);

// A row read in stored units under that total is the defect this guards.
check('an unconverted row would NOT reconcile, which is why this is asserted',
  histRows.reduce((s, r) => s + r.banked, 0) !== breakdownTotal);

// ── 7. The library advertises what starting installs ───────────────────────

const preview = previewAttempt({
  template: getTemplateById('mental_training_phase'), variant: 'standard',
});
check('a preview is of a new attempt, so it carries the current era',
  preview && preview.era === CURRENT_ECONOMY_VERSION);
eq('a preview needs no conversion', preview.displayScale, 1);
check('the advertised per-task figures are the figures the rows will show',
  preview.tasks.every(t => makeTaskXP(preview.meta)(t) === t.xp));

// ── 8. Era isolation: neither era can see the other's rules ────────────────

eq('an era-1 attempt keeps its flat perfect-day bonus', dayRules(ERA1_META).perfectDay, 50);
check('an era-2 attempt derives its bonus from its budget',
  dayRules(era2.meta).perfectDay === Math.round(dayRules(era2.meta).dailyBudget * 0.15),
  `perfectDay ${dayRules(era2.meta).perfectDay}, budget ${dayRules(era2.meta).dailyBudget}`);
eq('the era-1 task fallback stays era-1 only', dayRules(era2.meta).legacyTaskFallback, false);
const e1Day = computeDayXP(allTicked[3], ERA1_TASKS, 'me', 3, 3, false, 3, dayRules(ERA1_META));
eq('an era-1 day still computes the exact stored total it always did', e1Day.gained, 40 + 25 + 20 + 50);
check('and its display is that total times ten, not a recalculation',
  displayXP(e1Day.gained, 10) === liftAll, `${displayXP(e1Day.gained, 10)} vs ${liftAll}`);
eq('toDisplayXP and displayXP agree on a legacy figure', toDisplayXP(25, 1), displayXP(25, 10));

// ── Summary ────────────────────────────────────────────────────────────────

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
