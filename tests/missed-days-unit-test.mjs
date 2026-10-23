/**
 * Missed days: the recent notice versus the permanent record.
 *
 * The Rank Details card showed one standing "XP Lost from Missed Days" figure,
 * so a deduction from weeks ago read as an ongoing penalty. The split tested
 * here is: a temporary notice for a gap you have just come back from, and a
 * permanent per-challenge record tucked into XP History.
 *
 * The properties that matter most, and are therefore tested hardest:
 *   • the unfinished current day is NEVER counted as missed;
 *   • the same gap is never announced twice;
 *   • the history reconciles with the balance.
 */
import {
  missedDayDetail, recentGap, shouldShowComeback, buildXPHistory,
  MIN_GAP_DAYS, NOTICE_WINDOW_DAYS,
} from '../src/utils/missedDays.js';
import { computeXPBreakdown, makeLedger, archiveDeficit, LEDGER_VERSION } from '../src/utils/xpLedger.js';
import { computeTotalXP } from '../src/utils/gamification.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const dstr = (off) => {
  const d = new Date(); d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const TASKS = [
  { id: 't_sleep', name: 'Sleep', xp: 40, keystone: 3 },
  { id: 't_flow', name: 'Flow', xp: 35, keystone: 3 },
];
const META = { templateId: 'lock_in_14_day', name: 'LOCK IN', durationDays: 14 };
const done = () => ({ tasks: { t_sleep: true, t_flow: true } });

/** The day-completion callback the archive recomputation uses. */
const storedCompletion = (days) => (n) => {
  const d = days[n];
  if (!d || !TASKS.length) return 0;
  return Math.round((TASKS.filter(t => d.tasks?.[t.id]).length / TASKS.length) * 100);
};

/** Build inputs for a run that started `startedDaysAgo` ago with `days` logged. */
function inputs(days, startedDaysAgo) {
  return {
    days, tasks: TASKS, meta: META,
    challengeStart: dstr(-startedDaysAgo),
    rawDay: startedDaysAgo + 1,
    penaltiesEnabled: true, xpStartDay: 1,
  };
}

// ══ 1: the current day is never a missed day ═══════════════════════════════
// Day 10 is today and unfinished. It cannot have been missed.
{
  const days = { 1: done(), 2: done() };
  const d = missedDayDetail(inputs(days, 9));             // rawDay 10
  check('1: today is excluded from the missed list',
    !d.missed.some(m => m.dayNum === 10), d.missed.map(m => m.dayNum).join(','));
  check('1: only finalised days are counted', d.missedDays === 7, `${d.missedDays}`);
  check('1: the penalty is the real charge for those days', d.totalPenalty === 7 * 25, `${d.totalPenalty}`);
  check('1: a brand-new run on day 1 has no missed days',
    missedDayDetail(inputs({}, 0)).missedDays === 0);
  check('1: a run where every day was logged has none either',
    missedDayDetail(inputs({ 1: done(), 2: done(), 3: done() }, 3)).missedDays === 0);
}

// ══ 2: the gap you have just returned from ═════════════════════════════════
{
  // Days 1–2 logged, 3–8 missed, 9 logged, 10 is today.
  const days = { 1: done(), 2: done(), 9: done() };
  const gap = recentGap(inputs(days, 9));
  check('2: the gap is found', !!gap);
  check('2: six missed days', gap.missedDays === 6, `${gap.missedDays}`);
  check('2: costing 150 XP', gap.penalty === 150, `${gap.penalty}`);
  check('2: it spans the right days', gap.fromDay === 3 && gap.toDay === 8);
  check('2: it carries real dates', !!gap.fromDate && !!gap.toDate);
  check('2: one day of renewed activity is recorded', gap.daysSinceReturn === 1, `${gap.daysSinceReturn}`);
  check('2: the notice would show', shouldShowComeback(gap, null));
}

// ══ 3: the same gap is never announced twice ═══════════════════════════════
{
  const days = { 1: done(), 2: done(), 9: done() };
  const gap = recentGap(inputs(days, 9));
  check('3: the key identifies the stretch of time, not the moment of reading',
    gap.key === `${dstr(-9)}|3-8`, gap.key);
  check('3: recomputing gives an identical key — reloads do not create a new event',
    recentGap(inputs(days, 9)).key === gap.key &&
    recentGap(inputs(days, 9)).key === recentGap(inputs(days, 9)).key);
  check('3: once dismissed it does not show again', !shouldShowComeback(gap, gap.key));
  check('3: but a LATER, different gap is announced on its own',
    (() => {
      const later = { ...days, 10: done(), 11: done(), 15: done() };
      const g2 = recentGap(inputs(later, 15));            // rawDay 16
      return g2 && g2.key !== gap.key && shouldShowComeback(g2, gap.key);
    })());
  check('3: dismissing the later gap does not resurrect the earlier one',
    (() => {
      const later = { ...days, 10: done(), 11: done(), 15: done() };
      const g2 = recentGap(inputs(later, 15));
      return !shouldShowComeback(g2, g2.key);
    })());
}

// ══ 4: the notice is temporary ═════════════════════════════════════════════
{
  const base = { 1: done(), 2: done() };
  const after = (activeDays) => {
    const days = { ...base };
    for (let i = 0; i < activeDays; i++) days[9 + i] = done();
    return recentGap(inputs(days, 8 + activeDays));
  };
  check('4: it shows on the day you come back', shouldShowComeback(after(1), null));
  check('4: it still shows a couple of days later',
    shouldShowComeback(after(NOTICE_WINDOW_DAYS), null));
  check('4: it stops on its own once you are plainly back',
    !shouldShowComeback(after(NOTICE_WINDOW_DAYS + 2), null),
    `after ${NOTICE_WINDOW_DAYS + 2} active days`);
  check('4: a single missed day is not a comeback',
    (() => {
      const days = { 1: done(), 2: done(), 4: done() };
      return recentGap(inputs(days, 4)) === null && MIN_GAP_DAYS === 2;
    })());
  check('4: no gap at all returns null, not a zero-day notice',
    recentGap(inputs({ 1: done(), 2: done(), 3: done() }, 3)) === null);
  check('4: a run that has not begun produces nothing',
    recentGap({ ...inputs({}, 0), rawDay: null }) === null);
}

// ══ 5: the figures are the real ones ═══════════════════════════════════════
{
  const days = { 1: done(), 2: done(), 9: done() };
  const gap = recentGap(inputs(days, 9));
  const full = computeTotalXP(
    { p: days },
    { p: { challengeStart: dstr(-9), activeChallenge: META, tasks: TASKS, xpPenalties: true, xpStartDay: 1 } },
    'p', () => 0, 10, 10,
  );
  check('5: the gap penalty is a real subset of what the XP system charged',
    gap.penalty <= full.lost && gap.penalty > 0, `gap ${gap.penalty} of ${full.lost}`);
  check('5: with penalties disabled nothing is charged',
    recentGap({ ...inputs(days, 9), penaltiesEnabled: false }).penalty === 0);
  check('5: the missed-day count is unaffected by the penalty setting',
    recentGap({ ...inputs(days, 9), penaltiesEnabled: false }).missedDays === gap.missedDays);
}

// ══ 6: XP History — per period, and it reconciles ══════════════════════════
{
  const healthyDays = {};
  for (let i = 1; i <= 14; i++) healthyDays[i] = done();
  const archive = {
    id: 'a1', archivedAt: dstr(-20), challengeStart: dstr(-34), endDate: dstr(-21),
    challenge: { templateId: 'x', name: 'Discipline Block', durationDays: 14 },
    endDayNum: 14, xpStartDay: 1, xpOffset: 0, tasks: TASKS, days: healthyDays,
    xpEarned: 0, weeklySessions: [], comebackHistory: [],
  };
  // Make the stored figure match what the rules produce, so it verifies.
  const truth = computeTotalXP(
    { p: healthyDays },
    { p: { challengeStart: archive.challengeStart, activeChallenge: archive.challenge, tasks: TASKS, xpPenalties: true, xpStartDay: 1 } },
    'p', () => 100, 14, 14,
  );
  archive.xpEarned = Math.max(0, truth.rawTotal);

  const live = {
    id: 'current', name: 'LOCK IN', startDate: dstr(-9), endDate: null,
    banked: 120, earned: 200, penalties: 80, missedDays: 3, detailAvailable: true,
  };
  const rows = buildXPHistory({ archives: [archive], archiveDetail: archiveDeficit, current: live });
  check('6: every archive plus the live challenge is listed', rows.length === 2);
  check('6: the archived row is marked as archived and the live one is not',
    rows[0].archived === true && rows[1].archived === false);
  check('6: an archived row carries its name, dates and banked XP',
    rows[0].name === 'Discipline Block' && !!rows[0].startDate && !!rows[0].endDate &&
    rows[0].banked === archive.xpEarned);
  check('6: a readable archive reports earned, penalties and missed days',
    rows[0].detailAvailable && rows[0].earned > 0 && rows[0].missedDays === 0);
  check('6: an unreadable archive says so rather than erroring',
    (() => {
      const bad = buildXPHistory({ archives: [{ ...archive, xpEarned: 99999 }], archiveDetail: archiveDeficit });
      return bad[0].detailAvailable === false && bad[0].banked === 99999 && bad[0].earned === null;
    })());
  check('6: history with no archives and no live challenge is empty',
    buildXPHistory({ archives: [], archiveDetail: archiveDeficit, current: null }).length === 0);
}

// ══ 7: the totals reconcile ════════════════════════════════════════════════
// A history that does not add up to the balance is worse than no history.
{
  const cases = [
    { archives: [{ xpEarned: 8285 }], seg: { gained: 0, lost: 25 }, ledger: makeLedger() },
    { archives: [{ xpEarned: 8285 }], seg: { gained: 200, lost: 150 }, ledger: { version: LEDGER_VERSION, reconciled: { amount: 760 }, forgiven: 0 } },
    { archives: [{ xpEarned: 7600 }], seg: { gained: 76, lost: 725 }, ledger: { version: LEDGER_VERSION, reconciled: null, forgiven: 549 } },
    { archives: [], seg: { gained: 40, lost: 0 }, ledger: makeLedger() },
  ];
  check('7: earned − penalties + protection = Current XP, in every case',
    cases.every(c => {
      const b = computeXPBreakdown({ archives: c.archives, currentSegment: c.seg, ledger: c.ledger });
      return b.earned - b.grossPenalties + b.forgiven === b.net;
    }));
  check('7: the deductions shown are never negative',
    cases.every(c => computeXPBreakdown({ archives: c.archives, currentSegment: c.seg, ledger: c.ledger }).grossPenalties >= 0));
  // These fixtures are era-1, so the breakdown converts them x10 on read.
  check('7: protection is reported separately, so nothing is hidden',
    (() => {
      const b = computeXPBreakdown({ archives: cases[2].archives, currentSegment: cases[2].seg, ledger: cases[2].ledger, currentEra: 1 });
      return b.forgiven === 549 * 10 && b.grossPenalties === 725 * 10;
    })(), (() => {
      const b = computeXPBreakdown({ archives: cases[2].archives, currentSegment: cases[2].seg, ledger: cases[2].ledger, currentEra: 1 });
      return `forgiven ${b.forgiven}, gross ${b.grossPenalties}`;
    })());
}

// ══ 8: completing a challenge does not refund its penalties ════════════════
// The live row moves into the archived list; the XP stays deducted.
{
  const days = { 1: done(), 2: done(), 9: done() };
  const profiles = { p: { challengeStart: dstr(-9), activeChallenge: META, tasks: TASKS, xpPenalties: true, xpStartDay: 1 } };
  const seg = computeTotalXP({ p: days }, profiles, 'p', () => 0, 10, 10);
  const banked = Math.max(0, seg.rawTotal);
  // After archiving: the banked figure is what carries forward.
  // The archive is era-1 (no stamp), so its banked figure converts x10.
  const afterArchive = computeXPBreakdown({
    archives: [{ xpEarned: banked }], currentSegment: { gained: 0, lost: 0 }, ledger: makeLedger(), currentEra: 1,
  });
  check('8: the penalties are still reflected in what was banked',
    banked === seg.gained - seg.lost && seg.lost > 0, `banked ${banked} from ${seg.gained}−${seg.lost}`);
  check('8: completing the challenge does not refund them',
    afterArchive.net === banked * 10, `${afterArchive.net} vs ${banked * 10}`);
  check('8: and the new challenge starts with no inherited penalty',
    afterArchive.grossPenalties === 0);
  check('8: a fresh challenge shows no missed days of its own',
    missedDayDetail({ ...inputs({}, 0), challengeStart: dstr(0), rawDay: 1 }).missedDays === 0);
}

// ══ 9: the gap belongs to the current segment only ═════════════════════════
// Starting a new challenge resets the clock, so an old gap cannot follow the
// user into it.
{
  check('9: a new challenge on day 1 reports no gap',
    recentGap({ days: {}, tasks: TASKS, meta: META, challengeStart: dstr(0), rawDay: 1 }) === null);
  check('9: a new challenge on day 2 with day 1 logged reports no gap',
    recentGap({ days: { 1: done() }, tasks: TASKS, meta: META, challengeStart: dstr(-1), rawDay: 2 }) === null);
  check('9: the key includes the challenge start, so two challenges never collide',
    (() => {
      const a = recentGap(inputs({ 1: done(), 9: done() }, 9));
      const b = recentGap({ ...inputs({ 1: done(), 9: done() }, 9), challengeStart: dstr(-40) });
      return a && b && a.key !== b.key;
    })());
}

// ══ 10: the archived count agrees with the archived charge ═════════════════
// An archive once reported one more missed day than it had charged for,
// because the counter ran through the final day (which is treated as that
// segment's current day and never penalised) and judged activity by ticked
// tasks alone. "7 days missed" beside a penalty for six is exactly the kind
// of inconsistency XP History must not contain.
{
  const days = { 1: done(), 2: done(), 9: done() };
  const live = missedDayDetail(inputs(days, 9));
  const archived = archiveDeficit({
    id: 'a1', challengeStart: dstr(-9), endDate: dstr(0), challenge: META,
    endDayNum: 10, xpStartDay: 1, xpOffset: 0, tasks: TASKS, days,
    // What the app itself would have banked, derived the same way the archive
    // recomputation derives it — including the day-completion callback, since
    // a different one changes the streak bonuses and the figure would not
    // reproduce.
    xpEarned: Math.max(0, (() => {
      const seg = computeTotalXP({ p: days }, { p: {
        challengeStart: dstr(-9), activeChallenge: META, tasks: TASKS,
        xpPenalties: true, xpStartDay: 1, xpOffset: 0,
      } }, 'p', storedCompletion(days), 10, 10);
      return seg.gained - seg.lost;
    })()),
  });
  check('10: the archive could be recomputed', archived.verified, archived.reason || '');
  check('10: archiving does not invent an extra missed day',
    archived.missedDays === live.missedDays,
    `archived ${archived.missedDays} vs live ${live.missedDays}`);
  check('10: and the count matches what was actually charged',
    archived.missedDays * 25 === live.totalPenalty &&
    archived.missedPenalty === live.totalPenalty,
    `${archived.missedDays} × 25 vs ${live.totalPenalty}, archived ${archived.missedPenalty}`);
  // A day that was logged but left incomplete costs XP too, and that cost is
  // not a missed day. Reported separately, so "N days missed" always equals
  // N × 25 and a user can check the arithmetic.
  check('10: penalties from unfinished days are reported apart from missed days',
    (() => {
      const partial = { ...days, 5: { tasks: { t_sleep: true } } };
      const seg = computeTotalXP({ p: partial }, { p: {
        challengeStart: dstr(-9), activeChallenge: META, tasks: TASKS,
        xpPenalties: true, xpStartDay: 1, xpOffset: 0,
      } }, 'p', storedCompletion(partial), 10, 10);
      const d = archiveDeficit({
        id: 'a3', challengeStart: dstr(-9), endDate: dstr(0), challenge: META,
        endDayNum: 10, xpStartDay: 1, xpOffset: 0, tasks: TASKS, days: partial,
        xpEarned: Math.max(0, seg.gained - seg.lost),
      });
      return d.verified && d.missedDays === 5 && d.missedPenalty === 125 &&
        d.lost > d.missedPenalty;
    })());
  check('10: a day with only wellness ratings logged is not called missed',
    (() => {
      const withRatings = { ...days, 4: { mood: 4, energy: 3 } };
      const seg = computeTotalXP({ p: withRatings }, { p: {
        challengeStart: dstr(-9), activeChallenge: META, tasks: TASKS,
        xpPenalties: true, xpStartDay: 1, xpOffset: 0,
      } }, 'p', storedCompletion(withRatings), 10, 10);
      const d = archiveDeficit({
        id: 'a2', challengeStart: dstr(-9), endDate: dstr(0), challenge: META,
        endDayNum: 10, xpStartDay: 1, xpOffset: 0, tasks: TASKS, days: withRatings,
        xpEarned: Math.max(0, seg.gained - seg.lost),
      });
      return d.verified && d.missedDays === live.missedDays - 1;
    })(),
  );
}

// ══ 11: the segment-end bound ══════════════════════════════════════════════
// A challenge that has run past its duration must not report missed days
// beyond its final day — those were never charged. But an absent bound has to
// mean "no cap", or it would silently suppress every missed day instead.
{
  const days = { 1: done() };
  const open = missedDayDetail(inputs(days, 9));
  check('11: with no cap, every past day counts',
    open.missedDays === 8, String(open.missedDays));
  check('11: a cap stops the count at the segment end',
    missedDayDetail({ ...inputs(days, 9), dayNum: 5 }).missedDays === 4,
    String(missedDayDetail({ ...inputs(days, 9), dayNum: 5 }).missedDays));
  for (const absent of [null, undefined, 0]) {
    check(`11: dayNum ${String(absent)} means no cap, not zero days`,
      missedDayDetail({ ...inputs(days, 9), dayNum: absent }).missedDays === open.missedDays);
  }
  check('11: the gap search respects the same bound',
    recentGap({ ...inputs({ 1: done(), 5: done() }, 9), dayNum: 5 })?.toDay === 4,
    JSON.stringify(recentGap({ ...inputs({ 1: done(), 5: done() }, 9), dayNum: 5 })));
}

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
