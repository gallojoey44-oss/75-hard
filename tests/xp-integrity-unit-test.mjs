import { computeTotalXP, computeDayXP, requiredTasksForDay } from '../src/utils/gamification.js';
import {
  computeXPBreakdown, forgivenessUpdate, forgivenessRatchet, forgivenessBasisStamp, effectiveForgiven, archiveContribution,
  appendCarried, carriedTotals, archiveDeficit, previewReconciliation, buildReconciliation, GROSS_ACCOUNTING,
  hasGrossAccounting, makeLedger,
} from '../src/utils/xpLedger.js';
import {
  recentGap, shouldShowComeback, unacknowledgedPart, acknowledgementKey, acknowledgedThrough,
} from '../src/utils/missedDays.js';
import { stampAttempt, toDisplayXP, archiveEraOf } from '../src/utils/xpAttempt.js';
import { dayRules, displayScaleFor } from '../src/data/xpEconomy.js';
import { FORGE_DAILY_META, FORGE_DAILY_TASKS, getTemplateById } from '../src/data/challengeTemplates.js';
import { rankFloorXP } from '../src/utils/rank.js';
import { buildAttemptPayload } from '../src/data/challengeAttempt.js';

/**
 * XP integrity: transitions, the rank floor and the missed-day notice.
 *
 * Bug fixes only. Nothing here changes what a day earns or costs, and section
 * 1 pins that first, so every later section is about accounting and never
 * about the policy:
 *
 *   1. The rules: a fully missed Forge Daily day is −60, a partial day keeps
 *      its partial penalty, the day in progress is neutral, the toggle works,
 *      and a challenge's penalties are its own.
 *   2. Older data reads exactly as it did — the same balance, to the XP.
 *   3. Ending a segment moves no XP: an archive keeps its deficit, and a
 *      segment with nothing to archive keeps its XP in the ledger.
 *   4. Ending a support challenge moves no XP either, and its archive is read
 *      in the units it was written in.
 *   5. The rank floor protects XP but never creates it: after a transition,
 *      a missed day logged later, or penalties switched off. Protection that
 *      is no longer needed does not refill to swallow later missed days, and
 *      switching penalties off and on again changes nothing.
 *   6. A randomised run of all of the above never manufactures XP, and every
 *      new missed day above the floor costs exactly what it costs.
 *   7. The notice shows each missed day once, and never moves XP.
 */

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const offset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// Forge Daily, stamped exactly as the app stamps it.
const FD = stampAttempt({ meta: { ...FORGE_DAILY_META }, tasks: FORGE_DAILY_TASKS, template: null });
const fdMeta = FD.meta;
const fdTasks = FD.tasks;
const fdRules = dayRules(fdMeta);
const FULL = Object.fromEntries(fdTasks.map(t => [t.id, true]));

/**
 * A live segment whose Day 1 was `daysAgo` days ago (so today is day
 * daysAgo + 1), with the given day records. Returns everything the app's own
 * code would pass around for it.
 */
function liveSegment({ meta = fdMeta, tasks = fdTasks, daysAgo, days = {}, penalties = true, xpStartDay = 1 }) {
  const start = offset(-daysAgo);
  const today = daysAgo + 1;
  const profile = { challengeStart: start, activeChallenge: meta, tasks, xpPenalties: penalties, xpStartDay, xpOffset: 0 };
  const completion = (n) => {
    const d = days[n];
    if (!d) return 0;
    const ts = requiredTasksForDay(tasks, meta, start, n);
    return ts.length ? Math.round(ts.filter(t => d.tasks?.[t.id]).length / ts.length * 100) : 0;
  };
  const seg = computeTotalXP({ p: days }, { p: profile }, 'p', completion, today, today);
  return { start, today, days, profile, seg, meta, tasks };
}

/** What buildArchiveEntry writes for a segment with day records. */
function archiveOf(s, extra = {}) {
  return {
    id: `arch_${Math.random().toString(36).slice(2)}`,
    challenge: { ...s.meta },
    challengeStart: s.start,
    endDayNum: s.today,
    endDate: offset(0),
    tasks: s.tasks,
    days: s.days,
    xpEarned: Math.max(0, s.seg.rawTotal),
    xpGained: s.seg.gained,
    xpLost: s.seg.lost,
    xpAccounting: GROSS_ACCOUNTING,
    xpStartDay: 1,
    xpOffset: 0,
    ...extra,
  };
}

/** What carriedSegmentFor writes for a segment with nothing to archive. */
function carriedOf(s) {
  const scale = displayScaleFor(Number(s.meta.xpEconomyVersion) || 1);
  return { id: 'carry_t', name: s.meta.name, challengeStart: s.start, endDate: offset(0),
    gained: Math.round(s.seg.gained * scale), lost: Math.round(s.seg.lost * scale), missedDays: 0, missedPenalty: 0 };
}

/**
 * Run the app's floor effect to a fixed point, exactly as AppContext does.
 * `potentialSegment` is the live segment measured with XP Penalties on; the
 * app passes it when penalties are switched off, and it is the segment itself
 * otherwise.
 */
function settle(inputs, floor, potentialSegment = null) {
  let ledger = inputs.ledger || null;
  for (let i = 0; i < 6; i++) {
    const cur = { ...inputs, ledger };
    const u = forgivenessUpdate(cur, floor)
      || forgivenessRatchet({ ...cur, currentSegment: potentialSegment || inputs.currentSegment })
      || forgivenessBasisStamp(cur);
    if (!u) break;
    ledger = { ...(ledger || makeLedger()), ...u };
  }
  return ledger;
}
const shown = (net, floor) => Math.max(net, floor);

/** The breakdown exactly as it was computed before this fix, for comparison. */
function oldBreakdownNet({ archives, currentSegment, ledger, currentEra }) {
  const archived = (archives || []).reduce((s, a) => s + toDisplayXP(a?.xpEarned, archiveEraOf(a)), 0);
  const sc = displayScaleFor(currentEra);
  const g = Math.max(0, Number(currentSegment?.gained) || 0) * sc;
  const l = Math.max(0, Number(currentSegment?.lost) || 0) * sc;
  const hist = ledger?.reconciled ? (Number(ledger.reconciled.ledgerUnits) >= 2 ? ledger.reconciled.amount : ledger.reconciled.amount * 10) : 0;
  const f = Math.max(0, Number(ledger?.forgiven) || 0) * (Number(ledger?.forgivenUnits) >= 2 ? 1 : 10);
  return archived + g - (hist + l) + f;
}

// ══ 1: the rules themselves are unchanged ══════════════════════════════════
check('1: Forge Daily is an Easy-tier baseline on the current economy', fdMeta.effortTier === 'easy' && fdMeta.xpEconomyVersion === 2);
check('1: a fully missed Forge Daily day costs 60 XP', fdRules.missedDay === 60 && fdRules.displayScale === 1);
{
  const past = computeDayXP(undefined, fdTasks, 'p', 3, 5, true, 5, fdRules);
  const today = computeDayXP(undefined, fdTasks, 'p', 5, 5, true, 5, fdRules);
  const off = computeDayXP(undefined, fdTasks, 'p', 3, 5, false, 5, fdRules);
  check('1: a finished, empty day loses 60', past.lost === 60 && past.gained === 0);
  check('1: the day in progress is never charged', today.lost === 0);
  check('1: with XP Penalties off, a missed day costs nothing', off.lost === 0);
  const partial = computeDayXP({ tasks: { daily_log: true } }, fdTasks, 'p', 3, 5, true, 5, fdRules);
  const log = fdTasks.find(t => t.id === 'daily_log').xp;
  const expected = Math.min(fdRules.dayLossCap, fdTasks.filter(t => t.id !== 'daily_log')
    .reduce((s, t) => s + Math.round(t.xp * fdRules.taskMissRate), 0));
  check('1: a partial day keeps its partial-day penalty (25% of each unticked habit, capped)',
    partial.gained === log && partial.lost === expected, `+${partial.gained} −${partial.lost}`);
  const capped = computeDayXP({ tasks: {}, notes: 'x' }, fdTasks, 'p', 3, 5, true, 5, fdRules);
  check('1: and that partial penalty never exceeds the day cap', capped.lost <= fdRules.dayLossCap);
}
{
  const mt = buildAttemptPayload({ template: getTemplateById('mental_training_phase'), variant: 'standard' });
  const st = stampAttempt({ meta: mt.challenge, tasks: mt.tasks, template: getTemplateById('mental_training_phase') });
  const r = dayRules(st.meta);
  check('1: a challenge\'s missed day is still half its own daily budget', r.missedDay === Math.round(r.dailyBudget * 0.5), `${r.missedDay}`);
}

// ══ 2: everything already stored reads exactly as it did ═══════════════════
{
  const fixtures = [
    { archives: [], currentSegment: { gained: 500, lost: 120 }, ledger: null, currentEra: 2 },
    { archives: [{ xpEarned: 8000, challenge: { xpEconomyVersion: 1 } }, { xpEarned: 900, challenge: { xpEconomyVersion: 2 } }],
      currentSegment: { gained: 40, lost: 420 }, ledger: null, currentEra: 2 },
    { archives: [{ xpEarned: 1200 }], currentSegment: { gained: 0, lost: 0 },
      ledger: { reconciled: { amount: 35 } , forgiven: 12 }, currentEra: 1 },
    { archives: [{ xpEarned: 75100, challenge: { xpEconomyVersion: 2 } }], currentSegment: { gained: 0, lost: 420 },
      ledger: { forgiven: 320, forgivenUnits: 2 }, currentEra: 2 },
  ];
  for (const [i, f] of fixtures.entries()) {
    const now = computeXPBreakdown(f).net;
    const before = oldBreakdownNet(f);
    check(`2: stored data, case ${i + 1} — the balance is exactly what it was`, now === before, `${before} → ${now}`);
  }
  check('2: an archive without gross figures contributes its banked XP, as always',
    JSON.stringify(archiveContribution({ xpEarned: 50, challenge: { xpEconomyVersion: 1 } })) === JSON.stringify({ gained: 500, lost: 0 }));
  check('2: an old rank-protection credit keeps its full value', effectiveForgiven({ forgiven: 320, forgivenUnits: 2 }, 0) === 320);
}

// ══ 3: ending a segment moves no XP ════════════════════════════════════════
const BANKED = [{ id: 'old', xpEarned: 83000, challenge: { xpEconomyVersion: 2 } }];
function transitionCheck(label, s, { expectArchive = true } = {}) {
  const before = computeXPBreakdown({ archives: BANKED, currentSegment: s.seg, ledger: null, currentEra: 2 }).net;
  const hasRecords = Object.keys(s.days).length > 0;
  const archives = hasRecords ? [...BANKED, archiveOf(s)] : BANKED;
  const ledger = hasRecords ? null : appendCarried(null, carriedOf(s));
  const after = computeXPBreakdown({ archives, currentSegment: { gained: 0, lost: 0 }, ledger, currentEra: 2 }).net;
  check(`3: ${label} — starting something new leaves Lifetime XP exactly where it was`,
    before === after && hasRecords === expectArchive, `${before} → ${after}`);
  // What the old code did: archive max(0, net), or nothing at all.
  const oldAfter = BANKED[0].xpEarned + (hasRecords ? Math.max(0, s.seg.rawTotal) : 0);
  return { before, after, oldAfter };
}
{
  const good = {}; for (let i = 1; i <= 12; i++) good[i] = { tasks: { ...FULL } };
  transitionCheck('12 full days then a 7-day gap', liveSegment({ daysAgo: 19, days: good }));
  const one = { 1: { tasks: { ...FULL } } };
  const r = transitionCheck('one full day then a 7-day gap (a deficit)', liveSegment({ daysAgo: 8, days: one }));
  check('3: …where the old archiving would have refunded the deficit', r.oldAfter > r.before, `old ${r.oldAfter} vs ${r.before}`);
  const none = transitionCheck('a Forge Daily period with no records at all', liveSegment({ daysAgo: 7, days: {} }), { expectArchive: false });
  check('3: …where the old code dropped the whole 420', none.oldAfter - none.before === 420, `${none.oldAfter - none.before}`);
  const partials = {}; for (let i = 1; i <= 6; i++) partials[i] = { tasks: { daily_log: true } };
  transitionCheck('six logged-but-unfinished days', liveSegment({ daysAgo: 6, days: partials }));
  const off = liveSegment({ daysAgo: 7, days: {}, penalties: false });
  check('3: with penalties off, an empty period carries nothing', off.seg.lost === 0 && off.seg.gained === 0);
  // An era-1 challenge segment ends the same way, in its own units.
  const era1Meta = { templateId: 'fat_loss_phase', name: 'Fat Loss', variant: 'standard', durationDays: 30, xpEconomyVersion: 1 };
  const era1Tasks = [{ id: 'fl_a', name: 'A', xp: 25, keystone: 2 }, { id: 'fl_b', name: 'B', xp: 15, keystone: 1 }];
  const e1 = liveSegment({ meta: era1Meta, tasks: era1Tasks, daysAgo: 6, days: { 1: { tasks: { fl_a: true } } } });
  const b1 = computeXPBreakdown({ archives: BANKED, currentSegment: e1.seg, ledger: null, currentEra: 1 }).net;
  const a1 = computeXPBreakdown({ archives: [...BANKED, archiveOf(e1)], currentSegment: { gained: 0, lost: 0 }, ledger: null, currentEra: 2 }).net;
  check('3: an older-economy challenge ends without moving XP, in its own units', b1 === a1, `${b1} → ${a1}`);
}
{
  const gross = archiveOf(liveSegment({ daysAgo: 8, days: { 1: { tasks: { ...FULL } } } }));
  check('3: a gross archive is recognised as one', hasGrossAccounting(gross) && !hasGrossAccounting({ xpEarned: 5 }));
  const d = archiveDeficit(gross);
  check('3: the reconciliation never charges a gross archive again', d.verified && d.discarded === 0, d.reason || '');
  check('3: …so its preview finds nothing to charge', previewReconciliation([gross]).amount === 0);
  const legacy = { ...gross, xpAccounting: undefined, xpGained: undefined, xpLost: undefined };
  check('3: while an older archive\'s clipped deficit is still found', archiveDeficit(legacy).discarded > 0);
  check('3: carried segments add up', JSON.stringify(carriedTotals(appendCarried(appendCarried(null, { gained: 5, lost: 60 }), { gained: 0, lost: 120 }))) === JSON.stringify({ gained: 5, lost: 180 }));
  check('3: appending never rewrites an earlier entry', (() => {
    const l1 = appendCarried(null, { id: 'a', gained: 1, lost: 2 });
    const l2 = appendCarried(l1, { id: 'b', gained: 3, lost: 4 });
    return l1.carried.length === 1 && l2.carried[0] === l1.carried[0] && l2.carried.length === 2;
  })());
}

// ══ 4: ending a support challenge ══════════════════════════════════════════
{
  const pMeta = { templateId: 'mental_training_phase', name: 'MT', variant: 'standard', durationDays: 21, xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 160 };
  const primaryTask = { id: 'mt_mind', name: 'Mind', xp: 60, keystone: 3, challenges: ['primary'] };
  const supportTask = { id: 'fl_steps', name: 'Steps', xp: 40, keystone: 2, challenges: ['support'] };
  const days = { 1: { tasks: { mt_mind: true } }, 2: { tasks: { mt_mind: true } }, 3: { tasks: { mt_mind: true } } };
  const withSup = liveSegment({ meta: pMeta, tasks: [primaryTask, supportTask], daysAgo: 4, days });
  const withoutSup = liveSegment({ meta: pMeta, tasks: [primaryTask], daysAgo: 4, days });
  const net = withSup.seg.rawTotal - withoutSup.seg.rawTotal;
  check('4: unticked support rows can be worth less than nothing', net < 0, `net ${net}`);
  const supMeta = { templateId: 'fat_loss_phase', name: 'Fat Loss' };   // support descriptors carry no stamp
  const supportArchive = { id: 'sup', lane: 'support', challenge: supMeta, xpEarned: Math.max(0, net),
    xpGained: withSup.seg.gained - withoutSup.seg.gained, xpLost: withSup.seg.lost - withoutSup.seg.lost,
    xpAccounting: GROSS_ACCOUNTING, xpEconomyVersion: 2 };
  const before = computeXPBreakdown({ archives: BANKED, currentSegment: withSup.seg, ledger: null, currentEra: 2 }).net;
  const after = computeXPBreakdown({ archives: [...BANKED, supportArchive], currentSegment: withoutSup.seg, ledger: null, currentEra: 2 }).net;
  check('4: ending it leaves Lifetime XP exactly where it was, a loss included', before === after, `${before} → ${after}`);
  const oldAfter = computeXPBreakdown({ archives: [...BANKED, { challenge: supMeta, xpEarned: Math.max(0, net) }], currentSegment: withoutSup.seg, ledger: null, currentEra: 2 }).net;
  check('4: …where clipping the transfer at zero handed the loss back', oldAfter > before, `${before} → ${oldAfter}`);
  check('4: a support archive is read in the primary\'s units, not as era 1',
    archiveEraOf(supportArchive) === 2 && archiveEraOf({ challenge: supMeta }) === 1);
  const gainingArchive = { challenge: supMeta, xpEarned: 50, xpEconomyVersion: 2 };
  check('4: so 50 XP banked from a support challenge counts as 50, not 500',
    archiveContribution(gainingArchive).gained === 50 && archiveContribution({ challenge: supMeta, xpEarned: 50 }).gained === 500);
}

// ══ 5: the rank floor protects XP but never creates it ═════════════════════
const FLOOR = rankFloorXP(7);   // True Warrior, 75,000
const NEAR = [{ id: 'near', xpEarned: 75100, challenge: { xpEconomyVersion: 2 } }];
{
  const gap = liveSegment({ daysAgo: 7, days: {} });           // seven missed days, no records
  const inputs = { archives: NEAR, currentSegment: gap.seg, currentEra: 2 };
  const ledger = settle({ ...inputs, ledger: null }, FLOOR);
  const net = computeXPBreakdown({ ...inputs, ledger }).net;
  check('5: a gap that would cross the floor stops at it', net === FLOOR && shown(net, FLOOR) === FLOOR, `${net}`);
  check('5: the write-off is recorded with the penalties it was written against',
    ledger.forgiven === 320 && ledger.forgivenBasis === 420 && ledger.forgivenUnits === 2, JSON.stringify(ledger));

  // Starting a new challenge now: the deficit is carried, the credit still matches it.
  const carriedLedger = appendCarried(ledger, carriedOf(gap));
  const afterStart = computeXPBreakdown({ archives: NEAR, currentSegment: { gained: 0, lost: 0 }, ledger: carriedLedger, currentEra: 2 }).net;
  check('5: starting a new challenge after hitting the floor creates no XP', afterStart === FLOOR, `${afterStart} (the old code reached 75,420)`);
  const settled = settle({ archives: NEAR, currentSegment: { gained: 0, lost: 0 }, ledger: carriedLedger, currentEra: 2 }, FLOOR);
  check('5: …and needs no further write-off', JSON.stringify(settled) === JSON.stringify(carriedLedger));

  // Earning after the floor moves the balance at once — no invisible debt to
  // pay off first. Same gap, same morning; then today's habits are ticked.
  const earn = liveSegment({ daysAgo: 7, days: { 8: { tasks: { ...FULL } } } });
  const earnInputs = { archives: NEAR, currentSegment: earn.seg, currentEra: 2 };
  const earnLedger = settle({ ...earnInputs, ledger }, FLOOR);
  const todayXP = computeDayXP({ tasks: { ...FULL } }, fdTasks, 'p', 8, 8, true, 8, fdRules).gained;
  const earnNet = computeXPBreakdown({ ...earnInputs, ledger: earnLedger }).net;
  check('5: XP earned after reaching the floor shows immediately, in full',
    todayXP > 0 && earnNet === FLOOR + todayXP, `${earnNet} = ${FLOOR} + ${todayXP}?`);
  check('5: …and earning never touches the write-off', JSON.stringify(earnLedger) === JSON.stringify(ledger));

  // A missed day logged after the fact: the credit that covered it goes first.
  const fixedAll = {}; for (let i = 1; i <= 7; i++) fixedAll[i] = { tasks: { ...FULL } };
  const allLogged = liveSegment({ daysAgo: 7, days: fixedAll });
  const afterEdit = computeXPBreakdown({ archives: NEAR, currentSegment: allLogged.seg, ledger, currentEra: 2 });
  check('5: logging every missed day afterwards leaves no protection behind',
    afterEdit.forgiven === 0 && afterEdit.net === 75100 + allLogged.seg.gained, `${afterEdit.net} vs ${75100 + allLogged.seg.gained}`);
  const fixedThree = { 5: { tasks: { ...FULL } }, 6: { tasks: { ...FULL } }, 7: { tasks: { ...FULL } } };
  const someLogged = liveSegment({ daysAgo: 7, days: fixedThree });
  const partEdit = computeXPBreakdown({ archives: NEAR, currentSegment: someLogged.seg, ledger, currentEra: 2 });
  check('5: logging some of them cancels protection for exactly the penalties removed',
    partEdit.forgiven === 320 - (420 - someLogged.seg.lost), `${partEdit.forgiven}`);
  check('5: …and the balance never exceeds what was actually earned',
    partEdit.net <= partEdit.earned, `${partEdit.net} ≤ ${partEdit.earned}`);

  // Penalties switched off, then on again.
  const offSeg = liveSegment({ daysAgo: 7, days: {}, penalties: false });
  const offB = computeXPBreakdown({ archives: NEAR, currentSegment: offSeg.seg, ledger, currentEra: 2 });
  check('5: switching penalties off removes them and the protection that covered them',
    offB.forgiven === 0 && offB.net === 75100, `${offB.net}`);
  const onB = computeXPBreakdown({ archives: NEAR, currentSegment: gap.seg, ledger, currentEra: 2 });
  check('5: …and switching them back on restores both', onB.net === FLOOR && onB.forgiven === 320);

  // A credit written before the basis existed.
  const legacy = { forgiven: 320, forgivenUnits: 2 };
  const stamp = forgivenessBasisStamp({ archives: NEAR, currentSegment: gap.seg, ledger: legacy, currentEra: 2 });
  check('5: an older credit is stamped at its current value — the balance does not move',
    stamp && stamp.forgivenBasis === 420
      && computeXPBreakdown({ archives: NEAR, currentSegment: gap.seg, ledger: { ...legacy, ...stamp }, currentEra: 2 }).net === FLOOR);
  check('5: …and from then on it unwinds like any other',
    computeXPBreakdown({ archives: NEAR, currentSegment: offSeg.seg, ledger: { ...legacy, ...stamp }, currentEra: 2 }).forgiven === 0);
  check('5: a stamp is written once', forgivenessBasisStamp({ archives: NEAR, currentSegment: gap.seg, ledger: { ...legacy, ...stamp }, currentEra: 2 }) === null);
  check('5: an unstamped credit is stamped first, never written down',
    forgivenessRatchet({ archives: NEAR, currentSegment: offSeg.seg, ledger: legacy, currentEra: 2 }) === null);

  // Protection that is no longer needed does not come back to swallow later
  // missed days. Three of the seven days are logged afterwards; settling
  // writes the credit down to what the remaining four still need.
  const threeIn = settle({ archives: NEAR, currentSegment: someLogged.seg, ledger, currentEra: 2 }, FLOOR);
  check('5: penalties gone for good write the protection down for good',
    threeIn.forgiven === 140 && threeIn.forgivenBasis === 240, JSON.stringify(threeIn));
  const threeNet = computeXPBreakdown({ archives: NEAR, currentSegment: someLogged.seg, ledger: threeIn, currentEra: 2 }).net;
  check('5: …which leaves the balance exactly where reading it already put it', threeNet === partEdit.net, `${threeNet} vs ${partEdit.net}`);
  // The next morning: day 8 passes with nothing logged.
  const nextMorning = liveSegment({ daysAgo: 8, days: fixedThree });
  const nmLedger = settle({ archives: NEAR, currentSegment: nextMorning.seg, ledger: threeIn, currentEra: 2 }, FLOOR);
  const nmNet = computeXPBreakdown({ archives: NEAR, currentSegment: nextMorning.seg, ledger: nmLedger, currentEra: 2 }).net;
  check('5: a missed day after that costs its full 60', nmNet === threeNet - 60 && nmNet > FLOOR, `${threeNet} → ${nmNet}`);
  const refilled = computeXPBreakdown({ archives: NEAR, currentSegment: nextMorning.seg, ledger, currentEra: 2 }).net;
  check('5: …where protection that refilled would have swallowed it', refilled === threeNet, `${refilled}`);
  const undone = settle({ archives: NEAR, currentSegment: gap.seg, ledger: threeIn, currentEra: 2 }, FLOOR);
  check('5: un-logging those days again restores the original protection exactly',
    undone.forgiven === 320 && undone.forgivenBasis === 420
      && computeXPBreakdown({ archives: NEAR, currentSegment: gap.seg, ledger: undone, currentEra: 2 }).net === FLOOR,
    JSON.stringify(undone));

  // Switching penalties off and on again, with XP earned in between. The
  // app measures "gone for good" with penalties on, so the switch is not
  // mistaken for it.
  const offEarn = liveSegment({ daysAgo: 7, days: { 8: { tasks: { ...FULL } } }, penalties: false });
  const onEarn = liveSegment({ daysAgo: 7, days: { 8: { tasks: { ...FULL } } } });
  const offLedger = settle({ archives: NEAR, currentSegment: offEarn.seg, ledger, currentEra: 2 }, FLOOR, onEarn.seg);
  check('5: switching penalties off never writes the protection down', JSON.stringify(offLedger) === JSON.stringify(ledger), JSON.stringify(offLedger));
  check('5: while they are off, the balance is everything earned',
    computeXPBreakdown({ archives: NEAR, currentSegment: offEarn.seg, ledger: offLedger, currentEra: 2 }).net === 75100 + todayXP);
  const backOn = settle({ archives: NEAR, currentSegment: onEarn.seg, ledger: offLedger, currentEra: 2 }, FLOOR);
  const backOnNet = computeXPBreakdown({ archives: NEAR, currentSegment: onEarn.seg, ledger: backOn, currentEra: 2 }).net;
  check('5: switching them back on returns exactly the floor plus what was earned in between',
    backOnNet === FLOOR + todayXP, `${backOnNet}`);
  const naive = settle({ archives: NEAR, currentSegment: offEarn.seg, ledger, currentEra: 2 }, FLOOR, offEarn.seg);
  const naiveNet = computeXPBreakdown({ archives: NEAR, currentSegment: onEarn.seg,
    ledger: settle({ archives: NEAR, currentSegment: onEarn.seg, ledger: naive, currentEra: 2 }, FLOOR), currentEra: 2 }).net;
  check('5: …which measuring with penalties off would have got wrong', naiveNet < backOnNet, `${naiveNet} < ${backOnNet}`);
  const offThree = liveSegment({ daysAgo: 7, days: fixedThree, penalties: false });
  const offThreeLedger = settle({ archives: NEAR, currentSegment: offThree.seg, ledger, currentEra: 2 }, FLOOR, someLogged.seg);
  check('5: days logged while penalties are off still write the protection down',
    offThreeLedger.forgiven === 140 && offThreeLedger.forgivenBasis === 240, JSON.stringify(offThreeLedger));

  // Deleting the record of the period also removes its protection.
  const delB = computeXPBreakdown({ archives: NEAR, currentSegment: { gained: 0, lost: 0 }, ledger, currentEra: 2 });
  check('5: deleting the period\'s record removes its protection with it', delB.forgiven === 0 && delB.net === 75100);

  // Undoing the one-time reconciliation restores the credit's basis too.
  const rec = buildReconciliation({ amount: 100, archiveCount: 1, unverifiedCount: 0, charged: [] }, 80000, FLOOR, 320, 420);
  check('5: the reconciliation remembers the credit\'s basis for its undo', rec.forgivenBefore === 320 && rec.forgivenBasisBefore === 420);

  // The floor itself never moves.
  check('5: the floor is the highest rank\'s threshold, as before', FLOOR === 75000 && rankFloorXP(8) === 100000);
}

// ══ 6: a randomised history never manufactures XP ══════════════════════════
{
  let seed = 20261121;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let violations = 0;
  let transitionsMoved = 0;
  let missesMischarged = 0;
  for (let run = 0; run < 60; run++) {
    const archives = [{ id: 'base', xpEarned: 75000 + Math.floor(rnd() * 600), challenge: { xpEconomyVersion: 2 } }];
    let ledger = null;
    const len = 4 + Math.floor(rnd() * 10);
    const days = {};
    for (let i = 1; i < len; i++) if (rnd() < 0.35) days[i] = { tasks: rnd() < 0.5 ? { ...FULL } : { daily_log: true } };
    let s = liveSegment({ daysAgo: len - 1, days });
    ledger = settle({ archives, currentSegment: s.seg, ledger, currentEra: 2 }, FLOOR);
    const earnedEver = (b) => b.earned;
    // Retroactively log a random past day, then settle again.
    const k = 1 + Math.floor(rnd() * (len - 1));
    const edited = { ...days, [k]: { tasks: { ...FULL } } };
    s = liveSegment({ daysAgo: len - 1, days: edited });
    ledger = settle({ archives, currentSegment: s.seg, ledger, currentEra: 2 }, FLOOR);
    let b = computeXPBreakdown({ archives, currentSegment: s.seg, ledger, currentEra: 2 });
    if (shown(b.net, FLOOR) > Math.max(FLOOR, earnedEver(b))) violations++;
    if (b.forgiven > b.grossPenalties) violations++;
    // The next morning, today passes with nothing logged: exactly one missed
    // day's 60, unless that would cross the floor.
    const tomorrow = liveSegment({ daysAgo: len, days: edited });
    const tLedger = settle({ archives, currentSegment: tomorrow.seg, ledger, currentEra: 2 }, FLOOR);
    const tb = computeXPBreakdown({ archives, currentSegment: tomorrow.seg, ledger: tLedger, currentEra: 2 });
    if (shown(tb.net, FLOOR) !== Math.max(FLOOR, shown(b.net, FLOOR) - 60)) missesMischarged++;
    // End the segment, carrying or archiving it.
    const before = shown(b.net, FLOOR);
    const hasRecords = Object.keys(edited).length > 0;
    const nextArchives = hasRecords ? [...archives, archiveOf(s)] : archives;
    const nextLedger = hasRecords ? ledger : appendCarried(ledger, carriedOf(s));
    const after = computeXPBreakdown({ archives: nextArchives, currentSegment: { gained: 0, lost: 0 }, ledger: nextLedger, currentEra: 2 });
    if (shown(after.net, FLOOR) !== before) transitionsMoved++;
  }
  check('6: across 60 random histories, the shown balance never exceeds max(floor, XP earned)', violations === 0, `${violations} violations`);
  check('6: …and no transition ever moved the shown balance', transitionsMoved === 0, `${transitionsMoved} moved`);
  check('6: …and every new missed day cost exactly 60, or stopped at the floor', missesMischarged === 0, `${missesMischarged} mischarged`);
}

// ══ 7: the notice shows each missed day once, and never moves XP ═══════════
{
  const days = { 1: { tasks: { ...FULL } }, 2: { tasks: { ...FULL } } };
  // Today is day 10: days 3–9 missed (seven days, −420).
  const inputsAt = (today, d = days) => ({ days: d, tasks: fdTasks, meta: fdMeta, challengeStart: offset(-(today - 1)), rawDay: today, dayNum: today, penaltiesEnabled: true, xpStartDay: 1 });
  const g1 = recentGap(inputsAt(10));
  check('7: a seven-day gap is announced in full', g1.missedDays === 7 && g1.penalty === 420 && shouldShowComeback(g1, null));
  const part1 = unacknowledgedPart(g1, null);
  check('7: …all of it unseen', part1.missedDays === 7 && part1.penalty === 420 && !part1.isUpdate);
  const ack = acknowledgementKey(g1, null);
  check('7: dismissing records it as acknowledged through its last day', acknowledgedThrough(g1, ack) === 9 && ack === g1.key);
  check('7: once dismissed it does not show again', !shouldShowComeback(g1, ack));

  // A day later the same gap has grown by one day. The start date is the same
  // calendar date, so the segment is the same one.
  const start = offset(-9);
  const nextDay = { ...inputsAt(10), challengeStart: start, rawDay: 11, dayNum: 11 };
  const g2 = recentGap(nextDay);
  check('7: the next morning the gap has grown to eight days', g2.missedDays === 8 && g2.penalty === 480);
  const part2 = unacknowledgedPart(g2, ack);
  check('7: …but only the new day is announced, with only its XP',
    shouldShowComeback(g2, ack) && part2.missedDays === 1 && part2.penalty === 60 && part2.isUpdate && part2.fromDay === 10,
    JSON.stringify(part2));
  const ack2 = acknowledgementKey(g2, ack);
  check('7: dismissing that acknowledges through the new day', acknowledgedThrough(g2, ack2) === 10 && !shouldShowComeback(g2, ack2));

  // Logging a day inside the acknowledged stretch shortens today's gap; the
  // days after it were already shown and stay shown.
  const editedDays = { ...days, 6: { tasks: { ...FULL } } };
  const g3 = recentGap({ ...nextDay, days: editedDays });
  check('7: a day logged inside an acknowledged gap does not resurface the rest', g3 && !shouldShowComeback(g3, ack2), g3 && g3.key);
  check('7: and the acknowledgement never moves backwards', acknowledgedThrough(g3, acknowledgementKey(g3, ack2)) === 10);

  // A new gap after a return is a new event.
  const back = { ...days, 10: { tasks: { ...FULL } }, 11: { tasks: { ...FULL } } };
  const later = { ...nextDay, days: back, rawDay: 15, dayNum: 15, challengeStart: offset(-14) };
  const g4 = recentGap(later);
  check('7: a later, separate gap is announced in full', g4 && shouldShowComeback(g4, null) && unacknowledgedPart(g4, null).missedDays === g4.missedDays);
  check('7: an acknowledgement from another segment says nothing about this one',
    acknowledgedThrough(g1, `1999-01-01|3-40`) === 0);

  // The notice is display state: neither showing nor dismissing it moves XP.
  const seg = liveSegment({ daysAgo: 9, days }).seg;
  const a = computeXPBreakdown({ archives: BANKED, currentSegment: seg, ledger: null, currentEra: 2 }).net;
  const b = computeXPBreakdown({ archives: BANKED, currentSegment: seg, ledger: { seenComeback: ack2 }, currentEra: 2 }).net;
  check('7: dismissing a notice changes no XP', a === b);
}

// ══ summary ═════════════════════════════════════════════════════════════════
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
