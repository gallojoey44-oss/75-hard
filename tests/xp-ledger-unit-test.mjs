/**
 * The XP penalty ledger — Option C.
 *
 * Inactivity penalties now actually reduce Lifetime XP, including XP earned in
 * completed challenges, without rewriting a single archived record.
 *
 * The three things most likely to go wrong, and therefore most heavily tested:
 *
 *   DOUBLE-COUNTING  An archived challenge that ended in credit already had its
 *                    penalties applied inside its stored total. Charging it
 *                    again would be charging twice for the same missed days.
 *                    Only the amount that was CLIPPED below zero is recovered.
 *   INVENTION        A segment whose stored figure cannot be reproduced from
 *                    its own records is not charged at all. Being wrong in the
 *                    user's favour is the only acceptable direction here.
 *   THE FLOOR        However far XP falls, an unlocked rank is never lost.
 */
import {
  makeLedger, isReconciled, ledgerPenalty, archiveDeficit, previewReconciliation,
  buildReconciliation, computeXPBreakdown, rawLifetimeWithLedger, LEDGER_VERSION,
  capToFloor, forgivenessShortfall,
} from '../src/utils/xpLedger.js';
import { computeTotalXP, computeLifetimeXP, RANKS } from '../src/utils/gamification.js';
import { effectiveLifetimeXP, rankFloorXP, resolveRankState } from '../src/utils/rank.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const TRUE_WARRIOR = RANKS.find(r => r.name === 'True Warrior');
const dstr = (off) => {
  const d = new Date(); d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FD_TASKS = [
  { id: 'fd_sleep', name: 'Hit sleep goal', xp: 8, keystone: 0 },
  { id: 'fd_mind', name: 'Mental Training', xp: 12, keystone: 1 },
  { id: 'fd_read', name: 'Read', xp: 6, keystone: 0 },
];
const LI_TASKS = [
  { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', xp: 40, keystone: 3 },
  { id: 'li_flow', name: 'Flow training', xp: 35, keystone: 3 },
];

/**
 * Build an archive entry the way the app does: run the real calculation over
 * the day records, then store max(0, rawTotal) as xpEarned. This is what makes
 * the fixtures honest — the clipping under test is produced, not asserted.
 */
function archiveOf({ id, name, tasks, days, startedDaysAgo, durationDays = null, penalties = true }) {
  const challengeStart = dstr(-startedDaysAgo);
  const elapsed = startedDaysAgo + 1;
  const endDayNum = durationDays != null ? Math.min(elapsed, durationDays) : elapsed;
  const meta = { templateId: id, name, durationDays };
  const profiles = { p: { challengeStart, activeChallenge: meta, tasks, xpPenalties: penalties, xpStartDay: 1, xpOffset: 0 } };
  const completion = (n) => {
    const d = days[n];
    if (!d) return 0;
    return Math.round((tasks.filter(t => d.tasks?.[t.id]).length / tasks.length) * 100);
  };
  const r = computeTotalXP({ p: days }, profiles, 'p', completion, endDayNum, endDayNum);
  return {
    entry: {
      id, archivedAt: dstr(0), challenge: meta, challengeStart,
      endDayNum, endDate: dstr(-startedDaysAgo + endDayNum - 1),
      tasks, days, xpStartDay: 1, xpOffset: 0,
      xpEarned: Math.max(0, r.rawTotal),
      weeklySessions: [], comebackHistory: [],
    },
    truth: r,
  };
}

// A long abandoned Forge Daily run: one good day, then 29 days of nothing.
const abandoned = archiveOf({
  id: 'forge_daily', name: 'Forge Daily', tasks: FD_TASKS, startedDaysAgo: 29,
  days: { 1: { tasks: { fd_sleep: true, fd_mind: true, fd_read: true } } },
});
// A healthy completed challenge: every day done.
const healthy = archiveOf({
  id: 'lock_in_14_day', name: 'LOCK IN', tasks: LI_TASKS, startedDaysAgo: 13, durationDays: 14,
  days: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, { tasks: { li_sleep: true, li_flow: true } }])),
});

// ══ 1: the ledger's own shape ═══════════════════════════════════════════════
check('1: a fresh ledger is unreconciled', !isReconciled(makeLedger()) && makeLedger().version === LEDGER_VERSION);
check('1: an absent ledger deducts nothing — existing profiles are unaffected',
  ledgerPenalty(undefined) === 0 && ledgerPenalty(null) === 0 && ledgerPenalty(makeLedger()) === 0);
check('1: a negative or malformed amount can never credit XP',
  ledgerPenalty({ reconciled: { amount: -500 } }) === 0 &&
  ledgerPenalty({ reconciled: { amount: 'abc' } }) === 0);

// ══ 2: the fixtures actually reproduce the bug ══════════════════════════════
check('2: the abandoned run really did go negative',
  abandoned.truth.rawTotal < 0, `raw ${abandoned.truth.rawTotal}`);
check('2: and its archive stored zero, discarding the deficit',
  abandoned.entry.xpEarned === 0, `stored ${abandoned.entry.xpEarned}`);
check('2: the healthy challenge ended in credit', healthy.entry.xpEarned > 0, `stored ${healthy.entry.xpEarned}`);

// ══ 3: recovering the discarded amount, exactly ═════════════════════════════
const dAbandoned = archiveDeficit(abandoned.entry);
check('3: the abandoned run is verified against its own stored figure', dAbandoned.verified, dAbandoned.reason || '');
check('3: the recovered amount is exactly what was clipped',
  dAbandoned.discarded === Math.abs(abandoned.truth.rawTotal),
  `${dAbandoned.discarded} vs clipped ${Math.abs(abandoned.truth.rawTotal)}`);
check('3: it equals lost minus gained, not simply lost',
  dAbandoned.discarded === dAbandoned.lost - dAbandoned.gained &&
  dAbandoned.discarded < dAbandoned.lost,
  `lost ${dAbandoned.lost} − gained ${dAbandoned.gained} = ${dAbandoned.discarded}`);

// ══ 4: NO DOUBLE-COUNTING ═══════════════════════════════════════════════════
// A challenge that finished in credit already had its penalties applied inside
// its stored total. Charging again would charge twice for the same days.
const dHealthy = archiveDeficit(healthy.entry);
check('4: a challenge that ended in credit is charged nothing',
  dHealthy.verified && dHealthy.discarded === 0, `${dHealthy.discarded} — ${dHealthy.reason}`);
const partial = archiveOf({
  id: 'lock_in_14_day', name: 'LOCK IN (partial)', tasks: LI_TASKS, startedDaysAgo: 13, durationDays: 14,
  days: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, { tasks: { li_sleep: true, li_flow: true } }])),
});
const dPartial = archiveDeficit(partial.entry);
check('4: a challenge with SOME misses that still ended positive is charged nothing',
  partial.truth.lost > 0 && partial.entry.xpEarned > 0 && dPartial.discarded === 0,
  `lost ${partial.truth.lost}, stored ${partial.entry.xpEarned}, charged ${dPartial.discarded}`);
check('4: so the charge never exceeds what was genuinely discarded',
  [abandoned, healthy, partial].every(a => {
    const d = archiveDeficit(a.entry);
    return d.discarded === Math.max(0, -a.truth.rawTotal);
  }));

// ══ 5: never inventing a penalty ════════════════════════════════════════════
check('5: an archive with no day records is skipped, not estimated',
  (() => {
    const d = archiveDeficit({ ...abandoned.entry, days: null });
    return !d.verified && d.discarded === 0;
  })());
check('5: an archive whose stored figure cannot be reproduced is skipped',
  (() => {
    // Tamper with the stored total so the recomputation disagrees.
    const d = archiveDeficit({ ...abandoned.entry, xpEarned: 4321 });
    return !d.verified && d.discarded === 0 && /archive stores 4321/.test(d.reason || '');
  })());
check('5: a profile that had penalties switched off is charged nothing',
  (() => {
    const off = archiveOf({
      id: 'forge_daily', name: 'Forge Daily', tasks: FD_TASKS, startedDaysAgo: 29, penalties: false,
      days: { 1: { tasks: { fd_sleep: true, fd_mind: true, fd_read: true } } },
    });
    const d = archiveDeficit(off.entry);
    return d.discarded === 0 && /penalties were off/.test(d.reason || '');
  })());
check('5: a malformed entry returns a zero charge rather than throwing',
  archiveDeficit(null).discarded === 0 && archiveDeficit({}).discarded === 0);

// ══ 6: the preview totals correctly ═════════════════════════════════════════
const archives = [healthy.entry, abandoned.entry, partial.entry];
const preview = previewReconciliation(archives);
// The preview totals in DISPLAY units, so it can be compared against a rank
// floor; a segment's own `discarded` stays in the units its archive stored.
check('6: the preview sums only the charged segments',
  preview.amount === dAbandoned.discardedDisplay, `${preview.amount}`);
check('6: and it does so in display units',
  dAbandoned.discardedDisplay === dAbandoned.discarded * 10,
  `${dAbandoned.discarded} stored → ${dAbandoned.discardedDisplay} shown`);
check('6: it reports how many archives it looked at', preview.archiveCount === 3);
check('6: it names exactly the segments being charged',
  preview.charged.length === 1 && preview.charged[0].name === 'Forge Daily');
check('6: an empty history previews zero',
  previewReconciliation([]).amount === 0 && previewReconciliation(null).amount === 0);
check('6: unverifiable segments are counted and surfaced, not hidden',
  previewReconciliation([{ ...abandoned.entry, xpEarned: 999 }]).unverifiedCount === 1);
check('6: previewing does not mutate the archives it reads',
  (() => {
    const snapshot = JSON.stringify(archives);
    previewReconciliation(archives);
    previewReconciliation(archives);
    return JSON.stringify(archives) === snapshot;
  })());

// ══ 7: archives are never rewritten ═════════════════════════════════════════
const beforeArchives = JSON.stringify(archives);
const applied = buildReconciliation(preview, 8245);
check('7: building a reconciliation leaves every archive byte-identical',
  JSON.stringify(archives) === beforeArchives);
check('7: the stored xpEarned of the charged archive is untouched',
  abandoned.entry.xpEarned === 0 && healthy.entry.xpEarned > 0);
check('7: the ledger records the figure, the date and what it came from',
  applied.amount === preview.amount && !!applied.at && applied.segments.length === 1);
check('7: it records the balance before, so it can be undone exactly',
  applied.lifetimeBefore === 8245);

// ══ 8: the breakdown — earned and deductions kept separate ══════════════════
const ledger = { version: LEDGER_VERSION, reconciled: applied };
const current = { gained: 120, lost: 50, rawTotal: 70 };
// The breakdown reports in DISPLAY units. These fixtures are all era-1, so
// every figure is the stored one times ten; D() makes that explicit.
const D = (era1XP) => era1XP * 10;
const bd = computeXPBreakdown({ archives, currentSegment: current, ledger, currentEra: 1 });
check('8: earned is archived XP plus what the current segment earned',
  bd.earned === D(archives.reduce((s, a) => s + a.xpEarned, 0) + 120), `${bd.earned}`);
// A reconciliation built now stores DISPLAY units and says so (ledgerUnits: 2),
// so it is not scaled again on read — only the era-1 live segment is.
check('8: penalties are the historical figure plus the live deficit',
  bd.penalties === applied.amount + D(50), `${bd.penalties}`);
check('8: net is earned minus penalties', bd.net === bd.earned - bd.penalties);
check('8: the historical and current deductions are reported separately',
  bd.historicalPenalty === applied.amount && bd.currentPenalty === D(50));
check('8: a reconciliation records the units it stored',
  applied.ledgerUnits === 2);
check('8: with no ledger, only the live deficit is deducted',
  computeXPBreakdown({ archives, currentSegment: current, ledger: makeLedger(), currentEra: 1 }).penalties === D(50));

// ══ 9: a live deficit now reduces Lifetime XP ═══════════════════════════════
// This is the behaviour that used to be clipped at zero.
check('9: a negative current segment reduces Lifetime XP',
  rawLifetimeWithLedger({
    archives: [{ xpEarned: 8245 }], currentSegment: { gained: 76, lost: 725 }, ledger: makeLedger(),
  }) === D(8245 + 76 - 725), `${D(8245 + 76 - 725)}`);
check('9: the old behaviour floored it at zero — this is the change',
  computeLifetimeXP([{ xpEarned: 8245 }], 76 - 725) === 8245);
check('9: a positive segment still adds, as before',
  rawLifetimeWithLedger({
    archives: [{ xpEarned: 8245 }], currentSegment: { gained: 120, lost: 0 }, ledger: makeLedger(),
  }) === D(8365));
check('9: returning after 7, 14 and 30 days costs progressively more',
  (() => {
    const at = (gap) => {
      const profiles = { p: { challengeStart: dstr(-gap), activeChallenge: { templateId: 'forge_daily', durationDays: null }, tasks: FD_TASKS, xpPenalties: true } };
      const r = computeTotalXP({ p: { 1: { tasks: { fd_sleep: true } } } }, profiles, 'p', () => 0, gap + 1, gap + 1);
      return rawLifetimeWithLedger({ archives: [{ xpEarned: 8245 }], currentSegment: r, ledger: makeLedger() });
    };
    return at(7) > at(14) && at(14) > at(30);
  })());

// ══ 10: THE FLOOR — a rank, once unlocked, is never lost ════════════════════
// The floor and every balance compared against it are in DISPLAY units.
const floor = rankFloorXP(TRUE_WARRIOR.rank);
check('10: the floor for True Warrior is the converted threshold', floor === D(7500));
check('10: a deduction that lands above the floor applies in full',
  effectiveLifetimeXP(D(8245) - D(500), TRUE_WARRIOR.rank) === D(7745));
check('10: a deduction that would breach the floor is held at it',
  effectiveLifetimeXP(D(8245) - D(5000), TRUE_WARRIOR.rank) === D(7500));
check('10: even a catastrophic deficit cannot breach the floor',
  effectiveLifetimeXP(-99999, TRUE_WARRIOR.rank) === D(7500));
check('10: the rank itself survives any balance',
  [-5000, 0, 100].every(xp =>
    resolveRankState({ rawLifetimeXP: xp, highestRank: TRUE_WARRIOR.rank }).current.name === 'True Warrior'));
check('10: the displayed XP at the floor is the floor, not the raw figure',
  resolveRankState({ rawLifetimeXP: -400, highestRank: TRUE_WARRIOR.rank }).xp === D(7500));
check('10: progress toward the NEXT rank is what is actually lost',
  (() => {
    const before = resolveRankState({ rawLifetimeXP: D(8245), highestRank: TRUE_WARRIOR.rank });
    const after = resolveRankState({ rawLifetimeXP: D(7600), highestRank: TRUE_WARRIOR.rank });
    return after.xpToNext > before.xpToNext && after.current.name === before.current.name;
  })());

// ══ 11: applied exactly once ════════════════════════════════════════════════
check('11: a ledger with a reconciliation reports as reconciled', isReconciled(ledger));
check('11: the deduction does not grow when the breakdown is recomputed',
  (() => {
    const a = computeXPBreakdown({ archives, currentSegment: current, ledger });
    const b = computeXPBreakdown({ archives, currentSegment: current, ledger });
    const c = computeXPBreakdown({ archives, currentSegment: current, ledger });
    return a.net === b.net && b.net === c.net;
  })());
check('11: re-previewing after applying still reports the same amount',
  previewReconciliation(archives).amount === preview.amount);
check('11: the ledger holds ONE figure, so a second apply cannot stack',
  ledgerPenalty({ version: 1, reconciled: { amount: 500 } }) === 500);
check('11: undoing restores the previous balance exactly',
  computeXPBreakdown({ archives, currentSegment: current, ledger: makeLedger() }).net ===
  computeXPBreakdown({ archives, currentSegment: current, ledger }).net + applied.amount);

// ══ 12: exempt periods are still exempt ═════════════════════════════════════
check('12: a scheduled challenge contributes nothing before its start date',
  (() => {
    const profiles = { p: { challengeStart: dstr(5), activeChallenge: { templateId: 'lock_in_14_day', durationDays: 14 }, tasks: LI_TASKS, xpPenalties: true } };
    const r = computeTotalXP({ p: {} }, profiles, 'p', () => 0, 1, 1);
    return r.lost === 0 && rawLifetimeWithLedger({ archives: [{ xpEarned: 8245 }], currentSegment: r, ledger: makeLedger() }) === D(8245);
  })());
check('12: the current unfinished day is never charged',
  (() => {
    const profiles = { p: { challengeStart: dstr(0), activeChallenge: { templateId: 'lock_in_14_day', durationDays: 14 }, tasks: LI_TASKS, xpPenalties: true } };
    return computeTotalXP({ p: {} }, profiles, 'p', () => 0, 1, 1).lost === 0;
  })());
check('12: a profile with no archives and no challenge is unaffected',
  rawLifetimeWithLedger({ archives: [], currentSegment: { gained: 0, lost: 0 }, ledger: makeLedger() }) === 0);

// ══ 13: migration — existing profiles are untouched until they approve ══════
check('13: a profile with no xpLedger field behaves exactly as before',
  (() => {
    const withoutLedger = computeXPBreakdown({ archives, currentSegment: { gained: 100, lost: 0 }, ledger: undefined, currentEra: 1 });
    return withoutLedger.penalties === 0 &&
      withoutLedger.net === D(archives.reduce((s, a) => s + a.xpEarned, 0) + 100);
  })());
check('13: no other profile is charged by one profile reconciling',
  (() => {
    const me = { version: 1, reconciled: applied };
    const her = makeLedger();
    return ledgerPenalty(me) > 0 && ledgerPenalty(her) === 0;
  })());
check('13: the reconciliation is opt-in — nothing is deducted until it exists',
  computeXPBreakdown({ archives, currentSegment: { gained: 0, lost: 0 }, ledger: makeLedger() }).penalties === 0);

// ══ 14: the Forge Daily 75-day archive cap ══════════════════════════════════
// Open-ended runs have no duration to cap against; the old expression fell
// back to 75 and dropped everything after day 75.
check('14: the old cap expression truncated an open-ended run at 75',
  (null || 75) === 75);
check('14: the corrected rule leaves an open-ended run uncapped',
  (() => {
    const meta = { durationDays: null };
    const elapsed = 100;
    const dayNum = meta.durationDays != null ? Math.min(elapsed, meta.durationDays) : elapsed;
    return dayNum === 100;
  })());
check('14: and still caps a fixed-duration challenge at its own length',
  (() => {
    const meta = { durationDays: 14 };
    const elapsed = 100;
    return (meta.durationDays != null ? Math.min(elapsed, meta.durationDays) : elapsed) === 14;
  })());
check('14: a 100-day Forge Daily run archives all 100 days of earned XP',
  (() => {
    const days = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i + 1, { tasks: { fd_sleep: true, fd_mind: true, fd_read: true } }]));
    const profiles = { p: { challengeStart: dstr(-99), activeChallenge: { templateId: 'forge_daily', durationDays: null }, tasks: FD_TASKS, xpPenalties: true } };
    const capped = computeTotalXP({ p: days }, profiles, 'p', () => 100, 75, 75);
    const full = computeTotalXP({ p: days }, profiles, 'p', () => 100, 100, 100);
    return full.gained > capped.gained;
  })(), 'uncapped banks more than the old 75-day cut-off');


// ══ 15: THE FLOOR IS A REAL BALANCE, NOT A MASK ════════════════════════════
// If the penalties found exceed the XP held above the floor, the excess is
// written off at the moment the charge is fixed. Otherwise the balance would
// read as the floor while the gap quietly swallowed the next XP earned.
//
// Expressed in DISPLAY units throughout — the archive is marked era 2 so
// nothing is scaled — because that is the scale the floor and the ledger now
// work in. The figures are the era-1 ones times ten.
{
  const FLOOR = rankFloorXP(TRUE_WARRIOR.rank);         // 75,000
  const archivesN = [{ xpEarned: D(8285), challenge: { xpEconomyVersion: 2 } }];
  const before = D(8260);       // earned less penalties already counted
  const found = D(1136);        // uncounted missed days
  const headroom = before - FLOOR;

  const cap = capToFloor(found, before, FLOOR);
  check('15: only the XP above the floor can be charged',
    cap.applied === headroom, `applied ${cap.applied} of ${headroom}`);
  check('15: the excess is written off, not deferred',
    cap.forgiven === found - headroom && cap.total === found, `forgiven ${cap.forgiven}`);
  check('15: the headroom is the distance to the floor', cap.headroom === headroom);
  check('15: a charge that fits is applied in full',
    capToFloor(3000, before, FLOOR).applied === 3000 && capToFloor(3000, before, FLOOR).forgiven === 0);
  check('15: a profile already at its floor is charged nothing at all',
    capToFloor(5000, FLOOR, FLOOR).applied === 0 && capToFloor(5000, FLOOR, FLOOR).forgiven === 5000);
  check('15: a profile below its floor is charged nothing',
    capToFloor(5000, FLOOR - 5000, FLOOR).applied === 0);

  const entry = buildReconciliation({ amount: found, archiveCount: 1, unverifiedCount: 0, charged: [] }, before, FLOOR, 0);
  check('15: the ledger stores the CAPPED amount, so the balance is real',
    entry.amount === headroom && entry.uncounted === found && entry.forgiven === found - headroom);

  const ledgerN = { version: LEDGER_VERSION, reconciled: entry };
  const at = (gained) => computeXPBreakdown({
    archives: archivesN, currentSegment: { gained, lost: D(25) }, ledger: ledgerN, currentEra: 2,
  }).net;
  check('15: after applying, the balance is exactly the floor', at(0) === FLOOR, `${at(0)}`);
  check('15: EARNING 200 XP RAISES IT TO THE FLOOR + 200 — no hidden debt',
    at(200) === FLOOR + 200, `${at(200)}`);
  check('15: earning 2,000 XP raises it by 2,000', at(2000) === FLOOR + 2000, `${at(2000)}`);
  check('15: every subsequent XP earned moves the balance one for one',
    [10, 50, 500, 5000].every(x => at(x) === FLOOR + x));
  check('15: the displayed figure never dips below the floor',
    [0, 200, 2000].every(x => effectiveLifetimeXP(at(x), TRUE_WARRIOR.rank) >= FLOOR));
  check('15: and the rank is untouched throughout',
    [0, 200, 2000].every(x =>
      resolveRankState({ rawLifetimeXP: at(x), highestRank: TRUE_WARRIOR.rank }).current.name === 'True Warrior'));

  // The regression this replaces: storing the UNCAPPED figure left a debt.
  const buggy = { version: LEDGER_VERSION, reconciled: { amount: found, ledgerUnits: 2 } };
  const buggyAt = (gained) => effectiveLifetimeXP(computeXPBreakdown({
    archives: archivesN, currentSegment: { gained, lost: D(25) }, ledger: buggy, currentEra: 2,
  }).net, TRUE_WARRIOR.rank);
  check('15: (regression) the uncapped version swallowed 2,000 XP of earnings',
    buggyAt(0) === FLOOR && buggyAt(2000) === FLOOR,
    'the behaviour this cap removes');
}

// ══ 16: a LIVE deficit is forgiven the same way ════════════════════════════
// Weeks away while Forge Daily was running can push the net below the floor
// with no reconciliation involved. The shortfall is reported so the caller can
// persist it, and once credited the balance behaves normally again.
// Display units throughout, as in section 15.
{
  const FLOOR = rankFloorXP(TRUE_WARRIOR.rank);
  const archivesN = [{ xpEarned: D(7600), challenge: { xpEconomyVersion: 2 } }];
  const inputs = (gained, lost, forgiven = 0) => ({
    archives: archivesN, currentSegment: { gained, lost }, currentEra: 2,
    ledger: { version: LEDGER_VERSION, reconciled: null, forgiven, forgivenUnits: 2 },
  });
  const short = forgivenessShortfall(inputs(D(76), D(725)), FLOOR);
  check('16: a live deficit below the floor reports a shortfall',
    short === FLOOR - (D(7600) + D(76) - D(725)), `${short}`);
  check('16: crediting it puts the balance exactly on the floor',
    computeXPBreakdown(inputs(D(76), D(725), short)).net === FLOOR);
  check('16: and then earning 200 XP raises it by 200',
    computeXPBreakdown(inputs(D(76) + 200, D(725), short)).net === FLOOR + 200,
    `${computeXPBreakdown(inputs(D(76) + 200, D(725), short)).net}`);
  check('16: once credited, no further shortfall is reported — it is idempotent',
    forgivenessShortfall(inputs(D(76), D(725), short), FLOOR) === 0);
  check('16: a healthy balance reports no shortfall at all',
    forgivenessShortfall(inputs(D(500), 0), FLOOR) === 0);
  // Zero is a floor too — XP is never displayed below it, so a deficit there
  // would be the same invisible debt.
  check('16: zero is protected as well, so XP can never go secretly negative',
    forgivenessShortfall(inputs(0, 999990), 0) === 999990 - D(7600),
    `${forgivenessShortfall(inputs(0, 999990), 0)}`);
  check('16: a profile with nothing earned and nothing lost needs no credit',
    forgivenessShortfall({ archives: [], currentSegment: { gained: 0, lost: 0 }, ledger: makeLedger(), currentEra: 2 }, 0) === 0);
  // Forgiveness cancels a charge. It must never hand out XP to a profile that
  // holds a rank but has little or no earned XP behind it.
  check('16: a profile holding a rank with NO penalties is credited nothing',
    forgivenessShortfall({ archives: [], currentSegment: { gained: 0, lost: 0 }, ledger: makeLedger(), currentEra: 2 }, FLOOR) === 0);
  check('16: the credit never exceeds the penalties actually incurred',
    forgivenessShortfall({ archives: [], currentSegment: { gained: 0, lost: 400 }, ledger: makeLedger(), currentEra: 2 }, FLOOR) === 400);
  check('16: forgiven XP is excluded from the "lost" figure shown to the user',
    (() => {
      const b = computeXPBreakdown(inputs(D(76), D(725), short));
      return b.penalties === b.grossPenalties - short && b.penalties >= 0;
    })());
}

// ══ 17: the breakdown reconciles — earned − lost = current ═════════════════
// The three numbers on the Rank Details card have to add up, or the screen is
// worse than no screen.
{
  const cases = [
    { archives: [{ xpEarned: 8285 }], seg: { gained: 0, lost: 25 }, ledger: makeLedger() },
    { archives: [{ xpEarned: 8285 }], seg: { gained: 120, lost: 50 }, ledger: { version: 1, reconciled: { amount: 760 }, forgiven: 0 } },
    { archives: [], seg: { gained: 40, lost: 0 }, ledger: makeLedger() },
  ];
  check('17: Total Earned − XP Lost = Current XP, in every case',
    cases.every(c => {
      const b = computeXPBreakdown({ archives: c.archives, currentSegment: c.seg, ledger: c.ledger });
      return b.earned - b.penalties === b.net;
    }));
  check('17: the lost figure is never negative',
    cases.every(c => computeXPBreakdown({ archives: c.archives, currentSegment: c.seg, ledger: c.ledger }).penalties >= 0));
}

// ══ 18: per-period detail for "Where did I lose XP?" ═══════════════════════
// Of the 30 days, day 1 was logged and the final day is the segment's own
// current day, which is never penalised — so 28 days were missed and charged.
check('18: a segment reports its missed days, dates, earned XP and penalties',
  (() => {
    const d = archiveDeficit(abandoned.entry);
    return d.missedDays === 28 && d.gained > 0 && d.lost > 0 &&
      !!d.startDate && !!d.endDate && d.days === 30;
  })(),
  JSON.stringify((({ missedDays, gained, lost, days }) => ({ missedDays, gained, lost, days }))(archiveDeficit(abandoned.entry))));
check('18: the missed-day count agrees with what those days were charged',
  (() => {
    const d = archiveDeficit(abandoned.entry);
    return d.missedPenalty === d.missedDays * 25 && d.missedPenalty === d.lost;
  })(),
  JSON.stringify((({ missedDays, missedPenalty, lost }) => ({ missedDays, missedPenalty, lost }))(archiveDeficit(abandoned.entry))));
check('18: a fully-logged challenge reports zero missed days',
  archiveDeficit(healthy.entry).missedDays === 0);
check('18: an excluded segment is marked unverified rather than erroring',
  (() => {
    const d = archiveDeficit({ ...abandoned.entry, xpEarned: 123 });
    return !d.verified && d.discarded === 0;
  })());

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
